window.__cw = {
    _queue: [],
    
    player: {
        play: function(track, queue, index, source) {
            if (window.PlayerAPI && window.PlayerAPI.play) {
                window.PlayerAPI.play(track, queue, index, source);
            } else {
                console.log('⏳ Трек в очереди:', track?.title);
                window.__cw._queue.push(['play', arguments]);
            }
        },
        toggle: function() {
            if (window.PlayerAPI && window.PlayerAPI.toggle) {
                window.PlayerAPI.toggle();
            } else {
                window.__cw._queue.push(['toggle', arguments]);
            }
        },
        next: function() {
            if (window.PlayerAPI && window.PlayerAPI.next) {
                window.PlayerAPI.next();
            } else {
                window.__cw._queue.push(['next', arguments]);
            }
        },
        prev: function() {
            if (window.PlayerAPI && window.PlayerAPI.prev) {
                window.PlayerAPI.prev();
            } else {
                window.__cw._queue.push(['prev', arguments]);
            }
        }
    },
    
    flush: function() {
        console.log('✅ core.js');
        window.__cw._queue.forEach(item => {
            const [method, args] = item;
            if (window.PlayerAPI && window.PlayerAPI[method]) {
                window.PlayerAPI[method](...args);
            }
        });
        window.__cw._queue = [];
    }
};