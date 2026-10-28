// The Runner: the bundled Node running runner/dist/launcher.mjs with WILDCRANE_DESKTOP set,
// which updates itself on every start. One JSON object per line each way; any other line it
// prints is a log line. Restarted when it exits, unless WildCrane is quitting.

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::{json, Map, Value};
use tauri::{AppHandle, Emitter, Manager};

use crate::{notify, tray};

const BACKOFF: [u64; 4] = [1, 5, 15, 60];
const STOP_WAIT: Duration = Duration::from_secs(5);

#[derive(Default)]
struct Inner {
    stdin: Mutex<Option<ChildStdin>>,
    child: Mutex<Option<Child>>,
    /// The latest event of each type.
    snapshot: Mutex<Map<String, Value>>,
    stopping: AtomicBool,
}

pub struct Sidecar(Arc<Inner>);

/// The system language, as the Runner reads it.
pub fn chinese() -> bool {
    sys_locale::get_locale().is_some_and(|l| l.to_lowercase().starts_with("zh"))
}

impl Sidecar {
    pub fn start(app: &AppHandle) -> Self {
        let inner = Arc::new(Inner::default());
        let (app, held) = (app.clone(), Arc::clone(&inner));
        std::thread::Builder::new()
            .name("runner".into())
            .spawn(move || keep_running(&app, &held))
            .expect("could not start the Runner thread");
        Sidecar(inner)
    }

    pub fn send(&self, command: &Value) {
        if let Some(stdin) = self.0.stdin.lock().unwrap().as_mut() {
            let _ = writeln!(stdin, "{command}");
            let _ = stdin.flush();
        }
    }

    pub fn snapshot(&self) -> Value {
        Value::Object(self.0.snapshot.lock().unwrap().clone())
    }

    /// Ask the Runner to release this computer and stop; kill it if it has not within a few seconds.
    pub fn stop(&self) {
        if self.0.stopping.swap(true, Ordering::SeqCst) {
            return;
        }
        self.send(&json!({ "cmd": "quit" }));
        let until = Instant::now() + STOP_WAIT;
        loop {
            let mut child = self.0.child.lock().unwrap();
            match child.as_mut().map(|c| c.try_wait()) {
                Some(Ok(None)) if Instant::now() < until => {}
                Some(Ok(None)) | Some(Err(_)) => {
                    let _ = child.as_mut().map(|c| c.kill());
                    return;
                }
                _ => return,
            }
            drop(child);
            std::thread::sleep(Duration::from_millis(100));
        }
    }
}

fn spawn(app: &AppHandle) -> std::io::Result<Child> {
    let dir = std::env::current_exe()?
        .parent()
        .map(|d| d.to_path_buf())
        .unwrap_or_default();
    let node = dir.join(if cfg!(windows) { "node.exe" } else { "node" });
    let launcher = app
        .path()
        .resource_dir()
        .map_err(|e| std::io::Error::other(e.to_string()))?
        .join("runner")
        .join("launcher.mjs");
    let mut command = Command::new(node);
    command
        .arg(launcher)
        .env("WILDCRANE_DESKTOP", "1")
        .env("LANG", if chinese() { "zh_CN.UTF-8" } else { "en_US.UTF-8" })
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command.spawn()
}

fn keep_running(app: &AppHandle, inner: &Inner) {
    let mut failures = 0;
    while !inner.stopping.load(Ordering::SeqCst) {
        let started = Instant::now();
        match spawn(app) {
            Ok(mut child) => {
                let stdout = child.stdout.take();
                *inner.stdin.lock().unwrap() = child.stdin.take();
                *inner.child.lock().unwrap() = Some(child);
                if let Some(stdout) = stdout {
                    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                        on_line(app, inner, &line);
                    }
                }
                // Polled, so `stop` can take the lock and kill a Runner that hangs.
                while let Some(Ok(None)) = inner.child.lock().unwrap().as_mut().map(|c| c.try_wait()) {
                    std::thread::sleep(Duration::from_millis(100));
                }
                *inner.stdin.lock().unwrap() = None;
            }
            Err(e) => eprintln!("wildcrane: the Runner did not start: {e}"),
        }
        if inner.stopping.load(Ordering::SeqCst) {
            break;
        }
        on_event(app, inner, json!({ "type": "connection", "state": "reconnecting" }));
        failures = if started.elapsed() > Duration::from_secs(120) {
            0
        } else {
            failures + 1
        };
        std::thread::sleep(Duration::from_secs(BACKOFF[failures.min(BACKOFF.len() - 1)]));
    }
}

fn on_line(app: &AppHandle, inner: &Inner, line: &str) {
    match serde_json::from_str::<Value>(line) {
        Ok(event) if event.get("type").is_some_and(Value::is_string) => on_event(app, inner, event),
        _ => println!("{line}"),
    }
}

fn on_event(app: &AppHandle, inner: &Inner, event: Value) {
    let kind = event["type"].as_str().unwrap_or_default().to_owned();
    match kind.as_str() {
        "notify" => return notify::show(app, &event),
        "hello" => notify::sync(app),
        "inbox" => tray::set_count(app, unread(&event)),
        "signin" if event["state"] == "needed" => {
            inner.snapshot.lock().unwrap().remove("account");
            tray::set_count(app, 0);
            tray::show_setup(app);
        }
        _ => {}
    }
    if kind != "folderRefused" {
        inner.snapshot.lock().unwrap().insert(kind, event.clone());
    }
    let _ = app.emit("runner", event);
}

/// What the menu bar counts: reviews not yet seen anywhere.
fn unread(inbox: &Value) -> usize {
    inbox["review"]
        .as_array()
        .map(|items| items.iter().filter(|i| i["alert"].is_string()).count())
        .unwrap_or(0)
}
