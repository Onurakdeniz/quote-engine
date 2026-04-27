//! Token/pool graph model, edge/node management, graph updates.

use indexmap::IndexMap;
use log;
use num_bigint::BigUint;
use num_traits::ToPrimitive;
use petgraph::prelude::EdgeIndex;
use petgraph::prelude::NodeIndex;
use petgraph::stable_graph::StableDiGraph;
use petgraph::visit::{EdgeRef, IntoEdgeReferences, NodeIndexable};
use rustc_hash::FxHashMap;
use std::collections::HashMap;
use std::str::FromStr;
use tycho_simulation::protocol::models::ProtocolComponent;
use tycho_simulation::tycho_common::{
    models::token::Token, simulation::protocol_sim::ProtocolSim, Bytes,
};

/// Represents a token node in the graph.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TokenNode {
    pub address: Bytes,
    pub symbol: String,
    pub decimals: u8,
}

/// Represents a pool edge in the graph.
#[derive(Debug, Clone)]
pub struct PoolEdge {
    pub pool_id: String,
    pub protocol: String,
    pub fee: Option<f64>,
    pub weight: Option<f64>,          // -ln(spot_price)
    pub reserves: Option<(f64, f64)>, // (reserve0, reserve1) if available
}

/// The main token/pool graph structure.
pub struct TokenGraph {
    pub graph: StableDiGraph<TokenNode, PoolEdge>,
    pub token_indices: IndexMap<Bytes, NodeIndex>,
    pub pool_ids: std::collections::HashSet<String>, // Track pool IDs currently in the graph
}

impl TokenGraph {
    /// Create an empty graph.
    pub fn new() -> Self {
        Self {
            graph: StableDiGraph::new(),
            token_indices: IndexMap::new(),
            pool_ids: std::collections::HashSet::new(),
        }
    }

    /// Derives a sequence of edge indices for a given node path.
    /// For each pair of nodes (u, v) in the path, it selects the "best" available edge.
    /// "Best" is currently defined as:
    /// 1. An edge with a defined Some(weight).
    /// 2. Among those, one with the lowest non-negative weight.
    /// 3. If no weights or all negative, or no edges, it might fail for that segment.
    ///
    /// Returns None if any segment of the path has no suitable edge.
    pub fn derive_edges_for_node_path(&self, node_path: &[NodeIndex]) -> Option<Vec<EdgeIndex>> {
        if node_path.len() < 2 {
            return Some(Vec::new()); // No edges for a path shorter than 2 nodes
        }

        let mut edge_indices = Vec::with_capacity(node_path.len() - 1);

        for i in 0..(node_path.len() - 1) {
            let u = node_path[i];
            let v = node_path[i + 1];

            let connecting_edges: Vec<_> = self.graph.edges_connecting(u, v).collect();

            if connecting_edges.is_empty() {
                return None; // No edge found for this segment
            }

            // Select the "best" edge.
            // Prioritize edges with Some(weight), then lowest non-negative weight.
            let best_edge = connecting_edges
                .iter()
                .filter_map(|edge_ref| {
                    let edge_weight = edge_ref.weight();

                    // Calculate edge score based on liquidity and fees
                    let liquidity_score =
                        if let Some((reserve_in, reserve_out)) = edge_weight.reserves {
                            let min_reserve = reserve_in.min(reserve_out);
                            min_reserve / 1_000_000.0 // Normalize to millions
                        } else {
                            0.0
                        };

                    let fee_penalty = if let Some(fee) = edge_weight.fee {
                        fee * 1000.0 // Convert to penalty (higher fee = higher penalty)
                    } else {
                        100.0 // High penalty for unknown fees
                    };

                    let edge_score = liquidity_score - fee_penalty;

                    // Only consider edges with reasonable liquidity and fees
                    if liquidity_score >= 0.1 && fee_penalty <= 10.0 {
                        // Min 100k ETH liquidity, max 1% fee
                        Some((edge_ref.id(), edge_score))
                    } else {
                        None
                    }
                })
                .max_by(|(_, score1), (_, score2)| {
                    score1
                        .partial_cmp(score2)
                        .unwrap_or(std::cmp::Ordering::Equal)
                });

            if let Some((edge_id, score)) = best_edge {
                edge_indices.push(edge_id);
                println!(
                    "🔧 DEBUG: Selected edge with score {:.2} for segment {} -> {}",
                    score,
                    u.index(),
                    v.index()
                );
            } else {
                // If no edges meet our criteria, fallback to the first edge
                if let Some(first_edge) = connecting_edges.first() {
                    edge_indices.push(first_edge.id());
                    println!("🔧 DEBUG: Fallback to first edge for segment {} -> {} (no edges met criteria)", u.index(), v.index());
                } else {
                    return None; // Should be caught by connecting_edges.is_empty() already
                }
            }
        }
        Some(edge_indices)
    }

    /// Helper to compute slippage-adjusted effective price for a small trade
    fn compute_log_slippage_weight(
        pool_state: &(dyn ProtocolSim + Send + Sync),
        token_in: &Token,
        token_out: &Token,
        fee: f64,
    ) -> Option<f64> {
        // Use a small fraction of reserves as the trade size, e.g., 0.01%
        // If reserves are not available, fallback to None
        // We\'ll use 0.0001 (0.01%) of input token\'s one() as the trade size
        let decimals = token_in.decimals;
        let one = BigUint::from(10u64).pow(decimals);
        let trade_size = &one / BigUint::from(1_000_000u64); // 0.0001% of one token
                                                             // Simulate get_amount_out for this small trade
        match pool_state.get_amount_out(trade_size.clone(), token_in, token_out) {
            Ok(result) => {
                let amount_out = result.amount;
                if amount_out > BigUint::from(0u8) {
                    // Effective price = amount_out / trade_size (output per input)
                    let effective_price =
                        amount_out.to_f64().unwrap_or(0.0) / trade_size.to_f64().unwrap_or(1.0);
                    if effective_price > 0.0 {
                        // Apply fee (if not already included)
                        let effective_price_with_fee = effective_price * (1.0 - fee);
                        if effective_price_with_fee > 0.0 {
                            return Some(-effective_price_with_fee.ln().abs());
                        }
                    }
                }
                None
            }
            Err(_) => None,
        }
    }

    /// Add or update tokens and pools from the latest state, using tracker for price/fee info.
    pub fn update_from_components_with_tracker(
        &mut self,
        pools: &FxHashMap<String, ProtocolComponent>,
        pool_states: &FxHashMap<String, Box<dyn ProtocolSim + Send + Sync>>,
        all_tokens: &FxHashMap<Bytes, Token>,
    ) {
        log::info!("🔄 STARTING GRAPH UPDATE...");
        log::info!("   - Input pools: {}", pools.len());
        log::info!("   - Input pool states: {}", pool_states.len());
        log::info!("   - Input tokens: {}", all_tokens.len());
        log::info!(
            "   - Current graph: {} nodes, {} edges",
            self.graph.node_count(),
            self.graph.edge_count()
        );

        let new_pool_ids: std::collections::HashSet<String> = pools.keys().cloned().collect();

        // 1. Remove nodes/edges associated with pools that are no longer present
        let pools_to_remove = self
            .pool_ids
            .difference(&new_pool_ids)
            .cloned()
            .collect::<Vec<_>>();
        if !pools_to_remove.is_empty() {
            log::info!("🗑️  Removing {} pools from graph", pools_to_remove.len());
        }
        for removed_pool_id in pools_to_remove {
            // Find edges associated with this pool and remove them
            let edges_to_remove: Vec<_> = self
                .graph
                .edge_indices()
                .filter(|&e| {
                    self.graph
                        .edge_weight(e)
                        .is_some_and(|ew| ew.pool_id == removed_pool_id)
                })
                .collect();
            for edge_index in edges_to_remove.into_iter().rev() {
                self.graph.remove_edge(edge_index);
            }
        }
        // Prune orphan nodes (no in-edges or out-edges)
        let orphan_nodes: Vec<_> = self
            .graph
            .node_indices()
            .filter(|&idx| self.graph.edges(idx).count() == 0)
            .collect();
        if !orphan_nodes.is_empty() {
            log::info!("🧹 Removing {} orphan nodes", orphan_nodes.len());
        }
        for idx in orphan_nodes.into_iter().rev() {
            let node = self.graph.node_weight(idx).cloned();
            self.graph.remove_node(idx);
            if let Some(node) = node {
                self.token_indices.shift_remove(&node.address);
            }
        }

        log::info!("🏗️  ADDING TOKENS AS NODES...");
        let nodes_before = self.graph.node_count();

        // Add new tokens as nodes
        for (pool_id, pool) in pools.iter() {
            log::debug!("Processing pool {} for token nodes", pool_id);
            for token in pool.tokens.iter() {
                let addr = token.address.clone();
                if !self.token_indices.contains_key(&addr) {
                    let node = TokenNode {
                        address: addr.clone(),
                        symbol: token.symbol.clone(),
                        decimals: token.decimals as u8,
                    };
                    let idx = self.graph.add_node(node);
                    self.token_indices.insert(addr.clone(), idx);
                    log::debug!(
                        "Added token node: {} ({}) from pool {}",
                        token.symbol,
                        addr,
                        pool_id
                    );
                } else {
                    log::debug!(
                        "Token already exists: {} ({}) from pool {}",
                        token.symbol,
                        addr,
                        pool_id
                    );
                }
            }
        }

        let nodes_after = self.graph.node_count();
        log::info!(
            "📈 Token nodes: {} -> {} (net: +{})",
            nodes_before,
            nodes_after,
            nodes_after - nodes_before
        );

        // Check for our target tokens specifically
        let weth_addr = Bytes::from_str("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2").ok();
        let usdt_addr = Bytes::from_str("0xdac17f958d2ee523a2206206994597c13d831ec7").ok();

        if let Some(ref weth) = weth_addr {
            if self.token_indices.contains_key(weth) {
                log::info!("✅ WETH token found in graph");
            } else {
                log::warn!("❌ WETH token NOT found in graph");
            }
        }

        if let Some(ref usdt) = usdt_addr {
            if self.token_indices.contains_key(usdt) {
                log::info!("✅ USDT token found in graph");
            } else {
                log::warn!("❌ USDT token NOT found in graph");
            }
        }

        log::info!("🔗 CREATING POOL EDGES...");
        // Incrementally update directed edges for each pool (A->B, B->A for 2-token pools)
        let mut skipped_pools = 0;
        let mut processed_pools = 0;
        let mut added_edges = 0;
        let mut pools_without_state = 0;

        for (pool_id, pool) in pools.iter() {
            log::debug!("🔍 Processing pool: {}", pool_id);
            log::debug!("   - Protocol: {}", pool.protocol_system);
            log::debug!("   - Token count: {}", pool.tokens.len());

            // !!! TEMPORARY WORKAROUND: Skip problematic pool causing panic in tycho-simulation !!!
            if pool_id == "0x898adc9aa0c23dce3fed6456c34dbe2b57784325" {
                log::warn!(
                    "Skipping problematic pool due to tycho-simulation panic: {}",
                    pool_id
                );
                skipped_pools += 1;
                continue;
            }
            // !!! END TEMPORARY WORKAROUND !!!

            let tokens = &pool.tokens;
            if tokens.len() < 2 {
                log::debug!(
                    "Skipping pool {} - not enough tokens: {}",
                    pool_id,
                    tokens.len()
                );
                skipped_pools += 1;
                continue;
            }

            // Check if we have pool state - if not, we'll create edges with basic info
            let pool_state = pool_states.get(pool_id);
            if pool_state.is_none() {
                log::debug!(
                    "No pool state found for pool: {} - will create basic edges",
                    pool_id
                );
                pools_without_state += 1;
            } else {
                log::debug!("Pool state found for pool: {}", pool_id);
            }

            processed_pools += 1;

            // Determine the fee for the edge - use default if no state available
            let mut fee_to_use_for_edge = if let Some(ps) = pool_state {
                match ps.fee() {
                    f if f > 0.0 => Some(f),
                    _ => Some(0.0025), // Default to 0.25% if pool_state.fee() is zero or negative
                }
            } else {
                // No state available - use protocol-specific defaults
                match pool.protocol_system.as_str() {
                    "uniswap_v2" => Some(0.003),  // 0.3% for Uniswap V2
                    "uniswap_v3" => Some(0.0005), // 0.05% default for Uniswap V3 (low fee tier)
                    _ => Some(0.0025),            // 0.25% default
                }
            };

            // !!! TEMPORARY TEST OVERRIDE FOR POOL 0xe0554a476a092703abdb3ef35c80e0d76d32939f !!!
            if pool_id == "0xe0554a476a092703abdb3ef35c80e0d76d32939f" {
                log::warn!(
                    "TEMPORARY OVERRIDE: Forcing fee for pool {} to 0.25% (0.0025)",
                    pool_id
                );
                fee_to_use_for_edge = Some(0.0025);
            }
            // !!! END TEMPORARY TEST OVERRIDE !!!

            log::debug!("   - Fee: {:?}", fee_to_use_for_edge);

            let mut edges_created_for_pool = 0;

            for i in 0..tokens.len() {
                for j in 0..tokens.len() {
                    if i == j {
                        continue;
                    }
                    let from_addr = &tokens[i].address;
                    let to_addr = &tokens[j].address;

                    log::debug!(
                        "   - Trying edge: {} ({}) -> {} ({})",
                        tokens[i].symbol,
                        from_addr,
                        tokens[j].symbol,
                        to_addr
                    );

                    let (from_idx, to_idx) = match (
                        self.token_indices.get(from_addr),
                        self.token_indices.get(to_addr),
                    ) {
                        (Some(&f), Some(&t)) => {
                            log::debug!(
                                "     ✅ Found node indices: {} -> {}",
                                f.index(),
                                t.index()
                            );
                            (f, t)
                        }
                        _ => {
                            log::debug!(
                                "     ❌ Token indices not found for edge from {} to {} in pool {}",
                                from_addr,
                                to_addr,
                                pool_id
                            );
                            continue;
                        }
                    };

                    // Build / update edge weight metadata - make it more permissive
                    let build_edge =
                        |fee_decimal_opt: Option<f64>| -> (Option<f64>, Option<(f64, f64)>) {
                            let mut weight = None;
                            let mut reserves = None;

                            // Only try advanced weight calculation if we have state and tokens
                            if let (Some(pool_state), Some(tok_in), Some(tok_out)) = (
                                pool_state,
                                all_tokens.get(from_addr),
                                all_tokens.get(to_addr),
                            ) {
                                if let Some(f_decimal) = fee_decimal_opt {
                                    weight = Self::compute_log_slippage_weight(
                                        pool_state.as_ref(),
                                        tok_in,
                                        tok_out,
                                        f_decimal,
                                    );
                                }
                                if weight.is_none() {
                                    if let Ok(spot) = pool_state.spot_price(tok_in, tok_out) {
                                        if spot > 0.0 {
                                            let eff =
                                                spot * (1.0 - fee_decimal_opt.unwrap_or(0.0025));
                                            if eff > 0.0 {
                                                weight = Some((-eff.ln()).abs());
                                            }
                                        }
                                    }
                                }
                                if let Ok((max_in, max_out)) = pool_state
                                    .get_limits(tok_in.address.clone(), tok_out.address.clone())
                                {
                                    reserves = Some((
                                        max_in.to_f64().unwrap_or(0.0),
                                        max_out.to_f64().unwrap_or(0.0),
                                    ));
                                }
                            } else {
                                // No state or token info - create a basic edge with default weight
                                log::debug!("Creating basic edge for pool {} from {} to {} (no state/token info)", pool_id, from_addr, to_addr);
                                weight = Some(1.0); // Basic weight for pathfinding
                            }
                            (weight, reserves)
                        };

                    let (weight, reserves) = build_edge(fee_to_use_for_edge);
                    log::debug!(
                        "     - Computed weight: {:?}, reserves: {:?}",
                        weight,
                        reserves
                    );

                    // Check if an edge for this pool already exists
                    let existing_edge_idx = self
                        .graph
                        .edges_connecting(from_idx, to_idx)
                        .find(|edge| edge.weight().pool_id.as_str() == pool_id.as_str())
                        .map(|e| e.id());

                    match existing_edge_idx {
                        Some(eidx) => {
                            // Update existing edge
                            if let Some(edge_mut) = self.graph.edge_weight_mut(eidx) {
                                edge_mut.protocol = pool.protocol_system.clone();
                                edge_mut.fee = fee_to_use_for_edge;
                                edge_mut.weight = weight;
                                edge_mut.reserves = reserves;
                                log::debug!("     ✅ Updated existing edge");
                            }
                        }
                        None => {
                            // Add new edge
                            let new_edge = PoolEdge {
                                pool_id: pool_id.clone(),
                                protocol: pool.protocol_system.clone(),
                                fee: fee_to_use_for_edge,
                                weight,
                                reserves,
                            };
                            self.graph.add_edge(from_idx, to_idx, new_edge);
                            added_edges += 1;
                            edges_created_for_pool += 1;
                            log::debug!("     ✅ Added new edge (weight: {:?})", weight);
                        }
                    }
                }
            }

            log::debug!(
                "   - Created {} edges for pool {}",
                edges_created_for_pool,
                pool_id
            );
        }

        log::info!("🎯 GRAPH UPDATE SUMMARY:");
        log::info!(
            "   - Pools processed: {}, skipped: {}, without state: {}",
            processed_pools,
            skipped_pools,
            pools_without_state
        );
        log::info!("   - Edges added: {}", added_edges);
        log::info!(
            "   - Final graph: {} nodes, {} edges",
            self.graph.node_count(),
            self.graph.edge_count()
        );

        self.pool_ids = new_pool_ids;
    }

    /// Backward-compatible: update from components without tracker (no weights/fees)
    pub fn update_from_components(&mut self, pools: &HashMap<String, ProtocolComponent>) {
        let pools: FxHashMap<_, _> = pools
            .iter()
            .map(|(id, pool)| (id.clone(), pool.clone()))
            .collect();
        let pool_states = FxHashMap::default();
        let all_tokens = FxHashMap::default();
        self.update_from_components_with_tracker(&pools, &pool_states, &all_tokens);
    }

    /// Remove a pool and its associated edges from the graph.
    pub fn remove_pool(&mut self, pool_id: &str) {
        let edges_to_remove: Vec<_> = self
            .graph
            .edge_indices()
            .filter(|&e| {
                self.graph
                    .edge_weight(e)
                    .is_some_and(|ew| ew.pool_id == pool_id)
            })
            .collect();
        for edge_index in edges_to_remove.into_iter().rev() {
            self.graph.remove_edge(edge_index);
        }
        self.pool_ids.remove(pool_id);
        // Optionally prune orphan nodes
        let orphan_nodes: Vec<_> = self
            .graph
            .node_indices()
            .filter(|&idx| self.graph.edges(idx).count() == 0)
            .collect();
        for idx in orphan_nodes.into_iter().rev() {
            let node = self.graph.node_weight(idx).cloned();
            self.graph.remove_node(idx);
            if let Some(node) = node {
                self.token_indices.shift_remove(&node.address);
            }
        }
    }

    /// Remove a token node and all its edges from the graph.
    pub fn remove_token(&mut self, token_address: &Bytes) {
        if let Some(&idx) = self.token_indices.get(token_address) {
            self.graph.remove_node(idx);
            self.token_indices.shift_remove(token_address);
        }
    }

    /// Update the weight of an edge between two tokens for a given pool.
    pub fn update_edge_weight(&mut self, from: &Bytes, to: &Bytes, pool_id: &str, new_weight: f64) {
        if let (Some(&from_idx), Some(&to_idx)) =
            (self.token_indices.get(from), self.token_indices.get(to))
        {
            // First, collect the edge indices to update
            let edge_indices: Vec<_> = self
                .graph
                .edges_connecting(from_idx, to_idx)
                .filter(|edge| edge.weight().pool_id == pool_id)
                .map(|edge| edge.id())
                .collect();
            // Now, mutate the edges
            for edge_idx in edge_indices {
                if let Some(edge_w) = self.graph.edge_weight_mut(edge_idx) {
                    edge_w.weight = Some(new_weight);
                }
            }
        }
    }

    /// Get a node index by its token address
    pub fn get_node_index(&self, token_address: &Bytes) -> Option<NodeIndex> {
        self.token_indices.get(token_address).copied()
    }

    /// Get all token addresses in the graph
    pub fn get_all_token_addresses(&self) -> Vec<Bytes> {
        self.token_indices.keys().cloned().collect()
    }

    pub fn get_edge_count(&self) -> usize {
        self.graph.edge_count()
    }

    pub fn get_node_count(&self) -> usize {
        self.graph.node_count()
    }

    pub fn to_csr(&self) -> csr::CsrGraph {
        let node_count = self.graph.node_count();
        let mut indptr = vec![0; node_count + 1];
        let mut indices = Vec::new();
        let mut weights = Vec::new();

        // Build adjacency list representation first to sort neighbors by index
        let mut adj: Vec<Vec<(u32, f32)>> = vec![Vec::new(); node_count];

        for edge_ref in self.graph.edge_references() {
            let source_idx = self.graph.to_index(edge_ref.source());
            let target_idx = self.graph.to_index(edge_ref.target());
            // Use a default weight if None, or skip if that's preferred
            let weight = edge_ref.weight().weight.unwrap_or(f64::INFINITY) as f32;
            adj[source_idx].push((target_idx as u32, weight));
        }

        // Sort neighbors and fill CSR arrays
        for i in 0..node_count {
            adj[i].sort_by_key(|&(neighbor_idx, _)| neighbor_idx);
            indptr[i + 1] = indptr[i] + adj[i].len();
            for (neighbor_idx, weight) in &adj[i] {
                indices.push(*neighbor_idx);
                weights.push(*weight);
            }
        }

        csr::CsrGraph {
            indptr,
            indices,
            weights,
        }
    }
}

impl Default for TokenGraph {
    fn default() -> Self {
        Self::new()
    }
}

pub mod csr {
    // Compressed Sparse Row (CSR) graph representation for efficient pathfinding.
    // This is suitable for libraries like `pathfinding::directed::dijkstra::dijkstra_all`
    // which expect a graph where nodes are `usize` and edges are `(usize, Weight)`.

    #[derive(Clone)]
    pub struct CsrGraph {
        pub indptr: Vec<usize>,
        pub indices: Vec<u32>, // Node indices
        pub weights: Vec<f32>, // Edge weights
    }
}
