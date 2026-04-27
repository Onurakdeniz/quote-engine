use anyhow::{anyhow, Result};
use reqwest::Client;
use rust_decimal::Decimal;
use serde_json::{json, Value};
use tracing::warn;

/// Gas price calculator using Infura RPC
#[derive(Debug, Clone)]
pub struct GasCalculator {
    pub rpc_url: String,
    pub client: Client,
}

/// Gas price information
#[derive(Debug, Clone)]
pub struct GasPrices {
    pub slow: u64,         // Gas price in gwei for slow transactions
    pub standard: u64,     // Gas price in gwei for standard transactions
    pub fast: u64,         // Gas price in gwei for fast transactions
    pub base_fee: u64,     // Current base fee in gwei
    pub priority_fee: u64, // Priority fee in gwei
}

impl GasCalculator {
    /// Create a new gas calculator with Infura RPC URL
    pub fn new(infura_api_key: &str) -> Self {
        let rpc_url = format!("https://mainnet.infura.io/v3/{}", infura_api_key);
        Self {
            rpc_url,
            client: Client::new(),
        }
    }

    /// Get current gas prices from Ethereum network via Infura
    pub async fn get_current_gas_prices(&self) -> Result<GasPrices> {
        // Get base fee from latest block
        let base_fee = self.get_base_fee().await?;

        // Get suggested gas price
        let suggested_gas_price = self.get_suggested_gas_price().await?;

        // Calculate priority fee (typically 1-3 gwei)
        let priority_fee = 2; // 2 gwei priority fee

        // Calculate gas prices for different speeds
        let slow = base_fee.saturating_add(1);
        let standard = suggested_gas_price.max(base_fee.saturating_add(priority_fee));
        let fast = standard.max(base_fee.saturating_add(priority_fee.saturating_mul(2)));

        Ok(GasPrices {
            slow,
            standard,
            fast,
            base_fee,
            priority_fee,
        })
    }

    /// Get base fee from the latest block
    async fn get_base_fee(&self) -> Result<u64> {
        let payload = json!({
            "jsonrpc": "2.0",
            "method": "eth_getBlockByNumber",
            "params": ["latest", false],
            "id": 1
        });

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&payload)
            .send()
            .await?
            .error_for_status()?;

        let json: Value = response.json().await?;

        if let Some(result) = json.get("result") {
            if let Some(base_fee_hex) = result.get("baseFeePerGas") {
                if let Some(base_fee_str) = base_fee_hex.as_str() {
                    return parse_hex_wei_to_gwei(base_fee_str);
                }
            }
        }

        // Fallback to 20 gwei if we can't get base fee
        warn!("Could not retrieve base fee, using fallback of 20 gwei");
        Ok(20)
    }

    /// Get suggested gas price from network
    async fn get_suggested_gas_price(&self) -> Result<u64> {
        let payload = json!({
            "jsonrpc": "2.0",
            "method": "eth_gasPrice",
            "params": [],
            "id": 1
        });

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&payload)
            .send()
            .await?
            .error_for_status()?;

        let json: Value = response.json().await?;

        if let Some(result) = json.get("result") {
            if let Some(gas_price_hex) = result.as_str() {
                return parse_hex_wei_to_gwei(gas_price_hex);
            }
        }

        // Fallback to 25 gwei if we can't get gas price
        warn!("Could not retrieve gas price, using fallback of 25 gwei");
        Ok(25)
    }

    /// Estimate gas cost for a token swap
    pub fn estimate_swap_gas_cost(&self, gas_prices: &GasPrices, speed: GasSpeed) -> SwapGasCost {
        let gas_price = match speed {
            GasSpeed::Slow => gas_prices.slow,
            GasSpeed::Standard => gas_prices.standard,
            GasSpeed::Fast => gas_prices.fast,
        };

        // Typical gas usage for different swap types
        let simple_swap_gas = 150_000; // Simple UniswapV2 swap
        let complex_swap_gas = 300_000; // Complex multi-hop swap
        let arbitrage_gas = 500_000; // Arbitrage transaction

        SwapGasCost {
            gas_price_gwei: gas_price,
            simple_swap_cost_gwei: simple_swap_gas * gas_price,
            complex_swap_cost_gwei: complex_swap_gas * gas_price,
            arbitrage_cost_gwei: arbitrage_gas * gas_price,
            simple_swap_cost_eth: Decimal::from(simple_swap_gas * gas_price)
                / Decimal::from(1_000_000_000u64),
            complex_swap_cost_eth: Decimal::from(complex_swap_gas * gas_price)
                / Decimal::from(1_000_000_000u64),
            arbitrage_cost_eth: Decimal::from(arbitrage_gas * gas_price)
                / Decimal::from(1_000_000_000u64),
        }
    }

    /// Get network congestion level based on gas prices
    pub fn get_network_congestion(&self, gas_prices: &GasPrices) -> NetworkCongestion {
        match gas_prices.base_fee {
            0..=20 => NetworkCongestion::Low,
            21..=50 => NetworkCongestion::Medium,
            51..=100 => NetworkCongestion::High,
            _ => NetworkCongestion::Extreme,
        }
    }

    /// Print gas price information in a user-friendly format
    pub fn print_gas_info(&self, gas_prices: &GasPrices) {
        let congestion = self.get_network_congestion(gas_prices);
        let swap_costs = self.estimate_swap_gas_cost(gas_prices, GasSpeed::Standard);

        println!("⛽ Current Gas Prices (via Infura RPC):");
        println!("  📉 Slow:     {} gwei", gas_prices.slow);
        println!("  📊 Standard: {} gwei", gas_prices.standard);
        println!("  📈 Fast:     {} gwei", gas_prices.fast);
        println!("  🔥 Base Fee: {} gwei", gas_prices.base_fee);
        println!("  ⚡ Priority: {} gwei", gas_prices.priority_fee);
        println!("  🚦 Congestion: {:?}", congestion);
        println!();
        println!("💸 Estimated Swap Costs (Standard Gas):");
        println!(
            "  🔄 Simple Swap:  {:.4} ETH ({} gwei)",
            swap_costs.simple_swap_cost_eth, swap_costs.simple_swap_cost_gwei
        );
        println!(
            "  🔀 Complex Swap: {:.4} ETH ({} gwei)",
            swap_costs.complex_swap_cost_eth, swap_costs.complex_swap_cost_gwei
        );
        println!(
            "  ⚡ Arbitrage:    {:.4} ETH ({} gwei)",
            swap_costs.arbitrage_cost_eth, swap_costs.arbitrage_cost_gwei
        );
    }
}

fn parse_hex_wei_to_gwei(value: &str) -> Result<u64> {
    let hex = value
        .strip_prefix("0x")
        .ok_or_else(|| anyhow!("RPC numeric response is missing 0x prefix"))?;
    let wei = u64::from_str_radix(hex, 16)?;

    Ok(wei / 1_000_000_000)
}

/// Gas speed preferences
#[derive(Debug, Clone, Copy)]
pub enum GasSpeed {
    Slow,
    Standard,
    Fast,
}

/// Network congestion levels
#[derive(Debug, Clone, Copy)]
pub enum NetworkCongestion {
    Low,
    Medium,
    High,
    Extreme,
}

/// Swap gas cost estimates
#[derive(Debug, Clone)]
pub struct SwapGasCost {
    pub gas_price_gwei: u64,
    pub simple_swap_cost_gwei: u64,
    pub complex_swap_cost_gwei: u64,
    pub arbitrage_cost_gwei: u64,
    pub simple_swap_cost_eth: Decimal,
    pub complex_swap_cost_eth: Decimal,
    pub arbitrage_cost_eth: Decimal,
}
