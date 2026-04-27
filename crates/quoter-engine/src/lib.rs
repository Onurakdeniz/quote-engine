// Library entry point for price-quoter

// pub mod component_tracker; // Moved to data
// pub mod graph; // Moved to engine
// pub mod pathfinder; // Moved to engine
// pub mod price_engine; // Refactored into engine module
// pub mod cache; // Moved to data
pub mod benchmark;
pub mod config;
pub mod env_loader;
pub mod output;
pub mod types;
pub mod utils;
// pub mod history; // Moved to data

pub mod data;
pub mod engine;

// Only include Python bindings when pyo3 feature is available
#[cfg(feature = "python")]
pub mod bindings;

// #[cfg(feature = "api")]
// pub mod api;

pub use tycho_simulation::tycho_common::Bytes;

// Re-export key types for library users
pub use crate::config::AppConfig;
pub use crate::engine::quoting::{PriceQuote, SinglePathQuote};
pub use crate::types::{PriceQuoterError, QuoteRequest, QuoteResult, Result as PriceQuoterResult};
pub use rust_decimal::Decimal;

use crate::data::{cache::QuoteCache, component_tracker::ComponentTracker};
use crate::engine::graph::TokenGraph;
use crate::engine::PriceEngine;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio::sync::RwLock as TokioRwLock;

/// Main library interface for the Price Quoter
///
/// This provides a clean, unified API for all price quoter functionality
/// without requiring CLI dependencies or configuration files.
///
/// # Example
///
/// ```rust
/// use price_quoter::{PriceQuoter, PriceQuoterConfig, Bytes};
/// use std::str::FromStr;
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///     let config = PriceQuoterConfig::new(
///         "tycho-beta.propellerheads.xyz".to_string(),
///         "your-api-key".to_string(),
///         "ethereum".to_string(),
///     )?;
///     
///     let mut quoter = PriceQuoter::new(config).await?;
///     
///     // Start the quoter (begins tracking all tokens)
///     quoter.start().await?;
///     
///     // Get a quote
///     let weth = Bytes::from_str("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")?;
///     let usdc = Bytes::from_str("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")?;
///     let amount = 1_000_000_000_000_000_000u128; // 1 WETH
///     
///     let quote = quoter.get_quote(&weth, &usdc, amount).await;
///     println!("Quote: {:?}", quote);
///     
///     // Get current price of any token
///     let price = quoter.get_token_price(&weth).await;
///     println!("WETH price: {:?}", price);
///     
///     // Get all tracked token prices
///     let all_prices = quoter.get_all_prices().await;
///     println!("Total tokens tracked: {}", all_prices.len());
///     
///     Ok(())
/// }
/// ```
pub struct PriceQuoter {
    engine: Arc<PriceEngine>,
    tracker: Arc<ComponentTracker>,
    cache: Arc<RwLock<QuoteCache>>,
    config: PriceQuoterConfig,
    all_token_prices: Arc<TokioRwLock<HashMap<Bytes, TokenPriceInfo>>>,
    is_running: Arc<TokioRwLock<bool>>,
}

/// Simplified configuration for library usage
#[derive(Clone, Debug)]
pub struct PriceQuoterConfig {
    pub tycho_url: String,
    pub tycho_api_key: String,
    pub chain: String,
    pub numeraire_token: Option<Bytes>,
    pub probe_depth: Option<u128>,
    pub max_hops: Option<usize>,
    pub tvl_threshold: f64,
    pub gas_price_gwei: Option<u64>,
    pub infura_api_key: Option<String>,
    pub rpc_url: Option<String>,
    pub update_interval_ms: u64,
    pub price_staleness_threshold_ms: u64,
}

/// Information about a token's price
#[derive(Clone, Debug)]
pub struct TokenPriceInfo {
    pub price: Option<Decimal>,
    pub last_updated: std::time::Instant,
    pub block_number: u64,
    pub is_stale: bool,
}

/// Statistics about the price quoter's operation
#[derive(Clone, Debug)]
pub struct QuoterStats {
    pub total_tokens_tracked: usize,
    pub tokens_with_prices: usize,
    pub cache_hit_rate: f64,
    pub average_quote_time_ms: f64,
    pub last_update_time: std::time::Instant,
    pub current_block: u64,
}

impl PriceQuoterConfig {
    /// Create a new configuration with minimal required parameters
    pub fn new(tycho_url: String, tycho_api_key: String, chain: String) -> PriceQuoterResult<Self> {
        let chain_enum = tycho_simulation::tycho_common::models::Chain::from_str(&chain)
            .map_err(|_| PriceQuoterError::ConfigError(format!("Invalid chain: {}", chain)))?;

        let default_numeraire = match chain_enum {
            tycho_simulation::tycho_common::models::Chain::Ethereum => {
                match Bytes::from_str("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") {
                    Ok(bytes) => Some(bytes),
                    Err(_) => {
                        return Err(PriceQuoterError::ConfigError(
                            "Invalid WETH address".to_string(),
                        ))
                    }
                }
            }
            tycho_simulation::tycho_common::models::Chain::Base => {
                match Bytes::from_str("0x4200000000000000000000000000000000000006") {
                    Ok(bytes) => Some(bytes),
                    Err(_) => {
                        return Err(PriceQuoterError::ConfigError(
                            "Invalid WETH on Base address".to_string(),
                        ))
                    }
                }
            }
            _ => None,
        };

        Ok(Self {
            tycho_url,
            tycho_api_key,
            chain,
            numeraire_token: default_numeraire,
            probe_depth: Some(1_000_000_000_000_000_000u128), // 1 token unit
            max_hops: Some(3),
            tvl_threshold: 100.0, // 100 ETH minimum TVL (matches working quickstart)
            gas_price_gwei: None, // Will fetch dynamically
            infura_api_key: None,
            rpc_url: None,
            update_interval_ms: 5000,            // 5 seconds
            price_staleness_threshold_ms: 30000, // 30 seconds
        })
    }

    /// Set the numeraire token (base currency for pricing)
    pub fn with_numeraire(mut self, numeraire: Bytes) -> Self {
        self.numeraire_token = Some(numeraire);
        self
    }

    /// Set the probe depth for price calculations
    pub fn with_probe_depth(mut self, depth: u128) -> Self {
        self.probe_depth = Some(depth);
        self
    }

    /// Set the maximum number of hops for pathfinding
    pub fn with_max_hops(mut self, hops: usize) -> Self {
        self.max_hops = Some(hops);
        self
    }

    /// Set the TVL threshold for token inclusion
    pub fn with_tvl_threshold(mut self, threshold: f64) -> Self {
        self.tvl_threshold = threshold;
        self
    }

    /// Set the Infura API key for gas price updates
    pub fn with_infura_key(mut self, key: String) -> Self {
        self.infura_api_key = Some(key);
        self
    }

    /// Set the RPC URL for additional chain interactions
    pub fn with_rpc_url(mut self, url: String) -> Self {
        self.rpc_url = Some(url);
        self
    }

    /// Set the update interval for continuous price updates
    pub fn with_update_interval(mut self, interval_ms: u64) -> Self {
        self.update_interval_ms = interval_ms;
        self
    }

    /// Convert to internal AppConfig
    fn to_app_config(&self) -> PriceQuoterResult<AppConfig> {
        let _chain_enum = tycho_simulation::tycho_common::models::Chain::from_str(&self.chain)
            .map_err(|_| PriceQuoterError::ConfigError(format!("Invalid chain: {}", self.chain)))?;

        AppConfig::for_python_bindings(
            self.tycho_url.clone(),
            self.tycho_api_key.clone(),
            self.chain.clone(),
            self.rpc_url.clone(),
            self.numeraire_token
                .as_ref()
                .map(|b| format!("0x{}", hex::encode(b.as_ref()))),
            self.numeraire_token
                .as_ref()
                .map(|b| format!("0x{}", hex::encode(b.as_ref()))),
            self.probe_depth,
            self.max_hops,
            Some(self.tvl_threshold),
            None, // token_list
            None, // quote_type
            None, // max_quotes_in_list
            None, // include_all_paths
        )
        .map_err(PriceQuoterError::ConfigError)
    }
}

impl PriceQuoter {
    /// Create a new PriceQuoter instance
    pub async fn new(config: PriceQuoterConfig) -> PriceQuoterResult<Self> {
        let app_config = config.to_app_config()?;

        // Initialize components
        let tracker = Arc::new(ComponentTracker::new());
        let graph = Arc::new(RwLock::new(TokenGraph::new()));
        let cache = Arc::new(RwLock::new(QuoteCache::new()));
        let _gas_price_wei = Arc::new(RwLock::new(30_000_000_000u128)); // 30 Gwei default

        let engine = Arc::new(PriceEngine::from_config(
            (*tracker).clone(),
            graph.clone(),
            cache.clone(),
            &app_config,
        ));

        Ok(Self {
            engine,
            tracker,
            cache,
            config,
            all_token_prices: Arc::new(TokioRwLock::new(HashMap::new())),
            is_running: Arc::new(TokioRwLock::new(false)),
        })
    }

    /// Start the price quoter and begin tracking tokens
    pub async fn start(&mut self) -> PriceQuoterResult<()> {
        let mut is_running = self.is_running.write().await;
        if *is_running {
            return Err(PriceQuoterError::ConfigError(
                "Price quoter is already running".to_string(),
            ));
        }
        *is_running = true;
        drop(is_running);

        // Create the continuous price updater
        let price_updater = {
            use crate::engine::quoting::ContinuousPriceUpdater;

            // Create a simple AppConfig for the updater
            let app_config = self.config.to_app_config()?;

            ContinuousPriceUpdater::new(
                Arc::new(app_config),
                self.cache.clone(),
                self.engine.clone(),
                self.tracker.clone(),
            )?
        };

        // Connect to Tycho and run the continuous price updater directly
        let tracker_for_stream = self.tracker.clone();
        let engine_for_stream = self.engine.clone();
        let is_running_for_stream = self.is_running.clone();
        let tycho_url = self.config.tycho_url.clone();
        let tycho_api_key = self.config.tycho_api_key.clone();
        let chain_str = self.config.chain.clone();
        let tvl_threshold = self.config.tvl_threshold;

        tokio::spawn(async move {
            use futures::StreamExt;
            use std::str::FromStr;
            use tycho_simulation::evm::engine_db::tycho_db::PreCachedDB;
            use tycho_simulation::evm::protocol::{
                ekubo::state::EkuboState,
                ekubo_v3::{self, state::EkuboV3State},
                filters::{balancer_v2_pool_filter, curve_pool_filter},
                pancakeswap_v2::state::PancakeswapV2State,
                uniswap_v2::state::UniswapV2State,
                uniswap_v3::state::UniswapV3State,
                uniswap_v4::state::UniswapV4State,
                vm::state::EVMPoolState,
            };
            use tycho_simulation::evm::stream::ProtocolStreamBuilder;
            use tycho_simulation::tycho_client::feed::component_tracker::ComponentFilter;
            use tycho_simulation::tycho_common::models::Chain;
            use tycho_simulation::utils::load_all_tokens;

            let chain = Chain::from_str(&chain_str).unwrap_or(Chain::Ethereum);

            tracing::info!("🚀 Starting Tycho data ingestion with integrated price updates...");
            tracing::info!("📡 URL: {}", tycho_url);
            tracing::info!("🔗 Chain: {:?}", chain);
            tracing::info!("💰 TVL Threshold: {} ETH", tvl_threshold);

            // Load tokens first
            let all_tokens = match load_all_tokens(
                &tycho_url,
                false,
                Some(&tycho_api_key),
                true,
                chain,
                None,
                None,
            )
            .await
            {
                Ok(tokens) if !tokens.is_empty() => {
                    tracing::info!("✅ Loaded {} tokens", tokens.len());
                    *tracker_for_stream.all_tokens.write().unwrap() =
                        tokens.clone().into_iter().collect();
                    tokens
                }
                Ok(_) => {
                    tracing::error!("❌ Failed to load tokens from Tycho: empty token list");
                    return;
                }
                Err(e) => {
                    tracing::error!("❌ Failed to load tokens from Tycho: {}", e);
                    return;
                }
            };

            // Build protocol stream
            let tvl_filter = ComponentFilter::with_tvl_range(tvl_threshold, f64::INFINITY);
            tracing::info!(
                "🔍 Building protocol stream with TVL filter: {} to infinity",
                tvl_threshold
            );

            let protocol_stream = {
                let mut builder = ProtocolStreamBuilder::new(&tycho_url, chain);
                tracing::info!("📦 Adding protocol subscriptions...");

                match chain {
                    Chain::Ethereum => {
                        builder = builder
                            .exchange::<UniswapV2State>("uniswap_v2", tvl_filter.clone(), None)
                            .exchange::<UniswapV2State>("sushiswap_v2", tvl_filter.clone(), None)
                            .exchange::<PancakeswapV2State>(
                                "pancakeswap_v2",
                                tvl_filter.clone(),
                                None,
                            )
                            .exchange::<UniswapV3State>("uniswap_v3", tvl_filter.clone(), None)
                            .exchange::<UniswapV3State>("pancakeswap_v3", tvl_filter.clone(), None)
                            .exchange::<EVMPoolState<PreCachedDB>>(
                                "vm:balancer_v2",
                                tvl_filter.clone(),
                                Some(balancer_v2_pool_filter),
                            )
                            .exchange::<UniswapV4State>("uniswap_v4", tvl_filter.clone(), None)
                            .exchange::<UniswapV4State>(
                                "uniswap_v4_hooks",
                                tvl_filter.clone(),
                                None,
                            )
                            .exchange::<EkuboState>("ekubo_v2", tvl_filter.clone(), None)
                            .exchange::<EkuboV3State>(
                                "ekubo_v3",
                                tvl_filter.clone(),
                                Some(ekubo_v3::filter_fn),
                            )
                            .exchange::<EVMPoolState<PreCachedDB>>(
                                "vm:curve",
                                tvl_filter.clone(),
                                Some(curve_pool_filter),
                            );
                    }
                    Chain::Base => {
                        builder = builder
                            .exchange::<UniswapV2State>("uniswap_v2", tvl_filter.clone(), None)
                            .exchange::<UniswapV3State>("uniswap_v3", tvl_filter.clone(), None)
                            .exchange::<UniswapV4State>("uniswap_v4", tvl_filter.clone(), None);
                    }
                    _ => {
                        builder = builder
                            .exchange::<UniswapV2State>("uniswap_v2", tvl_filter.clone(), None)
                            .exchange::<UniswapV3State>("uniswap_v3", tvl_filter.clone(), None);
                    }
                }

                match builder
                    .auth_key(Some(tycho_api_key.clone()))
                    .skip_state_decode_failures(true)
                    .set_tokens(all_tokens)
                    .await
                    .build()
                    .await
                {
                    Ok(stream) => {
                        tracing::info!("✅ Protocol stream built successfully!");
                        stream
                    }
                    Err(e) => {
                        tracing::error!("❌ Failed to build protocol stream: {}", e);
                        return;
                    }
                }
            };

            // Run the continuous price updater directly with the Tycho stream
            tracing::info!("🚀 Starting continuous price updater with Tycho stream...");

            // First check if the stream is working at all
            tracing::info!("🔍 Testing stream by taking first message...");

            // Create a filtered stream that updates the tracker state
            let filtered_stream = protocol_stream.filter_map(|msg| {
                let tracker = tracker_for_stream.clone();
                let engine = engine_for_stream.clone();
                let is_running = is_running_for_stream.clone();

                async move {
                    tracing::debug!("📨 Received stream message");
                    // Check if we should continue running
                    {
                        let running = is_running.read().await;
                        if !*running {
                            return None;
                        }
                    }

                    match msg {
                        Ok(update) => {
                            tracing::info!(
                                "📈 Block {} update: {} new pools, {} pool states",
                                update.block_number_or_timestamp,
                                update.new_pairs.len(),
                                update.states.len()
                            );

                            // Update tracker state
                            {
                                let mut pools_w = tracker.all_pools.write().unwrap();
                                let mut states_w = tracker.pool_states.write().unwrap();

                                // Add new pools
                                for (id, comp) in update.new_pairs.iter() {
                                    pools_w.insert(id.clone(), comp.clone());
                                }

                                // Remove old pools
                                for id in update.removed_pairs.keys() {
                                    pools_w.remove(id);
                                    states_w.remove(id);
                                }

                                // Update pool states
                                for (id, state) in update.states.iter() {
                                    states_w.insert(id.clone(), state.clone());
                                }
                            }

                            // Update the graph
                            engine.update_graph_from_tracker_state();

                            // Return the update for the continuous price updater
                            Some(update)
                        }
                        Err(e) => {
                            tracing::error!("❌ Stream error: {:?}", e);
                            None
                        }
                    }
                }
            });

            // Pin the filtered stream
            futures::pin_mut!(filtered_stream);

            // Add logging to track stream messages
            let start_time = std::time::Instant::now();
            let mut check_interval = tokio::time::interval(std::time::Duration::from_secs(5));

            // Spawn a task to periodically log status if no messages received
            let logging_handle = tokio::spawn(async move {
                loop {
                    check_interval.tick().await;
                    tracing::warn!(
                        "⏳ Still waiting for Tycho stream messages... ({}s elapsed)",
                        start_time.elapsed().as_secs()
                    );
                }
            });

            // Run the price updater with the filtered stream
            tracing::info!("📡 Starting to consume Tycho stream...");
            price_updater.run_with_auto_discovery(filtered_stream).await;

            // Cancel the logging task
            logging_handle.abort();

            tracing::warn!("🛑 Continuous price updater ended");
        });

        tracing::info!("🚀 Price quoter started successfully");

        Ok(())
    }

    /// Stop the price quoter
    pub async fn stop(&mut self) {
        let mut is_running = self.is_running.write().await;
        *is_running = false;
    }

    /// Get a price quote between two tokens
    pub async fn get_quote(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        amount_in: u128,
    ) -> PriceQuote {
        self.engine
            .quote(token_in, token_out, amount_in, None)
            .await
    }

    /// Get a multi-path quote with path splitting optimization
    pub async fn get_multi_quote(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        amount_in: u128,
        max_paths: usize,
    ) -> PriceQuote {
        self.engine
            .quote_multi(token_in, token_out, amount_in, max_paths, None)
            .await
    }

    /// Get the best possible quote using optimal depth analysis
    pub async fn get_best_quote(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        hint_amount: Option<u128>,
    ) -> PriceQuote {
        let initial_amount = hint_amount.unwrap_or(
            self.config
                .probe_depth
                .unwrap_or(1_000_000_000_000_000_000u128),
        );
        self.engine
            .quote_at_optimal_rate(token_in, token_out, 3, Some(initial_amount), None)
            .await
    }

    /// Get the current price of a token in the configured numeraire
    pub async fn get_token_price(&self, token: &Bytes) -> Option<Decimal> {
        let prices = self.price_snapshot().await;
        if let Some(price_info) = prices.get(token) {
            if !price_info.is_stale {
                return price_info.price;
            }
        }

        // If not cached or stale, calculate fresh
        self.engine.get_token_price(token, None)
    }

    /// Get all currently tracked token prices
    pub async fn get_all_prices(&self) -> HashMap<Bytes, TokenPriceInfo> {
        self.price_snapshot().await
    }

    /// Get statistics about the quoter's operation
    pub async fn get_stats(&self) -> QuoterStats {
        let prices = self.price_snapshot().await;
        let total_tokens = prices.len();
        let tokens_with_prices = prices.values().filter(|p| p.price.is_some()).count();
        let current_block = prices
            .values()
            .map(|p| p.block_number)
            .max()
            .unwrap_or_default();

        // Get cache stats
        let cache_guard = self.cache.read().unwrap();
        let cache_metrics = cache_guard.metrics();
        let cache_hit_rate = if cache_metrics.quote_hits + cache_metrics.quote_misses > 0 {
            cache_metrics.quote_hits as f64
                / (cache_metrics.quote_hits + cache_metrics.quote_misses) as f64
        } else {
            0.0
        };

        QuoterStats {
            total_tokens_tracked: total_tokens,
            tokens_with_prices,
            cache_hit_rate,
            average_quote_time_ms: 0.0, // TODO: Track this
            last_update_time: std::time::Instant::now(), // TODO: Track this properly
            current_block,
        }
    }

    /// Get all tokens that the quoter knows about
    pub async fn get_all_tokens(&self) -> Vec<Bytes> {
        self.tracker
            .all_tokens
            .read()
            .unwrap()
            .keys()
            .cloned()
            .collect()
    }

    /// Check if a token is currently being tracked
    pub async fn is_token_tracked(&self, token: &Bytes) -> bool {
        self.price_snapshot().await.contains_key(token)
    }

    /// Force an update of all token prices
    pub async fn refresh_all_prices(&self) {
        let all_tokens: Vec<Bytes> = self
            .tracker
            .all_tokens
            .read()
            .unwrap()
            .keys()
            .cloned()
            .collect();
        Self::update_token_prices(
            &self.engine,
            &self.all_token_prices,
            &all_tokens,
            &self.config,
        )
        .await;
    }

    // ===== NEW ARBITRAGE-SPECIFIC APIs =====

    /// Find all arbitrage cycles starting from given tokens up to max_hops
    /// Returns cycles as sequences of token addresses
    pub async fn find_arbitrage_cycles(
        &self,
        start_tokens: &[Bytes],
        max_hops: usize,
    ) -> Vec<Vec<Bytes>> {
        self.engine.find_cycles(start_tokens, max_hops).await
    }

    /// Get spot price (marginal price at 0 amount) between two tokens
    /// Returns None if no direct path exists
    pub async fn get_spot_price(&self, token_in: &Bytes, token_out: &Bytes) -> Option<Decimal> {
        self.engine.get_spot_price(token_in, token_out).await
    }

    /// Check if a cycle is a candidate for arbitrage (spot price product > 1)
    pub async fn is_arbitrage_candidate(&self, cycle: &[Bytes]) -> bool {
        self.engine.is_arbitrage_candidate(cycle).await
    }

    /// Find optimal trade amount for a cycle using binary search
    /// Returns (optimal_amount_in, expected_profit, gas_cost_estimate)
    pub async fn optimize_cycle_trade(
        &self,
        cycle: &[Bytes],
        max_amount: u128,
    ) -> Option<(u128, Decimal, u64)> {
        self.engine.optimize_cycle_trade(cycle, max_amount).await
    }

    /// Get all pools that were updated in the last block
    /// Useful for efficient cycle re-checking
    pub async fn get_updated_pools(&self) -> Vec<String> {
        // TODO: Implement pool update tracking in ComponentTracker
        Vec::new()
    }

    /// Check which cycles need recalculation based on pool updates
    pub async fn get_stale_cycles(
        &self,
        all_cycles: &[Vec<Bytes>],
        updated_pools: &[String],
    ) -> Vec<usize> {
        self.engine
            .get_stale_cycles(all_cycles, updated_pools)
            .await
    }

    /// Get direct access to the token graph for advanced cycle detection
    /// This gives you access to the underlying graph structure
    pub async fn get_graph_snapshot(
        &self,
    ) -> Arc<std::sync::RwLock<crate::engine::graph::TokenGraph>> {
        self.engine.get_graph()
    }

    /// Get reserve information for a specific pool
    pub async fn get_pool_reserves(&self, pool_id: &str) -> Option<(Decimal, Decimal)> {
        self.engine.get_pool_reserves(pool_id).await
    }

    /// Update prices for a batch of tokens
    async fn update_token_prices(
        engine: &Arc<PriceEngine>,
        all_token_prices: &Arc<TokioRwLock<HashMap<Bytes, TokenPriceInfo>>>,
        tokens: &[Bytes],
        config: &PriceQuoterConfig,
    ) {
        let numeraire = config.numeraire_token.as_ref();
        if numeraire.is_none() {
            return;
        }
        let numeraire = numeraire.unwrap();

        let now = std::time::Instant::now();
        let staleness_threshold = Duration::from_millis(config.price_staleness_threshold_ms);

        // Update prices in batches to avoid overwhelming the system
        let batch_size = 50;
        for chunk in tokens.chunks(batch_size) {
            let mut price_updates = Vec::new();

            for token in chunk {
                let price = if token == numeraire {
                    // Numeraire token always has price of 1
                    Some(Decimal::ONE)
                } else {
                    // Only use real calculated prices from the engine - no mock prices
                    engine.get_token_price(token, None)
                };

                price_updates.push((token.clone(), price, 0));
            }

            // Apply updates
            {
                let mut prices = all_token_prices.write().await;
                for (token, price, block) in price_updates {
                    let existing_info = prices.get(&token);
                    let _is_stale = existing_info
                        .map(|info| now.duration_since(info.last_updated) > staleness_threshold)
                        .unwrap_or(true);

                    prices.insert(
                        token,
                        TokenPriceInfo {
                            price,
                            last_updated: now,
                            block_number: block,
                            is_stale: false,
                        },
                    );
                }
            }
        }
    }

    async fn price_snapshot(&self) -> HashMap<Bytes, TokenPriceInfo> {
        let mut prices = self.all_token_prices.read().await.clone();

        if let Ok(cache_guard) = self.cache.read() {
            for (token, (cached_price, updated_at)) in cache_guard.continuous_prices.iter() {
                prices.insert(
                    token.clone(),
                    TokenPriceInfo {
                        price: cached_price.price,
                        last_updated: *updated_at,
                        block_number: cached_price.block,
                        is_stale: updated_at.elapsed() >= cache_guard.continuous_price_max_age,
                    },
                );
            }
        }

        prices
    }
}

/// Convenience function to create and start a price quoter with minimal configuration
pub async fn create_price_quoter(
    tycho_url: String,
    tycho_api_key: String,
    chain: String,
) -> PriceQuoterResult<PriceQuoter> {
    let config = PriceQuoterConfig::new(tycho_url, tycho_api_key, chain)?;
    let mut quoter = PriceQuoter::new(config).await?;
    quoter.start().await?;
    Ok(quoter)
}
