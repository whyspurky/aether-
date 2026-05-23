// main.js

window.AetherState = {
    search: {
        tracksOffset: 0,
        playlistsOffset: 0,
        artistsOffset: 0,
        query: '',
        filter: 'tracks',
        isLoading: false,
        hasMore: true,
        tracksList: [],
        playlistsList: [],
        artistsList: []
    },
    popular: {
        offset: 0,
        tracksList: [],
        isLoading: false
    },
    current: {
        playlistTracks: [],
        playlistSource: '',
        playlistData: null,
        libraryPlaylist: null
    },
    ui: {
        editingPlaylist: false,
        currentPlaylistPage: null
    }
};

var st = window.AetherState.search;
var pop = window.AetherState.popular;
var cur = window.AetherState.current;
var ui = window.AetherState.ui;

window.currentTracksList = [];
window.currentTrack = null;

async function invokeCommand(name, args = {}) {
    const { invoke } = window.__TAURI__.core;
    return await invoke(name, args);
}

function fixLibraryHeight() {
    var pv = document.getElementById('lib-playlist-view');
    var es = document.getElementById('lib-empty-state');
    var ts = document.getElementById('lib-pl-tracks-scroll');
    var bar = document.getElementById('player-bar');
    var libraryLayout = document.querySelector('.library-layout');
    
    if (!libraryLayout) return;
    
    var barHeight = (bar && bar.classList.contains('show')) ? bar.offsetHeight + 20 : 36;
    var rect = libraryLayout.getBoundingClientRect();
    var availableHeight = window.innerHeight - rect.top - barHeight;
    
    if (pv && pv.style.display !== 'none') {
        pv.style.maxHeight = availableHeight + 'px';
        pv.style.minHeight = availableHeight + 'px';
        pv.style.height = availableHeight + 'px';
        pv.style.overflow = 'hidden';
        
        if (ts) {
            ts.style.maxHeight = (availableHeight - 80) + 'px';
            ts.style.height = (availableHeight - 80) + 'px';
            ts.style.overflowY = 'auto';
        }
    }
    
    if (es && es.style.display !== 'none') {
        es.style.minHeight = availableHeight + 'px';
        es.style.height = availableHeight + 'px';
    }
}
window.fixLibraryHeight = fixLibraryHeight;

var playerBarObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'class') {
        window.fixLibraryHeight();
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    var bar = document.getElementById('player-bar');
    if (bar) {
        playerBarObserver.observe(bar, { attributes: true, attributeFilter: ['class'] });
    }
});


function refreshFavoritesAfterChange(track, wasRemoved) {
    refreshLibraryAfterChange({ id: 'favorites', tracks: window.favorites || [] }, track, wasRemoved);
    var fc = document.getElementById('fav-count');
    if (fc) fc.textContent = (window.favorites || []).length + ' треков';
    var lfc = document.getElementById('lib-fav-count');
    if (lfc) lfc.textContent = (window.favorites || []).length + ' треков';
}
window.refreshFavoritesAfterChange = refreshFavoritesAfterChange;

function showHistoryInLibrary() {
    var es = document.getElementById('lib-empty-state'), pv = document.getElementById('lib-playlist-view');
    if (es) es.style.display = 'none';
    if (pv) {
        pv.style.display = 'flex';
        var bar = document.getElementById('player-bar');
        var barHeight = (bar && bar.classList.contains('show')) ? bar.offsetHeight + 20 : 36;
        var libraryLayout = document.querySelector('.library-layout');
        if (libraryLayout) {
            var rect = libraryLayout.getBoundingClientRect();
            var availableHeight = window.innerHeight - rect.top - barHeight;
            pv.style.maxHeight = availableHeight + 'px';
            pv.style.minHeight = availableHeight + 'px';
            pv.style.height = availableHeight + 'px';
            pv.style.overflow = 'hidden';
            
            var ts = document.getElementById('lib-pl-tracks-scroll');
            if (ts) {
                ts.style.maxHeight = (availableHeight - 80) + 'px';
                ts.style.height = (availableHeight - 80) + 'px';
                ts.style.overflowY = 'auto';
            }
        }
    }
    
    window._currentLibraryPlaylist = { id: 'history', tracks: window.historyTracks || [] };
    cur.libraryPlaylist = window._currentLibraryPlaylist;
    
    document.getElementById('lib-pl-name').textContent = 'История';
    document.getElementById('lib-pl-track-count').textContent = (window.historyTracks || []).length + ' треков';
    var pc = document.getElementById('lib-pl-cover');
    if (pc) pc.style.display = 'none';
    var pp = document.getElementById('lib-pl-cover-placeholder');
    if (pp) {
        pp.style.display = '';
        var is = pp.querySelector('.cw-icon');
        if (is) is.innerHTML = window.cwIconHTML('library');
    }
    var tc = document.getElementById('lib-pl-tracks');
    if (tc) {
        if (tc && (!tc.children.length || tc.children.length !== (window.historyTracks || []).length)) {
            tc.innerHTML = '';
            window.renderList(window.historyTracks || [], tc, { queue: window.historyTracks || [] });
        }
    }
    var ts = document.getElementById('lib-pl-tracks-scroll');
    if (ts) ts.scrollTop = 0;
    
    window.fixLibraryHeight()
}
window.showHistoryInLibrary = showHistoryInLibrary;

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
    var page = document.getElementById('page-' + id);
    if (page) { page.style.display = 'block'; page.classList.add('active'); }
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    var nav = document.querySelector('.nav-item[data-page="' + id + '"]');
    if (nav) nav.classList.add('active');
    if (id === 'library') {
        window.renderPlaylists();
        window.fixLibraryHeight()
    }
    if (id === 'history') window.renderHistory();
    if (id !== 'player') {
        var bar = document.getElementById('player-bar');
        if (bar) bar.classList.remove('hide-mini');
    }
}
window.showPage = showPage;

function setFilter(f) {
    st.filter = f;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    if (f === 'tracks' && st.tracksList.length) renderSearchResults();
    else if (f === 'playlists' && st.playlistsList.length) renderSearchResults();
    else if (f === 'artists' && st.artistsList.length) renderSearchResults();
    else if (st.query.trim()) doSearch(st.query, false);
}

async function renderSearchResults() {
    var c = document.getElementById('search-results');
    if (!c) return;
    c.innerHTML = '';
    if (st.filter === 'tracks') {
        if (!st.tracksList.length) {
            c.innerHTML = '<div class="empty-state"><div class="empty-icon">' + window.cwIconHTML('music', 'empty-svg-icon') + '</div><h3>Треки не найдены</h3><p>Попробуйте другой запрос</p></div>';
            return;
        }
        window.renderList(st.tracksList, c, { queue: st.tracksList });
    } else if (st.filter === 'playlists') {
        if (!st.playlistsList.length) {
            c.innerHTML = '<div class="empty-state"><div class="empty-icon">' + window.cwIconHTML('folder', 'empty-svg-icon') + '</div><h3>Плейлисты не найдены</h3><p>Попробуйте другой запрос</p></div>';
            return;
        }
        renderSearchPlaylists(st.playlistsList, c);
    } else if (st.filter === 'artists') {
        if (!st.artistsList.length) {
            c.innerHTML = '<div class="empty-state"><div class="empty-icon">' + window.cwIconHTML('mic', 'empty-svg-icon') + '</div><h3>Артисты не найдены</h3><p>Попробуйте другой запрос</p></div>';
            return;
        }
        renderArtists(st.artistsList, c);
    }
}
async function doSearch(q, reset = false) {
    if (!q.trim()) return;
    var c = document.getElementById('search-results');
    if (!c) return;
    if (reset) {
        st.tracksOffset = st.playlistsOffset = st.artistsOffset = 0;
        st.hasMore = true;
        st.tracksList = st.playlistsList = st.artistsList = [];
        st.query = q.trim();
    }
    if (st.isLoading || !st.hasMore) return;
    st.isLoading = true;
    if (reset) window.showSkeletons(c, 8);
    try {
        if (st.filter === 'tracks') {
            var tracks = await window.SoundCloudAPI.searchTracks(st.query, st.tracksOffset, 20);
            var ids = new Set(st.tracksList.map(t => t.id));
            var nt = tracks.filter(t => t && t.id && !ids.has(t.id));
            st.tracksList = [...st.tracksList, ...nt];
            st.tracksOffset += tracks.length;
            st.hasMore = tracks.length === 20;
            if (reset) {
                renderSearchResults();
                cur.playlistTracks = st.tracksList;
                cur.playlistSource = '🔍 ' + st.query;
            } else {
                nt.forEach((t, i) => {
                    c.appendChild(createTrackItem(t, st.tracksList, { index: st.tracksList.length - nt.length + i }));
                });
            }
} else if (st.filter === 'playlists') {
    var result = await window.SoundCloudAPI.searchPlaylistsWithMeta(st.query, st.playlistsOffset, 20);
    var pls = result.collection;
    var pids = new Set(st.playlistsList.map(p => p.id));
    var np = pls.filter(p => p && p.id && !pids.has(p.id));
    st.playlistsList = [...st.playlistsList, ...np];
    st.playlistsOffset += np.length;
    st.hasMore = np.length > 0 && st.playlistsOffset < result.total_results;
    if (reset) {
        renderSearchResults();
        cur.playlistTracks = st.tracksList;
        cur.playlistSource = '🔍 ' + st.query;
    } else {
        renderSearchPlaylistsAppend(np, c);
    }
} else if (st.filter === 'artists') {
            var users = await window.SoundCloudAPI.searchUsers(st.query, st.artistsOffset, 50);
            var uids = new Set(st.artistsList.map(u => u.id));
            var nu = users.filter(u => u && u.id && !uids.has(u.id));
            st.artistsList = [...st.artistsList, ...nu];
            st.artistsOffset += users.length;
            st.hasMore = users.length === 50;
            if (reset) {
                renderSearchResults();
                cur.playlistTracks = st.playlistsList;
                cur.playlistSource = '🔍 ' + st.query;
            } else {
                renderArtistsAppend(nu, c);
            }
        }
    } catch (e) {
        if (reset) c.innerHTML = '<div class="empty-state"><div class="empty-icon">' + window.cwIconHTML('alert-circle', 'empty-svg-icon') + '</div><h3>Ошибка поиска</h3><p>Проверьте интернет-соединение</p></div>';
    } finally {
        st.isLoading = false;
    }
}

function renderArtistsAppend(users, c) {
    var g = c.querySelector('.artist-grid');
    if (!g) { g = document.createElement('div'); g.className = 'artist-grid'; c.appendChild(g); }
    users.forEach((u, i) => g.appendChild(createArtistCard(u, i)));
}
function renderArtists(users, c) {
    c.innerHTML = '';
    if (!users.length) {
        c.innerHTML = '<div class="empty-state"><div class="empty-icon">' + window.cwIconHTML('mic', 'empty-svg-icon') + '</div><h3>Артисты не найдены</h3><p>Попробуйте другой запрос</p></div>';
        return;
    }
    var g = document.createElement('div');
    g.className = 'artist-grid';
    users.forEach((u, i) => g.appendChild(createArtistCard(u, i)));
    c.appendChild(g);
}

function createPlaylistItem(pl, i) {
    var card = document.createElement('div');
    card.className = 'track-item';
    card.style.animationDelay = (i * 0.03) + 's';
    var img = pl.artwork_url?.replace('-large', '-t300x300') || '';
    var imgHTML = img
        ? '<img class="track-cover" src="' + img + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'"><div class="track-cover-placeholder" style="display:none;">' + window.cwIconHTML('music') + '</div>'
        : '<div class="track-cover-placeholder">' + window.cwIconHTML('music') + '</div>';
    card.innerHTML = '<div class="track-num">' + window.cwIconHTML('folder') + '</div><div class="track-playing-bars"><span></span><span></span><span></span></div>' + imgHTML +
        '<div class="track-info"><h3>' + (pl.title || 'Плейлист') + '</h3><p>' + (pl.user?.username || '') + ' • ' + (pl.track_count || 0) + ' треков</p></div>' +
        '<div class="track-actions"><button class="track-action-btn save-pl" title="Сохранить">' + window.cwIconHTML('save') + '</button></div>';
    var ci = card.querySelector('.track-cover'), ph = card.querySelector('.track-cover-placeholder');
    if (ci && ph && img) ci.addEventListener('load', () => { ci.style.display = ''; ph.style.display = 'none'; });
    card.querySelector('.save-pl')?.addEventListener('click', async e => { e.stopPropagation(); await saveSCPlaylist(pl); });
    card.addEventListener('click', e => { if (e.target.closest('.track-actions')) return; showSCPlaylistPage(pl); });
    return card;
}
function renderSearchPlaylists(pls, c) {
    c.innerHTML = '';
    if (!pls.length) {
        c.innerHTML = '<div class="empty-state"><div class="empty-icon">' + window.cwIconHTML('folder', 'empty-svg-icon') + '</div><h3>Плейлисты не найдены</h3><p>Попробуйте другой запрос</p></div>';
        return;
    }
    pls.forEach((pl, i) => c.appendChild(createPlaylistItem(pl, i)));
}
function renderSearchPlaylistsAppend(pls, c) {
    pls.forEach(pl => c.appendChild(createPlaylistItem(pl, 0)));
}
function createArtistCard(u, i) {
    var card = document.createElement('div');
    card.className = 'artist-card';
    card.style.animationDelay = (i * 0.02) + 's';
    card.innerHTML = '<img class="artist-avatar" src="' + (u.avatar_url?.replace('-large', '-t300x300') || '') + '" alt="" loading="lazy"><h4>' + (u.username || 'Неизвестный') + '</h4><p>' + (u.followers_count || 0).toLocaleString() + ' фолловеров</p>';
    card.addEventListener('click', () => showArtistPage(u));
    return card;
}

function setupArtistAvatar(img, ph, url, iconName) {
    if (!ph) {
        ph = document.createElement('div');
        ph.id = 'artist-avatar-placeholder';
        ph.className = 'artist-page-avatar-placeholder';
        ph.innerHTML = window.cwIconHTML(iconName || 'mic');
        img.parentNode.insertBefore(ph, img.nextSibling);
    }
    img.className = 'artist-page-avatar';
    ph.style.display = 'none';
    if (url) {
        img.src = url;
        img.style.display = '';
        img.onload = () => { img.style.display = ''; ph.style.display = 'none'; };
        img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
    } else {
        img.style.display = 'none';
        ph.style.display = 'flex';
    }
    return ph;
}

async function showArtistPage(artist) {
    var page = document.getElementById('page-artist');
    if (!page) return;
    var img = page.querySelector('#artist-avatar'), ph = page.querySelector('#artist-avatar-placeholder');
    setupArtistAvatar(img, ph, artist.avatar_url?.replace('-large', '-t300x300') || '', 'mic');
    page.querySelector('#artist-name').textContent = artist.username;
    page.querySelector('#artist-meta').textContent = (artist.followers_count || 0).toLocaleString() + ' фолловеров';
    showPage('artist');
    var btns = document.getElementById('artist-page-btns');
    if (btns) btns.style.display = 'flex';
    var sb = document.getElementById('artist-save-btn');
    if (sb) sb.style.display = 'none';
    var c = page.querySelector('#artist-tracks');
    window.showSkeletons(c, 8);
    var tracks = await window.SoundCloudAPI.getUserTracks(artist.id);
    cur.playlistTracks = tracks;
    cur.playlistSource = '🎤 ' + (artist.username || 'Артист');
    window.renderList(tracks, c, { queue: tracks });
}

async function showSCPlaylistPage(pl) {
    var page = document.getElementById('page-artist');
    if (!page) return;
    var img = page.querySelector('#artist-avatar'), ph = page.querySelector('#artist-avatar-placeholder');
    setupArtistAvatar(img, ph, pl.artwork_url?.replace('-large', '-t500x500') || '', 'music');
    img.className = 'artist-page-avatar playlist-cover';
    page.querySelector('#artist-name').textContent = pl.title || 'Плейлист';
    page.querySelector('#artist-meta').textContent = 'Загрузка...';
    showPage('artist');
    var btns = document.getElementById('artist-page-btns');
    if (btns) btns.style.display = 'flex';
    var sb = document.getElementById('artist-save-btn');
    if (sb) sb.style.display = '';
    cur.playlistData = pl;
    var c = page.querySelector('#artist-tracks');
    c.innerHTML = '';
    var tracks = await window.SoundCloudAPI.getPlaylistTracksFull(pl.id);
    var ready = [], pending = [];
    (tracks || []).forEach(t => {
        if (t?.title && t.title !== 'Без названия') ready.push(t);
        else if (t?.id) {
            pending.push(t.id);
            ready.push({ id: t.id, title: '...', user: { username: '...' }, duration: t.duration || 0, artwork_url: '', permalink_url: '', _pending: true });
        }
    });
    cur.playlistTracks = ready;
    cur.playlistSource = '📂 ' + (pl.title || 'Плейлист');
    window.renderList(ready, c, { queue: ready });
    page.querySelector('#artist-meta').textContent = ready.length + ' треков';
    if (pending.length) loadTracksInBackground(pending, c);
}

async function loadTracksInBackground(ids, c) {
    for (var i = 0; i < ids.length; i += 50) {
        var batch = ids.slice(i, i + 50);
        var results = await Promise.allSettled(
    batch.map(id => invokeCommand('get_user_tracks', { userId: id.toString() }))
);
        results.forEach((r, j) => {
            if (r.status === 'fulfilled' && r.value?.title) {
                var track = r.value, tid = batch[j];
                var el = c.querySelector('.track-item[data-track-id="' + tid + '"]');
                if (el) {
                    var ni = createTrackItem(track, cur.playlistTracks || [], { index: 0 });
                    el.parentNode.replaceChild(ni, el);
                }
                var pi = cur.playlistTracks?.findIndex(t => t.id == tid);
                if (pi !== -1) cur.playlistTracks[pi] = track;
                var qi = window.currentTracksList?.findIndex(t => t.id == tid);
                if (qi !== -1) window.currentTracksList[qi] = track;
            }
        });
        if (typeof updateQueueUI === 'function') updateQueueUI();
    }
}

async function saveSCPlaylist(scPl) {
    var pl = window.StorageAPI.createPlaylist(scPl.title || 'SC Плейлист');
    if (scPl.artwork_url) {
        pl.artwork_url = scPl.artwork_url;
        window.StorageAPI.setPlaylists(window.playlists);
    }
    window.showToast('Загрузка плейлиста...');
    var tracks = await window.SoundCloudAPI.getPlaylistTracksFull(scPl.id, 200);
    var valid = tracks.filter(t => t?.title && t.title !== 'Без названия' && t.streamable !== false && t.access !== 'blocked' && t.permalink_url);
    if (valid.length) {
        valid.reverse().forEach(t => window.StorageAPI.addToPlaylist(pl.id, t));
        window.renderPlaylists();
        window.updateSidebarPlaylists?.();
        window.showToast('Сохранено: ' + valid.length + ' треков');
    } else if (scPl.tracks?.length) {
        scPl.tracks.filter(t => t?.title).reverse().forEach(t => window.StorageAPI.addToPlaylist(pl.id, t));
        window.renderPlaylists();
        window.updateSidebarPlaylists?.();
        window.showToast('Сохранено: ' + scPl.tracks.length + ' треков');
    } else {
        window.showToast('Не удалось загрузить треки');
    }
}

function showPlaylistPage(pl) {
    ui.currentPlaylistPage = pl;
    var page = document.getElementById('page-playlist');
    if (!page) return;
    page.querySelector('#pl-page-name').textContent = pl.name;
    page.querySelector('#pl-page-count').textContent = (pl.tracks || []).length + ' треков';
    showPage('playlist');
    cur.playlistTracks = pl.tracks || [];
    cur.playlistSource = '📂 ' + pl.name;
    window.renderList(pl.tracks || [], page.querySelector('#pl-page-tracks'), { queue: pl.tracks || [], playlistId: pl.id });
}
window.showPlaylistPage = showPlaylistPage;

window.showCreatePlaylistModal = function() {
    var o = document.getElementById('modal-overlay'), i = document.getElementById('modal-pl-input'), b = document.getElementById('modal-create-btn');
    if (o && i) {
        i.value = '';
        if (b) b.disabled = true;
        o.classList.add('show');
        setTimeout(() => i.focus(), 200);
    }
};

async function loadMorePopular() {
    if (pop.isLoading) return;
    pop.isLoading = true;
    var pc = document.getElementById('popular-tracks');
    if (!pc) { pop.isLoading = false; return; }
    var nt = await window.SoundCloudAPI.getPopular(60);
    var ids = new Set(pop.tracksList.map(t => t.id));
    var uniq = nt.filter(t => t?.id && !ids.has(t.id));
    pop.tracksList = pop.tracksList.concat(uniq);
    cur.playlistTracks = pop.tracksList;
    uniq.forEach((t, i) => pc.appendChild(createTrackCard(t, pop.tracksList, pop.tracksList.length - uniq.length + i)));
    pop.isLoading = false;
}

function setupInfiniteScroll() {
    var timeout;
    function check() {
        if (timeout) return;
        timeout = setTimeout(() => {
            timeout = null;
            if (document.getElementById('page-home')?.classList.contains('active')) {
                var pc = document.getElementById('popular-tracks');
                if (pc && !pop.isLoading && pc.scrollLeft + pc.clientWidth > pc.scrollWidth * 0.8) loadMorePopular();
            }
            if (st.isLoading || !st.hasMore) return;
            if (!document.getElementById('page-search')?.classList.contains('active')) return;
            if (!st.query.trim()) return;
            var c = document.getElementById('search-results');
            if (!c) return;
            var items = c.querySelectorAll('.track-item, .artist-card');
            if (!items.length) return;
            var ti = items[Math.max(0, items.length - 13)];
            if (!ti) return;
            if (ti.getBoundingClientRect().top < window.innerHeight + 400) doSearch(st.query, false);
        }, 100);
    }
    var ct = document.querySelector('.content');
    if (ct) ct.addEventListener('scroll', check, { passive: true });
    window.addEventListener('scroll', check, { passive: true });
    document.querySelector('.main')?.addEventListener('scroll', check, { passive: true });
    var pc = document.getElementById('popular-tracks');
    if (pc) pc.addEventListener('scroll', check, { passive: true });
}

function renderPlaylists() {
    var col = document.getElementById('lib-playlists-column');
    if (!col) return;
    col.innerHTML = '';
    (window.playlists || []).forEach(pl => {
        var card = document.createElement('div');
        card.className = 'lib-pl-card';
        var cu = pl.artwork_url?.replace('-large', '-t300x300') || '';
        card.innerHTML = cu
            ? '<img class="lib-pl-card-cover" src="' + cu + '" alt="">'
            : '<div class="lib-pl-card-placeholder">' + window.cwIconHTML('music') + '</div>';
        card.addEventListener('click', () => showPlaylistInLibrary(pl));
        col.appendChild(card);
    });
}

function showPlaylistInLibrary(pl) {
    var es = document.getElementById('lib-empty-state'), pv = document.getElementById('lib-playlist-view'), tc = document.getElementById('lib-pl-tracks');
    if (!es || !pv || !tc) return;
    es.style.display = 'none';
    pv.style.display = 'flex';
    
    document.getElementById('lib-pl-name').textContent = pl.name;
    document.getElementById('lib-pl-track-count').textContent = (pl.tracks || []).length + ' треков';
    var cu = pl.artwork_url?.replace('-large', '-t300x300') || '';
    var pp = document.getElementById('lib-pl-cover-placeholder'), pc = document.getElementById('lib-pl-cover');
    if (cu && pc) {
        pc.src = cu;
        pc.style.display = '';
        if (pp) pp.style.display = 'none';
        pc.onerror = () => { pc.style.display = 'none'; if (pp) pp.style.display = ''; };
    } else {
        if (pc) pc.style.display = 'none';
        if (pp) pp.style.display = '';
    }
    cur.libraryPlaylist = pl;
    window._currentLibraryPlaylist = pl;
    exitEditModeSilent();
    tc.innerHTML = '';
    window.renderList(pl.tracks || [], tc, { queue: pl.tracks || [] });
    var ts = document.getElementById('lib-pl-tracks-scroll');
    if (ts) ts.scrollTop = 0;
    
    window.fixLibraryHeight()
}

function enterEditMode() {
    ui.editingPlaylist = true;
    var pa = document.getElementById('lib-pl-play-all'), ed = document.getElementById('lib-pl-edit'), mo = document.getElementById('lib-pl-more'),
        cc = document.getElementById('lib-pl-edit-cancel'), cf = document.getElementById('lib-pl-edit-confirm');
    if (pa) pa.style.display = 'none';
    if (ed) ed.style.display = 'none';
    if (mo) mo.style.display = 'none';
    if (cc) { cc.style.display = 'flex'; cc.style.alignItems = 'center'; cc.style.justifyContent = 'center'; }
    if (cf) { cf.style.display = 'flex'; cf.style.alignItems = 'center'; cf.style.justifyContent = 'center'; }
    var pn = document.getElementById('lib-pl-name'), cb = document.getElementById('lib-pl-edit-confirm');
    if (pn) {
        pn.contentEditable = 'true';
        pn.style.outline = 'none';
        pn.style.border = 'none';
        pn.style.background = 'transparent';
        pn.style.boxShadow = 'none';
        pn.style.padding = '0';
        pn.style.borderRadius = '0';
        pn.style.caretColor = 'var(--accent)';
        pn.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
        var range = document.createRange(), sel = window.getSelection();
        range.selectNodeContents(pn);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        pn.focus();
        pn.addEventListener('input', () => {
            var t = pn.textContent.trim();
            if (cb) {
                cb.disabled = !t;
                cb.style.opacity = t ? '1' : '0.3';
                cb.style.pointerEvents = t ? 'all' : 'none';
            }
        });
        if (cb) {
            cb.disabled = false;
            cb.style.opacity = '1';
            cb.style.pointerEvents = 'all';
        }
    }
    var tc = document.getElementById('lib-pl-tracks');
    if (tc) {
        tc.querySelectorAll('.track-item').forEach(item => {
            var ac = item.querySelector('.track-actions');
            if (ac) {
                ac.style.opacity = '1';
                var fv = ac.querySelector('.fav'), ap = ac.querySelector('.add-pl');
                if (fv) fv.style.display = 'none';
                if (ap) ap.style.display = 'none';
                var db = document.createElement('button');
                db.className = 'track-action-btn delete-track';
                db.innerHTML = window.cwIconHTML('x-circle');
                db.title = 'Удалить из плейлиста';
                db.addEventListener('click', e => {
                    e.stopPropagation();
                    item.classList.add('removing');
                    item.addEventListener('animationend', function handler() {
                        item.removeEventListener('animationend', handler);
                        if (item.parentNode) item.remove();
                    });
                });
                ac.appendChild(db);
            }
        });
    }
}

function exitEditModeSilent() {
    ui.editingPlaylist = false;
    var pa = document.getElementById('lib-pl-play-all'), ed = document.getElementById('lib-pl-edit'), mo = document.getElementById('lib-pl-more'),
        cc = document.getElementById('lib-pl-edit-cancel'), cf = document.getElementById('lib-pl-edit-confirm');
    if (pa) pa.style.display = '';
    if (ed) ed.style.display = '';
    if (mo) mo.style.display = '';
    if (cc) cc.style.display = 'none';
    if (cf) cf.style.display = 'none';
    var pn = document.getElementById('lib-pl-name'), pl = cur.libraryPlaylist;
    if (pn) {
        pn.contentEditable = 'false';
        pn.style.outline = 'none';
        pn.style.border = 'none';
        pn.style.background = 'transparent';
        pn.style.boxShadow = 'none';
        pn.style.padding = '0';
        pn.style.borderRadius = '0';
        pn.style.caretColor = '';
        if (pl) pn.textContent = pl.name;
    }
    var tc = document.getElementById('lib-pl-tracks');
    if (tc) {
        tc.querySelectorAll('.track-item').forEach(item => {
            var ac = item.querySelector('.track-actions');
            if (ac) {
                ac.style.opacity = '';
                var fv = ac.querySelector('.fav'), ap = ac.querySelector('.add-pl'), db = ac.querySelector('.delete-track');
                if (fv) fv.style.display = '';
                if (ap) ap.style.display = '';
                if (db) db.remove();
            }
        });
        if (pl) {
            tc.innerHTML = '';
            window.renderList(pl.tracks || [], tc, { queue: pl.tracks || [] });
        }
    }
    var pt = document.getElementById('lib-pl-track-count');
    if (pt && pl) pt.textContent = (pl.tracks || []).length + ' треков';
}
function exitEditMode() { exitEditModeSilent(); }

function confirmEditMode() {
    var pn = document.getElementById('lib-pl-name'),
        tc = document.getElementById('lib-pl-tracks'),
        pl = window._currentLibraryPlaylist;
    if (!pl || !pn) return;
    var nm = pn.textContent.trim();
    if (!nm) { window.showToast('Название не может быть пустым'); return; }
    pl.name = nm;

    if (tc) {
        var remainingIds = [];
        tc.querySelectorAll('.track-item').forEach(item => {
            var id = parseInt(item.dataset.trackId);
            if (id) remainingIds.push(id);
        });


        var removedTracks = pl.tracks.filter(t => !remainingIds.includes(t.id));
        removedTracks.forEach(function(track) {
            var el = tc.querySelector('.track-item[data-track-id="' + track.id + '"]');
            if (el) {
                el.classList.add('removing');
                el.addEventListener('animationend', function handler() {
                    el.removeEventListener('animationend', handler);
                    if (el.parentNode) el.remove();
                });
            }
        });

        pl.tracks = pl.tracks.filter(t => remainingIds.includes(t.id));
    }

    window.StorageAPI.setPlaylists(window.playlists);
    window.renderPlaylists();
    window.updateSidebarPlaylists?.();

    var pne = document.getElementById('lib-pl-name'),
        ptc = document.getElementById('lib-pl-track-count');
    if (pne) pne.textContent = pl.name;
    if (ptc) ptc.textContent = pl.tracks.length + ' треков';
    window.showToast('Плейлист обновлён');
    exitEditModeSilent();
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.page').forEach(p => { if (p.id !== 'page-home') p.style.display = 'none'; });
    window.updateSidebarPlaylists?.();
    document.querySelectorAll('.nav-item[data-page]').forEach(item => item.addEventListener('click', () => showPage(item.dataset.page)));
    var si = document.getElementById('search-input'), debounce;
    si?.addEventListener('input', e => {
        var q = e.target.value.trim();
        if (q) {
            if (!document.getElementById('page-search').classList.contains('active')) showPage('search');
            clearTimeout(debounce);
            debounce = setTimeout(() => doSearch(q, true), 450);
        }
    });
    si?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            var q = e.target.value.trim();
            if (q) {
                if (!document.getElementById('page-search').classList.contains('active')) showPage('search');
                doSearch(q, true);
            }
        }
    });
    document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
    document.getElementById('wave-play-all')?.addEventListener('click', () => {
        var t = window.myWaveTracks;
        if (t?.length) window.__cw.player.play(t[0], t, 0, '🌊 Моя Волна');
        else {
            document.getElementById('popular-tracks')?.scrollIntoView({ behavior: 'smooth' });
            window.showToast('Послушайте треки, чтобы мы собрали вашу волну');
        }
    });
    document.getElementById('quick-history')?.addEventListener('click', () => { showPage('library'); setTimeout(() => showHistoryInLibrary(), 100); });
document.getElementById('quick-fav')?.addEventListener('click', () => {
    showPage('library');
    setTimeout(() => {
        var es = document.getElementById('lib-empty-state'), pv = document.getElementById('lib-playlist-view'),
            ts = document.getElementById('lib-pl-tracks-scroll'), tc = document.getElementById('lib-pl-tracks');
        cur.libraryPlaylist = { id: 'favorites', tracks: window.favorites || [] };
        window._currentLibraryPlaylist = cur.libraryPlaylist;
        if (es) es.style.display = 'none';
        if (pv) pv.style.display = 'flex';
        document.getElementById('lib-pl-name').textContent = 'Избранное';
        document.getElementById('lib-pl-track-count').textContent = (window.favorites || []).length + ' треков';
        var cover = document.getElementById('lib-pl-cover');
        if (cover) cover.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#4a1a2a"/><path d="M100 150c-30-25-60-55-60-85 0-20 15-35 35-35 15 0 25 10 25 10s10-10 25-10c20 0 35 15 35 35 0 30-30 60-60 85z" fill="#ff4466" stroke="#ff4466" stroke-width="3"/></svg>');
        if (tc) { tc.innerHTML = ''; window.renderList(window.favorites || [], tc, { queue: window.favorites || [] }); }
        if (ts) { ts.style.overflowY = 'auto'; ts.scrollTop = 0; }
        
        window.fixLibraryHeight()
    }, 300);
});
    document.getElementById('lib-fav-widget')?.addEventListener('click', () => {
        var es = document.getElementById('lib-empty-state'), pv = document.getElementById('lib-playlist-view');
        if (es) es.style.display = 'none';
        if (pv) pv.style.display = 'flex';
        cur.libraryPlaylist = { id: 'favorites', tracks: window.favorites || [] };
        window._currentLibraryPlaylist = cur.libraryPlaylist;
        document.getElementById('lib-pl-name').textContent = 'Избранное';
        document.getElementById('lib-pl-track-count').textContent = (window.favorites || []).length + ' треков';
        var cover = document.getElementById('lib-pl-cover');
        if (cover) cover.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#4a1a2a"/><path d="M100 150c-30-25-60-55-60-85 0-20 15-35 35-35 15 0 25 10 25 10s10-10 25-10c20 0 35 15 35 35 0 30-30 60-60 85z" fill="#ff4466" stroke="#ff4466" stroke-width="3"/></svg>');
        var tc = document.getElementById('lib-pl-tracks');
        if (tc) { tc.innerHTML = ''; window.renderList(window.favorites || [], tc, { queue: window.favorites || [] }); }
        
        window.fixLibraryHeight()
    });
    document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.back || 'home')));
    document.getElementById('pl-page-delete')?.addEventListener('click', () => {
        if (!ui.currentPlaylistPage) return;
        if (confirm('Удалить плейлист "' + ui.currentPlaylistPage.name + '"?')) {
            window.StorageAPI.deletePlaylist(ui.currentPlaylistPage.id);
            window.renderPlaylists();
            showPage('library');
        }
    });
    document.getElementById('pl-page-play-all')?.addEventListener('click', () => {
        if (ui.currentPlaylistPage?.tracks?.length) window.__cw.player.play(ui.currentPlaylistPage.tracks[0], ui.currentPlaylistPage.tracks, 0, '📂 ' + ui.currentPlaylistPage.name);
    });
    document.getElementById('artist-play-all-btn')?.addEventListener('click', () => {
        var t = cur.playlistTracks;
        if (t?.length) window.__cw.player.play(t[0], t, 0, cur.playlistSource || '');
    });
    document.getElementById('artist-save-btn')?.addEventListener('click', () => { if (cur.playlistData) saveSCPlaylist(cur.playlistData); });
    document.getElementById('lib-pl-play-all')?.addEventListener('click', () => {
        var t = cur.libraryPlaylist?.tracks;
        if (t?.length) { var pn = document.getElementById('lib-pl-name'); window.__cw.player.play(t[0], t, 0, '📂 ' + (pn ? pn.textContent : '')); }
    });
    document.getElementById('lib-pl-edit')?.addEventListener('click', enterEditMode);
    document.getElementById('lib-pl-edit-cancel')?.addEventListener('click', exitEditMode);
    document.getElementById('lib-pl-edit-confirm')?.addEventListener('click', confirmEditMode);
    var mo = document.getElementById('modal-overlay'), mi = document.getElementById('modal-pl-input'), mc = document.getElementById('modal-create-btn');
    mi?.addEventListener('input', () => { if (mc) mc.disabled = !mi.value.trim(); });
    mi?.addEventListener('keydown', e => { if (e.key === 'Enter' && mi.value.trim()) createPlaylistFromModal(); });
    mc?.addEventListener('click', createPlaylistFromModal);
    function createPlaylistFromModal() {
        var n = mi?.value.trim();
        if (!n) return;
        window.StorageAPI.createPlaylist(n);
        window.updateSidebarPlaylists?.();
        window.renderPlaylists();
        mo?.classList.remove('show');
        if (mi) mi.value = '';
        if (mc) mc.disabled = true;
        window.showToast('Плейлист создан');
    }
    window.addEventListener('resize', function() {
    window.fixLibraryHeight();
    });
    mo?.addEventListener('click', e => { if (e.target === mo) { mo.classList.remove('show'); if (mi) mi.value = ''; if (mc) mc.disabled = true; } });
    window.showCreatePlaylistModal = function() { if (mo && mi) { mi.value = ''; if (mc) mc.disabled = true; mo.classList.add('show'); setTimeout(() => mi.focus(), 200); } };
    document.getElementById('lib-new-pl-btn')?.addEventListener('click', e => { e.stopPropagation(); if (typeof window.toggleCreatePlDropdown === 'function') window.toggleCreatePlDropdown(e.currentTarget); });
    document.getElementById('lib-pl-more')?.addEventListener('click', function(e) {
        e.stopPropagation(); e.preventDefault();
        var pl = cur.libraryPlaylist;
        if (!pl) return;
        var om = document.querySelector('.pl-more-menu');
        if (om) om.remove();
        var menu = document.createElement('div');
        menu.className = 'pl-more-menu';
        menu.innerHTML = '<div class="pl-more-item" id="pl-cache-all"><span class="cw-icon">' + window.cwIconHTML('download') + '</span><span>Кэшировать всё</span></div>';
        document.body.appendChild(menu);
        var rect = e.currentTarget.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        menu.style.zIndex = '9999';
        menu.querySelector('#pl-cache-all')?.addEventListener('click', async () => {
            menu.remove();
            window.showToast('Кэширование плейлиста...');
            var tracks = pl.tracks || [], cached = 0;
            for (var i = 0; i < tracks.length; i++) { var ok = await window.cacheTrack(tracks[i]); if (ok) cached++; }
            window.showToast('Закэшировано: ' + cached + ' треков');
        });
        setTimeout(() => document.addEventListener('click', function cm(ev) { if (!menu.contains(ev.target) && ev.target !== e.currentTarget) { menu.remove(); document.removeEventListener('click', cm); } }), 0);
    });
    setupInfiniteScroll();
    var lfc = document.getElementById('lib-fav-count');
    if (lfc) lfc.textContent = (window.favorites?.length || 0) + ' треков';
    var fc = document.getElementById('fav-count');
    if (fc) fc.textContent = (window.favorites?.length || 0) + ' треков';
    showPage('home');
    setTimeout(() => window.renderHome?.(), 500);
    var ls = document.getElementById('loading-screen');
    if (ls) ls.style.display = 'none';
    console.log('✅ main.js');
    window.addTrackWithAnimation = function(track, queue, containerId) {
    var container = document.getElementById(containerId || 'lib-pl-tracks');
    if (!container) return null;
    
    var item = window.createTrackItem(track, queue || [track], { index: 0 });
    item.classList.add('adding');
    
    if (container.firstChild) {
        container.insertBefore(item, container.firstChild);
    } else {
        container.appendChild(item);
    }
    
    var scrollContainer = document.getElementById('lib-pl-tracks-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
    
    return item;
};

window.removeTrackWithAnimation = function(trackId, containerId) {
    var container = document.getElementById(containerId || 'lib-pl-tracks');
    if (!container) return;
    
    var el = container.querySelector('.track-item[data-track-id="' + trackId + '"]');
    if (el) {
        el.classList.add('removing');
        el.addEventListener('animationend', function handler() {
            el.removeEventListener('animationend', handler);
            if (el.parentNode) el.remove();
        });
    }
};
});