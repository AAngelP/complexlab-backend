const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

/* ==================================================
   CONFIGURACIÓN GENERAL
================================================== */

app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

// Si FRONTEND_ORIGIN está definido, solo se permite ese origen.
// Si frontend y backend están en el mismo dominio, CORS no es necesario,
// pero mantenerlo habilitado no perjudica las peticiones del mismo origen.
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

const DIR = {
    imagenes: path.join(ROOT, 'imagenes'),
    fondos: path.join(ROOT, 'fondos'),
    css: path.join(ROOT, 'CSSvistas'),
    vistas: path.join(ROOT, 'vistas'),
    js: path.join(ROOT, 'js'),
    simulaciones: path.join(ROOT, 'simulaciones')
};

/* ==================================================
   DIAGNÓSTICO DE ESTRUCTURA
================================================== */

function comprobarDirectorio(nombre, ruta) {
    if (!fs.existsSync(ruta)) {
        console.warn(`[ADVERTENCIA] No existe el directorio "${nombre}": ${ruta}`);
    }
}

Object.entries(DIR).forEach(([nombre, ruta]) => {
    comprobarDirectorio(nombre, ruta);
});

comprobarDirectorio('build', BUILD_DIR);

/* ==================================================
   ARCHIVOS ESTÁTICOS
   Las rutas distinguen mayúsculas y minúsculas en Render.
================================================== */

app.use('/imagenes', express.static(DIR.imagenes, {
    fallthrough: false,
    maxAge: '1d'
}));

app.use('/fondos', express.static(DIR.fondos, {
    fallthrough: false,
    maxAge: '1d'
}));

app.use('/cssvistas', express.static(DIR.css, {
    fallthrough: false,
    maxAge: '1d'
}));

app.use('/vistas', express.static(DIR.vistas, {
    fallthrough: false,
    maxAge: '1d'
}));

app.use('/js', express.static(DIR.js, {
    fallthrough: false,
    maxAge: '1d'
}));

// Archivos de las seis simulaciones.
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

    app.use(`/juegos/${url}`, express.static(ruta, {
        fallthrough: false,
        maxAge: '1h'
    }));
});

// Build de React, si existe.
if (fs.existsSync(BUILD_DIR)) {
    app.use(express.static(BUILD_DIR, {
        index: false,
        fallthrough: true,
        maxAge: '1h'
    }));
}

/* ==================================================
   FUNCIONES AUXILIARES
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
                detalle: process.env.NODE_ENV === 'production'
                    ? undefined
                    : error.message
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
   SALUD DEL SERVIDOR
================================================== */

app.get('/api/health', (req, res) => {
    res.status(200).json({
        estado: 'activo',
        servidor: 'COMPLEXLAB',
        fecha: new Date().toISOString()
    });
});

/* ==================================================
   CONFIGURACIÓN
================================================== */

app.get('/api/configuracion', (req, res) => {
    res.json({
        fondoAnimado: '/fondos/complejo.html'
    });
});

/* ==================================================
   CATÁLOGO DE SIMULACIONES
================================================== */

app.get('/api/simulaciones', async (req, res) => {
    const simulaciones = [
        {
            titulo: 'Suma, resta y multiplicación',
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
            titulo: 'Restaurador armónico',
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

    try {
        const html = await leerHtml('simulaciones.html');

        const tarjetas = simulaciones.map(sim => `
            <div class="tarjeta-simulacion"
                 onclick="irASimulacion(event, '${sim.url}')">
                <img src="${sim.imagen}" alt="${sim.titulo}" loading="lazy">
                <h3>${sim.titulo}</h3>
            </div>
        `).join('');

        const htmlFinal = html.replace(/{{tarjetas}}/g, tarjetas);

        res.json({
            cssUrl: '/cssvistas/simulaciones.css',
            html: htmlFinal
        });
    } catch (error) {
        console.error('Error cargando simulaciones:', error.message);
        enviarError(res, 500, 'No se pudo cargar simulaciones.html.');
    }
});

/* ==================================================
   CARGA DE SIMULACIONES
================================================== */

app.get('/api/cargar-juego/cazador', (req, res) => {
    responderJuego(res, 'cazador-complejo');
});

app.get('/api/cargar-juego/residuo', (req, res) => {
    responderJuego(res, 'residuo');
});

app.get('/api/cargar-juego/raicesypotencias', (req, res) => {
    responderJuego(res, 'raicesypotencias');
});

app.get('/api/cargar-juego/armonicos', (req, res) => {
    responderJuego(res, 'armonicos');
});

app.get('/api/cargar-juego/mapeos', (req, res) => {
    responderJuego(res, 'mapeos');
});

app.get('/api/cargar-juego/cauchy', (req, res) => {
    responderJuego(res, 'cauchy');
});

/* ==================================================
   VARIABLE COMPLEJA
================================================== */

app.get('/api/variable-compleja', async (req, res) => {
    const cursos = [
        {
            id: 'algebra',
            titulo: 'Álgebra Compleja',
            imagen: '/imagenes/algebra.png',
            activo: true
        },
        {
            id: 'derivacion',
            titulo: 'Derivación Compleja',
            imagen: '/imagenes/derivacion.png',
            activo: false
        },
        {
            id: 'integracion',
            titulo: 'Integración Compleja',
            imagen: '/imagenes/integracion.png',
            activo: false
        }
    ];

    try {
        const html = await leerHtml('caps-de-var-compleja.html');

        const tarjetas = cursos.map(cur => `
            <div class="tarjeta-curso ${cur.activo ? 'activo' : ''}"
                 data-id="${cur.id}">
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

/* ==================================================
   TEMAS DE ÁLGEBRA COMPLEJA
================================================== */

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
            <div class="tarjeta-tema"
                 style="background:${tema.color};"
                 onclick="redirigirTema(event, '${tema.id}')">
                <div class="contenido-tema">
                    <h3>${tema.titulo}</h3>
                    <p class="desc">${tema.descripcion}</p>
                </div>
                <div class="acciones-tema">
                    <button class="btn-tema btn-sim"
                            onclick="irASimulacion(event, '${tema.urlSimulacion}')">
                        Simulación
                    </button>
                    <button class="btn-tema btn-test"
                            onclick="abrirTestProximamente(event)">
                        Test
                    </button>
                </div>
            </div>
        `).join('');

        res.json({
            cssUrl: '/cssvistas/temas-algebra.css',
            html: html.replace(/{{tarjetas_temas}}/g, tarjetas)
        });
    } catch (error) {
        console.error('Error cargando temas de álgebra:', error.message);
        enviarError(res, 500, 'No se pudo cargar temas-algebra.html.');
    }
});

/* ==================================================
   TEMAS DE DERIVACIÓN COMPLEJA
================================================== */

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
            <div class="tarjeta-tema"
                 style="background:${tema.color};"
                 onclick="redirigirTema(event, '${tema.id}')">
                <div class="contenido-tema">
                    <h3>${tema.titulo}</h3>
                    <p class="desc">${tema.descripcion}</p>
                </div>
                <div class="acciones-tema">
                    ${tema.urlSimulacion !== '#'
                        ? `<button class="btn-tema btn-sim" onclick="irASimulacion(event, '${tema.urlSimulacion}')">Simulación</button>`
                        : '<span class="no-sim">Sin simulación</span>'}
                    <button class="btn-tema btn-test"
                            onclick="abrirTestProximamente(event)">Test</button>
                </div>
            </div>
        `).join('');

        res.json({
            cssUrl: '/cssvistas/temas-algebra.css',
            html: html.replace(/{{tarjetas_temas}}/g, tarjetas)
        });
    } catch (error) {
        console.error('Error cargando temas de derivación:', error.message);
        enviarError(res, 500, 'No se pudo cargar temas-derivacion.html.');
    }
});

/* ==================================================
   TEMAS DE INTEGRACIÓN COMPLEJA
================================================== */

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
            <div class="tarjeta-tema"
                 style="background:${tema.color};"
                 onclick="redirigirTema(event, '${tema.id}')">
                <div class="contenido-tema">
                    <h3>${tema.titulo}</h3>
                    <p class="desc">${tema.descripcion}</p>
                </div>
                <div class="acciones-tema">
                    ${tema.urlSimulacion !== '#'
                        ? `<button class="btn-tema btn-sim" onclick="irASimulacion(event, '${tema.urlSimulacion}')">Simulación</button>`
                        : '<span class="no-sim">Sin simulación</span>'}
                    <button class="btn-tema btn-test"
                            onclick="abrirTestProximamente(event)">Test</button>
                </div>
            </div>
        `).join('');

        res.json({
            cssUrl: '/cssvistas/temas-algebra.css',
            html: html.replace(/{{tarjetas_temas}}/g, tarjetas)
        });
    } catch (error) {
        console.error('Error cargando temas de integración:', error.message);
        enviarError(res, 500, 'No se pudo cargar temas-integracion.html.');
    }
});

/* ==================================================
   CONTENIDO ESPECÍFICO POR TEMA
================================================== */

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

    if (!nombreArchivo) {
        return enviarError(res, 404, 'Tema no encontrado.');
    }

    try {
        const html = await leerHtml(nombreArchivo);
        res.json({ html });
    } catch (error) {
        console.error(`Error cargando ${nombreArchivo}:`, error.message);
        enviarError(res, 500, `No se pudo leer ${nombreArchivo}.`);
    }
});

/* ==================================================
   SOBRE NOSOTROS
================================================== */

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

        const objetivos = datosSobreNosotros.objetivos
            .map(objetivo => `<li>${objetivo}</li>`)
            .join('');

        html = html.replace(/{{mision}}/g, datosSobreNosotros.mision);
        html = html.replace(/{{vision}}/g, datosSobreNosotros.vision);
        html = html.replace(/{{objetivos}}/g, objetivos);

        res.json({
            cssUrl: '/cssvistas/sobrenosotros.css',
            html
        });
    } catch (error) {
        console.error('Error cargando sobre nosotros:', error.message);
        enviarError(res, 500, 'No se pudo cargar sobrenosotros.html.');
    }
});

/* ==================================================
   EXÁMENES
================================================== */

app.get('/api/examen-algebra', (req, res) => {
    responderVista(res, 'examen-algebra.html', '/cssvistas/examen-algebra.css');
});

app.get('/api/examen-derivacion', (req, res) => {
    responderVista(res, 'examen-derivacion.html', '/cssvistas/examen-algebra.css');
});

app.get('/api/examen-integracion', (req, res) => {
    responderVista(res, 'examen-integracion.html', '/cssvistas/examen-algebra.css');
});

/* ==================================================
   AUTENTICACIÓN PROVISIONAL
   IMPORTANTE: los usuarios se guardan en memoria.
   Se perderán al reiniciar el servidor.
================================================== */

const usuariosDemo = new Map();

function crearHashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64);

    return {
        salt: salt.toString('hex'),
        hash: hash.toString('hex')
    };
}

function verificarPassword(password, registro) {
    try {
        const salt = Buffer.from(registro.salt, 'hex');
        const hashCalculado = crypto.scryptSync(password, salt, 64);
        const hashGuardado = Buffer.from(registro.hash, 'hex');

        return hashCalculado.length === hashGuardado.length &&
            crypto.timingSafeEqual(hashCalculado, hashGuardado);
    } catch (error) {
        return false;
    }
}

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

// Cuenta de demostración original.
usuariosDemo.set('usuario_p1', {
    correo: null,
    ...crearHashPassword('Qw1234567$')
});

app.get('/api/vistas/inicio-sesion', (req, res) => {
    res.set('Cache-Control', 'no-store');
    responderVista(res, 'inicio-sesion.html', '/cssvistas/auth.css');
});

app.get('/api/vistas/registro', (req, res) => {
    res.set('Cache-Control', 'no-store');
    responderVista(res, 'registro.html', '/cssvistas/auth.css');
});

app.post('/api/registro', (req, res) => {
    const { usuario, correo, password } = req.body || {};

    if (
        typeof usuario !== 'string' ||
        typeof correo !== 'string' ||
        typeof password !== 'string' ||
        !usuario.trim() ||
        !correo.trim() ||
        !password
    ) {
        return enviarError(res, 400, 'Todos los campos son obligatorios.');
    }

    const nombreUsuario = usuario.trim();
    const email = correo.trim();

    if (!validarUsuario(nombreUsuario)) {
        return enviarError(
            res,
            400,
            'El usuario debe tener entre 3 y 30 caracteres. Solo se permiten letras, números, punto, guion y guion bajo.'
        );
    }

    if (!validarCorreo(email)) {
        return enviarError(
            res,
            400,
            'Ingresa un correo válido que termine en @gmail.com.'
        );
    }

    if (!validarPassword(password)) {
        return enviarError(
            res,
            400,
            'La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula, un número y un carácter especial.'
        );
    }

    const usuarioNormalizado = nombreUsuario.toLowerCase();
    const correoNormalizado = email.toLowerCase();

    for (const [nombre, cuenta] of usuariosDemo.entries()) {
        if (nombre.toLowerCase() === usuarioNormalizado) {
            return enviarError(res, 409, 'Ese nombre de usuario ya está registrado.');
        }

        if (
            cuenta.correo &&
            cuenta.correo.toLowerCase() === correoNormalizado
        ) {
            return enviarError(res, 409, 'Ese correo ya está registrado.');
        }
    }

    usuariosDemo.set(nombreUsuario, {
        correo: email,
        ...crearHashPassword(password)
    });

    return res.status(201).json({
        mensaje: 'Cuenta registrada correctamente.',
        usuario: nombreUsuario
    });
});

app.post('/api/iniciar-sesion', (req, res) => {
    const { usuario, password } = req.body || {};

    if (
        typeof usuario !== 'string' ||
        typeof password !== 'string' ||
        !usuario.trim() ||
        !password
    ) {
        return enviarError(res, 400, 'Ingresa el usuario y la contraseña.');
    }

    const nombreUsuario = usuario.trim();

    const entrada = [...usuariosDemo.entries()].find(
        ([nombre]) => nombre.toLowerCase() === nombreUsuario.toLowerCase()
    );

    if (!entrada || !verificarPassword(password, entrada[1])) {
        return enviarError(res, 401, 'Usuario o contraseña incorrectos.');
    }

    return res.status(200).json({
        mensaje: 'Inicio de sesión correcto.',
        usuario: entrada[0]
    });
});

app.get('/api/scripts/auth', async (req, res) => {
    try {
        const rutaScript = path.join(DIR.js, 'auth.js');
        const codigo = await fs.promises.readFile(rutaScript, 'utf8');

        res.type('application/javascript');
        res.set('Cache-Control', 'no-store');
        res.status(200).send(codigo);
    } catch (error) {
        console.error('Error al cargar js/auth.js:', error.message);
        enviarError(res, 500, 'No se pudo cargar el script de autenticación.');
    }
});

/* ==================================================
   MI PROGRESO
================================================== */

app.get('/api/mi-progreso', (req, res) => {
    responderVista(res, 'mi-progreso.html', '/cssvistas/mi-progreso.css');
});

/* ==================================================
   MANEJO DE ARCHIVOS ESTÁTICOS NO ENCONTRADOS
================================================== */

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err.status === 404 || err.statusCode === 404) {
        return res.status(404).json({
            error: 'No se encontró el archivo solicitado.',
            ruta: req.originalUrl
        });
    }

    console.error('Error de Express:', err);
    return res.status(500).json({
        error: 'Ocurrió un error interno al procesar la solicitud.'
    });
});

/* ==================================================
   RUTAS NO ENCONTRADAS DE API
================================================== */

app.use('/api', (req, res) => {
    res.status(404).json({
        error: 'Ruta API no encontrada.',
        ruta: req.originalUrl
    });
});

/* ==================================================
   RUTA PRINCIPAL Y FRONTEND REACT
================================================== */

app.get('/{*splat}', (req, res, next) => {
    const indexPath = path.join(BUILD_DIR, 'index.html');

    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath, error => {
            if (error) next(error);
        });
    }

    return res.status(200).send(
        'Servidor API REST de COMPLEXLAB activo en Render.'
    );
});

/* ==================================================
   ARRANQUE DEL SERVIDOR
================================================== */

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor COMPLEXLAB activo en el puerto ${PORT}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});

