use std::collections::HashMap;
use std::error::Error;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct EnvParseError {
    line: usize,
    message: String,
}

impl EnvParseError {
    fn new(line: usize, message: impl Into<String>) -> Self {
        Self {
            line,
            message: message.into(),
        }
    }
}

impl fmt::Display for EnvParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Invalid env file at line {}: {}",
            self.line, self.message
        )
    }
}

impl Error for EnvParseError {}

/// Parse dotenv-style KEY=value content into environment variables.
pub(crate) fn parse_env_content(content: &str) -> Result<HashMap<String, String>, EnvParseError> {
    let mut vars = HashMap::new();

    for (line_index, raw_line) in content.lines().enumerate() {
        let line_number = line_index + 1;
        let mut line = raw_line.trim();

        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if let Some(rest) = line.strip_prefix("export ") {
            line = rest.trim_start();
        }

        let (key, value) = line
            .split_once('=')
            .ok_or_else(|| EnvParseError::new(line_number, "expected KEY=value"))?;

        let key = key.trim();
        if !is_valid_env_key(key) {
            return Err(EnvParseError::new(
                line_number,
                format!("invalid environment variable name `{key}`"),
            ));
        }

        vars.insert(key.to_string(), unquote_value(value.trim()));
    }

    Ok(vars)
}

fn is_valid_env_key(key: &str) -> bool {
    let mut chars = key.chars();
    match chars.next() {
        Some(first) if first == '_' || first.is_ascii_alphabetic() => {}
        _ => return false,
    }

    chars.all(|ch| ch == '_' || ch.is_ascii_alphanumeric())
}

fn unquote_value(value: &str) -> String {
    let bytes = value.as_bytes();
    if bytes.len() >= 2 {
        let first = bytes[0];
        let last = bytes[bytes.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return value[1..value.len() - 1].to_string();
        }
    }

    value.to_string()
}

#[cfg(test)]
mod tests {
    use super::parse_env_content;

    #[test]
    fn parses_basic_values_and_quotes() {
        let parsed = parse_env_content(
            r#"
            # comment
            TYCHO_URL=tycho-beta.propellerheads.xyz
            export CHAIN="ethereum"
            RPC_URL='https://example.com/key'
            "#,
        )
        .unwrap();

        assert_eq!(parsed["TYCHO_URL"], "tycho-beta.propellerheads.xyz");
        assert_eq!(parsed["CHAIN"], "ethereum");
        assert_eq!(parsed["RPC_URL"], "https://example.com/key");
    }

    #[test]
    fn rejects_invalid_keys() {
        let error = parse_env_content("BAD-KEY=value").unwrap_err();

        assert!(error
            .to_string()
            .contains("invalid environment variable name"));
    }

    #[test]
    fn does_not_panic_on_single_quote_value() {
        let parsed = parse_env_content("VALUE=\"").unwrap();

        assert_eq!(parsed["VALUE"], "\"");
    }
}
