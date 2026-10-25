use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
use winreg::RegKey;

const SERIAL: &str = "142857";
const REG_KEY: &str = "Software\\dBound";
const REG_VALUE: &str = "License";

/// Read once, then answer instantly: spawning `reg.exe` on every start was the
/// slow part of opening the app.
static LICENSE_OK: AtomicBool = AtomicBool::new(false);
static CHECKED: OnceLock<()> = OnceLock::new();

fn read_marker() -> bool {
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(REG_KEY, KEY_READ)
        .and_then(|key| key.get_value::<String, _>(REG_VALUE))
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

fn ensure_checked() -> bool {
    CHECKED.get_or_init(|| LICENSE_OK.store(read_marker(), Ordering::Relaxed));
    LICENSE_OK.load(Ordering::Relaxed)
}

/// Called from the app setup so the value is already warm when the UI asks.
pub fn prime() {
    ensure_checked();
}

/// Used by the window/tray handlers: a locked install may not open the
/// mini or fullscreen windows, and closing the window quits the app.
pub fn is_active() -> bool {
    ensure_checked()
}

#[tauri::command]
pub fn license_status() -> bool {
    ensure_checked()
}

#[tauri::command]
pub fn activate_license(serial: String) -> Result<bool, String> {
    if serial.trim() != SERIAL {
        return Ok(false);
    }
    let key = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(REG_KEY)
        .map_err(|error| error.to_string())?;
    key.0
        .set_value(REG_VALUE, &"1".to_string())
        .map_err(|error| error.to_string())?;
    // Also allow runtime activation without a restart.
    LICENSE_OK.store(true, Ordering::Relaxed);
    let _ = CHECKED.set(());
    Ok(true)
}
