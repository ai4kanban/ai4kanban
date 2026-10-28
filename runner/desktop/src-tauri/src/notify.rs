// Native notifications: shown under WildCrane's name and icon, a click opens the page it is
// about and reads it everywhere. The Runner is told whether they show here — the user's
// switch and the system's permission — so Cloud sends the rest to the web instead.

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

use crate::prefs::Prefs;
use crate::sidecar::{chinese, Sidecar};

/// A click on a notification opens its page and reads its alert.
pub fn listen(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.notification().on_action(move |performed| {
        let Some(extra) = performed.notification().map(|n| n.extra()) else {
            return;
        };
        if let Some(url) = extra.get("url").and_then(Value::as_str) {
            let _ = handle.opener().open_url(url, None::<&str>);
        }
        if let Some(alert) = extra.get("alert").and_then(Value::as_str) {
            handle
                .state::<Sidecar>()
                .send(&json!({ "cmd": "read", "alert": alert }));
        }
    });
}

/// A `notify` event from the Runner.
pub fn show(app: &AppHandle, event: &Value) {
    if !app.state::<Prefs>().get().notify {
        return;
    }
    let text = |key: &str| event[key].as_str().unwrap_or_default().to_owned();
    let _ = app
        .notification()
        .builder()
        .title(text("title"))
        .body(text("body"))
        .extra("url", text("url"))
        .extra("alert", text("id"))
        .show();
}

/// The first one, right after the user turned them on.
pub fn welcome(app: &AppHandle) {
    let (title, body) = if chinese() {
        ("通知已开启", "有内容待你审核、任务完成或失败时，会在这里提醒你。")
    } else {
        (
            "Notifications are on",
            "You'll hear from WildCrane here when something needs your review, or a task finishes or fails.",
        )
    };
    let _ = app.notification().builder().title(title).body(body).show();
}

/// Tell the Runner whether notifications show here.
pub fn sync(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let on = app.state::<Prefs>().get().notify && allowed().await != Some(false);
        app.state::<Sidecar>().send(&json!({ "cmd": "notify", "on": on }));
    });
}

pub fn open_settings(app: &AppHandle) {
    let url = if cfg!(target_os = "macos") {
        format!(
            "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id={}",
            app.config().identifier
        )
    } else {
        "ms-settings:notifications".to_owned()
    };
    let _ = app.opener().open_url(url, None::<&str>);
}

/// Whether the system lets WildCrane show notifications; None when it cannot be told.
pub async fn allowed() -> Option<bool> {
    tauri::async_runtime::spawn_blocking(platform::allowed)
        .await
        .ok()
        .flatten()
}

/// Ask the system, where it asks; then answer as `allowed` does.
pub async fn request() -> Option<bool> {
    tauri::async_runtime::spawn_blocking(platform::request)
        .await
        .ok()
        .flatten()
}

#[cfg(target_os = "macos")]
mod platform {
    use std::ptr::NonNull;
    use std::sync::mpsc;
    use std::time::Duration;

    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSBundle, NSError};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNAuthorizationStatus, UNNotificationSettings, UNUserNotificationCenter,
    };

    /// The user has two minutes to answer the system's prompt.
    const ANSWER: Duration = Duration::from_secs(120);

    /// The notification center only exists for an app bundle; a development build is a bare binary.
    fn bundled() -> bool {
        let bundle = NSBundle::mainBundle();
        bundle.bundleIdentifier().is_some() && bundle.bundlePath().to_string().ends_with(".app")
    }

    pub fn allowed() -> Option<bool> {
        if !bundled() {
            return None;
        }
        let (tx, rx) = mpsc::channel();
        let block = RcBlock::new(move |settings: NonNull<UNNotificationSettings>| {
            let _ = tx.send(match unsafe { settings.as_ref() }.authorizationStatus() {
                UNAuthorizationStatus::Denied => Some(false),
                UNAuthorizationStatus::NotDetermined => None,
                _ => Some(true),
            });
        });
        UNUserNotificationCenter::currentNotificationCenter().getNotificationSettingsWithCompletionHandler(&block);
        rx.recv_timeout(ANSWER).ok().flatten()
    }

    pub fn request() -> Option<bool> {
        if !bundled() {
            return None;
        }
        let (tx, rx) = mpsc::channel();
        let block = RcBlock::new(move |granted: Bool, _error: *mut NSError| {
            let _ = tx.send(granted.as_bool());
        });
        UNUserNotificationCenter::currentNotificationCenter().requestAuthorizationWithOptions_completionHandler(
            UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
            &block,
        );
        rx.recv_timeout(ANSWER).ok()
    }
}

#[cfg(windows)]
mod platform {
    use windows::core::HSTRING;
    use windows::UI::Notifications::{NotificationSetting, ToastNotificationManager};

    /// Windows never asks; the user can only turn WildCrane off in Settings.
    pub fn allowed() -> Option<bool> {
        let id = HSTRING::from("ai.wildcrane.desktop");
        let setting = ToastNotificationManager::CreateToastNotifierWithId(&id)
            .and_then(|n| n.Setting())
            .ok()?;
        Some(setting == NotificationSetting::Enabled)
    }

    pub fn request() -> Option<bool> {
        allowed()
    }
}

#[cfg(not(any(target_os = "macos", windows)))]
mod platform {
    pub fn allowed() -> Option<bool> {
        None
    }

    pub fn request() -> Option<bool> {
        None
    }
}
