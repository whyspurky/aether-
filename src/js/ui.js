// ui.js

function fmt(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + (s % 60).toString().padStart(2, '0');
}

function coverUrl(track) {
    if (!track) return null;
    var url = track.artwork_url || track.user?.avatar_url;
    return url ? url.replace('-large', '-t300x300') : null;
}

function coverHTML(url, size, iconSize) {
    size = size || '40px'; iconSize = iconSize || '20px';
    if (url) return '<div class="cw-cover" style="width:' + size + ';height:' + size + ';background-image:url(' + url + ');background-size:contain;background-repeat:no-repeat;background-position:center"></div>';
    return '<div class="cw-cover cw-cover--placeholder" style="width:' + size + ';height:' + size + '">' + window.cwIconHTML('music') + '</div>';
}

function showSkeletons(container, n) {
    n = n || 8; if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < n; i++) {
        var el = document.createElement('div'); el.className = 'skeleton-item';
        el.innerHTML = '<div class="skel skel-cover"></div><div class="skel-info"><div class="skel skel-line w60"></div><div class="skel skel-line w40"></div></div>';
        container.appendChild(el);
    }
}

function createTrackItem(track, queue, opts) {
    opts = opts || {};
    var item = document.createElement('div');
    item.className = 'track-item'; item.dataset.trackId = track.id;
    if (window.currentTrack && window.currentTrack.id === track.id) item.classList.add('playing');

    var fav = window.StorageAPI?.isFavorite(track) || false;
    var url = coverUrl(track);

    item.innerHTML = '<div class="track-num">' + window.cwIconHTML('play') + '</div>' +
        '<div class="track-playing-bars"><span></span><span></span><span></span></div>' +
        coverHTML(url, '40px', '20px') +
        '<div class="track-info"><h3>' + (track.title || 'Без названия') + '</h3><p>' + (track.user?.username || 'Неизвестный') + '</p></div>' +
        '<div class="track-duration">' + fmt(track.duration) + '</div>' +
        '<div class="track-actions">' +
            '<button class="track-action-btn fav' + (fav ? ' active' : '') + '">' + window.cwIconHTML('heart') + '</button>' +
            '<button class="track-action-btn add-pl">' + window.cwIconHTML('plus') + '</button>' +
            '<button class="track-action-btn cache-track" data-track-id="' + track.id + '">' + window.cwIconHTML('download') + '</button>' +
        '</div>';

    item.addEventListener('click', function(e) {
        if (e.target.closest('.track-actions') || track._pending) return;
        var q = queue || [track];
        var idx = q.findIndex(function(t) { return t.id === track.id; });
        window.__cw.player.play(track, idx !== -1 ? q.slice(idx) : [track], 0, '');
    });

    var favBtn = item.querySelector('.fav');
    if (favBtn) {
        favBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var wasFav = window.StorageAPI.isFavorite(track);
            var added = window.StorageAPI.toggleFavorite(track);
            favBtn.classList.toggle('active', added);
            document.querySelectorAll('.track-item[data-track-id="' + track.id + '"] .fav').forEach(function(btn) { btn.classList.toggle('active', added); });
            window.updateMiniPlayerFav?.();
            if (!added && wasFav && window._currentLibraryPlaylist && window._currentLibraryPlaylist.id === 'favorites') {
                var favContainer = document.getElementById('lib-pl-tracks');
                if (favContainer) {
                    var trackEl = favContainer.querySelector('.track-item[data-track-id="' + track.id + '"]');
                    if (trackEl) {
                        trackEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                        trackEl.style.opacity = '0'; trackEl.style.transform = 'translateX(40px)';
                        trackEl.addEventListener('transitionend', function handler() {
                            trackEl.removeEventListener('transitionend', handler);
                            if (trackEl.parentNode) trackEl.remove();
                        });
                    }
                }
            }
            document.dispatchEvent(new CustomEvent('favUpdated'));
            window.showToast?.(added ? 'Добавлено в избранное' : 'Убрано из избранного');
            var fc = document.getElementById('fav-count'); if (fc) fc.textContent = (window.favorites?.length || 0) + ' треков';
            var lfc = document.getElementById('lib-fav-count'); if (lfc) lfc.textContent = (window.favorites?.length || 0) + ' треков';
        });
    }

    var addBtn = item.querySelector('.add-pl');
    if (addBtn) {
        addBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            window._addPlTrack = track;
            if (typeof toggleAddPlDropdown === 'function') toggleAddPlDropdown(e.currentTarget);
        });
    }

    var cacheBtn = item.querySelector('.cache-track');
    if (cacheBtn) {
        cacheBtn.addEventListener('click', async function(e) {
            e.stopPropagation();
            cacheBtn.disabled = true; cacheBtn.style.opacity = '0.5';
            var ok = await window.cacheTrack(track);
            if (ok) { cacheBtn.innerHTML = window.cwIconHTML('check-circle'); cacheBtn.style.color = '#4caf50'; cacheBtn.style.opacity = '1'; }
            else { cacheBtn.disabled = false; cacheBtn.style.opacity = '1'; window.showToast?.('Не удалось закэшировать'); }
        });
        window.isCached(track.id).then(function(cached) {
            if (cached) { cacheBtn.innerHTML = window.cwIconHTML('check-circle'); cacheBtn.style.color = '#4caf50'; }
        });
    }

    document.addEventListener('favUpdated', function() {
        var isFav = window.StorageAPI?.isFavorite(track) || false;
        var btn = item.querySelector('.fav'); if (btn) btn.classList.toggle('active', isFav);
    });

    return item;
}


function renderList(tracks, container, opts) {
    opts = opts || {}; if (!container) return;
    if (!opts.append) container.innerHTML = '';
    if (!tracks?.length) { if (!opts.append) container.innerHTML = '<div class="empty-state"><h3>Ничего не найдено</h3></div>'; return; }
    var q = opts.queue || tracks;
    tracks.forEach(function(t, i) { container.appendChild(createTrackItem(t, q, { index: i })); });
}

async function renderHome() {
    document.getElementById('history-count').textContent = (window.historyTracks?.length || 0) + ' треков';
    document.getElementById('fav-count').textContent = (window.favorites?.length || 0) + ' треков';

    var waveContainer = document.getElementById('my-wave-tracks');
    if (waveContainer) {
        if (!window.historyTracks?.length) {
            waveContainer.innerHTML = '<div class="my-wave-empty"><div class="my-wave-empty-icon">' + window.cwIconHTML('audio-lines') + '</div><h3>Слушайте треки, и мы соберём вашу волну</h3><p>Мы анализируем вашу историю прослушиваний и подбираем похожие треки</p></div>';
        } else {
            showSkeletons(waveContainer, 6);
            window.SoundCloudAPI.getMyWave(window.historyTracks, 30).then(function(tracks) {
                window.myWaveTracks = tracks; waveContainer.innerHTML = '';
                if (tracks?.length) {
                    window._currentPlaylistTracks = tracks; window._currentPlaylistSource = '🌊 Моя Волна';
                    tracks.slice(0, 10).forEach(function(t, i) { waveContainer.appendChild(createTrackCard(t, tracks, i)); });
                } else {
                    waveContainer.innerHTML = '<div class="my-wave-empty"><div class="my-wave-empty-icon">' + window.cwIconHTML('search') + '</div><h3>Пока не удалось подобрать треки</h3><p>Попробуйте послушать ещё немного</p></div>';
                }
            });
        }
    }

    var popContainer = document.getElementById('popular-tracks');
    if (popContainer) {
        showSkeletons(popContainer, 10);
        popularTracksList = [];
        popularOffset = 0;
        window.SoundCloudAPI.getPopular(60).then(function(pop) {
            popularTracksList = pop;
            popularOffset = 60;
            popContainer.innerHTML = '';
            window._currentPlaylistTracks = pop;
            window._currentPlaylistSource = '🔥 Популярное';
            pop.forEach(function(t, i) { popContainer.appendChild(createTrackCard(t, pop, i)); });
        });        
    }

    var waveBtn = document.getElementById('wave-play-all');
    if (waveBtn) {
        var newBtn = waveBtn.cloneNode(true); waveBtn.parentNode.replaceChild(newBtn, waveBtn);
        newBtn.addEventListener('click', function() {
            var tracks = window.myWaveTracks;
            if (tracks?.length) window.__cw.player.play(tracks[0], tracks, 0);
            else window.showToast?.('Послушайте треки, чтобы мы собрали вашу волну');
        });
    }
}

function createTrackCard(track, queue, index) {
    index = index || 0;
    var card = document.createElement('div'); card.className = 'track-card';
    card.style.animationDelay = index * 0.02 + 's';
    var url = coverUrl(track), isFav = window.StorageAPI?.isFavorite(track) || false;

    card.innerHTML = '<div class="track-card-cover-wrap">' + coverHTML(url, '100%', '32px') +
        '<div class="track-card-play-btn">' + window.cwIconHTML('play') + '</div>' +
        '<button class="track-card-fav-btn' + (isFav ? ' active' : '') + '">' + window.cwIconHTML('heart') + '</button></div>' +
        '<h4>' + (track.title || 'Без названия') + '</h4><p>' + (track.user?.username || '') + '</p>';

    card.addEventListener('click', function(e) {
        if (e.target.closest('.track-card-fav-btn')) return;
        var q = queue || [track];
        var idx = q.findIndex(function(t) { return t.id === track.id; });
        window.__cw.player.play(track, idx !== -1 ? q.slice(idx) : [track], 0, '');
    });

    var favBtn = card.querySelector('.track-card-fav-btn');
    if (favBtn) {
        favBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var added = window.StorageAPI.toggleFavorite(track);
            favBtn.classList.toggle('active', added);
            window.updateMiniPlayerFav?.();
            document.dispatchEvent(new CustomEvent('favUpdated'));
            window.showToast?.(added ? 'Добавлено в избранное' : 'Убрано из избранного');
            var fc = document.getElementById('fav-count'); if (fc) fc.textContent = (window.favorites?.length || 0) + ' треков';
            var lfc = document.getElementById('lib-fav-count'); if (lfc) lfc.textContent = (window.favorites?.length || 0) + ' треков';
        });
    }

    return card;
}

function renderHistory() {
    var container = document.getElementById('history-list');
    if (!container) return;
    if (!window.historyTracks?.length) { container.innerHTML = '<div class="empty-state"><h3>История пуста</h3><p>Послушайте треки</p></div>'; return; }
    window._currentPlaylistTracks = window.historyTracks.slice();
    window._currentPlaylistSource = '🕒 История';
    renderList(window.historyTracks.slice(), container, { queue: window.historyTracks.slice() });
}

function renderPlaylistsGrid() {
    var grid = document.getElementById('playlists-grid'); if (!grid) return;
    grid.innerHTML = '';
    var newCard = document.createElement('div'); newCard.className = 'new-playlist-card';
    newCard.innerHTML = '<span class="plus">' + window.cwIconHTML('plus') + '</span><span>Новый плейлист</span>';
    newCard.addEventListener('click', function() { if (typeof window.showCreatePlaylistModal === 'function') window.showCreatePlaylistModal(); });
    grid.appendChild(newCard);
    (window.playlists || []).forEach(function(pl) {
        var card = document.createElement('div'); card.className = 'playlist-card';
        var firstTrack = pl.tracks?.[0], coverUrl = firstTrack ? coverUrl(firstTrack) : null;
        card.innerHTML = '<div class="playlist-cover">' + (coverUrl ? '<img src="' + coverUrl + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'"><span class="playlist-music-icon" style="display:none">' + window.cwIconHTML('music') + '</span>' : '<span class="playlist-music-icon">' + window.cwIconHTML('music') + '</span>') + '</div><h4>' + pl.name + '</h4><p>' + pl.tracks.length + ' треков</p>';
        card.addEventListener('click', function() { window.showPlaylistPage(pl); });
        grid.appendChild(card);
    });
}

window.renderHome = renderHome;
window.renderList = renderList;
window.showSkeletons = showSkeletons;
window.createTrackCard = createTrackCard;
window.createTrackItem = createTrackItem;
window.renderHistory = renderHistory;
window.renderPlaylistsGrid = renderPlaylistsGrid;
window.coverUrl = coverUrl;
window.coverHTML = coverHTML;
window.fmt = fmt;

console.log('✅ ui.js');