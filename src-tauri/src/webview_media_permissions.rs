//! WebView2 blocks `enumerateDevices()` audiooutput until speaker-selection/mic permissions are granted.

use tauri::{AppHandle, Manager, WebviewWindow};

#[cfg(windows)]
const PLAYBACK_WEBVIEW_LABELS: &[&str] = &["main", "quick-setup"];

#[cfg(windows)]
const STATIC_PERMISSION_ORIGINS: &[&str] = &[
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://asset.localhost",
    "https://asset.localhost",
];

#[cfg(windows)]
fn permission_origins_for_window(window: &WebviewWindow) -> Vec<String> {
    let mut origins: Vec<String> = STATIC_PERMISSION_ORIGINS
        .iter()
        .map(|s| (*s).to_string())
        .collect();

    if let Ok(url) = window.url() {
        if let Some(host) = url.host_str() {
            let mut origin = format!("{}://{}", url.scheme(), host);
            if let Some(port) = url.port() {
                origin = format!("{origin}:{port}");
            }
            if !origins.iter().any(|o| o == &origin) {
                origins.push(origin);
            }
        }
    }

    origins
}

#[cfg(windows)]
fn grant_microphone_for_window(window: &WebviewWindow, label: &str) {
    let label = label.to_string();
    let origins = permission_origins_for_window(window);
    let _ = window.with_webview(move |platform| {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2Profile4, ICoreWebView2_13, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
            COREWEBVIEW2_PERMISSION_STATE_ALLOW,
        };
        use windows::core::{Interface, PCWSTR};

        let controller = platform.controller();
        let result = (|| -> windows::core::Result<()> {
            let core = unsafe { controller.CoreWebView2()? };
            let core13: ICoreWebView2_13 = core.cast()?;
            let profile = unsafe { core13.Profile()? };
            let profile4: ICoreWebView2Profile4 = profile.cast()?;

            for origin in &origins {
                let wide: Vec<u16> = origin.encode_utf16().chain(std::iter::once(0)).collect();
                let origin_w = PCWSTR::from_raw(wide.as_ptr());
                let _ = unsafe {
                    profile4.SetPermissionState(
                        COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
                        origin_w,
                        COREWEBVIEW2_PERMISSION_STATE_ALLOW,
                        None,
                    )
                };
            }
            Ok(())
        })();

        if let Err(e) = result {
            eprintln!("[webview] prepare_audio_device_enumeration ({label}): {e:#}");
        }
    });
}

#[cfg(windows)]
pub fn grant_microphone_for_playback_webviews(app: &AppHandle) {
    for label in PLAYBACK_WEBVIEW_LABELS {
        if let Some(window) = app.get_webview_window(label) {
            grant_microphone_for_window(&window, label);
        }
    }
}

#[cfg(not(windows))]
pub fn grant_microphone_for_playback_webviews(_app: &AppHandle) {}
