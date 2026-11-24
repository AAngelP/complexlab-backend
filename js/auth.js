const AUTH_API = '/api'; // Funciona dinámicamente en Render y en local

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

function establecerUsuarioActual(usuario) {
    sessionStorage.setItem('complexlab_usuario', usuario);
}

function limpiarUsuarioActual() {
    sessionStorage.removeItem('complexlab_usuario');
}

async function obtenerRespuesta(ruta, opciones = {}) {
    const respuesta = await fetch(`${AUTH_API}${ruta}`, {
        ...opciones,
        headers: {
            'Content-Type': 'application/json',
            ...(opciones.headers || {})
        },
        cache: 'no-store'
    });

    const datos = await respuesta.json();

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

            establecerUsuarioActual(resultado.usuario);

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
    const botonVerificar = document.getElementById('btn-verificar-codigo');
    const botonReenviar = document.getElementById('btn-reenviar-codigo');

    if (botonLogin) {
        botonLogin.addEventListener('click', abrirInicioSesion);
    }

    if (!formulario) return;

    let codigoEnviado = false;
    let usuarioPendiente = '';
    let tiempoRestante = 0;
    let temporizador = null;

    const campoCodigo = () => document.getElementById('registro-codigo');
    const bloqueCodigo = () => document.getElementById('bloque-verificacion');
    const estadoCodigo = () => document.getElementById('codigo-temporizador');

    function iniciarTemporizador(expiraEn) {
        clearInterval(temporizador);

        const actualizar = () => {
            tiempoRestante = Math.max(0, Math.floor(
                (new Date(expiraEn).getTime() - Date.now()) / 1000
            ));

            const minutos = Math.floor(tiempoRestante / 60);
            const segundos = String(tiempoRestante % 60).padStart(2, '0');

            if (estadoCodigo()) {
                estadoCodigo().textContent =
                    tiempoRestante > 0
                        ? `Código válido por ${minutos}:${segundos}`
                        : 'El código ha caducado.';
            }

            if (tiempoRestante <= 0) {
                clearInterval(temporizador);
                if (botonVerificar) botonVerificar.disabled = true;
                if (botonReenviar) botonReenviar.style.display = 'block';
            }
        };

        actualizar();
        temporizador = setInterval(actualizar, 1000);
    }

    function datosRegistro() {
        return {
            usuario: document.getElementById('registro-usuario')?.value.trim(),
            correo: document.getElementById('registro-correo')?.value.trim(),
            password: document.getElementById('registro-password')?.value,
            confirmar: document.getElementById('registro-confirmar')?.value
        };
    }

    function validarDatosRegistro(datos) {
        if (!datos.usuario || !datos.correo || !datos.password || !datos.confirmar) {
            return 'Todos los campos son obligatorios.';
        }

        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(datos.usuario)) {
            return 'El usuario debe tener entre 3 y 30 caracteres y solo puede contener letras, números, punto, guion o guion bajo.';
        }

        if (!validarCorreoGmail(datos.correo)) {
            return 'Ingresa un correo válido con el dominio @gmail.com.';
        }

        const erroresPassword = validarPassword(datos.password);
        if (erroresPassword.length > 0) {
            return erroresPassword.join(' ');
        }

        if (datos.password !== datos.confirmar) {
            return 'Las contraseñas no coinciden.';
        }

        return null;
    }

    formulario.addEventListener('submit', async event => {
        event.preventDefault();

        if (codigoEnviado) {
            return;
        }

        const datos = datosRegistro();
        const errorValidacion = validarDatosRegistro(datos);

        if (errorValidacion) {
            mostrarMensaje('registro-mensaje', errorValidacion);
            return;
        }

        const boton = formulario.querySelector('[type="submit"]');
        boton.disabled = true;
        boton.textContent = 'Enviando código...';

               try {
            const resultado = await obtenerRespuesta('/registro/enviar-codigo', {
                method: 'POST',
                body: JSON.stringify({
                    usuario: datos.usuario,
                    correo: datos.correo,
                    password: datos.password
                })
            });

            codigoEnviado = true;
            usuarioPendiente = datos.usuario;

            if (bloqueCodigo()) {
                bloqueCodigo().style.display = 'block';
            }

            if (botonVerificar) {
                botonVerificar.disabled = false;
            }

            if (botonReenviar) {
                botonReenviar.style.display = 'none';
            }

            mostrarMensaje(
                'registro-mensaje',
                resultado.mensaje,
                true
            );

            iniciarTemporizador(resultado.expiraEn);
            campoCodigo()?.focus();

            document.getElementById('registro-password').readOnly = true;
            document.getElementById('registro-confirmar').readOnly = true;
            document.getElementById('registro-usuario').readOnly = true;
            document.getElementById('registro-correo').readOnly = true;
        } catch (error) {
            mostrarMensaje('registro-mensaje', error.message);
        } finally {
            boton.disabled = codigoEnviado;
            boton.textContent = codigoEnviado ? 'Código enviado' : 'Enviar código de verificación';
        }
    });

    if (botonVerificar) {
        botonVerificar.addEventListener('click', async () => {
            const codigo = campoCodigo()?.value.trim();

            if (!/^\d{6}$/.test(codigo || '')) {
                mostrarMensaje('registro-mensaje', 'Ingresa un código válido de 6 dígitos.');
                return;
            }

            if (tiempoRestante <= 0) {
                mostrarMensaje('registro-mensaje', 'El código ha caducado. Solicita uno nuevo.');
                botonReenviar.style.display = 'block';
                return;
            }

            botonVerificar.disabled = true;
            botonVerificar.textContent = 'Verificando...';

            try {
                const resultado = await obtenerRespuesta('/registro/verificar', {
                    method: 'POST',
                    body: JSON.stringify({
                        usuario: usuarioPendiente,
                        codigo
                    })
                });

                clearInterval(temporizador);
                establecerUsuarioActual(resultado.usuario);

                mostrarMensaje(
                    'registro-mensaje',
                    resultado.mensaje,
                    true
                );

                history.replaceState(
                    { pagina: 'principal', autenticado: true },
                    '',
                    location.pathname + location.search
                );

                setTimeout(() => mostrarInicioPrincipal(false), 500);
            } catch (error) {
                mostrarMensaje('registro-mensaje', error.message);
                botonVerificar.disabled = false;
            } finally {
                botonVerificar.textContent = 'Verificar código';
            }
        });
    }

    if (botonReenviar) {
        botonReenviar.addEventListener('click', async () => {
            botonReenviar.disabled = true;
            botonReenviar.textContent = 'Enviando...';

            try {
                const resultado = await obtenerRespuesta('/registro/reenviar-codigo', {
                    method: 'POST',
                    body: JSON.stringify({ usuario: usuarioPendiente })
                });

                mostrarMensaje('registro-mensaje', resultado.mensaje, true);
                botonReenviar.style.display = 'none';
                botonVerificar.disabled = false;
                iniciarTemporizador(resultado.expiraEn);
                campoCodigo().value = '';
                campoCodigo().focus();
            } catch (error) {
                mostrarMensaje('registro-mensaje', error.message);
                botonReenviar.disabled = false;
            } finally {
                botonReenviar.textContent = 'Reenviar código';
            }
        });
    }
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

    if (obtenerUsuarioActual()) {
        mostrarInicioPrincipal(false);
    }
});
