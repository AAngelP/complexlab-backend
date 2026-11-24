const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();

/* ==================================================
   CONFIGURACIÓN GENERAL Y BASE DE DATOS (NEON)
================================================== */

app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

const DATABASE_URL =
    process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_hFLcE4gkA5Gi@ep-tiny-credit-bcptlj02-pooler.c-16.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function inicializarBaseDeDatos() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuario (
                id_usuario BIGSERIAL PRIMARY KEY,
                nombre_usuario VARCHAR(30) NOT NULL UNIQUE,
                correo TEXT NOT NULL,
                password_hash CHAR(64) NOT NULL,
                password_salt CHAR(32) NOT NULL,
                correo_verificado BOOLEAN NOT NULL DEFAULT FALSE
            );

            CREATE TABLE IF NOT EXISTS registro_pendiente (
                id_pendiente BIGSERIAL PRIMARY KEY,
                nombre_usuario VARCHAR(30) NOT NULL,
                correo TEXT NOT NULL,
                password_hash CHAR(64) NOT NULL,
                password_salt CHAR(32) NOT NULL,
                fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_registro_pendiente_usuario
                ON registro_pendiente (LOWER(nombre_usuario));

            CREATE TABLE IF NOT EXISTS codigo_de_verificacion (
                id_codigo BIGSERIAL PRIMARY KEY,
                codigo_temporal CHAR(6) NOT NULL,
                fecha_expiracion TIMESTAMPTZ NOT NULL,
                usado BOOLEAN NOT NULL DEFAULT FALSE,
                id_pendiente BIGINT NOT NULL
                    REFERENCES registro_pendiente(id_pendiente) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_codigo_verificacion_pendiente
                ON codigo_de_verificacion(id_pendiente);

            CREATE TABLE IF NOT EXISTS progreso (
                id_progreso BIGSERIAL PRIMARY KEY,
                id_usuario BIGINT NOT NULL
                    REFERENCES usuario(id_usuario) ON DELETE CASCADE,
                numero_de_intento INTEGER NOT NULL,
                fecha_de_guardado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                unidad_tematica VARCHAR(150) NOT NULL,
                calificacion NUMERIC(4,2) NOT NULL
                    CHECK (calificacion >= 0 AND calificacion <= 10)
            );

            CREATE INDEX IF NOT EXISTS idx_progreso_usuario
                ON progreso(id_usuario);

            CREATE TABLE IF NOT EXISTS desarrollo_simulacion (
                id_registro BIGSERIAL PRIMARY KEY,
                id_usuario BIGINT NOT NULL
                    REFERENCES usuario(id_usuario) ON DELETE CASCADE,
                fecha_de_guardado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                desarrollo_id VARCHAR(100) NOT NULL,
                simulacion_id VARCHAR(150) NOT NULL,
                ruta_pdf TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_desarrollo_usuario
                ON desarrollo_simulacion(id_usuario);
        `);

        const existeDemo = await client.query(
            'SELECT id_usuario FROM usuario WHERE LOWER(nombre_usuario) = LOWER($1)',
            ['usuario_p1']
        );

        if (existeDemo.rows.length === 0) {
            const { salt, hash } = crearHashPassword('Qw1234567$');
            await client.query(
                `INSERT INTO usuario (nombre_usuario, correo, password_hash, password_salt, correo_verificado)
                 VALUES ($1, $2, $3, $4, TRUE)`,
                ['usuario_p1', 'demo@gmail.com', hash, salt]
            );
        }

        console.log('Base de datos Neon conectada y verificada correctamente.');
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
    } finally {
        client.release();
    }
}

app.use(cors({
    origin: FRONTEND_ORIGIN
        ? FRONTEND_ORIGIN.split(',').map(origin => origin.trim())
        : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const ROOT = __dirname;
const BUILD_DIR = path.join(ROOT, 'build');

const rutaCssMayus = path.join(ROOT, 'CSSvistas');
const rutaCssMinus = path.join(ROOT, 'cssvistas');
const carpetaCssReal = fs.existsSync(rutaCssMayus) ? rutaCssMayus : rutaCssMinus;

const DIR = {
    imagenes: path.join(ROOT, 'imagenes'),
    fondos: path.join(ROOT, 'fondos'),
    css: carpetaCssReal,
    vistas: path.join(ROOT, 'vistas'),
    js: path.join(ROOT, 'js'),
    simulaciones: path.join(ROOT, 'simulaciones')
};

/* ==================================================
   DIAGNÓSTICO Y ARCHIVOS ESTÁTICOS
================================================== */

Object.entries(DIR).forEach(([nombre, ruta]) => {
    if (!fs.existsSync(ruta)) {
        console.warn(`[ADVERTENCIA] No existe el directorio "${nombre}": ${ruta}`);
    }
});

app.use('/imagenes', express.static(DIR.imagenes, { fallthrough: false, maxAge: '1d' }));
app.use('/fondos', express.static(DIR.fondos, { fallthrough: false, maxAge: '1d' }));
app.use('/cssvistas', express.static(DIR.css, { fallthrough: false, maxAge: '1d' }));
app.use('/vistas', express.static(DIR.vistas, { fallthrough: false, maxAge: '1d' }));
// Archivos locales de KaTeX (ubicados en la raíz del proyecto junto a vistas/)
app.use('/fonts', express.static(path.join(ROOT, 'fonts'), { fallthrough: false, maxAge: '7d' }));
app.get('/katex.min.css', (req, res) => {
    res.sendFile(path.join(ROOT, 'katex.min.css'));
});
app.get('/katex.min.js', (req, res) => {
    res.sendFile(path.join(ROOT, 'katex.min.js'));
});
app.use('/js', express.static(DIR.js, { fallthrough: false, maxAge: '1d' }));

const juegos = [
    ['cazador', 'cazador-complejo'],
    ['residuo', 'residuo'],
    ['raicesypotencias', 'raicesypotencias'],
    ['armonicos', 'armonicos'],
    ['cauchy', 'cauchy'],
    ['mapeos', 'mapeos']
];

juegos.forEach(([url, carpeta]) => {
    const ruta = path.join(DIR.simulaciones, carpeta);
    app.use(`/juegos/${url}`, express.static(ruta, { fallthrough: false, maxAge: '1h' }));
});

if (fs.existsSync(BUILD_DIR)) {
    app.use(express.static(BUILD_DIR, { index: false, fallthrough: true, maxAge: '1h' }));
}
/* ==================================================
   FUNCIONES AUXILIARES DE VISTAS
================================================== */

function leerHtml(nombreArchivo) {
    const ruta = path.join(DIR.vistas, nombreArchivo);
    return fs.promises.readFile(ruta, 'utf8');
}

function responderVista(res, nombreArchivo, cssUrl = '') {
    leerHtml(nombreArchivo)
        .then(html => {
            res.set('Cache-Control', 'no-store');
            res.json({ cssUrl, html });
        })
        .catch(error => {
            console.error(`Error leyendo ${nombreArchivo}:`, error.message);
            res.status(500).json({
                error: `No se pudo cargar ${nombreArchivo}.`,
                detalle: process.env.NODE_ENV === 'production' ? undefined : error.message
            });
        });
}

function responderJuego(res, carpeta) {
    const rutaJuego = `/juegos/${carpeta}/index.html`;
    const html = `
        <div class="contenedor-juego-flotante"
             style="width:100%;height:calc(100vh - 60px);display:flex;box-sizing:border-box;padding:10px;">
            <iframe
                src="${rutaJuego}"
                title="Simulación COMPLEXLAB"
                style="width:100%;height:100%;border:none;border-radius:15px;background:transparent;"
                loading="eager"
                allow="autoplay"
                allowfullscreen>
            </iframe>
        </div>
    `;
    res.json({ cssUrl: '', html });
}

function enviarError(res, status, mensaje) {
    return res.status(status).json({ error: mensaje });
}

/* ==================================================
   SALUD Y CONFIGURACIÓN
================================================== */

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({
            estado: 'activo',
            baseDeDatos: 'conectada',
            servidor: 'COMPLEXLAB',
            fecha: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            estado: 'degradado',
            baseDeDatos: 'error',
            error: error.message
        });
    }
});

app.get('/api/configuracion', (req, res) => {
    res.json({
        fondoAnimado: '/fondos/complejo.html'
    });
});

/* ==================================================
   CATÁLOGO DE SIMULACIONES Y JUEGOS
================================================== */

app.get('/api/simulaciones', async (req, res) => {
    const simulaciones = [
        { titulo: 'Suma, resta y multiplicación', imagen: '/imagenes/imgcazador-complejo.png', url: '/api/cargar-juego/cazador' },
        { titulo: 'Reactor Cuántico RLC', imagen: '/imagenes/Residuo.png', url: '/api/cargar-juego/residuo' },
        { titulo: 'La aventura de Moivre', imagen: '/imagenes/raicesypotencias.png', url: '/api/cargar-juego/raicesypotencias' },
        { titulo: 'Restaurador armónico', imagen: '/imagenes/armonicos.png', url: '/api/cargar-juego/armonicos' },
        { titulo: 'Mapeo Conformal', imagen: '/imagenes/mapeos.png', url: '/api/cargar-juego/mapeos' },
        { titulo: 'Túnel Aerodinámico de Argand', imagen: '/imagenes/cauchy.png', url: '/api/cargar-juego/cauchy' }
    ];

    try {
        const html = await leerHtml('simulaciones.html');
        const tarjetas = simulaciones.map(sim => `
            <div class="tarjeta-simulacion" onclick="irASimulacion(event, '${sim.url}')">
                <img src="${sim.imagen}" alt="${sim.titulo}" loading="lazy">
                <h3>${sim.titulo}</h3>
            </div>
        `).join('');

        res.json({
            cssUrl: '/cssvistas/simulaciones.css',
            html: html.replace(/{{tarjetas}}/g, tarjetas)
        });
    } catch (error) {
        console.error('Error cargando simulaciones:', error.message);
        enviarError(res, 500, 'No se pudo cargar simulaciones.html.');
    }
});

app.get('/api/cargar-juego/cazador', (req, res) => responderJuego(res, 'cazador-complejo'));
app.get('/api/cargar-juego/residuo', (req, res) => responderJuego(res, 'residuo'));
app.get('/api/cargar-juego/raicesypotencias', (req, res) => responderJuego(res, 'raicesypotencias'));
app.get('/api/cargar-juego/armonicos', (req, res) => responderJuego(res, 'armonicos'));
app.get('/api/cargar-juego/mapeos', (req, res) => responderJuego(res, 'mapeos'));
app.get('/api/cargar-juego/cauchy', (req, res) => responderJuego(res, 'cauchy'));

/* ==================================================
   VARIABLE COMPLEJA Y TEMAS
================================================== */

app.get('/api/variable-compleja', async (req, res) => {
    const cursos = [
        { id: 'algebra', titulo: 'Álgebra Compleja', imagen: '/imagenes/algebra.png', activo: true },
        { id: 'derivacion', titulo: 'Derivación Compleja', imagen: '/imagenes/derivacion.png', activo: false },
        { id: 'integracion', titulo: 'Integración Compleja', imagen: '/imagenes/integracion.png', activo: false }
    ];

    try {
        const html = await leerHtml('caps-de-var-compleja.html');
        const tarjetas = cursos.map(cur => `
            <div class="tarjeta-curso ${cur.activo ? 'activo' : ''}" data-id="${cur.id}">
                <div class="contenedor-img">
                    <img src="${cur.imagen}" alt="${cur.titulo}" loading="lazy">
                </div>
                <h3>${cur.titulo}</h3>
            </div>
        `).join('');

        res.json({
            cssUrl: '/cssvistas/caps-de-var-complejacss.css',
            html: html.replace(/{{tarjetas_cursos}}/g, tarjetas)
        });
    } catch (error) {
        console.error('Error cargando variable compleja:', error.message);
        enviarError(res, 500, 'No se pudo cargar caps-de-var-compleja.html.');
    }
});

app.get('/api/variable-compleja/algebra', async (req, res) => {
    const temas = [
        {
            id: 'suma-compleja',
            titulo: 'Suma Compleja',
            color: 'rgba(74, 189, 172, 0.2)',
            descripcion: 'Aprende a combinar las partes reales e imaginarias de forma independiente. Representa la traslación de vectores en el plano de Argand.',
            urlSimulacion: '/api/cargar-juego/cazador'
        },
        {
            id: 'multiplicacion-compleja',
            titulo: 'Multiplicación Compleja',
            color: 'rgba(52, 152, 219, 0.2)',
            descripcion: 'Descubre cómo multiplicar números complejos escala las magnitudes y suma sus argumentos trigonométricos, provocando rotaciones.',
            urlSimulacion: '/api/cargar-juego/cazador'
        },
        {
            id: 'teorema-demoivre',
            titulo: 'Teorema de De Moivre',
            color: 'rgba(241, 196, 15, 0.2)',
            descripcion: 'Aplica potencias enteras de forma inmediata utilizando la forma polar. Permite calcular raíces n-ésimas de manera geométrica.',
            urlSimulacion: '/api/cargar-juego/raicesypotencias'
        }
    ];

    try {
        const html = await leerHtml('temas-algebra.html');
        const tarjetas = temas.map(tema => `
            <div class="tarjeta-tema" style="background:${tema.color};" onclick="redirigirTema(event, '${tema.id}')">
                <div class="contenido-tema">
                    <h3>${tema.titulo}</h3>
                    <p class="desc">${tema.descripcion}</p>
                </div>
                <div class="acciones-tema">
                    <button class="btn-tema btn-sim" onclick="irASimulacion(event, '${tema.urlSimulacion}')">Simulación</button>
                    <button class="btn-tema btn-test" onclick="abrirTestProximamente(event)">Test</button>
                </div>
            </div>
        `).join('');

        res.json({
            cssUrl: '/cssvistas/temas-algebra.css',
            html: html.replace(/{{tarjetas_temas}}/g, tarjetas)
        });
    } catch (error) {
        enviarError(res, 500, 'No se pudo cargar temas-algebra.html.');
    }
});
app.get('/api/variable-compleja/derivacion', async (req, res) => {
    const temas = [
        {
            id: 'bases-derivacion',
            titulo: 'Bases de Derivación Compleja',
            color: 'rgba(74, 189, 172, 0.2)',
            descripcion: 'Definición formal de límite en el plano complejo, continuidad de funciones f(z) y reglas elementales de derivación.',
            urlSimulacion: '#'
        },
        {
            id: 'derivacion-nivel-medio',
            titulo: 'Derivación Nivel Medio',
            color: 'rgba(52, 152, 219, 0.2)',
            descripcion: 'Regla de la cadena, derivación de funciones exponenciales, trigonométricas, hiperbólicas y logaritmo complejo.',
            urlSimulacion: '#'
        },
        {
            id: 'cauchy-riemann-laplace',
            titulo: 'Cauchy-Riemann, Analiticidad y Laplace',
            color: 'rgba(241, 196, 15, 0.2)',
            descripcion: 'Ecuaciones de Cauchy-Riemann, criterios para comprobar funciones analíticas y verificación de funciones armónicas con la ecuación de Laplace.',
            urlSimulacion: '#'
        }
    ];

    try {
        const html = await leerHtml('temas-derivacion.html');
        const tarjetas = temas.map(tema => `
            <div class="tarjeta-tema" style="background:${tema.color};" onclick="redirigirTema(event, '${tema.id}')">
                <div class="contenido-tema">
                    <h3>${tema.titulo}</h3>
                    <p class="desc">${tema.descripcion}</p>
                </div>
                <div class="acciones-tema">
                    ${tema.urlSimulacion !== '#'
                        ? `<button class="btn-tema btn-sim" onclick="irASimulacion(event, '${tema.urlSimulacion}')">Simulación</button>`
                        : '<span class="no-sim">Sin simulación</span>'}
                    <button class="btn-tema btn-test" onclick="abrirTestProximamente(event)">Test</button>
                </div>
            </div>
        `).join('');

        res.json({
            cssUrl: '/cssvistas/temas-algebra.css',
            html: html.replace(/{{tarjetas_temas}}/g, tarjetas)
        });
    } catch (error) {
        enviarError(res, 500, 'No se pudo cargar temas-derivacion.html.');
    }
});

app.get('/api/variable-compleja/integracion', async (req, res) => {
    const temas = [
        {
            id: 'bases-integracion',
            titulo: 'Bases de Integración Compleja',
            color: 'rgba(74, 189, 172, 0.2)',
            descripcion: 'Integrales de línea en el plano complejo, parametrización de contornos, propiedades fundamentales y acotación ML.',
            urlSimulacion: '#'
        },
        {
            id: 'integral-cauchy',
            titulo: 'Integral de Cauchy',
            color: 'rgba(52, 152, 219, 0.2)',
            descripcion: 'Teorema de Cauchy-Goursat, independencia de la trayectoria y Fórmula Integral de Cauchy para derivadas de orden superior.',
            urlSimulacion: '#'
        },
        {
            id: 'teorema-residuo',
            titulo: 'Teorema del Residuo',
            color: 'rgba(241, 196, 15, 0.2)',
            descripcion: 'Clasificación de singularidades aisladas, cálculo de residuos y evaluación de integrales cerradas mediante el Teorema de los Residuos.',
            urlSimulacion: '#'
        }
    ];

    try {
        const html = await leerHtml('temas-integracion.html');
        const tarjetas = temas.map(tema => `
            <div class="tarjeta-tema" style="background:${tema.color};" onclick="redirigirTema(event, '${tema.id}')">
                <div class="contenido-tema">
                    <h3>${tema.titulo}</h3>
                    <p class="desc">${tema.descripcion}</p>
                </div>
                <div class="acciones-tema">
                    ${tema.urlSimulacion !== '#'
                        ? `<button class="btn-tema btn-sim" onclick="irASimulacion(event, '${tema.urlSimulacion}')">Simulación</button>`
                        : '<span class="no-sim">Sin simulación</span>'}
                    <button class="btn-tema btn-test" onclick="abrirTestProximamente(event)">Test</button>
                </div>
            </div>
        `).join('');

        res.json({
            cssUrl: '/cssvistas/temas-algebra.css',
            html: html.replace(/{{tarjetas_temas}}/g, tarjetas)
        });
    } catch (error) {
        enviarError(res, 500, 'No se pudo cargar temas-integracion.html.');
    }
});

const archivosTemas = {
    'suma-compleja': 'tema-suma.html',
    'multiplicacion-compleja': 'tema-multiplicacion.html',
    'teorema-demoivre': 'tema-demoivre.html',
    'bases-derivacion': 'tema-bases-derivacion.html',
    'derivacion-nivel-medio': 'tema-derivacion-medio.html',
    'cauchy-riemann-laplace': 'tema-cauchy-riemann.html',
    'bases-integracion': 'tema-bases-integracion.html',
    'integral-cauchy': 'tema-integral-cauchy.html',
    'teorema-residuo': 'tema-teorema-residuo.html'
};

app.get('/api/contenido-tema/:id', async (req, res) => {
    const nombreArchivo = archivosTemas[req.params.id];
    if (!nombreArchivo) return enviarError(res, 404, 'Tema no encontrado.');

    try {
        const html = await leerHtml(nombreArchivo);
        res.json({ html });
    } catch (error) {
        enviarError(res, 500, `No se pudo leer ${nombreArchivo}.`);
    }
});

app.get('/api/sobre-nosotros', async (req, res) => {
    const datosSobreNosotros = {
        mision: 'Proveer a los estudiantes de la Escuela Superior de Cómputo (ESCOM) una herramienta interactiva y visual que facilite la comprensión profunda de la Variable Compleja, conectando la teoría matemática con aplicaciones reales en sistemas computacionales.',
        vision: 'Ser la plataforma de simulación matemática referente dentro de la ESCOM, impulsando el rendimiento académico y el desarrollo de software basado en modelos analíticos complejos.',
        objetivos: [
            'Desarrollar módulos interactivos de mapeo conformal aplicados a procesamiento de señales.',
            'Facilitar la visualización de series de Laurent y residuos para el análisis de sistemas estables.',
            'Integrar herramientas de simulación accesibles desde cualquier navegador para la comunidad estudiantil.'
        ]
    };

    try {
        let html = await leerHtml('sobrenosotros.html');
        const objetivos = datosSobreNosotros.objetivos.map(objetivo => `<li>${objetivo}</li>`).join('');
        html = html.replace(/{{mision}}/g, datosSobreNosotros.mision);
        html = html.replace(/{{vision}}/g, datosSobreNosotros.vision);
        html = html.replace(/{{objetivos}}/g, objetivos);

        res.json({ cssUrl: '/cssvistas/sobrenosotros.css', html });
    } catch (error) {
        enviarError(res, 500, 'No se pudo cargar sobrenosotros.html.');
    }
});

app.get('/api/examen-algebra', (req, res) => responderVista(res, 'examen-algebra.html', '/cssvistas/examen-algebra.css'));
app.get('/api/examen-derivacion', (req, res) => responderVista(res, 'examen-derivacion.html', '/cssvistas/examen-algebra.css'));
app.get('/api/examen-integracion', (req, res) => responderVista(res, 'examen-integracion.html', '/cssvistas/examen-algebra.css'));

/* ==================================================
   AUTENTICACIÓN CON POSTGRESQL (NEON)
================================================== */

function crearHashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 32);

    return {
        salt: salt.toString('hex'),
        hash: hash.toString('hex')
    };
}

function verificarPassword(password, saltHex, hashHex) {
    try {
        const salt = Buffer.from(saltHex.trim(), 'hex');
        const hashCalculado = crypto.scryptSync(password, salt, 32);
        const hashGuardado = Buffer.from(hashHex.trim(), 'hex');

        return hashCalculado.length === hashGuardado.length &&
            crypto.timingSafeEqual(hashCalculado, hashGuardado);
    } catch (error) {
        return false;
    }
}

function validarUsuario(usuario) {
    return typeof usuario === 'string' && /^[a-zA-Z0-9_.-]{3,30}$/.test(usuario);
}

function validarCorreo(correo) {
    return typeof correo === 'string' && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(correo);
}

function validarPassword(password) {
    return typeof password === 'string' &&
        password.length >= 10 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password);
}

function generarCodigo6Digitos() {
    return String(crypto.randomInt(100000, 1000000));
}

async function enviarCorreoVerificacion(correo, usuario, codigo) {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || `"COMPLEXLAB" <${process.env.SMTP_USER}>`,
            to: correo,
            subject: 'Código de verificación - COMPLEXLAB',
            text: `Hola ${usuario}, tu código de verificación es: ${codigo}. Válido por 2 minutos.`,
            html: `<p>Hola <strong>${usuario}</strong>,</p><p>Tu código de verificación de COMPLEXLAB es:</p><h2>${codigo}</h2><p>Este código es válido por 2 minutos.</p>`
        });
        return true;
    } else {
        console.log(`[VERIFICACIÓN DEMO] Usuario: ${usuario} | Correo: ${correo} | Código: ${codigo}`);
        return false;
    }
}
app.get('/api/vistas/inicio-sesion', (req, res) => {
    res.set('Cache-Control', 'no-store');
    responderVista(res, 'inicio-sesion.html', '/cssvistas/auth.css');
});

app.get('/api/vistas/registro', (req, res) => {
    res.set('Cache-Control', 'no-store');
    responderVista(res, 'registro.html', '/cssvistas/auth.css');
});

app.post('/api/registro/enviar-codigo', async (req, res) => {
    const { usuario, correo, password } = req.body || {};

    if (!usuario || !correo || !password) {
        return enviarError(res, 400, 'Todos los campos son obligatorios.');
    }

    const nombreUsuario = usuario.trim();
    const email = correo.trim();

    if (!validarUsuario(nombreUsuario)) {
        return enviarError(res, 400, 'El usuario debe tener entre 3 y 30 caracteres (letras, números, punto, guion y guion bajo).');
    }

    if (!validarCorreo(email)) {
        return enviarError(res, 400, 'Ingresa un correo válido que termine en @gmail.com.');
    }

    if (!validarPassword(password)) {
        return enviarError(res, 400, 'La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula, un número y un carácter especial.');
    }

    const client = await pool.connect();
    try {
        const existeUsuario = await client.query(
            'SELECT 1 FROM usuario WHERE LOWER(nombre_usuario) = LOWER($1) OR LOWER(correo) = LOWER($2)',
            [nombreUsuario, email]
        );

        if (existeUsuario.rows.length > 0) {
            return enviarError(res, 409, 'El nombre de usuario o el correo ya están registrados.');
        }

        await client.query('BEGIN');

        await client.query(
            'DELETE FROM registro_pendiente WHERE LOWER(nombre_usuario) = LOWER($1) OR LOWER(correo) = LOWER($2)',
            [nombreUsuario, email]
        );

        const { salt, hash } = crearHashPassword(password);

        const resPendiente = await client.query(
            `INSERT INTO registro_pendiente (nombre_usuario, correo, password_hash, password_salt)
             VALUES ($1, $2, $3, $4) RETURNING id_pendiente`,
            [nombreUsuario, email, hash, salt]
        );

        const idPendiente = resPendiente.rows.id_pendiente;
        const codigo = generarCodigo6Digitos();
        const expiraEn = new Date(Date.now() + 2 * 60 * 1000);

        await client.query(
            `INSERT INTO codigo_de_verificacion (codigo_temporal, fecha_expiracion, usado, id_pendiente)
             VALUES ($1, $2, FALSE, $3)`,
            [codigo, expiraEn.toISOString(), idPendiente]
        );

        await client.query('COMMIT');

        const enviadoPorCorreo = await enviarCorreoVerificacion(email, nombreUsuario, codigo);

        return res.status(200).json({
            mensaje: enviadoPorCorreo
                ? 'Código enviado a tu correo @gmail.com.'
                : `Código generado (Modo sin SMTP: ${codigo}). Revisa tu bandeja.`,
            expiraEn: expiraEn.toISOString()
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en /api/registro/enviar-codigo:', error);
        return enviarError(res, 500, 'Error al procesar el registro.');
    } finally {
        client.release();
    }
});

app.post('/api/registro/verificar', async (req, res) => {
    const { usuario, codigo } = req.body || {};

    if (!usuario || !codigo) {
        return enviarError(res, 400, 'Faltan datos para la verificación.');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const resPendiente = await client.query(
            `SELECT rp.*, cv.id_codigo, cv.codigo_temporal, cv.fecha_expiracion, cv.usado
             FROM registro_pendiente rp
             JOIN codigo_de_verificacion cv ON cv.id_pendiente = rp.id_pendiente
             WHERE LOWER(rp.nombre_usuario) = LOWER($1)
             ORDER BY cv.id_codigo DESC
             LIMIT 1`,
            [usuario.trim()]
        );

        if (resPendiente.rows.length === 0) {
            await client.query('ROLLBACK');
            return enviarError(res, 404, 'No se encontró una solicitud de registro activa.');
        }

        const registro = resPendiente.rows;

        if (registro.usado) {
            await client.query('ROLLBACK');
            return enviarError(res, 400, 'Este código ya fue utilizado.');
        }

        if (new Date(registro.fecha_expiracion) < new Date()) {
            await client.query('ROLLBACK');
            return enviarError(res, 400, 'El código ha caducado. Solicita uno nuevo.');
        }

        if (registro.codigo_temporal.trim() !== String(codigo).trim()) {
            await client.query('ROLLBACK');
            return enviarError(res, 400, 'El código de verificación es incorrecto.');
        }

        await client.query(
            'UPDATE codigo_de_verificacion SET usado = TRUE WHERE id_codigo = $1',
            [registro.id_codigo]
        );

        const nuevoUsuario = await client.query(
            `INSERT INTO usuario (nombre_usuario, correo, password_hash, password_salt, correo_verificado)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING nombre_usuario`,
            [registro.nombre_usuario, registro.correo, registro.password_hash, registro.password_salt]
        );

        await client.query(
            'DELETE FROM registro_pendiente WHERE id_pendiente = $1',
            [registro.id_pendiente]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            mensaje: 'Cuenta verificada y creada con éxito.',
            usuario: nuevoUsuario.rows.nombre_usuario
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en /api/registro/verificar:', error);
        return enviarError(res, 500, 'Error al verificar el código.');
    } finally {
        client.release();
    }
});

app.post('/api/registro/reenviar-codigo', async (req, res) => {
    const { usuario } = req.body || {};
    if (!usuario) return enviarError(res, 400, 'Usuario requerido.');

    const client = await pool.connect();
    try {
        const resPendiente = await client.query(
            'SELECT id_pendiente, nombre_usuario, correo FROM registro_pendiente WHERE LOWER(nombre_usuario) = LOWER($1)',
            [usuario.trim()]
        );

        if (resPendiente.rows.length === 0) {
            return enviarError(res, 404, 'La solicitud expiró. Por favor vuelve a llenar el formulario.');
        }

        const pendiente = resPendiente.rows;
        const nuevoCodigo = generarCodigo6Digitos();
        const expiraEn = new Date(Date.now() + 2 * 60 * 1000);

        await client.query(
            `INSERT INTO codigo_de_verificacion (codigo_temporal, fecha_expiracion, usado, id_pendiente)
             VALUES ($1, $2, FALSE, $3)`,
            [nuevoCodigo, expiraEn.toISOString(), pendiente.id_pendiente]
        );

        const enviadoPorCorreo = await enviarCorreoVerificacion(pendiente.correo, pendiente.nombre_usuario, nuevoCodigo);

        return res.status(200).json({
            mensaje: enviadoPorCorreo
                ? 'Nuevo código enviado a tu correo.'
                : `Nuevo código generado (Modo sin SMTP: ${nuevoCodigo}).`,
            expiraEn: expiraEn.toISOString()
        });
    } catch (error) {
        console.error('Error en /api/registro/reenviar-codigo:', error);
        return enviarError(res, 500, 'No se pudo reenviar el código.');
    } finally {
        client.release();
    }
});

app.post('/api/iniciar-sesion', async (req, res) => {
    const { usuario, password } = req.body || {};

    if (!usuario || !password) {
        return enviarError(res, 400, 'Ingresa el usuario y la contraseña.');
    }

    try {
        const resultado = await pool.query(
            'SELECT id_usuario, nombre_usuario, password_hash, password_salt FROM usuario WHERE LOWER(nombre_usuario) = LOWER($1)',
            [usuario.trim()]
        );

        if (resultado.rows.length === 0) {
            return enviarError(res, 401, 'Usuario o contraseña incorrectos.');
        }

        const cuenta = resultado.rows;

        if (!verificarPassword(password, cuenta.password_salt, cuenta.password_hash)) {
            return enviarError(res, 401, 'Usuario o contraseña incorrectos.');
        }

        return res.status(200).json({
            mensaje: 'Inicio de sesión correcto.',
            usuario: cuenta.nombre_usuario
        });
    } catch (error) {
        console.error('Error en /api/iniciar-sesion:', error);
        return enviarError(res, 500, 'Error interno al iniciar sesión.');
    }
});

app.get('/api/scripts/auth', async (req, res) => {
    try {
        const rutaScript = path.join(DIR.js, 'auth.js');
        const codigo = await fs.promises.readFile(rutaScript, 'utf8');
        res.type('application/javascript');
        res.set('Cache-Control', 'no-store');
        res.status(200).send(codigo);
    } catch (error) {
        enviarError(res, 500, 'No se pudo cargar el script de autenticación.');
    }
});

/* ==================================================
   MI PROGRESO Y EVALUACIONES (POSTGRESQL)
================================================== */

app.get('/api/mi-progreso', (req, res) => {
    responderVista(res, 'mi-progreso.html', '/cssvistas/mi-progreso.css');
});

app.get('/api/progreso/:usuario', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT p.id_progreso, p.numero_de_intento, p.fecha_de_guardado, p.unidad_tematica, p.calificacion
             FROM progreso p
             JOIN usuario u ON u.id_usuario = p.id_usuario
             WHERE LOWER(u.nombre_usuario) = LOWER($1)
             ORDER BY p.fecha_de_guardado DESC`,
            [req.params.usuario.trim()]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener progreso:', error);
        enviarError(res, 500, 'Error al consultar el progreso.');
    }
});

app.post('/api/progreso', async (req, res) => {
    const { usuario, numero_intento, unidad_tematica, calificacion } = req.body || {};

    if (!usuario || !unidad_tematica || calificacion === undefined) {
        return enviarError(res, 400, 'Datos incompletos para guardar progreso.');
    }

    try {
        const userRes = await pool.query(
            'SELECT id_usuario FROM usuario WHERE LOWER(nombre_usuario) = LOWER($1)',
            [usuario.trim()]
        );

        if (userRes.rows.length === 0) {
            return enviarError(res, 404, 'Usuario no encontrado.');
        }

        const idUsuario = userRes.rows[0].id_usuario;

        const insertRes = await pool.query(
            `INSERT INTO progreso (id_usuario, numero_de_intento, unidad_tematica, calificacion)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [idUsuario, numero_intento || 1, unidad_tematica, Number(calificacion)]
        );

        res.status(201).json({
            mensaje: 'Progreso guardado correctamente.',
            registro: insertRes.rows[0]
        });
    } catch (error) {
        console.error('Error al guardar progreso:', error);
        enviarError(res, 500, 'Error al guardar la calificación en la base de datos.');
    }
});

app.delete('/api/progreso/:usuario', async (req, res) => {
    try {
        await pool.query(
            `DELETE FROM progreso
             WHERE id_usuario = (SELECT id_usuario FROM usuario WHERE LOWER(nombre_usuario) = LOWER($1))`,
            [req.params.usuario.trim()]
        );
        res.json({ mensaje: 'Historial eliminado correctamente.' });
    } catch (error) {
        console.error('Error al borrar progreso:', error);
        enviarError(res, 500, 'No se pudo eliminar el historial.');
    }
});

/* ==================================================
   DESARROLLOS DE SIMULACIÓN (PDFs)
================================================== */

app.get('/api/desarrollos/:usuario', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT d.id_registro, d.fecha_de_guardado, d.desarrollo_id, d.simulacion_id, d.ruta_pdf
             FROM desarrollo_simulacion d
             JOIN usuario u ON u.id_usuario = d.id_usuario
             WHERE LOWER(u.nombre_usuario) = LOWER($1)
             ORDER BY d.fecha_de_guardado DESC`,
            [req.params.usuario.trim()]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener desarrollos:', error);
        enviarError(res, 500, 'Error al consultar los PDFs guardados.');
    }
});

app.post('/api/desarrollos', async (req, res) => {
    const { usuario, desarrollo_id, simulacion_id, ruta_pdf } = req.body || {};

    if (!usuario || !desarrollo_id || !simulacion_id) {
        return enviarError(res, 400, 'Faltan datos del desarrollo.');
    }

    try {
        const userRes = await pool.query(
            'SELECT id_usuario FROM usuario WHERE LOWER(nombre_usuario) = LOWER($1)',
            [usuario.trim()]
        );

        if (userRes.rows.length === 0) {
            return enviarError(res, 404, 'Usuario no encontrado.');
        }

        const insertRes = await pool.query(
            `INSERT INTO desarrollo_simulacion (id_usuario, desarrollo_id, simulacion_id, ruta_pdf)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userRes.rows[0].id_usuario, desarrollo_id, simulacion_id, ruta_pdf || null]
        );

        res.status(201).json({
            mensaje: 'Desarrollo guardado correctamente.',
            registro: insertRes.rows[0]
        });
    } catch (error) {
        console.error('Error al guardar desarrollo:', error);
        enviarError(res, 500, 'Error al guardar el desarrollo.');
    }
});

/* ==================================================
   MANEJO DE ERRORES Y FRONTEND REACT
================================================== */

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err.status === 404 || err.statusCode === 404) {
        return res.status(404).json({
            error: 'No se encontró el archivo solicitado.',
            ruta: req.originalUrl
        });
    }

    console.error('Error de Express:', err);
    return res.status(500).json({ error: 'Ocurrió un error interno al procesar la solicitud.' });
});

app.use('/api', (req, res) => {
    res.status(404).json({
        error: 'Ruta API no encontrada.',
        ruta: req.originalUrl
    });
});

app.get('/{*splat}', (req, res, next) => {
    const indexPath = path.join(BUILD_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath, error => {
            if (error) next(error);
        });
    }
    return res.status(200).send('Servidor API REST de COMPLEXLAB activo en Render.');
});

/* ==================================================
   ARRANQUE DEL SERVIDOR
================================================== */

inicializarBaseDeDatos().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor COMPLEXLAB activo en el puerto ${PORT}`);
        console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
    });
});
