use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub fn attach<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let menu = build_menu(app.handle())?;
    app.set_menu(menu)?;
    Ok(())
}

pub fn handle_event(app: &AppHandle, event: MenuEvent) {
    let id = event.id().as_ref();

    if id == "restart" {
        let _ = app.restart();
    } else if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("menu-action", id);
    }
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let open_text = MenuItem::with_id(app, "open_text", "Otwórz tekst…", true, Some("CmdOrCtrl+O"))?;
    let open_archive =
        MenuItem::with_id(app, "open_archive", "Otwórz folder archiwum", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let save = MenuItem::with_id(app, "save", "Zapisz", true, Some("CmdOrCtrl+S"))?;
    let save_as = MenuItem::with_id(app, "save_as", "Zapisz jako…", true, Some("CmdOrCtrl+Shift+S"))?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let restart = MenuItem::with_id(app, "restart", "Uruchom ponownie", true, None::<&str>)?;
    let quit = PredefinedMenuItem::quit(app, Some("Wyjście"))?;

    let file = Submenu::with_items(
        app,
        "Plik",
        true,
        &[
            &open_text,
            &open_archive,
            &sep1,
            &save,
            &save_as,
            &sep2,
            &restart,
            &quit,
        ],
    )?;

    let settings = MenuItem::with_id(app, "settings", "Ustawienia…", true, Some("CmdOrCtrl+,"))?;
    let quick_setup =
        MenuItem::with_id(app, "quick_setup", "Szybka konfiguracja…", true, None::<&str>)?;
    let quick_hotkeys =
        MenuItem::with_id(app, "quick_hotkeys", "Szybkie skróty…", true, None::<&str>)?;
    let soundboard = MenuItem::with_id(app, "soundboard", "Soundboard…", true, None::<&str>)?;
    let edit = Submenu::with_items(
        app,
        "Edycja",
        true,
        &[&settings, &quick_setup, &quick_hotkeys, &soundboard],
    )?;

    let about = MenuItem::with_id(app, "about", "O TTS Hub", true, None::<&str>)?;
    let help = Submenu::with_items(app, "Pomoc", true, &[&about])?;

    #[cfg(target_os = "macos")]
    {
        let app_menu = Submenu::with_items(
            app,
            "TTS Hub",
            true,
            &[&about, &PredefinedMenuItem::separator(app)?, &PredefinedMenuItem::quit(app, None)?],
        )?;
        return Menu::with_items(app, &[&app_menu, &file, &edit]);
    }

    #[cfg(not(target_os = "macos"))]
    Menu::with_items(app, &[&file, &edit, &help])
}
