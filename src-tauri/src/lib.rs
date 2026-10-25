mod evidence;
mod license;
mod logs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Remember window position/size only – never restore the VISIBLE flag, otherwise
    // the mini capsule (or the fullscreen window) pops up on the next launch.
    let window_state_flags =
        tauri_plugin_window_state::StateFlags::POSITION | tauri_plugin_window_state::StateFlags::SIZE;

    tauri::Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window_state_flags)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .manage(logs::LogState::new())
        .invoke_handler(tauri::generate_handler![
            show_mini,
            show_main_window,
            show_fullscreen,
            evidence::evidence_default_dir,
            license::activate_license,
            license::license_status,
            evidence::save_evidence,
            logs::log_append,
            logs::log_days,
            logs::log_read,
            logs::log_clear,
            logs::log_export,
            logs::log_dir
        ])
        .setup(|app| {
            // Warm the license cache before the webview asks for it (no reg.exe spawn).
            license::prime();
            build_tray(app.handle())?;
            // Secondary windows are configured as hidden; make sure that still holds
            // even if a previous session left them on screen.
            for label in [MINI_LABEL, FULL_LABEL] {
                if let Some(window) = app.get_webview_window(label) {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window parks the app in the tray instead of quitting.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running dBound");
}

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, LogicalPosition, Manager,
};

const MINI_LABEL: &str = "mini";
const MAIN_LABEL: &str = "main";
const FULL_LABEL: &str = "full";
const MINI_WIDTH: f64 = 158.0;
/// Sentinel position from tauri.conf.json; if the window is still there the
/// window-state plugin restored nothing, so park it in the top-right corner.
const MINI_SENTINEL: i32 = -10000;

fn focus_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    if let Some(mini) = app.get_webview_window(MINI_LABEL) {
        let _ = mini.hide();
    }
    if let Some(full) = app.get_webview_window(FULL_LABEL) {
        let _ = full.set_fullscreen(false);
        let _ = full.hide();
    }
}

#[tauri::command]
fn show_main_window(app: AppHandle) {
    focus_main(&app);
}

#[tauri::command]
fn show_fullscreen(app: AppHandle) -> Result<(), String> {
    let full = app
        .get_webview_window(FULL_LABEL)
        .ok_or_else(|| "fullscreen window is not configured".to_string())?;

    if let Some(main) = app.get_webview_window(MAIN_LABEL) {
        let _ = main.hide();
    }
    if let Some(mini) = app.get_webview_window(MINI_LABEL) {
        let _ = mini.hide();
    }

    full.set_fullscreen(true).map_err(|error| error.to_string())?;
    full.show().map_err(|error| error.to_string())?;
    full.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
fn show_mini(app: AppHandle) -> Result<(), String> {
    let mini = app
        .get_webview_window(MINI_LABEL)
        .ok_or_else(|| "mini window is not configured".to_string())?;

    let moved = mini
        .outer_position()
        .map(|position| position.x <= MINI_SENTINEL)
        .unwrap_or(true);

    if moved {
        if let Ok(Some(monitor)) = app.primary_monitor() {
            let scale = monitor.scale_factor();
            let width = monitor.size().width as f64 / scale;
            let _ = mini.set_position(LogicalPosition::new(width - MINI_WIDTH - 24.0, 24.0));
        }
    }

    mini.show().map_err(|error| error.to_string())?;
    mini.set_focus().map_err(|error| error.to_string())?;

    if let Some(main) = app.get_webview_window(MAIN_LABEL) {
        let _ = main.hide();
    }
    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let mini = MenuItem::with_id(app, "mini", "迷你窗", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "退出 dBound", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &mini, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id("dbound-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("dBound")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => focus_main(app),
            "mini" => {
                if let Err(error) = show_mini(app.clone()) {
                    eprintln!("failed to open mini window: {error}");
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}
