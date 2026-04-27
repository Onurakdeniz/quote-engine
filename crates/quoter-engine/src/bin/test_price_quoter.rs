use price_quoter::{PriceQuoter, PriceQuoterConfig};
use std::str::FromStr;
use tycho_simulation::tycho_common::Bytes;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging with more detailed output
    let env_filter = tracing_subscriber::EnvFilter::from_default_env()
        .add_directive("price_quoter=debug".parse()?)
        .add_directive("tycho_simulation=debug".parse()?);

    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_target(false)
        .init();

    // Load environment variables
    price_quoter::env_loader::load_env_file("price_quoter.env")?;

    println!("🚀 Starting Simplified Tycho Connection Test");

    // Skip the direct API test to avoid rate limiting
    println!("\n=== Testing Price Quoter with Tycho Stream ===");

    // Small delay to avoid rate limiting
    println!("⏳ Waiting 2 seconds to avoid rate limiting...");
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // Create configuration with proper TVL threshold
    let tvl_from_env = std::env::var("TVL_THRESHOLD")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.01); // Default to 0.01 ETH like the env file

    let config = PriceQuoterConfig::new(
        price_quoter::env_loader::EnvConfig::tycho_url(),
        price_quoter::env_loader::EnvConfig::tycho_api_key(),
        "ethereum".to_string(),
    )?
    .with_tvl_threshold(tvl_from_env) // Use TVL from env instead of hardcoding 100
    .with_max_hops(4)
    .with_probe_depth(2);

    println!(
        "📡 Configuration created with TVL threshold: {} ETH",
        tvl_from_env
    );

    // Create and start the price quoter
    match PriceQuoter::new(config).await {
        Ok(mut quoter) => {
            println!("✅ PriceQuoter created successfully");

            // Start the quoter to begin stream consumption
            println!("🚀 Starting the price quoter...");
            quoter.start().await?;
            println!("✅ Price quoter started successfully");

            // Test getting all prices
            println!("\n=== Testing price calculation ===");

            // Wait a bit for the system to initialize
            println!("⏳ Waiting 5 seconds for initial data...");
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

            let all_prices = quoter.get_all_prices().await;
            println!("📊 Current price count: {}", all_prices.len());

            // Look for WETH and USDT specifically
            let weth_address =
                Bytes::from_str("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2").unwrap();
            let usdt_address =
                Bytes::from_str("0xdac17f958d2ee523a2206206994597c13d831ec7").unwrap();

            if let Some(weth_price) = all_prices.get(&weth_address) {
                println!("✅ WETH price: {:?}", weth_price.price);
            } else {
                println!("⚠️  WETH price not available yet");
            }

            if let Some(usdt_price) = all_prices.get(&usdt_address) {
                println!("✅ USDT price: {:?}", usdt_price.price);
            } else {
                println!("⚠️  USDT price not available yet");
            }

            // Show a few available prices
            println!("\n📊 First 5 available prices:");
            for (i, (address, price_info)) in all_prices.iter().take(5).enumerate() {
                println!(
                    "  {}. {} - Price: {:?}",
                    i + 1,
                    hex::encode(address.as_ref()),
                    price_info.price
                );
            }

            // Wait for a bit to see if we get any stream updates
            println!("\n⏳ Waiting 30 seconds for Tycho stream updates...");
            for i in 0..6 {
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                let stats = quoter.get_stats().await;
                let updated_prices = quoter.get_all_prices().await;
                println!(
                    "📊 After {}s - Price count: {}, Tokens tracked: {}",
                    (i + 1) * 5,
                    updated_prices.len(),
                    stats.total_tokens_tracked
                );

                // Check if we're getting any prices
                if !updated_prices.is_empty() {
                    println!("🎉 SUCCESS: System is receiving data!");
                    // Show some example prices
                    for (i, (address, price_info)) in updated_prices.iter().take(3).enumerate() {
                        println!(
                            "   {}. {} - Price: {:?}",
                            i + 1,
                            hex::encode(address.as_ref()),
                            price_info.price
                        );
                    }
                    break;
                }
            }
        }
        Err(e) => {
            println!("❌ Failed to create PriceQuoter: {:?}", e);
            return Err(format!("Failed to create PriceQuoter: {:?}", e).into());
        }
    }

    println!("\n🏁 Test completed!");

    Ok(())
}
