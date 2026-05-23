// api.js

const POPULAR_ARTISTS = [
    'ONDA ANDAR','CUPSIZE','тёмный принц','madk1d','dope17','maptov','FACE','dabbackwood',
    'Alex G','FORTUNA 812','auratoshi','Anonymoud Ember','sorrow','whitek3d','rizza',
    'MORGENSHTERN','akkiemi','королевский XVII','3umph','СЕРЕГА ПИРАТ','shadowraze',
    'AQUAKEY','ПОШЛАЯ МОЛЛИ','платина','tewiq','zxcursed','vohley','Lil Peep',
    'Три Дня Дождя','голодный','fleurnothappy','wifiskeleton','Раковая Выхухоль',
    'emoslut666','killaheelz','формула','Garcon Maigre','@suffocated','gothicadeath',
    'Full Smena','whyspurky','SEMATARY','ARLEKIN 40 000','aphextwin','Big Baby Tape',
    'Baby Melo','code10','code80','crystal castles','chief keef','Drake',
    'dj trippie flameboy','FRIENDLY THUG 52 NGG','gothviolence','h4teboy','Juice WRLD',
    'Radiohead','Rebzyyx','tuborosho','Toxi$','Travis Scott','YUNG TRAPPA','uglystephan',
    'ICEGERGERT','OG Buda','Oxxxymiron','Odetari','PHARAOH','playboicarti','2hollis',
    'kizaru','Kanye West','KSB music','LAZZY2WICE','LINKIN PARK','XXXTENTACION',
    'xxxmanera','xaviersobased','Nirvana','MACAN'
];

async function invokeCommand(name, args = {}) {
    const { invoke } = window.__TAURI__.core;
    return await invoke(name, args);
}

async function searchTracks(q, offset = 0, limit = 20) {
    const data = await invokeCommand('search_tracks', { query: q, limit, offset });
    return Array.isArray(data?.collection) ? data.collection : [];
}

async function searchTracksWithMeta(q, offset = 0, limit = 20) {
    const data = await invokeCommand('search_tracks', { query: q, limit, offset });
    return {
        collection: Array.isArray(data?.collection) ? data.collection : [],
        total_results: data?.total_results || 0
    };
}

async function searchPlaylists(q, offset = 0, limit = 10) {
    const data = await invokeCommand('search_playlists', { query: q, limit, offset });
    return Array.isArray(data?.collection) ? data.collection : [];
}

async function searchPlaylistsWithMeta(q, offset = 0, limit = 10) {
    const data = await invokeCommand('search_playlists', { query: q, limit, offset });
    return {
        collection: Array.isArray(data?.collection) ? data.collection : [],
        total_results: data?.total_results || 0
    };
}

async function searchUsers(q, offset = 0, limit = 50) {
    return await searchTracks(q, offset, limit);
}

async function getUserTracks(uid) {
    const data = await invokeCommand('get_user_tracks', { userId: String(uid) });
    return Array.isArray(data?.collection) ? data.collection : (Array.isArray(data) ? data : []);
}

async function getPlaylistTracksFull(pid) {
    const data = await invokeCommand('get_playlist_tracks', { urlOrId: String(pid) });
    const tracks = Array.isArray(data?.tracks) ? data.tracks : (Array.isArray(data) ? data : []);
    return tracks.filter(t => t?.title && t.title !== 'Без названия');
}

async function getPopular(limit = 60) {
    const shuffled = [...POPULAR_ARTISTS].sort(() => Math.random() - 0.5).slice(0, 15);
    const data = await invokeCommand('get_popular', { artists: shuffled });
    const tracks = Array.isArray(data) ? data : [];
    return tracks.sort(() => Math.random() - 0.5).slice(0, limit);
}

async function getMyWave(hist) {
    if (!hist?.length) return null;
    const recentTracks = Array.isArray(hist) ? hist.slice(0, 10) : [];
    const recentArtists = [...new Set(recentTracks.map(t => t.user?.username).filter(Boolean))];
    const data = await invokeCommand('get_my_wave', { historyArtists: recentArtists });
    return Array.isArray(data) ? data : [];
}

async function getRelatedTracks(src, limit = 20) {
    if (!src?.length) return [];
    const artists = [...new Set(src.map(t => t.user?.username).filter(Boolean))];
    const result = [];
    const seen = new Set();
    for (let artist of artists.slice(0, 5)) {
        const tracks = await searchTracks(artist, 0, 10);
        for (let t of tracks) {
            if (t?.id && !seen.has(t.id) && (t.duration || 0) > 30000) {
                seen.add(t.id);
                result.push(t);
            }
        }
        if (result.length >= limit) break;
    }
    return result.sort(() => Math.random() - 0.5).slice(0, limit);
}

window.SoundCloudAPI = {
    searchTracks,
    searchTracksWithMeta,
    searchPlaylists,
    searchPlaylistsWithMeta,
    searchUsers,
    getUserTracks,
    getPopular,
    getMyWave,
    getRelatedTracks,
    getPlaylistTracks: getPlaylistTracksFull,
    getPlaylistTracksFull
};

console.log('✅ api.js');