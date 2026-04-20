const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Usar variable de entorno para el puerto (Render lo asigna automáticamente)
const PORT = process.env.PORT || 3000;

// Archivo para guardar respuestas (usar ruta absoluta)
const ARCHIVO_RESPUESTAS = path.join(__dirname, 'respuestas.json');
let respuestas = [];

// Cargar respuestas existentes si el archivo existe
if (fs.existsSync(ARCHIVO_RESPUESTAS)) {
    const data = fs.readFileSync(ARCHIVO_RESPUESTAS, 'utf8');
    respuestas = JSON.parse(data);
    console.log(`📊 Cargadas ${respuestas.length} respuestas existentes`);
}

// Función para guardar respuestas en el archivo
function guardarRespuestas() {
    fs.writeFileSync(ARCHIVO_RESPUESTAS, JSON.stringify(respuestas, null, 2));
}

// Mostrar formulario
app.get('/', (req, res) => {
    res.send(`
        <form method="POST" action="/">
            <h1>Formulario de Trabajo</h1>
            DNI: <input type="text" name="dni" required><br><br>
            Pregunta: ¿Cuál es la capital de Argentina?<br>
            <input type="text" name="respuesta" required><br><br>
            <button type="submit">Enviar</button>
        </form>
    `);
});

// Procesar respuestas
app.post('/', (req, res) => {
    const { dni, respuesta } = req.body;

    // Limpiar espacios en blanco
    const dniLimpio = dni.trim();
    const respuestaLimpia = respuesta.trim().toLowerCase();

    // Validar que no estén vacíos
    if (!dniLimpio || !respuestaLimpia) {
        return res.send(`
            No puede dejar campos vacíos.<br><br>
            <a href="/">Volver al inicio</a>
        `);
    }

    // Validar DNI: 7 u 8 dígitos, que no sean todos ceros
    const dniValido = /^\\d{7,8}$/.test(dniLimpio) && !/^0+$/.test(dniLimpio);

    if (!dniValido) {
        return res.send(`
            DNI inválido. Debe tener 7 u 8 números.<br><br>
            <a href="/">Volver al inicio</a>
        `);
    }

    // Verificar si el DNI ya respondió
    const yaRespondio = respuestas.some(r => r.dni === dniLimpio);
    if (yaRespondio) {
        return res.send(`
            Este DNI ya completó el formulario.<br><br>
            <a href="/">Volver al inicio</a>
        `);
    }

    // Verificar respuesta correcta
    if (respuestaLimpia === "buenos aires") {
        // Guardar respuesta exitosa
        const nuevaRespuesta = {
            dni: dniLimpio,
            respuesta: respuestaLimpia,
            fecha: new Date().toISOString(),
            estado: "correcta",
            ip: req.ip || req.connection.remoteAddress
        };
        respuestas.push(nuevaRespuesta);
        guardarRespuestas();

        console.log("✅ Nuevo registro - DNI:", dniLimpio);
        console.log("📊 Total respuestas:", respuestas.length);

        return res.send(`
            <h2>¡Formulario completado correctamente!</h2>
            <p>Gracias por participar.</p>
            <a href="/">Volver al inicio</a>
        `);
    } else {
        // Guardar respuesta incorrecta también
        const nuevaRespuesta = {
            dni: dniLimpio,
            respuesta: respuestaLimpia,
            fecha: new Date().toISOString(),
            estado: "incorrecta",
            ip: req.ip || req.connection.remoteAddress
        };
        respuestas.push(nuevaRespuesta);
        guardarRespuestas();

        console.log("❌ Respuesta incorrecta - DNI:", dniLimpio);

        return res.send(`
            <h2>Respuesta incorrecta</h2>
            <p>La capital de Argentina es Buenos Aires.</p>
            <a href="/">Intentar de nuevo</a>
        `);
    }
});

// Endpoint para administración (ver todas las respuestas)
app.get('/admin/ver-respuestas', (req, res) => {
    if (respuestas.length === 0) {
        return res.send("No hay respuestas aún.<br><br><a href='/'>Volver al inicio</a>");
    }

    let html = "<h2>Respuestas guardadas</h2>";
    html += "<p>Total: " + respuestas.length + " respuestas</p>";
    html += "<ul>";
    
    respuestas.forEach((r, index) => {
        html += `<li>${index + 1}. DNI: ${r.dni} - ${r.estado === "correcta" ? "✅ Correcta" : "❌ Incorrecta"} - ${new Date(r.fecha).toLocaleString()}</li>`;
    });
    
    html += "</ul><br><a href='/'>Volver al inicio</a>";
    res.send(html);
});

// Endpoint para estadísticas básicas
app.get('/admin/stats', (req, res) => {
    const total = respuestas.length;
    const correctas = respuestas.filter(r => r.estado === "correcta").length;
    const incorrectas = total - correctas;
    const porcentajeCorrectas = total > 0 ? (correctas / total * 100).toFixed(2) : 0;

    res.send(`
        <h2>Estadísticas del formulario</h2>
        <p>Total de respuestas: ${total}</p>
        <p>Correctas: ${correctas}</p>
        <p>Incorrectas: ${incorrectas}</p>
        <p>Tasa de aciertos: ${porcentajeCorrectas}%</p>
        <br><a href="/">Volver al inicio</a>
        <br><a href="/admin/ver-respuestas">Ver todas las respuestas</a>
    `);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));