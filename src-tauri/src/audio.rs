use anyhow::{anyhow, Context, Result};
use hound::{SampleFormat, WavSpec, WavWriter};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::google::TtsResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioFormat {
    Wav,
    Mp3,
    Ogg,
}

impl AudioFormat {
    pub fn ext(self) -> &'static str {
        match self {
            AudioFormat::Wav => "wav",
            AudioFormat::Mp3 => "mp3",
            AudioFormat::Ogg => "ogg",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "wav" => Some(Self::Wav),
            "mp3" => Some(Self::Mp3),
            "ogg" => Some(Self::Ogg),
            _ => None,
        }
    }
}

pub struct WrittenAudio {
    pub path: PathBuf,
    pub duration_ms: u64,
}

pub struct WrittenDownloadedAudio {
    pub path: PathBuf,
    pub format: AudioFormat,
}

pub fn write_audio(
    tts: &TtsResult,
    out_dir: &Path,
    file_stem: &str,
    format: AudioFormat,
) -> Result<WrittenAudio> {
    std::fs::create_dir_all(out_dir)?;
    let wav_path = out_dir.join(format!("{file_stem}.wav"));
    write_wav(tts, &wav_path)?;
    let duration_ms = pcm_duration_ms(tts);

    match format {
        AudioFormat::Wav => Ok(WrittenAudio {
            path: wav_path,
            duration_ms,
        }),
        AudioFormat::Mp3 | AudioFormat::Ogg => {
            let final_path = out_dir.join(format!("{file_stem}.{}", format.ext()));
            ensure_ffmpeg()?;
            convert_with_ffmpeg(&wav_path, &final_path, format)?;
            let _ = std::fs::remove_file(&wav_path);
            Ok(WrittenAudio {
                path: final_path,
                duration_ms,
            })
        }
    }
}

pub fn write_downloaded_audio(
    bytes: &[u8],
    source_format: AudioFormat,
    out_dir: &Path,
    file_stem: &str,
    target_format: AudioFormat,
) -> Result<WrittenDownloadedAudio> {
    std::fs::create_dir_all(out_dir)?;
    let source_path = out_dir.join(format!("{file_stem}.{}", source_format.ext()));
    std::fs::write(&source_path, bytes)
        .with_context(|| format!("cannot write downloaded audio to {}", source_path.display()))?;

    if source_format == target_format {
        return Ok(WrittenDownloadedAudio {
            path: source_path,
            format: source_format,
        });
    }

    let target_path = out_dir.join(format!("{file_stem}.{}", target_format.ext()));
    convert_audio_file(&source_path, &target_path, target_format)?;
    let _ = std::fs::remove_file(&source_path);
    Ok(WrittenDownloadedAudio {
        path: target_path,
        format: target_format,
    })
}

fn write_wav(tts: &TtsResult, path: &Path) -> Result<()> {
    let spec = WavSpec {
        channels: tts.channels,
        sample_rate: tts.sample_rate,
        bits_per_sample: tts.bits_per_sample,
        sample_format: SampleFormat::Int,
    };
    let mut writer = WavWriter::create(path, spec)
        .with_context(|| format!("cannot create wav at {}", path.display()))?;

    match tts.bits_per_sample {
        16 => {
            let bytes = &tts.pcm_bytes;
            let mut i = 0;
            while i + 1 < bytes.len() {
                let sample = i16::from_le_bytes([bytes[i], bytes[i + 1]]);
                writer.write_sample(sample)?;
                i += 2;
            }
        }
        _ => {
            for &b in &tts.pcm_bytes {
                writer.write_sample(b as i32)?;
            }
        }
    }
    writer.finalize()?;
    Ok(())
}

fn pcm_duration_ms(tts: &TtsResult) -> u64 {
    let bytes_per_sample = (tts.bits_per_sample as u64) / 8;
    let total_samples = if bytes_per_sample == 0 {
        0
    } else {
        tts.pcm_bytes.len() as u64 / bytes_per_sample / tts.channels as u64
    };
    if tts.sample_rate == 0 {
        0
    } else {
        total_samples * 1000 / tts.sample_rate as u64
    }
}

pub fn ensure_ffmpeg() -> Result<()> {
    let probe = Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    match probe {
        Ok(s) if s.success() => Ok(()),
        _ => Err(anyhow!("ffmpeg is required for MP3/OGG export. Install it and add to PATH (https://ffmpeg.org).")),
    }
}

pub fn convert_audio_file(src: &Path, dst: &Path, format: AudioFormat) -> Result<()> {
    if format == AudioFormat::Wav && src.extension().and_then(|e| e.to_str()) == Some("wav") {
        std::fs::copy(src, dst)
            .with_context(|| format!("cannot copy {} to {}", src.display(), dst.display()))?;
        return Ok(());
    }
    ensure_ffmpeg()?;
    convert_with_ffmpeg(src, dst, format)
}

fn convert_with_ffmpeg(src: &Path, dst: &Path, format: AudioFormat) -> Result<()> {
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
        .arg("-loglevel")
        .arg("error")
        .arg("-i")
        .arg(src);
    match format {
        AudioFormat::Mp3 => {
            cmd.arg("-codec:a").arg("libmp3lame").arg("-q:a").arg("2");
        }
        AudioFormat::Ogg => {
            cmd.arg("-codec:a").arg("libvorbis").arg("-q:a").arg("5");
        }
        AudioFormat::Wav => {}
    }
    cmd.arg(dst);

    let output = cmd.output().context("failed to spawn ffmpeg")?;
    if !output.status.success() {
        return Err(anyhow!(
            "ffmpeg failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
