mod evidence;
mod license;
mod logs;

/// Remove the native Windows window frame/border.
///
/// Undecorated Tauri windows still get a thin DWM border (square on Win10,
/// rounded on Win11). Turning off non-client rendering and the Win11 accent
/// border/corner preference leaves only the rounded shape drawn by the app.
#[cfg(target_os = "windows")]
fn strip_native_frame(hwnd: isize) {
    use core::ffi::c_void;

    #[link(name = "dwmapi")]
    unsafe extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: isize,
            attribute: u32,
            value: *const c_void,
            size: u32,
        ) -> i32;
    }

    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33; // DWMWCP_DONOTROUND
    const DWMWA_BORDER_COLOR: u32 = 34; // DWMWA_COLOR_NONE
    const DWMWA_COLOR_NONE: u32 = 0xFFFF_FFFE;

    unsafe {
        let handle = hwnd;
        {
            let do_not_round: i32 = 1;
            let _ = DwmSetWindowAttribute(
                handle,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &do_not_round as *const _ as *const c_void,
                std::mem::size_of::<i32>() as u32,
            );
            let no_border: u32 = DWMWA_COLOR_NONE;
            let _ = DwmSetWindowAttribute(
                handle,
                DWMWA_BORDER_COLOR,
                &no_border as *const _ as *const c_void,
                std::mem::size_of::<u32>() as u32,
            );
        }
    }
}

/// Clip the window surface to the same rounded rectangle the UI draws.
///
/// Without this, Windows 10 paints the native square window frame behind the
/// transparent CSS corners, while Windows 11 applies its own DWM rounding.
#[cfg(target_os = "windows")]
fn apply_rounded_region(hwnd: isize, width: u32, height: u32, scale: f64, radius_css: f64) {
    #[link(name = "gdi32")]
    unsafe extern "system" {
        fn CreateRoundRectRgn(
            left: i32,
            top: i32,
            right: i32,
            bottom: i32,
            width: i32,
            height: i32,
        ) -> isize;
    }
    #[link(name = "user32")]
    unsafe extern "system" {
        fn SetWindowRgn(hwnd: isize, region: isize, redraw: i32) -> i32;
    }

    let radius = (radius_css * scale).round().max(1.0) as i32;
    let width = width as i32 + 1;
    let height = height as i32 + 1;
    let handle = hwnd;
    unsafe {
        let region = CreateRoundRectRgn(0, 0, width, height, radius * 2, radius * 2);
        if region != 0 {
            let _ = SetWindowRgn(handle, region, 1);
        }
    }
}

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
            quit_app,
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
            for label in [MAIN_LABEL, MINI_LABEL, FULL_LABEL] {
                if let Some(window) = app.get_webview_window(label) {
                    #[cfg(target_os = "windows")]
                    if let (Ok(hwnd), Ok(size), Ok(scale)) = (
                        window.hwnd(),
                        window.outer_size(),
                        window.scale_factor(),
                    ) {
                        let handle = hwnd.0 as isize;
                        strip_native_frame(handle);
                        if label != FULL_LABEL {
                            let radius = if label == MAIN_LABEL { 15.0 } else { 14.0 };
                            apply_rounded_region(handle, size.width, size.height, scale, radius);
                        }
                    }
                    if label != MAIN_LABEL {
                        let _ = window.hide();
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(target_os = "windows")]
            if let tauri::WindowEvent::ScaleFactorChanged { .. } = event {
                let radius = match window.label() {
                    MAIN_LABEL => Some(15.0),
                    MINI_LABEL => Some(14.0),
                    _ => None,
                };
                if let Some(radius) = radius {
                    if let (Ok(hwnd), Ok(size), Ok(scale)) = (
                        window.hwnd(),
                        window.outer_size(),
                        window.scale_factor(),
                    ) {
                        apply_rounded_region(
                            hwnd.0 as isize,
                            size.width,
                            size.height,
                            scale,
                            radius,
                        );
                    }
                }
            }
            // Closing the main window parks the app in the tray instead of quitting.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    if !license::is_active() {
                        // Not activated yet: closing the window must quit the app.
                        window.app_handle().exit(0);
                        return;
                    }
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
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn show_fullscreen(app: AppHandle) -> Result<(), String> {
    if !license::is_active() {
        return Err("软件尚未激活".into());
    }
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
    if !license::is_active() {
        return Err("软件尚未激活".into());
    }
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
