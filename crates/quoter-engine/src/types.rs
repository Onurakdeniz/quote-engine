//! Core types and error definitions for the price quoter

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::fmt;
use tycho_simulation::tycho_common::Bytes;

/// Result type for price quoter operations
pub type Result<T> = std::result::Result<T, PriceQuoterError>;

/// Request structure for getting a quote
#[derive(Debug, Clone)]
pub struct QuoteRequest {
    pub from_token: Bytes,
    pub to_token: Bytes,
    pub amount_in: f64,
    pub max_hops: Option<usize>,
}

/// Result structure containing quote information
#[derive(Debug, Clone)]
pub struct QuoteResult {
    pub amount_out_gross: f64,
    pub path: Vec<Bytes>,
    pub total_fee: Option<f64>,
    pub estimated_slippage: Option<f64>,
    pub gas_cost_native: Option<f64>,
    pub gas_cost_token_out: Option<f64>,
    pub amount_out_net: f64,
}

/// Error types for price quoter operations
#[derive(Debug, Clone)]
pub enum PriceQuoterError {
    ConfigError(String),
    SimulationError(String),
    IoError(String),
    NetworkError(String),
    ParsingError(String),
    ValidationError(String),
}

impl fmt::Display for PriceQuoterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PriceQuoterError::ConfigError(msg) => write!(f, "Configuration error: {}", msg),
            PriceQuoterError::SimulationError(msg) => write!(f, "Simulation error: {}", msg),
            PriceQuoterError::IoError(msg) => write!(f, "IO error: {}", msg),
            PriceQuoterError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            PriceQuoterError::ParsingError(msg) => write!(f, "Parsing error: {}", msg),
            PriceQuoterError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl std::error::Error for PriceQuoterError {}

impl From<std::io::Error> for PriceQuoterError {
    fn from(error: std::io::Error) -> Self {
        PriceQuoterError::IoError(error.to_string())
    }
}

impl From<serde_json::Error> for PriceQuoterError {
    fn from(error: serde_json::Error) -> Self {
        PriceQuoterError::ParsingError(error.to_string())
    }
}

/// Token metadata for universe tracking
#[derive(Debug, Clone)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub address: Bytes,
    pub decimals: u8,
    pub chain_id: u64,
    pub last_updated_block: u64,
    pub total_value_locked: Option<Decimal>,
    pub daily_volume: Option<Decimal>,
    pub market_cap: Option<Decimal>,
    pub price_usd: Option<Decimal>,
    pub is_verified: bool,
    pub tags: Vec<String>,
    pub thirty_day_tx_count: Option<u64>,
    pub is_stablecoin: bool,
    pub is_governance_token: bool,
    pub last_updated: DateTime<Utc>,
}

/// Filter criteria for token universe queries
#[derive(Debug, Clone, Default)]
pub struct TokenUniverseFilter {
    pub min_tvl: Option<Decimal>,
    pub max_tvl: Option<Decimal>,
    pub min_volume: Option<Decimal>,
    pub min_daily_volume: Option<Decimal>,
    pub min_market_cap: Option<Decimal>,
    pub verified_only: bool,
    pub tags: Vec<String>,
    pub exclude_tags: Vec<String>,
    pub chain_ids: Vec<u64>,
    pub min_thirty_day_tx_count: Option<u64>,
    pub max_tokens: Option<usize>,
}

/// Statistics about the token universe
#[derive(Debug, Clone)]
pub struct TokenUniverseStats {
    pub total_tokens: usize,
    pub tokens_with_tvl: usize,
    pub tokens_with_volume: usize,
    pub total_tvl: Decimal,
    pub total_volume_24h: Decimal,
    pub last_updated: DateTime<Utc>,
    pub memory_usage_bytes: usize,
}

/// Trait for providing token universe data
#[async_trait]
pub trait TokenUniverseProvider {
    /// Get filtered token universe
    async fn get_token_universe(&self, filter: &TokenUniverseFilter) -> Result<Vec<TokenMetadata>>;

    /// Get metadata for a specific token
    async fn get_token_metadata(&self, token_address: &Bytes) -> Result<Option<TokenMetadata>>;

    /// Update token metadata
    async fn update_token_metadata(&self, metadata: &[TokenMetadata]) -> Result<()>;

    /// Get universe statistics
    async fn get_universe_stats(&self) -> Result<TokenUniverseStats>;
}

impl From<reqwest::Error> for PriceQuoterError {
    fn from(error: reqwest::Error) -> Self {
        PriceQuoterError::NetworkError(error.to_string())
    }
}
