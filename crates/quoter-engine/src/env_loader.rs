use std::fs;
use std::path::Path;

pub(crate) mod parser;
pub(crate) mod redaction;

pub(crate) use redaction::{redact_env_value, redact_secret, redact_url};

/// Load environment variables from a .env file
pub fn load_env_file<P: AsRef<Path>>(path: P) -> Result<(), Box<dyn std::error::Error>> {
    if !path.as_ref().exists() {
        println!(
            "Warning: Environment file {:?} not found, using default environment variables",
            path.as_ref()
        );
        return Ok(());
    }

    let content = fs::read_to_string(&path)?;
    let vars = parser::parse_env_content(&content)?;

    for (key, value) in vars {
        // Only set if the environment variable is not already set
        if std::env::var(&key).is_err() {
            std::env::set_var(&key, &value);
            println!(
                "📄 Loaded from env file: {} = {}",
                key,
                redact_env_value(&key, &value),
            );
        }
    }

    Ok(())
}

/// Get configuration from environment variables with fallbacks
pub struct EnvConfig;

impl EnvConfig {
    pub fn tycho_url() -> String {
        std::env::var("TYCHO_URL").unwrap_or_else(|_| "tycho-beta.propellerheads.xyz".to_string())
    }

    pub fn tycho_api_key() -> String {
        std::env::var("TYCHO_API_KEY").unwrap_or_default()
    }

    pub fn chain() -> String {
        std::env::var("CHAIN").unwrap_or_else(|_| "ethereum".to_string())
    }

    pub fn tvl_threshold() -> f64 {
        std::env::var("TVL_THRESHOLD")
            .unwrap_or_else(|_| "10000".to_string())
            .parse()
            .unwrap_or(10000.0)
    }

    pub fn infura_api_key() -> Option<String> {
        std::env::var("INFURA_API_KEY").ok()
    }

    pub fn rpc_url() -> Option<String> {
        std::env::var("RPC_URL").ok()
    }

    /// Print current configuration
    pub fn print_config() {
        println!("📊 Current Configuration:");
        println!("  → TYCHO_URL: {}", Self::tycho_url());
        println!(
            "  → TYCHO_API_KEY: {}",
            redact_secret(&Self::tycho_api_key())
        );
        println!("  → CHAIN: {}", Self::chain());
        println!("  → TVL_THRESHOLD: {} ETH", Self::tvl_threshold());

        if let Some(infura_key) = Self::infura_api_key() {
            println!("  → INFURA_API_KEY: {}", redact_secret(&infura_key));
        } else {
            println!("  → INFURA_API_KEY: Not set");
        }

        if let Some(rpc_url) = Self::rpc_url() {
            println!("  → RPC_URL: {}", redact_url(&rpc_url));
        } else {
            println!("  → RPC_URL: Not set");
        }
    }
}
