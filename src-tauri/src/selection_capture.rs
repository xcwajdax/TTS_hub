//! Capture selected text from the last focused non–TTS Hub window (Ctrl+C + clipboard).

const COPY_SETTLE_MS: u64 = 200;
const MODIFIER_RELEASE_MS: u64 = 40;
const FOCUS_SETTLE_MS: u64 = 50;

#[cfg(windows)]
use std::sync::atomic::{AtomicIsize, Ordering};

#[cfg(windows)]
static LAST_EXTERNAL_FG_HWND: AtomicIsize = AtomicIsize::new(0);

#[cfg(windows)]
static TRACKER_STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Polls foreground window so we know where the user selected text before a global hotkey focuses us.
#[cfg(windows)]
pub fn ensure_foreground_tracker(app: tauri::AppHandle) {
    use std::sync::atomic::Ordering::SeqCst;
    if TRACKER_STARTED.swap(true, SeqCst) {
        return;
    }
    std::thread::Builder::new()
        .name("tts-hub-fg-tracker".into())
        .spawn(move || loop {
            if let Some(hwnd) = foreground_if_external(&app) {
                LAST_EXTERNAL_FG_HWND.store(hwnd, Ordering::Relaxed);
            }
            std::thread::sleep(std::time::Duration::from_millis(40));
        })
        .ok();
}

#[cfg(windows)]
pub fn capture_selection_text(app: &tauri::AppHandle) -> Result<String, String> {
    use std::{thread, time::Duration};

    let target = resolve_target_hwnd(app)?;
    focus_window(target)?;

    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("clipboard init: {e}"))?;
    let backup = read_clipboard_text(&mut clipboard);

    // Sentinel: if Ctrl+C does nothing we must not read stale clipboard.
    let sentinel = format!("__tts_hub_cap_{}__", uuid::Uuid::new_v4());
    let _ = clipboard.set_text(&sentinel);

    release_stuck_modifiers();
    thread::sleep(Duration::from_millis(MODIFIER_RELEASE_MS));

    send_ctrl_c()?;
    thread::sleep(Duration::from_millis(COPY_SETTLE_MS));

    let captured = read_clipboard_text(&mut clipboard).unwrap_or_default();
    restore_clipboard(&mut clipboard, backup);

    let text = captured.trim();
    if text.is_empty() || text == sentinel.trim() {
        return Err(
            "Nie udało się skopiować zaznaczenia — zaznacz tekst w poprzednim oknie (poza TTS Hub) i spróbuj ponownie.".into(),
        );
    }

    Ok(text.to_string())
}

#[cfg(windows)]
fn resolve_target_hwnd(app: &tauri::AppHandle) -> Result<windows::Win32::Foundation::HWND, String> {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    unsafe {
        let fg = GetForegroundWindow();
        if !fg.0.is_null() && !is_hub_window(app, fg) {
            LAST_EXTERNAL_FG_HWND.store(hwnd_to_isize(fg), Ordering::Relaxed);
            return Ok(fg);
        }

        let stored = LAST_EXTERNAL_FG_HWND.load(Ordering::Relaxed);
        if stored != 0 {
            let hwnd = isize_to_hwnd(stored);
            if is_window_valid(hwnd) && !is_hub_window(app, hwnd) {
                return Ok(hwnd);
            }
        }

        Err(
            "Nie wykryto okna z zaznaczeniem — kliknij okno z tekstem (np. przeglądarka), zaznacz fragment i użyj skrótu.".into(),
        )
    }
}

#[cfg(windows)]
fn hwnd_to_isize(hwnd: windows::Win32::Foundation::HWND) -> isize {
    hwnd.0 as isize
}

#[cfg(windows)]
fn isize_to_hwnd(v: isize) -> windows::Win32::Foundation::HWND {
    windows::Win32::Foundation::HWND(v as _)
}

#[cfg(windows)]
fn foreground_if_external(app: &tauri::AppHandle) -> Option<isize> {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    unsafe {
        let fg = GetForegroundWindow();
        if fg.0.is_null() || is_hub_window(app, fg) {
            return None;
        }
        Some(hwnd_to_isize(fg))
    }
}

#[cfg(windows)]
fn is_hub_window(app: &tauri::AppHandle, hwnd: windows::Win32::Foundation::HWND) -> bool {
    use tauri::Manager;
    for window in app.webview_windows().values() {
        if let Ok(h) = window.hwnd() {
            if h.0 == hwnd.0 {
                return true;
            }
        }
    }
    false
}

#[cfg(windows)]
fn is_window_valid(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::IsWindow;
    unsafe { IsWindow(Some(hwnd)).as_bool() }
}

#[cfg(windows)]
fn focus_window(hwnd: windows::Win32::Foundation::HWND) -> Result<(), String> {
    use std::{thread, time::Duration};
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetWindowThreadProcessId, SetForegroundWindow, ShowWindow, SW_SHOW,
    };

    unsafe {
        let fg = hwnd;
        let fg_thread = GetWindowThreadProcessId(fg, None);
        let our_thread = GetCurrentThreadId();
        let attached = AttachThreadInput(our_thread, fg_thread, true).as_bool();
        let _ = ShowWindow(fg, SW_SHOW);
        let _ = BringWindowToTop(fg);
        if SetForegroundWindow(fg).as_bool() {
            // ok
        }
        if attached {
            let _ = AttachThreadInput(our_thread, fg_thread, false);
        }
    }
    thread::sleep(Duration::from_millis(FOCUS_SETTLE_MS));
    Ok(())
}

#[cfg(windows)]
fn release_stuck_modifiers() {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, KEYEVENTF_KEYUP, VK_CONTROL, VK_LSHIFT, VK_MENU, VK_RSHIFT,
    };
    for vk in [VK_LSHIFT, VK_RSHIFT, VK_CONTROL, VK_MENU] {
        let up = key_input(vk, KEYEVENTF_KEYUP);
        let _ = unsafe {
            SendInput(
                &[up],
                std::mem::size_of::<windows::Win32::UI::Input::KeyboardAndMouse::INPUT>() as i32,
            )
        };
    }
}

#[cfg(windows)]
fn read_clipboard_text(clipboard: &mut arboard::Clipboard) -> Option<String> {
    clipboard.get_text().ok()
}

#[cfg(windows)]
fn restore_clipboard(clipboard: &mut arboard::Clipboard, backup: Option<String>) {
    match backup {
        Some(text) => {
            let _ = clipboard.set_text(text);
        }
        None => {
            let _ = clipboard.clear();
        }
    }
}

#[cfg(windows)]
fn send_ctrl_c() -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VK_C, VK_CONTROL,
    };

    let ctrl_down = key_input(VK_CONTROL, KEYBD_EVENT_FLAGS(0));
    let c_down = key_input(VK_C, KEYBD_EVENT_FLAGS(0));
    let c_up = key_input(VK_C, KEYEVENTF_KEYUP);
    let ctrl_up = key_input(VK_CONTROL, KEYEVENTF_KEYUP);

    let inputs = [ctrl_down, c_down, c_up, ctrl_up];
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent != inputs.len() as u32 {
        return Err("Nie udało się wysłać Ctrl+C do aktywnego okna.".into());
    }
    Ok(())
}

#[cfg(windows)]
fn key_input(
    vk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY,
    flags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS,
) -> windows::Win32::UI::Input::KeyboardAndMouse::INPUT {
    use windows::Win32::UI::Input::KeyboardAndMouse::{INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT};
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(not(windows))]
pub fn ensure_foreground_tracker(_app: tauri::AppHandle) {}

#[cfg(not(windows))]
pub fn capture_selection_text(_app: &tauri::AppHandle) -> Result<String, String> {
    Err("Przechwytywanie zaznaczenia jest dostępne tylko na Windows.".into())
}
