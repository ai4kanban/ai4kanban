// The menu bar (Mac) / tray (Windows) icon and the windows it opens: the panel under it, the
// first-run setup window, and the bubble that points at it once setup is done.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::image::Image;
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Rect, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::badge;
use crate::sidecar::Sidecar;

const TRAY: &str = "wildcrane";
const PANEL: (f64, f64) = (380.0, 560.0);
const BUBBLE: (f64, f64) = (300.0, 132.0);
const GAP: f64 = 6.0;

#[derive(Default)]
struct Placement {
    /// Where the icon was last seen, for a window opened without a click.
    rect: Option<Rect>,
    /// When the panel last hid. A click on the icon first takes its focus away, so a click
    /// right after a hide is the same click and must not open it again.
    hidden_at: Option<Instant>,
}

static PLACEMENT: Mutex<Placement> = Mutex::new(Placement {
    rect: None,
    hidden_at: None,
});

fn icon(app: &AppHandle, name: &str) -> Option<Image<'static>> {
    let path = app.path().resource_dir().ok()?.join("icons").join(name);
    Image::from_path(path).ok()
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let mac = cfg!(target_os = "macos");
    let mut builder = TrayIconBuilder::with_id(TRAY)
        .tooltip("WildCrane")
        .icon_as_template(mac)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                rect,
                button,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                PLACEMENT.lock().unwrap().rect = Some(rect);
                if matches!(button, MouseButton::Left | MouseButton::Right) {
                    open(tray.app_handle());
                }
            }
        });
    if let Some(image) = icon(app, if mac { "tray-template.png" } else { "tray.png" }) {
        builder = builder.icon(image);
    }
    builder.build(app)?;
    Ok(())
}

fn tray(app: &AppHandle) -> Option<TrayIcon> {
    app.tray_by_id(TRAY)
}

/// The count beside the icon: a title on the Mac menu bar, a badge on the Windows tray icon.
pub fn set_count(app: &AppHandle, count: usize) {
    let Some(tray) = tray(app) else { return };
    if cfg!(target_os = "macos") {
        let _ = tray.set_title(if count > 0 { Some(count.to_string()) } else { None });
    } else if let Some(base) = icon(app, "tray.png") {
        let _ = tray.set_icon(Some(if count > 0 { badge::draw(&base, count) } else { base }));
    }
}

/// What a click on the icon, or a second launch, opens: the panel once set up and signed in,
/// the setup window otherwise.
pub fn open(app: &AppHandle) {
    let signed_in = app.state::<Sidecar>().snapshot().get("account").is_some();
    if signed_in && app.state::<crate::prefs::Prefs>().get().setup_done {
        toggle_panel(app);
    } else {
        show_setup(app);
    }
}

pub fn show_setup(app: &AppHandle) {
    hide_panel(app);
    let window = app.get_webview_window("setup").or_else(|| {
        WebviewWindowBuilder::new(app, "setup", WebviewUrl::App("index.html".into()))
            .title("WildCrane")
            .inner_size(520.0, 460.0)
            .resizable(false)
            .maximizable(false)
            .minimizable(false)
            .center()
            .visible(false)
            .build()
            .ok()
    });
    if let Some(window) = window {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn panel(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("panel")
        .or_else(|| floating(app, "panel", PANEL))
}

fn floating(app: &AppHandle, label: &str, (width, height): (f64, f64)) -> Option<WebviewWindow> {
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("WildCrane")
        .inner_size(width, height)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false);
    #[cfg(target_os = "macos")]
    let builder = builder.transparent(true).shadow(true);
    builder.build().ok()
}

fn toggle_panel(app: &AppHandle) {
    let just_hidden = PLACEMENT
        .lock()
        .unwrap()
        .hidden_at
        .is_some_and(|t| t.elapsed() < Duration::from_millis(300));
    let Some(window) = panel(app) else { return };
    if window.is_visible().unwrap_or(false) || just_hidden {
        hide_panel(app);
    } else {
        let _ = app.emit_to("panel", "panel-shown", ());
        show_panel(app);
    }
}

/// Show the panel as it was left; `toggle_panel` opens it afresh.
pub fn show_panel(app: &AppHandle) {
    let Some(window) = panel(app) else { return };
    place(app, &window, PANEL);
    crate::notify::sync(app);
    app.state::<Sidecar>().send(&serde_json::json!({ "cmd": "refresh" }));
    let _ = window.show();
    let _ = window.set_focus();
}

pub fn hide_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("panel") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            PLACEMENT.lock().unwrap().hidden_at = Some(Instant::now());
        }
    }
}

/// Put a window against the icon: below it on a top menu bar, above it on a bottom taskbar,
/// kept on the icon's screen.
fn place(app: &AppHandle, window: &WebviewWindow, (width, height): (f64, f64)) {
    let rect = PLACEMENT
        .lock()
        .unwrap()
        .rect
        .or_else(|| tray(app).and_then(|t| t.rect().ok().flatten()));
    let Some(rect) = rect else {
        let _ = window.center();
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let at = rect.position.to_physical::<f64>(scale);
    let size = rect.size.to_physical::<f64>(scale);
    let (w, h, gap) = (width * scale, height * scale, GAP * scale);
    let monitor = app.monitor_from_point(at.x, at.y).ok().flatten();
    let (left, top, right, bottom) = monitor
        .map(|m| {
            let area = m.work_area();
            let (x, y) = (area.position.x as f64, area.position.y as f64);
            (x, y, x + area.size.width as f64, y + area.size.height as f64)
        })
        .unwrap_or((0.0, 0.0, f64::MAX, f64::MAX));
    let x = (at.x + size.width / 2.0 - w / 2.0).clamp(left + gap, (right - w - gap).max(left));
    let below = at.y + size.height / 2.0 < (top + bottom) / 2.0;
    let y = if below {
        (at.y + size.height + gap).max(top + gap)
    } else {
        (at.y - h - gap).min(bottom - h - gap)
    };
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

/// Setup is done: the icon blinks and a bubble under it says this is where WildCrane lives.
pub fn introduce(app: &AppHandle) {
    if let Some(window) = app
        .get_webview_window("bubble")
        .or_else(|| floating(app, "bubble", BUBBLE))
    {
        place(app, &window, BUBBLE);
        let _ = window.show();
    }
    let mac = cfg!(target_os = "macos");
    let Some(shown) = icon(app, if mac { "tray-template.png" } else { "tray.png" }) else {
        return;
    };
    let blank = Image::new_owned(
        vec![0; (shown.width() * shown.height() * 4) as usize],
        shown.width(),
        shown.height(),
    );
    let handle = app.clone();
    std::thread::spawn(move || {
        for i in 0..8 {
            std::thread::sleep(Duration::from_millis(350));
            if let Some(tray) = tray(&handle) {
                let _ = tray.set_icon(Some(if i % 2 == 0 { blank.clone() } else { shown.clone() }));
                let _ = tray.set_icon_as_template(mac);
            }
        }
    });
}
