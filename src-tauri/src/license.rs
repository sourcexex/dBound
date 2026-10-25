use std::process::Command;

const SERIAL: &str = "142857";
const REG_KEY: &str = "HKCU\\Software\\dBound";
const REG_VALUE: &str = "License";

fn registry_has_license() -> bool {
    Command::new("reg")
        .args(["query", REG_KEY, "/v", REG_VALUE])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn license_status() -> bool {
    registry_has_license()
}

/// Writes the activation marker that the NSIS installer also creates.
/// Copying an installed folder to another machine leaves this key behind,
/// so the app asks for the serial again.
#[tauri::command]
pub fn activate_license(serial: String) -> Result<bool, String> {
    if serial.trim() != SERIAL {
        return Ok(false);
    }
    let status = Command::new("reg")
        .args([
            "add",
            REG_KEY,
            "/v",
            REG_VALUE,
            "/t",
            "REG_SZ",
            "/d",
            "1",
            "/f",
        ])
        .status()
        .map_err(|error| error.to_string())?;
    Ok(status.success())
}
