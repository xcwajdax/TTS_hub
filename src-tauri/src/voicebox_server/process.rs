//! Tracked Voicebox backend child (dev Python or release sidecar).

use std::process::Child;

#[cfg(not(debug_assertions))]
use tauri_plugin_shell::process::CommandChild;

pub enum VoiceboxServerProcess {
    Dev(Child),
    #[cfg(not(debug_assertions))]
    Sidecar(CommandChild),
}

impl VoiceboxServerProcess {
    pub fn stop(self) {
        match self {
            Self::Dev(mut child) => {
                let _ = child.kill();
                let _ = child.wait();
            }
            #[cfg(not(debug_assertions))]
            Self::Sidecar(child) => {
                let _ = child.kill();
            }
        }
    }
}

pub fn stop_process(slot: &std::sync::Mutex<Option<VoiceboxServerProcess>>) {
    if let Ok(mut guard) = slot.lock() {
        if let Some(proc) = guard.take() {
            proc.stop();
        }
    }
}
