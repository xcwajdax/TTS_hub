use std::path::PathBuf;

use serde::Serialize;

use crate::audio::{write_audio, AudioFormat};
use crate::google::{TtsRequest, VOICES};
use crate::paths::AppPaths;
use crate::state::AppState;

pub const SAMPLE_TEXT: &str = "This is a voice preview.";

#[derive(Debug, Clone, Serialize)]
pub struct VoiceSampleInfo {
    pub voice: String,
    pub ready: bool,
}

pub fn sanitize_model_id(model: &str) -> String {
    model
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

pub fn sample_path(paths: &AppPaths, model: &str, voice: &str) -> PathBuf {
    paths
        .voice_samples
        .join(sanitize_model_id(model))
        .join(format!("{voice}.wav"))
}

pub fn is_known_voice(voice: &str) -> bool {
    VOICES.iter().any(|v| *v == voice)
}

pub fn list_status(paths: &AppPaths, model: &str) -> Vec<VoiceSampleInfo> {
    VOICES
        .iter()
        .map(|v| {
            let voice = (*v).to_string();
            let ready = sample_path(paths, model, &voice).is_file();
            VoiceSampleInfo { voice, ready }
        })
        .collect()
}

pub async fn ensure_sample(state: &AppState, model: &str, voice: &str) -> Result<PathBuf, String> {
    if !is_known_voice(voice) {
        return Err(format!("unknown voice: {voice}"));
    }
    let path = {
        let paths = state.paths.read().map_err(|e| e.to_string())?;
        sample_path(&paths, model, voice)
    };
    if path.is_file() {
        return Ok(path);
    }
    generate_sample(state, model, voice).await?;
    Ok(path)
}

pub async fn generate_sample(state: &AppState, model: &str, voice: &str) -> Result<(), String> {
    if !is_known_voice(voice) {
        return Err(format!("unknown voice: {voice}"));
    }

    let tts_req = TtsRequest {
        model: model.to_string(),
        text: SAMPLE_TEXT.to_string(),
        voice: voice.to_string(),
        style: None,
        multi_speaker: None,
    };

    let result = state
        .tts
        .synthesize(&tts_req)
        .await
        .map_err(|e| e.to_string())?;
    let paths = state.paths.read().map_err(|e| e.to_string())?;
    let path = sample_path(&paths, model, voice);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let dir = path
        .parent()
        .ok_or_else(|| "invalid sample path".to_string())?;
    write_audio(&result, dir, voice, AudioFormat::Wav).map_err(|e| e.to_string())?;
    Ok(())
}
