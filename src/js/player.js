// player.js

window.PlayerAPI = {
    play: function(track, queue, index, source) {
        if (typeof playTrack === 'function') playTrack(track, queue, index, source);
        else console.warn('PlayerAPI: playTrack ещё не готова');
    },
    toggle: function() { if (typeof togglePlay === 'function') togglePlay(); },
    next: function() { if (typeof playNext === 'function') playNext(); },
    prev: function() { if (typeof playPrev === 'function') playPrev(); },
};

let widget = null, currentTrack = null, trackQueue = [], queueIndex = -1;
let isPlaying = false, isLoading = false, updateInterval = null;
let shuffleMode = false, repeatMode = 'none';
let isLoadingMore = false, queueSource = '';
let currentTrackId = null, isDraggingProgress = false, shuffleHistory = [];
let volumeSliderTrack, volumeSliderFill, volumeSliderThumb;
let fullVolumeSliderTrack, fullVolumeSliderFill, fullVolumeSliderThumb;
let $bar, $miniPlayBtn, $fullPlayBtn;


var currentVolume = 50;

function initVolume() {
    var saved = window.StorageAPI?.getVolume();
    if (saved != null && !isNaN(saved) && saved >= 0 && saved <= 100) {
        currentVolume = saved;
    }
    updateVolIcon();
    updateVolumeSliderUI();
}

function applyVolume(vol) {
    if (vol != null) {
        currentVolume = Math.max(0, Math.min(100, Math.round(vol)));
        window.StorageAPI?.setVolume(currentVolume);
    }
    
    if (window._usingCachedAudio && window._cachedAudioEl) {
        window._cachedAudioEl.volume = currentVolume / 100;
    }
    if (widget) {
        try { widget.setVolume(currentVolume); } catch(e) {}
    }
    
    updateVolIcon();
    updateVolumeSliderUI();
}

function setVolume(v) {
    applyVolume(v);
}

function updatePlayerFav(btnId, track) {
    var btn = document.getElementById(btnId);
    if (!btn || !track) return;
    var isFav = window.StorageAPI.isFavorite(track);
    btn.classList.toggle('active', isFav);
    btn.innerHTML = window.cwIconHTML('heart');
}

function toggleCreatePlDropdown(button) {
    var dropdown = document.getElementById('add-pl-dropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('show')) { dropdown.classList.remove('show'); dropdown.style.display = 'none'; return; }
    var list = document.getElementById('add-pl-list');
    if (!list) return;
    list.innerHTML = `<div class="add-pl-create-row"><input id="add-pl-name-input" class="add-pl-name-input" type="text" placeholder="Название плейлиста..." maxlength="60" autocomplete="off"><button id="add-pl-create-btn" class="add-pl-create-check" disabled>${window.cwIconHTML('check')}</button></div>`;
    var input = document.getElementById('add-pl-name-input');
    var btn = document.getElementById('add-pl-create-btn');
    input.oninput = function() { btn.disabled = !this.value.trim(); };
    input.onkeydown = function(e) { if (e.key === 'Enter' && this.value.trim()) create(); };
    btn.onclick = create;
    function create() {
        var name = input.value.trim();
        if (!name) return;
        window.StorageAPI.createPlaylist(name);
        window.updateSidebarPlaylists(); window.renderPlaylists();
        dropdown.classList.remove('show'); dropdown.style.display = 'none';
        window.showToast('Плейлист создан');
    }
    dropdown.style.display = 'block'; dropdown.classList.add('show');
    var rect = button.getBoundingClientRect();
    dropdown.style.position = 'fixed'; dropdown.style.left = rect.left + 'px';
    dropdown.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    dropdown.style.top = 'auto'; dropdown.style.right = 'auto'; dropdown.style.width = '260px';
    input.focus();
}

var activeDropdownButton = null, dropdownScrollHandler = null;

function toggleAddPlDropdown(button) {
    var dropdown = document.getElementById('add-pl-dropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('show') && activeDropdownButton === button) { closeDropdown(); return; }
    closeDropdown();
    renderAddPlList();
    dropdown.style.display = 'block'; dropdown.classList.add('show');
    activeDropdownButton = button;
    positionDropdown(button);
    dropdownScrollHandler = function() {
        if (!activeDropdownButton) return;
        var btnRect = activeDropdownButton.getBoundingClientRect();
        if (btnRect.bottom < -50 || btnRect.top > window.innerHeight + 50) closeDropdown();
        else positionDropdown(activeDropdownButton);
    };
    var scrollContainers = [document.querySelector('.content'), document.querySelector('.lib-pl-tracks-scroll')];
    scrollContainers.forEach(function(el) { if (el) el.addEventListener('scroll', dropdownScrollHandler, { passive: true }); });
    dropdown._scrollContainers = scrollContainers.filter(Boolean);
}

function positionDropdown(button) {
    var dropdown = document.getElementById('add-pl-dropdown');
    if (!dropdown || !button) return;
    var rect = button.getBoundingClientRect(), dropdownWidth = 260;
    var dropdownHeight = dropdown.offsetHeight || 300, gap = 8;
    var left = rect.right + gap, top = rect.top - 4;
    if (left + dropdownWidth > window.innerWidth - 4) left = rect.left - dropdownWidth - gap;
    if (left < 4) left = window.innerWidth - dropdownWidth - 4;
    if (top + dropdownHeight > window.innerHeight - 4) top = rect.bottom - dropdownHeight - gap;
    if (top < 4) top = 4;
    dropdown.style.position = 'fixed'; dropdown.style.left = Math.round(left) + 'px';
    dropdown.style.top = Math.round(top) + 'px'; dropdown.style.right = 'auto';
    dropdown.style.bottom = 'auto'; dropdown.style.width = dropdownWidth + 'px';
}

function closeDropdown() {
    var dropdown = document.getElementById('add-pl-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show'); dropdown.style.display = 'none';
        if (dropdown._scrollContainers) {
            dropdown._scrollContainers.forEach(function(el) { el.removeEventListener('scroll', dropdownScrollHandler); });
            dropdown._scrollContainers = null;
        }
    }
    activeDropdownButton = null;
}
window.closeDropdown = closeDropdown;

function renderAddPlList() {
    var list = document.getElementById('add-pl-list');
    if (!list) return;
    var playlists = window.playlists || [];
    list.innerHTML = '';
    if (playlists.length === 0) { list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">Нет плейлистов</div>'; return; }
    var track = window._addPlTrack;
    playlists.forEach(function(pl) {
        var item = document.createElement('div'); item.className = 'add-pl-item';
        if (track) { if (pl.tracks.some(function(t) { return t.id === track.id; })) item.classList.add('selected'); }
        var firstTrack = pl.tracks[0];
        var coverUrl = firstTrack?.artwork_url?.replace('-large', '-t300x300') || '';
        item.innerHTML = (coverUrl ? '<img class="add-pl-cover" src="' + coverUrl + '" alt="">' : '<div class="add-pl-cover-placeholder">' + window.cwIconHTML('music') + '</div>') +
            '<div class="add-pl-item-info"><h4>' + pl.name + '</h4><p>' + pl.tracks.length + ' треков</p></div>' +
            (track ? '<div class="add-pl-check">' + window.cwIconHTML('check') + '</div>' : '');
        if (track) {
            item.addEventListener('click', function(e) {
                e.stopPropagation(); if (!track) return;
                var freshPl = window.playlists.find(function(p) { return p.id === pl.id; });
                if (!freshPl) return;
                var hasTrack = freshPl.tracks.some(function(t) { return t.id === track.id; });
                if (hasTrack) {
                    freshPl.tracks = freshPl.tracks.filter(function(t) { return t.id !== track.id; });
                    window.StorageAPI.setPlaylists(window.playlists);
                    window.showToast('Убрано из «' + freshPl.name + '»');
                    refreshLibraryAfterChange(freshPl, track, true);
                    if (window._currentLibraryPlaylist && window._currentLibraryPlaylist.id === freshPl.id) { closeDropdown(); return; }
                } else {
                    window.StorageAPI.addToPlaylist(freshPl.id, track);
                    window.showToast('Добавлено в «' + freshPl.name + '»');
                    refreshLibraryAfterChange(freshPl, track, false);
                }
                renderAddPlList();
            });
        }
        list.appendChild(item);
    });
}

function refreshLibraryAfterChange(pl, track, wasRemoved) {
    if (window._currentLibraryPlaylist && window._currentLibraryPlaylist.id === pl.id) {
        var tracksContainer = document.getElementById('lib-pl-tracks');
        if (tracksContainer) {
            if (wasRemoved) {
                var trackEl = tracksContainer.querySelector('.track-item[data-track-id="' + track.id + '"]');
                if (trackEl) {
                    trackEl.classList.add('removing');
                    trackEl.addEventListener('animationend', function handler() {
                        trackEl.removeEventListener('animationend', handler);
                        tracksContainer.innerHTML = '';
                        window.renderList(pl.tracks || [], tracksContainer, { queue: pl.tracks || [] });
                        var ptc = document.getElementById('lib-pl-track-count');
                        if (ptc) ptc.textContent = (pl.tracks || []).length + ' треков';
                    });
                }
            } else {
                var newItem = document.createElement('div');
                newItem.className = 'track-item adding';
                newItem.dataset.trackId = track.id;
                newItem.innerHTML = '<div class="track-num">' + window.cwIconHTML('play') + '</div>' +
                    '<div class="track-cover-placeholder">' + window.cwIconHTML('music') + '</div>' +
                    '<div class="track-info"><h3>' + (track.title || 'Без названия') + '</h3><p>' + (track.user?.username || '') + '</p></div>' +
                    '<div class="track-duration">' + fmt(track.duration) + '</div>';
                
                if (tracksContainer.firstChild) {
                    tracksContainer.insertBefore(newItem, tracksContainer.firstChild);
                } else {
                    tracksContainer.appendChild(newItem);
                }
                
                var scrollContainer = document.getElementById('lib-pl-tracks-scroll');
                if (scrollContainer) scrollContainer.scrollTop = 0;
                
                newItem.addEventListener('animationend', function handler() {
                    newItem.removeEventListener('animationend', handler);
                    tracksContainer.innerHTML = '';
                    window.renderList(pl.tracks || [], tracksContainer, { queue: pl.tracks || [] });
                    var ptc = document.getElementById('lib-pl-track-count');
                    if (ptc) ptc.textContent = (pl.tracks || []).length + ' треков';
                });
            }
            var plTrackCount = document.getElementById('lib-pl-track-count');
            if (plTrackCount) plTrackCount.textContent = (pl.tracks || []).length + ' треков';
        }
    }
    if (typeof window.renderPlaylists === 'function') window.renderPlaylists();
}

function fmt(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + (s % 60).toString().padStart(2, '0');
}

function updatePlayUI() {
    var html;
    if (isPlaying) html = window.cwIconHTML('pause');
    else if (isLoading) html = '<span class="cw-icon spinner"><img src="assets/icons/lucide/loader-circle.svg" alt=""></span>';
    else html = window.cwIconHTML('play');
    if ($miniPlayBtn) $miniPlayBtn.innerHTML = html;
    if ($fullPlayBtn) $fullPlayBtn.innerHTML = html;
    var pageBtn = document.getElementById('page-play-btn');
    if (pageBtn) pageBtn.innerHTML = html;
}

function updateVolIcon() {
    var btn = document.getElementById('vol-icon-btn');
    if (!btn) return;
    var name = currentVolume === 0 ? 'volume-x' : currentVolume < 50 ? 'volume-1' : 'volume-2';
    btn.innerHTML = window.cwIconHTML(name);
    updateVolumeSliderUI();
}

function updateQueueSourceLabel() {
    var label = document.getElementById('queue-source-label');
    if (label) label.textContent = queueSource || 'Очередь';
    var pageLabel = document.getElementById('page-queue-label');
    if (pageLabel) pageLabel.textContent = queueSource || 'Очередь';
}

function showSkippedToast(track) {
    var toast = document.getElementById('skipped-toast');
    if (!toast) return;
    toast.textContent = '⏭ Пропущено: ' + (track?.title || 'Неизвестный трек') + (track?.user?.username ? ' — ' + track.user.username : '');
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}

function showPlayerPage() {
    window.showPage('player');
    updatePlayerPageUI();
    updateQueueUI();
    if ($bar) $bar.classList.add('hide-mini');
}

function updatePlayerPageUI() {
    if (!currentTrack) return;
    document.getElementById('page-title').textContent = currentTrack.title || 'Без названия';
    document.getElementById('page-artist-text').textContent = currentTrack.user?.username || '';
    var coverUrl = currentTrack.artwork_url?.replace('-large', '-t500x500') || currentTrack.user?.avatar_url?.replace('-large', '-t500x500') || null;
    var coverImg = document.getElementById('page-cover'), placeholder = document.getElementById('page-cover-placeholder');
    if (coverUrl) {
        coverImg.src = coverUrl; coverImg.style.display = '';
        if (placeholder) placeholder.style.display = 'none';
        coverImg.onerror = function() { coverImg.style.display = 'none'; if (placeholder) placeholder.style.display = ''; };
    } else { coverImg.style.display = 'none'; if (placeholder) placeholder.style.display = ''; }
    updatePlayerPageFav();
}

function updatePlayerPageFav() {
    var btn = document.getElementById('page-fav-btn');
    if (!btn || !currentTrack) return;
    btn.classList.toggle('active', window.StorageAPI.isFavorite(currentTrack));
}

function playTrack(track, queue, index, source) {
    if (window._cachedAudioEl) { window._cachedAudioEl.pause(); window._cachedAudioEl.src = ''; }
    window._usingCachedAudio = false;
    if (!track?.permalink_url) { console.warn('Трек без URL:', track?.title); showSkippedToast(track); skipToNextValid(); return; }
    if (widget) try { widget.pause(); } catch(e) {}
    currentTrack = track; window.currentTrack = track; currentTrackId = track.id;
    isPlaying = false; isLoading = true; updatePlayUI();
    stopProgressUpdate();
    document.getElementById('progress-fill').style.transition = 'none';
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('cur-time').textContent = '0:00';
    document.getElementById('dur-time').textContent = '0:00';
    var ppf = document.getElementById('page-progress-fill');
    if (ppf) { ppf.style.transition = 'none'; ppf.style.width = '0%'; }
    document.getElementById('page-cur-time').textContent = '0:00';
    document.getElementById('page-dur-time').textContent = '0:00';
    requestAnimationFrame(function() {
        document.getElementById('progress-fill').style.transition = 'width 0.15s linear';
        var ppf2 = document.getElementById('page-progress-fill');
        if (ppf2) ppf2.style.transition = 'width 0.15s linear';
    });
    if (queue && queue !== trackQueue) { trackQueue = queue.slice(); queueSource = source || queueSource; shuffleHistory = []; }
    if (index >= 0) queueIndex = index;
    else { queueIndex = trackQueue.findIndex(function(t) { return t.id === track.id; }); if (queueIndex === -1) { trackQueue.unshift(track); queueIndex = 0; } }
    window.currentTracksList = trackQueue;
    if ($bar) $bar.classList.add('show');
    var tracksScroll = document.querySelector('.lib-pl-tracks-scroll');
    if (tracksScroll) { tracksScroll.style.paddingBottom = '14px'; }
    var popularTracks = document.getElementById('popular-tracks');
    if (popularTracks) popularTracks.style.marginBottom = '100px';
    var titleEl = document.getElementById('player-title'), artistEl = document.getElementById('player-artist');
    if (titleEl) titleEl.textContent = track.title || 'Без названия';
    if (artistEl) artistEl.textContent = track.user?.username || 'Неизвестный';
    var coverUrl = track.artwork_url?.replace('-large', '-t500x500') || track.user?.avatar_url?.replace('-large', '-t500x500') || null;
    var playerCover = document.getElementById('player-cover'), playerPh = document.getElementById('player-cover-placeholder');
    if (playerCover) { playerCover.onerror = null; playerCover.onload = null; }
    if (coverUrl) {
        if (playerPh) playerPh.style.display = ''; if (playerCover) playerCover.style.display = 'none';
        if (playerCover) {
            playerCover.onload = function() { playerCover.style.display = ''; if (playerPh) playerPh.style.display = 'none'; };
            playerCover.onerror = function() { playerCover.style.display = 'none'; if (playerPh) playerPh.style.display = ''; };
            playerCover.src = coverUrl;
        }
    } else { if (playerCover) playerCover.style.display = 'none'; if (playerPh) playerPh.style.display = ''; }
    updateQueueSourceLabel(); window.updateMiniPlayerFav?.(); window.StorageAPI?.addToHistory(track);
    
    if (window._currentLibraryPlaylist && window._currentLibraryPlaylist.id === 'history') {
        var hc = document.getElementById('lib-pl-tracks');
        if (hc) {
            var ex = hc.querySelector('.track-item[data-track-id="' + track.id + '"]');
            if (ex) {
                ex.classList.add('removing-history');
                ex.addEventListener('animationend', function handler() {
                    ex.removeEventListener('animationend', handler);
                    hc.innerHTML = '';
                    window.renderList(window.historyTracks || [], hc, { queue: window.historyTracks || [] });
                    var ptc2 = document.getElementById('lib-pl-track-count');
                    if (ptc2) ptc2.textContent = (window.historyTracks || []).length + ' треков';
                });
            }
            var ni = document.createElement('div');
            ni.className = 'track-item adding-history';
            ni.dataset.trackId = track.id;
            ni.innerHTML = '<div class="track-num">' + window.cwIconHTML('play') + '</div>' +
                '<div class="track-cover-placeholder">' + window.cwIconHTML('music') + '</div>' +
                '<div class="track-info"><h3>' + (track.title || 'Без названия') + '</h3><p>' + (track.user?.username || '') + '</p></div>' +
                '<div class="track-duration">' + fmt(track.duration) + '</div>';
            if (hc.firstChild) { hc.insertBefore(ni, hc.firstChild); } else { hc.appendChild(ni); }
            var scrollContainer = document.getElementById('lib-pl-tracks-scroll');
            if (scrollContainer) scrollContainer.scrollTop = 0;
            ni.addEventListener('animationend', function handler() {
                ni.removeEventListener('animationend', handler);
                hc.innerHTML = '';
                window.renderList(window.historyTracks || [], hc, { queue: window.historyTracks || [] });
                var ptc3 = document.getElementById('lib-pl-track-count');
                if (ptc3) ptc3.textContent = (window.historyTracks || []).length + ' треков';
            });
            var ptc = document.getElementById('lib-pl-track-count');
            if (ptc) ptc.textContent = (window.historyTracks || []).length + ' треков';
        }
    }
    
    var iframe = document.getElementById('sc-widget');
    if (typeof window.getCachedAudio === 'function') {
        window.getCachedAudio(track.id).then(function(cachedBlob) {
            if (cachedBlob) {
                if (iframe) iframe.style.display = 'none';
                var audioEl = document.getElementById('cached-audio');
                if (!audioEl) { audioEl = document.createElement('audio'); audioEl.id = 'cached-audio'; audioEl.style.display = 'none'; document.body.appendChild(audioEl); }
                audioEl.src = URL.createObjectURL(cachedBlob);
                audioEl.play();
                window._cachedAudioEl = audioEl; window._usingCachedAudio = true;
                applyVolume();
                isLoading = false; isPlaying = true; updatePlayUI(); startProgressLocal(audioEl);
            } else {
                window._usingCachedAudio = false;
                if (iframe) { iframe.style.display = ''; iframe.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(track.permalink_url) + '&auto_play=true&hide_related=true&show_comments=false&color=ff6b00'; }
                safeInitWidget();
            }
        });
    } else {
        window._usingCachedAudio = false;
        if (iframe) { iframe.style.display = ''; iframe.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(track.permalink_url) + '&auto_play=true&hide_related=true&show_comments=false&color=ff6b00'; }
        safeInitWidget();
    }
    
    document.querySelectorAll('.track-item').forEach(function(el) { el.classList.toggle('playing', el.dataset.trackId == track.id); });
    [document.getElementById('queue-list'), document.getElementById('page-queue-list')].forEach(function(list) {
        if (!list) return;
        list.querySelectorAll('.queue-item').forEach(function(el, i) {
            el.classList.toggle('active', i === queueIndex);
            var bars = el.querySelector('.queue-playing-bars');
            if (i === queueIndex) { if (!bars) { bars = document.createElement('div'); bars.className = 'queue-playing-bars'; bars.innerHTML = '<span></span><span></span><span></span>'; el.insertBefore(bars, el.firstChild); } }
            else { if (bars) bars.remove(); }
        });
    });
    if (queueIndex >= trackQueue.length - 1 && repeatMode !== 'one' && repeatMode !== 'all') loadMoreToQueue();
    updatePlayerPageUI();
}

function skipToNextValid() {
    isLoading = false; var attempts = 0, maxAttempts = trackQueue.length;
    while (attempts < maxAttempts) {
        if (queueIndex >= trackQueue.length - 1) { if (repeatMode === 'all') queueIndex = 0; else { loadMoreToQueue(); window.showToast('Ищем доступные треки...'); return; } }
        else queueIndex++;
        var nextTrack = trackQueue[queueIndex];
        if (nextTrack?.permalink_url) {
            var skippedIds = [];
            for (var s = 0; s < attempts; s++) skippedIds.push(trackQueue[queueIndex - attempts + s]?.id);
            skippedIds.push(trackQueue[queueIndex - 1]?.id);
            [document.getElementById('queue-list'), document.getElementById('page-queue-list')].forEach(function(list) {
                if (!list) return;
                skippedIds.forEach(function(id) { if (!id) return; var el = list.querySelector('.queue-item[data-track-id="' + id + '"]'); if (el) el.remove(); });
            });
            playTrack(nextTrack, trackQueue, queueIndex); return;
        }
        showSkippedToast(nextTrack); attempts++;
    }
    window.showToast('Нет доступных треков');
}

async function loadMoreToQueue() {
    if (isLoadingMore || !trackQueue.length || repeatMode === 'one' || repeatMode === 'all') return;
    isLoadingMore = true;
    try {
        var related = await window.SoundCloudAPI.getRelatedTracks(trackQueue.slice(), 10);
        if (related.length) {
            var existingIds = new Set(trackQueue.map(function(t) { return t.id; }));
            var uniq = related.filter(function(t) { return !existingIds.has(t.id); });
            if (uniq.length) { uniq.forEach(function(t) { trackQueue.push(t); }); updateQueueUI(); }
        }
    } catch(e) { console.warn('Догрузка не удалась:', e); }
    isLoadingMore = false;
}

function safeInitWidget() {
    if (!window.SC) { setTimeout(safeInitWidget, 150); return; }
    initWidget();
}

function initWidget() {
    var iframe = document.getElementById('sc-widget');
    if (!iframe || !window.SC) return;
    if (widget) try { widget.unbindAll(); } catch(_) {}
    widget = SC.Widget(iframe);
    widget.bind(SC.Widget.Events.READY, function() {
        applyVolume(); 
        widget.play();
    });
    widget.bind(SC.Widget.Events.PLAY, function() {
        if (currentTrack && currentTrack.id !== currentTrackId) return;
        applyVolume(); 
        isLoading = false; isPlaying = true; updatePlayUI(); startProgress();
    });
    widget.bind(SC.Widget.Events.PAUSE, function() { isLoading = false; isPlaying = false; updatePlayUI(); stopProgressUpdate(); });
    widget.bind(SC.Widget.Events.FINISH, function() {
        isLoading = false; isPlaying = false; updatePlayUI(); stopProgressUpdate();
        if (repeatMode === 'one') playTrack(currentTrack, trackQueue, queueIndex);
        else if (repeatMode === 'all') { queueIndex = (queueIndex + 1) % trackQueue.length; playTrack(trackQueue[queueIndex], trackQueue, queueIndex); }
        else if (queueIndex < trackQueue.length - 1) { queueIndex++; playTrack(trackQueue[queueIndex], trackQueue, queueIndex); }
        else loadMoreToQueue().then(function() { if (trackQueue.length > queueIndex + 1) { queueIndex++; playTrack(trackQueue[queueIndex], trackQueue, queueIndex); } });
    });
}

function togglePlay() {
    if (window._usingCachedAudio && window._cachedAudioEl) {
        var a = window._cachedAudioEl;
        if (a.paused) { a.play(); isPlaying = true; startProgressLocal(a); }
        else { a.pause(); isPlaying = false; stopProgressUpdate(); }
        updatePlayUI(); return;
    }
    if (!widget) { if (currentTrack) playTrack(currentTrack, trackQueue, queueIndex); return; }
    widget.isPaused(function(paused) { isPlaying = paused; if (paused) widget.play(); else widget.pause(); updatePlayUI(); });
}

function playNext() {
    if (!trackQueue.length) return;
    if (shuffleMode) {
        if (queueIndex >= 0 && queueIndex < trackQueue.length) shuffleHistory.push(queueIndex);
        if (shuffleHistory.length >= trackQueue.length) shuffleHistory = [];
        if (trackQueue.length === 1) { playTrack(trackQueue[0], trackQueue, 0); return; }
        var available = [];
        for (var i = 0; i < trackQueue.length; i++) if (shuffleHistory.indexOf(i) === -1) available.push(i);
        queueIndex = available[Math.floor(Math.random() * available.length)];
        playTrack(trackQueue[queueIndex], trackQueue, queueIndex); return;
    }
    if (repeatMode === 'all') { queueIndex = (queueIndex + 1) % trackQueue.length; playTrack(trackQueue[queueIndex], trackQueue, queueIndex); return; }
    if (queueIndex >= trackQueue.length - 1) { loadMoreToQueue(); return; }
    queueIndex++; playTrack(trackQueue[queueIndex], trackQueue, queueIndex);
}

function playPrev() {
    if (!trackQueue.length || !currentTrack) return;
    if (window._usingCachedAudio && window._cachedAudioEl) {
        if (window._cachedAudioEl.currentTime > 3) window._cachedAudioEl.currentTime = 0;
        else if (queueIndex > 0) { queueIndex--; playTrack(trackQueue[queueIndex], trackQueue, queueIndex); }
        else window._cachedAudioEl.currentTime = 0;
        return;
    }
    if (widget) {
        widget.getPosition(function(pos) {
            if (pos > 3000) widget.seekTo(0);
            else if (queueIndex > 0) { queueIndex--; playTrack(trackQueue[queueIndex], trackQueue, queueIndex); }
            else widget.seekTo(0);
        });
    } else if (queueIndex > 0) { queueIndex--; playTrack(trackQueue[queueIndex], trackQueue, queueIndex); }
}

function seek(percent) {
    var sp = Math.max(0, Math.min(0.995, percent));
    if (window._usingCachedAudio && window._cachedAudioEl) { window._cachedAudioEl.currentTime = sp * window._cachedAudioEl.duration; return; }
    if (!widget) return;
    widget.getDuration(function(d) { if (d) widget.seekTo(Math.floor(sp * d)); });
}

function startProgress() {
    stopProgressUpdate(); var trackId = currentTrackId, lastPos = -1, lastDur = 0;
    function updateUI(pos, dur) {
        if (currentTrackId !== trackId || !dur || (pos === lastPos && dur === lastDur)) return;
        lastPos = pos; lastDur = dur; var pct = (pos / dur) * 100;
        if (!isDraggingProgress) {
            document.getElementById('progress-fill').style.width = pct + '%';
            var pf = document.getElementById('page-progress-fill'); if (pf) pf.style.width = pct + '%';
        }
        document.getElementById('cur-time').textContent = fmt(pos);
        document.getElementById('dur-time').textContent = fmt(dur);
        document.getElementById('page-cur-time').textContent = fmt(pos);
        document.getElementById('page-dur-time').textContent = fmt(dur);
        if (!isDraggingProgress && pct > 99.5 && isPlaying) {
            isPlaying = false; updatePlayUI(); stopProgressUpdate();
            if (repeatMode === 'one') playTrack(currentTrack, trackQueue, queueIndex); else playNext();
        }
    }
    updateInterval = setInterval(function() {
        if (currentTrackId !== trackId || !widget) { stopProgressUpdate(); return; }
        widget.getPosition(function(pos) { if (currentTrackId !== trackId) return; widget.getDuration(function(dur) { updateUI(pos, dur); }); });
    }, 250);
}

function startProgressLocal(audioEl) {
    stopProgressUpdate(); var trackId = currentTrackId;
    audioEl.addEventListener('loadedmetadata', function() {
        var dur = audioEl.duration * 1000;
        document.getElementById('dur-time').textContent = fmt(dur);
        document.getElementById('page-dur-time').textContent = fmt(dur);
    });
    updateInterval = setInterval(function() {
        if (currentTrackId !== trackId || !audioEl || audioEl.paused) { if (currentTrackId !== trackId) stopProgressUpdate(); return; }
        var pos = audioEl.currentTime * 1000, dur = audioEl.duration * 1000;
        if (dur > 0) {
            var pct = (pos / dur) * 100;
            if (!isDraggingProgress) {
                document.getElementById('progress-fill').style.width = pct + '%';
                var pf = document.getElementById('page-progress-fill'); if (pf) pf.style.width = pct + '%';
            }
            document.getElementById('cur-time').textContent = fmt(pos);
            document.getElementById('dur-time').textContent = fmt(dur);
            document.getElementById('page-cur-time').textContent = fmt(pos);
            document.getElementById('page-dur-time').textContent = fmt(dur);
        }
        if (audioEl.ended) { isPlaying = false; updatePlayUI(); stopProgressUpdate(); playNext(); }
    }, 250);
}

function stopProgressUpdate() { if (updateInterval) { clearInterval(updateInterval); updateInterval = null; } }

function updateQueueUI() {
    [document.getElementById('queue-list'), document.getElementById('page-queue-list')].forEach(function(list) {
        if (!list) return; list.innerHTML = '';
        trackQueue.forEach(function(t, i) {
            var el = document.createElement('div'); el.className = 'queue-item'; el.dataset.trackId = t.id;
            if (i === queueIndex) el.classList.add('active');
            if (t._pending) { el.style.opacity = '0.5'; el.style.pointerEvents = 'none'; }
            var coverUrl = t.artwork_url?.replace('-large', '-t300x300') || t.user?.avatar_url?.replace('-large', '-t300x300') || null;
            var infoHTML = '<div class="queue-info"><h4>' + (t._pending ? 'Загрузка...' : (t.title || 'Без названия')) + '</h4><p>' + (t.user?.username || '') + '</p></div><span class="queue-duration">' + (t._pending ? '...' : fmt(t.duration)) + '</span>';
            if (coverUrl) {
                var cc = document.createElement('div'); cc.style.position = 'relative'; cc.style.flexShrink = '0';
                var img = document.createElement('img'); img.className = 'queue-cover'; img.src = coverUrl; img.alt = '';
                var ph = document.createElement('div'); ph.className = 'queue-cover-placeholder'; ph.innerHTML = window.cwIconHTML('music');
                img.onload = function() { img.style.display = ''; ph.style.display = 'none'; };
                img.onerror = function() { img.style.display = 'none'; ph.style.display = ''; };
                cc.appendChild(img); cc.appendChild(ph);
                el.innerHTML = ''; el.dataset.trackId = t.id;
                if (i === queueIndex) { var bars = document.createElement('div'); bars.className = 'queue-playing-bars'; bars.innerHTML = '<span></span><span></span><span></span>'; el.appendChild(bars); }
                el.appendChild(cc);
                var info = document.createElement('div'); info.className = 'queue-info';
                info.innerHTML = '<h4>' + (t._pending ? 'Загрузка...' : (t.title || 'Без названия')) + '</h4><p>' + (t.user?.username || '') + '</p>';
                el.appendChild(info);
                var dur = document.createElement('span'); dur.className = 'queue-duration'; dur.textContent = t._pending ? '...' : fmt(t.duration);
                el.appendChild(dur);
            } else {
                el.innerHTML = (i === queueIndex ? '<div class="queue-playing-bars"><span></span><span></span><span></span></div>' : '') + '<div class="queue-cover-placeholder">' + window.cwIconHTML('music') + '</div>' + infoHTML;
                el.dataset.trackId = t.id;
            }
            el.addEventListener('click', function() { if (t._pending) return; queueIndex = i; playTrack(t, trackQueue, queueIndex); });
            list.appendChild(el);
        });
        if (isLoadingMore) { var loader = document.createElement('div'); loader.className = 'queue-loading'; loader.textContent = 'Подбираем треки...'; list.appendChild(loader); }
    });
}

function updateVolumeFromClick(e) {
    if (!volumeSliderTrack) return;
    var rect = volumeSliderTrack.getBoundingClientRect();
    var percent = 1 - (e.clientY - rect.top) / rect.height;
    setVolume(Math.round(Math.max(0, Math.min(1, percent)) * 100));
}

function updateVolumeSliderUI() {
    if (volumeSliderFill) volumeSliderFill.style.height = currentVolume + '%';
    if (volumeSliderThumb) volumeSliderThumb.style.bottom = currentVolume + '%';
    if (fullVolumeSliderFill) fullVolumeSliderFill.style.width = currentVolume + '%';
    if (fullVolumeSliderThumb) fullVolumeSliderThumb.style.left = currentVolume + '%';
    var pf = document.getElementById('page-volume-slider-fill'), pt = document.getElementById('page-volume-slider-thumb');
    if (pf) pf.style.width = currentVolume + '%';
    if (pt) pt.style.left = currentVolume + '%';
}

document.addEventListener('DOMContentLoaded', function() {
    $bar = document.getElementById('player-bar');
    $miniPlayBtn = document.getElementById('mini-play-btn');
    $fullPlayBtn = document.getElementById('full-play-btn');
    volumeSliderTrack = document.getElementById('volume-slider-track');
    volumeSliderFill = document.getElementById('volume-slider-fill');
    volumeSliderThumb = document.getElementById('volume-slider-thumb');
    if (volumeSliderTrack) {
        volumeSliderTrack.addEventListener('mousedown', function(e) {
            isVolumeDragging = true; updateVolumeFromClick(e);
            document.addEventListener('mousemove', updateVolumeFromClick);
            document.addEventListener('mouseup', function() { isVolumeDragging = false; document.removeEventListener('mousemove', updateVolumeFromClick); }, { once: true });
        });
        volumeSliderTrack.addEventListener('touchstart', function(e) {
            isVolumeDragging = true; updateVolumeFromClick(e.touches[0]);
            document.addEventListener('touchmove', function(ev) { updateVolumeFromClick(ev.touches[0]); });
            document.addEventListener('touchend', function() { isVolumeDragging = false; document.removeEventListener('touchmove', function() {}); }, { once: true });
        });
    }
    fullVolumeSliderTrack = document.getElementById('full-volume-slider-track');
    fullVolumeSliderFill = document.getElementById('full-volume-slider-fill');
    fullVolumeSliderThumb = document.getElementById('full-volume-slider-thumb');
    if (fullVolumeSliderTrack) {
        fullVolumeSliderTrack.addEventListener('mousedown', function(e) {
            updateFullVolumeFromClick(e);
            document.addEventListener('mousemove', updateFullVolumeFromClick);
            document.addEventListener('mouseup', function() { document.removeEventListener('mousemove', updateFullVolumeFromClick); }, { once: true });
        });
    }
    var pageVolumeTrack = document.getElementById('page-volume-slider-track');
    if (pageVolumeTrack) {
        pageVolumeTrack.addEventListener('mousedown', function(e) {
            updatePageVolumeFromClick(e);
            document.addEventListener('mousemove', updatePageVolumeFromClick);
            document.addEventListener('mouseup', function() { document.removeEventListener('mousemove', updatePageVolumeFromClick); }, { once: true });
        });
    }
    var pp = document.getElementById('player-cover-placeholder'); if (pp) pp.innerHTML = window.cwIconHTML('music');
    var pagePh = document.getElementById('page-cover-placeholder'); if (pagePh) pagePh.innerHTML = window.cwIconHTML('music');
    var libPh = document.getElementById('lib-pl-cover-placeholder');
    if (libPh) { var iconSpan = libPh.querySelector('.cw-icon'); if (iconSpan) iconSpan.innerHTML = window.cwIconHTML('music'); }
    
    initVolume();
    applyVolume();
    
    $miniPlayBtn?.addEventListener('click', togglePlay);
    document.getElementById('mini-prev-btn')?.addEventListener('click', playPrev);
    document.getElementById('mini-next-btn')?.addEventListener('click', playNext);

    var iconMap = {
        'shuffle-btn':'shuffle','repeat-btn':'repeat','mini-prev-btn':'skip-back','mini-next-btn':'skip-forward',
        'popular-icon':'flame','nav-home-icon':'home','nav-player-icon':'play','nav-search-icon':'search',
        'nav-library-icon':'library','nav-settings-icon':'settings','nav-account-icon':'circle-user-round',
        'vol-icon-btn':'volume-2','mini-add-pl-btn':'plus','expand-btn':'expand','wave-play-icon':'play',
        'filter-tracks-icon':'music','filter-playlists-icon':'folder','filter-artists-icon':'mic',
        'pl-play-icon':'play','pl-delete-icon':'trash-2','modal-pl-icon':'plus-circle','modal-add-icon':'plus-circle',
        'search-input-icon':'search','page-shuffle-btn':'shuffle','page-repeat-btn':'repeat',
        'page-prev-btn':'skip-back','page-next-btn':'skip-forward','page-fav-btn':'heart','page-add-pl-btn':'plus',
        'page-vol-low':'volume-1','page-vol-high':'volume-2'
    };
    Object.entries(iconMap).forEach(function(e) { var el = document.getElementById(e[0]); if (el) el.innerHTML = window.cwIconHTML(e[1]); });
    document.querySelectorAll('.lib-new-pl-icon').forEach(function(el) { el.innerHTML = window.cwIconHTML('plus'); });
    document.querySelectorAll('.lib-empty-icon,.lib-history-icon').forEach(function(el) { el.innerHTML = window.cwIconHTML('library'); });
    var favWidget = document.querySelector('#lib-fav-widget .lib-widget-icon'); if (favWidget) favWidget.innerHTML = window.cwIconHTML('heart');
    document.querySelector('#quick-history .quick-card-icon').innerHTML = window.cwIconHTML('library');
    document.querySelector('#quick-fav .quick-card-icon').innerHTML = window.cwIconHTML('heart');
    document.getElementById('lib-pl-play-all').innerHTML = window.cwIconHTML('play');
    document.getElementById('lib-pl-edit').innerHTML = window.cwIconHTML('pencil');
    document.getElementById('lib-pl-edit-cancel').innerHTML = window.cwIconHTML('x');
    document.getElementById('lib-pl-edit-confirm').innerHTML = window.cwIconHTML('check');
    document.getElementById('lib-pl-more').innerHTML = window.cwIconHTML('ellipsis-vertical');
    var apl = document.getElementById('artist-play-all-btn'); if (apl) apl.querySelector('.cw-icon').innerHTML = window.cwIconHTML('play');
    var asv = document.getElementById('artist-save-btn'); if (asv) asv.querySelector('.cw-icon').innerHTML = window.cwIconHTML('plus');

    function addDragSeek(trackId) {
        var track = document.getElementById(trackId); if (!track) return;
        var isDragging = false, dragPercent = 0, lastValidPercent = 0;
        function getPercent(e) { var rect = track.getBoundingClientRect(); return Math.max(0, Math.min(0.995, (e.clientX - rect.left) / rect.width)); }
        function updatePosition(e) {
            dragPercent = getPercent(e); if (isNaN(dragPercent)) dragPercent = lastValidPercent; else lastValidPercent = dragPercent;
            var fillId = trackId === 'progress-track' ? 'progress-fill' : 'page-progress-fill';
            var otherId = trackId === 'progress-track' ? 'page-progress-fill' : 'progress-fill';
            var fill = document.getElementById(fillId), other = document.getElementById(otherId);
            if (fill) { fill.style.transition = 'none'; fill.style.width = (dragPercent * 100) + '%'; }
            if (other) { other.style.transition = 'none'; other.style.width = (dragPercent * 100) + '%'; }
        }
        track.addEventListener('mousedown', function(e) { isDragging = true; isDraggingProgress = true; track.classList.add('dragging'); updatePosition(e); e.preventDefault(); });
        document.addEventListener('mousemove', function(e) { if (!isDragging) return; updatePosition(e); });
        document.addEventListener('mouseup', function(e) {
            if (!isDragging) return;
            isDraggingProgress = false; isDragging = false; track.classList.remove('dragging');
            var fillId = trackId === 'progress-track' ? 'progress-fill' : 'page-progress-fill';
            var otherId = trackId === 'progress-track' ? 'page-progress-fill' : 'progress-fill';
            var fill = document.getElementById(fillId), other = document.getElementById(otherId);
            if (fill) fill.style.transition = 'width 0.15s linear';
            if (other) other.style.transition = 'width 0.15s linear';
            var fp = lastValidPercent; if (isNaN(fp) || fp < 0) fp = 0; if (fp > 0.999) fp = 0.999;
            seek(fp); if (!window._usingCachedAudio) startProgress();
        });
        track.addEventListener('touchstart', function(e) { isDraggingProgress = true; isDragging = true; track.classList.add('dragging'); updatePosition(e.touches[0]); e.preventDefault(); });
        document.addEventListener('touchmove', function(e) { if (!isDragging) return; updatePosition(e.touches[0]); });
        document.addEventListener('touchend', function(e) {
            if (!isDragging) return;
            isDraggingProgress = false; isDragging = false; track.classList.remove('dragging');
            var fillId = trackId === 'progress-track' ? 'progress-fill' : 'page-progress-fill';
            var otherId = trackId === 'progress-track' ? 'page-progress-fill' : 'progress-fill';
            var fill = document.getElementById(fillId), other = document.getElementById(otherId);
            if (fill) fill.style.transition = 'width 0.15s linear';
            if (other) other.style.transition = 'width 0.15s linear';
            var fp = lastValidPercent; if (isNaN(fp) || fp < 0) fp = 0; if (fp > 0.999) fp = 0.999;
            seek(fp); if (!window._usingCachedAudio) startProgress();
        });
    }
    addDragSeek('progress-track'); addDragSeek('page-progress-track');

    var volWrap = document.getElementById('volume-wrap'), 
        volSlider = document.getElementById('volume-slider-wrap'), 
        hideTimeout, 
        isVolumeDragging = false,
        isVolumeHovered = false,
        isSliderHovered = false;

    function showVolumeSlider() {
        clearTimeout(hideTimeout);
        volSlider.classList.add('show');
    }

    function hideVolumeSlider() {
        hideTimeout = setTimeout(function() {
            if (!isVolumeDragging && !isVolumeHovered && !isSliderHovered) {
                volSlider.classList.remove('show');
            }
        }, 1000);
    }

    if (volWrap && volSlider) {
        volWrap.addEventListener('mouseenter', function() { 
            isVolumeHovered = true;
            showVolumeSlider();
        });
        volWrap.addEventListener('mouseleave', function() { 
            isVolumeHovered = false;
            hideVolumeSlider();
        });
        volSlider.addEventListener('mouseenter', function() { 
            isSliderHovered = true;
            showVolumeSlider();
        });
        volSlider.addEventListener('mouseleave', function() { 
            isSliderHovered = false;
            hideVolumeSlider();
        });
    }

    document.getElementById('lib-history-btn')?.addEventListener('click', function() {
        var emptyState = document.getElementById('lib-empty-state'), playlistView = document.getElementById('lib-playlist-view');
        if (emptyState) emptyState.style.display = 'none';
        if (playlistView) playlistView.style.display = 'flex';
        window._currentLibraryPlaylist = { id: 'history', tracks: window.historyTracks || [] };
        cur.libraryPlaylist = window._currentLibraryPlaylist;
        document.getElementById('lib-pl-name').textContent = 'История';
        document.getElementById('lib-pl-track-count').textContent = (window.historyTracks || []).length + ' треков';
        var plCover = document.getElementById('lib-pl-cover'); if (plCover) plCover.style.display = 'none';
        var plPh = document.getElementById('lib-pl-cover-placeholder');
        if (plPh) { plPh.style.display = ''; plPh.querySelector('.cw-icon').innerHTML = window.cwIconHTML('library'); }
        var tc = document.getElementById('lib-pl-tracks');
        if (tc) { tc.innerHTML = ''; window.renderList(window.historyTracks || [], tc, { queue: window.historyTracks || [] }); }
        window.fixLibraryHeight()
    });

    document.getElementById('shuffle-btn')?.addEventListener('click', function() {
        shuffleMode = !shuffleMode; if (shuffleMode) shuffleHistory = [];
        this.classList.toggle('active', shuffleMode);
        document.getElementById('page-shuffle-btn')?.classList.toggle('active', shuffleMode);
    });

    function cycleRepeat() {
        var modes = ['none','all','one']; repeatMode = modes[(modes.indexOf(repeatMode) + 1) % 3];
        var active = repeatMode !== 'none', icon = repeatMode === 'one' ? 'repeat-1' : 'repeat';
        var rb = document.getElementById('repeat-btn'), prb = document.getElementById('page-repeat-btn');
        if (rb) { rb.classList.toggle('active', active); rb.innerHTML = window.cwIconHTML(icon); }
        if (prb) { prb.classList.toggle('active', active); prb.innerHTML = window.cwIconHTML(icon); }
    }
    document.getElementById('repeat-btn')?.addEventListener('click', cycleRepeat);

    document.getElementById('now-playing-area')?.addEventListener('click', function(e) {
        if (e.target.closest('#mini-fav-btn') || e.target.closest('#mini-add-pl-btn')) return;
        showPlayerPage();
    });
    document.getElementById('expand-btn')?.addEventListener('click', showPlayerPage);
    document.getElementById('nav-player-btn')?.addEventListener('click', showPlayerPage);
    document.getElementById('page-play-btn')?.addEventListener('click', togglePlay);
    document.getElementById('page-prev-btn')?.addEventListener('click', playPrev);
    document.getElementById('page-next-btn')?.addEventListener('click', playNext);
    document.getElementById('page-shuffle-btn')?.addEventListener('click', function() {
        shuffleMode = !shuffleMode; if (shuffleMode) shuffleHistory = [];
        this.classList.toggle('active', shuffleMode);
        document.getElementById('shuffle-btn')?.classList.toggle('active', shuffleMode);
    });
    document.getElementById('page-repeat-btn')?.addEventListener('click', cycleRepeat);
    document.getElementById('page-fav-btn')?.addEventListener('click', function() {
        if (!currentTrack) return;
        var added = window.StorageAPI.toggleFavorite(currentTrack);
        updatePlayerPageFav(); window.updateMiniPlayerFav();
        refreshFavoritesAfterChange(currentTrack, !added);
        var icon = this.querySelector('.cw-icon'); if (icon) window.animateIcon(icon, 'click');
    });
    document.getElementById('page-add-pl-btn')?.addEventListener('click', function() {
        if (!currentTrack) return;
        window._addPlTrack = currentTrack; toggleAddPlDropdown(this);
    });

    var favBtn = document.getElementById('mini-fav-btn');
    if (favBtn) {
        var newFavBtn = favBtn.cloneNode(true); favBtn.parentNode.replaceChild(newFavBtn, favBtn);
        newFavBtn.addEventListener('click', function(e) {
            e.stopPropagation(); e.preventDefault();
            var track = window.currentTrack;
            if (!track?.id) { window.showToast('Сначала выберите трек'); return; }
            var added = window.StorageAPI.toggleFavorite(track);
            window.updateMiniPlayerFav(); updatePlayerPageFav();
            refreshFavoritesAfterChange(track, !added);
            var icon = newFavBtn.querySelector('.cw-icon'); if (icon) window.animateIcon(icon, 'click');
            document.dispatchEvent(new CustomEvent('favUpdated'));
            var lfc = document.getElementById('lib-fav-count'); if (lfc) lfc.textContent = (window.favorites?.length || 0) + ' треков';
            window.showToast(added ? 'Добавлено в избранное' : 'Убрано из избранного');
        });
    }

    document.getElementById('mini-add-pl-btn')?.addEventListener('click', function(e) {
        e.stopPropagation(); window._addPlTrack = window.currentTrack; toggleAddPlDropdown(this);
    });

    document.addEventListener('click', function(e) {
        var dropdown = document.getElementById('add-pl-dropdown');
        if (!dropdown?.classList.contains('show')) return;
        if (!dropdown.contains(e.target) && !e.target.closest('#mini-add-pl-btn') && !e.target.closest('#page-add-pl-btn')) closeDropdown();
    });

    document.addEventListener('keydown', function(e) {
        var tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        switch(e.key) {
            case 'Escape': document.getElementById('modal-overlay')?.classList.remove('show'); closeDropdown(); break;
            case 'ArrowUp': e.preventDefault(); setVolume(Math.min(100, currentVolume + 5)); window.showToast('Громкость: ' + currentVolume + '%'); break;
            case 'ArrowDown': e.preventDefault(); setVolume(Math.max(0, currentVolume - 5)); window.showToast('Громкость: ' + currentVolume + '%'); break;
            case 'ArrowRight': e.preventDefault(); playNext(); break;
            case 'ArrowLeft': e.preventDefault(); playPrev(); break;
            case ' ': e.preventDefault(); togglePlay(); break;
        }
    });

    window.toggleCreatePlDropdown = toggleCreatePlDropdown;
    window.toggleAddPlDropdown = toggleAddPlDropdown;
    window.renderAddPlList = renderAddPlList;
    console.log('✅ Player loaded');
    if (window.__cw?.flush) window.__cw.flush();
});

function updateFullVolumeFromClick(e) {
    if (!fullVolumeSliderTrack) return;
    var rect = fullVolumeSliderTrack.getBoundingClientRect();
    setVolume(Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100));
}
function updatePageVolumeFromClick(e) {
    var track = document.getElementById('page-volume-slider-track'); if (!track) return;
    var rect = track.getBoundingClientRect();
    setVolume(Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100));
}

window.showToast = function(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
};

window.updateMiniPlayerFav = function() { updatePlayerFav('mini-fav-btn', currentTrack); };