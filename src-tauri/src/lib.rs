mod api;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            let _ = app.global_shortcut().register("MediaPlayPause");
            let _ = app.global_shortcut().register("MediaNextTrack");
            let _ = app.global_shortcut().register("MediaPreviousTrack");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::search_tracks,
            api::search_playlists,
            api::get_user_tracks,
            api::get_playlist_tracks,
            api::get_popular,
            api::get_my_wave,
            api::fetch_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aether");
}