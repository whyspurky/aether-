// cache.js

const DB_NAME = 'aether_cache';
const DB_VERSION = 1;
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('audio')) {
                db.createObjectStore('audio', { keyPath: 'trackId' });
            }
            if (!db.objectStoreNames.contains('covers')) {
                db.createObjectStore('covers', { keyPath: 'url' });
            }
        };
        request.onsuccess = function(e) {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = function(e) {
            console.error('IndexedDB error:', e);
            reject(e);
        };
    });
}

async function cacheTrack(track) {
    if (!track?.id) return false;
    await openDB();
    
    const existing = await getCachedAudio(track.id);
    if (existing) return true;
    
    try {
        const { invoke } = window.__TAURI__.core;
        const fullTrack = await invoke('get_track_info', { url: `https://api-v2.soundcloud.com/tracks/${track.id}` });
        
        if (!fullTrack?.media?.transcodings) {
            console.warn('Нет transcodings для:', track.title);
            return false;
        }
        
        const mp3Transcoding = fullTrack.media.transcodings.find(t => 
            t.format?.protocol === 'progressive' && t.format?.mime_type === 'audio/mpeg'
        );
        
        if (!mp3Transcoding) {
            console.warn('Нет MP3 потока для:', track.title);
            return false;
        }
        
        let streamUrl = mp3Transcoding.url;
        if (!streamUrl.includes('client_id')) {
            streamUrl += (streamUrl.includes('?') ? '&' : '?') + 'client_id=' + CLIENT_ID;
        }
        
        const streamData = await invoke('fetch_json', { url: streamUrl });
        const finalUrl = streamData?.url;
        
        if (!finalUrl) {
            console.warn('Нет финального URL для:', track.title);
            return false;
        }
        
        const response = await fetch(finalUrl);
        if (!response.ok) return false;
        const blob = await response.blob();
        
        if (!blob || blob.size < 10000) return false;
        
        const tx = db.transaction('audio', 'readwrite');
        const store = tx.objectStore('audio');
        store.put({ trackId: track.id, blob: blob, timestamp: Date.now() });
        
        console.log('Закэширован:', track.title, (blob.size / 1024 / 1024).toFixed(1) + 'MB');
        return true;
    } catch(e) {
        console.error('Ошибка кэширования:', e.message);
        return false;
    }
}


async function fetchAudioBlob(url) {
    try {
        const res = await fetch(url);
        if (res.ok) return await res.blob();
    } catch(e) {}
    
    for (const proxy of ['', 'https://corsproxy.io/?']) {
        try {
            const proxyUrl = proxy ? proxy + encodeURIComponent(url) : url;
            const res = await fetch(proxyUrl);
            if (res.ok) return await res.blob();
        } catch(e) {
            continue;
        }
    }
    
    return null;
}

async function getCachedAudio(trackId) {
    await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction('audio', 'readonly');
        const store = tx.objectStore('audio');
        const request = store.get(trackId);
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => resolve(null);
    });
}

async function isCached(trackId) {
    const audio = await getCachedAudio(trackId);
    return !!audio;
}

async function cachePlaylist(playlistId) {
    const tracks = await window.SoundCloudAPI.getPlaylistTracksFull(playlistId, 500);
    let cached = 0;
    for (const track of tracks) {
        const ok = await cacheTrack(track);
        if (ok) cached++;
    }
    return cached;
}

async function getCachedCover(url) {
    if (!url) return null;
    await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction('covers', 'readonly');
        const store = tx.objectStore('covers');
        const request = store.get(url);
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => resolve(null);
    });
}

async function removeCachedTrack(trackId) {
    await openDB();
    const tx = db.transaction('audio', 'readwrite');
    tx.objectStore('audio').delete(trackId);
}

async function getCacheSize() {
    await openDB();
    let totalSize = 0;
    
    const audioTx = db.transaction('audio', 'readonly');
    const audioStore = audioTx.objectStore('audio');
    const audioRequest = audioStore.getAll();
    audioRequest.onsuccess = () => {
        for (const item of audioRequest.result) {
            totalSize += item.blob?.size || 0;
        }
    };
    
    return new Promise((resolve) => {
        audioRequest.oncomplete = () => resolve(totalSize);
        setTimeout(() => resolve(totalSize), 500);
    });
}


if (typeof window.__TAURI__ !== 'undefined') {
    window.addEventListener('beforeunload', async () => {
        if (db) {
            db.close();
            db = null;
        }
    });
}

async function cleanOldCache(maxAgeDays = 7) {
    await openDB();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    const audioTx = db.transaction('audio', 'readwrite');
    const audioStore = audioTx.objectStore('audio');
    const audioRequest = audioStore.getAll();
    
    audioRequest.onsuccess = () => {
        for (const item of audioRequest.result) {
            if (now - item.timestamp > maxAge) {
                audioStore.delete(item.trackId);
                console.log('Удален устаревший кэш:', item.trackId);
            }
        }
    };
}

setTimeout(() => cleanOldCache(7), 5000);

window.cleanOldCache = cleanOldCache;
window.cacheTrack = cacheTrack;
window.isCached = isCached;
window.cachePlaylist = cachePlaylist;
window.getCachedAudio = getCachedAudio;
window.getCachedCover = getCachedCover;
window.removeCachedTrack = removeCachedTrack;
window.getCacheSize = getCacheSize;

console.log('✅ cache.js');