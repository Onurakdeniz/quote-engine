//! Configuration loading, env vars, CLI flags.
//!
//! This module provides a modular configuration system with the following benefits:
//! - Separation of concerns into logical modules
//! - Type safety and validation
//! - Builder pattern for easy configuration construction
//! - Configuration presets for common use cases
//! - Backwards compatibility with legacy code

use serde::{Deserialize, Serialize};
use std::env;
use std::str::FromStr;
use tracing::{info, warn};
use tycho_simulation::tycho_common::models::Chain;
use tycho_simulation::tycho_common::Bytes;

#[cfg(feature = "cli")]
use clap::Parser;

mod validation;

// === QUOTE CONFIGURATION MODULE ===

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub enum QuoteType {
    #[default]
    Single, // One best quote
    List, // List of top quotes
    All,  // All possible quotes
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QuoteConfig {
    pub quote_type: QuoteType,
    pub max_quotes_in_list: usize,
    pub include_all_paths: bool,
    pub best_rate_mode: bool,
}

impl Default for QuoteConfig {
    fn default() -> Self {
        Self {
            quote_type: QuoteType::Single,
            max_quotes_in_list: 5,
            include_all_paths: false,
            best_rate_mode: false,
        }
    }
}

// === NETWORK CONFIGURATION MODULE ===

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkConfig {
    pub tycho_url: String,
    pub tycho_api_key: String,
    pub chain: Chain,
    pub rpc_url: Option<String>,
}

impl NetworkConfig {
    pub fn new(tycho_url: String, tycho_api_key: String, chain: Chain) -> Self {
        Self {
            tycho_url,
            tycho_api_key,
            chain,
            rpc_url: None,
        }
    }

    pub fn with_rpc_url(mut self, rpc_url: String) -> Self {
        self.rpc_url = Some(rpc_url);
        self
    }

    pub fn validate(&self) -> Result<(), String> {
        validation::require_non_empty("Tycho URL", &self.tycho_url)?;
        validation::require_non_empty("Tycho API key", &self.tycho_api_key)?;
        validation::reject_control_chars("Tycho URL", &self.tycho_url)?;
        validation::reject_control_chars("Tycho API key", &self.tycho_api_key)?;
        if let Some(rpc_url) = &self.rpc_url {
            validation::reject_control_chars("RPC URL", rpc_url)?;
        }
        Ok(())
    }
}

// === TOKEN CONFIGURATION MODULE ===

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct TokenConfig {
    pub numeraire_token: Option<Bytes>,
    pub native_token_address: Option<Bytes>,
    pub token_list: Option<Vec<String>>,
    pub display_numeraire_token_address: Option<String>,
}

impl TokenConfig {
    pub fn with_numeraire(mut self, numeraire: Bytes) -> Self {
        self.numeraire_token = Some(numeraire);
        self
    }

    pub fn with_native_token(mut self, native: Bytes) -> Self {
        self.native_token_address = Some(native);
        self
    }

    pub fn with_token_list(mut self, tokens: Vec<String>) -> Self {
        self.token_list = Some(tokens);
        self
    }

    pub fn get_default_numeraire_for_chain(chain: &Chain) -> Option<Bytes> {
        match chain {
            Chain::Ethereum => Bytes::from_str("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2").ok(),
            Chain::Base => Bytes::from_str("0x4200000000000000000000000000000000000006").ok(),
            _ => None,
        }
    }
}

// === ROUTING CONFIGURATION MODULE ===

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RoutingConfig {
    pub max_hops: usize,
    pub tvl_threshold: f64,
    pub probe_depth: u128,
}

impl Default for RoutingConfig {
    fn default() -> Self {
        Self {
            max_hops: 3,
            tvl_threshold: 100.0,
            probe_depth: 1_000_000_000_000_000_000u128, // 1 ETH
        }
    }
}

impl RoutingConfig {
    pub fn with_max_hops(mut self, hops: usize) -> Self {
        self.max_hops = hops;
        self
    }

    pub fn with_tvl_threshold(mut self, threshold: f64) -> Self {
        self.tvl_threshold = threshold;
        self
    }

    pub fn with_probe_depth(mut self, depth: u128) -> Self {
        self.probe_depth = depth;
        self
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.max_hops == 0 {
            return Err("Max hops must be greater than 0".to_string());
        }
        if self.max_hops > 10 {
            return Err("Max hops should not exceed 10 for performance reasons".to_string());
        }
        validation::require_finite_non_negative("TVL threshold", self.tvl_threshold)?;
        if !self.tvl_threshold.is_finite() {
            return Err("TVL threshold must be finite".to_string());
        }
        if self.probe_depth == 0 {
            return Err("Probe depth must be greater than 0".to_string());
        }
        Ok(())
    }
}

// === OPERATION CONFIGURATION MODULE ===

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct OperationConfig {
    pub sell_token_address: Option<String>,
    pub buy_token_address: Option<String>,
    pub sell_amount_value: Option<f64>,
    pub price_history_file: Option<String>,
    pub benchmark_mode: bool,
}

// === MAIN CONFIGURATION STRUCT ===

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub network: NetworkConfig,
    pub tokens: TokenConfig,
    pub routing: RoutingConfig,
    pub quotes: QuoteConfig,
    pub operation: OperationConfig,
}

impl AppConfig {
    /// Create a new configuration with required parameters
    pub fn new(tycho_url: String, tycho_api_key: String, chain: Chain) -> Self {
        let mut tokens = TokenConfig::default();
        // Set default numeraire based on chain
        if let Some(default_numeraire) = TokenConfig::get_default_numeraire_for_chain(&chain) {
            tokens.numeraire_token = Some(default_numeraire.clone());
            tokens.native_token_address = Some(default_numeraire);
        }

        Self {
            network: NetworkConfig::new(tycho_url, tycho_api_key, chain),
            tokens,
            routing: RoutingConfig::default(),
            quotes: QuoteConfig::default(),
            operation: OperationConfig::default(),
        }
    }

    /// Builder pattern methods
    pub fn with_rpc_url(mut self, rpc_url: String) -> Self {
        self.network = self.network.with_rpc_url(rpc_url);
        self
    }

    pub fn with_tokens(mut self, tokens: TokenConfig) -> Self {
        self.tokens = tokens;
        self
    }

    pub fn with_routing(mut self, routing: RoutingConfig) -> Self {
        self.routing = routing;
        self
    }

    pub fn with_quotes(mut self, quotes: QuoteConfig) -> Self {
        self.quotes = quotes;
        self
    }

    /// Validate the entire configuration
    pub fn validate(&self) -> Result<(), String> {
        self.network.validate()?;
        self.routing.validate()?;
        Ok(())
    }

    /// Load configuration from environment variables
    pub fn load() -> Self {
        let env_loader = EnvironmentLoader::new();
        env_loader.load()
    }

    /// Load configuration with CLI overrides
    #[cfg(feature = "cli")]
    pub fn load_with_cli() -> Self {
        let cli = CliConfig::parse();
        let env_loader = EnvironmentLoader::new();
        env_loader.load_with_cli_overrides(cli)
    }

    /// Create configuration for Python bindings
    #[allow(clippy::too_many_arguments)]
    pub fn for_python_bindings(
        tycho_url: String,
        tycho_api_key: String,
        chain_name: String,
        rpc_url: Option<String>,
        native_token_address_hex: Option<String>,
        numeraire_token_hex: Option<String>,
        probe_depth: Option<u128>,
        max_hops: Option<usize>,
        tvl_threshold: Option<f64>,
        token_list: Option<Vec<String>>,
        quote_type: Option<String>,
        max_quotes_in_list: Option<usize>,
        include_all_paths: Option<bool>,
    ) -> Result<Self, String> {
        let chain_enum = Chain::from_str(&chain_name)
            .map_err(|_| format!("Invalid chain name: {}", chain_name))?;

        let mut config = Self::new(tycho_url, tycho_api_key, chain_enum);

        if let Some(url) = rpc_url {
            config = config.with_rpc_url(url);
        }

        // Configure tokens
        if let Some(hex) = native_token_address_hex {
            let native = Bytes::from_str(&hex)
                .map_err(|e| format!("Invalid native_token_address: {}", e))?;
            config.tokens = config.tokens.with_native_token(native);
        }

        if let Some(hex) = numeraire_token_hex {
            let numeraire =
                Bytes::from_str(&hex).map_err(|e| format!("Invalid numeraire_token: {}", e))?;
            config.tokens = config.tokens.with_numeraire(numeraire);
        }

        if let Some(tokens) = token_list {
            config.tokens = config.tokens.with_token_list(tokens);
        }

        // Configure routing
        if let Some(depth) = probe_depth {
            config.routing = config.routing.with_probe_depth(depth);
        }

        if let Some(hops) = max_hops {
            config.routing = config.routing.with_max_hops(hops);
        }

        if let Some(threshold) = tvl_threshold {
            config.routing = config.routing.with_tvl_threshold(threshold);
        }

        // Configure quotes
        if let Some(qt) = quote_type {
            let quote_type_enum = match qt.as_str() {
                "single" => QuoteType::Single,
                "list" => QuoteType::List,
                "all" => QuoteType::All,
                other => return Err(format!("Invalid quote_type: {}", other)),
            };
            config.quotes.quote_type = quote_type_enum;
        }

        if let Some(max_quotes) = max_quotes_in_list {
            config.quotes.max_quotes_in_list = max_quotes;
        }

        if let Some(include_all) = include_all_paths {
            config.quotes.include_all_paths = include_all;
        }

        config.validate()?;
        Ok(config)
    }

    // Legacy compatibility methods (backwards compatibility)
    pub fn tycho_url(&self) -> &str {
        &self.network.tycho_url
    }
    pub fn tycho_api_key(&self) -> &str {
        &self.network.tycho_api_key
    }
    pub fn chain(&self) -> &Chain {
        &self.network.chain
    }
    pub fn rpc_url(&self) -> &Option<String> {
        &self.network.rpc_url
    }
    pub fn numeraire_token(&self) -> &Option<Bytes> {
        &self.tokens.numeraire_token
    }
    pub fn native_token_address(&self) -> &Option<Bytes> {
        &self.tokens.native_token_address
    }
    pub fn max_hops(&self) -> usize {
        self.routing.max_hops
    }
    pub fn tvl_threshold(&self) -> f64 {
        self.routing.tvl_threshold
    }
    pub fn probe_depth(&self) -> u128 {
        self.routing.probe_depth
    }
    pub fn quote_type(&self) -> &QuoteType {
        &self.quotes.quote_type
    }
    pub fn token_list(&self) -> &Option<Vec<String>> {
        &self.tokens.token_list
    }
    pub fn sell_token_address(&self) -> &Option<String> {
        &self.operation.sell_token_address
    }
    pub fn buy_token_address(&self) -> &Option<String> {
        &self.operation.buy_token_address
    }
    pub fn sell_amount_value(&self) -> &Option<f64> {
        &self.operation.sell_amount_value
    }
    pub fn price_history_file(&self) -> &Option<String> {
        &self.operation.price_history_file
    }
    pub fn benchmark_mode(&self) -> bool {
        self.operation.benchmark_mode
    }
    pub fn best_rate_mode(&self) -> bool {
        self.quotes.best_rate_mode
    }
    pub fn max_quotes_in_list(&self) -> usize {
        self.quotes.max_quotes_in_list
    }
    pub fn include_all_paths(&self) -> bool {
        self.quotes.include_all_paths
    }
    pub fn display_numeraire_token_address(&self) -> &Option<String> {
        &self.tokens.display_numeraire_token_address
    }
}

// === ENVIRONMENT LOADING MODULE ===

struct EnvironmentLoader;

impl EnvironmentLoader {
    fn new() -> Self {
        Self
    }

    fn load(&self) -> AppConfig {
        let chain = self.get_chain();
        let tycho_url = self.get_tycho_url(&chain);
        let tycho_api_key = self.get_tycho_api_key();

        let mut config = AppConfig::new(tycho_url, tycho_api_key, chain);

        // Load network config
        if let Ok(rpc_url) = env::var("RPC_URL") {
            config = config.with_rpc_url(rpc_url);
        }

        // Load token config
        config.tokens = self.load_token_config(config.tokens);

        // Load routing config
        config.routing = self.load_routing_config();

        // Load quote config
        config.quotes = self.load_quote_config();

        // Load operation config
        config.operation = self.load_operation_config();

        if config.network.rpc_url.is_none() {
            info!("RPC_URL environment variable not set. Some blockchain interactions may be limited.");
        }

        config
    }

    #[cfg(feature = "cli")]
    fn load_with_cli_overrides(&self, cli: CliConfig) -> AppConfig {
        let mut config = self.load();

        // Apply CLI overrides
        if let Some(tycho_url) = cli.tycho_url {
            config.network.tycho_url = tycho_url;
        }
        if let Some(tycho_api_key) = cli.tycho_api_key {
            config.network.tycho_api_key = tycho_api_key;
        }
        if let Some(chain_str) = cli.chain {
            if let Ok(chain) = Chain::from_str(&chain_str) {
                config.network.chain = chain;
            }
        }
        if let Some(rpc_url) = cli.rpc_url {
            config.network.rpc_url = Some(rpc_url);
        }

        // Token overrides
        if let Some(native_hex) = cli.native_token_address {
            if let Ok(native) = Bytes::from_str(&native_hex) {
                config.tokens.native_token_address = Some(native);
            }
        }
        if let Some(numeraire_hex) = cli.numeraire_token {
            if let Ok(numeraire) = Bytes::from_str(&numeraire_hex) {
                config.tokens.numeraire_token = Some(numeraire);
            }
        }
        if let Some(token_list) = cli.token_list {
            config.tokens.token_list = Some(token_list);
        }
        if let Some(display_token) = cli.display_numeraire_token {
            config.tokens.display_numeraire_token_address = Some(display_token);
        }

        // Routing overrides
        if let Some(max_hops) = cli.max_hops {
            config.routing.max_hops = max_hops;
        }
        if let Some(tvl_threshold) = cli.tvl_threshold {
            config.routing.tvl_threshold = tvl_threshold;
        }
        if let Some(probe_depth) = cli.probe_depth {
            config.routing.probe_depth = probe_depth;
        }

        // Quote overrides
        if let Some(quote_type_arg) = cli.quote_type {
            config.quotes.quote_type = quote_type_arg.into();
        }
        if let Some(max_quotes) = cli.max_quotes_in_list {
            config.quotes.max_quotes_in_list = max_quotes;
        }
        config.quotes.include_all_paths = cli.include_all_paths;
        config.quotes.best_rate_mode = cli.best_rate;

        // Operation overrides
        config.operation.sell_token_address = cli.sell_token;
        config.operation.buy_token_address = cli.buy_token;
        config.operation.sell_amount_value = cli.sell_amount;
        config.operation.price_history_file = cli.price_history_file;
        config.operation.benchmark_mode = cli.benchmark;

        config
    }

    fn get_chain(&self) -> Chain {
        let chain_str = env::var("CHAIN").unwrap_or_else(|_| "ethereum".to_string());
        Chain::from_str(&chain_str).unwrap_or(Chain::Ethereum)
    }

    fn get_tycho_url(&self, chain: &Chain) -> String {
        env::var("TYCHO_URL").unwrap_or_else(|_| match chain {
            Chain::Ethereum => "tycho-beta.propellerheads.xyz".to_string(),
            Chain::Base => "tycho-base-beta.propellerheads.xyz".to_string(),
            Chain::Unichain => "tycho-unichain-beta.propellerheads.xyz".to_string(),
            _ => {
                warn!(
                    "No default Tycho URL configured for {:?}; using Ethereum endpoint",
                    chain
                );
                "tycho-beta.propellerheads.xyz".to_string()
            }
        })
    }

    fn get_tycho_api_key(&self) -> String {
        env::var("TYCHO_API_KEY").unwrap_or_default()
    }

    fn load_token_config(&self, mut config: TokenConfig) -> TokenConfig {
        if let Ok(numeraire_hex) = env::var("NUMERAIRE_TOKEN") {
            if let Ok(numeraire) = Bytes::from_str(&numeraire_hex) {
                config.numeraire_token = Some(numeraire);
            }
        }

        if let Ok(native_hex) = env::var("NATIVE_TOKEN_ADDRESS") {
            if let Ok(native) = Bytes::from_str(&native_hex) {
                config.native_token_address = Some(native);
            }
        }

        if let Ok(token_list_str) = env::var("TOKEN_LIST") {
            config.token_list = Some(
                token_list_str
                    .split(',')
                    .map(|token| token.trim().to_string())
                    .collect(),
            );
        }

        config.display_numeraire_token_address = env::var("DISPLAY_NUMERAIRE_TOKEN").ok();

        config
    }

    fn load_routing_config(&self) -> RoutingConfig {
        let mut config = RoutingConfig::default();

        if let Ok(max_hops_str) = env::var("MAX_HOPS") {
            if let Ok(max_hops) = max_hops_str.parse() {
                config.max_hops = max_hops;
            }
        }

        if let Ok(tvl_str) = env::var("TVL_THRESHOLD") {
            if let Ok(tvl) = tvl_str.parse() {
                config.tvl_threshold = tvl;
            }
        }

        if let Ok(probe_str) = env::var("PROBE_DEPTH") {
            if let Ok(probe) = probe_str.parse() {
                config.probe_depth = probe;
            }
        }

        config
    }

    fn load_quote_config(&self) -> QuoteConfig {
        QuoteConfig::default()
    }

    fn load_operation_config(&self) -> OperationConfig {
        OperationConfig {
            price_history_file: env::var("PRICE_HISTORY_FILE").ok(),
            ..OperationConfig::default()
        }
    }
}

// === CLI CONFIGURATION (Feature-gated) ===

#[cfg(feature = "cli")]
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
pub struct CliConfig {
    #[arg(long)]
    pub config: Option<String>,
    #[arg(long)]
    pub tycho_url: Option<String>,
    #[arg(long)]
    pub tycho_api_key: Option<String>,
    #[arg(long)]
    pub chain: Option<String>,
    #[arg(long)]
    pub tvl_threshold: Option<f64>,
    #[arg(
        long,
        help = "RPC endpoint URL for blockchain interactions (e.g., Infura, Alchemy, or local node)"
    )]
    pub rpc_url: Option<String>,
    #[arg(long)]
    pub native_token_address: Option<String>,
    #[arg(long)]
    pub max_hops: Option<usize>,
    #[arg(long)]
    pub numeraire_token: Option<String>,
    #[arg(long)]
    pub probe_depth: Option<u128>,
    #[arg(long, value_delimiter = ',')]
    pub token_list: Option<Vec<String>>,
    #[arg(long)]
    pub sell_token: Option<String>,
    #[arg(long)]
    pub buy_token: Option<String>,
    #[arg(long)]
    pub sell_amount: Option<f64>,
    #[arg(long)]
    pub display_numeraire_token: Option<String>,
    #[arg(long)]
    pub price_history_file: Option<String>,
    #[arg(long)]
    pub benchmark: bool,
    #[arg(long)]
    pub best_rate: bool,
    #[arg(long, value_enum)]
    pub quote_type: Option<QuoteTypeArg>,
    #[arg(long)]
    pub max_quotes_in_list: Option<usize>,
    #[arg(long)]
    pub include_all_paths: bool,
}

#[cfg(feature = "cli")]
#[derive(clap::ValueEnum, Clone, Debug)]
pub enum QuoteTypeArg {
    Single,
    List,
    All,
}

#[cfg(feature = "cli")]
impl From<QuoteTypeArg> for QuoteType {
    fn from(arg: QuoteTypeArg) -> Self {
        match arg {
            QuoteTypeArg::Single => QuoteType::Single,
            QuoteTypeArg::List => QuoteType::List,
            QuoteTypeArg::All => QuoteType::All,
        }
    }
}

// === UTILITY IMPLEMENTATIONS ===

impl QuoteType {
    pub fn description(&self) -> &'static str {
        match self {
            QuoteType::Single => "Returns the single best quote",
            QuoteType::List => "Returns a list of top quotes ordered by amount out",
            QuoteType::All => "Returns all possible quotes across all paths",
        }
    }

    pub fn requirements(&self) -> Vec<&'static str> {
        match self {
            QuoteType::Single => vec![
                "Requires: sell_token, buy_token, sell_amount",
                "Returns: Single best path with highest amount_out",
                "Performance: Fastest execution",
            ],
            QuoteType::List => vec![
                "Requires: sell_token, buy_token, sell_amount, max_quotes_in_list",
                "Returns: Top N quotes sorted by amount_out",
                "Performance: Moderate execution time",
            ],
            QuoteType::All => vec![
                "Requires: sell_token, buy_token, sell_amount, include_all_paths=true",
                "Returns: All viable paths and quotes",
                "Performance: Slower execution, comprehensive results",
            ],
        }
    }
}

// === CONFIGURATION PRESETS ===

impl AppConfig {
    /// Fast configuration preset optimized for speed
    pub fn fast_preset(tycho_url: String, tycho_api_key: String, chain: Chain) -> Self {
        Self::new(tycho_url, tycho_api_key, chain)
            .with_routing(RoutingConfig {
                max_hops: 2,
                tvl_threshold: 1000.0,
                probe_depth: 1_000_000_000_000_000_000u128,
            })
            .with_quotes(QuoteConfig {
                quote_type: QuoteType::Single,
                max_quotes_in_list: 1,
                include_all_paths: false,
                best_rate_mode: false,
            })
    }

    /// Comprehensive configuration preset for detailed analysis
    pub fn comprehensive_preset(tycho_url: String, tycho_api_key: String, chain: Chain) -> Self {
        Self::new(tycho_url, tycho_api_key, chain)
            .with_routing(RoutingConfig {
                max_hops: 4,
                tvl_threshold: 10.0,
                probe_depth: 1_000_000_000_000_000_000u128,
            })
            .with_quotes(QuoteConfig {
                quote_type: QuoteType::All,
                max_quotes_in_list: 10,
                include_all_paths: true,
                best_rate_mode: true,
            })
    }

    /// Balanced configuration preset
    pub fn balanced_preset(tycho_url: String, tycho_api_key: String, chain: Chain) -> Self {
        Self::new(tycho_url, tycho_api_key, chain)
            .with_routing(RoutingConfig {
                max_hops: 3,
                tvl_threshold: 100.0,
                probe_depth: 1_000_000_000_000_000_000u128,
            })
            .with_quotes(QuoteConfig {
                quote_type: QuoteType::List,
                max_quotes_in_list: 5,
                include_all_paths: false,
                best_rate_mode: false,
            })
    }
}
