use serde_json::Value;
use std::time::Duration;

const CLIENT_ID: &str = "yNSW5UvBmb1A5j7qPUtIMuB9Itx3jsOC";
const BASE_URL: &str = "https://api-v2.soundcloud.com";

pub async fn fetch_json(url: &str) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    response.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_tracks(query: String, limit: u32, offset: u32) -> Result<Value, String> {
    let url = format!(
        "{}/search/tracks?client_id={}&q={}&limit={}&offset={}",
        BASE_URL, CLIENT_ID, urlencoding::encode(&query), limit, offset
    );
    fetch_json(&url).await
}

#[tauri::command]
pub async fn search_playlists(query: String, limit: u32, offset: u32) -> Result<Value, String> {
    let url = format!(
        "{}/search/playlists?client_id={}&q={}&limit={}&offset={}",
        BASE_URL, CLIENT_ID, urlencoding::encode(&query), limit, offset
    );
    fetch_json(&url).await
}

#[tauri::command]
pub async fn get_user_tracks(user_id: String) -> Result<Value, String> {
    let url = format!(
        "{}/users/{}/tracks?client_id={}&limit=50",
        BASE_URL, user_id, CLIENT_ID
    );
    fetch_json(&url).await
}

#[tauri::command]
pub async fn get_playlist_tracks(url_or_id: String) -> Result<Value, String> {
    let id = url_or_id.split('/').last().unwrap_or(&url_or_id);
    let mut all_tracks: Vec<Value> = Vec::new();
    let mut offset = 0u64;
    
    loop {
        let url = format!(
            "{}/playlists/{}?client_id={}&limit=500&offset={}",
            BASE_URL, id, CLIENT_ID, offset
        );
        if let Ok(page) = fetch_json(&url).await {
            if let Some(tracks) = page["tracks"].as_array() {
                if tracks.is_empty() { break; }
                all_tracks.extend(tracks.clone());
            } else { break; }
        } else { break; }
        offset += 500;
    }
    
    Ok(serde_json::json!({ "tracks": all_tracks }))
}

#[tauri::command]
pub async fn get_popular(artists: Vec<String>) -> Result<Value, String> {
    let mut all_tracks = Vec::new();
    let mut seen = std::collections::HashSet::new();
    
    for artist in artists.iter().take(15) {
        let url = format!(
            "{}/search/tracks?client_id={}&q={}&limit=3&offset=0",
            BASE_URL, CLIENT_ID, urlencoding::encode(artist)
        );
        if let Ok(data) = fetch_json(&url).await {
            if let Some(collection) = data["collection"].as_array() {
                for track in collection.iter().take(2) {
                    if let Some(id) = track["id"].as_u64() {
                        if seen.insert(id) && track["duration"].as_u64().unwrap_or(0) > 30000 {
                            all_tracks.push(track.clone());
                        }
                    }
                }
            }
        }
    }
    
    Ok(serde_json::json!(all_tracks))
}

#[tauri::command]
pub async fn get_my_wave(history_artists: Vec<String>) -> Result<Value, String> {
    let mut all_tracks = Vec::new();
    let mut seen = std::collections::HashSet::new();
    
    for artist in history_artists.iter().take(5) {
        let url = format!(
            "{}/search/tracks?client_id={}&q={}&limit=3&offset=0",
            BASE_URL, CLIENT_ID, urlencoding::encode(artist)
        );
        if let Ok(data) = fetch_json(&url).await {
            if let Some(collection) = data["collection"].as_array() {
                for track in collection.iter().take(2) {
                    if let Some(id) = track["id"].as_u64() {
                        if seen.insert(id) && track["duration"].as_u64().unwrap_or(0) > 30000 {
                            all_tracks.push(track.clone());
                        }
                    }
                }
            }
        }
    }
    
    Ok(serde_json::json!(all_tracks))
}

#[tauri::command]
pub async fn fetch_url(url: String) -> Result<Value, String> {
    fetch_json(&url).await
}