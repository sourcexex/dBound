use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// One line in the JSONL log. Samples are written once per second while measuring,
/// alert entries are written on every level transition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub ts: u64,
    pub kind: String,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub db: Option<f64>,
    #[serde(default)]
    pub text: String,
    /// Local calendar day (YYYY-MM-DD) supplied by the frontend, used as the file name.
    #[serde(default)]
    pub day: String,
}

pub struct LogState {
    pruned: Mutex<bool>,
}

impl LogState {
    pub fn new() -> Self {
        Self {
            pruned: Mutex::new(false),
        }
    }
}

const RETENTION_DAYS: usize = 7;
const MAX_TOTAL_BYTES: u64 = 20 * 1024 * 1024;

fn logs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("logs");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn log_files(dir: &PathBuf) -> Vec<(PathBuf, String, u64)> {
    let mut files: Vec<(PathBuf, String, u64)> = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return files;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("jsonl") {
            continue;
        }
        let Some(stem) = path
            .file_stem()
            .and_then(|value| value.to_str())
            .map(|value| value.to_string())
        else {
            continue;
        };
        let size = entry.metadata().map(|meta| meta.len()).unwrap_or(0);
        files.push((path, stem, size));
    }
    files.sort_by(|left, right| right.1.cmp(&left.1));
    files
}

fn prune(dir: &PathBuf) {
    let mut files = log_files(dir);

    // Keep at most RETENTION_DAYS files (names are ISO dates, so newest sort first).
    while files.len() > RETENTION_DAYS {
        if let Some((path, _, _)) = files.pop() {
            let _ = fs::remove_file(path);
        }
    }

    // Then enforce a total size budget, dropping the oldest files first.
    let mut total: u64 = files.iter().map(|(_, _, size)| *size).sum();
    while total > MAX_TOTAL_BYTES && files.len() > 1 {
        if let Some((path, _, size)) = files.pop() {
            let _ = fs::remove_file(&path);
            total = total.saturating_sub(size);
        }
    }
}

#[tauri::command]
pub fn log_append(app: AppHandle, entries: Vec<LogEntry>) -> Result<(), String> {
    if entries.is_empty() {
        return Ok(());
    }
    let dir = logs_dir(&app)?;

    for entry in &entries {
        let day = if entry.day.is_empty() {
            "unknown".to_string()
        } else {
            entry.day.clone()
        };
        let path = dir.join(format!("{day}.jsonl"));
        let line = serde_json::to_string(entry).map_err(|error| error.to_string())?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|error| error.to_string())?;
        file.write_all(line.as_bytes())
            .and_then(|_| file.write_all(b"\n"))
            .map_err(|error| error.to_string())?;
    }

    let state = app.state::<LogState>();
    let needs_prune = {
        let mut pruned = state.pruned.lock().map_err(|error| error.to_string())?;
        if *pruned {
            false
        } else {
            *pruned = true;
            true
        }
    };
    if needs_prune {
        prune(&dir);
    }
    Ok(())
}

#[tauri::command]
pub fn log_days(app: AppHandle) -> Result<Vec<String>, String> {
    let dir = logs_dir(&app)?;
    Ok(log_files(&dir)
        .into_iter()
        .map(|(_, stem, _)| stem)
        .collect())
}

#[tauri::command]
pub fn log_read(app: AppHandle, day: String, limit: usize) -> Result<Vec<LogEntry>, String> {
    let dir = logs_dir(&app)?;
    let path = dir.join(format!("{day}.jsonl"));
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let mut entries: Vec<LogEntry> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<LogEntry>(line).ok())
        .collect();
    if limit > 0 && entries.len() > limit {
        entries = entries.split_off(entries.len() - limit);
    }
    Ok(entries)
}

#[tauri::command]
pub fn log_clear(app: AppHandle) -> Result<(), String> {
    let dir = logs_dir(&app)?;
    for (path, _, _) in log_files(&dir) {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

#[tauri::command]
pub fn log_export(path: String, content: String) -> Result<(), String> {
    fs::write(PathBuf::from(path), content).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn log_dir(app: AppHandle) -> Result<String, String> {
    Ok(logs_dir(&app)?.to_string_lossy().to_string())
}
