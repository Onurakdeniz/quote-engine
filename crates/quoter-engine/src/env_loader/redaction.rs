const SECRET_MARKER: &str = "***";

pub(crate) fn redact_env_value(key: &str, value: &str) -> String {
    let key = key.to_ascii_uppercase();

    if is_sensitive_key(&key) {
        redact_secret(value)
    } else if key == "RPC_URL" || key.ends_with("_RPC_URL") {
        redact_url(value)
    } else {
        value.to_string()
    }
}

pub(crate) fn redact_secret(value: &str) -> String {
    if value.is_empty() {
        return "<empty>".to_string();
    }

    let prefix: String = value.chars().take(3).collect();
    format!("{prefix}{SECRET_MARKER}")
}

pub(crate) fn redact_url(value: &str) -> String {
    let Some((scheme, rest)) = value.split_once("://") else {
        return redact_secret(value);
    };

    let host = rest.split('/').next().unwrap_or(rest);
    if host.is_empty() {
        redact_secret(value)
    } else {
        format!("{scheme}://{host}/{SECRET_MARKER}")
    }
}

fn is_sensitive_key(key: &str) -> bool {
    key.contains("KEY")
        || key.contains("SECRET")
        || key.contains("PASSWORD")
        || key.contains("TOKEN")
        || key.contains("PRIVATE")
        || key.contains("AUTH")
}

#[cfg(test)]
mod tests {
    use super::{redact_env_value, redact_url};

    #[test]
    fn redacts_secret_env_values() {
        assert_eq!(redact_env_value("TYCHO_API_KEY", "abcdef"), "abc***");
        assert_eq!(redact_env_value("PRIVATE_KEY", "0x123"), "0x1***");
    }

    #[test]
    fn redacts_rpc_url_paths() {
        assert_eq!(
            redact_url("https://mainnet.infura.io/v3/abcdef"),
            "https://mainnet.infura.io/***",
        );
    }
}
