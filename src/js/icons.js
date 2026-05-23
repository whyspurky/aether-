// icons.js

const CWIcons = {
    list: {}
};

(function loadAllIconsSync() {
    const names = [
        'play', 'pause',
        'skip-forward', 'skip-back',
        'shuffle', 'repeat', 'repeat-1',
        'volume-2', 'volume-1', 'volume-x',
        'heart', 'plus-circle', 'x-circle', 'trash-2', 'download',
        'arrow-left', 'expand',
        'home', 'search', 'library', 'music', 'mic', 'folder', 'flame',
        'check-circle', 'alert-circle', 'audio-lines',
        'settings', 'circle-user-round', 'plus', 'pencil', 'x', 'check', 'ellipsis-vertical'
    ];
    
    names.forEach(function(name) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'assets/icons/lucide/' + name + '.svg', false);
            xhr.send();
            if (xhr.status === 200) {
                CWIcons.list[name] = xhr.responseText;
            }
        } catch (e) {
            console.warn('Не загружена иконка:', name);
        }
    });
})();

function cwIcon(name, cls) {
    cls = cls || '';
    var span = document.createElement('span');
    span.className = 'cw-icon' + (cls ? ' ' + cls : '');
    span.innerHTML = CWIcons.list[name] || '';
    return span;
}

function cwIconHTML(name, cls) {
    cls = cls || '';
    return '<span class="cw-icon' + (cls ? ' ' + cls : '') + '">' + (CWIcons.list[name] || '') + '</span>';
}

function animateIcon(element, animation) {
    if (!element) return;
    var svg = element.querySelector('svg') || element;
    
    if (animation === 'heartBeat') {
        svg.style.transition = 'none';
        svg.style.transform = 'scale(1.3)';
        setTimeout(function() {
            svg.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
            svg.style.transform = 'scale(1)';
        }, 150);
    }
    
    if (animation === 'click') {
        svg.style.transition = 'none';
        svg.style.transform = 'scale(0.85)';
        setTimeout(function() {
            svg.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
            svg.style.transform = 'scale(1)';
        }, 100);
    }
}

window.CWIcons = CWIcons;
window.cwIcon = cwIcon;
window.cwIconHTML = cwIconHTML;
window.animateIcon = animateIcon;

console.log('✅ icons.js');