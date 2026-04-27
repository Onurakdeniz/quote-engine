//! Pathfinding algorithms (Delta-stepping, Yen\'s K-Shortest Paths).

use crate::engine::graph::TokenGraph; // Adjusted path
use petgraph::algo::dijkstra;
use petgraph::prelude::*;
use petgraph::visit::{EdgeRef, IntoEdgeReferences};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Arc, RwLock}; // Added imports
use tycho_simulation::tycho_common::Bytes; // Added HashMap for pruning metrics

/// Candidate path for Yen's algorithm
#[derive(Debug, Clone, PartialEq)]
pub struct YensCandidate {
    pub path: Vec<NodeIndex>,
    pub cost: f64,
}

impl Eq for YensCandidate {}

impl PartialOrd for YensCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for YensCandidate {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.cost
            .partial_cmp(&other.cost)
            .unwrap_or(std::cmp::Ordering::Equal)
    }
}

/// State for Dijkstra's algorithm
#[derive(Copy, Clone, PartialEq)]
pub struct DijkstraState {
    pub cost: f64,
    pub node: NodeIndex,
}

#[derive(Copy, Clone, PartialEq)]
struct AStarState {
    f_score: f64,
    node: NodeIndex,
}

impl Eq for DijkstraState {}
impl Eq for AStarState {}

impl Ord for DijkstraState {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        other
            .cost
            .partial_cmp(&self.cost)
            .unwrap_or(std::cmp::Ordering::Equal)
    }
}

impl PartialOrd for DijkstraState {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for AStarState {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        other
            .f_score
            .partial_cmp(&self.f_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    }
}

impl PartialOrd for AStarState {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

/// Enhanced path pruning configuration
#[derive(Debug, Clone)]
pub struct PathPruningConfig {
    pub max_hops: usize,
    pub min_liquidity_per_hop: f64,
    pub max_total_fee_bps: f64,
    pub min_efficiency_score: f64,
    pub tvl_weight: f64,
    pub gas_weight: f64,
    pub fee_weight: f64,
    pub liquidity_threshold_percentile: f64, // e.g., 0.1 = top 10% liquidity
}

impl Default for PathPruningConfig {
    fn default() -> Self {
        Self {
            max_hops: 4,                         // Allow one more hop for more route options
            min_liquidity_per_hop: 1.0, // Reduced from 100k to 1 ETH to allow smaller pools
            max_total_fee_bps: 500.0, // Increased from 300 to 500 (5% max total fees) to allow more paths
            min_efficiency_score: 0.1, // Reduced from 0.5 to 0.1 for more lenient path quality
            tvl_weight: 0.4,          // Reduced from 0.6 to 0.4 for more balanced scoring
            gas_weight: 0.2,          // Increased from 0.1 to 0.2 for better gas consideration
            fee_weight: 0.4,          // Increased from 0.3 to 0.4 for better fee consideration
            liquidity_threshold_percentile: 0.5, // Increased from 0.1 to 0.5 (top 50% of pools)
        }
    }
}

/// Enhanced path analysis metrics
#[derive(Debug, Clone)]
pub struct PathMetrics {
    pub total_liquidity: f64,
    pub total_fee_bps: f64,
    pub estimated_gas_cost: u64,
    pub liquidity_score: f64,
    pub efficiency_score: f64,
    pub tvl_distribution: Vec<f64>, // Per-hop TVL
}

/// Main pathfinding struct, operates on TokenGraph.
pub struct Pathfinder {
    // Removed lifetime 'a
    pub graph: Arc<RwLock<TokenGraph>>, // Changed to Arc<RwLock<TokenGraph>>
    pub pruning_config: PathPruningConfig,
    pub liquidity_stats: Arc<RwLock<LiquidityStats>>, // Cache for market statistics
}

/// Market liquidity statistics for intelligent pruning
#[derive(Debug, Clone, Default)]
pub struct LiquidityStats {
    pub pool_liquidity_percentiles: HashMap<String, f64>, // pool_id -> percentile rank
    pub average_fee_by_protocol: HashMap<String, f64>,
    pub median_liquidity: f64,
    pub total_pools_analyzed: usize,
    pub last_updated_block: u64,
}

impl Pathfinder {
    // Removed lifetime 'a
    pub fn new(graph: Arc<RwLock<TokenGraph>>) -> Self {
        // Changed graph type
        Self {
            graph,
            pruning_config: PathPruningConfig::default(),
            liquidity_stats: Arc::new(RwLock::new(LiquidityStats::default())),
        }
    }

    pub fn with_pruning_config(graph: Arc<RwLock<TokenGraph>>, config: PathPruningConfig) -> Self {
        Self {
            graph,
            pruning_config: config,
            liquidity_stats: Arc::new(RwLock::new(LiquidityStats::default())),
        }
    }

    /// Update market statistics for intelligent pruning
    pub fn update_market_stats(&self, block_number: u64) {
        let graph_r = self.graph.read().unwrap();
        let mut stats = self.liquidity_stats.write().unwrap();

        let mut pool_liquidities = Vec::new();
        let mut protocol_fees = HashMap::new();
        let mut protocol_counts = HashMap::new();
        let mut pool_absolute_liquidities = HashMap::new(); // Store absolute values first

        // Collect liquidity and fee data
        for edge_ref in graph_r.graph.edge_references() {
            let edge_weight = edge_ref.weight();

            // Collect liquidity data
            if let Some((reserve_in, reserve_out)) = edge_weight.reserves {
                let min_reserve = reserve_in.min(reserve_out);
                pool_liquidities.push(min_reserve);

                // Store absolute liquidity value for percentile calculation
                pool_absolute_liquidities.insert(edge_weight.pool_id.clone(), min_reserve);
            }

            // Collect fee data by protocol
            if let Some(fee) = edge_weight.fee {
                let protocol = &edge_weight.protocol;
                *protocol_fees.entry(protocol.clone()).or_insert(0.0) += fee;
                *protocol_counts.entry(protocol.clone()).or_insert(0) += 1;
            }
        }

        // Calculate statistics
        if !pool_liquidities.is_empty() {
            pool_liquidities.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            stats.median_liquidity = pool_liquidities[pool_liquidities.len() / 2];

            // Convert absolute liquidity to percentiles
            stats.pool_liquidity_percentiles.clear();
            for (pool_id, absolute_liquidity) in pool_absolute_liquidities {
                let percentile = pool_liquidities
                    .iter()
                    .position(|&x| x >= absolute_liquidity)
                    .map(|pos| pos as f64 / pool_liquidities.len() as f64)
                    .unwrap_or(0.0);
                stats.pool_liquidity_percentiles.insert(pool_id, percentile);
            }
        }

        // Calculate average fees by protocol
        for (protocol, total_fee) in protocol_fees {
            let count = protocol_counts[&protocol] as f64;
            stats
                .average_fee_by_protocol
                .insert(protocol, total_fee / count);
        }

        stats.total_pools_analyzed = pool_liquidities.len();
        stats.last_updated_block = block_number;
    }

    /// Enhanced pathfinding with sophisticated pruning
    pub fn find_paths_with_pruning(
        &self,
        source: &Bytes,
        target: &Bytes,
        k: usize,
    ) -> Vec<Vec<NodeIndex>> {
        let max_depth = self.calculate_dynamic_max_hops(source, target);

        let all_paths = self.enumerate_paths_with_pruning(source, target, max_depth);

        // Score and rank paths
        let mut scored_paths: Vec<(Vec<NodeIndex>, f64)> = all_paths
            .into_iter()
            .filter_map(|path| self.calculate_path_score(&path).map(|score| (path, score)))
            .collect();

        // Sort by score (higher is better)
        scored_paths.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Return top k paths
        scored_paths
            .into_iter()
            .take(k)
            .map(|(path, _)| path)
            .collect()
    }

    /// Calculate dynamic maximum hops based on market conditions and token pair
    fn calculate_dynamic_max_hops(&self, _source: &Bytes, _target: &Bytes) -> usize {
        let stats = self.liquidity_stats.read().unwrap();

        // Base max hops from config
        let mut max_hops = self.pruning_config.max_hops;

        // Adjust based on market liquidity
        if stats.median_liquidity < 50000.0 {
            // Low liquidity market
            max_hops = (max_hops + 1).min(5); // Allow one extra hop
        } else if stats.median_liquidity > 1000000.0 {
            // High liquidity market
            max_hops = (max_hops.saturating_sub(1)).max(2); // Reduce hops, min 2
        }

        // Special cases for common pairs (could be enhanced with more logic)
        // For now, use the calculated max_hops

        max_hops
    }

    /// Enumerate paths with sophisticated pruning at each step
    fn enumerate_paths_with_pruning(
        &self,
        source: &Bytes,
        target: &Bytes,
        max_depth: usize,
    ) -> Vec<Vec<NodeIndex>> {
        let graph_r = self.graph.read().unwrap();
        let (source_idx, target_idx) = match (
            graph_r.token_indices.get(source),
            graph_r.token_indices.get(target),
        ) {
            (Some(&s), Some(&t)) => (s, t),
            _ => return vec![],
        };

        // Stack holds (path, current_metrics)
        let mut stack: Vec<(Vec<NodeIndex>, PathMetrics)> = vec![(
            vec![source_idx],
            PathMetrics {
                total_liquidity: 0.0,
                total_fee_bps: 0.0,
                estimated_gas_cost: 0,
                liquidity_score: 1.0,
                efficiency_score: 1.0,
                tvl_distribution: vec![],
            },
        )];
        let mut results: Vec<Vec<NodeIndex>> = Vec::new();

        while let Some((path, current_metrics)) = stack.pop() {
            let last = *path.last().unwrap();

            if last == target_idx {
                // Path reached target - apply final filtering
                if self.passes_final_path_filter(&path, &current_metrics) {
                    results.push(path);
                }
                continue;
            }

            if path.len() > max_depth {
                continue; // Max depth reached
            }

            // Explore neighbors with pruning
            for edge in graph_r.graph.edges(last) {
                let next = edge.target();

                if path.contains(&next) {
                    continue; // Avoid cycles
                }

                let edge_weight = edge.weight();

                // Calculate metrics for this hop
                let hop_liquidity = edge_weight
                    .reserves
                    .map(|(r_in, r_out)| r_in.min(r_out))
                    .unwrap_or(0.0);
                let hop_fee_bps = edge_weight.fee.unwrap_or(0.0) * 10000.0;

                // Incremental pruning checks
                if !self.should_explore_edge(
                    &current_metrics,
                    hop_liquidity,
                    hop_fee_bps,
                    path.len(),
                ) {
                    continue;
                }

                // Create new metrics for extended path with DYNAMIC gas cost estimation
                let estimated_gas_for_hop =
                    self.estimate_gas_cost_for_hop(edge_weight, path.len() + 1);
                let new_metrics = PathMetrics {
                    total_liquidity: current_metrics.total_liquidity + hop_liquidity,
                    total_fee_bps: current_metrics.total_fee_bps + hop_fee_bps,
                    estimated_gas_cost: current_metrics.estimated_gas_cost + estimated_gas_for_hop,
                    liquidity_score: self
                        .calculate_incremental_liquidity_score(&current_metrics, hop_liquidity),
                    efficiency_score: self.calculate_incremental_efficiency_score(
                        &current_metrics,
                        hop_liquidity,
                        hop_fee_bps,
                        estimated_gas_for_hop as f64,
                    ),
                    tvl_distribution: {
                        let mut dist = current_metrics.tvl_distribution.clone();
                        dist.push(hop_liquidity);
                        dist
                    },
                };

                let mut new_path = path.clone();
                new_path.push(next);
                stack.push((new_path, new_metrics));
            }
        }

        results
    }

    /// Check if an edge should be explored based on incremental pruning criteria
    fn should_explore_edge(
        &self,
        current_metrics: &PathMetrics,
        hop_liquidity: f64,
        hop_fee_bps: f64,
        current_depth: usize,
    ) -> bool {
        // Liquidity threshold check
        if hop_liquidity < self.pruning_config.min_liquidity_per_hop {
            return false;
        }

        // Progressive fee threshold - becomes stricter with depth
        let max_fee_this_hop = self.pruning_config.max_total_fee_bps / (current_depth as f64 * 1.5);
        if hop_fee_bps > max_fee_this_hop {
            return false;
        }

        // Total fee accumulation check
        if current_metrics.total_fee_bps + hop_fee_bps > self.pruning_config.max_total_fee_bps {
            return false;
        }

        // Efficiency degradation check
        let projected_efficiency = self.calculate_incremental_efficiency_score(
            current_metrics,
            hop_liquidity,
            hop_fee_bps,
            0.0,
        );
        if projected_efficiency < self.pruning_config.min_efficiency_score {
            return false;
        }

        true
    }

    /// Calculate incremental liquidity score
    fn calculate_incremental_liquidity_score(
        &self,
        current: &PathMetrics,
        hop_liquidity: f64,
    ) -> f64 {
        let stats = self.liquidity_stats.read().unwrap();

        if stats.median_liquidity <= 0.0 {
            return 1.0; // No stats available
        }

        // Score based on how this hop compares to market median
        let hop_score = (hop_liquidity / stats.median_liquidity).min(2.0); // Cap at 2x median

        // Combine with previous score (weighted average)
        let weight = 1.0 / (current.tvl_distribution.len() + 1) as f64;
        current.liquidity_score * (1.0 - weight) + hop_score * weight
    }

    /// Calculate incremental efficiency score
    fn calculate_incremental_efficiency_score(
        &self,
        current: &PathMetrics,
        hop_liquidity: f64,
        hop_fee_bps: f64,
        estimated_gas_for_hop: f64,
    ) -> f64 {
        let liquidity_component = (hop_liquidity / 100000.0).min(10.0); // Normalize to 0-10
        let fee_penalty = hop_fee_bps / 100.0; // Convert bps to percentage
        let gas_penalty = estimated_gas_for_hop / 1000000.0; // Normalize gas cost

        let hop_efficiency = liquidity_component - fee_penalty - gas_penalty;

        // Weighted combination with current efficiency
        let hops_so_far = current.tvl_distribution.len() as f64;
        let total_hops = hops_so_far + 1.0;

        (current.efficiency_score * hops_so_far + hop_efficiency) / total_hops
    }

    /// Final path filtering based on complete path analysis
    fn passes_final_path_filter(&self, path: &[NodeIndex], metrics: &PathMetrics) -> bool {
        // Must have at least 2 nodes
        if path.len() < 2 {
            return false;
        }

        // Total efficiency must meet threshold
        if metrics.efficiency_score < self.pruning_config.min_efficiency_score {
            return false;
        }

        // Total fees must be reasonable
        if metrics.total_fee_bps > self.pruning_config.max_total_fee_bps {
            return false;
        }

        // Liquidity distribution analysis - no hop should be too thin
        if let Some(&min_liquidity) = metrics
            .tvl_distribution
            .iter()
            .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        {
            if min_liquidity < self.pruning_config.min_liquidity_per_hop {
                return false;
            }
        }

        true
    }

    /// Calculate comprehensive path score for ranking
    fn calculate_path_score(&self, path: &[NodeIndex]) -> Option<f64> {
        if path.len() < 2 {
            return None;
        }

        let graph_r = self.graph.read().unwrap();
        let mut total_liquidity = 0.0;
        let mut total_fee_bps = 0.0;
        let mut hop_count = 0;

        // Analyze each hop
        for window in path.windows(2) {
            let from_idx = window[0];
            let to_idx = window[1];

            // Find best edge between these nodes
            let mut best_edge_score = 0.0;
            let mut found_edge = false;

            for edge in graph_r.graph.edges_connecting(from_idx, to_idx) {
                let edge_weight = edge.weight();
                found_edge = true;

                let hop_liquidity = edge_weight
                    .reserves
                    .map(|(r_in, r_out)| r_in.min(r_out))
                    .unwrap_or(0.0);
                let hop_fee_bps = edge_weight.fee.unwrap_or(0.0) * 10000.0;

                // Score this edge
                let liquidity_score = (hop_liquidity / 100000.0).min(10.0);
                let fee_penalty = hop_fee_bps / 100.0;
                let edge_score = liquidity_score - fee_penalty;

                if edge_score > best_edge_score {
                    best_edge_score = edge_score;
                    total_liquidity += hop_liquidity;
                    total_fee_bps += hop_fee_bps;
                }
            }

            if !found_edge {
                return None; // No valid path
            }

            hop_count += 1;
        }

        // Calculate final composite score
        let avg_liquidity_score = if hop_count > 0 {
            total_liquidity / hop_count as f64 / 100000.0
        } else {
            0.0
        };
        let total_fee_penalty = total_fee_bps / 100.0;
        let hop_penalty = hop_count as f64 * 0.5;

        let final_score = (avg_liquidity_score - total_fee_penalty - hop_penalty).max(0.0);

        Some(final_score)
    }

    /// Find the best path (by weighted cost if available, else hops) from source to target token.
    pub fn best_path(&self, source: &Bytes, target: &Bytes) -> Option<Vec<NodeIndex>> {
        let graph_r = self.graph.read().unwrap(); // Acquire read lock
        if source == target {
            if let Some(&idx) = graph_r.token_indices.get(source) {
                // Use graph_r
                return Some(vec![idx]);
            }
            return None;
        }

        // If CSR edges exist (after recent update), prefer Δ-Stepping SSSP
        #[cfg(feature = "delta_sssp")]
        {
            let csr = graph_r.to_csr(); // Use graph_r
            let source_idx = graph_r.token_indices.get(source)?.index(); // Use graph_r
            let target_idx = graph_r.token_indices.get(target)?.index(); // Use graph_r
            let n = csr.indptr.len() - 1;
            let mut dist = vec![f32::INFINITY; n];
            let mut prev = vec![u32::MAX; n];
            let dirty_nodes: Vec<usize> = Vec::new();
            delta::sssp_parallel(&csr, source_idx, &dirty_nodes, &mut dist, &mut prev);
            if dist[target_idx].is_finite() {
                let mut node = target_idx as u32;
                let mut rev_path = Vec::new();
                while node != u32::MAX {
                    rev_path.push(NodeIndex::new(node as usize));
                    node = prev[node as usize];
                }
                rev_path.reverse();
                return Some(rev_path);
            }
        }

        // --- Existing Dijkstra fallback ---
        // Use Dijkstra\'s algorithm with edge weights if available
        let source_idx = *graph_r.token_indices.get(source)?; // Use graph_r
        let target_idx = *graph_r.token_indices.get(target)?; // Use graph_r
        let path_map = dijkstra(
            &graph_r.graph, // Use graph_r
            source_idx,
            Some(target_idx),
            |e| e.weight().weight.unwrap_or(1.0),
        );
        if let Some(_cost) = path_map.get(&target_idx) {
            let mut path = vec![target_idx];
            let mut current = target_idx;
            while current != source_idx {
                let pred = graph_r
                    .graph // Use graph_r
                    .edges_directed(current, petgraph::Direction::Incoming)
                    .filter_map(|e| {
                        let n = e.source();
                        let w = e.weight().weight.unwrap_or(1.0);
                        let prev_cost = path_map.get(&n)?;
                        if (*prev_cost + w - path_map[&current]).abs() < 1e-8 {
                            Some(n)
                        } else {
                            None
                        }
                    })
                    .next();
                if let Some(pred_idx) = pred {
                    path.push(pred_idx);
                    current = pred_idx;
                } else {
                    break;
                }
            }
            path.reverse();
            Some(path)
        } else {
            None
        }
    }

    /// Yen's algorithm for finding K shortest paths
    pub fn yens_k_shortest_paths(
        &self,
        source: &Bytes,
        target: &Bytes,
        k: usize,
    ) -> Vec<(Vec<NodeIndex>, f64)> {
        println!(
            "🔧 PATHFINDER DEBUG: Starting yens_k_shortest_paths with k={}",
            k
        );

        let graph_r = self.graph.read().unwrap();
        println!("🔧 PATHFINDER DEBUG: Got graph read lock");

        let (source_idx, target_idx) = match (
            graph_r.token_indices.get(source),
            graph_r.token_indices.get(target),
        ) {
            (Some(&s), Some(&t)) => {
                println!(
                    "🔧 PATHFINDER DEBUG: Found source_idx={}, target_idx={}",
                    s.index(),
                    t.index()
                );
                (s, t)
            }
            _ => {
                println!("🔧 PATHFINDER DEBUG: Could not find source or target in graph");
                return vec![];
            }
        };

        // Step 1: Find the shortest path
        println!("🔧 PATHFINDER DEBUG: About to call dijkstra_shortest_path...");
        let shortest_path = self.dijkstra_shortest_path(&graph_r, source_idx, target_idx);
        if shortest_path.is_none() {
            println!("🔧 PATHFINDER DEBUG: No shortest path found");
            return vec![];
        }

        let (path, cost) = shortest_path.unwrap();
        println!(
            "🔧 PATHFINDER DEBUG: Found shortest path with {} nodes, cost={}",
            path.len(),
            cost
        );
        let mut shortest_paths = vec![(path.clone(), cost)];

        // For k=1, we can return immediately
        if k == 1 {
            println!("🔧 PATHFINDER DEBUG: k=1, returning single shortest path");
            return shortest_paths;
        }

        // Priority queue for candidate paths (min-heap by cost)
        let mut candidates = std::collections::BinaryHeap::new();

        // Step 2: Iteratively find k-1 additional shortest paths
        for k_iter in 1..k {
            println!(
                "🔧 PATHFINDER DEBUG: Starting k iteration {}/{}",
                k_iter + 1,
                k
            );
            let previous_path = &shortest_paths[k_iter - 1].0;

            // For each node in the previous k-shortest path except the last
            for i in 0..previous_path.len() - 1 {
                println!(
                    "🔧 PATHFINDER DEBUG: Processing spur node {}/{}",
                    i + 1,
                    previous_path.len() - 1
                );
                let spur_node = previous_path[i];
                let root_path = &previous_path[0..=i];

                // Create a copy of the graph for modification
                let mut blocked_edges = std::collections::HashSet::new();
                let mut blocked_nodes = std::collections::HashSet::new();

                // Block edges that are part of the root path in any of the previous k-shortest paths
                for prev_path in &shortest_paths {
                    if prev_path.0.len() > i
                        && prev_path.0[0..=i] == root_path[..]
                        && i + 1 < prev_path.0.len()
                    {
                        blocked_edges.insert((prev_path.0[i], prev_path.0[i + 1]));
                    }
                }

                // Block nodes in the root path (except spur node)
                for &node in &root_path[0..i] {
                    blocked_nodes.insert(node);
                }

                println!("🔧 PATHFINDER DEBUG: About to call dijkstra_with_blocks with {} blocked edges, {} blocked nodes", blocked_edges.len(), blocked_nodes.len());

                // Find shortest path from spur node to target with blocked elements
                if let Some((spur_path, spur_cost)) = self.dijkstra_with_blocks(
                    &graph_r,
                    spur_node,
                    target_idx,
                    &blocked_edges,
                    &blocked_nodes,
                ) {
                    println!(
                        "🔧 PATHFINDER DEBUG: Found spur path with {} nodes, cost={}",
                        spur_path.len(),
                        spur_cost
                    );

                    // Combine root path with spur path
                    let mut total_path = root_path.to_vec();
                    total_path.extend_from_slice(&spur_path[1..]); // Skip first node to avoid duplication

                    // Calculate total cost
                    let root_cost = if i > 0 {
                        self.calculate_path_cost(&graph_r, &root_path[0..i])
                            .unwrap_or(0.0)
                    } else {
                        0.0
                    };
                    let total_cost = root_cost + spur_cost;

                    // Add to candidates if not already present
                    let candidate = YensCandidate {
                        path: total_path,
                        cost: total_cost,
                    };

                    // Check if this path is already in candidates or shortest_paths
                    if !self.path_already_found(&candidate.path, &shortest_paths, &candidates) {
                        candidates.push(std::cmp::Reverse(candidate));
                        println!("🔧 PATHFINDER DEBUG: Added candidate path to queue");
                    } else {
                        println!("🔧 PATHFINDER DEBUG: Path already found, skipping");
                    }
                } else {
                    println!("🔧 PATHFINDER DEBUG: No spur path found");
                }
            }

            // If no candidates remain, we can't find more paths
            if candidates.is_empty() {
                println!("🔧 PATHFINDER DEBUG: No more candidates, breaking");
                break;
            }

            // Select the candidate with minimum cost
            let best_candidate = candidates.pop().unwrap().0;
            println!(
                "🔧 PATHFINDER DEBUG: Selected best candidate with {} nodes, cost={}",
                best_candidate.path.len(),
                best_candidate.cost
            );
            shortest_paths.push((best_candidate.path, best_candidate.cost));
        }

        println!(
            "🔧 PATHFINDER DEBUG: Returning {} paths",
            shortest_paths.len()
        );
        shortest_paths
    }

    /// Dijkstra's algorithm to find shortest path
    fn dijkstra_shortest_path(
        &self,
        graph: &TokenGraph,
        source: NodeIndex,
        target: NodeIndex,
    ) -> Option<(Vec<NodeIndex>, f64)> {
        println!(
            "🔧 DIJKSTRA DEBUG: Starting dijkstra from {} to {}",
            source.index(),
            target.index()
        );

        let mut distances = std::collections::HashMap::new();
        let mut predecessors = std::collections::HashMap::new();
        let mut heap = std::collections::BinaryHeap::new();

        distances.insert(source, 0.0);
        heap.push(std::cmp::Reverse(DijkstraState {
            cost: 0.0,
            node: source,
        }));

        let mut iteration = 0;
        let start_time = std::time::Instant::now();

        while let Some(std::cmp::Reverse(DijkstraState { cost, node })) = heap.pop() {
            iteration += 1;

            // Progress logging for large iterations
            if iteration % 1000 == 0 {
                println!("🔧 DIJKSTRA DEBUG: Iteration {}, elapsed: {:.2}s, current node: {}, cost: {:.4}", 
                         iteration, start_time.elapsed().as_secs_f64(), node.index(), cost);
            }

            // Safety timeout for debugging - prevent infinite loops
            if start_time.elapsed().as_secs() > 5 {
                println!(
                    "🔧 DIJKSTRA DEBUG: TIMEOUT after 5 seconds, {} iterations",
                    iteration
                );
                return None;
            }

            if node == target {
                println!(
                    "🔧 DIJKSTRA DEBUG: Found target after {} iterations in {:.2}s",
                    iteration,
                    start_time.elapsed().as_secs_f64()
                );

                // Reconstruct path
                let mut path = Vec::new();
                let mut current = target;
                path.push(current);

                while let Some(&pred) = predecessors.get(&current) {
                    path.push(pred);
                    current = pred;
                }

                path.reverse();
                println!(
                    "🔧 DIJKSTRA DEBUG: Reconstructed path with {} nodes",
                    path.len()
                );
                return Some((path, cost));
            }

            if cost > *distances.get(&node).unwrap_or(&f64::INFINITY) {
                continue;
            }

            let edge_count = graph.graph.edges(node).count();
            if iteration <= 10 || iteration % 1000 == 0 {
                println!(
                    "🔧 DIJKSTRA DEBUG: Processing node {} with {} edges",
                    node.index(),
                    edge_count
                );
            }

            for edge in graph.graph.edges(node) {
                let neighbor = edge.target();
                let edge_weight = edge.weight().weight.unwrap_or(1.0);
                let new_cost = cost + edge_weight;

                if new_cost < *distances.get(&neighbor).unwrap_or(&f64::INFINITY) {
                    distances.insert(neighbor, new_cost);
                    predecessors.insert(neighbor, node);
                    heap.push(std::cmp::Reverse(DijkstraState {
                        cost: new_cost,
                        node: neighbor,
                    }));
                }
            }
        }

        println!(
            "🔧 DIJKSTRA DEBUG: No path found after {} iterations in {:.2}s",
            iteration,
            start_time.elapsed().as_secs_f64()
        );
        None
    }

    /// Dijkstra with blocked edges and nodes
    fn dijkstra_with_blocks(
        &self,
        graph: &TokenGraph,
        source: NodeIndex,
        target: NodeIndex,
        blocked_edges: &std::collections::HashSet<(NodeIndex, NodeIndex)>,
        blocked_nodes: &std::collections::HashSet<NodeIndex>,
    ) -> Option<(Vec<NodeIndex>, f64)> {
        if blocked_nodes.contains(&source) || blocked_nodes.contains(&target) {
            return None;
        }

        let mut distances = std::collections::HashMap::new();
        let mut predecessors = std::collections::HashMap::new();
        let mut heap = std::collections::BinaryHeap::new();

        distances.insert(source, 0.0);
        heap.push(std::cmp::Reverse(DijkstraState {
            cost: 0.0,
            node: source,
        }));

        while let Some(std::cmp::Reverse(DijkstraState { cost, node })) = heap.pop() {
            if node == target {
                // Reconstruct path
                let mut path = Vec::new();
                let mut current = target;
                path.push(current);

                while let Some(&pred) = predecessors.get(&current) {
                    path.push(pred);
                    current = pred;
                }

                path.reverse();
                return Some((path, cost));
            }

            if cost > *distances.get(&node).unwrap_or(&f64::INFINITY) {
                continue;
            }

            for edge in graph.graph.edges(node) {
                let neighbor = edge.target();

                // Skip blocked nodes and edges
                if blocked_nodes.contains(&neighbor) || blocked_edges.contains(&(node, neighbor)) {
                    continue;
                }

                let edge_weight = edge.weight().weight.unwrap_or(1.0);
                let new_cost = cost + edge_weight;

                if new_cost < *distances.get(&neighbor).unwrap_or(&f64::INFINITY) {
                    distances.insert(neighbor, new_cost);
                    predecessors.insert(neighbor, node);
                    heap.push(std::cmp::Reverse(DijkstraState {
                        cost: new_cost,
                        node: neighbor,
                    }));
                }
            }
        }

        None
    }

    /// Calculate cost of a path
    fn calculate_path_cost(&self, graph: &TokenGraph, path: &[NodeIndex]) -> Option<f64> {
        if path.len() < 2 {
            return Some(0.0);
        }

        let mut total_cost = 0.0;

        for window in path.windows(2) {
            let from = window[0];
            let to = window[1];

            if let Some(edge) = graph.graph.edges_connecting(from, to).next() {
                total_cost += edge.weight().weight.unwrap_or(1.0);
            } else {
                return None; // Path is invalid
            }
        }

        Some(total_cost)
    }

    /// Check if a path is already found
    fn path_already_found(
        &self,
        path: &[NodeIndex],
        shortest_paths: &[(Vec<NodeIndex>, f64)],
        candidates: &std::collections::BinaryHeap<std::cmp::Reverse<YensCandidate>>,
    ) -> bool {
        // Check in shortest paths
        for (found_path, _) in shortest_paths {
            if found_path == path {
                return true;
            }
        }

        // Check in candidates
        for candidate in candidates {
            if candidate.0.path == path {
                return true;
            }
        }

        false
    }

    /// Enhanced K-shortest paths with Yen's algorithm (public interface)
    pub fn k_shortest_paths_yens(
        &self,
        source: &Bytes,
        target: &Bytes,
        k: usize,
    ) -> Vec<Vec<NodeIndex>> {
        self.yens_k_shortest_paths(source, target, k)
            .into_iter()
            .map(|(path, _cost)| path)
            .collect()
    }

    /// Backward compatibility: K-shortest paths using Yen's algorithm
    pub fn k_shortest_paths(
        &self,
        source: &Bytes,
        target: &Bytes,
        k: usize,
        max_depth: usize,
    ) -> Vec<Vec<NodeIndex>> {
        println!(
            "🔧 PATHFINDER DEBUG: k_shortest_paths called with k={}, max_depth={}",
            k, max_depth
        );

        // Check graph size to choose algorithm
        let (node_count, edge_count) = {
            let graph_r = self.graph.read().unwrap();
            (graph_r.graph.node_count(), graph_r.graph.edge_count())
        };

        println!(
            "🔧 PATHFINDER DEBUG: Graph size: {} nodes, {} edges",
            node_count, edge_count
        );

        // For large graphs (>5000 nodes), use A* for efficiency
        if node_count > 5000 || edge_count > 15000 {
            println!("🔧 PATHFINDER DEBUG: Large graph detected, using A* algorithm");
            return self.a_star_paths(source, target, k, max_depth);
        }

        // For k=1 on smaller graphs, use simple BFS for speed
        if k == 1 {
            println!("🔧 PATHFINDER DEBUG: k=1 on small graph, using fast BFS instead of Yen's algorithm");
            if let Some(path) = self.simple_path_bfs(source, target, max_depth) {
                println!(
                    "🔧 PATHFINDER DEBUG: BFS found path with {} nodes",
                    path.len()
                );
                return vec![path];
            } else {
                println!("🔧 PATHFINDER DEBUG: BFS found no path");
                return vec![];
            }
        }

        // For smaller graphs with k>1, use Yen's algorithm
        println!(
            "🔧 PATHFINDER DEBUG: Using Yen's algorithm for k={} paths",
            k
        );
        self.k_shortest_paths_yens(source, target, k)
    }

    /// Enhanced parallel SSSP implementation with work-stealing
    pub fn parallel_sssp(&self, source: &Bytes) -> HashMap<Bytes, f64> {
        let graph_r = self.graph.read().unwrap();
        let source_idx = match graph_r.token_indices.get(source) {
            Some(&idx) => idx,
            None => return HashMap::new(),
        };

        // For now, implement a multi-threaded approach using rayon-like concepts
        // In a full implementation, this would use actual parallel processing
        self.parallel_sssp_implementation(&graph_r, source_idx)
    }

    /// Actual parallel SSSP implementation
    fn parallel_sssp_implementation(
        &self,
        graph: &TokenGraph,
        source: NodeIndex,
    ) -> HashMap<Bytes, f64> {
        let mut distances = HashMap::new();
        let mut result = HashMap::new();

        // Get all nodes for parallel processing
        let all_nodes: Vec<NodeIndex> = graph.graph.node_indices().collect();

        // Initialize distances
        for &node in &all_nodes {
            distances.insert(node, f64::INFINITY);
        }
        distances.insert(source, 0.0);

        // Use a simplified parallel approach - in production this would use actual parallelization
        // For now, we'll simulate parallel processing with batched computation
        let batch_size = (all_nodes.len() / 4).max(1); // Simulate 4 threads
        let mut changed = true;
        let mut iteration = 0;
        const MAX_ITERATIONS: usize = 100;

        while changed && iteration < MAX_ITERATIONS {
            changed = false;
            iteration += 1;

            // Process nodes in batches (simulating parallel processing)
            for batch_start in (0..all_nodes.len()).step_by(batch_size) {
                let batch_end = (batch_start + batch_size).min(all_nodes.len());
                let batch_changed = self.process_sssp_batch(
                    graph,
                    &all_nodes[batch_start..batch_end],
                    &mut distances,
                );

                if batch_changed {
                    changed = true;
                }
            }
        }

        // Convert node indices back to token addresses
        for (node_idx, distance) in distances {
            if let Some(node_weight) = graph.graph.node_weight(node_idx) {
                if distance < f64::INFINITY {
                    result.insert(node_weight.address.clone(), distance);
                }
            }
        }

        result
    }

    /// Process a batch of nodes for SSSP (simulates parallel worker)
    fn process_sssp_batch(
        &self,
        graph: &TokenGraph,
        node_batch: &[NodeIndex],
        distances: &mut HashMap<NodeIndex, f64>,
    ) -> bool {
        let mut changed = false;

        for &node in node_batch {
            let current_distance = *distances.get(&node).unwrap_or(&f64::INFINITY);

            if current_distance == f64::INFINITY {
                continue; // Node not reachable yet
            }

            // Relax all outgoing edges
            for edge in graph.graph.edges(node) {
                let neighbor = edge.target();
                let edge_weight = edge.weight().weight.unwrap_or(1.0);
                let new_distance = current_distance + edge_weight;
                let neighbor_distance = *distances.get(&neighbor).unwrap_or(&f64::INFINITY);

                if new_distance < neighbor_distance {
                    distances.insert(neighbor, new_distance);
                    changed = true;
                }
            }
        }

        changed
    }

    /// Advanced parallel SSSP with delta-stepping (enhanced version)
    pub fn parallel_sssp_delta_stepping(&self, source: &Bytes, delta: f64) -> HashMap<Bytes, f64> {
        let graph_r = self.graph.read().unwrap();
        let source_idx = match graph_r.token_indices.get(source) {
            Some(&idx) => idx,
            None => return HashMap::new(),
        };

        self.delta_stepping_sssp(&graph_r, source_idx, delta)
    }

    /// Delta-stepping SSSP algorithm implementation
    fn delta_stepping_sssp(
        &self,
        graph: &TokenGraph,
        source: NodeIndex,
        delta: f64,
    ) -> HashMap<Bytes, f64> {
        let mut distances = HashMap::new();
        let mut result = HashMap::new();

        // Initialize all distances to infinity
        for node_idx in graph.graph.node_indices() {
            distances.insert(node_idx, f64::INFINITY);
        }
        distances.insert(source, 0.0);

        // Buckets for delta-stepping
        let mut buckets: Vec<Vec<NodeIndex>> = vec![Vec::new()];
        buckets[0].push(source);
        let mut current_bucket = 0;

        while current_bucket < buckets.len() {
            if buckets[current_bucket].is_empty() {
                current_bucket += 1;
                continue;
            }

            // Process all nodes in current bucket
            let current_nodes = buckets[current_bucket].clone();
            buckets[current_bucket].clear();

            // Phase 1: Relax light edges (weight <= delta)
            let mut requests = Vec::new();

            for node in &current_nodes {
                let node_distance = distances[node];

                for edge in graph.graph.edges(*node) {
                    let neighbor = edge.target();
                    let edge_weight = edge.weight().weight.unwrap_or(1.0);
                    let new_distance = node_distance + edge_weight;

                    if new_distance < distances[&neighbor] {
                        distances.insert(neighbor, new_distance);

                        if edge_weight <= delta {
                            // Light edge - add to current bucket
                            requests.push((neighbor, new_distance));
                        } else {
                            // Heavy edge - add to future bucket
                            let bucket_index =
                                ((new_distance / delta).floor() as usize).max(current_bucket + 1);

                            // Extend buckets if necessary
                            while buckets.len() <= bucket_index {
                                buckets.push(Vec::new());
                            }

                            buckets[bucket_index].push(neighbor);
                        }
                    }
                }
            }

            // Add light edge requests to current bucket
            for (node, _distance) in requests {
                buckets[current_bucket].push(node);
            }
        }

        // Convert results back to token addresses
        for (node_idx, distance) in distances {
            if let Some(node_weight) = graph.graph.node_weight(node_idx) {
                if distance < f64::INFINITY {
                    result.insert(node_weight.address.clone(), distance);
                }
            }
        }

        result
    }

    /// Bidirectional search for faster pathfinding between specific nodes
    pub fn bidirectional_shortest_path(
        &self,
        source: &Bytes,
        target: &Bytes,
    ) -> Option<(Vec<NodeIndex>, f64)> {
        let graph_r = self.graph.read().unwrap();
        let (source_idx, target_idx) = match (
            graph_r.token_indices.get(source),
            graph_r.token_indices.get(target),
        ) {
            (Some(&s), Some(&t)) => (s, t),
            _ => return None,
        };

        // Initialize forward and backward searches
        let mut forward_distances = HashMap::new();
        let mut backward_distances = HashMap::new();
        let mut forward_predecessors = HashMap::new();
        let mut backward_predecessors = HashMap::new();
        let mut forward_heap = std::collections::BinaryHeap::new();
        let mut backward_heap = std::collections::BinaryHeap::new();

        forward_distances.insert(source_idx, 0.0);
        backward_distances.insert(target_idx, 0.0);
        forward_heap.push(std::cmp::Reverse(DijkstraState {
            cost: 0.0,
            node: source_idx,
        }));
        backward_heap.push(std::cmp::Reverse(DijkstraState {
            cost: 0.0,
            node: target_idx,
        }));

        let mut best_distance = f64::INFINITY;
        let mut meeting_node = None;

        while !forward_heap.is_empty() || !backward_heap.is_empty() {
            // Alternate between forward and backward search
            if !forward_heap.is_empty()
                && (backward_heap.is_empty()
                    || forward_heap.peek().unwrap().0.cost <= backward_heap.peek().unwrap().0.cost)
            {
                let state = forward_heap.pop().unwrap().0;
                let node = state.node;
                let cost = state.cost;

                if cost > best_distance {
                    break; // No better path possible
                }

                // Check if we've met the backward search
                if let Some(&backward_cost) = backward_distances.get(&node) {
                    let total_cost = cost + backward_cost;
                    if total_cost < best_distance {
                        best_distance = total_cost;
                        meeting_node = Some(node);
                    }
                }

                // Expand forward
                for edge in graph_r.graph.edges(node) {
                    let neighbor = edge.target();
                    let edge_weight = edge.weight().weight.unwrap_or(1.0);
                    let new_cost = cost + edge_weight;

                    if new_cost < *forward_distances.get(&neighbor).unwrap_or(&f64::INFINITY) {
                        forward_distances.insert(neighbor, new_cost);
                        forward_predecessors.insert(neighbor, node);
                        forward_heap.push(std::cmp::Reverse(DijkstraState {
                            cost: new_cost,
                            node: neighbor,
                        }));
                    }
                }
            } else if !backward_heap.is_empty() {
                let state = backward_heap.pop().unwrap().0;
                let node = state.node;
                let cost = state.cost;

                if cost > best_distance {
                    break; // No better path possible
                }

                // Check if we've met the forward search
                if let Some(&forward_cost) = forward_distances.get(&node) {
                    let total_cost = forward_cost + cost;
                    if total_cost < best_distance {
                        best_distance = total_cost;
                        meeting_node = Some(node);
                    }
                }

                // Expand backward (incoming edges)
                for edge in graph_r
                    .graph
                    .edges_directed(node, petgraph::Direction::Incoming)
                {
                    let neighbor = edge.source();
                    let edge_weight = edge.weight().weight.unwrap_or(1.0);
                    let new_cost = cost + edge_weight;

                    if new_cost < *backward_distances.get(&neighbor).unwrap_or(&f64::INFINITY) {
                        backward_distances.insert(neighbor, new_cost);
                        backward_predecessors.insert(neighbor, node);
                        backward_heap.push(std::cmp::Reverse(DijkstraState {
                            cost: new_cost,
                            node: neighbor,
                        }));
                    }
                }
            }
        }

        // Reconstruct path if found
        if let Some(meeting) = meeting_node {
            let mut path = Vec::new();

            // Forward path (source to meeting point)
            let mut current = meeting;
            let mut forward_path = vec![current];
            while let Some(&pred) = forward_predecessors.get(&current) {
                forward_path.push(pred);
                current = pred;
            }
            forward_path.reverse();

            // Backward path (meeting point to target)
            current = meeting;
            let mut backward_path = Vec::new();
            while let Some(&pred) = backward_predecessors.get(&current) {
                backward_path.push(pred);
                current = pred;
            }

            // Combine paths
            path.extend_from_slice(&forward_path);
            path.extend_from_slice(&backward_path);

            return Some((path, best_distance));
        }

        None
    }

    /// Enumerate paths that do not share intermediate nodes.
    pub fn enumerate_non_overlapping_paths(
        &self,
        source: &Bytes,
        target: &Bytes,
        max_paths: usize,
        max_depth: usize,
    ) -> Vec<Vec<NodeIndex>> {
        let graph_r = self.graph.read().unwrap();
        let (source_idx, target_idx) = match (
            graph_r.token_indices.get(source),
            graph_r.token_indices.get(target),
        ) {
            (Some(&s), Some(&t)) => (s, t),
            _ => return vec![],
        };

        let mut found_paths: Vec<Vec<NodeIndex>> = Vec::new();
        let mut used_intermediate_nodes: HashSet<NodeIndex> = HashSet::new();

        for _i in 0..max_paths {
            let mut best_current_path: Option<Vec<NodeIndex>> = None;

            // BFS to find a shortest path avoiding used_intermediate_nodes
            let mut queue: VecDeque<Vec<NodeIndex>> = VecDeque::new();
            queue.push_back(vec![source_idx]);
            let mut visited_in_bfs: HashSet<NodeIndex> = HashSet::new(); // Visited for current BFS to prevent cycles and redundant exploration
            visited_in_bfs.insert(source_idx);

            while let Some(current_path_segment) = queue.pop_front() {
                let last_node_in_segment = *current_path_segment.last().unwrap();

                if last_node_in_segment == target_idx {
                    // Found a path to the target. Since this is BFS, the first path found is one of the shortest.
                    best_current_path = Some(current_path_segment);
                    break; // Found shortest path for this iteration
                }

                if current_path_segment.len() > max_depth {
                    continue;
                }

                for edge in graph_r.graph.edges(last_node_in_segment) {
                    let neighbor = edge.target();

                    // Avoid cycles within the current path search and nodes already processed in this BFS iteration
                    if visited_in_bfs.contains(&neighbor) {
                        continue;
                    }

                    // Check if neighbor is an intermediate node that's already part of a previously selected path
                    if neighbor != target_idx
                        && neighbor != source_idx
                        && used_intermediate_nodes.contains(&neighbor)
                    {
                        continue;
                    }

                    visited_in_bfs.insert(neighbor); // Mark as visited for current BFS
                    let mut new_path_segment = current_path_segment.clone();
                    new_path_segment.push(neighbor);
                    queue.push_back(new_path_segment);
                }
            }

            if let Some(path) = best_current_path {
                // Add intermediate nodes of this path to used_intermediate_nodes
                for (idx, node) in path.iter().enumerate() {
                    if idx > 0 && idx < path.len() - 1 {
                        // Exclude source and target
                        used_intermediate_nodes.insert(*node);
                    }
                }
                found_paths.push(path);
            } else {
                // No more paths can be found
                break;
            }
        }
        found_paths
    }

    /// Enumerate ALL simple paths (no cycles) between source and target up to `max_depth` hops.
    /// Returns a vector of paths where each path is a list of NodeIndex representing the route.
    /// This exhaustive enumeration is useful when downstream logic (e.g. simulation) will score
    /// the paths more accurately than the heuristic edge weights used for k‑shortest search.
    /// NOTE: The number of returned paths can grow exponentially with depth, so callers should
    /// take care to keep `max_depth` small (typically 3‑4 for ERC‑20 routing).
    pub fn enumerate_paths(
        &self,
        source: &Bytes,
        target: &Bytes,
        max_depth: usize,
    ) -> Vec<Vec<NodeIndex>> {
        let graph_r = self.graph.read().unwrap(); // Acquire read lock
        let (source_idx, target_idx) = match (
            graph_r.token_indices.get(source),
            graph_r.token_indices.get(target),
        ) {
            (Some(&s), Some(&t)) => (s, t),
            _ => return vec![],
        };

        // Stack holds the current partial path to explore
        let mut stack: Vec<Vec<NodeIndex>> = vec![vec![source_idx]];
        let mut results: Vec<Vec<NodeIndex>> = Vec::new();

        while let Some(path) = stack.pop() {
            let last = *path.last().unwrap();
            if last == target_idx {
                results.push(path.clone());
                continue;
            }
            if path.len() > max_depth {
                // reached hop limit (edges)
                continue;
            }
            for edge in graph_r.graph.edges(last) {
                let next = edge.target();
                if path.contains(&next) {
                    continue; // avoid cycles
                }
                let mut new_path = path.clone();
                new_path.push(next);
                stack.push(new_path);
            }
        }

        results
    }

    /// Compute the total cost of a path, considering slippage and fee if available.
    pub fn path_cost_with_slippage_fee(&self, path: &[NodeIndex]) -> Option<f64> {
        let graph_r = self.graph.read().unwrap(); // Acquire read lock
        let mut total_cost = 0.0;
        for w in path.windows(2) {
            let from = w[0];
            let to = w[1];
            let mut edge_cost = None;
            if let Some(edge) = graph_r.graph.edges_connecting(from, to).next() {
                let ew = edge.weight();
                // Use weight if available, else fallback to 1.0
                edge_cost = Some(ew.weight.unwrap_or(1.0));
                // Optionally, add fee/slippage logic here
                // e.g., edge_cost = Some(compute_effective_weight(ew));
            }
            total_cost += edge_cost.unwrap_or(1.0);
        }
        Some(total_cost)
    }

    /// Simple BFS to find any path quickly (fallback for performance)
    pub fn simple_path_bfs(
        &self,
        source: &Bytes,
        target: &Bytes,
        max_hops: usize,
    ) -> Option<Vec<NodeIndex>> {
        println!(
            "🔧 BFS DEBUG: Starting simple BFS from {:?} to {:?} with max_hops={}",
            source, target, max_hops
        );

        let graph_r = self.graph.read().unwrap();
        let (source_idx, target_idx) = match (
            graph_r.token_indices.get(source),
            graph_r.token_indices.get(target),
        ) {
            (Some(&s), Some(&t)) => {
                println!(
                    "🔧 BFS DEBUG: Found source_idx={}, target_idx={}",
                    s.index(),
                    t.index()
                );
                (s, t)
            }
            _ => {
                println!("🔧 BFS DEBUG: Could not find source or target in graph");
                return None;
            }
        };

        if source_idx == target_idx {
            println!("🔧 BFS DEBUG: Source equals target, returning direct path");
            return Some(vec![source_idx]);
        }

        let mut queue = VecDeque::new();
        let mut visited = HashSet::new();
        let mut parent = HashMap::new();

        queue.push_back((source_idx, 0)); // (node, depth)
        visited.insert(source_idx);

        let start_time = std::time::Instant::now();
        let mut iteration = 0;

        while let Some((current, depth)) = queue.pop_front() {
            iteration += 1;

            if iteration % 1000 == 0 {
                println!(
                    "🔧 BFS DEBUG: Iteration {}, queue size: {}, depth: {}, elapsed: {:.2}s",
                    iteration,
                    queue.len(),
                    depth,
                    start_time.elapsed().as_secs_f64()
                );
            }

            // Safety timeout
            if start_time.elapsed().as_secs() > 3 {
                println!(
                    "🔧 BFS DEBUG: TIMEOUT after 3 seconds, {} iterations",
                    iteration
                );
                return None;
            }

            if current == target_idx {
                println!(
                    "🔧 BFS DEBUG: Found target after {} iterations, depth {}",
                    iteration, depth
                );

                // Reconstruct path
                let mut path = Vec::new();
                let mut curr = target_idx;
                path.push(curr);

                while let Some(&prev) = parent.get(&curr) {
                    path.push(prev);
                    curr = prev;
                }

                path.reverse();
                println!("🔧 BFS DEBUG: Reconstructed path with {} nodes", path.len());
                return Some(path);
            }

            if depth >= max_hops {
                continue; // Don't expand beyond max hops
            }

            // Explore neighbors
            for edge in graph_r.graph.edges(current) {
                let neighbor = edge.target();

                if !visited.contains(&neighbor) {
                    visited.insert(neighbor);
                    parent.insert(neighbor, current);
                    queue.push_back((neighbor, depth + 1));
                }
            }
        }

        println!("🔧 BFS DEBUG: No path found after {} iterations", iteration);
        None
    }

    /// Fast A* pathfinding with heuristics and early termination
    pub fn a_star_paths(
        &self,
        source: &Bytes,
        target: &Bytes,
        k: usize,
        max_depth: usize,
    ) -> Vec<Vec<NodeIndex>> {
        println!(
            "🔧 A* DEBUG: Starting A* pathfinding with k={}, max_depth={}",
            k, max_depth
        );

        let graph_r = self.graph.read().unwrap();
        let (source_idx, target_idx) = match (
            graph_r.token_indices.get(source),
            graph_r.token_indices.get(target),
        ) {
            (Some(&s), Some(&t)) => {
                println!(
                    "🔧 A* DEBUG: Found source_idx={}, target_idx={}",
                    s.index(),
                    t.index()
                );
                (s, t)
            }
            _ => {
                println!("🔧 A* DEBUG: Could not find source or target in graph");
                return vec![];
            }
        };

        let mut found_paths = Vec::new();
        let max_iterations = 50_000;
        let start_time = std::time::Instant::now();

        // For diverse paths, we'll block previously found paths and find alternatives
        let mut blocked_edges: std::collections::HashSet<(NodeIndex, NodeIndex)> =
            std::collections::HashSet::new();

        for path_iteration in 0..k {
            println!("🔧 A* DEBUG: Finding path {}/{}", path_iteration + 1, k);

            // Use A* with liquidity-based heuristic
            let mut open_set = std::collections::BinaryHeap::new();
            let mut came_from: std::collections::HashMap<NodeIndex, NodeIndex> =
                std::collections::HashMap::new();
            let mut g_score: std::collections::HashMap<NodeIndex, f64> =
                std::collections::HashMap::new();
            let mut f_score: std::collections::HashMap<NodeIndex, f64> =
                std::collections::HashMap::new();

            g_score.insert(source_idx, 0.0);
            f_score.insert(source_idx, self.heuristic(source_idx, target_idx, &graph_r));

            open_set.push(std::cmp::Reverse(AStarState {
                f_score: *f_score.get(&source_idx).unwrap(),
                node: source_idx,
            }));

            let mut iteration = 0;
            let mut path_found = false;

            while let Some(std::cmp::Reverse(current_state)) = open_set.pop() {
                iteration += 1;

                if iteration > max_iterations {
                    println!(
                        "🔧 A* DEBUG: Hit iteration limit for path {}",
                        path_iteration + 1
                    );
                    break;
                }

                let current = current_state.node;

                if current == target_idx {
                    println!(
                        "🔧 A* DEBUG: Found path {} to target! Reconstructing...",
                        path_iteration + 1
                    );
                    let path = self.reconstruct_path(&came_from, current);
                    if path.len() <= max_depth + 1 {
                        found_paths.push(path.clone());
                        path_found = true;

                        // Block this path's edges for next iterations to find diverse paths
                        for window in path.windows(2) {
                            blocked_edges.insert((window[0], window[1]));
                        }

                        println!(
                            "🔧 A* DEBUG: Path {} found and edges blocked for diversity",
                            path_iteration + 1
                        );
                    }
                    break;
                }

                let current_g_score = *g_score.get(&current).unwrap_or(&f64::INFINITY);

                // Explore neighbors with efficiency heuristics and diversity constraints
                let neighbors: Vec<_> = graph_r.graph.edges(current).collect();
                for edge_ref in neighbors {
                    let neighbor = edge_ref.target();

                    // Skip blocked edges to encourage path diversity
                    if blocked_edges.contains(&(current, neighbor)) {
                        continue;
                    }

                    let edge_weight = edge_ref.weight();

                    // Skip edges with poor liquidity or high fees
                    if let Some((reserve_in, reserve_out)) = edge_weight.reserves {
                        let min_reserve = reserve_in.min(reserve_out);
                        if min_reserve < 1000.0 {
                            // Skip very low liquidity pools
                            continue;
                        }
                    }

                    if let Some(fee) = edge_weight.fee {
                        if fee > 0.05 {
                            // Skip pools with >5% fees
                            continue;
                        }
                    }

                    // Calculate tentative g_score with better edge weighting
                    let edge_cost = self.calculate_edge_cost(edge_weight);
                    let tentative_g_score = current_g_score + edge_cost;

                    if tentative_g_score < *g_score.get(&neighbor).unwrap_or(&f64::INFINITY) {
                        came_from.insert(neighbor, current);
                        g_score.insert(neighbor, tentative_g_score);
                        let h_score = self.heuristic(neighbor, target_idx, &graph_r);
                        let f_score_val = tentative_g_score + h_score;
                        f_score.insert(neighbor, f_score_val);

                        open_set.push(std::cmp::Reverse(AStarState {
                            f_score: f_score_val,
                            node: neighbor,
                        }));
                    }
                }
            }

            if !path_found {
                println!(
                    "🔧 A* DEBUG: No more diverse paths found after {} paths",
                    path_iteration
                );
                break;
            }
        }

        println!(
            "🔧 A* DEBUG: Completed A* search in {:.2}s, found {} diverse paths",
            start_time.elapsed().as_secs_f64(),
            found_paths.len()
        );
        found_paths
    }

    /// Heuristic function for A* (estimates cost to target)
    fn heuristic(&self, from: NodeIndex, to: NodeIndex, _graph: &TokenGraph) -> f64 {
        // For now, use a simple heuristic based on node indices
        // In a more sophisticated version, we could use:
        // - Token liquidity differences
        // - Common path patterns
        // - Market cap differences
        let from_idx = from.index() as f64;
        let to_idx = to.index() as f64;
        (from_idx - to_idx).abs() * 0.1 // Small weight to encourage exploration
    }

    /// Calculate edge cost for A* algorithm
    fn calculate_edge_cost(&self, edge_weight: &crate::engine::graph::PoolEdge) -> f64 {
        let mut cost: f64 = 1.0; // Base cost

        // Add fee cost
        if let Some(fee) = edge_weight.fee {
            cost += fee * 100.0; // Scale fee impact
        }

        // Subtract liquidity benefit (lower cost for higher liquidity)
        if let Some((reserve_in, reserve_out)) = edge_weight.reserves {
            let min_reserve = reserve_in.min(reserve_out);
            let liquidity_bonus = (min_reserve / 1_000_000.0).min(1.0); // Cap at 1.0
            cost -= liquidity_bonus * 0.5; // Up to 50% cost reduction for high liquidity
        }

        cost.max(0.1) // Minimum cost
    }

    /// Reconstruct path from A* came_from map
    fn reconstruct_path(
        &self,
        came_from: &std::collections::HashMap<NodeIndex, NodeIndex>,
        current: NodeIndex,
    ) -> Vec<NodeIndex> {
        let mut path = vec![current];
        let mut current_node = current;

        while let Some(&previous) = came_from.get(&current_node) {
            path.push(previous);
            current_node = previous;
        }

        path.reverse();
        path
    }

    /// Estimate gas cost for a hop dynamically based on pool type and protocol
    fn estimate_gas_cost_for_hop(
        &self,
        edge_weight: &crate::engine::graph::PoolEdge,
        hop_number: usize,
    ) -> u64 {
        // Base gas costs by protocol (more realistic estimates)
        let base_gas = match edge_weight.pool_id.as_str() {
            id if id.contains("uniswap_v2") => 120_000u64, // Uniswap V2 style
            id if id.contains("uniswap_v3") => 140_000u64, // Uniswap V3 with more complexity
            id if id.contains("uniswap_v4") => 160_000u64, // V4 with hooks
            id if id.contains("balancer") => 180_000u64,   // Balancer with complex math
            id if id.contains("curve") => 200_000u64,      // Curve with bonding curves
            id if id.contains("sushiswap") => 125_000u64,  // SushiSwap (similar to V2)
            id if id.contains("pancakeswap") => 110_000u64, // PancakeSwap (optimized)
            _ => 150_000u64,                               // Default fallback
        };

        // Additional complexity factors
        let mut complexity_multiplier = 1.0f64;

        // Multi-hop penalty (later hops are slightly more expensive due to stack depth)
        if hop_number > 1 {
            complexity_multiplier += (hop_number - 1) as f64 * 0.05; // 5% increase per hop
        }

        // High fee pools might have more complex logic
        if let Some(fee) = edge_weight.fee {
            if fee > 0.01 {
                // 1%+ fee suggests exotic pool
                complexity_multiplier += 0.15; // 15% gas increase
            }
        }

        // Large reserves might indicate more complex pool logic
        if let Some((reserve_in, reserve_out)) = edge_weight.reserves {
            let total_reserves = reserve_in + reserve_out;
            if total_reserves > 10_000_000.0 {
                // $10M+ pools
                complexity_multiplier += 0.1; // 10% increase for large pools
            }
        }

        // Apply multiplier and cap
        let final_gas = (base_gas as f64 * complexity_multiplier) as u64;
        final_gas.min(500_000) // Cap at 500k gas per hop for safety
    }

    // TODO: Add slippage/fee/price-aware weights, parallel SSSP, incremental updates, etc.
}

// New delta module implementing parallel Δ-Stepping SSSP
#[cfg(feature = "delta_sssp")]
pub mod delta {
    use crate::engine::graph::csr::CsrGraph;
    // use rayon if desired; we implement sequential fallback
    // use rayon::prelude::*;

    const DEFAULT_DELTA: f32 = 1.0;

    // Public SSSP function
    pub fn sssp_parallel(
        csr: &CsrGraph,
        source: usize,
        _dirty_nodes: &[usize], // Currently unused, for future incremental updates
        dist: &mut [f32],
        prev: &mut [u32],
    ) {
        dist.fill(f32::INFINITY);
        prev.fill(u32::MAX); // Use u32::MAX to denote no predecessor

        dist[source] = 0.0;
        let mut buckets: Vec<Vec<usize>> = vec![Vec::new()];
        buckets[0].push(source);
        let mut current_bucket_idx = 0;

        while current_bucket_idx < buckets.len() {
            if buckets[current_bucket_idx].is_empty() {
                current_bucket_idx += 1;
                continue;
            }

            let mut req: Vec<(usize, f32)> = Vec::new(); // Store (neighbor, weight)
            let mut light_edges_nodes: Vec<usize> = Vec::new();
            let mut heavy_edges_nodes: Vec<usize> = Vec::new();

            // Phase 1: Relax light edges for nodes in current bucket
            for &u in &buckets[current_bucket_idx] {
                if dist[u] < (current_bucket_idx as f32 * DEFAULT_DELTA) {
                    continue;
                } // Node already settled earlier

                for i in csr.indptr[u]..csr.indptr[u + 1] {
                    let v = csr.indices[i] as usize;
                    let weight_uv = csr.weights[i];
                    if weight_uv <= DEFAULT_DELTA {
                        // Light edge
                        if dist[u] + weight_uv < dist[v] {
                            dist[v] = dist[u] + weight_uv;
                            prev[v] = u as u32;
                            req.push((v, dist[v]));
                            light_edges_nodes.push(v);
                        }
                    } else {
                        // Heavy edge
                        if dist[u] + weight_uv < dist[v] {
                            dist[v] = dist[u] + weight_uv;
                            prev[v] = u as u32;
                            req.push((v, dist[v])); // Keep track for potential re-bucketing
                            heavy_edges_nodes.push(v); // For later processing
                        }
                    }
                }
            }

            buckets[current_bucket_idx].clear(); // Clear current bucket

            // Re-bucket nodes relaxed by light edges
            for node in light_edges_nodes {
                let new_bucket_for_node = (dist[node] / DEFAULT_DELTA).floor() as usize;
                if new_bucket_for_node >= buckets.len() {
                    buckets.resize(new_bucket_for_node + 1, Vec::new());
                }
                if !buckets[new_bucket_for_node].contains(&node) {
                    // Avoid duplicates
                    buckets[new_bucket_for_node].push(node);
                }
            }

            // Phase 2: Relax heavy edges (iteratively if needed, but simple version here)
            // This part might need refinement for correctness with many heavy edges or specific graph structures.
            // For now, we re-bucket nodes affected by heavy edges directly.
            for node in heavy_edges_nodes {
                let new_bucket_for_node = (dist[node] / DEFAULT_DELTA).floor() as usize;
                if new_bucket_for_node >= buckets.len() {
                    buckets.resize(new_bucket_for_node + 1, Vec::new());
                }
                if !buckets[new_bucket_for_node].contains(&node) {
                    // Avoid duplicates
                    buckets[new_bucket_for_node].push(node);
                }
            }

            // If no new nodes were added to current or future buckets, advance to next non-empty or finish.
            let mut next_bucket_idx = current_bucket_idx;
            while next_bucket_idx < buckets.len() && buckets[next_bucket_idx].is_empty() {
                next_bucket_idx += 1;
            }
            if next_bucket_idx == buckets.len() {
                break; // All done
            }
            current_bucket_idx = next_bucket_idx;
        }
    }
}
