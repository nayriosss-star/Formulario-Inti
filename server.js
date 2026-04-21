const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nayriosss_db_user:fNy8tCN6f6TWw6QX@cluster0.efr0t7e.mongodb.net/?appName=Cluster0';

let db;
let respuestasCollection;
let mongoConnected = false;

// Conectar a MongoDB
async function conectarMongoDB() {
    try {
        console.log('🔄 Conectando a MongoDB...');
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Conectado a MongoDB');
        db = client.db('formulario_db');
        respuestasCollection = db.collection('respuestas');
        mongoConnected = true;
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
        mongoConnected = false;
    }
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
        <footer><small>Estado MongoDB: ${mongoConnected ? '✅ Conectado' : '❌ Desconectado'}</small></footer>
    `);
});

// Procesar respuestas
app.post('/', async (req, res) => {
    const { dni, respuesta } = req.body;

    const dniLimpio = dni.trim();
    const respuestaLimpia = respuesta.trim().toLowerCase();

    // Validaciones
    if (!dniLimpio || !respuestaLimpia) {
        return res.send(`No puede dejar campos vacíos.<br><br><a href="/">Volver al inicio</a>`);
    }

    const dniValido = /^\d{7,8}$/.test(dniLimpio) && !/^0+$/.test(dniLimpio);
    if (!dniValido) {
        return res.send(`DNI inválido. Debe tener 7 u 8 números.<br><br><a href="/">Volver al inicio</a>`);
    }

    // Verificar si MongoDB está conectado
    if (!mongoConnected) {
        return res.send(`Error: Base de datos no disponible. Por favor intentá más tarde.<br><br><a href="/">Volver al inicio</a>`);
    }

    try {
        // Verificar si el DNI ya existe en MongoDB
        const yaRespondio = await respuestasCollection.findOne({ dni: dniLimpio });
        if (yaRespondio) {
            return res.send(`Este DNI ya completó el formulario.<br><br><a href="/">Volver al inicio</a>`);
        }

        const esCorrecta = respuestaLimpia === "buenos aires";
        
        // Guardar en MongoDB
        const nuevaRespuesta = {
            dni: dniLimpio,
            respuesta: respuestaLimpia,
            fecha: new Date(),
            estado: esCorrecta ? "correcta" : "incorrecta"
        };
        
        await respuestasCollection.insertOne(nuevaRespuesta);
        console.log(`📝 Guardado: ${dniLimpio} - ${esCorrecta ? "Correcta" : "Incorrecta"}`);

        if (esCorrecta) {
            return res.send(`<h2>¡Formulario completado correctamente!</h2><p>Gracias por participar.</p><a href="/">Volver al inicio</a>`);
        } else {
            return res.send(`<h2>Respuesta incorrecta</h2><p>La capital de Argentina es Buenos Aires.</p><a href="/">Intentar de nuevo</a>`);
        }
    } catch (error) {
        console.error('Error al guardar:', error);
        return res.send(`Error al guardar los datos. Intentá nuevamente.<br><br><a href="/">Volver al inicio</a>`);
    }
});

// Admin: Ver todas las respuestas
app.get('/admin/ver-respuestas', async (req, res) => {
    if (!mongoConnected) {
        return res.send("Base de datos no disponible.<br><br><a href='/'>Volver al inicio</a>");
    }

    try {
        const respuestas = await respuestasCollection.find({}).toArray();
        
        if (respuestas.length === 0) {
            return res.send("No hay respuestas aún.<br><br><a href='/'>Volver al inicio</a>");
        }

        let html = "<h2>Respuestas guardadas</h2>";
        html += "<p>Total: " + respuestas.length + "respuestas</p>";
        html += "<ul>";
        respuestas.forEach((r, index) => {
            html += `<li>${index + 1}. DNI: ${r.dni} - ${r.estado === "correcta" ? "✅ Correcta" : "❌ Incorrecta"} - ${new Date(r.fecha).toLocaleString()}</li>`;
        });
        html += "</ul><br><a href='/'>Volver al inicio</a>";
        res.send(html);
    } catch (error) {
        res.send("Error al leer las respuestas.<br><br><a href='/'>Volver al inicio</a>");
    }
});

// Admin: Estadísticas
app.get('/admin/stats', async (req, res) => {
    if (!mongoConnected) {
        return res.send("Base de datos no disponible.<br><br><a href='/'>Volver al inicio</a>");
    }

    try {
        const total = await respuestasCollection.countDocuments();
        const correctas = await respuestasCollection.countDocuments({ estado: "correcta" });
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
    } catch (error) {
        res.send("Error al calcular estadísticas.<br><br><a href='/'>Volver al inicio</a>");
    }
});

// Iniciar servidor PRIMERO, luego conectar MongoDB
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    conectarMongoDB(); // Conectar después de que el servidor arranque
});