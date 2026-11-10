pub mod vault;
pub mod watch;

/// Name of the application reported by Amethyst Core.
pub fn application_name() -> &'static str {
    "Amethyst"
}

/// Version of this Amethyst Core crate.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn application_name_is_amethyst() {
        assert_eq!(application_name(), "Amethyst");
    }

    #[test]
    fn version_matches_package_version() {
        assert_eq!(version(), env!("CARGO_PKG_VERSION"));
    }
}
