//! Windows audio output enumeration (WASAPI via cpal) when WebView2 returns an empty list.

use serde::Serialize;

pub const NATIVE_DEVICE_ID_PREFIX: &str = "native:";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioOutputDevice {
    pub id: String,
    pub label: String,
}

#[cfg(windows)]
pub fn list_native_audio_outputs() -> Result<Vec<NativeAudioOutputDevice>, String> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let host = cpal::default_host();
    let devices = host
        .output_devices()
        .map_err(|e| format!("Nie można odczytać urządzeń wyjściowych: {e}"))?;

    let mut out = Vec::new();
    for device in devices {
        let label = device
            .name()
            .map_err(|e| format!("Nie można odczytać nazwy urządzenia: {e}"))?;
        let id = format!("{NATIVE_DEVICE_ID_PREFIX}{}", urlencoding_encode(&label));
        if out.iter().any(|d: &NativeAudioOutputDevice| d.id == id) {
            continue;
        }
        out.push(NativeAudioOutputDevice { id, label });
    }

    out.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));
    Ok(out)
}

#[cfg(not(windows))]
pub fn list_native_audio_outputs() -> Result<Vec<NativeAudioOutputDevice>, String> {
    Ok(Vec::new())
}

#[cfg(windows)]
fn urlencoding_encode(s: &str) -> String {
    let mut encoded = String::new();
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}
