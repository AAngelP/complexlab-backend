const AUTH_API = '/api'; // Mismo dominio (Render)

let vistaAuthActual = null;
let navegacionAuthConfigurada = false;

/* =========================================
   UTILIDADES
========================================= */

function obtenerUsuarioActual() {
    try {
        return sessionStorage.getItem('complexlab_usuario');
    } catch {
        return null;
    }
}

function obtenerTokenActual() {
    try {
        return sessionStorage.getItem('complexlab_token');
    } catch {
        return null;
    }
}

function establecerUsuarioActual(usuario, token) {
    sessionStorage.setItem('complexlab_usuario', usuario);
    if (token) sessionStorage.setItem('complexlab_token', token);
}

function limpiarUsuarioActual() {
    sessionStorage.removeItem('complexlab_usuario');
    sessionStorage.removeItem('complexlab_token');
}

async function obtenerRespuesta(ruta, opciones = {}) {
    const token = obtenerTokenActual();

    const respuesta = await fetch(`${AUTH_API}${ruta}`, {
        ...opciones,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(opciones.headers || {})
        },
        cache: 'no-store'
    });

    let datos = {};
    try {
        datos = await respuesta.json();
    } catch {
        datos = {};
    }

    if (respuesta.status === 401 && token) {
        // Sesión expirada: se limpia para pedir inicio de sesión de nuevo.
        limpiarUsuarioActual();
    }

    if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo completar la solicitud.');
    }

    return datos;
}

function mostrarMensaje(id, mensaje, correcto = false) {
    const elemento = document.getElementById(id);
    if (!elemento) return;

    elemento.textContent = mensaje;
    elemento.classList.toggle('success', correcto);
}

/* =========================================
   CARGA DE VISTAS DESDE LA API REST
========================================= */

async function cargarVistaAutenticacion(vista, agregarHistorial = true) {
    if (obtenerUsuarioActual()) {
        mostrarInicioPrincipal(false);
        return;
    }

    const main = document.getElementById('main-content');
    if (!main) return;

    try {
        const datos = await obtenerRespuesta(`/vistas/${vista}`);

        if (datos.cssUrl) {
            const idCss = 'css-autenticacion';
            let enlace = document.getElementById(idCss);

            if (!enlace) {
                enlace = document.createElement('link');
                enlace.id = idCss;
                enlace.rel = 'stylesheet';
                document.head.appendChild(enlace);
            }

            enlace.href = datos.cssUrl;
        }

        main.innerHTML = datos.html;
        vistaAuthActual = vista;

        if (agregarHistorial) {
            history.pushState(
                { pagina: vista },
                '',
                `#${vista}`
            );
        }

        if (vista === 'inicio-sesion') {
            configurarFormularioLogin();
        } else if (vista === 'registro') {
            configurarFormularioRegistro();
        }

        configurarNavegacionAutenticacion();
        actualizarNavegacionUsuario();
        window.scrollTo(0, 0);
    } catch (error) {
        main.innerHTML = `
            <section class="auth-page">
                <div class="auth-card">
                    <h1>No se pudo cargar la vista</h1>
                    <p class="auth-subtitle">
                        ${escaparHTML(error.message)}
                    </p>
                    <button class="auth-button"
                        onclick="mostrarInicioPrincipal()">
                        Volver al inicio
                    </button>
                </div>
            </section>
        `;
    }
}

function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

function abrirInicioSesion() {
    cargarVistaAutenticacion('inicio-sesion');
}

function abrirRegistro() {
    cargarVistaAutenticacion('registro');
}

function volverAlInicio(event) {
    if (event) event.preventDefault();
    mostrarInicioPrincipal(true);
}

/* =========================================
   INICIO DE SESIÓN
========================================= */

function configurarFormularioLogin() {
    const formulario = document.getElementById('form-login');
    const botonRegistro = document.getElementById('ir-registro');

    if (botonRegistro) {
        botonRegistro.addEventListener('click', abrirRegistro);
    }

    if (!formulario) return;

    formulario.addEventListener('submit', async event => {
        event.preventDefault();

        const usuario = document.getElementById('login-usuario')
            .value.trim();

        const password = document.getElementById('login-password')
            .value;

        if (!usuario || !password) {
            mostrarMensaje(
                'login-mensaje',
                'Completa el usuario y la contraseña.'
            );
            return;
        }

        const boton = formulario.querySelector('[type="submit"]');
        boton.disabled = true;
        boton.textContent = 'Verificando...';

        try {
            const resultado = await obtenerRespuesta('/iniciar-sesion', {
                method: 'POST',
                body: JSON.stringify({ usuario, password })
            });

            establecerUsuarioActual(resultado.usuario, resultado.token);

            // Evita regresar a una vista de autenticación anterior.
            history.replaceState(
                { pagina: 'principal', autenticado: true },
                '',
                location.pathname + location.search
            );

            mostrarInicioPrincipal(false);
        } catch (error) {
            mostrarMensaje('login-mensaje', error.message);
        } finally {
            boton.disabled = false;
            boton.textContent = 'Iniciar sesión';
        }
    });
}

/* =========================================
   VALIDACIONES DEL REGISTRO
========================================= */

function validarCorreoGmail(correo) {
    // Acepta direcciones como nombre.apellido@gmail.com.
    // No acepta espacios ni dominios diferentes de gmail.com.
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i
        .test(correo);
}

function validarPassword(password) {
    const errores = [];

    if (password.length < 10) {
        errores.push('Debe tener al menos 10 caracteres.');
    }

    if (!/[A-Z]/.test(password)) {
        errores.push('Debe incluir una letra mayúscula.');
    }

    if (!/[a-z]/.test(password)) {
        errores.push('Debe incluir una letra minúscula.');
    }

    if (!/[0-9]/.test(password)) {
        errores.push('Debe incluir un número.');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        errores.push('Debe incluir un carácter especial.');
    }

    return errores;
}

function configurarFormularioRegistro() {
    const formulario = document.getElementById('form-registro');
    const botonLogin = document.getElementById('ir-login');

    if (botonLogin) {
        botonLogin.addEventListener('click', abrirInicioSesion);
    }

    if (!formulario) return;

    formulario.addEventListener('submit', async event => {
        event.preventDefault();

        const usuario = document.getElementById('registro-usuario')
            .value.trim();

        const correo = document.getElementById('registro-correo')
            .value.trim();

        const password = document.getElementById('registro-password')
            .value;

        const confirmar = document.getElementById('registro-confirmar')
            .value;

        if (!usuario || !correo || !password || !confirmar) {
            mostrarMensaje(
                'registro-mensaje',
                'Todos los campos son obligatorios.'
            );
            return;
        }

        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(usuario)) {
            mostrarMensaje(
                'registro-mensaje',
                'El usuario debe tener entre 3 y 30 caracteres y solo puede contener letras, números, punto, guion o guion bajo.'
            );
            return;
        }

        if (!validarCorreoGmail(correo)) {
            mostrarMensaje(
                'registro-mensaje',
                'Ingresa un correo válido con el dominio @gmail.com.'
            );
            return;
        }

        const erroresPassword = validarPassword(password);

        if (erroresPassword.length > 0) {
            mostrarMensaje(
                'registro-mensaje',
                erroresPassword.join(' ')
            );
            return;
        }

        if (password !== confirmar) {
            mostrarMensaje(
                'registro-mensaje',
                'Las contraseñas no coinciden.'
            );
            return;
        }

        const boton = formulario.querySelector('[type="submit"]');
        boton.disabled = true;
        boton.textContent = 'Enviando código...';

        try {
            const resultado = await obtenerRespuesta('/registro/enviar-codigo', {
                method: 'POST',
                body: JSON.stringify({ usuario, correo, password })
            });

            mostrarPasoCodigo(usuario, correo, resultado.expiraEn);
        } catch (error) {
            mostrarMensaje('registro-mensaje', error.message);
        } finally {
            boton.disabled = false;
            boton.textContent = 'Registrar cuenta';
        }
    });

    configurarPasoCodigo();
}

/* =========================================
   VERIFICACIÓN DE CORREO (CÓDIGO DE 6 DÍGITOS)
========================================= */

let temporizadorCodigo = null;
let usuarioPendiente = null;

function mostrarPasoCodigo(usuario, correo, expiraEn) {
    usuarioPendiente = usuario;

    document.getElementById('form-registro').style.display = 'none';
    const paso = document.getElementById('paso-codigo');
    paso.style.display = 'block';

    document.getElementById('codigo-destino').textContent = correo;
    document.getElementById('codigo-input').value = '';
    mostrarMensaje('codigo-mensaje', '');

    iniciarTemporizador(expiraEn);
    document.getElementById('codigo-input').focus();
}

function iniciarTemporizador(expiraEn) {
    clearInterval(temporizadorCodigo);

    const etiqueta = document.getElementById('codigo-tiempo');
    const botonReenviar = document.getElementById('codigo-reenviar');
    const expira = new Date(expiraEn).getTime();
    const habilitaReenvio = expira - 90 * 1000; // pasados 30 s del envío

    function tic() {
        const restante = Math.max(0, Math.round((expira - Date.now()) / 1000));
        const min = String(Math.floor(restante / 60)).padStart(2, '0');
        const seg = String(restante % 60).padStart(2, '0');

        etiqueta.textContent = restante > 0
            ? `El código caduca en ${min}:${seg}`
            : 'El código ha caducado. Solicita uno nuevo.';

        botonReenviar.disabled = Date.now() < habilitaReenvio;

        if (restante === 0) clearInterval(temporizadorCodigo);
    }

    tic();
    temporizadorCodigo = setInterval(tic, 1000);
}

function configurarPasoCodigo() {
    const formCodigo = document.getElementById('form-codigo');
    const botonReenviar = document.getElementById('codigo-reenviar');
    const botonCambiar = document.getElementById('codigo-cambiar');
    const input = document.getElementById('codigo-input');

    if (!formCodigo) return;

    input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 6);
    });

    formCodigo.addEventListener('submit', async event => {
        event.preventDefault();

        const codigo = input.value.trim();

        if (!/^\d{6}$/.test(codigo)) {
            mostrarMensaje('codigo-mensaje', 'Ingresa el código de 6 dígitos.');
            return;
        }

        const boton = formCodigo.querySelector('[type="submit"]');
        boton.disabled = true;
        boton.textContent = 'Verificando...';

        try {
            const resultado = await obtenerRespuesta('/registro/verificar', {
                method: 'POST',
                body: JSON.stringify({ usuario: usuarioPendiente, codigo })
            });

            clearInterval(temporizadorCodigo);
            establecerUsuarioActual(resultado.usuario, resultado.token);

            history.replaceState(
                { pagina: 'principal', autenticado: true },
                '',
                location.pathname + location.search
            );

            mostrarInicioPrincipal(false);
        } catch (error) {
            mostrarMensaje('codigo-mensaje', error.message);
        } finally {
            boton.disabled = false;
            boton.textContent = 'Verificar y crear cuenta';
        }
    });

    botonReenviar.addEventListener('click', async () => {
        botonReenviar.disabled = true;

        try {
            const resultado = await obtenerRespuesta('/registro/reenviar-codigo', {
                method: 'POST',
                body: JSON.stringify({ usuario: usuarioPendiente })
            });

            input.value = '';
            iniciarTemporizador(resultado.expiraEn);
            mostrarMensaje('codigo-mensaje', resultado.mensaje, true);
        } catch (error) {
            mostrarMensaje('codigo-mensaje', error.message);
        }
    });

    botonCambiar.addEventListener('click', () => {
        clearInterval(temporizadorCodigo);
        usuarioPendiente = null;
        document.getElementById('paso-codigo').style.display = 'none';
        document.getElementById('form-registro').style.display = '';
    });
}

/* =========================================
   BARRA DE NAVEGACIÓN
========================================= */

function configurarNavegacionAutenticacion() {
    if (navegacionAuthConfigurada) return;

    const login = document.querySelector('.login-btn');

    if (login) {
        login.addEventListener('click', event => {
            event.preventDefault();
            abrirInicioSesion();
        });
    }

    navegacionAuthConfigurada = true;
}

function actualizarNavegacionUsuario() {
    const lista = document.querySelector('.nav-links');
    if (!lista) return;

    // Si en tu barra principal existe un enlace llamado "Mis simulaciones", lo renombramos a "Mi progreso"
    lista.querySelectorAll('a').forEach(enlace => {
        if (enlace.textContent.trim().toLowerCase() === 'mis simulaciones') {
            enlace.textContent = 'Mi progreso';
            enlace.onclick = (e) => {
                e.preventDefault();
                abrirMiProgreso();
            };
        }
    });

    let elementoUsuario = document.getElementById('nav-usuario');
    const login = lista.querySelector('.login-btn');
    const usuario = obtenerUsuarioActual();

    if (!usuario) {
        if (elementoUsuario) elementoUsuario.remove();
        if (login) login.closest('li').style.display = '';
        return;
    }

    if (login) login.closest('li').style.display = 'none';

    if (!elementoUsuario) {
        elementoUsuario = document.createElement('li');
        elementoUsuario.id = 'nav-usuario';
        elementoUsuario.className = 'dropdown';

        elementoUsuario.innerHTML = `
            <a href="#" id="nav-usuario-btn" aria-expanded="false"></a>
            <ul class="dropdown-menu" id="menu-usuario" style="display:none">
                <li>
                    <a href="#" id="btn-mi-progreso">Mi progreso</a>
                </li>
                <li>
                    <a href="#" id="btn-cerrar-sesion">Cerrar sesión</a>
                </li>
            </ul>
        `;

        lista.appendChild(elementoUsuario);

        const botonUsuario = elementoUsuario.querySelector('#nav-usuario-btn');
        const menuUsuario = elementoUsuario.querySelector('#menu-usuario');

        botonUsuario.addEventListener('click', event => {
            event.preventDefault();
            const abierto = menuUsuario.style.display !== 'none';
            menuUsuario.style.display = abierto ? 'none' : 'block';
            botonUsuario.setAttribute('aria-expanded', String(!abierto));
        });

        elementoUsuario.querySelector('#btn-mi-progreso').addEventListener('click', event => {
            event.preventDefault();
            menuUsuario.style.display = 'none';
            abrirMiProgreso();
        });

        elementoUsuario.querySelector('#btn-cerrar-sesion').addEventListener('click', event => {
            event.preventDefault();
            cerrarSesion();
        });

        document.addEventListener('click', event => {
            if (!elementoUsuario.contains(event.target)) {
                menuUsuario.style.display = 'none';
                botonUsuario.setAttribute('aria-expanded', 'false');
            }
        });
    }

    elementoUsuario.querySelector('#nav-usuario-btn').textContent = usuario + ' ▾';
}

async function abrirMiProgreso() {
    const usuario = obtenerUsuarioActual();
    if (!usuario) {
        abrirInicioSesion();
        return;
    }

    const main = document.getElementById('main-content');
    if (!main) return;

    try {
        const datos = await obtenerRespuesta('/mi-progreso');

        if (datos.cssUrl) {
            let enlace = document.getElementById('css-mi-progreso');
            if (!enlace) {
                enlace = document.createElement('link');
                enlace.id = 'css-mi-progreso';
                enlace.rel = 'stylesheet';
                document.head.appendChild(enlace);
            }
            enlace.href = datos.cssUrl;
        }

        main.innerHTML = datos.html;

        // Ejecutamos los scripts internos de la vista Mi Progreso
        main.querySelectorAll('script').forEach(scriptViejo => {
            const scriptNuevo = document.createElement('script');
            scriptNuevo.text = scriptViejo.text;
            document.body.appendChild(scriptNuevo).remove();
        });

        window.scrollTo(0, 0);
    } catch (error) {
        console.error('Error al abrir Mi Progreso:', error);
        alert('No se pudo cargar la vista de Mi progreso.');
    }
}


/* =========================================
   INICIO PRINCIPAL Y CIERRE DE SESIÓN
========================================= */

function mostrarInicioPrincipal(limpiarHistorial = false) {
    const main = document.getElementById('main-content');

    if (!main) return;

    // Se elimina el contenido de autenticación.
    // Tu script principal podrá reconstruir o cargar la portada.
    main.innerHTML = `
        <section class="hero">
            <iframe id="frame-fondo" class="fondo-animado"></iframe>
            <div class="hero-content">
                <h1>Explora la Variable Compleja</h1>
                <p>
                    Aprende, visualiza y domina los conceptos avanzados
                    de variable compleja mediante simulaciones interactivas.
                </p>
            </div>
        </section>
    `;

    vistaAuthActual = null;

    if (limpiarHistorial) {
        history.replaceState(
            { pagina: 'principal', autenticado: false },
            '',
            location.pathname + location.search
        );
    }

    actualizarNavegacionUsuario();
    configurarNavegacionAutenticacion();

    // Reutiliza el mecanismo que ya carga el fondo desde la API.
    if (typeof cargarConfiguracion === 'function') {
        cargarConfiguracion();
    } else {
        const frame = document.getElementById('frame-fondo');
        if (frame) {
            frame.src = '/fondos/complejo.html';
        }
    }

    window.scrollTo(0, 0);
}

function cerrarSesion() {
    limpiarUsuarioActual();

    // No se conserva una entrada de historial a una vista de login.
    history.replaceState(
        { pagina: 'principal', autenticado: false },
        '',
        location.pathname + location.search
    );

    mostrarInicioPrincipal(false);
}

/* =========================================
   BOTÓN ATRÁS DEL NAVEGADOR
========================================= */

window.addEventListener('popstate', () => {
    if (obtenerUsuarioActual()) {
        mostrarInicioPrincipal(false);
        return;
    }

    // Si se vuelve a una vista privada o de autenticación tras cerrar
    // sesión, se fuerza el regreso a la portada pública.
    if (vistaAuthActual || location.hash === '#inicio-sesion' ||
        location.hash === '#registro') {
        history.replaceState(
            { pagina: 'principal', autenticado: false },
            '',
            location.pathname + location.search
        );

        mostrarInicioPrincipal(false);
    }
});

/* =========================================
   INICIALIZACIÓN
========================================= */

document.addEventListener('DOMContentLoaded', () => {
    configurarNavegacionAutenticacion();
    actualizarNavegacionUsuario();

    // Si el usuario recarga mientras está en una vista de autenticación,
    // no se muestra el formulario cuando ya existe sesión.
    if (obtenerUsuarioActual()) {
        mostrarInicioPrincipal(false);
    }
});
