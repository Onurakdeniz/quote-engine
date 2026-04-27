//! Core quoting logic, including PriceQuote and SinglePathQuote structs.

use crate::config::AppConfig;
use crate::data::cache::{CachedContinuousPrice, QuoteCache};
use crate::data::component_tracker::ComponentTracker;
use crate::engine::graph::TokenGraph;
use crate::engine::simulation::simulate_path_gross;
use crate::types::{PriceQuoterError, QuoteRequest, QuoteResult, Result as PriceQuoterResult};
use num_traits::ToPrimitive; // For to_f64() method
use petgraph::prelude::{EdgeIndex, NodeIndex};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::str::FromStr; // Required for Bytes::from_str
use tycho_simulation::tycho_common::Bytes;

// Constants for gas calculation
const GWEI_TO_NATIVE_CONVERSION_FACTOR: f64 = 1e-9; // 1 Gwei = 10^-9 Native Token (e.g., ETH)
                                                    // TODO: NATIVE_TOKEN_DECIMALS was unused and removed. Native token decimal information
                                                    // should be sourced dynamically, likely from ComponentTracker or AppConfig.
                                                    // Placeholder for native token address (e.g., WETH on Ethereum)
                                                    // TODO: This should be dynamically configurable based on the chain.

/// Holds calculated gas costs and the net amount out.
#[derive(Debug, Clone, Default)]
pub struct GasCostDetails {
    pub gas_cost_native: Option<f64>, // Gas cost in the native chain token (e.g., ETH)
    pub gas_cost_token_out: Option<f64>, // Gas cost expressed in the 'to_token'
    pub net_amount_out: f64,          // The amount_out after deducting gas_cost_token_out
}

/// Calculates gas costs and the net amount out from a gross amount.
///
/// # Arguments
/// * `gross_amount_out` - The amount out from a swap simulation before gas deduction.
/// * `num_swaps` - The number of swaps in the path.
/// * `avg_gas_units_per_swap` - Average gas units estimated per swap.
/// * `gas_price_gwei` - The current gas price in Gwei.
/// * `to_token_address` - The address of the output token.
/// * `native_token_address` - The address of the chain's native token (e.g., WETH).
/// * `get_native_token_price_in_token_out` - A function/closure that can provide the price
///   of 1 unit of native token in terms of `to_token`. This is crucial for accurate conversion.
///   Signature: `Fn(native_token: &Bytes, to_token: &Bytes) -> Option<f64>`
///
/// # Returns
/// A `GasCostDetails` struct.
pub fn calculate_gas_details<F>(
    gross_amount_out: f64,
    num_swaps: usize,
    avg_gas_units_per_swap: Option<u64>,
    gas_price_gwei: Option<u64>,
    _to_token_address: &Bytes,     // Will be used with the pricing function
    _native_token_address: &Bytes, // Will be used with the pricing function
    get_native_token_price_in_token_out: F, // Placeholder for actual price conversion
) -> GasCostDetails
where
    F: Fn(&Bytes, &Bytes) -> Option<f64>,
{
    let mut details = GasCostDetails {
        gas_cost_native: None,
        gas_cost_token_out: None,
        net_amount_out: gross_amount_out,
    };

    if num_swaps == 0 {
        // No swaps, no direct swap gas cost from this path
        return details;
    }

    match (avg_gas_units_per_swap, gas_price_gwei) {
        (Some(gas_units_per_swap), Some(price_gwei)) => {
            let total_gas_units = gas_units_per_swap * num_swaps as u64;
            let gas_cost_in_gwei = total_gas_units * price_gwei;

            let cost_native = gas_cost_in_gwei as f64 * GWEI_TO_NATIVE_CONVERSION_FACTOR;
            details.gas_cost_native = Some(cost_native);

            // Use the provided closure to get the price of native token in terms of to_token
            if let Some(price_of_native_in_token_out) =
                get_native_token_price_in_token_out(_native_token_address, _to_token_address)
            {
                if price_of_native_in_token_out > 0.0 {
                    let cost_token_out = cost_native * price_of_native_in_token_out;
                    details.gas_cost_token_out = Some(cost_token_out);
                    details.net_amount_out = gross_amount_out - cost_token_out;
                    if details.net_amount_out < 0.0 {
                        details.net_amount_out = 0.0; // Cannot be negative
                    }
                } else {
                    // Price is zero or negative, cannot meaningfully convert gas cost.
                    // net_amount_out remains gross_amount_out.
                }
            } else {
                // Could not get price for conversion, net_amount_out remains gross_amount_out.
            }
        }
        _ => {
            // Not enough gas information to calculate, net_amount_out remains gross_amount_out
        }
    }

    details
}

/// Result of a price quote computation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PriceQuote {
    pub amount_out: Option<u128>,
    pub route: Vec<Bytes>,
    /// price impact over the whole route, in bps (10 000 bps = 1 %)
    pub price_impact_bps: Option<Decimal>,
    pub mid_price: Option<Decimal>,
    pub slippage_bps: Option<Decimal>,
    pub fee_bps: Option<Decimal>,
    pub protocol_fee_in_token_out: Option<Decimal>,
    pub gas_estimate: Option<u64>,
    pub path_details: Vec<SinglePathQuote>, // For multi-path
    pub gross_amount_out: Option<u128>,
    pub spread_bps: Option<Decimal>,
    /// Depth metrics: Input amount required to cause X% slippage. Key: "0.5%", "1.0%", etc. Value: input amount (u128)
    pub depth_metrics: Option<HashMap<String, u128>>,
    /// If this quote was returned from the cache, which block it was cached at
    pub cache_block: Option<u64>,
}

impl PriceQuote {
    /// Returns an empty PriceQuote, typically used when no valid quote can be generated.
    pub fn empty() -> Self {
        PriceQuote {
            amount_out: None,
            route: Vec::new(),
            price_impact_bps: None,
            mid_price: None,
            slippage_bps: None,
            fee_bps: None,
            protocol_fee_in_token_out: None,
            gas_estimate: None,
            path_details: Vec::new(),
            gross_amount_out: None,
            spread_bps: None,
            depth_metrics: None,
            cache_block: None,
        }
    }
}

/// Per-path quote details for multi-path evaluation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SinglePathQuote {
    pub amount_out: Option<u128>,
    pub route: Vec<Bytes>,
    pub mid_price: Option<Decimal>,
    pub slippage_bps: Option<Decimal>,
    pub fee_bps: Option<Decimal>,
    pub protocol_fee_in_token_out: Option<Decimal>,
    pub gas_estimate: Option<u64>,
    pub gross_amount_out: Option<u128>,
    pub spread_bps: Option<Decimal>,
    /// price impact for this path, in bps
    pub price_impact_bps: Option<Decimal>,
    pub pools: Vec<String>,
    pub input_amount: Option<u128>,
    #[serde(skip)]
    pub node_path: Vec<NodeIndex>,
    #[serde(skip)]
    pub edge_seq: Vec<EdgeIndex>,
    pub gas_cost_native: Option<Decimal>,
    pub gas_cost_in_token_out: Option<Decimal>,
}

impl SinglePathQuote {
    pub fn empty(node_path: Vec<NodeIndex>, edge_seq: Vec<EdgeIndex>, amount_in: u128) -> Self {
        SinglePathQuote {
            amount_out: None,
            route: Vec::new(),
            mid_price: None,
            slippage_bps: None,
            fee_bps: None,
            protocol_fee_in_token_out: None,
            gas_estimate: None,
            gross_amount_out: None,
            spread_bps: None,
            price_impact_bps: None,
            pools: Vec::new(),
            input_amount: Some(amount_in),
            node_path,
            edge_seq,
            gas_cost_native: None,
            gas_cost_in_token_out: None,
        }
    }
}

// Placeholder for PriceEngine methods that will be moved or called from here
// For now, this file will primarily hold the struct definitions and potentially
// the quote, quote_multi, and quote_single_path_with_edges methods later.

pub fn invalid_path_quote(
    path: &[NodeIndex],
    edge_seq: &[EdgeIndex],
    amount_in: u128,
) -> SinglePathQuote {
    SinglePathQuote {
        amount_out: None,
        route: Vec::new(), // Or construct from path if possible
        mid_price: None,
        slippage_bps: None,
        fee_bps: None,
        protocol_fee_in_token_out: None,
        gas_estimate: None,
        gross_amount_out: None,
        spread_bps: None,
        price_impact_bps: None,
        pools: Vec::new(), // Or construct from edge_seq if possible
        input_amount: Some(amount_in),
        node_path: path.to_vec(),
        edge_seq: edge_seq.to_vec(),
        gas_cost_native: None,
        gas_cost_in_token_out: None,
    }
}

// --- Illustrative Main Quoting Function with Gas Calculation ---

// Real function that simulates a swap and returns gross amount and path
fn simulate_swap_path_real(
    from_token: &Bytes,
    to_token: &Bytes,
    amount_in: f64,
    _max_hops: Option<usize>,
    tracker: &ComponentTracker,
    graph: &TokenGraph,
    pathfinder: &crate::engine::pathfinder::Pathfinder,
) -> PriceQuoterResult<(f64, Vec<Bytes>, f64, Option<f64>)> {
    // returns (gross_amount_out, path, total_fee, estimated_slippage)
    if amount_in <= 0.0 {
        return Err(PriceQuoterError::SimulationError(
            "Input amount must be positive".to_string(),
        ));
    }

    // Find the best path using real pathfinding
    let best_path_nodes = pathfinder.best_path(from_token, to_token).ok_or_else(|| {
        PriceQuoterError::SimulationError("No path found between tokens".to_string())
    })?;

    // Convert node path to edge sequence
    let edge_sequence = graph
        .derive_edges_for_node_path(&best_path_nodes)
        .ok_or_else(|| {
            PriceQuoterError::SimulationError("Could not derive edges for path".to_string())
        })?;

    // Convert amount to u128 for simulation (assuming 18 decimals)
    let amount_in_units = (amount_in * 10f64.powi(18)) as u128;

    // Use real simulation
    let gross_amount_out_units = crate::engine::simulation::simulate_path_gross(
        tracker,
        graph,
        amount_in_units,
        &best_path_nodes,
        &edge_sequence,
        None,
    )
    .ok_or_else(|| PriceQuoterError::SimulationError("Simulation failed".to_string()))?;

    // Convert back to f64
    let gross_amount_out = gross_amount_out_units as f64 / 10f64.powi(18);

    // Calculate real fees from the path
    let mut total_fee = 0.0;
    for &edge_idx in &edge_sequence {
        if let Some(edge_weight) = graph.graph.edge_weight(edge_idx) {
            if let Some(fee) = edge_weight.fee {
                total_fee += amount_in * fee; // Fee as a fraction of input
            }
        }
    }

    // Estimate real slippage based on pool reserves
    let mut estimated_slippage = 0.0;
    for &edge_idx in &edge_sequence {
        if let Some(edge_weight) = graph.graph.edge_weight(edge_idx) {
            if let Some((reserve_in, _reserve_out)) = edge_weight.reserves {
                // Simple slippage estimation using constant product formula
                let trade_size_ratio = amount_in / reserve_in;
                estimated_slippage += trade_size_ratio * 0.5; // Rough approximation
            }
        }
    }

    // Convert path to token addresses
    let route_addresses: Vec<Bytes> = best_path_nodes
        .iter()
        .filter_map(|&node_idx| {
            graph
                .graph
                .node_weight(node_idx)
                .map(|node| node.address.clone())
        })
        .collect();

    Ok((
        gross_amount_out,
        route_addresses,
        total_fee,
        Some(estimated_slippage),
    ))
}

/// Updated function to generate a quote including gas cost considerations using real implementations.
pub fn generate_quote_with_gas_real(
    request: &QuoteRequest,
    config: &AppConfig,
    tracker: &ComponentTracker,
    graph: &TokenGraph,
    pathfinder: &crate::engine::pathfinder::Pathfinder,
) -> PriceQuoterResult<QuoteResult> {
    // 1. Simulate the swap to get gross amount out and path using REAL simulation
    let (gross_amount_out, path, total_fee_from_sim, estimated_slippage) = simulate_swap_path_real(
        &request.from_token,
        &request.to_token,
        request.amount_in,
        request.max_hops,
        tracker,
        graph,
        pathfinder,
    )?;

    let num_swaps = if !path.is_empty() { path.len() - 1 } else { 0 };

    // 2. Get native token address from config
    let native_token_addr = config.native_token_address().as_ref().ok_or_else(|| {
        PriceQuoterError::ConfigError(
            "Native token address not configured in AppConfig".to_string(),
        )
    })?;

    // 5. Define a conservative price conversion function.
    let price_conversion_fn = |native_addr: &Bytes, output_addr: &Bytes| {
        if native_addr == output_addr {
            Some(1.0)
        } else {
            None
        }
    };

    // 4. Calculate gas details using dynamic values
    let gas_details = calculate_gas_details(
        gross_amount_out,
        num_swaps,
        Some(150_000), // Could be made configurable
        Some(30),      // Could be made configurable
        &request.to_token,
        native_token_addr,
        price_conversion_fn,
    );

    // 5. Calculate protocol fee amount (using 0 for now since removed from config)
    let protocol_fee_bps_value = 0.0; // Could be made configurable
    let protocol_fee_amount = gross_amount_out * (protocol_fee_bps_value / 10000.0);

    // 6. Calculate final net amount for QuoteResult
    let mut final_amount_out_net = gross_amount_out - protocol_fee_amount;
    if final_amount_out_net < 0.0 {
        final_amount_out_net = 0.0; // Ensure net amount is not negative
    }

    // 7. Construct the final QuoteResult
    Ok(QuoteResult {
        amount_out_gross: gross_amount_out,
        path,
        total_fee: Some(total_fee_from_sim), // Real DEX/LP fees from simulation
        estimated_slippage,
        gas_cost_native: gas_details.gas_cost_native,
        gas_cost_token_out: gas_details.gas_cost_token_out,
        amount_out_net: final_amount_out_net,
    })
}

// --- End of Illustrative Main Quoting Function ---

// --- Continuous Price Updater ---
// Placed here due to inability to create a new file like engine/price_updater.rs
// Ideally, this would be in its own module.

use crate::engine::PriceEngine; // Assuming PriceEngine is in crate::engine
use std::collections::HashSet;
use std::fs::{File, OpenOptions};
use std::sync::{Arc, Mutex, RwLock};
use tokio_stream::StreamExt; // For updates.next().await
use tracing::{error, info, warn};

/// Enhanced continuous price updater that tracks ALL tokens automatically
///
/// This implementation fulfills the requirement: "calculate and holds in memory all prices for all tokens it knows of"
/// Instead of requiring a tokens file, it automatically discovers and tracks all tokens from the ComponentTracker.
pub struct ContinuousPriceUpdater {
    price_cache: Arc<RwLock<QuoteCache>>,
    price_engine: Arc<PriceEngine>,
    tracker: Arc<ComponentTracker>,
    global_numeraire: Bytes,

    // Enhanced token tracking
    tokens_for_history: HashSet<Bytes>, // Tokens to save to history file (optional)
    all_tracked_tokens: Arc<RwLock<HashSet<Bytes>>>, // ALL tokens we're tracking
    token_discovery_enabled: bool,      // Whether to auto-discover new tokens
    tvl_threshold: f64,                 // Minimum TVL for token inclusion
    max_tokens_to_track: Option<usize>, // Optional limit on token count

    price_history_writer: Option<Arc<Mutex<csv::Writer<File>>>>,

    // Performance tracking
    last_update_time: Arc<RwLock<std::time::Instant>>,
    update_count: Arc<RwLock<u64>>,
    failed_price_calculations: Arc<RwLock<u64>>,
}

impl ContinuousPriceUpdater {
    pub fn new(
        config: Arc<AppConfig>,
        price_cache: Arc<RwLock<QuoteCache>>,
        price_engine: Arc<PriceEngine>,
        tracker: Arc<ComponentTracker>,
    ) -> PriceQuoterResult<Self> {
        let global_numeraire = config.numeraire_token().clone().ok_or_else(|| {
            PriceQuoterError::ConfigError("Global numeraire token not set".to_string())
        })?;

        // Load tokens for history tracking (optional - from file if provided)
        let mut tokens_for_history_set = HashSet::new();
        if let Some(tokens_file_path) = config.tokens.token_list.as_ref() {
            info!("Loading tokens for price history from token list");
            for addr_str in tokens_file_path {
                match Bytes::from_str(addr_str.trim()) {
                    Ok(token_bytes) => {
                        tokens_for_history_set.insert(token_bytes);
                    }
                    Err(e) => {
                        warn!(
                            "Failed to parse token address '{}' from token list: {}",
                            addr_str, e
                        );
                    }
                }
            }
        }

        let price_history_writer = if let Some(file_path_str) = config.price_history_file() {
            if !file_path_str.is_empty() {
                let file = OpenOptions::new()
                    .append(true)
                    .create(true)
                    .open(file_path_str)
                    .map_err(|e| {
                        PriceQuoterError::IoError(format!(
                            "Failed to open price history file: {}",
                            e
                        ))
                    })?;
                let writer = csv::WriterBuilder::new()
                    .has_headers(false)
                    .from_writer(file);
                Some(Arc::new(Mutex::new(writer)))
            } else {
                None
            }
        } else {
            None
        };

        Ok(Self {
            price_cache,
            price_engine,
            tracker,
            global_numeraire,
            tokens_for_history: tokens_for_history_set,
            all_tracked_tokens: Arc::new(RwLock::new(HashSet::new())),
            token_discovery_enabled: true, // Enable auto-discovery by default
            tvl_threshold: config.tvl_threshold(), // Use config TVL threshold
            max_tokens_to_track: Some(10000), // Reasonable default limit
            price_history_writer,
            last_update_time: Arc::new(RwLock::new(std::time::Instant::now())),
            update_count: Arc::new(RwLock::new(0)),
            failed_price_calculations: Arc::new(RwLock::new(0)),
        })
    }

    /// Configure token discovery settings
    pub fn configure_token_discovery(
        &mut self,
        enabled: bool,
        max_tokens: Option<usize>,
        tvl_threshold: f64,
    ) {
        self.token_discovery_enabled = enabled;
        self.max_tokens_to_track = max_tokens;
        self.tvl_threshold = tvl_threshold;
    }

    /// Get statistics about the continuous price updater
    pub fn get_stats(&self) -> ContinuousPriceUpdaterStats {
        let tracked_tokens_count = self.all_tracked_tokens.read().unwrap().len();
        let update_count = *self.update_count.read().unwrap();
        let failed_calculations = *self.failed_price_calculations.read().unwrap();
        let last_update = *self.last_update_time.read().unwrap();

        ContinuousPriceUpdaterStats {
            total_tokens_tracked: tracked_tokens_count,
            tokens_with_history: self.tokens_for_history.len(),
            total_updates_performed: update_count,
            failed_price_calculations: failed_calculations,
            last_update_time: last_update,
            auto_discovery_enabled: self.token_discovery_enabled,
            tvl_threshold: self.tvl_threshold,
        }
    }

    /// Discover and add new tokens based on current ComponentTracker state
    pub async fn discover_new_tokens(&self) -> usize {
        if !self.token_discovery_enabled {
            return 0;
        }

        let all_known_tokens: Vec<Bytes> = self
            .tracker
            .all_tokens
            .read()
            .unwrap()
            .keys()
            .cloned()
            .collect();
        let mut newly_discovered = 0;

        // Apply filtering based on TVL and other criteria
        let filtered_tokens = self.filter_tokens_for_tracking(&all_known_tokens).await;

        {
            let mut tracked_tokens = self.all_tracked_tokens.write().unwrap();

            // Check against max tokens limit
            if let Some(max_tokens) = self.max_tokens_to_track {
                if tracked_tokens.len() >= max_tokens {
                    warn!(
                        "Maximum token tracking limit ({}) reached. Skipping discovery.",
                        max_tokens
                    );
                    return 0;
                }
            }

            for token in filtered_tokens {
                if tracked_tokens.insert(token.clone()) {
                    newly_discovered += 1;
                    info!("🆕 Discovered new token for tracking: {:?}", token);

                    // Check if we've hit the limit
                    if let Some(max_tokens) = self.max_tokens_to_track {
                        if tracked_tokens.len() >= max_tokens {
                            warn!(
                                "Reached maximum token tracking limit ({}). Stopping discovery.",
                                max_tokens
                            );
                            break;
                        }
                    }
                }
            }
        }

        if newly_discovered > 0 {
            info!(
                "🔍 Token discovery complete: {} new tokens added for tracking",
                newly_discovered
            );
        }

        newly_discovered
    }

    /// Filter tokens based on TVL, volume, and other criteria
    async fn filter_tokens_for_tracking(&self, tokens: &[Bytes]) -> Vec<Bytes> {
        let mut filtered_tokens = Vec::new();

        // Get token metadata if available
        let token_metadata = self.tracker.token_metadata.read().unwrap();

        for token in tokens {
            // Always include the numeraire token
            if *token == self.global_numeraire {
                filtered_tokens.push(token.clone());
                continue;
            }

            // Apply TVL filtering if metadata is available
            if let Some(metadata) = token_metadata.get(token) {
                if let Some(tvl) = metadata.total_value_locked {
                    if tvl.to_f64().unwrap_or(0.0) >= self.tvl_threshold {
                        filtered_tokens.push(token.clone());
                        continue;
                    }
                }

                // Also include tokens with significant volume even if TVL is low
                if let Some(volume) = metadata.daily_volume {
                    if volume.to_f64().unwrap_or(0.0) >= self.tvl_threshold * 0.1 {
                        // 10% of TVL threshold
                        filtered_tokens.push(token.clone());
                        continue;
                    }
                }
            } else {
                // If no metadata, include token for basic tracking (it will be filtered out if no price can be calculated)
                filtered_tokens.push(token.clone());
            }
        }

        // Sort by TVL descending to prioritize important tokens
        filtered_tokens.sort_by(|a, b| {
            let tvl_a = token_metadata
                .get(a)
                .and_then(|m| m.total_value_locked)
                .map(|d| d.to_f64().unwrap_or(0.0))
                .unwrap_or(0.0);
            let tvl_b = token_metadata
                .get(b)
                .and_then(|m| m.total_value_locked)
                .map(|d| d.to_f64().unwrap_or(0.0))
                .unwrap_or(0.0);
            tvl_b
                .partial_cmp(&tvl_a)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        filtered_tokens
    }

    /// Enhanced run method that automatically tracks ALL tokens
    pub async fn run_with_auto_discovery(
        &self,
        mut updates: impl futures::Stream<Item = tycho_simulation::protocol::models::Update> + Unpin,
    ) {
        info!("🚀 Starting enhanced continuous price updater with auto-discovery");
        info!(
            "📊 TVL threshold: ${:.2}, Max tokens: {:?}",
            self.tvl_threshold, self.max_tokens_to_track
        );

        // Initial token discovery
        let initial_discovered = self.discover_new_tokens().await;
        info!(
            "🔍 Initial token discovery: {} tokens added for tracking",
            initial_discovered
        );

        let mut update_counter = 0u64;
        let mut last_discovery_block = 0u64;
        const DISCOVERY_INTERVAL_BLOCKS: u64 = 100; // Rediscover tokens every 100 blocks

        while let Some(block_update) = updates.next().await {
            update_counter += 1;
            let current_block = block_update.block_number_or_timestamp;

            // Update tracking statistics
            {
                *self.update_count.write().unwrap() = update_counter;
                *self.last_update_time.write().unwrap() = std::time::Instant::now();
            }

            // Periodic token discovery
            if current_block.saturating_sub(last_discovery_block) >= DISCOVERY_INTERVAL_BLOCKS {
                let newly_discovered = self.discover_new_tokens().await;
                if newly_discovered > 0 {
                    info!(
                        "🔍 Periodic token discovery at block {}: {} new tokens",
                        current_block, newly_discovered
                    );
                }
                last_discovery_block = current_block;
            }

            // Get all currently tracked tokens
            let tracked_tokens: Vec<Bytes> = {
                self.all_tracked_tokens
                    .read()
                    .unwrap()
                    .iter()
                    .cloned()
                    .collect()
            };

            if tracked_tokens.is_empty() {
                warn!("No tokens are being tracked. Waiting for token discovery...");
                continue;
            }

            info!(
                "🔄 Block #{}: Updating prices for {} tracked tokens",
                current_block,
                tracked_tokens.len()
            );

            // Update prices for all tracked tokens
            let successful_updates = self
                .update_all_token_prices(current_block, &tracked_tokens)
                .await;

            if successful_updates < tracked_tokens.len() {
                let failed_count = tracked_tokens.len() - successful_updates;
                warn!(
                    "⚠️  {} out of {} price calculations failed",
                    failed_count,
                    tracked_tokens.len()
                );

                // Update failed calculation counter
                {
                    let mut failed_counter = self.failed_price_calculations.write().unwrap();
                    *failed_counter += failed_count as u64;
                }
            }

            // Cleanup: Remove tokens that consistently fail to price
            if update_counter.is_multiple_of(50) {
                // Every 50 blocks
                self.cleanup_failed_tokens().await;
            }

            info!(
                "✅ Block #{} processing complete: {}/{} tokens priced successfully",
                current_block,
                successful_updates,
                tracked_tokens.len()
            );
        }

        warn!("🛑 ContinuousPriceUpdater stream ended.");
    }

    /// Update prices for all tracked tokens
    async fn update_all_token_prices(&self, current_block: u64, tokens: &[Bytes]) -> usize {
        let mut successful_updates = 0;

        // Process tokens in batches to avoid overwhelming the system
        let batch_size = 20; // Smaller batches for better performance

        for (batch_index, token_batch) in tokens.chunks(batch_size).enumerate() {
            info!(
                "📊 Processing batch {}/{}: {} tokens",
                batch_index + 1,
                tokens.len().div_ceil(batch_size),
                token_batch.len()
            );

            for token_addr in token_batch {
                if token_addr == &self.global_numeraire {
                    // Numeraire always has price of 1.0
                    let cached_price_data = CachedContinuousPrice {
                        price: Some(Decimal::ONE),
                        block: current_block,
                    };
                    self.price_cache
                        .write()
                        .unwrap()
                        .update_continuous_price(token_addr.clone(), cached_price_data);

                    // Save to history if this token is in the history set
                    if self.tokens_for_history.contains(token_addr) {
                        self.save_price_to_history(token_addr, Some(Decimal::ONE), current_block);
                    }

                    successful_updates += 1;
                } else {
                    // Calculate price for non-numeraire tokens
                    if let Some(price) = self
                        .price_engine
                        .get_token_price(token_addr, Some(current_block))
                    {
                        let cached_price_data = CachedContinuousPrice {
                            price: Some(price),
                            block: current_block,
                        };
                        self.price_cache
                            .write()
                            .unwrap()
                            .update_continuous_price(token_addr.clone(), cached_price_data);

                        // Save to history if this token is in the history set
                        if self.tokens_for_history.contains(token_addr) {
                            self.save_price_to_history(token_addr, Some(price), current_block);
                        }

                        successful_updates += 1;
                    } else {
                        // Price calculation failed
                        warn!("❌ Failed to calculate price for token: {:?}", token_addr);

                        // Still cache the failed attempt to avoid repeated calculations
                        let cached_price_data = CachedContinuousPrice {
                            price: None,
                            block: current_block,
                        };
                        self.price_cache
                            .write()
                            .unwrap()
                            .update_continuous_price(token_addr.clone(), cached_price_data);
                    }
                }
            }

            // Small delay between batches to prevent overwhelming the system
            if batch_index < tokens.len().div_ceil(batch_size) - 1 {
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
        }

        successful_updates
    }

    /// Save price to history file
    fn save_price_to_history(&self, token: &Bytes, price: Option<Decimal>, block: u64) {
        if let Some(writer_arc) = &self.price_history_writer {
            let mut writer_guard = writer_arc.lock().unwrap();
            let timestamp = chrono::Utc::now().to_rfc3339();
            let price_str = price.map(|p| p.to_string()).unwrap_or_default();

            if let Err(e) = writer_guard.write_record(&[
                timestamp,
                format!("{:?}", token),
                price_str,
                block.to_string(),
            ]) {
                error!("Failed to write price history to CSV: {:?}", e);
            } else if let Err(e) = writer_guard.flush() {
                error!("Failed to flush price history CSV: {:?}", e);
            }
        }
    }

    /// Remove tokens that consistently fail to price
    async fn cleanup_failed_tokens(&self) {
        let mut tokens_to_remove = Vec::new();

        // Check which tokens have consistently failed
        {
            let tracked_tokens = self.all_tracked_tokens.read().unwrap();
            let price_cache = self.price_cache.read().unwrap();

            for token in tracked_tokens.iter() {
                if let Some((cached_price, _)) = price_cache.continuous_prices.peek(token) {
                    if cached_price.price.is_none() {
                        // Token has failed to price, consider removing if it's not important
                        if !self.tokens_for_history.contains(token)
                            && *token != self.global_numeraire
                        {
                            tokens_to_remove.push(token.clone());
                        }
                    }
                }
            }
        }

        // Remove failed tokens (but keep a reasonable number for retry)
        if !tokens_to_remove.is_empty() {
            let mut tracked_tokens = self.all_tracked_tokens.write().unwrap();
            let removal_limit = (tokens_to_remove.len() / 4).max(1); // Remove max 25% at a time

            for (i, token) in tokens_to_remove.iter().enumerate() {
                if i >= removal_limit {
                    break;
                }
                if tracked_tokens.remove(token) {
                    info!(
                        "🗑️  Removed consistently failing token from tracking: {:?}",
                        token
                    );
                }
            }
        }
    }

    /// Get all tokens currently being tracked
    pub fn get_tracked_tokens(&self) -> HashSet<Bytes> {
        self.all_tracked_tokens.read().unwrap().clone()
    }

    /// Manually add a token for tracking
    pub fn add_token_for_tracking(&self, token: Bytes) -> bool {
        self.all_tracked_tokens.write().unwrap().insert(token)
    }

    /// Manually remove a token from tracking
    pub fn remove_token_from_tracking(&self, token: &Bytes) -> bool {
        self.all_tracked_tokens.write().unwrap().remove(token)
    }
}

/// Statistics about the continuous price updater
#[derive(Debug, Clone)]
pub struct ContinuousPriceUpdaterStats {
    pub total_tokens_tracked: usize,
    pub tokens_with_history: usize,
    pub total_updates_performed: u64,
    pub failed_price_calculations: u64,
    pub last_update_time: std::time::Instant,
    pub auto_discovery_enabled: bool,
    pub tvl_threshold: f64,
}

/// Real function to generate a quote using actual Tycho simulation
pub fn generate_quote_with_real_simulation(
    request: &QuoteRequest,
    config: &AppConfig,
    tracker: &ComponentTracker,
    graph: &TokenGraph,
    path_nodes: &[NodeIndex],
    path_edges: &[EdgeIndex],
) -> PriceQuoterResult<QuoteResult> {
    // 1. Use REAL simulation instead of mock
    let gross_amount_out = simulate_path_gross(
        tracker,
        graph,
        request.amount_in as u128,
        path_nodes,
        path_edges,
        None,
    )
    .ok_or_else(|| PriceQuoterError::SimulationError("Failed to simulate path".to_string()))?;

    let num_swaps = if !path_edges.is_empty() {
        path_edges.len()
    } else {
        0
    };

    // 2. Convert route from node indices to token addresses
    let route: Vec<Bytes> = path_nodes
        .iter()
        .filter_map(|&node_idx| {
            graph
                .graph
                .node_weight(node_idx)
                .map(|node| node.address.clone())
        })
        .collect();

    // 3. Calculate real fees from actual pool data
    let mut total_fee_from_sim = 0.0;
    for &edge_idx in path_edges {
        if let Some(edge_weight) = graph.graph.edge_weight(edge_idx) {
            if let Some(fee) = edge_weight.fee {
                total_fee_from_sim += fee;
            }
        }
    }

    // 4. Get native token address from config
    let native_token_addr = config.native_token_address().as_ref().ok_or_else(|| {
        PriceQuoterError::ConfigError(
            "Native token address not configured in AppConfig".to_string(),
        )
    })?;

    // 5. Define a conservative price conversion function.
    let price_conversion_fn = |native_addr: &Bytes, output_addr: &Bytes| {
        if native_addr == output_addr {
            Some(1.0)
        } else {
            None
        }
    };

    // 6. Calculate gas details with real prices
    let gas_details = calculate_gas_details(
        gross_amount_out as f64,
        num_swaps,
        Some(150_000), // Default gas units per swap
        Some(30),      // Default gas price - should be fetched from RPC
        &request.to_token,
        native_token_addr,
        price_conversion_fn,
    );

    // 7. Calculate protocol fee amount (if any)
    let protocol_fee_bps_value = 0.0; // Most DEXs don't have protocol fees
    let protocol_fee_amount = gross_amount_out as f64 * (protocol_fee_bps_value / 10000.0);

    // 8. Calculate final net amount
    let mut final_amount_out_net = gross_amount_out as f64 - protocol_fee_amount;
    if final_amount_out_net < 0.0 {
        final_amount_out_net = 0.0;
    }

    // 9. Estimate slippage based on pool reserves
    let estimated_slippage = estimate_slippage_from_pools(request.amount_in, path_edges, graph);

    // 10. Construct the final QuoteResult
    Ok(QuoteResult {
        amount_out_gross: gross_amount_out as f64,
        path: route,
        total_fee: Some(total_fee_from_sim), // Real DEX/LP fees from simulation
        estimated_slippage,
        gas_cost_native: gas_details.gas_cost_native,
        gas_cost_token_out: gas_details.gas_cost_token_out,
        amount_out_net: final_amount_out_net,
    })
}

/// Estimate slippage based on actual pool reserves and trade size
fn estimate_slippage_from_pools(
    amount_in: f64,
    path_edges: &[EdgeIndex],
    graph: &TokenGraph,
) -> Option<f64> {
    // Calculate slippage as the difference between spot price and effective price
    let mut total_slippage: f64 = 0.0;

    for &edge_idx in path_edges {
        if let Some(edge_weight) = graph.graph.edge_weight(edge_idx) {
            if let Some((reserve_in, _reserve_out)) = edge_weight.reserves {
                // Simple constant product formula slippage estimation
                let trade_size_ratio = amount_in / reserve_in;
                let estimated_slippage = trade_size_ratio * 0.5; // Rough approximation
                total_slippage += estimated_slippage;
            }
        }
    }

    Some(total_slippage.min(0.1f64)) // Cap at 10%
}
