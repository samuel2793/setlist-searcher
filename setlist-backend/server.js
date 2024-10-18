import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(cors());

// Ruta para obtener los setlists desde la API de Setlist.fm
app.get('/setlist', async (req, res) => {
    const artistName = req.query.artistName;
    const page = req.query.p || 1;  // Obtener la página, por defecto 1
    const apiKey = 'GFdJkjgCiEng0wXzkOz0kQRwQrlHSCMSK8LT'; // Coloca aquí tu API key de setlist.fm
    const apiUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artistName)}&p=${page}`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'x-api-key': apiKey,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Setlist.fm API responded with status ${response.status}`);
        }

        const data = await response.json();
        res.json(data); // Enviar los datos al frontend
    } catch (error) {
        console.error('Error al obtener los setlists:', error);
        res.status(500).send('Error al obtener los setlists');
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
