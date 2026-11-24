(function () {

    "use strict";

    /* =====================================================
       CARGADOR DE KATEX DESDE EL SERVIDOR (RENDER)
    ===================================================== */

    function asegurarKatex() {
        return new Promise((resolve) => {
            if (!document.getElementById("katex-css-local")) {
                const link = document.createElement("link");
                link.id = "katex-css-local";
                link.rel = "stylesheet";
                link.href = "/katex.min.css";
                document.head.appendChild(link);
            }

            if (window.katex) {
                return resolve();
            }

            let script = document.getElementById("katex-js-local");
            if (!script) {
                script = document.createElement("script");
                script.id = "katex-js-local";
                script.src = "/katex.min.js";
                script.onload = () => resolve();
                script.onerror = () => {
                    console.warn("No se pudo cargar /katex.min.js; se usará texto plano.");
                    resolve();
                };
                document.head.appendChild(script);
            } else {
                script.addEventListener("load", () => resolve());
            }
        });
    }

    function aLatex(texto) {
        return String(texto)
            .replace(/√(\d+)/g, "\\sqrt{$1}")
            .replace(/e\^\(([^)]+)\)/g, "e^{$1}")
            .replace(/\)\^(\d+)/g, ")^{$1}")
            .replace(/π/g, "\\pi ");
    }

    function renderizarMate(texto, modoDisplay = false) {
        if (window.katex) {
            try {
                return window.katex.renderToString(aLatex(texto), {
                    throwOnError: false,
                    displayMode: modoDisplay
                });
            } catch (e) {
                return escaparHTML(texto);
            }
        }
        return escaparHTML(texto);
    }


    /* =====================================================
       CONFIGURACIÓN
    ===================================================== */

    const TOTAL_PREGUNTAS = 10;

    let preguntas = [];

    let examenEvaluado = false;

    let puntuacion = 0;

    let intentoGuardado = false;


    /* =====================================================
       UTILIDADES
    ===================================================== */

    function aleatorio(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function elegir(arreglo) {
        return arreglo[aleatorio(0, arreglo.length - 1)];
    }

    function mezclar(arreglo) {
        return arreglo
            .map(valor => ({
                valor: valor,
                orden: Math.random()
            }))
            .sort((a, b) => a.orden - b.orden)
            .map(elemento => elemento.valor);
    }

    function sinDuplicados(arreglo) {
        return [...new Set(arreglo)];
    }

    function escaparHTML(texto) {
        return String(texto)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizar(texto) {
        return String(texto)
            .replace(/\s+/g, "")
            .replace(/−/g, "-");
    }


    /* =====================================================
       FORMATO DE NÚMERO COMPLEJO
    ===================================================== */

    function complejo(a, b) {
        let strA = String(a);
        let strB = String(b);

        if (strA === "0" && strB === "0") {
            return "0";
        }

        if (strB === "0") {
            return strA;
        }

        if (strA === "0") {
            if (strB === "1") return "i";
            if (strB === "-1") return "-i";
            return `${strB}i`;
        }

        const esNegativo = strB.startsWith("-");
        const signo = esNegativo ? "-" : "+";
        const valor = esNegativo ? strB.substring(1) : strB;
        const parteImaginaria = valor === "1" ? "i" : `${valor}i`;

        return `${strA} ${signo} ${parteImaginaria}`;
    }


    /* =====================================================
       ÁNGULOS (k = múltiplos de π/12)
    ===================================================== */

    function normalizarAngulo(k) {
        k %= 24;
        if (k < 0) {
            k += 24;
        }
        return k;
    }

    function mcd(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);

        while (b !== 0) {
            const temporal = b;
            b = a % b;
            a = temporal;
        }
        return a;
    }

    function formatoAngulo(k) {
        k = normalizarAngulo(k);

        if (k === 0) {
            return "0";
        }

        const divisor = mcd(k, 12);
        const numerador = k / divisor;
        const denominador = 12 / divisor;

        if (denominador === 1) {
            if (numerador === 1) {
                return "π";
            }
            return `${numerador}π`;
        }

        if (numerador === 1) {
            return `π/${denominador}`;
        }

        return `${numerador}π/${denominador}`;
    }

    const ANGULOS =;

    function polar(r, k) {
        return `${r}e^(i${formatoAngulo(k)})`;
    }
    /* =====================================================
       COORDENADAS EXACTAS PARA RADIO 2
    ===================================================== */

    const COORDENADAS_RADIO_2 = {
        0:  ["2", "0"],
        2:  ["√3", "1"],
        3:  ["√2", "√2"],
        4:  ["1", "√3"],
        6:  ["0", "2"],
        8:  ["-1", "√3"],
        9:  ["-√2", "√2"],
        10: ["-√3", "1"],
        12: ["-2", "0"],
        14: ["-√3", "-1"],
        15: ["-√2", "-√2"],
        16: ["-1", "-√3"],
        18: ["0", "-2"],
        20: ["1", "-√3"],
        21: ["√2", "-√2"],
        22: ["√3", "-1"]
    };

    function escalarRadical(valor, factor) {
        if (valor === "0") {
            return "0";
        }

        if (factor === 1) {
            return valor;
        }

        if (valor === "1") {
            return `${factor}`;
        }

        if (valor === "-1") {
            return `-${factor}`;
        }

        if (valor.startsWith("-")) {
            return `-${factor}${valor.substring(1)}`;
        }

        return `${factor}${valor}`;
    }

    function coordenadasPolar(r, k) {
        k = normalizarAngulo(k);
        const factor = r / 2;
        const base = COORDENADAS_RADIO_2[k];

        return {
            a: escalarRadical(base[0], factor),
            b: escalarRadical(base[1], factor)
        };
    }

    function rectangularDesdePolar(r, k) {
        const coordenadas = coordenadasPolar(r, k);
        return complejo(coordenadas.a, coordenadas.b);
    }


    /* =====================================================
       PREGUNTA 1/2: SUMA DE COMPLEJOS
    ===================================================== */

    function generarSuma() {
        let a;
        let b;
        let c;
        let d;
        let resultadoA;
        let resultadoB;
        let opciones;

        do {
            a = aleatorio(-8, 8);
            b = aleatorio(-8, 8);
            c = aleatorio(-8, 8);
            d = aleatorio(-8, 8);

            resultadoA = a + c;
            resultadoB = b + d;

            const correcta = complejo(resultadoA, resultadoB);

            opciones = [
                correcta,
                complejo(a - c, b + d),
                complejo(a + c, b - d),
                complejo(a - c, b - d)
            ];

            opciones = sinDuplicados(opciones);
        } while (opciones.length < 4);

        const correcta = complejo(resultadoA, resultadoB);

        return {
            tipo: "Suma de números complejos",
            enunciado: "Calcula la siguiente suma:",
            expresion: `(${complejo(a, b)}) + (${complejo(c, d)})`,
            correcta: correcta,
            opciones: mezclar(opciones)
        };
    }


    /* =====================================================
       MULTIPLICACIÓN RECTANGULAR
    ===================================================== */

    function generarMultiplicacionRectangular() {
        let a;
        let b;
        let c;
        let d;
        let correcta;
        let opciones;

        do {
            a = aleatorio(-5, 5);
            b = aleatorio(-5, 5);
            c = aleatorio(-5, 5);
            d = aleatorio(-5, 5);

            const real = a * c - b * d;
            const imaginaria = a * d + b * c;

            correcta = complejo(real, imaginaria);

            opciones = [
                correcta,
                complejo(a * c + b * d, imaginaria),
                complejo(real, a * d - b * c),
                complejo(a * c + b * d, a * d - b * c)
            ];

            opciones = sinDuplicados(opciones);
        } while (opciones.length < 4);

        return {
            tipo: "Multiplicación rectangular",
            enunciado: "Multiplica los siguientes números complejos:",
            expresion: `(${complejo(a, b)})(${complejo(c, d)})`,
            correcta: correcta,
            opciones: mezclar(opciones)
        };
    }


    /* =====================================================
       MULTIPLICACIÓN POLAR
    ===================================================== */

    function generarMultiplicacionPolar() {
        const r1 = elegir([2, 4]);
        const r2 = elegir([2, 4]);
        const k1 = elegir(ANGULOS);
        const k2 = elegir(ANGULOS);

        const radioCorrecto = r1 * r2;
        const anguloCorrecto = normalizarAngulo(k1 + k2);
        const correcta = polar(radioCorrecto, anguloCorrecto);

        let opciones = [
            correcta,
            polar(r1 + r2, anguloCorrecto),
            polar(radioCorrecto, normalizarAngulo(k1 - k2)),
            polar(r1, anguloCorrecto)
        ];

        opciones = sinDuplicados(opciones);

        while (opciones.length < 4) {
            const nuevoRadio = radioCorrecto + elegir([-4, -2, 2, 4]);
            const nuevoAngulo = normalizarAngulo(
                anguloCorrecto + elegir([2, 3, 4, 6])
            );

            opciones.push(
                polar(Math.max(1, nuevoRadio), nuevoAngulo)
            );

            opciones = sinDuplicados(opciones);
        }

        return {
            tipo: "Multiplicación en forma polar",
            enunciado: "Multiplica utilizando la forma polar:",
            expresion: `(${polar(r1, k1)})(${polar(r2, k2)})`,
            correcta: correcta,
            opciones: mezclar(opciones)
        };
    }
    /* =====================================================
       POLAR → RECTANGULAR
    ===================================================== */

    function generarPolarRectangular() {
        const r = elegir();
        const k = elegir(ANGULOS);

        const coordenadas = coordenadasPolar(r, k);
        const correcta = complejo(coordenadas.a, coordenadas.b);

        let opciones = [
            correcta,
            complejo(coordenadas.a, cambiarSignoExacto(coordenadas.b)),
            complejo(cambiarSignoExacto(coordenadas.a), coordenadas.b),
            complejo(r, r)
        ];

        opciones = sinDuplicados(opciones);

        while (opciones.length < 4) {
            const otroK = elegir(ANGULOS.filter(angulo => angulo !== k));
            opciones.push(rectangularDesdePolar(r, otroK));
            opciones = sinDuplicados(opciones);
        }

        return {
            tipo: "Conversión polar → rectangular",
            enunciado: "Convierte el siguiente número complejo a forma rectangular:",
            expresion: polar(r, k),
            correcta: correcta,
            opciones: mezclar(opciones)
        };
    }

    function cambiarSignoExacto(valor) {
        if (valor === "0") return "0";
        if (valor.startsWith("-")) return valor.substring(1);
        return `-${valor}`;
    }


    /* =====================================================
       RECTANGULAR → POLAR
    ===================================================== */

    function generarRectangularPolar() {
        const r = elegir();
        const k = elegir(ANGULOS);

        const rectangular = rectangularDesdePolar(r, k);
        const correcta = polar(r, k);

        let opciones = [
            correcta,
            polar(r / 2, k),
            polar(r, normalizarAngulo(-k)),
            polar(r, normalizarAngulo(k + 12))
        ];

        opciones = sinDuplicados(opciones);

        while (opciones.length < 4) {
            const otroK = elegir(ANGULOS.filter(angulo => angulo !== k));
            opciones.push(polar(r, otroK));
            opciones = sinDuplicados(opciones);
        }

        return {
            tipo: "Conversión rectangular → polar",
            enunciado: "Convierte el siguiente número complejo a forma polar:",
            expresion: `z = ${rectangular}`,
            correcta: correcta,
            opciones: mezclar(opciones)
        };
    }


    /* =====================================================
       DE MOIVRE
    ===================================================== */

    function generarDeMoivre() {
        const r = elegir();
        const k = elegir();
        const n = elegir();

        const radioCorrecto = Math.pow(r, n);
        const anguloCorrecto = normalizarAngulo(k * n);
        const correcta = polar(radioCorrecto, anguloCorrecto);

        let opciones = [
            correcta,
            polar(r, anguloCorrecto),
            polar(radioCorrecto, k),
            polar(Math.pow(r, n - 1), normalizarAngulo(k * (n - 1)))
        ];

        opciones = sinDuplicados(opciones);

        while (opciones.length < 4) {
            opciones.push(
                polar(
                    radioCorrecto,
                    normalizarAngulo(anguloCorrecto + elegir())
                )
            );
            opciones = sinDuplicados(opciones);
        }

        return {
            tipo: "Teorema de De Moivre",
            enunciado: "Aplica el teorema de De Moivre para calcular:",
            expresion: `(${polar(r, k)})^${n}`,
            correcta: correcta,
            opciones: mezclar(opciones)
        };
    }


    /* =====================================================
       GENERAR EXAMEN
    ===================================================== */

    function generarExamen() {
        const generadores = [
            generarSuma,
            generarSuma,
            generarMultiplicacionRectangular,
            generarMultiplicacionRectangular,
            generarMultiplicacionPolar,
            generarMultiplicacionPolar,
            generarPolarRectangular,
            generarRectangularPolar,
            generarDeMoivre,
            generarDeMoivre
        ];

        preguntas = mezclar(generadores.map(generador => generador()));
        examenEvaluado = false;
        puntuacion = 0;

        renderizarExamen();
    }


    /* =====================================================
       RENDERIZAR CON KATEX
    ===================================================== */

    function renderizarExamen() {
        const contenedor = document.getElementById("contenedorPreguntas");
        contenedor.innerHTML = "";

        preguntas.forEach((pregunta, indice) => {
            const tarjeta = document.createElement("div");
            tarjeta.className = "tarjeta-pregunta";
            tarjeta.dataset.numero = indice;

            const opciones = pregunta.opciones
                .map((opcion, indiceOpcion) => {
                    const letra = String.fromCharCode(65 + indiceOpcion);

                    return `
                        <label class="opcion-respuesta">
                            <input
                                type="radio"
                                name="pregunta-${indice}"
                                value="${escaparHTML(opcion)}"
                            >
                            <span class="letra-opcion">${letra}</span>
                            <span>${renderizarMate(opcion, false)}</span>
                        </label>
                    `;
                })
                .join("");

            tarjeta.innerHTML = `
                <div>
                    <span class="numero-pregunta">${indice + 1}</span>
                    <span class="texto-pregunta">${pregunta.enunciado}</span>
                </div>
                <div class="tipo-pregunta">${pregunta.tipo}</div>
                <div class="expresion-matematica">
                    ${renderizarMate(pregunta.expresion, true)}
                </div>
                <div class="opciones-pregunta">${opciones}</div>
            `;

            contenedor.appendChild(tarjeta);
        });

        agregarEventosOpciones();
        actualizarProgreso();
    }
    /* =====================================================
       EVENTOS DE OPCIONES Y PROGRESO
    ===================================================== */

    function agregarEventosOpciones() {
        document.querySelectorAll(".opcion-respuesta").forEach(opcion => {
            opcion.addEventListener("click", () => {
                if (examenEvaluado) return;

                const tarjeta = opcion.closest(".tarjeta-pregunta");
                tarjeta.querySelectorAll(".opcion-respuesta").forEach(otra => {
                    otra.classList.remove("seleccionada");
                });

                opcion.classList.add("seleccionada");
                opcion.querySelector("input").checked = true;
                actualizarProgreso();
            });
        });
    }

    function actualizarProgreso() {
        let respondidas = 0;

        for (let i = 0; i < TOTAL_PREGUNTAS; i++) {
            const respuesta = document.querySelector(`input[name="pregunta-${i}"]:checked`);
            if (respuesta) respondidas++;
        }

        const porcentaje = (respondidas / TOTAL_PREGUNTAS) * 100;
        document.getElementById("contadorPregunta").textContent =
            `${respondidas} de ${TOTAL_PREGUNTAS} respondidas`;
        document.getElementById("barraProgreso").style.width = `${porcentaje}%`;
    }


    /* =====================================================
       EVALUACIÓN Y RESULTADOS
    ===================================================== */

    function evaluarExamen() {
        if (examenEvaluado) return;

        let sinResponder = 0;
        preguntas.forEach((pregunta, indice) => {
            const seleccionada = document.querySelector(`input[name="pregunta-${indice}"]:checked`);
            if (!seleccionada) sinResponder++;
        });

        if (sinResponder > 0) {
            alert(`Aún tienes ${sinResponder} pregunta(s) sin responder.`);
            return;
        }

        puntuacion = 0;

        preguntas.forEach((pregunta, indice) => {
            const tarjeta = document.querySelector(`.tarjeta-pregunta[data-numero="${indice}"]`);
            const seleccionada = tarjeta.querySelector("input:checked");
            const opciones = tarjeta.querySelectorAll(".opcion-respuesta");

            opciones.forEach(opcion => {
                const valor = opcion.querySelector("input").value;
                opcion.classList.remove("correcta", "incorrecta");

                if (normalizar(valor) === normalizar(pregunta.correcta)) {
                    opcion.classList.add("correcta");
                }
            });

            if (normalizar(seleccionada.value) === normalizar(pregunta.correcta)) {
                puntuacion++;
            } else {
                seleccionada.closest(".opcion-respuesta").classList.add("incorrecta");
            }
        });

        examenEvaluado = true;

        document.querySelectorAll(".opcion-respuesta input").forEach(input => {
            input.disabled = true;
        });

        mostrarResultado();
    }

    function mostrarResultado() {
        const modal = document.getElementById("modalResultado");
        const contenido = document.getElementById("resultadoContenido");
        const puntuacionElemento = document.getElementById("puntuacionFinal");
        const mensaje = document.getElementById("mensajeResultado");

        contenido.classList.remove("resultado-rojo", "resultado-amarillo", "resultado-verde");

        if (puntuacion < 6) {
            contenido.classList.add("resultado-rojo");
            mensaje.textContent = "Necesitas reforzar algunos conceptos. ¡Sigue practicando!";
        } else if (puntuacion <= 7) {
            contenido.classList.add("resultado-amarillo");
            mensaje.textContent = "Buen trabajo. Aún puedes mejorar tu dominio del tema.";
        } else {
            contenido.classList.add("resultado-verde");
            mensaje.textContent = "¡Excelente trabajo! Tienes un buen dominio del Álgebra Compleja.";
        }

        puntuacionElemento.textContent = `${puntuacion}/10`;
        modal.classList.add("visible");
    }


    /* =====================================================
       VER RESPUESTAS CON KATEX
    ===================================================== */

    function mostrarRespuestas() {
        const resumen = document.getElementById("resumenRespuestas");
        resumen.innerHTML = "";

        preguntas.forEach((pregunta, indice) => {
            const tarjeta = document.querySelector(`.tarjeta-pregunta[data-numero="${indice}"]`);
            const seleccionada = tarjeta.querySelector("input:checked");
            const respuestaUsuario = seleccionada ? seleccionada.value : "Sin responder";
            const correcta = seleccionada && normalizar(seleccionada.value) === normalizar(pregunta.correcta);

            const bloque = document.createElement("div");
            bloque.className = correcta ? "resumen-pregunta correcta" : "resumen-pregunta incorrecta";

            const htmlRespuestaUsuario = seleccionada
                ? renderizarMate(respuestaUsuario, false)
                : "Sin responder";

            bloque.innerHTML = `
                <h4>Pregunta ${indice + 1}</h4>
                <p><strong>Tipo:</strong> ${escaparHTML(pregunta.tipo)}</p>
                <p>${escaparHTML(pregunta.enunciado)}</p>
                <div class="expresion-matematica">
                    ${renderizarMate(pregunta.expresion, true)}
                </div>
                <p class="${correcta ? "respuesta-correcta" : "respuesta-usuario"}">
                    Tu respuesta: ${htmlRespuestaUsuario}
                </p>
                <p class="respuesta-correcta">
                    Respuesta correcta: ${renderizarMate(pregunta.correcta, false)}
                </p>
            `;

            resumen.appendChild(bloque);
        });

        document.getElementById("modalResultado").classList.remove("visible");
        document.getElementById("modalRespuestas").classList.add("visible");
    }

    function regresarResultado() {
        document.getElementById("modalRespuestas").classList.remove("visible");
        document.getElementById("modalResultado").classList.add("visible");
    }

    function nuevoExamen() {
        intentoGuardado = false;

        const btnGuardar = document.getElementById("btnGuardarPuntuacion");
        if (btnGuardar) {
            btnGuardar.textContent = "Guardar puntuación";
            btnGuardar.disabled = false;
        }

        document.getElementById("modalResultado").classList.remove("visible");
        generarExamen();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    /* =====================================================
       REGRESAR A ÁLGEBRA Y GUARDAR EN POSTGRESQL (NEON)
    ===================================================== */

    async function regresarAlgebra() {
        try {
            const respuesta = await fetch("/api/variable-compleja/algebra");
            const datos = await respuesta.json();
            const heroContent = document.querySelector(".hero-content");

            const cssAnterior = document.getElementById("css-dinamico");
            if (cssAnterior) cssAnterior.remove();

            const css = document.createElement("link");
            css.id = "css-dinamico";
            css.rel = "stylesheet";
            css.href = datos.cssUrl;
            document.head.appendChild(css);

            heroContent.innerHTML = datos.html;

            heroContent.querySelectorAll("script").forEach(scriptViejo => {
                const scriptNuevo = document.createElement("script");
                scriptNuevo.text = scriptViejo.text;
                document.body.appendChild(scriptNuevo);
                scriptNuevo.remove();
            });
        } catch (error) {
            console.error("Error al regresar a Álgebra:", error);
        }
    }

    async function guardarPuntuacion() {
        const usuario = sessionStorage.getItem("complexlab_usuario");

        if (!usuario) {
            alert("Debes iniciar sesión para guardar tu puntuación en Mi progreso.");
            return;
        }

        if (intentoGuardado) {
            alert("Este intento ya fue guardado en tu historial.");
            return;
        }

        let numeroIntento = 1;

        try {
            const registrosPrevios = await fetch(
                `/api/progreso/${encodeURIComponent(usuario)}`,
                { cache: "no-store" }
            );

            if (registrosPrevios.ok) {
                const datosPrevios = await registrosPrevios.json();
                numeroIntento = datosPrevios.length + 1;
            }

            const respuesta = await fetch("/api/progreso", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    usuario,
                    numero_intento: numeroIntento,
                    unidad_tematica: "Álgebra Compleja",
                    calificacion: puntuacion
                })
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(resultado.error || "No se pudo guardar la puntuación.");
            }

            intentoGuardado = true;

            const btnGuardar = document.getElementById("btnGuardarPuntuacion");
            if (btnGuardar) {
                btnGuardar.textContent = "✓ Guardado";
                btnGuardar.disabled = true;
            }

            alert(`¡Puntuación (${puntuacion}/10) guardada en Mi progreso!`);
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }


    /* =====================================================
       EVENTOS E INICIALIZACIÓN CON KATEX
    ===================================================== */

    document.getElementById("btnEvaluar").addEventListener("click", evaluarExamen);
    document.getElementById("btnVerRespuestas").addEventListener("click", mostrarRespuestas);
    document.getElementById("btnVolverIntentar").addEventListener("click", nuevoExamen);
    document.getElementById("btnGuardarPuntuacion").addEventListener("click", guardarPuntuacion);
    document.getElementById("btnCerrarRespuestas").addEventListener("click", regresarResultado);
    document.getElementById("btnRegresarResultado").addEventListener("click", regresarResultado);
    document.getElementById("btnRegresarAlgebra").addEventListener("click", regresarAlgebra);

    asegurarKatex().then(() => {
        generarExamen();
    });

})();
