#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![show_mini, show_main_window])
        .setup(|app| {
            build_tray(app.handle())?;
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
}

#[tauri::command]
fn show_main_window(app: AppHandle) {
    focus_main(&app);
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
