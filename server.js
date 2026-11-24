const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const CryptoJS = require('crypto-js');

dotenv.config();

const app = express();
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '20kb' }));

/*==================================================
ARCHIVOS ESTÁTICOS GENERALES
==================================================*/
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));
app.use('/fondos', express.static(path.join(__dirname, 'fondos')));
app.use('/cssvistas', express.static(path.join(__dirname, 'cssvistas')));
app.use('/vistas', express.static(path.join(__dirname, 'vistas')));

/*==================================================
ARCHIVOS ESTÁTICOS DE SIMULACIONES (NUEVA ESTRUCTURA)
==================================================*/
app.use('/juegos/cazador', express.static(path.join(__dirname, 'simulaciones', 'cazador-complejo')));
app.use('/juegos/residuo', express.static(path.join(__dirname, 'simulaciones', 'residuo')));
app.use('/juegos/raicesypotencias', express.static(path.join(__dirname, 'simulaciones', 'raicesypotencias')));
app.use('/juegos/armonicos', express.static(path.join(__dirname, 'simulaciones', 'armonicos')));
app.use('/juegos/cauchy', express.static(path.join(__dirname, 'simulaciones', 'cauchy')));
app.use('/juegos/mapeos', express.static(path.join(__dirname, 'simulaciones', 'mapeos')));
app.use('/js', express.static(path.join(__dirname, 'js')));


/*==================================================
CONFIGURACIÓN
==================================================*/
app.get('/api/configuracion', (req, res) => {
    res.json({ fondoAnimado: '/fondos/complejo.html' });
});

/*==================================================
/*==================================================
CATÁLOGO DE SIMULACIONES
==================================================*/
app.get('/api/simulaciones', (req, res) => {
    const simulaciones = [
        {
            titulo: 'suma, resta y multiplicacion',
            imagen: '/imagenes/imgcazador-complejo.png',
            url: '/api/cargar-juego/cazador'
        },
        {
            titulo: 'Reactor Cuántico RLC',
            imagen: '/imagenes/Residuo.png',
            url: '/api/cargar-juego/residuo'
        },
        {
            titulo: 'La aventura de Moivre',
            imagen: '/imagenes/raicesypotencias.png',
            url: '/api/cargar-juego/raicesypotencias'
        },
        {
            titulo: 'Restaurador armonico',
            imagen: '/imagenes/armonicos.png',
            url: '/api/cargar-juego/armonicos'
        },
        {
            titulo: 'Mapeo Conformal', 
            imagen: '/imagenes/mapeos.png',
            url: '/api/cargar-juego/mapeos'
        },
        {
            titulo: 'Túnel Aerodinámico de Argand',
            imagen: '/imagenes/cauchy.png',
            url: '/api/cargar-juego/cauchy'
        }
    ];

    const rutaHtml = path.join(__dirname, 'vistas', 'simulaciones.html');

    fs.readFile(rutaHtml, 'utf8', (err, html) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'No se cargó simulaciones.html' });
        }

        const tarjetas = simulaciones.map(sim => `
            <div class="tarjeta-simulacion" onclick="irASimulacion(event, '${sim.url}')">
                <img src="${sim.imagen}" alt="${sim.titulo}">
                <h3>${sim.titulo}</h3>
            </div>
        `).join('');

        const htmlFinal = html.replace(/{{tarjetas}}/g, tarjetas);

        res.json({
            cssUrl: '/cssvistas/simulaciones.css',
            html: htmlFinal
        });
    });
});

/*==================================================
ENDPOINTS: INCRUSTAR JUEGOS (EVITA REDIRECCIONES)
==================================================*/
app.get('/api/cargar-juego/cazador', (req, res) => {
    const htmlIncrustado = '<div class="contenedor-juego-flotante" style="width: 100%; height: calc(100vh - 60px); display: flex; box-sizing: border-box; padding: 10px;"><iframe src="/juegos/cazador/index.html" style="width: 100%; height: 100%; border: none; border-radius: 15px; background: transparent;"></iframe></div>';
    res.json({ cssUrl: '', html: htmlIncrustado });
});

app.get('/api/cargar-juego/residuo', (req, res) => {
    const htmlIncrustado = '<div class="contenedor-juego-flotante" style="width: 100%; height: calc(100vh - 60px); display: flex; box-sizing: border-box; padding: 10px;"><iframe src="/juegos/residuo/index.html" style="width: 100%; height: 100%; border: none; border-radius: 15px; background: transparent;"></iframe></div>';
    res.json({ cssUrl: '', html: htmlIncrustado });
});

app.get('/api/cargar-juego/raicesypotencias', (req, res) => {
    const htmlIncrustado = '<div class="contenedor-juego-flotante" style="width: 100%; height: calc(100vh - 60px); display: flex; box-sizing: border-box; padding: 10px;"><iframe src="/juegos/raicesypotencias/index.html" style="width: 100%; height: 100%; border: none; border-radius: 15px; background: transparent;"></iframe></div>';
    res.json({ cssUrl: '', html: htmlIncrustado });
});

app.get('/api/cargar-juego/armonicos', (req, res) => {
    const htmlIncrustado = '<div class="contenedor-juego-flotante" style="width: 100%; height: calc(100vh - 60px); display: flex; box-sizing: border-box; padding: 10px;"><iframe src="/juegos/armonicos/index.html" style="width: 100%; height: 100%; border: none; border-radius: 15px; background: transparent;"></iframe></div>';
    res.json({ cssUrl: '', html: htmlIncrustado });
});

app.get('/api/cargar-juego/mapeos', (req, res) => {
    const htmlIncrustado = '<div class="contenedor-juego-flotante" style="width: 100%; height: calc(100vh - 60px); display: flex; box-sizing: border-box; padding: 10px;"><iframe src="/juegos/mapeos/index.html" style="width: 100%; height: 100%; border: none; border-radius: 15px; background: transparent;"></iframe></div>';
    res.json({ cssUrl: '', html: htmlIncrustado });
});

app.get('/api/cargar-juego/cauchy', (req, res) => {
    const htmlIncrustado = '<div class="contenedor-juego-flotante" style="width: 100%; height: calc(100vh - 60px); display: flex; box-sizing: border-box; padding: 10px;"><iframe src="/juegos/cauchy/index.html" style="width: 100%; height: 100%; border: none; border-radius: 15px; background: transparent;"></iframe></div>';
    res.json({ cssUrl: '', html: htmlIncrustado });
});

/*==================================================
VARIABLE COMPLEJA
==================================================*/
app.get('/api/variable-compleja', (req, res) => {
    const cursos = [
        { id: 'algebra', titulo: 'Álgebra Compleja', imagen: '/imagenes/algebra.png', activo: true },
        { id: 'derivacion', titulo: 'Derivación Compleja', imagen: '/imagenes/derivacion.png', activo: false },
        { id: 'integracion', titulo: 'Integración Compleja', imagen: '/imagenes/integracion.png', activo: false }
    ];

    const rutaHtml = path.join(__dirname, 'vistas', 'caps-de-var-compleja.html');

    fs.readFile(rutaHtml, 'utf8', (err, html) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'No se cargó caps-de-var-compleja.html' });
        }

        const tarjetas = cursos.map(cur => `
            <div class="tarjeta-curso ${cur.activo ? 'activo' : ''}" data-id="${cur.id}">
                <div class="contenedor-img">
                    <img src="${cur.imagen}" alt="${cur.titulo}">
                </div>
                <h3>${cur.titulo}</h3>
            </div>
        `).join('');

        const htmlFinal = html.replace(/{{tarjetas_cursos}}/g, tarjetas);

        res.json({
            cssUrl: '/cssvistas/caps-de-var-complejacss.css',
            html: htmlFinal
        });
    });
});

/*==================================================
TEMAS DE ÁLGEBRA COMPLEJA
==================================================*/
app.get('/api/variable-compleja/algebra', (req, res) => {
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

    const rutaHtml = path.join(__dirname, 'vistas', 'temas-algebra.html');

    fs.readFile(rutaHtml, 'utf8', (err, html) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'No se cargó temas-algebra.html' });
        }

        const tarjetas = temas.map(tema => `
            <div class="tarjeta-tema" style="background: ${tema.color};" onclick="redirigirTema(event, '${tema.id}')">

                <div class="contenido-tema">
                    <h3>${tema.titulo}</h3>
                    <p class="desc">${tema.descripcion}</p>
                </div>
                <div class="acciones-tema">
                    ${tema.urlSimulacion !== '#' ? `<button class="btn-tema btn-sim" onclick="irASimulacion(event, '${tema.urlSimulacion}')">Simulación</button>` : '<span class="no-sim">Sin simulación</span>'}
                    <button class="btn-tema btn-test" onclick="abrirTestProximamente(event)">Test</button>
                </div>
            </div>
        `).join('');

        const htmlFinal = html.replace(/{{tarjetas_temas}}/g, tarjetas);

        res.json({
            cssUrl: '/cssvistas/temas-algebra.css',
            html: htmlFinal
        });
    });
});


/*==================================================
TEMAS DE DERIVACIÓN COMPLEJA
==================================================*/
app.get('/api/variable-compleja/derivacion', (req, res) => {
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

    const rutaHtml = path.join(__dirname, 'vistas', 'temas-derivacion.html');

    fs.readFile(rutaHtml, 'utf8', (err, html) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'No se cargó temas-derivacion.html' });
        }

        const tarjetas = temas.map(tema => `
            <div class="tarjeta-tema" style="background: ${tema.color};" onclick="redirigirTema(event, '${tema.id}')">
                <div class="contenido-tema">
                    <h3>${tema.titulo}</h3>
                    <p class="desc">${tema.descripcion}</p>
                </div>
                <div class="acciones-tema">
                    ${tema.urlSimulacion !== '#' ? `<button class="btn-tema btn-sim" onclick="irASimulacion(event, '${tema.urlSimulacion}')">Simulación</button>` : '<span class="no-sim">Sin simulación</span>'}
                    <button class="btn-tema btn-test" onclick="abrirTestProximamente(event)">Test</button>
                </div>
            </div>
        `).join('');

        const htmlFinal = html.replace(/{{tarjetas_temas}}/g, tarjetas);

        res.json({
            cssUrl: '/cssvistas/temas-algebra.css',
            html: htmlFinal
        });
    });
});

/*==================================================
TEMAS DE INTEGRACIÓN COMPLEJA
==================================================*/
app.get('/api/variable-compleja/integracion', (req, res) => {
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

    const rutaHtml = path.join(__dirname, 'vistas', 'temas-integracion.html');

    fs.readFile(rutaHtml, 'utf8', (err, html) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'No se cargó temas-integracion.html' });
        }

        const tarjetas = temas.map(tema => `
            <div class="tarjeta-tema" style="background: ${tema.color};" onclick="redirigirTema(event, '${tema.id}')">
                <div class="contenido-tema">
                    <h3>${tema.titulo}</h3>
                    <p class="desc">${tema.descripcion}</p>
                </div>
                <div class="acciones-tema">
                    ${tema.urlSimulacion !== '#' ? `<button class="btn-tema btn-sim" onclick="irASimulacion(event, '${tema.urlSimulacion}')">Simulación</button>` : '<span class="no-sim">Sin simulación</span>'}
                    <button class="btn-tema btn-test" onclick="abrirTestProximamente(event)">Test</button>
                </div>
            </div>
        `).join('');

        const htmlFinal = html.replace(/{{tarjetas_temas}}/g, tarjetas);

        res.json({
            cssUrl: '/cssvistas/temas-algebra.css',
            html: htmlFinal
        });
    });
});

/*==================================================
VISTAS DE CONTENIDO ESPECÍFICO POR TEMA (HTML PURO)
==================================================*/
app.get('/api/contenido-tema/:id', (req, res) => {
    const temaId = req.params.id;
    let nombreArchivo = "";

    if (temaId === 'suma-compleja') nombreArchivo = 'tema-suma.html';
    else if (temaId === 'multiplicacion-compleja') nombreArchivo = 'tema-multiplicacion.html';
    else if (temaId === 'teorema-demoivre') nombreArchivo = 'tema-demoivre.html';
    else if (temaId === 'bases-derivacion') nombreArchivo = 'tema-bases-derivacion.html';
    else if (temaId === 'derivacion-nivel-medio') nombreArchivo = 'tema-derivacion-medio.html';
    else if (temaId === 'cauchy-riemann-laplace') nombreArchivo = 'tema-cauchy-riemann.html';
    else if (temaId === 'bases-integracion') nombreArchivo = 'tema-bases-integracion.html';
    else if (temaId === 'integral-cauchy') nombreArchivo = 'tema-integral-cauchy.html';
    else if (temaId === 'teorema-residuo') nombreArchivo = 'tema-teorema-residuo.html';
    else return res.status(404).json({ error: 'Tema no encontrado' });

    const rutaHtml = path.join(__dirname, 'vistas', nombreArchivo);

    fs.readFile(rutaHtml, 'utf8', (err, html) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: `No se pudo leer ${nombreArchivo}` });
        }
        res.json({ html: html });
    });
});

/*==================================================
SOBRE NOSOTROS
==================================================*/
app.get('/api/sobre-nosotros', (req, res) => {
    const datosSobreNosotros = {
        mision: "Proveer a los estudiantes de la Escuela Superior de Cómputo (ESCOM) una herramienta interactiva y visual que facilite la comprensión profunda de la Variable Compleja, conectando la teoría matemática con aplicaciones reales en sistemas computacionales.",
        vision: "Ser la plataforma de simulación matemática referente dentro de la ESCOM, impulsando el rendimiento académico y el desarrollo de software basado en modelos analíticos complejos.",
        objetivos: [
            "Desarrollar módulos interactivos de mapeo conformal aplicados a procesamiento de señales.",
            "Facilitar la visualización de series de Laurent y residuos para el análisis de sistemas estables.",
            "Integrar herramientas de simulación accesibles desde cualquier navegador para la comunidad estudiantil."
        ]
    };

    const rutaHtml = path.join(__dirname, 'vistas', 'sobrenosotros.html');

    fs.readFile(rutaHtml, 'utf8', (err, html) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Error cargando sobrenosotros.html' });
        }

        const objetivos = datosSobreNosotros.objetivos.map(o => `<li>${o}</li>`).join('');
        let htmlFinal = html;
        htmlFinal = htmlFinal.replace(/{{mision}}/g, datosSobreNosotros.mision);
        htmlFinal = htmlFinal.replace(/{{vision}}/g, datosSobreNosotros.vision);
        htmlFinal = htmlFinal.replace(/{{objetivos}}/g, objetivos);

        res.json({
            cssUrl: '/cssvistas/sobrenosotros.css',
            html: htmlFinal
        });
    });
});

/*========================================================
EXAMENES
==========================================================*/
app.get('/api/examen-algebra', async (req, res) => {
  try {
    const rutaHtml = path.join(__dirname, 'vistas', 'examen-algebra.html');
    const html = await fs.promises.readFile(rutaHtml, 'utf8');

    res.json({
      cssUrl: '/cssvistas/examen-algebra.css',
      html: html
    });

  } catch (err) {
    console.error('Error cargando examen-algebra.html:', err);
    res.status(500).json({ error: 'No se pudo cargar examen-algebra.html' });
  }
});

app.get('/api/examen-derivacion', async (req, res) => {
  try {
    const rutaHtml = path.join(__dirname, 'vistas', 'examen-derivacion.html');
    const html = await fs.promises.readFile(rutaHtml, 'utf8');

    res.json({
      cssUrl: '/cssvistas/examen-algebra.css',
      html: html
    });

  } catch (err) {
    console.error('Error cargando examen-derivacion.html:', err);
    res.status(500).json({ error: 'No se pudo cargar examen-derivacion.html' });
  }
});

app.get('/api/examen-integracion', async (req, res) => {
  try {
    const rutaHtml = path.join(__dirname, 'vistas', 'examen-integracion.html');
    const html = await fs.promises.readFile(rutaHtml, 'utf8');

    res.json({
      cssUrl: '/cssvistas/examen-algebra.css',
      html: html
    });

  } catch (err) {
    console.error('Error cargando examen-integracion.html:', err);
    res.status(500).json({ error: 'No se pudo cargar examen-integracion.html' });
  }
});

/* =========================================================
   AUTENTICACIÓN + POSTGRESQL + VERIFICACIÓN DE CORREO
========================================================= */

const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            // Neon (producción en Render)
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 15000
        }
        : {
            // Desarrollo local con PostgreSQL propio
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT || 5432),
            database: process.env.DB_NAME || 'complexlab',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            max: 10
        }
);

pool.on('error', err => {
    console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

const PORT = Number(process.env.PORT || 10000);
const CODIGO_MINUTOS = 2;

function crearHashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.createHash('sha256')
        .update(Buffer.concat([Buffer.from(password, 'utf8'), salt]))
        .digest('hex');

    return {
        salt: salt.toString('hex'),
        hash
    };
}

function verificarPassword(password, hashGuardado, saltGuardado) {
    const salt = Buffer.from(saltGuardado, 'hex');
    const hashCalculado = crypto.createHash('sha256')
        .update(Buffer.concat([Buffer.from(password, 'utf8'), salt]))
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(hashCalculado, 'hex'),
        Buffer.from(hashGuardado, 'hex')
    );
}

/*
 * DES en modo CBC.
 * La clave debe ser de 8 bytes. Se almacena en .env.
 * Nota: DES es un requisito del proyecto, pero es un algoritmo antiguo;
 * para un sistema real se recomienda AES-256-GCM.
 */
function getDesKey() {
    const key = String(process.env.EMAIL_DES_KEY || '');
    if (Buffer.byteLength(key, 'utf8') !== 8) {
        throw new Error('EMAIL_DES_KEY debe tener exactamente 8 bytes/caracteres.');
    }
    return key;
}

function cifrarCorreo(correo) {
    const key = CryptoJS.enc.Utf8.parse(getDesKey());
    const iv = CryptoJS.enc.Hex.parse('0000000000000000');

    const encrypted = CryptoJS.DES.encrypt(
        correo,
        key,
        { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );

    return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
}

function descifrarCorreo(cifrado) {
    const key = CryptoJS.enc.Utf8.parse(getDesKey());
    const iv = CryptoJS.enc.Hex.parse('0000000000000000');

    const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Base64.parse(cifrado)
    });

    return CryptoJS.DES.decrypt(
        cipherParams,
        key,
        { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    ).toString(CryptoJS.enc.Utf8);
}

/*
 * Sesión: token firmado con HMAC-SHA256 (sin dependencias extra).
 * Se guarda en sessionStorage del navegador y se envía en
 * Authorization: Bearer <token>.
 */
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
    console.warn('AVISO: define SESSION_SECRET; sin él las sesiones se pierden al reiniciar.');
}
const SESION_HORAS = 12;

function crearToken(cuenta) {
    const payload = Buffer.from(JSON.stringify({
        id: String(cuenta.id_usuario),
        u: cuenta.nombre_usuario,
        exp: Date.now() + SESION_HORAS * 3600 * 1000
    })).toString('base64url');

    const firma = crypto.createHmac('sha256', SESSION_SECRET)
        .update(payload).digest('base64url');

    return `${payload}.${firma}`;
}

function leerToken(token) {
    if (typeof token !== 'string' || !token.includes('.')) return null;

    const [payload, firma] = token.split('.');
    const esperada = crypto.createHmac('sha256', SESSION_SECRET)
        .update(payload).digest('base64url');

    const a = Buffer.from(firma);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    try {
        const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!datos.exp || datos.exp < Date.now()) return null;
        return { id_usuario: datos.id, nombre_usuario: datos.u };
    } catch {
        return null;
    }
}

function requiereSesion(req, res, next) {
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
    const cuenta = leerToken(token);

    if (!cuenta) {
        return res.status(401).json({ error: 'Tu sesión no es válida o expiró. Inicia sesión de nuevo.' });
    }

    req.cuenta = cuenta;
    next();
}

const MAX_INTENTOS_CODIGO = 5;
const intentosCodigo = new Map();

function validarUsuario(usuario) {
    return typeof usuario === 'string' &&
        /^[a-zA-Z0-9_.-]{3,30}$/.test(usuario);
}

function validarCorreo(correo) {
    return typeof correo === 'string' &&
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(correo);
}

function validarPassword(password) {
    return typeof password === 'string' &&
        password.length >= 10 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password);
}

function generarCodigo() {
    return String(crypto.randomInt(100000, 1000000));
}

function transporterCorreo() {
    return nodemailer.createTransport({
        service: process.env.MAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_APP_PASSWORD
        }
    });
}

async function enviarCodigoVerificacion(correo, usuario, codigo) {
    const asunto = 'Tu código de verificación de Complexlab:';

    const texto = `Hola, ${usuario}:

Gracias por registrarte en Complexlab. Para completar la verificación de tu correo electrónico y activar tu cuenta, ingresa el siguiente código de 6 dígitos en la plataforma:

${codigo}

Este código es válido por los próximos 2 minutos.

¿No solicitaste este código?

Si no intentaste crear una cuenta ni iniciar sesión en Complexlab, puedes ignorar este mensaje de forma segura. Tu cuenta seguirá protegida y no se realizará ningún cambio. Por tu seguridad, nunca compartas este código con nadie.

Saludos,
El equipo de Complexlab`;

    await enviarCorreo({ to: correo, subject: asunto, text: texto });
}

/*
 * Render (plan gratuito) bloquea los puertos SMTP 25/465/587, por lo que
 * Gmail vía SMTP NO funciona allí. Si existe BREVO_API_KEY se usa la API
 * HTTPS de Brevo (puerto 443). Si no, se usa SMTP (útil en local o en
 * un plan de pago de Render).
 */
async function enviarCorreo({ to, subject, text }) {
    const remitente = process.env.MAIL_FROM || process.env.MAIL_USER;

    if (process.env.BREVO_API_KEY) {
        const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': process.env.BREVO_API_KEY
            },
            body: JSON.stringify({
                sender: { name: 'Complexlab', email: remitente },
                to: [{ email: to }],
                subject,
                textContent: text
            })
        });

        if (!respuesta.ok) {
            const detalle = await respuesta.text();
            throw new Error(`Brevo respondió ${respuesta.status}: ${detalle}`);
        }
        return;
    }

    await transporterCorreo().sendMail({
        from: `"Complexlab" <${remitente}>`,
        to,
        subject,
        text
    });
}

async function buscarUsuarioPorNombre(usuario) {
    const resultado = await pool.query(
        `SELECT id_usuario, nombre_usuario, correo, password_hash, password_salt, correo_verificado
         FROM usuario
         WHERE LOWER(nombre_usuario) = LOWER($1)
         LIMIT 1`,
        [usuario]
    );
    return resultado.rows[0] || null;
}

async function correoYaRegistrado(correo) {
    const resultado = await pool.query(
        `SELECT correo FROM usuario WHERE correo IS NOT NULL`
    );

    for (const fila of resultado.rows) {
        if (descifrarCorreo(fila.correo).toLowerCase() === correo.toLowerCase()) {
            return true;
        }
    }
    return false;
}

app.get('/api/vistas/inicio-sesion', (req, res) => {
    const ruta = path.join(__dirname, 'vistas', 'inicio-sesion.html');
    res.set('Cache-Control', 'no-store');

    fs.readFile(ruta, 'utf8', (err, html) => {
        if (err) {
            console.error('Error cargando inicio-sesion.html:', err);
            return res.status(500).json({ error: 'No se pudo cargar la vista de inicio de sesión.' });
        }

        res.json({
            cssUrl: '/cssvistas/auth.css',
            html
        });
    });
});

app.get('/api/vistas/registro', (req, res) => {
    const ruta = path.join(__dirname, 'vistas', 'registro.html');
    res.set('Cache-Control', 'no-store');

    fs.readFile(ruta, 'utf8', (err, html) => {
        if (err) {
            console.error('Error cargando registro.html:', err);
            return res.status(500).json({ error: 'No se pudo cargar la vista de registro.' });
        }

        res.json({
            cssUrl: '/cssvistas/auth.css',
            html
        });
    });
});

/* 1) Genera y envía el código. Todavía NO crea el usuario definitivo. */
app.post('/api/registro/enviar-codigo', async (req, res) => {
    try {
        const { usuario, correo, password } = req.body || {};

        if (
            typeof usuario !== 'string' ||
            typeof correo !== 'string' ||
            typeof password !== 'string' ||
            !usuario.trim() || !correo.trim() || !password
        ) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }

        const nombreUsuario = usuario.trim();
        const email = correo.trim().toLowerCase();

        if (!validarUsuario(nombreUsuario)) {
            return res.status(400).json({
                error: 'El usuario debe tener entre 3 y 30 caracteres. Solo se permiten letras, números, punto, guion y guion bajo.'
            });
        }

        if (!validarCorreo(email)) {
            return res.status(400).json({
                error: 'Ingresa un correo válido que termine en @gmail.com.'
            });
        }

        if (!validarPassword(password)) {
            return res.status(400).json({
                error: 'La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula, un número y un carácter especial.'
            });
        }

        const usuarioExistente = await buscarUsuarioPorNombre(nombreUsuario);
        if (usuarioExistente) {
            return res.status(409).json({ error: 'Ese nombre de usuario ya está registrado.' });
        }

        if (await correoYaRegistrado(email)) {
            return res.status(409).json({ error: 'Ese correo ya está registrado.' });
        }

        const hash = crearHashPassword(password);
        const codigo = generarCodigo();
        const expiracion = new Date(Date.now() + CODIGO_MINUTOS * 60 * 1000);

        await pool.query('DELETE FROM registro_pendiente WHERE LOWER(nombre_usuario) = LOWER($1) OR LOWER(correo) = LOWER($2)', [nombreUsuario, email]);
        await pool.query(
            `INSERT INTO registro_pendiente
             (nombre_usuario, correo, password_hash, password_salt, fecha_creacion)
             VALUES ($1, $2, $3, $4, NOW())`,
            [nombreUsuario, email, hash.hash, hash.salt]
        );

        const pendiente = await pool.query(
            `SELECT id_pendiente FROM registro_pendiente
             WHERE LOWER(nombre_usuario) = LOWER($1)
             ORDER BY id_pendiente DESC LIMIT 1`,
            [nombreUsuario]
        );

        await pool.query(
            `INSERT INTO codigo_de_verificacion
             (codigo_temporal, fecha_expiracion, usado, id_pendiente)
             VALUES ($1, $2, FALSE, $3)`,
            [codigo, expiracion, pendiente.rows[0].id_pendiente]
        );

        await enviarCodigoVerificacion(email, nombreUsuario, codigo);
        intentosCodigo.delete(nombreUsuario.toLowerCase());

        return res.status(200).json({
            mensaje: 'Código enviado. Revisa tu correo. Es válido durante 2 minutos.',
            expiraEn: expiracion.toISOString()
        });
    } catch (error) {
        console.error('Error enviando código de verificación:', error);
        return res.status(500).json({
            error: 'No se pudo enviar el código de verificación. Verifica la configuración del correo.'
        });
    }
});

/* 2) Comprueba el código y crea definitivamente el usuario. */
app.post('/api/registro/verificar', async (req, res) => {
    const client = await pool.connect();

    try {
        const { usuario, codigo } = req.body || {};

        if (typeof usuario !== 'string' || typeof codigo !== 'string' ||
            !usuario.trim() || !/^\d{6}$/.test(codigo)) {
            return res.status(400).json({ error: 'Ingresa el código de 6 dígitos recibido por correo.' });
        }

        const claveIntentos = usuario.trim().toLowerCase();
        if ((intentosCodigo.get(claveIntentos) || 0) >= MAX_INTENTOS_CODIGO) {
            return res.status(429).json({ error: 'Demasiados intentos fallidos. Solicita un código nuevo.' });
        }

        await client.query('BEGIN');

        const consulta = await client.query(
            `SELECT c.id_codigo, c.codigo_temporal, c.fecha_expiracion, c.usado,
                    p.id_pendiente, p.nombre_usuario, p.correo,
                    p.password_hash, p.password_salt
             FROM codigo_de_verificacion c
             JOIN registro_pendiente p ON p.id_pendiente = c.id_pendiente
             WHERE LOWER(p.nombre_usuario) = LOWER($1)
             ORDER BY c.id_codigo DESC
             LIMIT 1`,
            [usuario.trim()]
        );

        if (consulta.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No existe una verificación pendiente para este usuario.' });
        }

        const registro = consulta.rows[0];

        if (registro.usado) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Ese código ya fue utilizado. Solicita uno nuevo.' });
        }

        if (new Date(registro.fecha_expiracion).getTime() <= Date.now()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El código ha caducado. Solicita un nuevo código.' });
        }

        if (registro.codigo_temporal !== codigo) {
            await client.query('ROLLBACK');
            intentosCodigo.set(claveIntentos, (intentosCodigo.get(claveIntentos) || 0) + 1);
            return res.status(400).json({ error: 'El código de verificación no coincide.' });
        }

        const existente = await client.query(
            `SELECT id_usuario FROM usuario
             WHERE LOWER(nombre_usuario) = LOWER($1)`,
            [registro.nombre_usuario]
        );

        if (existente.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ese nombre de usuario ya está registrado.' });
        }

        const correoCifrado = cifrarCorreo(registro.correo);

        const usuarioNuevo = await client.query(
            `INSERT INTO usuario
             (nombre_usuario, correo, password_hash, password_salt, correo_verificado)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING id_usuario, nombre_usuario`,
            [
                registro.nombre_usuario,
                correoCifrado,
                registro.password_hash,
                registro.password_salt
            ]
        );

        await client.query(
            `UPDATE codigo_de_verificacion
             SET usado = TRUE
             WHERE id_codigo = $1`,
            [registro.id_codigo]
        );

        await client.query(
            `DELETE FROM registro_pendiente WHERE id_pendiente = $1`,
            [registro.id_pendiente]
        );

        await client.query('COMMIT');
        intentosCodigo.delete(claveIntentos);

        return res.status(201).json({
            mensaje: 'Cuenta registrada y correo verificado correctamente.',
            usuario: usuarioNuevo.rows[0].nombre_usuario,
            token: crearToken(usuarioNuevo.rows[0])
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error verificando registro:', error);
        return res.status(500).json({ error: 'No se pudo completar la verificación.' });
    } finally {
        client.release();
    }
});

/* 3) Reenvía un código nuevo y reinicia la caducidad de 2 minutos. */
app.post('/api/registro/reenviar-codigo', async (req, res) => {
    try {
        const { usuario } = req.body || {};

        if (typeof usuario !== 'string' || !usuario.trim()) {
            return res.status(400).json({ error: 'No se indicó el usuario.' });
        }

        const pendiente = await pool.query(
            `SELECT id_pendiente, nombre_usuario, correo
             FROM registro_pendiente
             WHERE LOWER(nombre_usuario) = LOWER($1)
             LIMIT 1`,
            [usuario.trim()]
        );

        if (pendiente.rows.length === 0) {
            return res.status(404).json({ error: 'No existe un registro pendiente para ese usuario.' });
        }

        const ultimo = await pool.query(
            `SELECT fecha_expiracion FROM codigo_de_verificacion
             WHERE id_pendiente = $1 ORDER BY id_codigo DESC LIMIT 1`,
            [pendiente.rows[0].id_pendiente]
        );
        if (ultimo.rows.length > 0) {
            const segundosRestantes = (new Date(ultimo.rows[0].fecha_expiracion).getTime() - Date.now()) / 1000;
            if (segundosRestantes > CODIGO_MINUTOS * 60 - 30) {
                return res.status(429).json({ error: 'Espera unos segundos antes de solicitar otro código.' });
            }
        }

        const nuevoCodigo = generarCodigo();
        const nuevaExpiracion = new Date(Date.now() + CODIGO_MINUTOS * 60 * 1000);

        await pool.query(
            `UPDATE codigo_de_verificacion
             SET usado = TRUE
             WHERE id_pendiente = $1 AND usado = FALSE`,
            [pendiente.rows[0].id_pendiente]
        );

        await pool.query(
            `INSERT INTO codigo_de_verificacion
             (codigo_temporal, fecha_expiracion, usado, id_pendiente)
             VALUES ($1, $2, FALSE, $3)`,
            [nuevoCodigo, nuevaExpiracion, pendiente.rows[0].id_pendiente]
        );

        intentosCodigo.delete(pendiente.rows[0].nombre_usuario.toLowerCase());
        await enviarCodigoVerificacion(
            pendiente.rows[0].correo,
            pendiente.rows[0].nombre_usuario,
            nuevoCodigo
        );

        return res.status(200).json({
            mensaje: 'Se envió un nuevo código a tu correo.',
            expiraEn: nuevaExpiracion.toISOString()
        });
    } catch (error) {
        console.error('Error reenviando código:', error);
        return res.status(500).json({ error: 'No se pudo reenviar el código.' });
    }
});

app.post('/api/registro', async (req, res) => {
    return res.status(400).json({
        error: 'El registro requiere primero la verificación del código enviado al correo.'
    });
});

app.post('/api/iniciar-sesion', async (req, res) => {
    try {
        const { usuario, password } = req.body || {};

        if (
            typeof usuario !== 'string' ||
            typeof password !== 'string' ||
            !usuario.trim() ||
            !password
        ) {
            return res.status(400).json({ error: 'Ingresa el usuario y la contraseña.' });
        }

        const cuenta = await buscarUsuarioPorNombre(usuario.trim());

        if (!cuenta || !cuenta.correo_verificado ||
            !verificarPassword(password, cuenta.password_hash, cuenta.password_salt)) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        }

        return res.status(200).json({
            mensaje: 'Inicio de sesión correcto.',
            usuario: cuenta.nombre_usuario,
            token: crearToken(cuenta)
        });
    } catch (error) {
        console.error('Error iniciando sesión:', error);
        return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
    }
});

/* =========================================================
   PROGRESO ACADÉMICO
========================================================= */

app.post('/api/progreso', requiereSesion, async (req, res) => {
    try {
        const { unidad_tematica, calificacion } = req.body || {};
        const nota = Number(calificacion);

        if (typeof unidad_tematica !== 'string' || !unidad_tematica.trim() ||
            unidad_tematica.length > 150 || !Number.isFinite(nota) || nota < 0 || nota > 10) {
            return res.status(400).json({ error: 'Datos de progreso no válidos.' });
        }

        // El número de intento lo calcula el servidor (siguiente del usuario).
        const resultado = await pool.query(
            `INSERT INTO progreso
             (id_usuario, numero_de_intento, unidad_tematica, calificacion)
             SELECT $1::bigint, COALESCE(MAX(numero_de_intento), 0) + 1, $2, $3
             FROM progreso WHERE id_usuario = $1::bigint
             RETURNING id_progreso, numero_de_intento, fecha_de_guardado,
                       unidad_tematica, calificacion`,
            [req.cuenta.id_usuario, unidad_tematica.trim(), nota]
        );

        return res.status(201).json({ progreso: resultado.rows[0] });
    } catch (error) {
        console.error('Error guardando progreso:', error);
        return res.status(500).json({ error: 'No se pudo guardar el progreso.' });
    }
});

app.get('/api/progreso', requiereSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id_progreso, numero_de_intento, fecha_de_guardado,
                    unidad_tematica, calificacion
             FROM progreso
             WHERE id_usuario = $1
             ORDER BY fecha_de_guardado DESC, id_progreso DESC`,
            [req.cuenta.id_usuario]
        );

        return res.json(resultado.rows.map(f => ({
            ...f,
            calificacion: Number(f.calificacion)
        })));
    } catch (error) {
        console.error('Error consultando progreso:', error);
        return res.status(500).json({ error: 'No se pudo consultar el progreso.' });
    }
});

app.delete('/api/progreso', requiereSesion, async (req, res) => {
    try {
        await pool.query('DELETE FROM progreso WHERE id_usuario = $1', [req.cuenta.id_usuario]);
        return res.json({ mensaje: 'Historial eliminado correctamente.' });
    } catch (error) {
        console.error('Error eliminando progreso:', error);
        return res.status(500).json({ error: 'No se pudo eliminar el historial.' });
    }
});

/* =========================================================
   DESARROLLO DE SIMULACIONES
========================================================= */

app.post('/api/desarrollo-simulacion', requiereSesion, async (req, res) => {
    try {
        const { desarrollo_id, simulacion_id, ruta_pdf } = req.body || {};

        if (typeof desarrollo_id !== 'string' || typeof simulacion_id !== 'string' ||
            !desarrollo_id || !simulacion_id ||
            desarrollo_id.length > 100 || simulacion_id.length > 150) {
            return res.status(400).json({ error: 'Datos del desarrollo no válidos.' });
        }

        const resultado = await pool.query(
            `INSERT INTO desarrollo_simulacion
             (id_usuario, desarrollo_id, simulacion_id, ruta_pdf)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [req.cuenta.id_usuario, desarrollo_id, simulacion_id,
             typeof ruta_pdf === 'string' ? ruta_pdf : null]
        );

        return res.status(201).json({ desarrollo: resultado.rows[0] });
    } catch (error) {
        console.error('Error guardando desarrollo de simulación:', error);
        return res.status(500).json({ error: 'No se pudo guardar el desarrollo.' });
    }
});

app.get('/api/scripts/auth', (req, res) => {
    const rutaScript = path.join(__dirname, 'js', 'auth.js');

    fs.readFile(rutaScript, 'utf8', (err, codigo) => {
        if (err) {
            console.error('Error al cargar js/auth.js:', err);
            return res.status(500).json({ error: 'No se pudo cargar el script de autenticación.' });
        }

        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(codigo);
    });
});

/*==================================================
VISTA: MI PROGRESO
==================================================*/
app.get('/api/mi-progreso', (req, res) => {
    const rutaHtml = path.join(__dirname, 'vistas', 'mi-progreso.html');

    fs.readFile(rutaHtml, 'utf8', (err, html) => {
        if (err) {
            console.error('Error cargando mi-progreso.html:', err);
            return res.status(500).json({ error: 'No se pudo cargar la vista Mi progreso.' });
        }

        res.json({
            cssUrl: '/cssvistas/mi-progreso.css',
            html: html
        });
    });
});

/*==================================================
SALUD + FRONTEND (React build o carpeta public)
==================================================*/
app.get('/health', (req, res) => res.json({ ok: true }));

const rutaBuild = path.join(__dirname, 'build');
const rutaPublic = path.join(__dirname, 'public');
const rutaFront = fs.existsSync(path.join(rutaBuild, 'index.html')) ? rutaBuild : rutaPublic;

app.use(express.static(rutaFront));

app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();

    const indice = path.join(rutaFront, 'index.html');
    if (fs.existsSync(indice)) return res.sendFile(indice);
    next();
});

/*==================================================
ARRANQUE DEL SERVIDOR
==================================================*/
async function iniciarBaseDeDatos() {
    const sql = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('Base de datos lista (tablas verificadas).');
}

async function limpiarRegistrosPendientes() {
    try {
        await pool.query(
            `DELETE FROM registro_pendiente
             WHERE fecha_creacion < NOW() - INTERVAL '1 hour'`
        );
    } catch (error) {
        console.error('Error limpiando registros pendientes:', error.message);
    }
}

iniciarBaseDeDatos()
    .catch(error => console.error('No se pudo preparar la base de datos:', error.message))
    .finally(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Servidor COMPLEXLAB activo en el puerto ${PORT}`);
        });
        limpiarRegistrosPendientes();
        setInterval(limpiarRegistrosPendientes, 15 * 60 * 1000).unref();
    });
