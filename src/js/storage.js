// storage.js
const KEYS = {
    FAVORITES: 'cw_favorites',
    HISTORY: 'cw_history',
    PLAYLISTS: 'cw_playlists',
    VOLUME: 'cw_volume',
};

function load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; }
    catch { return def; }
}

function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}



window.favorites = load(KEYS.FAVORITES, []);
window.historyTracks = load(KEYS.HISTORY, []);
window.playlists = load(KEYS.PLAYLISTS, []);

window.StorageAPI = {
    isFavorite: (track) => window.favorites.some(t => t.id === track.id),
        toggleFavorite: (track) => {
        if (!track || !track.id) {
            console.warn('StorageAPI.toggleFavorite: невалидный трек', track);
            return false;
        }
        
        const idx = window.favorites.findIndex(t => t.id === track.id);
        let added = false;
        
        if (idx > -1) {
            window.favorites.splice(idx, 1);
            added = false;
        } else {
            window.favorites.unshift(track);
            added = true;
        }
        
        save(KEYS.FAVORITES, window.favorites);
        document.dispatchEvent(new CustomEvent('favUpdated'));
        
        console.log('Favorites updated:', window.favorites.length, 'tracks');
        return added;
    },
    addToHistory: (track) => {
        window.historyTracks = window.historyTracks.filter(t => t.id !== track.id);
        window.historyTracks.unshift(track);
        if (window.historyTracks.length > 100) window.historyTracks.pop();
        save(KEYS.HISTORY, window.historyTracks);
    },
    createPlaylist: (name) => {
        const pl = { id: Date.now().toString(), name, tracks: [], createdAt: Date.now() };
        window.playlists.unshift(pl);
        save(KEYS.PLAYLISTS, window.playlists);
        window.updateSidebarPlaylists?.();
        return pl;
    },
    deletePlaylist: (id) => {
        window.playlists = window.playlists.filter(p => p.id !== id);
        save(KEYS.PLAYLISTS, window.playlists);
        window.updateSidebarPlaylists?.();
    },
    addToPlaylist: (playlistId, track) => {
        const pl = window.playlists.find(p => p.id === playlistId);
        if (!pl || pl.tracks.some(t => t.id === track.id)) return false;
        pl.tracks.unshift(track);
        save(KEYS.PLAYLISTS, window.playlists);
        return true;
    },
    setPlaylists: (pls) => {
        window.playlists = pls;
        save(KEYS.PLAYLISTS, window.playlists);
    },
    getVolume: () => load(KEYS.VOLUME, 80),
    setVolume: (v) => save(KEYS.VOLUME, v)
};

console.log('✅ storage.js');