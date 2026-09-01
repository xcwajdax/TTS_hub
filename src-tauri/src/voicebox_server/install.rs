//! Create `voicebox-backend/.venv` and install Python deps (dev bundled mode).

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use anyhow::{anyhow, bail, Context, Result};
use tauri::AppHandle;

use super::log::VoiceboxLogBuffer;
use super::manager::{dev_backend_root, dev_venv_ready};

static INSTALLING: AtomicBool = AtomicBool::new(false);

pub fn is_installing() -> bool {
    INSTALLING.load(Ordering::Relaxed)
}

pub fn install_available() -> bool {
    #[cfg(debug_assertions)]
    {
        dev_backend_root().is_some()
    }
    #[cfg(not(debug_assertions))]
    {
        false
    }
}

fn apply_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let _ = cmd;
}

fn pipe_and_wait(
    mut child: std::process::Child,
    log: &Arc<VoiceboxLogBuffer>,
    app: Option<&AppHandle>,
    label: &str,
) -> Result<()> {
    if let Some(out) = child.stdout.take() {
        let log_c = Arc::clone(log);
        let app_c = app.cloned();
        thread::spawn(move || {
            for line in BufReader::new(out).lines().flatten() {
                log_c.push_line(app_c.as_ref(), "stdout", &line);
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        let log_c = Arc::clone(log);
        let app_c = app.cloned();
        thread::spawn(move || {
            for line in BufReader::new(err).lines().flatten() {
                log_c.push_line(app_c.as_ref(), "stderr", &line);
            }
        });
    }
    let status = child
        .wait()
        .with_context(|| format!("wait for {label}"))?;
    if !status.success() {
        bail!("{label} failed with {status}");
    }
    Ok(())
}

fn run_logged(
    program: &Path,
    args: &[&str],
    cwd: &Path,
    log: &Arc<VoiceboxLogBuffer>,
    app: Option<&AppHandle>,
    label: &str,
) -> Result<()> {
    log.push_marker(app, &format!("--- {label} ---"));
    let mut cmd = Command::new(program);
    cmd.current_dir(cwd)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("PYTHONUNBUFFERED", "1");
    apply_no_window(&mut cmd);
    let child = cmd
        .spawn()
        .with_context(|| format!("spawn {label}: {} {:?}", program.display(), args))?;
    pipe_and_wait(child, log, app, label)
}

fn resolve_system_python(log: &Arc<VoiceboxLogBuffer>, app: Option<&AppHandle>) -> Result<PathBuf> {
    let probes: &[&[&str]] = if cfg!(windows) {
        &[&["py", "-3"], &["python"], &["python3"]]
    } else {
        &[&["python3"], &["python"]]
    };

    for parts in probes {
        let (prog, rest) = parts.split_first().unwrap();
        let mut cmd = Command::new(prog);
        cmd.args(rest)
            .args(["-c", "import sys; print(sys.executable)"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        apply_no_window(&mut cmd);
        match cmd.output() {
            Ok(out) if out.status.success() => {
                let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !path.is_empty() {
                    let p = PathBuf::from(&path);
                    if p.is_file() {
                        log.push_line(
                            app,
                            "stdout",
                            &format!("Using system Python: {path}"),
                        );
                        return Ok(p);
                    }
                }
            }
            _ => continue,
        }
    }
    Err(anyhow!(
        "Nie znaleziono Pythona w PATH (wypróbuj: py -3 / python / python3). Zainstaluj Python 3.11+ i spróbuj ponownie."
    ))
}

fn venv_python(backend_root: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        backend_root.join(".venv").join("Scripts").join("python.exe")
    }
    #[cfg(not(windows))]
    {
        backend_root.join(".venv").join("bin").join("python")
    }
}

/// Create `.venv` (if missing) and `pip install -r backend/requirements.txt` (+ PL engine packages).
pub fn install_dev_backend(
    log: &Arc<VoiceboxLogBuffer>,
    app: Option<&AppHandle>,
) -> Result<()> {
    if INSTALLING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        bail!("Instalacja Voice Box już trwa — zobacz zakładkę Log.");
    }
    struct ClearFlag;
    impl Drop for ClearFlag {
        fn drop(&mut self) {
            INSTALLING.store(false, Ordering::SeqCst);
        }
    }
    let _clear = ClearFlag;

    let root = dev_backend_root().ok_or_else(|| {
        anyhow!("Brak katalogu voicebox-backend w tym buildzie — instalacja dotyczy tylko trybu deweloperskiego.")
    })?;

    log.push_marker(
        app,
        &format!("--- Voice Box install start ({}) ---", root.display()),
    );

    let sys_py = resolve_system_python(log, app)?;
    let venv_py = venv_python(&root);

    if !venv_py.is_file() {
        run_logged(
            &sys_py,
            &["-m", "venv", ".venv"],
            &root,
            log,
            app,
            "python -m venv .venv",
        )?;
    } else {
        log.push_line(app, "stdout", ".venv already present — skipping venv create");
    }

    if !venv_py.is_file() {
        bail!("Po utworzeniu venv brakuje {}", venv_py.display());
    }

    run_logged(
        &venv_py,
        &["-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools"],
        &root,
        log,
        app,
        "pip upgrade",
    )?;

    let req = root.join("backend").join("requirements.txt");
    if !req.is_file() {
        bail!("Brak pliku {}", req.display());
    }
    let req_str = req.to_string_lossy().to_string();
    run_logged(
        &venv_py,
        &["-m", "pip", "install", "-r", &req_str],
        &root,
        log,
        app,
        "pip install -r backend/requirements.txt",
    )?;

    // Engine packages pin incompatible torch; install --no-deps after deps from requirements.
    for (pkg, label) in [
        ("chatterbox-tts", "pip install chatterbox-tts --no-deps"),
        ("hume-tada", "pip install hume-tada --no-deps"),
    ] {
        match run_logged(
            &venv_py,
            &["-m", "pip", "install", pkg, "--no-deps"],
            &root,
            log,
            app,
            label,
        ) {
            Ok(()) => {}
            Err(e) => {
                log.push_line(
                    app,
                    "stderr",
                    &format!(
                        "Ostrzeżenie: {label} nie powiódł się ({e:#}). Silnik może wymagać ręcznej instalacji pakietu."
                    ),
                );
            }
        }
    }

    if !dev_venv_ready() {
        bail!("Instalacja zakończona, ale .venv/python nadal niedostępny.");
    }

    log.push_marker(
        app,
        "--- Voice Box install OK — możesz uruchomić lokalny silnik ---",
    );
    Ok(())
}
