let page = 1;  // Página inicial
let accumulatedSetlists = [];  // Almacena todos los setlists obtenidos
const maxPages = 15;  // Límite máximo de páginas que se solicitarán
const clientId = '8749c418601e476f87f34d6e84e94ba9';  // Incluyendo el clientId directamente

document.getElementById('loginSpotify').addEventListener('click', function() {
    redirectToSpotifyAuth();
});

document.getElementById('setlistForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const bandName = document.getElementById('bandName').value;
    page = 1;  // Resetear la página al iniciar una nueva búsqueda
    accumulatedSetlists = [];  // Reiniciar la acumulación de setlists
    console.log(`Buscando setlists para la banda: ${bandName}`);
    fetchSetlists(bandName);
});

document.getElementById('exportPlaylist').addEventListener('click', function() {
    const token = getSpotifyAccessToken();
    const bandName = document.getElementById('bandName').value;  // Obtener nombre de la banda
    if (token) {
        const commonSongs = JSON.parse(localStorage.getItem('commonSongs'));
        if (commonSongs && commonSongs.length > 0) {
            console.log('Exportando playlist a Spotify con las siguientes canciones:', commonSongs);
            createPlaylist(token, `${bandName} Setlist Playlist`, commonSongs, bandName);
        } else {
            alert("Debes obtener las canciones comunes primero.");
        }
    } else {
        alert("Debes iniciar sesión en Spotify primero.");
    }
});

function redirectToSpotifyAuth() {
    const redirectUri = window.location.origin + window.location.pathname; // URI actual sin hash
    const scope = 'user-read-private playlist-modify-public';  // Permiso para obtener datos del usuario y modificar playlists

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
}

function getSpotifyAccessToken() {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
        return hash.substring(1).split('&').find(elem => elem.startsWith('access_token')).split('=')[1];
    }
    return null;
}

// Después de iniciar sesión, sustituimos el botón de login por la foto y el nombre del usuario
window.addEventListener('load', () => {
    const token = getSpotifyAccessToken();
    if (token) {
        fetchUserProfile(token);
    }
});

function fetchUserProfile(token) {
    fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(user => {
        const userInfo = document.getElementById('userInfo');
        userInfo.innerHTML = `
            <img src="${user.images[0]?.url || 'default-avatar.png'}" alt="User Image">
            <span>${user.display_name}</span>
        `;
        document.getElementById('exportPlaylist').disabled = false;  // Habilitar exportar playlist
    })
    .catch(error => console.error('Error fetching user profile:', error));
}

function fetchSetlists(bandName) {
    if (page > maxPages) {
        console.log(`Se alcanzó el límite máximo de páginas (${maxPages}).`);
        alert("No se encontraron suficientes canciones comunes después de revisar muchos setlists.");
        const topSongs = getTopSongs(accumulatedSetlists);
        if (topSongs.length > 0) {
            localStorage.setItem('commonSongs', JSON.stringify(topSongs));
            displayCommonSongs(topSongs, true);  // Indicar que son las top canciones
        } else {
            document.getElementById('setlistResult').innerHTML = `<p>No se encontraron suficientes canciones.</p>`;
        }
        return;
    }

    const url = `http://localhost:3000/setlist?artistName=${encodeURIComponent(bandName)}&p=${page}`;
    console.log(`Llamando a la API de Setlist.fm: ${url}`);

    fetch(url)
    .then(response => {
        if (!response.ok) {
            console.warn(`Error en la respuesta de la API de Setlist.fm: ${response.status}. Continuando con la siguiente página...`);
            throw new Error(`Error en la respuesta de la API con código de estado: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(`Setlists obtenidos en la página ${page}:`, data.setlist);
        accumulatedSetlists = accumulatedSetlists.concat(data.setlist);  // Acumular setlists
        console.log(`Total de setlists acumulados: ${accumulatedSetlists.length}`);

        const { commonSongs, songCounts } = findCommonSongs(accumulatedSetlists);
        console.log(`Canciones comunes encontradas hasta ahora: ${commonSongs.length}`, commonSongs);

        // Si hay menos de 10 canciones comunes, seguir solicitando más setlists
        if (commonSongs.length < 10 && data.setlist.length > 0) {
            page++;  // Incrementar página para la próxima solicitud
            console.log(`Menos de 10 canciones comunes, solicitando más setlists. Página actual: ${page}`);
            fetchSetlists(bandName);  // Solicitar más setlists
        } else {
            if (commonSongs.length >= 10) {
                console.log(`Suficientes canciones comunes encontradas (>=10).`, commonSongs);
                localStorage.setItem('commonSongs', JSON.stringify(commonSongs));  // Guardar canciones comunes
                displayCommonSongs(commonSongs, false);  // Mostrar canciones comunes
            } else {
                // Obtener top 10 canciones más repetidas
                const topSongs = getTopSongs(accumulatedSetlists);
                if (topSongs.length > 0) {
                    console.log(`Top 10 canciones más repetidas:`, topSongs);
                    localStorage.setItem('commonSongs', JSON.stringify(topSongs));  // Guardar top canciones
                    displayCommonSongs(topSongs, true);  // Mostrar top canciones
                } else {
                    alert("No se encontraron suficientes canciones comunes.");
                }
            }
        }
    })
    .catch(error => {
        console.warn(`Error al obtener setlists: ${error.message}. Continuando con la siguiente página...`);
        page++;  // Continuar con la siguiente página si ocurre un error
        fetchSetlists(bandName);  // Reintentar la siguiente página
    });
}

function findCommonSongs(setlists) {
    const songCounts = {};
    let validSetlistCount = 0;

    setlists.forEach(setlist => {
        if (setlist.sets && setlist.sets.set && setlist.sets.set.length > 0) {
            let hasSongs = false;
            setlist.sets.set.forEach(set => {
                if (set.song && set.song.length > 0) {
                    hasSongs = true;
                    set.song.forEach(song => {
                        const songName = song.name.trim().toLowerCase();
                        if (songCounts[songName]) {
                            songCounts[songName]++;
                        } else {
                            songCounts[songName] = 1;
                        }
                    });
                }
            });
            if (hasSongs) {
                validSetlistCount++;
            }
        }
    });

    const commonSongs = [];
    for (const song in songCounts) {
        if (songCounts[song] >= validSetlistCount / 2) {
            commonSongs.push(song);
        }
    }

    return { commonSongs, songCounts };
}

function getTopSongs(setlists) {
    const songCounts = {};
    setlists.forEach(setlist => {
        if (setlist.sets && setlist.sets.set && setlist.sets.set.length > 0) {
            setlist.sets.set.forEach(set => {
                if (set.song && set.song.length > 0) {
                    set.song.forEach(song => {
                        const songName = song.name.trim().toLowerCase();
                        if (songCounts[songName]) {
                            songCounts[songName]++;
                        } else {
                            songCounts[songName] = 1;
                        }
                    });
                }
            });
        }
    });

    // Convertir el objeto de conteo a un array y ordenar por cantidad descendente
    const sortedSongs = Object.entries(songCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

    // Tomar las primeras 10 canciones
    return sortedSongs.slice(0, 10);
}

function displayCommonSongs(songs, isTopSongs) {
    const setlistResult = document.getElementById('setlistResult');
    setlistResult.innerHTML = isTopSongs ? '<h3>Top 10 Canciones Más Repetidas:</h3>' : '<h3>Canciones Comunes:</h3>';
    
    const ul = document.createElement('ul');
    
    songs.forEach(song => {
        const li = document.createElement('li');
        li.textContent = capitalizeSongName(song);
        ul.appendChild(li);
    });

    setlistResult.appendChild(ul);
    document.getElementById('exportPlaylist').disabled = false;  // Habilitar exportar playlist
}

function capitalizeSongName(songName) {
    return songName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// MODIFICADO: Añadir el nombre del artista en la búsqueda de canciones
function createPlaylist(token, playlistName, songs, bandName) {
    fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const userId = data.id;

        const url = `https://api.spotify.com/v1/users/${userId}/playlists`;

        fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: playlistName,
                description: 'Playlist creada automáticamente desde setlists',
                public: true
            })
        })
        .then(response => response.json())
        .then(data => {
            const playlistId = data.id;

            // Buscar y añadir canciones, incluyendo el nombre del artista en la búsqueda
            Promise.all(songs.map(song => searchSong(token, song, bandName)))
                .then(uris => {
                    const trackUris = uris.filter(uri => uri !== null);
                    addTracksToPlaylist(token, playlistId, trackUris);
                });
        })
        .catch(error => console.error('Error al crear la playlist:', error));
    })
    .catch(error => console.error('Error al obtener información del usuario:', error));
}

// MODIFICADO: Añadir el nombre de la banda en la búsqueda de canciones en Spotify
function searchSong(token, songName, bandName) {
    const query = `${encodeURIComponent(songName)} artist:${encodeURIComponent(bandName)}`;
    const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

    return fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.tracks.items.length > 0) {
            return data.tracks.items[0].uri;
        } else {
            console.log(`No se encontró la canción: ${songName} de ${bandName}`);
            return null;
        }
    })
    .catch(error => {
        console.error(`Error al buscar la canción "${songName}" de "${bandName}":`, error);
        return null;
    });
}

function addTracksToPlaylist(token, playlistId, trackUris) {
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

    fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uris: trackUris
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Canciones añadidas exitosamente a la playlist.');
        alert("Playlist creada exitosamente en Spotify.");
    })
    .catch(error => {
        console.error('Error al añadir canciones:', error);
        alert("Hubo un error al añadir las canciones a la playlist.");
    });
}
