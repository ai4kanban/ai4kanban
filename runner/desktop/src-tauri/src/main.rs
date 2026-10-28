// WildCrane for Mac and Windows (#2005): the Local Runner (a bundled Node running
// runner/dist) behind a menu bar / tray icon, a first-run setup window and native
// notifications. This shell only draws and relays; the Runner holds the sign-in and talks to
// Cloud (runner/src/desktop.ts).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod badge;
mod notify;
mod prefs;
mod sidecar;
mod tray;
mod update;

use serde_json::{json, Value};
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use crate::prefs::Prefs;
use crate::sidecar::Sidecar;

/// The latest of each Runner event, so a window opened later draws the current state.
#[tauri::command]
fn snapshot(sidecar: tauri::State<Sidecar>) -> Value {
    sidecar.snapshot()
}

/// A command for the Runner, as the line protocol spells it.
#[tauri::command]
fn send(sidecar: tauri::State<Sidecar>, command: Value) {
    sidecar.send(&command);
}

#[tauri::command]
fn open_url(app: tauri::AppHandle, url: String, alert: Option<String>) {
    if url.starts_with("https://") || url.starts_with("http://") {
        let _ = app.opener().open_url(url, None::<&str>);
    }
    if let Some(alert) = alert {
        app.state::<Sidecar>().send(&json!({ "cmd": "read", "alert": alert }));
    }
    tray::hide_panel(&app);
}

/// The system folder picker; the folder goes to the Runner, which decides whether it may be a project.
/// With `project`, the folder is for that existing project.
#[tauri::command]
fn pick_folder(app: tauri::AppHandle, project: Option<String>, title: Option<String>) {
    let handle = app.clone();
    let mut dialog = app.dialog().file();
    if let Some(title) = title {
        dialog = dialog.set_title(title);
    }
    dialog.pick_folder(move |picked| {
        if let Some(path) = picked.and_then(|p| p.into_path().ok()) {
            handle.state::<Sidecar>().send(&json!({
                "cmd": "addFolder",
                "path": path.to_string_lossy(),
                "project": project,
            }));
        }
        tray::show_panel(&handle);
    });
}

#[tauri::command]
async fn notifications(app: tauri::AppHandle) -> Value {
    let allowed = notify::allowed().await;
    let on = app.state::<Prefs>().get().notify;
    json!({ "on": on && allowed != Some(false), "allowed": allowed })
}

/// Ask the system the first time, then show a real notification so the user sees one.
#[tauri::command]
async fn enable_notifications(app: tauri::AppHandle) -> Value {
    let allowed = notify::request().await;
    let on = allowed != Some(false);
    app.state::<Prefs>().update(|p| p.notify = on);
    notify::sync(&app);
    if on {
        notify::welcome(&app);
    }
    json!({ "on": on, "allowed": allowed })
}

#[tauri::command]
fn disable_notifications(app: tauri::AppHandle) {
    app.state::<Prefs>().update(|p| p.notify = false);
    notify::sync(&app);
}

#[tauri::command]
fn open_notification_settings(app: tauri::AppHandle) {
    notify::open_settings(&app);
}

#[tauri::command]
fn autostart(app: tauri::AppHandle, on: Option<bool>) -> bool {
    let launcher = app.autolaunch();
    match on {
        Some(true) => {
            let _ = launcher.enable();
        }
        Some(false) => {
            let _ = launcher.disable();
        }
        None => {}
    }
    launcher.is_enabled().unwrap_or(false)
}

/// The setup window closes; the menu bar icon blinks and says where WildCrane lives now.
#[tauri::command]
fn finish_setup(app: tauri::AppHandle) {
    app.state::<Prefs>().update(|p| p.setup_done = true);
    if let Some(window) = app.get_webview_window("setup") {
        let _ = window.close();
    }
    tray::introduce(&app);
}

#[tauri::command]
fn dismiss_bubble(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("bubble") {
        let _ = window.close();
    }
}

#[tauri::command]
fn hide_panel(app: tauri::AppHandle) {
    tray::hide_panel(&app);
}

#[tauri::command]
fn quit(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        app.state::<Sidecar>().stop();
        update::install_pending(&app);
        app.exit(0);
    });
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| tray::open(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            snapshot,
            send,
            open_url,
            pick_folder,
            notifications,
            enable_notifications,
            disable_notifications,
            open_notification_settings,
            autostart,
            finish_setup,
            dismiss_bubble,
            hide_panel,
            quit,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let prefs = Prefs::load(app.handle());
            if !prefs.get().autostart_set {
                let _ = app.autolaunch().enable();
                prefs.update(|p| p.autostart_set = true);
            }
            app.manage(prefs);
            notify::listen(app.handle());
            tray::create(app.handle())?;
            app.manage(Sidecar::start(app.handle()));
            update::check(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "panel" {
                if let WindowEvent::Focused(false) = event {
                    tray::hide_panel(window.app_handle());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("WildCrane could not start")
        .run(|app, event| match event {
            // Closing a window never quits; only "Quit WildCrane" does.
            RunEvent::ExitRequested { code: None, api, .. } => api.prevent_exit(),
            RunEvent::Exit => app.state::<Sidecar>().stop(),
            _ => {}
        });
}
