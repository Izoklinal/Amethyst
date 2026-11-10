use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::{DebounceEventResult, Debouncer, new_debouncer};

use crate::vault::{Vault, VaultError};

const CHANGE_DELAY: Duration = Duration::from_millis(200);

/// Recursive watch of one vault. Dropping it stops the watch.
pub struct VaultWatcher {
    _debouncer: Debouncer<notify::RecommendedWatcher>,
}

impl Vault {
    /// Reports a burst of filesystem changes as one signal about 200 ms later.
    pub fn watch<F>(&self, mut on_change: F) -> Result<VaultWatcher, VaultError>
    where
        F: FnMut() + Send + 'static,
    {
        let mut debouncer = new_debouncer(CHANGE_DELAY, move |result: DebounceEventResult| {
            if matches!(result, Ok(events) if !events.is_empty()) {
                on_change();
            }
        })
        .map_err(|_| VaultError::NotAccessible)?;
        debouncer
            .watcher()
            .watch(self.root(), RecursiveMode::Recursive)
            .map_err(|_| VaultError::NotAccessible)?;
        Ok(VaultWatcher {
            _debouncer: debouncer,
        })
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::mpsc;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    use super::*;

    #[test]
    fn watch_reports_a_new_file() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after the unix epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "amethyst-watch-test-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("temporary vault");
        let vault = Vault::open(&root).expect("open");
        let (sender, receiver) = mpsc::channel();
        let watcher = vault
            .watch(move || {
                let _ = sender.send(());
            })
            .expect("watch");

        fs::write(root.join("note.md"), "hello").expect("create note");
        receiver
            .recv_timeout(Duration::from_secs(5))
            .expect("watcher should report the new file");
        drop(watcher);
        let _ = fs::remove_dir_all(root);
    }
}
