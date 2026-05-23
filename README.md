```markdown
# Aether

Десктопный музыкальный плеер для SoundCloud с оффлайн-кэшированием, встроенной библиотекой и минималистичным дизайном.

![Aether](https://img.shields.io/badge/platform-Windows-blue) ![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131) ![Rust](https://img.shields.io/badge/Rust-1.77-DEA584) ![License](https://img.shields.io/badge/license-MIT-green)

## Возможности

- 🎵 **Прослушивание SoundCloud** — поиск треков, плейлистов, артистов
- 📂 **Библиотека** — избранное, история, пользовательские плейлисты
- 🌊 **Моя волна** — персональные рекомендации на основе истории
- 💾 **Оффлайн-кэш** — сохранение треков в IndexedDB
- 🎨 **Минималистичный UI** — тёмная тема, плавные анимации
- ⌨️ **Медиа-клавиши** — Play/Pause, Next, Previous
- 🪶 **Лёгкий** — установщик ~5 МБ

## Технологии

- **[Tauri v2](https://tauri.app)** — нативный Rust-бэкенд + WebView
- **[reqwest](https://crates.io/crates/reqwest)** — HTTP-запросы к SoundCloud API
- **Vanilla JS** — без фреймворков, чистый DOM
- **IndexedDB** — кэширование аудио
- **SoundCloud Widget** — потоковое воспроизведение

## Установка

Скачай последний `.msi` из [Releases](https://github.com/whyspurky/aether/releases) и запусти.

## Разработка

```bash
git clone https://github.com/whyspurky/aether.git
cd aether
npm install
npm run tauri dev
```

## Сборка

```bash
npm run tauri build
```

Установщик будет в `src-tauri/target/release/bundle/nsis/`.

## Структура проекта

```
src/                    # Фронтенд (HTML, CSS, JS)
  js/
    core.js             # Шина событий
    storage.js          # localStorage (плейлисты, избранное, история)
    api.js              # SoundCloud API через Tauri-команды
    icons.js            # SVG-иконки Lucide
    cache.js            # IndexedDB кэш аудио
    player.js           # Аудиоплеер + очередь
    ui.js               # Рендеринг треков, карточек
    main.js             # Роутинг, поиск, библиотека
src-tauri/              # Rust-бэкенд
  src/
    api.rs              # Прямые запросы к SoundCloud
    lib.rs              # Точка входа Tauri
```
