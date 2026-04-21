const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Sirve archivos estáticos (CSS)
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

// Función para generar el formulario HTML (sin CSS interno)
function generarFormulario() {
    let mcHtml = '';
    preguntasMC.forEach(p => {
        mcHtml += `
            <div class="question-card">
                <label class="question-text">${p.id}. ${p.texto}</label>
                <select name="mc_${p.id}" class="form-select" required>
                    <option value="">Seleccioná una opción</option>
                    ${p.opciones.map(op => `<option value="${op}">${op}</option>`).join('')}
                </select>
            </div>
        `;
    });

    let vfHtml = '';
    preguntasVF.forEach(p => {
        vfHtml += `
            <div class="question-card">
                <label class="question-text">${p.id + preguntasMC.length}. ${p.texto}</label>
                <div class="radio-group">
                    <label class="radio-label">
                        <input type="radio" name="vf_${p.id}" value="true" required> Verdadero
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="vf_${p.id}" value="false" required> Falso
                    </label>
                </div>
            </div>
        `;
    });

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <title>Formulario de Evaluación</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="/styles.css?v=2">
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📋 Formulario de Evaluación</h1>
                    <p>Completá todos los campos para participar</p>
                </div>
                
                <div class="form-content">
                    <form method="POST" action="/">
                        <div class="form-group">
                            <label>👤 Nombre:</label>
                            <input type="text" name="nombre" placeholder="Tu nombre" required>
                        </div>
                        
                        <div class="form-group">
                            <label>📝 Apellido:</label>
                            <input type="text" name="apellido" placeholder="Tu apellido" required>
                        </div>
                        
                        <div class="form-group">
                            <label>🆔 DNI (7 u 8 números):</label>
                            <input type="text" name="dni" placeholder="Ej: 12345678" required>
                        </div>
                        
                        <div class="section-title">📌 Preguntas de Opción Múltiple</div>
                        ${mcHtml}
                        
                        <div class="section-title">✓ Verdadero o Falso</div>
                        ${vfHtml}
                        
                        <button type="submit" class="submit-btn">🚀 Enviar respuestas</button>
                    </form>
                </div>
                
                <div class="footer">
                    <p>Podés realizar el formulario hasta 2 veces por DNI</p>
                </div>
            </div>
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

        // Mostrar resultado con CSS moderno
        return res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <title>Resultado del Formulario</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    
                    .result-card {
                        background: white;
                        border-radius: 20px;
                        padding: 50px;
                        text-align: center;
                        max-width: 500px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        animation: fadeIn 0.5s ease;
                    }
                    
                    @keyframes fadeIn {
                        from {
                            opacity: 0;
                            transform: translateY(-20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    .result-card h1 {
                        color: #333;
                        margin-bottom: 20px;
                        font-size: 2em;
                    }
                    
                    .result-card p {
                        color: #666;
                        margin-bottom: 15px;
                        font-size: 1.1em;
                    }
                    
                    .score {
                        font-size: 64px;
                        font-weight: bold;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                        margin: 20px 0;
                    }
                    
                    .attempts {
                        background: #f0f0f0;
                        padding: 10px;
                        border-radius: 10px;
                        margin: 20px 0;
                    }
                    
                    .btn {
                        display: inline-block;
                        padding: 12px 30px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-decoration: none;
                        border-radius: 25px;
                        margin-top: 20px;
                        transition: transform 0.2s ease;
                    }
                    
                    .btn:hover {
                        transform: translateY(-2px);
                    }
                </style>
            </head>
            <body>
                <div class="result-card">
                    <h1>🎉 ¡Formulario completado!</h1>
                    <p>Gracias por participar, <strong>${nombreLimpio} ${apellidoLimpio}</strong></p>
                    <div class="score">${totalAciertos} / ${totalPreguntas}</div>
                    <p>Respuestas correctas de ${totalPreguntas} preguntas</p>
                    <div class="attempts">
                        Intentos restantes: ${2 - (intentos + 1)}
                    </div>
                    <a href="/" class="btn">📝 Volver al inicio</a>
                </div>
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

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Administración - Respuestas</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 50px auto; padding: 20px; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #667eea; color: white; }
                    tr:nth-child(even) { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <h2>Respuestas guardadas</h2>
                <p>Total de intentos: ${respuestas.length}</p>
                <table>
                    <tr><th>#</th><th>Nombre</th><th>Apellido</th><th>DNI</th><th>Intento</th><th>Aciertos</th><th>Fecha</th></tr>
                    ${respuestas.map((r, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${r.nombre}</td>
                            <td>${r.apellido}</td>
                            <td>${r.dni}</td>
                            <td>${r.intento}</td>
                            <td>${r.totalAciertos}/${r.totalPreguntas}</td>
                            <td>${new Date(r.fecha).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </table>
                <br><a href="/">Volver al inicio</a>
            </body>
            </html>
        `;
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
            <!DOCTYPE html>
            <html>
            <head>
                <title>Administración - Estadísticas</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                    .stat { font-size: 36px; color: #667eea; margin: 10px 0; }
                </style>
            </head>
            <body>
                <h2>Estadísticas del formulario</h2>
                <p><strong>Total de intentos:</strong> <span class="stat">${totalIntentos}</span></p>
                <p><strong>Personas que participaron:</strong> <span class="stat">${personasUnicas.length}</span></p>
                <p><strong>Promedio de aciertos:</strong> <span class="stat">${promedioAciertos[0] ? promedioAciertos[0].promedio.toFixed(2) : 0} / 10</span></p>
                <br><a href="/">Volver al inicio</a>
                <br><a href="/admin/ver-respuestas">Ver todas las respuestas</a>
            </body>
            </html>
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