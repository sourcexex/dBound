use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

fn default_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("recordings");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn evidence_default_dir(app: AppHandle) -> Result<String, String> {
    Ok(default_dir(&app)?.to_string_lossy().to_string())
}

/// Writes an evidence recording to the configured folder (or the app default).
/// The audio only ever reaches this command after an alert rule fired.
#[tauri::command]
pub fn save_evidence(
    app: AppHandle,
    dir: Option<String>,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let base = match dir {
        Some(value) if !value.trim().is_empty() => {
            let path = PathBuf::from(value.trim());
            fs::create_dir_all(&path).map_err(|error| error.to_string())?;
            path
        }
        _ => default_dir(&app)?,
    };

    let sanitized: String = filename
        .chars()
        .map(|character| match character {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            other => other,
        })
        .collect();
    let name = if sanitized.trim().is_empty() {
        "evidence.wav".to_string()
    } else {
        sanitized
    };

    let path = base.join(name);
    fs::write(&path, data).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
