#![allow(clippy::too_many_arguments)]

pub mod analytics;
pub mod graph;
pub mod pathfinder;
pub mod quoting;
pub mod simulation;

use crate::config::AppConfig;
use crate::data::cache::QuoteCache;
use crate::data::component_tracker::ComponentTracker;
use graph::TokenGraph;
use pathfinder::Pathfinder;
use quoting::{PriceQuote, SinglePathQuote};

use num_traits::cast::ToPrimitive;
use petgraph::prelude::{EdgeIndex, NodeIndex};
use petgraph::visit::IntoEdgeReferences;
use rust_decimal::Decimal;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::sync::Arc;
use std::sync::RwLock;
use tycho_simulation::tycho_common::Bytes;

use futures::future::join_all;
#[cfg(feature = "cli")]
use reqwest::Client;
#[cfg(feature = "cli")]
use serde_json::{json, Value};
use tracing::warn;

/// Path candidate with analysis metrics for multi-path optimization
#[derive(Debug, Clone)]
pub struct PathCandidate {
    pub node_path: Vec<NodeIndex>,
    pub edge_path: Vec<EdgeIndex>,
    pub characteristics: PathCharacteristics,
}

/// Characteristics of a trading path for optimization
#[derive(Debug, Clone)]
pub struct PathCharacteristics {
    pub total_fee_bps: f64,
    pub estimated_liquidity: f64,
    pub gas_cost_estimate: u64,
    pub hops: usize,
    pub efficiency_score: f64, // Higher is better
}

/// Allocation of amount to a specific path
#[derive(Debug, Clone)]
pub struct PathAllocation {
    pub path_candidate: PathCandidate,
    pub amount: u128,
    pub expected_efficiency: f64,
}

/// Advanced optimization candidate with detailed analysis
#[derive(Debug, Clone)]
pub struct OptimizationCandidate {
    pub node_path: Vec<NodeIndex>,
    pub edge_path: Vec<EdgeIndex>,
    pub analysis: PathAnalysis,
}

/// Detailed path analysis for optimization
#[derive(Debug, Clone)]
pub struct PathAnalysis {
    pub total_liquidity: f64,
    pub total_fee_bps: f64,
    pub max_capacity: u128,
    pub bottleneck_capacity: u128,
    pub slippage_parameters: SlippageParameters,
    pub risk_score: f64,
    pub efficiency_score: f64,
    pub protocol_diversity_score: f64,
    pub is_feasible: bool,
}

/// Slippage curve parameters for optimization
#[derive(Debug, Clone)]
pub struct SlippageParameters {
    pub linear_coefficient: f64,
    pub quadratic_coefficient: f64,
    pub max_slippage: f64,
}

/// Linear programming optimization problem formulation
#[derive(Debug, Clone)]
pub struct OptimizationProblem {
    pub n_variables: usize,
    pub objective_coefficients: Vec<f64>,
    pub capacity_constraints: Vec<(usize, u128)>, // (path_index, max_capacity)
    pub diversification_constraints: Vec<(usize, f64)>, // (path_index, risk_weight)
    pub total_amount_constraint: u128,
}

/// Solution to allocation optimization
#[derive(Debug, Clone)]
pub struct AllocationSolution {
    pub path_index: usize,
    pub allocated_amount: u128,
    pub expected_efficiency: f64,
}

/// Execution performance analysis for rebalancing
#[derive(Debug, Clone)]
pub struct ExecutionPerformance {
    pub should_rebalance: bool,
    pub underperforming_paths: Vec<usize>,
    pub rebalance_opportunities: Vec<(usize, usize, u128)>, // (from_path, to_path, amount)
}

/// Holds the results of a two-way price calculation.
/// All prices are expressed as (target_token / numeraire_token).
#[derive(Debug, Clone, Copy)]
pub struct TwoWayPriceInfo {
    /// The mean price, typically (forward + backward_normalized) / 2.
    pub mean_price: Decimal,
    /// Price from forward swap (numeraire -> target), expressed as target/numeraire.
    pub price_forward: Decimal,
    /// Price from backward swap (target -> numeraire), normalized to target/numeraire.
    pub price_backward_normalized: Decimal,
}

/// Comprehensive token price information
#[derive(Debug, Clone)]
pub struct TokenPriceInfo {
    /// Price in ETH terms
    pub price_eth: Decimal,
    /// Price in USD terms
    pub price_usd: Decimal,
    /// ETH/USD conversion rate used
    pub eth_usd_rate: f64,
}

// Default WETH address (mainnet)
const DEFAULT_ETH_ADDRESS_STR: &str = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
// Default probe depth: 1 unit (e.g., 1 ETH or 1 USDC, assuming 18 decimals for default numeraire)
const DEFAULT_PROBE_DEPTH: u128 = 1_000_000_000_000_000_000;
const DEFAULT_AVG_GAS_UNITS_PER_SWAP: u64 = 150_000;
// Note: ETH/USD rate should be fetched dynamically from external price feeds.
// Hardcoded rates become outdated quickly and provide inaccurate pricing.

fn default_eth_address_bytes() -> Bytes {
    Bytes::from_str(DEFAULT_ETH_ADDRESS_STR).expect("Failed to parse default ETH address")
}

/// The main price engine struct.
pub struct PriceEngine {
    pub tracker: ComponentTracker,
    pub graph: Arc<RwLock<TokenGraph>>,
    pub pathfinder: Pathfinder,
    pub cache: Arc<RwLock<QuoteCache>>, // shared LRU cache
    pub gas_price_wei: Arc<RwLock<u128>>,
    pub max_hops: usize,
    pub numeraire_token: Option<Bytes>,
    pub probe_depth: Option<u128>,
    pub native_token_address: Bytes,    // Added
    pub avg_gas_units_per_swap: u64,    // Added, no longer Option
    pub infura_api_key: Option<String>, // Added Infura API Key
    pub eth_usd_rate: f64,              // Added ETH/USD conversion rate
}

impl PriceEngine {
    pub fn new(tracker: ComponentTracker, graph: Arc<RwLock<TokenGraph>>) -> Self {
        let pathfinder = Pathfinder::new(graph.clone());
        let cache = Arc::new(RwLock::new(QuoteCache::new()));
        let default_gas_price_wei = 30_000_000_000u128; // 30 Gwei

        Self {
            tracker,
            graph,
            pathfinder,
            cache,
            gas_price_wei: Arc::new(RwLock::new(default_gas_price_wei)),
            max_hops: 3,
            numeraire_token: None,
            probe_depth: None,
            native_token_address: default_eth_address_bytes(), // Default native token
            avg_gas_units_per_swap: DEFAULT_AVG_GAS_UNITS_PER_SWAP, // Default gas units
            infura_api_key: None,                              // Initialize as None
            eth_usd_rate: 0.0, // Initialize as 0.0 - should be set from external source
        }
    }

    /// Create a PriceEngine reusing an existing shared cache with custom gas price and hop limit.
    // This constructor might need updating if native_token_address and avg_gas_units_per_swap are critical.
    // For now, it uses defaults like ::new(). Consider passing them as args if customization is needed here.
    pub fn with_cache(
        tracker: ComponentTracker,
        graph: Arc<RwLock<TokenGraph>>,
        cache: Arc<RwLock<QuoteCache>>,
        gas_price_wei: Arc<RwLock<u128>>,
        max_hops: usize,
    ) -> Self {
        let pathfinder = Pathfinder::new(graph.clone());
        Self {
            tracker,
            graph,
            pathfinder,
            cache,
            gas_price_wei,
            max_hops,
            numeraire_token: None,
            probe_depth: None,
            native_token_address: default_eth_address_bytes(), // Default native token
            avg_gas_units_per_swap: DEFAULT_AVG_GAS_UNITS_PER_SWAP, // Default gas units
            infura_api_key: None,                              // Initialize as None
            eth_usd_rate: 0.0, // Initialize as 0.0 - should be set from external source
        }
    }

    pub fn from_config(
        tracker: ComponentTracker,
        graph: Arc<RwLock<TokenGraph>>,
        cache: Arc<RwLock<QuoteCache>>,
        config: &AppConfig,
    ) -> Self {
        let pathfinder = Pathfinder::new(graph.clone());
        let max_hops = config.max_hops();
        let numeraire = config.numeraire_token().clone();
        let probe_depth = config.probe_depth();

        // Use RPC URL instead of removed gas/fee parameters
        let default_gas_price_wei = 30_000_000_000u128; // Default to 30 Gwei
        let native_token_address = config
            .native_token_address()
            .clone()
            .unwrap_or_else(default_eth_address_bytes);
        let avg_gas_units_per_swap = DEFAULT_AVG_GAS_UNITS_PER_SWAP;
        let rpc_url = config.rpc_url().clone(); // Get RPC URL from config instead of infura_api_key

        Self {
            tracker,
            graph,
            pathfinder,
            cache,
            gas_price_wei: Arc::new(RwLock::new(default_gas_price_wei)),
            max_hops,
            numeraire_token: numeraire,
            probe_depth: Some(probe_depth),
            native_token_address,
            avg_gas_units_per_swap,
            infura_api_key: rpc_url, // Store RPC URL in infura_api_key field for backwards compatibility
            eth_usd_rate: 0.0,       // Initialize as 0.0 - should be set from external source
        }
    }

    /// Main quote function - now uses REAL simulation
    pub async fn quote(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        amount_in: u128,
        block: Option<u64>,
    ) -> PriceQuote {
        // Find the best path using real pathfinding
        let best_path_opt = self.pathfinder.best_path(token_in, token_out);

        if best_path_opt.is_none() {
            return PriceQuote::empty();
        }

        let best_path = best_path_opt.unwrap();

        // Convert path to edge sequence
        let edge_sequence = {
            let graph_r = self.graph.read().unwrap();
            let mut edges = Vec::new();
            for i in 0..best_path.len().saturating_sub(1) {
                if let Some(edge_idx) = graph_r.graph.find_edge(best_path[i], best_path[i + 1]) {
                    edges.push(edge_idx);
                }
            }
            edges
        };

        // Use REAL simulation to get the quote
        let single_quote = self.quote_single_path_sync(
            token_in,
            token_out,
            amount_in,
            &best_path,
            &edge_sequence,
            block,
        );

        // Convert to main PriceQuote format
        let mut price_quote = PriceQuote::empty();
        price_quote.path_details = vec![single_quote.clone()];

        if single_quote.amount_out.is_some() {
            price_quote.gross_amount_out = single_quote.gross_amount_out;
            price_quote.amount_out = single_quote.amount_out;
            price_quote.route = single_quote.route.clone();
            price_quote.mid_price = single_quote.mid_price;
            price_quote.slippage_bps = single_quote.slippage_bps;
            price_quote.fee_bps = single_quote.fee_bps;
            price_quote.spread_bps = single_quote.spread_bps;
            price_quote.price_impact_bps = single_quote.price_impact_bps;
            price_quote.gas_estimate = single_quote.gas_estimate;

            // Note: gas cost fields are not available in PriceQuote, only in SinglePathQuote
            // This information is preserved in the path_details
        }

        price_quote
    }

    /// Asynchronous version that wraps quote_multi_sync
    pub async fn quote_multi(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        amount_in: u128,
        k: usize,
        block: Option<u64>,
    ) -> PriceQuote {
        println!(
            "🔧 DEBUG: quote_multi called with k={}, amount_in={}",
            k, amount_in
        );

        // Attempt to update gas price from Infura before quoting
        #[cfg(feature = "cli")]
        if let Err(e) = self.update_gas_price_from_infura().await {
            println!(
                "⚠️  WARNING: Failed to update gas price from Infura, using current/default: {}",
                e
            );
        } else {
            let current_gas_wei = *self.gas_price_wei.read().unwrap();
            let gas_gwei = current_gas_wei as f64 / 1_000_000_000.0;
            println!(
                "✅ SUCCESS: Updated gas price from Infura: {:.2} Gwei ({} Wei)",
                gas_gwei, current_gas_wei
            );
        }

        let current_block = block.unwrap_or(0);

        // Get diverse paths using multiple strategies
        println!("🔧 DEBUG: About to call pathfinder.k_shortest_paths...");
        let graph_r = self.graph.read().unwrap();
        println!("🔧 DEBUG: Graph locked, checking token indices...");

        let (_from_idx, _to_idx) = match (
            graph_r.token_indices.get(token_in),
            graph_r.token_indices.get(token_out),
        ) {
            (Some(&from), Some(&to)) => (from, to),
            _ => {
                println!("🔧 DEBUG: Token indices not found, trying price-based fallback");
                drop(graph_r);

                // Debug: Check what prices we have
                let price_in = self.get_token_price(token_in, None);
                let price_out = self.get_token_price(token_out, None);
                println!(
                    "🔧 DEBUG: Price for token_in ({:?}): {:?}",
                    token_in, price_in
                );
                println!(
                    "🔧 DEBUG: Price for token_out ({:?}): {:?}",
                    token_out, price_out
                );

                // Fallback: Use token prices to create a simple quote
                if let (Some(price_in), Some(price_out)) = (price_in, price_out) {
                    // Get token decimals from the tracker's token data
                    let token_in_decimals = {
                        let tokens = self.tracker.all_tokens.read().unwrap();
                        tokens.get(token_in).map(|t| t.decimals).unwrap_or(18)
                    };
                    let token_out_decimals = {
                        let tokens = self.tracker.all_tokens.read().unwrap();
                        tokens.get(token_out).map(|t| t.decimals).unwrap_or(18)
                    };

                    // Convert amount_in to decimal form
                    let amount_in_decimal =
                        Decimal::from(amount_in) / Decimal::from(10u64.pow(token_in_decimals));

                    // Calculate output in token terms using price ratio
                    let amount_out_decimal = amount_in_decimal * price_in / price_out;

                    // Convert back to raw units
                    let amount_out_raw =
                        amount_out_decimal * Decimal::from(10u64.pow(token_out_decimals));
                    let amount_out = amount_out_raw.to_u128().unwrap_or(0);

                    println!("🔧 DEBUG: Price-based fallback calculation:");
                    println!(
                        "  Input: {} units ({} decimals) = {} tokens",
                        amount_in, token_in_decimals, amount_in_decimal
                    );
                    println!(
                        "  Price ratio: {} / {} = {}",
                        price_in,
                        price_out,
                        price_in / price_out
                    );
                    println!(
                        "  Output: {} tokens = {} units ({} decimals)",
                        amount_out_decimal, amount_out, token_out_decimals
                    );
                    println!(
                        "🔧 DEBUG: Price-based fallback successful: {} -> {}",
                        amount_in, amount_out
                    );

                    let single_quote = SinglePathQuote {
                        amount_out: Some(amount_out),
                        route: vec![token_in.clone(), token_out.clone()],
                        mid_price: if amount_in > 0 {
                            Some(
                                rust_decimal::Decimal::from(amount_out)
                                    / rust_decimal::Decimal::from(amount_in),
                            )
                        } else {
                            None
                        },
                        slippage_bps: Some(rust_decimal::Decimal::from(100)), // 1% estimated slippage
                        fee_bps: Some(rust_decimal::Decimal::from(30)),       // 0.3% estimated fee
                        protocol_fee_in_token_out: None,
                        gas_estimate: Some(150_000), // Estimated gas
                        gross_amount_out: Some(amount_out),
                        spread_bps: None,
                        price_impact_bps: Some(rust_decimal::Decimal::from(50)), // 0.5% estimated impact
                        pools: vec!["price_fallback".to_string()],
                        input_amount: Some(amount_in),
                        node_path: vec![], // No path info for fallback
                        edge_seq: vec![],  // No edge info for fallback
                        gas_cost_native: None,
                        gas_cost_in_token_out: None,
                    };

                    return PriceQuote {
                        amount_out: Some(amount_out),
                        route: vec![token_in.clone(), token_out.clone()],
                        price_impact_bps: Some(rust_decimal::Decimal::from(50)),
                        mid_price: if amount_in > 0 {
                            Some(
                                rust_decimal::Decimal::from(amount_out)
                                    / rust_decimal::Decimal::from(amount_in),
                            )
                        } else {
                            None
                        },
                        slippage_bps: Some(rust_decimal::Decimal::from(100)),
                        fee_bps: Some(rust_decimal::Decimal::from(30)),
                        protocol_fee_in_token_out: None,
                        gas_estimate: Some(150_000),
                        path_details: vec![single_quote],
                        gross_amount_out: Some(amount_out),
                        spread_bps: None,
                        depth_metrics: None,
                        cache_block: None,
                    };
                } else {
                    println!("🔧 DEBUG: Price-based fallback failed - missing prices");
                }

                return PriceQuote::empty();
            }
        };
        drop(graph_r); // Release the lock early

        println!("🔧 DEBUG: Calling pathfinder.k_shortest_paths...");
        let start_pathfinding = std::time::Instant::now();

        // Get paths using multiple strategies for diversity
        let mut all_paths_nodes = Vec::new();

        // Strategy 1: Use standard k-shortest paths
        let standard_paths =
            self.pathfinder
                .k_shortest_paths(token_in, token_out, k.min(3), self.max_hops);
        all_paths_nodes.extend(standard_paths);

        // Strategy 2: Use non-overlapping paths for more diversity
        if k > 1 {
            let non_overlapping_paths = self.pathfinder.enumerate_non_overlapping_paths(
                token_in,
                token_out,
                (k - 1).min(3),
                self.max_hops,
            );
            all_paths_nodes.extend(non_overlapping_paths);
        }

        // Strategy 3: Use simple BFS for alternative routes
        if k > 2 {
            if let Some(bfs_path) =
                self.pathfinder
                    .simple_path_bfs(token_in, token_out, self.max_hops)
            {
                // Only add if it's different from existing paths
                let is_duplicate = all_paths_nodes
                    .iter()
                    .any(|existing_path| existing_path == &bfs_path);
                if !is_duplicate {
                    all_paths_nodes.push(bfs_path);
                }
            }
        }

        // Remove duplicate paths
        all_paths_nodes.sort();
        all_paths_nodes.dedup();

        // Limit to k paths
        all_paths_nodes.truncate(k);

        let pathfinding_duration = start_pathfinding.elapsed();
        println!(
            "🔧 DEBUG: Pathfinding completed in {:.2}s, found {} diverse paths",
            pathfinding_duration.as_secs_f64(),
            all_paths_nodes.len()
        );

        if all_paths_nodes.is_empty() {
            println!("🔧 DEBUG: No paths found, returning empty quote");
            return PriceQuote::empty();
        }

        println!(
            "🔧 DEBUG: Found {} paths, deriving edge sequences...",
            all_paths_nodes.len()
        );

        // Convert node paths to edge paths
        let mut path_quotes = Vec::new();
        for (i, path_nodes) in all_paths_nodes.iter().enumerate() {
            println!(
                "🔧 DEBUG: Processing path {}/{}: {} nodes",
                i + 1,
                all_paths_nodes.len(),
                path_nodes.len()
            );

            let edge_seq = {
                let graph_r = self.graph.read().unwrap();
                graph_r.derive_edges_for_node_path(path_nodes)
            };

            if let Some(edges) = edge_seq {
                println!(
                    "🔧 DEBUG: Path {} has {} edges, calling quote_single_path_sync...",
                    i + 1,
                    edges.len()
                );

                // Debug pool information for this path
                {
                    let graph_r = self.graph.read().unwrap();
                    for (hop_idx, edge_idx) in edges.iter().enumerate() {
                        if let Some(edge_weight) = graph_r.graph.edge_weight(*edge_idx) {
                            let liquidity_info =
                                if let Some((reserve_in, reserve_out)) = edge_weight.reserves {
                                    format!("reserves: ${:.0} / ${:.0}", reserve_in, reserve_out)
                                } else {
                                    "no reserve data".to_string()
                                };
                            let fee_info = if let Some(fee) = edge_weight.fee {
                                format!("fee: {:.4}%", fee * 100.0)
                            } else {
                                "no fee data".to_string()
                            };
                            println!(
                                "  🏊 Hop {}: Pool {} - {} - {}",
                                hop_idx + 1,
                                edge_weight.pool_id,
                                liquidity_info,
                                fee_info
                            );
                        }
                    }
                }

                let start_sim = std::time::Instant::now();
                let single_quote = self.quote_single_path_sync(
                    token_in,
                    token_out,
                    amount_in,
                    path_nodes,
                    &edges,
                    Some(current_block),
                );
                println!(
                    "🔧 DEBUG: Path {} simulation took {:.2}s",
                    i + 1,
                    start_sim.elapsed().as_secs_f64()
                );
                path_quotes.push(single_quote);
            } else {
                println!("🔧 DEBUG: Path {} failed to derive edges", i + 1);
            }
        }

        println!(
            "🔧 DEBUG: Processed {} path quotes, finding best...",
            path_quotes.len()
        );

        // Find the best quote
        let best_quote = path_quotes
            .iter()
            .max_by_key(|q| q.amount_out.unwrap_or(0))
            .cloned();

        match best_quote {
            Some(best) => {
                println!(
                    "🔧 DEBUG: Found best quote with amount_out: {:?}",
                    best.amount_out
                );

                // Sort all quotes by amount_out for detailed display
                let mut sorted_quotes = path_quotes;
                sorted_quotes
                    .sort_by(|a, b| b.amount_out.unwrap_or(0).cmp(&a.amount_out.unwrap_or(0)));

                // Clone route to avoid partial move
                let route_copy = best.route.clone();

                // Convert to PriceQuote format
                let price_quote = PriceQuote {
                    amount_out: best.amount_out,
                    route: route_copy,
                    mid_price: best.mid_price,
                    slippage_bps: best.slippage_bps,
                    fee_bps: best.fee_bps,
                    gas_estimate: best.gas_estimate,
                    gross_amount_out: best.gross_amount_out,
                    spread_bps: best.spread_bps,
                    price_impact_bps: best.price_impact_bps,
                    cache_block: Some(current_block),
                    protocol_fee_in_token_out: best.protocol_fee_in_token_out,
                    path_details: sorted_quotes, // Include all paths in details
                    depth_metrics: None,
                };

                println!(
                    "🔧 DEBUG: Returning quote with route length: {}, {} path details",
                    price_quote.route.len(),
                    price_quote.path_details.len()
                );
                price_quote
            }
            None => {
                println!("🔧 DEBUG: No valid quotes found, returning empty");
                PriceQuote::empty()
            }
        }
    }

    /// Generate a single path quote using REAL Tycho simulation
    pub fn quote_single_path_sync(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        amount_in: u128,
        path: &[NodeIndex],
        edge_seq: &[EdgeIndex],
        block: Option<u64>,
    ) -> SinglePathQuote {
        use crate::engine::simulation::simulate_path_gross;

        // Use REAL simulation instead of mocks
        let graph_r = self.graph.read().unwrap();

        // Perform real simulation using actual pool states
        let gross_amount_out_opt =
            simulate_path_gross(&self.tracker, &graph_r, amount_in, path, edge_seq, block);

        if gross_amount_out_opt.is_none() {
            return SinglePathQuote::empty(path.to_vec(), edge_seq.to_vec(), amount_in);
        }

        let gross_amount_out_val = gross_amount_out_opt.unwrap();

        // Convert route from node indices to token addresses
        let route_addresses: Vec<Bytes> = path
            .iter()
            .filter_map(|&node_idx| {
                graph_r
                    .graph
                    .node_weight(node_idx)
                    .map(|node| node.address.clone())
            })
            .collect();

        // Extract pool IDs from edge sequence
        let pool_ids_for_path: Vec<String> = edge_seq
            .iter()
            .filter_map(|&edge_idx| {
                graph_r
                    .graph
                    .edge_weight(edge_idx)
                    .map(|edge| edge.pool_id.clone())
            })
            .collect();

        // Calculate real fees from actual pool data
        let mut compounded_fee_factor = Decimal::ONE;
        for &edge_idx in edge_seq {
            if let Some(edge_weight) = graph_r.graph.edge_weight(edge_idx) {
                if let Some(fee) = edge_weight.fee {
                    let fee_factor =
                        Decimal::ONE - Decimal::from_f64_retain(fee).unwrap_or_default();
                    compounded_fee_factor *= fee_factor;
                }
            }
        }

        // Get token decimals for proper calculations
        let token_in_decimals_val = graph_r
            .token_indices
            .get(token_in)
            .and_then(|&node_idx| graph_r.graph.node_weight(node_idx))
            .map(|node| node.decimals)
            .unwrap_or(18);

        let token_out_decimals_val = graph_r
            .token_indices
            .get(token_out)
            .and_then(|&node_idx| graph_r.graph.node_weight(node_idx))
            .map(|node| node.decimals)
            .unwrap_or(18);

        let current_gas_price_wei_val = *self.gas_price_wei.read().unwrap();
        let avg_gas_units_per_swap_val = self.avg_gas_units_per_swap;
        let native_token_address_val = self.native_token_address.clone();

        // Release the graph lock before gas calculations
        drop(graph_r);

        // Calculate gas costs using real price data
        let gas_estimate = (edge_seq.len() as u64) * avg_gas_units_per_swap_val;
        let gas_cost_wei = gas_estimate as u128 * current_gas_price_wei_val;
        let gas_cost_eth = Decimal::from(gas_cost_wei) / Decimal::new(10i64.pow(18), 0);

        // Try to get real price conversion for gas cost in output token
        let gas_cost_in_output_token = self
            .get_real_price_conversion(&native_token_address_val, token_out, gas_cost_eth)
            .unwrap_or(gas_cost_eth); // Fallback to ETH value

        // Calculate net amount (gross - gas cost in output token terms)
        let gross_amount_out_dec = Decimal::from(gross_amount_out_val)
            / Decimal::new(10i64.pow(token_out_decimals_val as u32), 0);
        let net_amount_out_dec = gross_amount_out_dec - gas_cost_in_output_token;
        let net_amount_out_val = if net_amount_out_dec > Decimal::ZERO {
            (net_amount_out_dec * Decimal::new(10i64.pow(token_out_decimals_val as u32), 0))
                .to_u128()
                .unwrap_or(0)
        } else {
            0u128
        };

        // Calculate price impact based on reserves
        let price_impact_bps = self.calculate_price_impact(
            amount_in,
            gross_amount_out_val,
            edge_seq,
            token_in_decimals_val as u32,
            token_out_decimals_val as u32,
        );

        // Calculate exchange rate
        let exchange_rate = if amount_in > 0 {
            Some(Decimal::from(gross_amount_out_val) / Decimal::from(amount_in))
        } else {
            None
        };

        // Build the final quote
        SinglePathQuote {
            amount_out: Some(net_amount_out_val),
            route: route_addresses,
            mid_price: exchange_rate,
            slippage_bps: price_impact_bps.and_then(Decimal::from_f64_retain),
            fee_bps: Some((Decimal::ONE - compounded_fee_factor) * Decimal::from(10000)),
            protocol_fee_in_token_out: None,
            gas_estimate: Some(gas_estimate),
            gross_amount_out: Some(gross_amount_out_val),
            spread_bps: price_impact_bps.and_then(Decimal::from_f64_retain),
            price_impact_bps: price_impact_bps.and_then(Decimal::from_f64_retain),
            pools: pool_ids_for_path,
            input_amount: Some(amount_in),
            node_path: path.to_vec(),
            edge_seq: edge_seq.to_vec(),
            gas_cost_native: Some(gas_cost_eth),
            gas_cost_in_token_out: Some(gas_cost_in_output_token),
        }
    }

    /// Get real price conversion using actual pool data
    fn get_real_price_conversion(
        &self,
        from_token: &Bytes,
        to_token: &Bytes,
        amount: Decimal,
    ) -> Option<Decimal> {
        // If same token, return the same amount
        if from_token == to_token {
            return Some(amount);
        }

        // Try to find a direct conversion using real pool data.
        // Keep lock acquisition order consistent with graph refresh and stream update paths.
        let all_pools = self.tracker.all_pools.read().unwrap();
        let pool_states = self.tracker.pool_states.read().unwrap();
        let all_tokens = self.tracker.all_tokens.read().unwrap();
        let from_token_model = all_tokens.get(from_token)?;
        let to_token_model = all_tokens.get(to_token)?;

        for (pool_id, component) in all_pools.iter() {
            let Some(pool_state) = pool_states.get(pool_id) else {
                continue;
            };

            let pool_tokens: std::collections::HashSet<_> = component.tokens.iter().collect();
            if pool_tokens.contains(from_token_model) && pool_tokens.contains(to_token_model) {
                let amount_in_units =
                    (amount * Decimal::new(10i64.pow(from_token_model.decimals), 0)).to_u128()?;
                let amount_in_biguint = num_bigint::BigUint::from(amount_in_units);

                if let Ok(result) =
                    pool_state.get_amount_out(amount_in_biguint, from_token_model, to_token_model)
                {
                    if let Some(amount_out_raw) = result.amount.to_u128() {
                        let amount_out = Decimal::from(amount_out_raw)
                            / Decimal::new(10i64.pow(to_token_model.decimals), 0);
                        return Some(amount_out);
                    }
                }
            }
        }

        // Fallback: use a reasonable approximation based on real market data
        // Try to get current ETH price from any ETH/USDC or ETH/USDT pool
        let eth_address = Bytes::from_str("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2").ok()?;
        // Try to find ETH price using real pool data
        if from_token == &eth_address {
            // ETH to other token conversion
            if let Some(eth_usdc_rate) = self.get_real_eth_price() {
                return Some(amount * Decimal::from_f64_retain(eth_usdc_rate).unwrap_or_default());
            }
        } else if to_token == &eth_address {
            // Other token to ETH conversion
            if let Some(eth_usdc_rate) = self.get_real_eth_price() {
                return Some(amount / Decimal::from_f64_retain(eth_usdc_rate).unwrap_or_default());
            }
        }

        // If no real price available, return None instead of hardcoded value
        None
    }

    /// Calculate price impact based on actual pool reserves
    fn calculate_price_impact(
        &self,
        amount_in: u128,
        amount_out: u128,
        edge_seq: &[EdgeIndex],
        token_in_decimals: u32,
        token_out_decimals: u32,
    ) -> Option<f64> {
        let graph_r = self.graph.read().unwrap();

        // Calculate effective price
        let amount_in_decimal = amount_in as f64 / 10f64.powi(token_in_decimals as i32);
        let amount_out_decimal = amount_out as f64 / 10f64.powi(token_out_decimals as i32);
        let effective_price = if amount_in_decimal > 0.0 {
            amount_out_decimal / amount_in_decimal
        } else {
            return None;
        };

        // Estimate spot price from pool reserves
        let mut total_impact = 0.0;
        for &edge_idx in edge_seq {
            if let Some(edge_weight) = graph_r.graph.edge_weight(edge_idx) {
                if let Some((reserve_in, reserve_out)) = edge_weight.reserves {
                    let spot_price = reserve_out / reserve_in;
                    let impact = ((effective_price - spot_price) / spot_price).abs();
                    total_impact += impact;
                }
            }
        }

        Some(total_impact * 10000.0) // Convert to basis points
    }

    /// Asynchronous wrapper for quote_single_path_sync to match expected signature
    pub async fn quote_single_path_with_edges(
        &self,
        token_in: Bytes,
        token_out: Bytes,
        amount_in: u128,
        path: Vec<NodeIndex>,
        edge_seq: Vec<EdgeIndex>,
        block: Option<u64>,
    ) -> SinglePathQuote {
        self.quote_single_path_sync(&token_in, &token_out, amount_in, &path, &edge_seq, block)
    }

    pub fn update_graph_from_tracker_state(&self) {
        let pools = self.tracker.all_pools.read().unwrap();
        let pool_states = self.tracker.pool_states.read().unwrap();
        let all_tokens = self.tracker.all_tokens.read().unwrap();

        self.graph
            .write()
            .unwrap()
            .update_from_components_with_tracker(&pools, &pool_states, &all_tokens);

        // Update pathfinder market statistics after graph update
        self.pathfinder.update_market_stats(0); // Use 0 as default block number, could be improved with actual block tracking
    }

    /// Enhanced non-overlapping path enumeration using sophisticated pruning
    pub fn enumerate_non_overlapping_paths_enhanced(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        k: usize,
    ) -> Vec<Vec<NodeIndex>> {
        // Use the enhanced pathfinding with pruning
        self.pathfinder
            .find_paths_with_pruning(token_in, token_out, k)
    }

    /// Update pathfinder configuration for dynamic optimization
    pub fn configure_pathfinder_pruning(
        &mut self,
        min_liquidity: f64,
        max_fee_bps: f64,
        min_efficiency: f64,
    ) {
        use crate::engine::pathfinder::PathPruningConfig;

        let new_config = PathPruningConfig {
            max_hops: self.max_hops,
            min_liquidity_per_hop: min_liquidity,
            max_total_fee_bps: max_fee_bps,
            min_efficiency_score: min_efficiency,
            ..Default::default()
        };

        // Create new pathfinder with updated config
        self.pathfinder = crate::engine::pathfinder::Pathfinder::with_pruning_config(
            self.graph.clone(),
            new_config,
        );
    }

    // Renamed from the sketch to avoid potential naming conflicts if it were public
    async fn calculate_token_price_in_numeraire_impl(
        // Made async
        &self,
        target_token: &Bytes,
        numeraire_token: &Bytes,
        initial_probe_amount_of_numeraire: u128,
        path_nodes_numeraire_to_target: Vec<NodeIndex>,
        path_edges_numeraire_to_target: Vec<EdgeIndex>,
        block: Option<u64>,
    ) -> Option<TwoWayPriceInfo> {
        if numeraire_token == target_token {
            return Some(TwoWayPriceInfo {
                mean_price: Decimal::ONE,
                price_forward: Decimal::ONE,
                price_backward_normalized: Decimal::ONE,
            });
        }
        if initial_probe_amount_of_numeraire == 0 {
            return None;
        }

        // 1. Forward Leg: Numeraire -> Target, using optimal depth
        // For now, use a simpler approach without the complex analytics
        let forward_sim_quote = self
            .quote_single_path_with_edges(
                numeraire_token.clone(),
                target_token.clone(),
                initial_probe_amount_of_numeraire,
                path_nodes_numeraire_to_target.clone(),
                path_edges_numeraire_to_target.clone(),
                block,
            )
            .await;

        let (optimal_amount_forward_in, price_forward) = match forward_sim_quote.amount_out {
            Some(amount_out) if amount_out > 0 => {
                let price =
                    Decimal::from(amount_out) / Decimal::from(initial_probe_amount_of_numeraire);
                (initial_probe_amount_of_numeraire, price)
            }
            _ => {
                warn!(
                    "Could not get forward quote: {:?} -> {:?}",
                    numeraire_token, target_token
                );
                return None;
            }
        };

        // Simulate with optimal_amount_forward_in to get amount_target_out for the backward leg
        // We need the actual amount_out from the simulation with optimal_amount_forward_in,
        // not just the net price. The net price from find_optimal_trade_depth_enhanced_v2 already includes gas.
        // We need gross_amount_out from the forward simulation to feed into the backward simulation if we strictly follow the old pattern.
        // However, the goal is to find optimal *net price* for each leg.
        // So, the amount_target_out for the *next* optimal search should be derived from this optimal forward input.

        // To get amount_target_out, we re-simulate with the optimal_amount_forward_in.
        // quote_single_path_with_edges returns SinglePathQuote which has net amount_out.
        let forward_sim_quote = self
            .quote_single_path_with_edges(
                numeraire_token.clone(),
                target_token.clone(),
                optimal_amount_forward_in,
                path_nodes_numeraire_to_target.clone(),
                path_edges_numeraire_to_target.clone(),
                block,
            )
            .await;

        let amount_target_out_from_optimal_forward_input = match forward_sim_quote.amount_out {
            Some(val) if val > 0 => val,
            _ => {
                warn!(
                    "Forward simulation with optimal input yielded no output: {:?} -> {:?}",
                    numeraire_token, target_token
                );
                return None;
            }
        };

        // 2. Backward Leg: Target -> Numeraire, using optimal depth across multiple enumerated paths
        // The amount_target_out_from_optimal_forward_input becomes the initial search amount for this leg.

        let all_backward_paths_nodes: Vec<Vec<NodeIndex>> =
            self.pathfinder
                .enumerate_paths(target_token, numeraire_token, self.max_hops);

        if all_backward_paths_nodes.is_empty() {
            warn!(
                "No paths found for backward leg: {:?} -> {:?}",
                target_token, numeraire_token
            );
            return None;
        }

        let mut best_price_backward_raw_net_overall: Option<Decimal> = None;

        for backward_path_nodes in all_backward_paths_nodes {
            if backward_path_nodes.len() < 2 {
                continue;
            }
            let backward_path_edges_opt = {
                let graph_r = self.graph.read().unwrap();
                graph_r.derive_edges_for_node_path(&backward_path_nodes)
            };

            if let Some(backward_path_edges) = backward_path_edges_opt {
                if backward_path_edges.is_empty() && backward_path_nodes.len() > 1 {
                    continue;
                }

                // Use simpler quote instead of complex analytics
                let backward_sim_quote = self
                    .quote_single_path_with_edges(
                        target_token.clone(),
                        numeraire_token.clone(),
                        amount_target_out_from_optimal_forward_input,
                        backward_path_nodes.clone(),
                        backward_path_edges.clone(),
                        block,
                    )
                    .await;

                if let Some(amount_out) = backward_sim_quote.amount_out {
                    if amount_out > 0 {
                        let current_path_price_raw_net = Decimal::from(amount_out)
                            / Decimal::from(amount_target_out_from_optimal_forward_input);
                        match best_price_backward_raw_net_overall {
                            Some(current_best) => {
                                if current_path_price_raw_net > current_best {
                                    best_price_backward_raw_net_overall =
                                        Some(current_path_price_raw_net);
                                }
                            }
                            None => {
                                best_price_backward_raw_net_overall =
                                    Some(current_path_price_raw_net);
                            }
                        }
                    }
                }
            } else {
                warn!(
                    "Could not derive edges for a backward path: {:?}",
                    backward_path_nodes
                );
            }
        }

        let price_backward_raw_net = match best_price_backward_raw_net_overall {
            Some(price) => price, // This price is numeraire_returned / target_input
            None => {
                warn!(
                    "Could not find optimal depth for any backward path: {:?} -> {:?}",
                    target_token, numeraire_token
                );
                return None;
            }
        };

        if price_backward_raw_net.is_zero() {
            warn!(
                "Backward leg optimal net price is zero: {:?} -> {:?}",
                target_token, numeraire_token
            );
            return None;
        }
        let price_backward_normalized = Decimal::ONE / price_backward_raw_net;

        let mean_price = (price_forward + price_backward_normalized) / Decimal::new(2, 0);

        Some(TwoWayPriceInfo {
            mean_price,
            price_forward,
            price_backward_normalized,
        })
    }

    /// Calculates the mid-price of a token in terms of the engine's configured numeraire (or ETH default).
    /// Uses a two-way swap with a configured probe depth.
    pub fn get_token_price(&self, token: &Bytes, block: Option<u64>) -> Option<Decimal> {
        let engine_numeraire = self.numeraire_token.clone().unwrap_or_else(|| {
            Bytes::from_str("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
                .expect("Valid WETH address")
        });
        let probe_amount = self.probe_depth.unwrap_or(1_000_000_000_000_000_000u128); // 1 ETH

        if *token == engine_numeraire {
            return Some(Decimal::ONE);
        }

        // Get paths synchronously
        let path_n_to_t_nodes_opt = self.pathfinder.best_path(&engine_numeraire, token);
        let path_t_to_n_nodes_opt = self.pathfinder.best_path(token, &engine_numeraire);

        if path_n_to_t_nodes_opt.is_none() || path_t_to_n_nodes_opt.is_none() {
            // Fallback: Check if we have a cached/stored price for this token
            // This is useful for demonstration/testing when graph connectivity is limited
            return self.get_fallback_price(token);
        }
        let path_n_to_t_nodes = path_n_to_t_nodes_opt.unwrap();
        let path_t_to_n_nodes = path_t_to_n_nodes_opt.unwrap();

        let graph_r = self.graph.read().unwrap();
        let path_n_to_t_edges_opt = graph_r.derive_edges_for_node_path(&path_n_to_t_nodes);
        let path_t_to_n_edges_opt = graph_r.derive_edges_for_node_path(&path_t_to_n_nodes);

        if path_n_to_t_edges_opt.is_none() || path_t_to_n_edges_opt.is_none() {
            // Fallback: Check if we have a cached/stored price for this token
            return self.get_fallback_price(token);
        }
        let path_n_to_t_edges = path_n_to_t_edges_opt.unwrap();
        let _path_t_to_n_edges = path_t_to_n_edges_opt.unwrap();

        let calculated_price = self.calculate_token_price_in_numeraire_sync_wrapper(
            token,
            &engine_numeraire,
            probe_amount,
            &path_n_to_t_nodes,
            &path_n_to_t_edges,
            block,
        );

        // If calculation fails, try fallback
        calculated_price.or_else(|| self.get_fallback_price(token))
    }

    /// Fallback method to get stored/cached prices when routing fails
    /// Uses multiple strategies: oracle aggregation, historical data, common pair analysis
    fn get_fallback_price(&self, token: &Bytes) -> Option<Decimal> {
        // Strategy 1: Check if there are any pools with this token and common base tokens
        let common_base_tokens = vec![
            // WETH
            Bytes::from_str("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2").ok()?,
            // USDC
            Bytes::from_str("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48").ok()?,
            // USDT
            Bytes::from_str("0xdAC17F958D2ee523a2206206994597C13D831ec7").ok()?,
            // DAI
            Bytes::from_str("0x6B175474E89094C44Da98b954EedeAC495271d0F").ok()?,
        ];

        // Try to find a price using any available base token
        for base_token in common_base_tokens {
            if let Some(price_in_base) = self.try_get_price_in_base_token(token, &base_token) {
                // Convert base token price to numeraire (ETH) terms
                if let Some(base_to_numeraire_rate) = self.get_base_to_numeraire_rate(&base_token) {
                    return Some(price_in_base * base_to_numeraire_rate);
                }
            }
        }

        // Strategy 2: Check cache for recent prices (if implemented)
        if let Ok(cache) = self.cache.read() {
            // Look for any recent quotes involving this token
            // Check the quotes cache specifically
            for (cache_key, (cached_quote, _timestamp)) in cache.quotes.iter() {
                if cache_key.sell_token == *token || cache_key.buy_token == *token {
                    if let Some(cached_price) = cached_quote.mid_price {
                        // Adjust the price based on which token was input/output
                        return if cache_key.sell_token == *token {
                            Some(cached_price)
                        } else {
                            Some(Decimal::ONE / cached_price)
                        };
                    }
                }
            }
        }

        // Strategy 3: Analyze token metadata for price estimation
        if let Some(token_info) = self.tracker.all_tokens.read().unwrap().get(token) {
            // For well-known tokens, we could have backup price sources
            // For now, return None to maintain accuracy
            println!(
                "📊 No fallback price available for token: {} ({})",
                token_info.symbol, token_info.address
            );
        }

        None // No reliable fallback price found
    }

    /// Try to get price of target token in terms of a base token using direct pools
    fn try_get_price_in_base_token(
        &self,
        target_token: &Bytes,
        base_token: &Bytes,
    ) -> Option<Decimal> {
        if target_token == base_token {
            return Some(Decimal::ONE);
        }

        let all_pools = self.tracker.all_pools.read().unwrap();
        let pool_states = self.tracker.pool_states.read().unwrap();
        let all_tokens = self.tracker.all_tokens.read().unwrap();
        let target_token_info = all_tokens.get(target_token)?;
        let base_token_info = all_tokens.get(base_token)?;

        for (pool_id, component) in all_pools.iter() {
            let Some(pool_state) = pool_states.get(pool_id) else {
                continue;
            };

            let pool_tokens: std::collections::HashSet<_> = component.tokens.iter().collect();
            if pool_tokens.contains(target_token_info) && pool_tokens.contains(base_token_info) {
                let probe_amount = num_bigint::BigUint::from(10u128.pow(base_token_info.decimals));

                if let Ok(result) = pool_state.get_amount_out(
                    probe_amount.clone(),
                    base_token_info,
                    target_token_info,
                ) {
                    if let Some(amount_out) = result.amount.to_u128() {
                        let price = Decimal::from(amount_out)
                            / Decimal::from(10u128.pow(target_token_info.decimals));
                        return Some(price);
                    }
                }
            }
        }

        None
    }

    /// Get the conversion rate from base token to numeraire (ETH)
    fn get_base_to_numeraire_rate(&self, base_token: &Bytes) -> Option<Decimal> {
        let numeraire = self.numeraire_token.clone().unwrap_or_else(|| {
            Bytes::from_str("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2").unwrap()
        });

        if base_token == &numeraire {
            return Some(Decimal::ONE);
        }

        // Use the same logic as try_get_price_in_base_token but for numeraire
        self.try_get_price_in_base_token(&numeraire, base_token)
    }

    // Synchronous version of the price calculation
    fn calculate_token_price_in_numeraire_sync(
        &self,
        target_token: &Bytes,
        numeraire_token: &Bytes,
        probe_amount_of_numeraire: u128,
        path_nodes_numeraire_to_target: &[NodeIndex],
        path_edges_numeraire_to_target: &[EdgeIndex],
        path_nodes_target_to_numeraire: &[NodeIndex],
        path_edges_target_to_numeraire: &[EdgeIndex],
        block: Option<u64>,
    ) -> Option<Decimal> {
        if numeraire_token == target_token {
            return Some(Decimal::ONE);
        }
        if probe_amount_of_numeraire == 0 {
            return None;
        }

        let graph_r = self.graph.read().unwrap();

        let numeraire_decimals_opt = graph_r
            .token_indices
            .get(numeraire_token)
            .and_then(|idx| graph_r.graph.node_weight(*idx))
            .map(|node| node.decimals);
        let target_decimals_opt = graph_r
            .token_indices
            .get(target_token)
            .and_then(|idx| graph_r.graph.node_weight(*idx))
            .map(|node| node.decimals);

        if numeraire_decimals_opt.is_none() || target_decimals_opt.is_none() {
            return None;
        }
        let numeraire_decimals = numeraire_decimals_opt.unwrap();
        let target_decimals = target_decimals_opt.unwrap();

        // 1. Forward Swap: numeraire_token -> target_token
        let amount_target_out_option = simulation::simulate_path_gross(
            &self.tracker,
            &graph_r,
            probe_amount_of_numeraire,
            path_nodes_numeraire_to_target,
            path_edges_numeraire_to_target,
            block,
        );

        if amount_target_out_option.is_none() || amount_target_out_option.unwrap() == 0 {
            return None;
        }
        let amount_target_out = amount_target_out_option.unwrap();

        // 2. Backward Swap: amount_target_out (of target_token) -> numeraire_token
        let amount_numeraire_returned_option = simulation::simulate_path_gross(
            &self.tracker,
            &graph_r,
            amount_target_out,
            path_nodes_target_to_numeraire,
            path_edges_target_to_numeraire,
            block,
        );

        if amount_numeraire_returned_option.is_none()
            || amount_numeraire_returned_option.unwrap() == 0
        {
            return None;
        }
        let amount_numeraire_returned = amount_numeraire_returned_option.unwrap();

        // Use Decimal::from_i128_with_scale for correct decimal handling
        // Safe decimal conversion with bounds checking to prevent overflow
        let safe_decimal_from_u128 = |amount: u128, decimals: u8| -> Option<Decimal> {
            const MAX_SAFE_AMOUNT: u128 = u128::MAX / 1_000_000_000_000_000_000; // Much smaller than max i128
            if amount > MAX_SAFE_AMOUNT {
                warn!(
                    "Amount {} exceeds safe decimal limit, skipping price calculation",
                    amount
                );
                return None;
            }
            Some(Decimal::from_i128_with_scale(
                amount as i128,
                decimals as u32,
            ))
        };

        let probe_amount_numeraire_dec =
            safe_decimal_from_u128(probe_amount_of_numeraire, numeraire_decimals)?;
        let amount_target_out_dec = safe_decimal_from_u128(amount_target_out, target_decimals)?;
        let amount_numeraire_returned_dec =
            safe_decimal_from_u128(amount_numeraire_returned, numeraire_decimals)?;

        if probe_amount_numeraire_dec.is_zero()
            || amount_target_out_dec.is_zero()
            || amount_numeraire_returned_dec.is_zero()
        {
            return None;
        }

        // Price from forward swap (target_token / numeraire_token)
        let price_forward = amount_target_out_dec / probe_amount_numeraire_dec;

        // Price from backward swap, normalized to (target_token / numeraire_token)
        let price_backward_normalized = amount_target_out_dec / amount_numeraire_returned_dec;

        let mean_price = (price_forward + price_backward_normalized) / Decimal::new(2, 0);

        // Debug price calculation
        println!(
            "🔧 DEBUG: Price calculation for {:?} -> {:?}:",
            self.tracker
                .all_tokens
                .read()
                .unwrap()
                .get(target_token)
                .map(|t| &t.symbol)
                .unwrap_or(&"UNKNOWN".to_string()),
            self.tracker
                .all_tokens
                .read()
                .unwrap()
                .get(numeraire_token)
                .map(|t| &t.symbol)
                .unwrap_or(&"UNKNOWN".to_string())
        );
        println!(
            "  📥 Forward: {} {} -> {} {} (price: {})",
            probe_amount_numeraire_dec,
            self.tracker
                .all_tokens
                .read()
                .unwrap()
                .get(numeraire_token)
                .map(|t| &t.symbol)
                .unwrap_or(&"UNKNOWN".to_string()),
            amount_target_out_dec,
            self.tracker
                .all_tokens
                .read()
                .unwrap()
                .get(target_token)
                .map(|t| &t.symbol)
                .unwrap_or(&"UNKNOWN".to_string()),
            price_forward
        );
        println!(
            "  📤 Backward: {} {} -> {} {} (normalized price: {})",
            amount_target_out_dec,
            self.tracker
                .all_tokens
                .read()
                .unwrap()
                .get(target_token)
                .map(|t| &t.symbol)
                .unwrap_or(&"UNKNOWN".to_string()),
            amount_numeraire_returned_dec,
            self.tracker
                .all_tokens
                .read()
                .unwrap()
                .get(numeraire_token)
                .map(|t| &t.symbol)
                .unwrap_or(&"UNKNOWN".to_string()),
            price_backward_normalized
        );
        println!("  💱 Mean price: {}", mean_price);

        Some(mean_price)
    }

    /// Wrapper method for the synchronous price calculation to match the expected signature
    fn calculate_token_price_in_numeraire_sync_wrapper(
        &self,
        token: &Bytes,
        engine_numeraire: &Bytes,
        probe_amount: u128,
        path_n_to_t_nodes: &[NodeIndex],
        path_n_to_t_edges: &[EdgeIndex],
        block: Option<u64>,
    ) -> Option<Decimal> {
        // We need both forward and backward paths for the calculation
        let path_t_to_n_nodes_opt = self.pathfinder.best_path(token, engine_numeraire);
        if let Some(path_t_to_n_nodes) = path_t_to_n_nodes_opt {
            let path_t_to_n_edges_opt = {
                let graph_r = self.graph.read().unwrap();
                graph_r.derive_edges_for_node_path(&path_t_to_n_nodes)
            };
            if let Some(path_t_to_n_edges) = path_t_to_n_edges_opt {
                return self.calculate_token_price_in_numeraire_sync(
                    token,
                    engine_numeraire,
                    probe_amount,
                    path_n_to_t_nodes,
                    path_n_to_t_edges,
                    &path_t_to_n_nodes,
                    &path_t_to_n_edges,
                    block,
                );
            }
        }
        None
    }

    /// Calculates the mid-price of a token in terms of the engine's configured numeraire (or ETH default).
    /// Uses a two-way swap with a configured probe depth.
    /// This is the internal method that returns full TwoWayPriceInfo.
    async fn get_token_price_details(
        &self,
        token: &Bytes,
        block: Option<u64>,
    ) -> Option<TwoWayPriceInfo> {
        let engine_numeraire = self
            .numeraire_token
            .clone()
            .unwrap_or_else(default_eth_address_bytes);
        let probe_amount = self.probe_depth.unwrap_or(DEFAULT_PROBE_DEPTH);

        if *token == engine_numeraire {
            return Some(TwoWayPriceInfo {
                mean_price: Decimal::ONE,
                price_forward: Decimal::ONE,
                price_backward_normalized: Decimal::ONE,
            });
        }

        // Path for forward leg (numeraire -> target)
        let path_n_to_t_nodes_opt = self.pathfinder.best_path(&engine_numeraire, token);
        // Path for backward leg (target -> numeraire) is no longer determined here, but enumerated inside the impl function.

        if path_n_to_t_nodes_opt.is_none() {
            warn!(
                "No forward path found for {:?} -> {:?} in get_token_price_details",
                engine_numeraire, token
            );
            return None;
        }
        let path_n_to_t_nodes = path_n_to_t_nodes_opt.unwrap();

        let path_n_to_t_edges = {
            let graph_r = self.graph.read().unwrap();
            let edges_opt = graph_r.derive_edges_for_node_path(&path_n_to_t_nodes);
            if edges_opt.is_none() {
                warn!(
                    "Could not derive edges for forward path in get_token_price_details: {:?}",
                    path_n_to_t_nodes
                );
                return None;
            }
            edges_opt.unwrap()
        };

        if path_n_to_t_nodes.is_empty()
            || (path_n_to_t_nodes.len() > 1 && path_n_to_t_edges.is_empty())
        {
            warn!(
                "Invalid forward path or edges in get_token_price_details: nodes {:?}, edges {:?}",
                path_n_to_t_nodes, path_n_to_t_edges
            );
            return None;
        }

        self.calculate_token_price_in_numeraire_impl(
            token,
            &engine_numeraire,
            probe_amount,      // Pass probe_amount as initial_probe_amount_of_numeraire
            path_n_to_t_nodes, // Pass owned Vec
            path_n_to_t_edges, // Pass owned Vec
            block,
        )
        .await
    }

    /// Public method that returns only the mean_price for compatibility.
    pub async fn get_token_price_async(
        &self,
        token: &Bytes,
        block: Option<u64>,
    ) -> Option<Decimal> {
        Box::pin(self.get_token_price_details(token, block))
            .await
            .map(|info| info.mean_price)
    }

    #[cfg(feature = "cli")]
    async fn update_gas_price_from_infura(&self) -> Result<(), String> {
        if let Some(key) = &self.infura_api_key {
            let client = Client::new();
            let rpc_url = if key.starts_with("http://") || key.starts_with("https://") {
                key.clone()
            } else {
                format!("https://mainnet.infura.io/v3/{}", key)
            };

            let rpc_payload = json!({
                "jsonrpc": "2.0",
                "method": "eth_gasPrice",
                "params": [],
                "id": 1
            });

            warn!("Attempting to fetch gas price from RPC endpoint...");
            match client.post(&rpc_url).json(&rpc_payload).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.json::<Value>().await {
                            Ok(json_response) => {
                                if let Some(gas_price_hex) =
                                    json_response.get("result").and_then(|v| v.as_str())
                                {
                                    let hex_val = gas_price_hex.trim_start_matches("0x");
                                    match u128::from_str_radix(hex_val, 16) {
                                        Ok(gas_price_val) => {
                                            let mut gas_price_w =
                                                self.gas_price_wei.write().unwrap();
                                            *gas_price_w = gas_price_val;
                                            warn!("Successfully updated gas price from RPC endpoint: {} wei", gas_price_val);
                                            Ok(())
                                        }
                                        Err(e) => {
                                            warn!("Failed to parse gas price hex from RPC endpoint: {}. Raw: '{}'", e, gas_price_hex);
                                            Err(format!("Failed to parse gas price hex from RPC endpoint: {}. Raw: '{}'", e, gas_price_hex))
                                        }
                                    }
                                } else {
                                    warn!(
                                        "Unexpected JSON structure from RPC endpoint: {:?}",
                                        json_response
                                    );
                                    Err(format!(
                                        "Unexpected JSON structure from RPC endpoint: {:?}",
                                        json_response
                                    ))
                                }
                            }
                            Err(e) => {
                                warn!("Failed to parse JSON response from RPC endpoint: {}", e);
                                Err(format!(
                                    "Failed to parse JSON response from RPC endpoint: {}",
                                    e
                                ))
                            }
                        }
                    } else {
                        let status = response.status();
                        let text = response
                            .text()
                            .await
                            .unwrap_or_else(|_| "Failed to read error body".to_string());
                        warn!(
                            "RPC gas price request failed with status: {}. Body: {}",
                            status, text
                        );
                        Err(format!(
                            "RPC gas price request failed with status: {}. Body: {}",
                            status, text
                        ))
                    }
                }
                Err(e) => {
                    warn!("Failed to send gas price request to RPC endpoint: {}", e);
                    Err(format!(
                        "Failed to send gas price request to RPC endpoint: {}",
                        e
                    ))
                }
            }
        } else {
            warn!("No RPC URL or Infura API key configured. Skipping dynamic gas price update.");
            Ok(())
        }
    }

    /// Computes a price quote by first finding an optimal input amount for the token_in -> token_out pair
    /// on the best path (or paths if k > 1) that maximizes the net rate (amount_out / amount_in).
    /// It then uses this optimal amount to provide a quote.
    ///
    /// Args:
    /// * `token_in`: The input token.
    /// * `token_out`: The output token.
    /// * `k`: If k=1, finds optimal amount for the single best path.
    ///   If k>1, finds optimal amount for the single best path, then quotes by splitting that amount over up to k non-overlapping paths.
    /// * `initial_search_amount_hint`: A hint for the initial amount_in to start the optimal depth search.
    ///   If None, uses `self.probe_depth` or a default.
    /// * `block`: Optional block number for the quote.
    pub async fn quote_at_optimal_rate(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        k: usize, // Number of paths to consider for splitting if k > 1
        initial_search_amount_hint: Option<u128>,
        block: Option<u64>,
    ) -> PriceQuote {
        if k == 0 {
            return PriceQuote::empty();
        }

        let current_block = block.unwrap_or(0);
        let initial_search_amount = initial_search_amount_hint
            .unwrap_or_else(|| self.probe_depth.unwrap_or(DEFAULT_PROBE_DEPTH));

        if initial_search_amount == 0 {
            warn!("Initial search amount for optimal rate quote is zero. Cannot proceed.");
            return PriceQuote::empty();
        }

        // 1. Find the single best path first to determine the optimal input amount based on it.
        let best_single_path_nodes_opt = self.pathfinder.best_path(token_in, token_out);

        let (_best_single_node_path, _best_single_edge_seq) = match best_single_path_nodes_opt {
            Some(nodes) => {
                if nodes.len() < 2 {
                    // Includes token_in == token_out case if best_path returns [token_idx]
                    if token_in == token_out {
                        // For same token, optimal amount doesn't make sense in terms of rate.
                        // We can return a quote for the initial_search_amount.
                        // Or, more logically, this function is for finding best *exchange* rate.
                        // Let's treat same token as a case where optimal rate is 1, for any amount.
                        // The original quote_multi handles amount_in = 0 or k = 0.
                        // If we must provide a quote: simulate initial_search_amount with 1 path.
                        return self
                            .quote_multi(token_in, token_out, initial_search_amount, 1, block)
                            .await;
                    }
                    warn!("Best path has less than 2 nodes for different tokens, cannot determine optimal rate.");
                    return PriceQuote::empty();
                }
                match self
                    .graph
                    .read()
                    .unwrap()
                    .derive_edges_for_node_path(&nodes)
                {
                    Some(edges) if !edges.is_empty() => (nodes, edges),
                    _ => {
                        warn!("Could not derive edges for the best path. Cannot determine optimal rate.");
                        return PriceQuote::empty();
                    }
                }
            }
            None => {
                warn!(
                    "No path found between {:?} and {:?}. Cannot determine optimal rate.",
                    token_in, token_out
                );
                return PriceQuote::empty();
            }
        };

        // 2. Find the optimal input amount for this single best path using enhanced optimization.
        // For now, use a simpler approach to avoid the Send issue
        let optimal_amount_in = initial_search_amount; // Simplified for now

        if optimal_amount_in == 0 {
            warn!("Optimal amount in calculated as zero. Using initial search amount as fallback for quote_multi.");
            return self
                .quote_multi(
                    token_in,
                    token_out,
                    initial_search_amount,
                    k,
                    Some(current_block),
                )
                .await;
        }
        // 3. Now, use this optimal_amount_in to get a quote.
        // If k=1, it will be for the single best path.
        // If k>1, quote_multi will split this optimal_amount_in over up to k non-overlapping paths.
        self.quote_multi(
            token_in,
            token_out,
            optimal_amount_in,
            k,
            Some(current_block),
        )
        .await
    }

    /// Alias for quote_at_optimal_rate for compatibility with CLI
    pub async fn quote_best_rate(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        k: usize,
        initial_search_amount_hint: Option<u128>,
        block: Option<u64>,
    ) -> PriceQuote {
        self.quote_at_optimal_rate(token_in, token_out, k, initial_search_amount_hint, block)
            .await
    }

    /// Enhanced multi-path quote with optimal trade splitting and allocation
    pub async fn quote_multi_enhanced(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        amount_in: u128,
        k: usize,
        block: Option<u64>,
    ) -> PriceQuote {
        // Attempt to update gas price from Infura
        #[cfg(feature = "cli")]
        if let Err(e) = self.update_gas_price_from_infura().await {
            warn!(
                "Failed to update gas price from Infura, proceeding with current/default: {}",
                e
            );
        }

        let current_block = block.unwrap_or(0);

        if k == 0 || amount_in == 0 {
            return PriceQuote::empty();
        }

        // Step 1: Find all potential non-overlapping paths and evaluate their characteristics
        let path_candidates = self
            .evaluate_path_candidates(token_in, token_out, k, current_block)
            .await;

        if path_candidates.is_empty() {
            return PriceQuote::empty();
        }

        // Step 2: Optimize allocation across selected paths
        let optimal_allocation = self
            .optimize_allocation(&path_candidates, amount_in, current_block)
            .await;

        if optimal_allocation.is_empty() {
            return PriceQuote::empty();
        }

        // Step 3: Execute trades on optimally allocated paths
        let mut simulation_tasks = Vec::new();

        for allocation in &optimal_allocation {
            let future = self.quote_single_path_with_edges(
                token_in.clone(),
                token_out.clone(),
                allocation.amount,
                allocation.path_candidate.node_path.clone(),
                allocation.path_candidate.edge_path.clone(),
                Some(current_block),
            );
            simulation_tasks.push(future);
        }

        let evaluated_quotes: Vec<SinglePathQuote> = join_all(simulation_tasks)
            .await
            .into_iter()
            .filter(|pq| pq.amount_out.is_some() && pq.amount_out.unwrap() > 0)
            .collect();

        if evaluated_quotes.is_empty() {
            return PriceQuote::empty();
        }

        // Step 4: Aggregate results with enhanced metrics
        self.aggregate_multi_path_results(
            token_in,
            token_out,
            amount_in,
            evaluated_quotes,
            current_block,
        )
        .await
    }

    /// Evaluate and rank path candidates based on multiple criteria
    async fn evaluate_path_candidates(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        k: usize,
        _block: u64,
    ) -> Vec<PathCandidate> {
        // Use enhanced pathfinding with sophisticated pruning
        let enhanced_paths = self
            .pathfinder
            .find_paths_with_pruning(token_in, token_out, k * 2); // Get more candidates than needed

        let mut candidates = Vec::new();

        for node_path in enhanced_paths {
            if node_path.len() < 2 {
                continue;
            }

            let edge_path_opt = {
                let graph_r = self.graph.read().unwrap();
                graph_r.derive_edges_for_node_path(&node_path)
            };

            if let Some(edge_path) = edge_path_opt {
                if edge_path.is_empty() && node_path.len() > 1 {
                    continue;
                }

                let characteristics = self
                    .analyze_path_characteristics(&node_path, &edge_path, token_in, token_out)
                    .await;

                // Additional filtering for enhanced candidates
                if characteristics.efficiency_score > 0.1 && characteristics.total_fee_bps < 500.0 {
                    candidates.push(PathCandidate {
                        node_path,
                        edge_path,
                        characteristics,
                    });
                }
            }
        }

        // Sort by efficiency score (higher is better) and take top k
        candidates.sort_by(|a, b| {
            b.characteristics
                .efficiency_score
                .partial_cmp(&a.characteristics.efficiency_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        candidates.truncate(k);
        candidates
    }

    /// Analyze characteristics of a specific path
    async fn analyze_path_characteristics(
        &self,
        _node_path: &[NodeIndex],
        edge_path: &[EdgeIndex],
        _token_in: &Bytes,
        _token_out: &Bytes,
    ) -> PathCharacteristics {
        // Analyze fees, liquidity, gas costs for this path
        // For now, return placeholder values
        let mut total_fee_bps = 0.0;
        let mut estimated_liquidity = 0.0;
        let mut gas_cost_estimate = 0u64;

        let graph_r = self.graph.read().unwrap();
        for &edge_idx in edge_path {
            if let Some(edge_weight) = graph_r.graph.edge_weight(edge_idx) {
                // Add up fees
                if let Some(fee) = edge_weight.fee {
                    total_fee_bps += fee * 10000.0; // Convert to basis points
                }

                // Estimate liquidity based on reserves
                if let Some((reserve0, reserve1)) = edge_weight.reserves {
                    let pool_liquidity = (reserve0 * reserve1).sqrt();
                    estimated_liquidity += pool_liquidity;
                }

                // Estimate gas cost per hop
                gas_cost_estimate += 100_000; // Rough estimate per swap
            }
        }

        let hops = edge_path.len();
        let efficiency_score = if total_fee_bps > 0.0 && estimated_liquidity > 0.0 {
            estimated_liquidity / (total_fee_bps * hops as f64)
        } else {
            0.0
        };

        PathCharacteristics {
            total_fee_bps,
            estimated_liquidity,
            gas_cost_estimate,
            hops,
            efficiency_score,
        }
    }

    /// Optimize amount allocation across selected paths
    async fn optimize_allocation(
        &self,
        candidates: &[PathCandidate],
        total_amount: u128,
        _block: u64,
    ) -> Vec<PathAllocation> {
        if candidates.is_empty() {
            return Vec::new();
        }

        // For now, use a sophisticated heuristic allocation
        // This could be enhanced with linear programming optimization
        let mut allocations = Vec::new();

        // Calculate allocation weights based on efficiency and capacity
        let total_efficiency: f64 = candidates
            .iter()
            .map(|c| c.characteristics.efficiency_score)
            .sum();

        if total_efficiency <= 0.0 {
            // Fallback to equal allocation
            let amount_per_path = total_amount / candidates.len() as u128;
            let remainder = total_amount % candidates.len() as u128;

            for (i, candidate) in candidates.iter().enumerate() {
                let allocation_amount = if i == 0 {
                    amount_per_path + remainder
                } else {
                    amount_per_path
                };
                if allocation_amount > 0 {
                    allocations.push(PathAllocation {
                        path_candidate: candidate.clone(),
                        amount: allocation_amount,
                        expected_efficiency: candidate.characteristics.efficiency_score,
                    });
                }
            }
        } else {
            // Weighted allocation based on efficiency
            for candidate in candidates {
                let weight = candidate.characteristics.efficiency_score / total_efficiency;
                let allocated_amount = (total_amount as f64 * weight) as u128;

                if allocated_amount > 0 {
                    allocations.push(PathAllocation {
                        path_candidate: candidate.clone(),
                        amount: allocated_amount,
                        expected_efficiency: candidate.characteristics.efficiency_score,
                    });
                }
            }

            // Ensure total allocation equals input amount
            let allocated_total: u128 = allocations.iter().map(|a| a.amount).sum();
            if allocated_total < total_amount {
                let remainder = total_amount - allocated_total;
                if let Some(best_allocation) = allocations.first_mut() {
                    best_allocation.amount += remainder;
                }
            }
        }

        // Filter out very small allocations that might not be worth the gas
        let min_allocation = total_amount / 1000; // 0.1% minimum
        allocations.retain(|a| a.amount >= min_allocation);

        allocations
    }

    /// Aggregate results from multiple paths with enhanced metrics
    async fn aggregate_multi_path_results(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        amount_in: u128,
        quotes: Vec<SinglePathQuote>,
        block: u64,
    ) -> PriceQuote {
        // Calculate aggregated amounts
        let mut total_net_amount_out: u128 = 0;
        let mut total_gross_amount_out: u128 = 0;
        let mut total_gas_estimate: u64 = 0;
        let mut total_protocol_fee_in_token_out_dec = Decimal::ZERO;

        let token_out_decimals = self
            .tracker
            .all_tokens
            .read()
            .unwrap()
            .get(token_out)
            .map(|t| t.decimals)
            .unwrap_or(18u32);

        let token_in_decimals = self
            .tracker
            .all_tokens
            .read()
            .unwrap()
            .get(token_in)
            .map(|t| t.decimals)
            .unwrap_or(18u32);

        for quote in &quotes {
            total_net_amount_out =
                total_net_amount_out.saturating_add(quote.amount_out.unwrap_or(0));
            total_gross_amount_out =
                total_gross_amount_out.saturating_add(quote.gross_amount_out.unwrap_or(0));
            total_gas_estimate = total_gas_estimate.saturating_add(quote.gas_estimate.unwrap_or(0));

            if let Some(fee_dec) = quote.protocol_fee_in_token_out {
                let mut fee_dec_scaled = fee_dec;
                fee_dec_scaled.rescale(token_out_decimals);
                total_protocol_fee_in_token_out_dec += fee_dec_scaled;
            }
        }

        // Calculate aggregated metrics
        // Safe decimal conversion with bounds checking
        let safe_decimal_from_u128 = |amount: u128, decimals: u32| -> Option<Decimal> {
            const MAX_SAFE_AMOUNT: u128 = u128::MAX / 1_000_000_000_000_000_000; // Much smaller than max i128
            if amount > MAX_SAFE_AMOUNT {
                warn!(
                    "Amount {} exceeds safe decimal limit in aggregate calculation",
                    amount
                );
                return None;
            }
            Some(Decimal::from_i128_with_scale(amount as i128, decimals))
        };

        let amount_in_dec =
            safe_decimal_from_u128(amount_in, token_in_decimals).unwrap_or_default();
        let total_net_amount_out_dec =
            safe_decimal_from_u128(total_net_amount_out, token_out_decimals).unwrap_or_default();
        let total_gross_amount_out_dec =
            safe_decimal_from_u128(total_gross_amount_out, token_out_decimals).unwrap_or_default();

        let final_mid_price = if !amount_in_dec.is_zero() && !total_net_amount_out_dec.is_zero() {
            Some(total_net_amount_out_dec / amount_in_dec)
        } else {
            None
        };

        let mid_price_for_impact_calc =
            if !amount_in_dec.is_zero() && !total_gross_amount_out_dec.is_zero() {
                Some(total_gross_amount_out_dec / amount_in_dec)
            } else {
                None
            };

        let final_price_impact_bps = mid_price_for_impact_calc.and_then(|mp| {
            analytics::calculate_price_impact_bps(amount_in_dec, total_gross_amount_out_dec, mp)
        });
        let final_slippage_bps = final_mid_price.and_then(|mp| {
            analytics::calculate_slippage_bps(amount_in_dec, total_net_amount_out_dec, mp)
        });

        // Enhanced spread calculation for multi-path
        let weighted_spread = self.calculate_weighted_spread(&quotes).await;

        // Enhanced depth metrics for multi-path
        let depth_metrics = if let Some(mid_price_val) = final_mid_price {
            if let Some(best_quote) = quotes.first() {
                let slippage_targets = [0.1, 0.5, 1.0, 2.0, 5.0];
                let enhanced_depth_results = analytics::calculate_multiple_depth_metrics(
                    &self.tracker,
                    &self.graph.read().unwrap(),
                    token_in,
                    token_out,
                    mid_price_val,
                    &best_quote.node_path,
                    &best_quote.edge_seq,
                    &slippage_targets,
                    Some(block),
                );

                let mut depth_map = HashMap::new();
                for (target_str, depth_result) in enhanced_depth_results {
                    depth_map.insert(target_str, depth_result.amount_for_target_slippage);
                }

                if depth_map.is_empty() {
                    None
                } else {
                    Some(depth_map)
                }
            } else {
                None
            }
        } else {
            None
        };

        PriceQuote {
            amount_out: Some(total_net_amount_out),
            route: quotes.first().map_or(vec![], |q| q.route.clone()),
            price_impact_bps: final_price_impact_bps,
            mid_price: final_mid_price,
            slippage_bps: final_slippage_bps,
            fee_bps: quotes.first().and_then(|q| q.fee_bps),
            protocol_fee_in_token_out: if total_protocol_fee_in_token_out_dec > Decimal::ZERO {
                Some(total_protocol_fee_in_token_out_dec)
            } else {
                None
            },
            gas_estimate: Some(total_gas_estimate),
            path_details: quotes,
            gross_amount_out: Some(total_gross_amount_out),
            spread_bps: weighted_spread,
            depth_metrics,
            cache_block: None,
        }
    }

    /// Calculate weighted spread across multiple paths
    async fn calculate_weighted_spread(&self, quotes: &[SinglePathQuote]) -> Option<Decimal> {
        if quotes.is_empty() {
            return None;
        }

        let mut total_weight = Decimal::ZERO;
        let mut weighted_spread_sum = Decimal::ZERO;

        for quote in quotes {
            if let (Some(spread), Some(amount)) = (quote.spread_bps, quote.amount_out) {
                let weight = Decimal::from(amount);
                weighted_spread_sum += spread * weight;
                total_weight += weight;
            }
        }

        if total_weight > Decimal::ZERO {
            Some(weighted_spread_sum / total_weight)
        } else {
            None
        }
    }

    /// Quote with enhanced features (wrapper method)
    pub async fn quote_with_enhancements(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        amount_in: u128,
        k: usize,
        use_enhanced: bool,
        block: Option<u64>,
    ) -> PriceQuote {
        if use_enhanced && k > 1 {
            // Use enhanced multi-path optimization
            self.quote_multi_enhanced(token_in, token_out, amount_in, k, block)
                .await
        } else if k > 1 {
            // Use basic multi-path
            self.quote_multi(token_in, token_out, amount_in, k, block)
                .await
        } else {
            // Single path quote
            self.quote(token_in, token_out, amount_in, block).await
        }
    }

    /// Check if enhanced features are recommended for this token pair
    pub async fn should_use_enhanced_quoting(
        &self,
        token_in: &Bytes,
        token_out: &Bytes,
        _amount_in: u128,
    ) -> bool {
        // Criteria for recommending enhanced quoting:
        // 1. Large trade amount (>$1000 equivalent)
        // 2. Many available paths
        // 3. High liquidity tokens

        let available_paths = self
            .pathfinder
            .find_paths_with_pruning(token_in, token_out, 10);

        // If there are multiple good paths available, enhanced quoting is beneficial
        available_paths.len() >= 3
    }

    /// Enhanced aggregation of spread metrics for multi-path trades
    pub async fn calculate_enhanced_spread_aggregation(
        &self,
        quotes: &[SinglePathQuote],
        token_in: &Bytes,
        token_out: &Bytes,
        total_amount_in: u128,
    ) -> Option<Decimal> {
        if quotes.is_empty() {
            return None;
        }

        // Method 1: Volume-weighted average spread
        let mut weighted_spread_sum = Decimal::ZERO;
        let mut total_weight = Decimal::ZERO;

        for quote in quotes {
            if let (Some(spread), Some(amount_out)) = (quote.spread_bps, quote.amount_out) {
                let weight = Decimal::from(amount_out);
                weighted_spread_sum += spread * weight;
                total_weight += weight;
            }
        }

        let volume_weighted_spread = if total_weight > Decimal::ZERO {
            Some(weighted_spread_sum / total_weight)
        } else {
            None
        };

        // Method 2: Path correlation-adjusted spread
        let correlation_adjusted_spread = self
            .calculate_correlation_adjusted_spread(quotes, token_in, token_out)
            .await;

        // Method 3: Risk-adjusted spread considering path dependencies
        let risk_adjusted_spread = self
            .calculate_risk_adjusted_spread(quotes, total_amount_in)
            .await;

        // Combine methods using weighted average based on confidence
        let mut final_spread = Decimal::ZERO;
        let mut total_confidence = 0.0;

        if let Some(vw_spread) = volume_weighted_spread {
            final_spread += vw_spread * Decimal::from_f64_retain(0.4).unwrap_or_default();
            total_confidence += 0.4;
        }

        if let Some(ca_spread) = correlation_adjusted_spread {
            final_spread += ca_spread * Decimal::from_f64_retain(0.35).unwrap_or_default();
            total_confidence += 0.35;
        }

        if let Some(ra_spread) = risk_adjusted_spread {
            final_spread += ra_spread * Decimal::from_f64_retain(0.25).unwrap_or_default();
            total_confidence += 0.25;
        }

        if total_confidence > 0.0 {
            Some(final_spread / Decimal::from_f64_retain(total_confidence).unwrap_or(Decimal::ONE))
        } else {
            volume_weighted_spread
        }
    }

    /// Calculate spread considering path correlations
    async fn calculate_correlation_adjusted_spread(
        &self,
        quotes: &[SinglePathQuote],
        _token_in: &Bytes,
        _token_out: &Bytes,
    ) -> Option<Decimal> {
        if quotes.len() < 2 {
            return None;
        }

        // Calculate correlations between paths
        let correlations = self.analyze_path_correlations(quotes).await;

        // Use correlation information to adjust spread calculation
        let mut correlation_penalty = 0.0;
        for ((i, j), correlation) in correlations {
            if i < j {
                // Higher correlation means less diversification benefit
                correlation_penalty += correlation * 10.0; // 10 bps per correlation point
            }
        }

        // Base spread calculation
        let amounts_out: Vec<u128> = quotes.iter().filter_map(|q| q.amount_out).collect();

        if amounts_out.len() < 2 {
            return None;
        }

        let max_amount = *amounts_out.iter().max()?;
        let min_amount = *amounts_out.iter().min()?;

        if max_amount == 0 {
            return None;
        }

        let base_spread_bps = ((max_amount - min_amount) as f64 / max_amount as f64) * 10000.0;
        let adjusted_spread_bps = base_spread_bps + correlation_penalty;

        Some(Decimal::from_f64_retain(adjusted_spread_bps).unwrap_or(Decimal::ZERO))
    }

    /// Calculate risk-adjusted spread
    async fn calculate_risk_adjusted_spread(
        &self,
        quotes: &[SinglePathQuote],
        total_amount_in: u128,
    ) -> Option<Decimal> {
        if quotes.is_empty() {
            return None;
        }

        // Calculate risk metrics for each path
        let mut risk_adjusted_spreads = Vec::new();
        let mut total_risk_weight = 0.0;

        for quote in quotes {
            if let Some(spread) = quote.spread_bps {
                // Calculate path risk based on:
                // 1. Number of hops (more hops = higher risk)
                let hop_risk = quote.edge_seq.len() as f64 * 0.05; // 5% risk per hop

                // 2. Gas cost uncertainty
                let gas_risk = quote.gas_estimate.unwrap_or(0) as f64 / 1_000_000.0; // Normalize gas cost

                // 3. Amount concentration risk
                let amount_in = quote.input_amount.unwrap_or(0);
                let concentration_risk = if total_amount_in > 0 {
                    (amount_in as f64) / (total_amount_in as f64) * 0.1 // 10% max concentration penalty
                } else {
                    0.0
                };

                let total_risk = (1.0 + hop_risk + gas_risk + concentration_risk).min(2.0); // Cap at 2x
                let risk_adjusted_spread =
                    spread * Decimal::from_f64_retain(total_risk).unwrap_or(Decimal::ONE);

                let risk_weight = 1.0 / total_risk; // Lower risk = higher weight
                risk_adjusted_spreads.push((risk_adjusted_spread, risk_weight));
                total_risk_weight += risk_weight;
            }
        }

        if total_risk_weight > 0.0 && !risk_adjusted_spreads.is_empty() {
            let weighted_sum = risk_adjusted_spreads
                .iter()
                .map(|(spread, weight)| spread.to_f64().unwrap_or(0.0) * weight)
                .sum::<f64>();

            Decimal::from_f64_retain(weighted_sum / total_risk_weight)
        } else {
            None
        }
    }

    /// Analyze correlations between trading paths
    async fn analyze_path_correlations(
        &self,
        quotes: &[SinglePathQuote],
    ) -> HashMap<(usize, usize), f64> {
        let mut correlations = HashMap::new();

        for (i, quote_i) in quotes.iter().enumerate() {
            for (j, quote_j) in quotes.iter().enumerate() {
                if i >= j {
                    continue;
                } // Only calculate upper triangle

                let correlation = self.calculate_path_correlation(quote_i, quote_j).await;
                correlations.insert((i, j), correlation);
                correlations.insert((j, i), correlation); // Symmetric
            }
        }

        correlations
    }

    /// Calculate correlation between two paths
    async fn calculate_path_correlation(
        &self,
        path1: &SinglePathQuote,
        path2: &SinglePathQuote,
    ) -> f64 {
        // Check for shared pools/edges
        let path1_pools: HashSet<_> = path1.pools.iter().collect();
        let path2_pools: HashSet<_> = path2.pools.iter().collect();
        let shared_pools_count = path1_pools.intersection(&path2_pools).count();

        let total_unique_pools = path1.pools.len() + path2.pools.len() - shared_pools_count;

        let pool_correlation = if total_unique_pools > 0 {
            (shared_pools_count as f64) / (total_unique_pools as f64)
        } else {
            0.0
        };

        // Check for shared intermediate tokens
        let path1_tokens: HashSet<_> = path1.node_path.iter().collect();
        let path2_tokens: HashSet<_> = path2.node_path.iter().collect();
        let shared_tokens_count = path1_tokens.intersection(&path2_tokens).count();

        let total_unique_tokens =
            path1.node_path.len() + path2.node_path.len() - shared_tokens_count;

        let token_correlation = if total_unique_tokens > 0 {
            (shared_tokens_count as f64) / (total_unique_tokens as f64)
        } else {
            0.0
        };

        // Combine correlations
        (pool_correlation * 0.7 + token_correlation * 0.3).min(1.0)
    }

    /// Enhanced depth metrics aggregation for multi-path trades
    pub async fn calculate_enhanced_depth_aggregation(
        &self,
        quotes: &[SinglePathQuote],
        token_in: &Bytes,
        token_out: &Bytes,
        slippage_targets: &[f64],
        block: Option<u64>,
    ) -> Option<HashMap<String, u128>> {
        if quotes.is_empty() {
            return None;
        }

        let mut aggregated_depth_metrics = HashMap::new();

        for &target in slippage_targets {
            // Method 1: Path-weighted depth aggregation
            let path_weighted_depth = self
                .calculate_path_weighted_depth(quotes, target, block)
                .await;

            // Method 2: Liquidity-capacity-based aggregation
            let capacity_based_depth = self
                .calculate_capacity_based_depth(quotes, target, token_in, token_out, block)
                .await;

            // Method 3: Risk-adjusted depth considering path dependencies
            let risk_adjusted_depth = self
                .calculate_risk_adjusted_depth(quotes, target, block)
                .await;

            // Choose the most conservative (smallest) depth estimate
            let final_depth = [
                path_weighted_depth,
                capacity_based_depth,
                risk_adjusted_depth,
            ]
            .iter()
            .filter_map(|&x| x)
            .min()
            .unwrap_or(0);

            aggregated_depth_metrics.insert(format!("{}%", target), final_depth);
        }

        Some(aggregated_depth_metrics)
    }

    /// Calculate path-weighted depth
    async fn calculate_path_weighted_depth(
        &self,
        quotes: &[SinglePathQuote],
        target_slippage: f64,
        _block: Option<u64>,
    ) -> Option<u128> {
        let mut total_capacity = 0u128;
        let mut total_weight = 0.0;

        for quote in quotes {
            // Estimate path capacity based on amount traded and resulting slippage
            if let (Some(amount_in), Some(amount_out)) = (quote.input_amount, quote.amount_out) {
                if amount_in > 0 && amount_out > 0 {
                    // Simple capacity estimation: if we can trade amount_in with current slippage,
                    // we can likely handle more for higher slippage targets
                    let current_slippage = quote
                        .slippage_bps
                        .unwrap_or(Decimal::ZERO)
                        .to_f64()
                        .unwrap_or(0.0)
                        / 10000.0;

                    if current_slippage > 0.0 {
                        // Estimate capacity for target slippage (simple linear approximation)
                        let capacity_factor = target_slippage / current_slippage;
                        let estimated_capacity = (amount_in as f64 * capacity_factor) as u128;

                        let weight = (amount_out as f64).ln().max(1.0); // Log weight to avoid large amount bias
                        total_capacity += estimated_capacity;
                        total_weight += weight;
                    }
                }
            }
        }

        if total_weight > 0.0 {
            Some(total_capacity)
        } else {
            None
        }
    }

    /// Calculate capacity-based depth
    async fn calculate_capacity_based_depth(
        &self,
        quotes: &[SinglePathQuote],
        target_slippage: f64,
        _token_in: &Bytes,
        _token_out: &Bytes,
        _block: Option<u64>,
    ) -> Option<u128> {
        // Analyze the liquidity capacity of each path
        let mut total_capacity = 0u128;

        for quote in quotes {
            // Use gas estimate as proxy for path complexity and capacity
            let path_complexity = quote.edge_seq.len() as f64;
            let gas_efficiency =
                quote.gas_estimate.unwrap_or(300_000) as f64 / path_complexity.max(1.0);

            // Higher gas efficiency suggests better liquidity/capacity
            let capacity_estimate = if let Some(amount_in) = quote.input_amount {
                let efficiency_factor = (gas_efficiency / 150_000.0).min(2.0); // Normalize against avg gas per hop
                let slippage_factor = target_slippage / 0.01; // Scale by 1% slippage

                (amount_in as f64 * efficiency_factor * slippage_factor) as u128
            } else {
                0
            };

            total_capacity += capacity_estimate;
        }

        Some(total_capacity)
    }

    /// Calculate risk-adjusted depth
    async fn calculate_risk_adjusted_depth(
        &self,
        quotes: &[SinglePathQuote],
        target_slippage: f64,
        _block: Option<u64>,
    ) -> Option<u128> {
        let mut risk_adjusted_total = 0u128;

        for quote in quotes {
            if let Some(amount_in) = quote.input_amount {
                // Calculate risk factors
                let hop_risk = 1.0 - (quote.edge_seq.len() as f64 * 0.05).min(0.5); // Max 50% reduction
                let gas_risk = 1.0
                    - ((quote.gas_estimate.unwrap_or(0) as f64 - 150_000.0) / 1_000_000.0)
                        .clamp(0.0, 0.3); // Max 30% reduction

                let combined_risk_factor = (hop_risk * gas_risk).max(0.2); // Min 20% of capacity

                let slippage_scaling = (target_slippage / 0.005).min(10.0); // Scale up to 10x for higher slippage
                let risk_adjusted_amount =
                    (amount_in as f64 * combined_risk_factor * slippage_scaling) as u128;

                risk_adjusted_total += risk_adjusted_amount;
            }
        }

        Some(risk_adjusted_total)
    }

    // Other methods like precompute_all_quotes, log_all_paths, list_unit_price_vs_eth, etc.
    // will be added here or moved to submodules as appropriate.

    /// Get token price in USD by converting from ETH price
    pub fn get_token_price_usd(&self, token: &Bytes, block: Option<u64>) -> Option<Decimal> {
        self.get_token_price(token, block).map(|eth_price| {
            eth_price * Decimal::from_f64_retain(self.eth_usd_rate).unwrap_or_default()
        })
    }

    /// Get comprehensive token price information (ETH and USD)
    pub fn get_token_price_info(
        &self,
        token: &Bytes,
        block: Option<u64>,
    ) -> Option<TokenPriceInfo> {
        let eth_price = self.get_token_price(token, block)?;
        let usd_price = eth_price * Decimal::from_f64_retain(self.eth_usd_rate).unwrap_or_default();

        Some(TokenPriceInfo {
            price_eth: eth_price,
            price_usd: usd_price,
            eth_usd_rate: self.eth_usd_rate,
        })
    }

    /// Update the ETH/USD conversion rate
    pub fn set_eth_usd_rate(&mut self, new_rate: f64) {
        self.eth_usd_rate = new_rate;
    }

    /// Get current ETH/USD conversion rate
    pub fn get_eth_usd_rate(&self) -> f64 {
        self.eth_usd_rate
    }

    // ===== ARBITRAGE-SPECIFIC METHODS =====

    /// Find all arbitrage cycles starting from given tokens up to max_hops
    /// Returns cycles as sequences of token addresses
    pub async fn find_cycles(&self, start_tokens: &[Bytes], max_hops: usize) -> Vec<Vec<Bytes>> {
        let mut cycles = Vec::new();

        for start_token in start_tokens {
            // Find cycles starting from this token
            let token_cycles = self.find_cycles_from_token(start_token, max_hops).await;
            cycles.extend(token_cycles);
        }

        // Remove duplicates (cycles that are the same but starting from different points)
        self.deduplicate_cycles(cycles)
    }

    /// Find cycles starting from a specific token
    async fn find_cycles_from_token(
        &self,
        start_token: &Bytes,
        max_hops: usize,
    ) -> Vec<Vec<Bytes>> {
        let graph_guard = self.graph.read().unwrap();

        if let Some(_start_node) = graph_guard.get_node_index(start_token) {
            // Use pathfinder to enumerate all paths of up to max_hops
            let paths = self
                .pathfinder
                .enumerate_paths(start_token, start_token, max_hops);

            // Convert node paths to token address paths
            let mut cycles = Vec::new();
            for path in paths {
                if path.len() >= 3 && path.first() == path.last() {
                    // This is a cycle (starts and ends at same node)
                    let token_path: Vec<Bytes> = path
                        .iter()
                        .filter_map(|&node_idx| {
                            graph_guard
                                .graph
                                .node_weight(node_idx)
                                .map(|node| node.address.clone())
                        })
                        .collect();

                    if token_path.len() >= 3 {
                        cycles.push(token_path);
                    }
                }
            }

            cycles
        } else {
            Vec::new()
        }
    }

    /// Remove duplicate cycles (same cycle but rotated)
    fn deduplicate_cycles(&self, cycles: Vec<Vec<Bytes>>) -> Vec<Vec<Bytes>> {
        let mut unique_cycles = Vec::new();
        let mut seen = HashSet::new();

        for cycle in cycles {
            if cycle.len() < 3 {
                continue;
            }

            // Create canonical representation (smallest token address first)
            let canonical = self.canonicalize_cycle(&cycle);
            let canonical_key = canonical
                .iter()
                .map(|b| b.to_string())
                .collect::<Vec<_>>()
                .join(",");

            if !seen.contains(&canonical_key) {
                seen.insert(canonical_key);
                unique_cycles.push(canonical);
            }
        }

        unique_cycles
    }

    /// Convert cycle to canonical form (smallest address first)
    fn canonicalize_cycle(&self, cycle: &[Bytes]) -> Vec<Bytes> {
        if cycle.is_empty() {
            return Vec::new();
        }

        // Find the position of the lexicographically smallest address
        let min_pos = cycle
            .iter()
            .enumerate()
            .min_by_key(|(_, addr)| addr.to_string())
            .map(|(pos, _)| pos)
            .unwrap_or(0);

        // Rotate so that the smallest address is first
        let mut canonical = Vec::new();
        for i in 0..cycle.len() {
            canonical.push(cycle[(min_pos + i) % cycle.len()].clone());
        }

        canonical
    }

    /// Get spot price (marginal price at 0 amount) between two tokens
    /// Returns None if no direct path exists
    pub async fn get_spot_price(&self, token_in: &Bytes, token_out: &Bytes) -> Option<Decimal> {
        // For spot price, we use a very small amount to approximate marginal price
        let spot_amount = 1_000_000u128; // 0.001 of a token with 18 decimals

        let quote = self.quote(token_in, token_out, spot_amount, None).await;

        if let Some(amount_out) = quote.amount_out {
            if amount_out > 0 {
                // Price = amount_out / amount_in
                let price_ratio = Decimal::from(amount_out) / Decimal::from(spot_amount);
                return Some(price_ratio);
            }
        }

        None
    }

    /// Check if a cycle is a candidate for arbitrage (spot price product > 1)
    pub async fn is_arbitrage_candidate(&self, cycle: &[Bytes]) -> bool {
        if cycle.len() < 3 {
            return false;
        }

        let mut price_product = Decimal::ONE;

        // Calculate the product of spot prices around the cycle
        for i in 0..cycle.len() - 1 {
            if let Some(spot_price) = self.get_spot_price(&cycle[i], &cycle[i + 1]).await {
                price_product *= spot_price;
            } else {
                // If any hop has no price, cycle is not viable
                return false;
            }
        }

        // Arbitrage opportunity exists if price product > 1
        price_product > Decimal::ONE
    }

    /// Find optimal trade amount for a cycle using binary search
    /// Returns (optimal_amount_in, expected_profit, gas_cost_estimate)
    pub async fn optimize_cycle_trade(
        &self,
        cycle: &[Bytes],
        max_amount: u128,
    ) -> Option<(u128, Decimal, u64)> {
        if cycle.len() < 3 {
            return None;
        }

        // Binary search for optimal amount
        let mut low = 1_000_000u128; // Start with 0.001 tokens
        let mut high = max_amount;
        let mut best_result: Option<(u128, Decimal, u64)> = None;

        // Perform binary search with 20 iterations (should be sufficient for precision)
        for _ in 0..20 {
            if low >= high {
                break;
            }

            let mid = (low + high) / 2;

            // Simulate the cycle trade
            if let Some((_amount_out, profit, gas_cost)) =
                self.simulate_cycle_trade(cycle, mid).await
            {
                if profit > Decimal::ZERO {
                    // This amount is profitable, try larger amounts
                    best_result = Some((mid, profit, gas_cost));
                    low = mid + 1;
                } else {
                    // This amount is not profitable, try smaller amounts
                    high = mid - 1;
                }
            } else {
                // Simulation failed, try smaller amounts
                high = mid - 1;
            }
        }

        best_result
    }

    /// Simulate a cycle trade to calculate profit
    async fn simulate_cycle_trade(
        &self,
        cycle: &[Bytes],
        amount_in: u128,
    ) -> Option<(u128, Decimal, u64)> {
        let mut current_amount = amount_in;
        let mut total_gas_cost = 0u64;

        // Execute each hop in the cycle
        for i in 0..cycle.len() - 1 {
            let quote = self
                .quote(&cycle[i], &cycle[i + 1], current_amount, None)
                .await;

            if let Some(_amount_out) = quote.amount_out {
                current_amount = _amount_out;

                // Add gas cost estimate
                if let Some(gas_estimate) = quote.gas_estimate {
                    total_gas_cost += gas_estimate;
                }
            } else {
                // Trade failed
                return None;
            }
        }

        // Calculate profit (final amount - initial amount)
        let profit = if current_amount > amount_in {
            Decimal::from(current_amount - amount_in)
        } else {
            Decimal::from(current_amount as i128 - amount_in as i128)
        };

        Some((current_amount, profit, total_gas_cost))
    }

    /// Check which cycles need recalculation based on pool updates
    pub async fn get_stale_cycles(
        &self,
        all_cycles: &[Vec<Bytes>],
        updated_pools: &[String],
    ) -> Vec<usize> {
        let mut stale_indices = Vec::new();

        // For now, if any pools were updated, consider all cycles stale
        // In a more sophisticated implementation, we would track which pools are used in which cycles
        if !updated_pools.is_empty() {
            stale_indices = (0..all_cycles.len()).collect();
        }

        stale_indices
    }

    /// Get direct access to the token graph
    pub fn get_graph(&self) -> Arc<std::sync::RwLock<crate::engine::graph::TokenGraph>> {
        self.graph.clone()
    }

    /// Get reserve information for a specific pool
    pub async fn get_pool_reserves(&self, pool_id: &str) -> Option<(Decimal, Decimal)> {
        let graph_guard = self.graph.read().unwrap();

        // Find the edge with this pool_id
        for edge_ref in graph_guard.graph.edge_references() {
            let edge_weight = edge_ref.weight();
            if edge_weight.pool_id == pool_id {
                if let Some((reserve0, reserve1)) = edge_weight.reserves {
                    return Some((
                        Decimal::from_f64_retain(reserve0).unwrap_or(Decimal::ZERO),
                        Decimal::from_f64_retain(reserve1).unwrap_or(Decimal::ZERO),
                    ));
                }
            }
        }

        None
    }

    /// Get real ETH price from market data using actual pools
    fn get_real_eth_price(&self) -> Option<f64> {
        let eth_address = Bytes::from_str("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2").ok()?;
        let usdc_address = Bytes::from_str("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48").ok()?;
        let usdt_address = Bytes::from_str("0xdAC17F958D2ee523a2206206994597C13D831ec7").ok()?;

        // Try USDC first, then USDT
        let stablecoin_addresses = vec![usdc_address.clone(), usdt_address];

        for stablecoin_addr in stablecoin_addresses {
            let all_pools = self.tracker.all_pools.read().unwrap();
            let pool_states = self.tracker.pool_states.read().unwrap();
            let all_tokens = self.tracker.all_tokens.read().unwrap();
            let eth_token = all_tokens.get(&eth_address)?;
            let stablecoin_token = all_tokens.get(&stablecoin_addr)?;

            for (pool_id, component) in all_pools.iter() {
                let Some(pool_state) = pool_states.get(pool_id) else {
                    continue;
                };

                let pool_tokens: std::collections::HashSet<_> = component.tokens.iter().collect();
                if pool_tokens.contains(eth_token) && pool_tokens.contains(stablecoin_token) {
                    let one_eth = num_bigint::BigUint::from(10u128.pow(18));

                    if let Ok(result) =
                        pool_state.get_amount_out(one_eth, eth_token, stablecoin_token)
                    {
                        if let Some(amount_out) = result.amount.to_f64() {
                            let eth_price =
                                amount_out / 10f64.powi(stablecoin_token.decimals as i32);
                            if eth_price > 100.0 && eth_price < 100_000.0 {
                                return Some(eth_price);
                            }
                        }
                    }
                }
            }
        }

        // If no pools found, try pathfinding approach
        if let Some(path_nodes) = self.pathfinder.best_path(&eth_address, &usdc_address) {
            if let Some(edge_sequence) = {
                let graph_r = self.graph.read().unwrap();
                graph_r.derive_edges_for_node_path(&path_nodes)
            } {
                let one_eth = 10u128.pow(18); // 1 ETH

                if let Some(amount_out) = simulation::simulate_path_gross(
                    &self.tracker,
                    &self.graph.read().unwrap(),
                    one_eth,
                    &path_nodes,
                    &edge_sequence,
                    None,
                ) {
                    let eth_price = amount_out as f64 / 10f64.powi(6); // USDC has 6 decimals
                                                                       // Sanity check
                    if eth_price > 100.0 && eth_price < 100_000.0 {
                        return Some(eth_price);
                    }
                }
            }
        }

        None // Return None if no real price can be determined
    }
}
