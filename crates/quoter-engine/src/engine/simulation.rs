//! Path simulation logic.

// use tycho_simulation::protocol::state::ProtocolSim; // This was the original unused import to remove
use crate::data::component_tracker::ComponentTracker;
use crate::engine::graph::TokenGraph;
// use tycho_simulation::models::Token; // Unused
// use tycho_simulation::tycho_common::Bytes; // Unused
use num_bigint::BigUint;
use num_traits::ToPrimitive;
use petgraph::prelude::{EdgeIndex, NodeIndex};
use tracing::warn;

// Placeholder for simulate_path_gross and other simulation-related functions
// from the original price_engine.rs file.

// This is a simplified version of simulate_path_gross for now.
// The full version will be moved later.
pub fn simulate_path_gross(
    tracker: &ComponentTracker,
    graph: &TokenGraph,
    amount_in: u128,
    path_nodes: &[NodeIndex],
    path_edges: &[EdgeIndex],
    _block: Option<u64>, // Add block parameter, prefixed with underscore as unused
) -> Option<u128> {
    if path_nodes.len() < 2 || path_edges.len() != path_nodes.len() - 1 {
        return None; // Invalid path
    }

    let mut current_amount = amount_in;
    let mut current_token_address = graph.graph.node_weight(path_nodes[0])?.address.clone();

    for i in 0..path_edges.len() {
        let edge_idx = path_edges[i];
        let pool_edge = graph.graph.edge_weight(edge_idx)?;
        let to_node_idx = path_nodes[i + 1];
        let next_token_node = graph.graph.node_weight(to_node_idx)?;

        // Skip problematic pools that are known to panic
        if pool_edge.pool_id == "0x898adc9aa0c23dce3fed6456c34dbe2b57784325" {
            warn!(
                "Skipping problematic pool due to known simulation issues: {}",
                pool_edge.pool_id
            );
            return None;
        }

        let pool_state_map = tracker.pool_states.read().unwrap();
        let pool_state = pool_state_map.get(&pool_edge.pool_id)?;

        let all_tokens_map = tracker.all_tokens.read().unwrap();
        let token_in_model = all_tokens_map.get(&current_token_address)?;
        let token_out_model = all_tokens_map.get(&next_token_node.address)?;

        let amount_in_biguint = BigUint::from(current_amount);

        // Debug pool information
        println!("🔧 DEBUG: Simulating swap in pool {}", pool_edge.pool_id);
        println!(
            "  📥 Input: {} {} (raw: {})",
            current_amount as f64 / 10f64.powi(token_in_model.decimals as i32),
            token_in_model.symbol,
            current_amount
        );
        println!(
            "  🎯 Target: {} (decimals: {})",
            token_out_model.symbol, token_out_model.decimals
        );

        match pool_state.get_amount_out(amount_in_biguint, token_in_model, token_out_model) {
            Ok(sim_result) => {
                if let Some(out_val) = sim_result.amount.to_u128() {
                    println!(
                        "  📤 Output: {} {} (raw: {})",
                        out_val as f64 / 10f64.powi(token_out_model.decimals as i32),
                        token_out_model.symbol,
                        out_val
                    );
                    current_amount = out_val;
                    current_token_address = next_token_node.address.clone();
                } else {
                    warn!(
                        "Failed to convert simulation result to u128 for pool: {}",
                        pool_edge.pool_id
                    );
                    return None; // Failed to convert amount
                }
            }
            Err(e) => {
                warn!("Simulation error for pool {}: {:?}", pool_edge.pool_id, e);
                return None; // Simulation failed for this hop
            }
        }
    }
    Some(current_amount)
}
