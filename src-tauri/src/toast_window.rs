//! Always-on-top overlay window for quick-hotkey progress (visible when main app is minimized).

use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

pub const TOAST_WINDOW_LABEL: &str = "quick-hotkey-toast";

const MARGIN_X: f64 = 16.0;
const MARGIN_Y: f64 = 56.0;

pub fn show(app: &AppHandle) -> Result<(), String> {
    let window = toast_window(app)?;
    position_bottom_right(&window)?;
    window
        .set_always_on_top(true)
        .map_err(|e| format!("always on top: {e}"))?;
    window.show().map_err(|e| format!("show toast: {e}"))?;
    Ok(())
}

pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(TOAST_WINDOW_LABEL) {
        let _ = window.hide();
    }
}

fn toast_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(TOAST_WINDOW_LABEL)
        .ok_or_else(|| format!("brak okna {TOAST_WINDOW_LABEL}"))
}

fn position_bottom_right(window: &WebviewWindow) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| format!("monitor: {e}"))?
        .ok_or_else(|| "nie wykryto monitora".to_string())?;
    let screen = monitor.size();
    let scale = monitor.scale_factor();
    let win = window.outer_size().map_err(|e| format!("outer size: {e}"))?;
    let x = screen.width as f64 - win.width as f64 - MARGIN_X * scale;
    let y = screen.height as f64 - win.height as f64 - MARGIN_Y * scale;
    window
        .set_position(PhysicalPosition::new(x.max(0.0), y.max(0.0)))
        .map_err(|e| format!("position: {e}"))?;
    Ok(())
}
