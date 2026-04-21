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

// Las preguntas del formulario
const preguntasMC = [
    { id: 1, texto: "¿Cuál es la capital de Argentina?", opciones: ["Buenos Aires", "Córdoba", "Rosario"], correcta: "Buenos Aires" },
    { id: 2, texto: "¿Qué río es el más largo del mundo?", opciones: ["Amazonas", "Nilo", "Yangtsé"], correcta: "Amazonas" },
    { id: 3, texto: "¿En qué año llegó el hombre a la Luna?", opciones: ["1969", "1972", "1965"], correcta: "1969" },
    { id: 4, texto: "¿Cuál es el idioma más hablado del mundo?", opciones: ["Inglés", "Mandarín", "Español"], correcta: "Mandarín" },
    { id: 5, texto: "¿Qué país tiene la población más grande?", opciones: ["India", "China", "EE.UU."], correcta: "China" }
];

const preguntasVF = [
    { id: 1, texto: "El sol es una estrella", correcta: true },
    { id: 2, texto: "El agua hierve a 100 grados Celsius al nivel del mar", correcta: true },
    { id: 3, texto: "Los delfines son peces", correcta: false },
    { id: 4, texto: "La Torre Eiffel está en Londres", correcta: false },
    { id: 5, texto: "El corazón humano tiene 4 cavidades", correcta: true }
];

// Función para generar el formulario HTML
function generarFormulario() {
    let mcHtml = '';
    preguntasMC.forEach(p => {
        mcHtml += `
            <div style="margin-bottom: 20px;">
                <strong>${p.id}. ${p.texto}</strong><br>
                <select name="mc_${p.id}" required style="padding: 5px; width: 100%; max-width: 300px;">
                    <option value="">Seleccioná una opción</option>
                    ${p.opciones.map(op => `<option value="${op}">${op}</option>`).join('')}
                </select>
            </div>
        `;
    });

    let vfHtml = '';
    preguntasVF.forEach(p => {
        vfHtml += `
            <div style="margin-bottom: 20px;">
                <strong>${p.id + preguntasMC.length}. ${p.texto}</strong><br>
                <label><input type="radio" name="vf_${p.id}" value="true" required> Verdadero</label>
                <label><input type="radio" name="vf_${p.id}" value="false" required> Falso</label>
            </div>
        `;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Formulario de Trabajo</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                .form-group { margin-bottom: 20px; }
                label { font-weight: bold; }
                input, select { padding: 8px; margin-top: 5px; }
                button { background-color: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; }
                button:hover { background-color: #0056b3; }
                .correcto { color: green; }
                .incorrecto { color: red; }
            </style>
        </head>
        <body>
            <h1>Formulario de Trabajo</h1>
            <form method="POST" action="/">
                <div class="form-group">
                    <label>Nombre:</label><br>
                    <input type="text" name="nombre" required style="width: 100%; padding: 8px;">
                </div>
                <div class="form-group">
                    <label>Apellido:</label><br>
                    <input type="text" name="apellido" required style="width: 100%; padding: 8px;">
                </div>
                <div class="form-group">
                    <label>DNI (7 u 8 números):</label><br>
                    <input type="text" name="dni" required style="width: 100%; padding: 8px;">
                </div>
                
                <h2>Preguntas de opción múltiple</h2>
                ${mcHtml}
                
                <h2>Preguntas Verdadero o Falso</h2>
                ${vfHtml}
                
                <button type="submit">Enviar respuestas</button>
            </form>
        </body>
        </html>
    `;
}

// Mostrar formulario
app.get('/', (req, res) => {
    res.send(generarFormulario());
});

// Procesar respuestas
app.post('/', async (req, res) => {
    const { nombre, apellido, dni } = req.body;
    
    const nombreLimpio = nombre.trim();
    const apellidoLimpio = apellido.trim();
    const dniLimpio = dni.trim();

    // Validaciones básicas
    if (!nombreLimpio || !apellidoLimpio || !dniLimpio) {
        return res.send(`<h2>Error</h2><p>Completá todos los campos.</p><a href="/">Volver al inicio</a>`);
    }

    const dniValido = /^\d{7,8}$/.test(dniLimpio) && !/^0+$/.test(dniLimpio);
    if (!dniValido) {
        return res.send(`<h2>Error</h2><p>DNI inválido. Debe tener 7 u 8 números.</p><a href="/">Volver al inicio</a>`);
    }

    if (!mongoConnected) {
        return res.send(`<h2>Error</h2><p>Base de datos no disponible. Intentá más tarde.</p><a href="/">Volver al inicio</a>`);
    }

    try {
        // Contar cuántos intentos tiene este DNI
        const intentos = await respuestasCollection.countDocuments({ dni: dniLimpio });
        
        if (intentos >= 2) {
            return res.send(`<h2>Límite alcanzado</h2><p>Este DNI ya utilizó sus 2 intentos permitidos.</p><a href="/">Volver al inicio</a>`);
        }

        // Corregir respuestas de opción múltiple
        let aciertosMC = 0;
        for (let p of preguntasMC) {
            const respuestaUsuario = req.body[`mc_${p.id}`];
            if (respuestaUsuario === p.correcta) {
                aciertosMC++;
            }
        }

        // Corregir respuestas de Verdadero/Falso
        let aciertosVF = 0;
        for (let p of preguntasVF) {
            const respuestaUsuario = req.body[`vf_${p.id}`];
            const esCorrecto = (respuestaUsuario === 'true' && p.correcta) || (respuestaUsuario === 'false' && !p.correcta);
            if (esCorrecto) {
                aciertosVF++;
            }
        }

        const totalAciertos = aciertosMC + aciertosVF;
        const totalPreguntas = preguntasMC.length + preguntasVF.length;

        // Guardar en MongoDB
        const nuevaRespuesta = {
            nombre: nombreLimpio,
            apellido: apellidoLimpio,
            dni: dniLimpio,
            fecha: new Date(),
            intento: intentos + 1,
            aciertosMC,
            aciertosVF,
            totalAciertos,
            totalPreguntas,
            respuestas: req.body
        };
        
        await respuestasCollection.insertOne(nuevaRespuesta);
        console.log(`📝 ${nombreLimpio} ${apellidoLimpio} (${dniLimpio}) - Intento ${intentos + 1}: ${totalAciertos}/${totalPreguntas} aciertos`);

        // Mostrar resultado (solo la cantidad de aciertos, no las respuestas correctas)
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Resultado del Formulario</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                    .aciertos { font-size: 48px; color: #007bff; margin: 20px 0; }
                    button { background-color: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; }
                </style>
            </head>
            <body>
                <h1>¡Formulario completado!</h1>
                <p>Gracias por participar, ${nombreLimpio} ${apellidoLimpio}.</p>
                <div class="aciertos">${totalAciertos} / ${totalPreguntas}</div>
                <p>Respuestas correctas de ${totalPreguntas} preguntas.</p>
                <p>Intentos restantes: ${2 - (intentos + 1)}</p>
                <br>
                <a href="/"><button>Volver al inicio</button></a>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error al guardar:', error);
        return res.send(`<h2>Error</h2><p>Hubo un problema al guardar tus respuestas. Intentá nuevamente.</p><a href="/">Volver al inicio</a>`);
    }
});

// Admin: Ver todas las respuestas
app.get('/admin/ver-respuestas', async (req, res) => {
    if (!mongoConnected) {
        return res.send("Base de datos no disponible.<br><br><a href='/'>Volver al inicio</a>");
    }

    try {
        const respuestas = await respuestasCollection.find({}).sort({ fecha: -1 }).toArray();
        
        if (respuestas.length === 0) {
            return res.send("No hay respuestas aún.<br><br><a href='/'>Volver al inicio</a>");
        }

        let html = "<h2>Respuestas guardadas</h2>";
        html += `<p>Total de intentos: ${respuestas.length}</p>`;
        html += "<table border='1' cellpadding='8' cellspacing='0' style='border-collapse: collapse; width: 100%;'>";
        html += "<tr><th>#</th><th>Nombre</th><th>Apellido</th><th>DNI</th><th>Intento</th><th>Aciertos</th><th>Fecha</th></tr>";
        
        respuestas.forEach((r, index) => {
            html += `<tr>
                        <td>${index + 1}</td>
                        <td>${r.nombre}</td>
                        <td>${r.apellido}</td>
                        <td>${r.dni}</td>
                        <td>${r.intento}</td>
                        <td>${r.totalAciertos}/${r.totalPreguntas}</td>
                        <td>${new Date(r.fecha).toLocaleString()}</td>
                     </tr>`;
        });
        html += "</table><br><a href='/'>Volver al inicio</a>";
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
        const totalIntentos = await respuestasCollection.countDocuments();
        const personasUnicas = await respuestasCollection.distinct('dni');
        const promedioAciertos = await respuestasCollection.aggregate([
            { $group: { _id: null, promedio: { $avg: "$totalAciertos" } } }
        ]).toArray();

        res.send(`
            <h2>Estadísticas del formulario</h2>
            <p>Total de intentos: ${totalIntentos}</p>
            <p>Personas que participaron: ${personasUnicas.length}</p>
            <p>Promedio de aciertos: ${promedioAciertos[0] ? promedioAciertos[0].promedio.toFixed(2) : 0} / 10</p>
            <br><a href="/">Volver al inicio</a>
            <br><a href="/admin/ver-respuestas">Ver todas las respuestas</a>
        `);
    } catch (error) {
        res.send("Error al calcular estadísticas.<br><br><a href='/'>Volver al inicio</a>");
    }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    conectarMongoDB();
});