// What the shell remembers between launches. The Runner keeps its own (the sign-in, the
// allowed folders) under ~/.wildcrane.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Data {
    /// The first-run window was finished once.
    pub setup_done: bool,
    /// The user turned notifications on here.
    pub notify: bool,
    /// Open at login was switched on for the first launch; the user owns it after that.
    pub autostart_set: bool,
}

pub struct Prefs {
    data: Mutex<Data>,
    file: Option<PathBuf>,
}

impl Prefs {
    pub fn load(app: &AppHandle) -> Self {
        let file = app.path().app_config_dir().ok().map(|dir| dir.join("prefs.json"));
        let data = file
            .as_ref()
            .and_then(|f| std::fs::read(f).ok())
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Prefs {
            data: Mutex::new(data),
            file,
        }
    }

    pub fn get(&self) -> Data {
        self.data.lock().unwrap().clone()
    }

    pub fn update(&self, change: impl FnOnce(&mut Data)) {
        let mut data = self.data.lock().unwrap();
        change(&mut data);
        if let Some(file) = &self.file {
            if let Some(dir) = file.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            if let Ok(bytes) = serde_json::to_vec_pretty(&*data) {
                let _ = std::fs::write(file, bytes);
            }
        }
    }
}
