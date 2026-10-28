// The shell updates itself on restart: each launch checks once and downloads what it finds.
// The Mac app is replaced in place and the next launch runs it; Windows installs it as
// WildCrane quits. Anything failing leaves the version that is running.

use std::sync::Mutex;
use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_updater::{Update, UpdaterExt};

static PENDING: Mutex<Option<(Update, Vec<u8>)>> = Mutex::new(None);

pub fn check(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = fetch(&app).await {
            eprintln!("wildcrane: no update this time: {e}");
        }
    });
}

async fn fetch(app: &AppHandle) -> tauri_plugin_updater::Result<()> {
    let Some(update) = app
        .updater_builder()
        .timeout(Duration::from_secs(30))
        .build()?
        .check()
        .await?
    else {
        return Ok(());
    };
    let bytes = update.download(|_, _| {}, || {}).await?;
    if cfg!(windows) {
        *PENDING.lock().unwrap() = Some((update, bytes));
    } else {
        update.install(bytes)?;
    }
    Ok(())
}

/// On quit: install what was downloaded at launch.
pub fn install_pending(_app: &AppHandle) {
    if let Some((update, bytes)) = PENDING.lock().unwrap().take() {
        if let Err(e) = update.install(bytes) {
            eprintln!("wildcrane: the update did not install: {e}");
        }
    }
}
