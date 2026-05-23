//! Dedicated window for the quick-setup wizard (opened from Settings).

use tauri::{AppHandle, Manager};

pub const QUICK_SETUP_WINDOW_LABEL: &str = "quick-setup";

pub fn open(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(QUICK_SETUP_WINDOW_LABEL) {
        window
            .show()
            .map_err(|e| format!("show quick-setup: {e}"))?;
        window
            .set_focus()
            .map_err(|e| format!("focus quick-setup: {e}"))?;
        return Ok(());
    }
    Err(format!(
        "brak okna {QUICK_SETUP_WINDOW_LABEL} — uruchom ponownie aplikację"
    ))
}

pub fn close(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(QUICK_SETUP_WINDOW_LABEL) {
        let _ = window.close();
    }
}
