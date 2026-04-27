//! Handles Tycho Indexer stream, pool/token state, and ingestion.

use crate::env_loader::redact_secret;
use crate::types::{TokenMetadata, TokenUniverseFilter, TokenUniverseProvider, TokenUniverseStats};
use async_trait::async_trait;
use chrono::Utc;
use futures::StreamExt;
use rust_decimal::Decimal;
use rustc_hash::FxHashMap;
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::mpsc;
use tycho_simulation::{
    evm::{
        engine_db::tycho_db::PreCachedDB,
        protocol::{
            ekubo::state::EkuboState,
            ekubo_v3::{self, state::EkuboV3State},
            filters::{balancer_v2_pool_filter, curve_pool_filter},
            pancakeswap_v2::state::PancakeswapV2State,
            uniswap_v2::state::UniswapV2State,
            uniswap_v3::state::UniswapV3State,
            uniswap_v4::state::UniswapV4State,
            vm::state::EVMPoolState,
        },
        stream::ProtocolStreamBuilder,
    },
    protocol::models::{ProtocolComponent, Update},
    tycho_client::feed::component_tracker::ComponentFilter,
    tycho_common::{
        models::{token::Token, Chain},
        simulation::protocol_sim::ProtocolSim,
    },
};

pub type UpdateCallback = Box<dyn Fn(&Update) + Send + Sync>;

/// Events emitted by the ComponentTracker
#[derive(Debug, Clone)]
pub enum TrackerEvent {
    Initialized(u64),             // Stream initialized with block number
    NewUpdate(u64, usize, usize), // Block number, new pools, updated states
    Error(String),                // Error message
}

/// Tracks all pools and tokens by ingesting Tycho Indexer stream.
#[derive(Clone)]
pub struct ComponentTracker {
    pub all_pools: Arc<RwLock<FxHashMap<String, ProtocolComponent>>>,
    pub pool_states: Arc<RwLock<FxHashMap<String, Box<dyn ProtocolSim + Send + Sync>>>>,
    pub all_tokens: Arc<RwLock<FxHashMap<tycho_simulation::tycho_common::Bytes, Token>>>,
    callbacks: Arc<Mutex<Vec<UpdateCallback>>>,

    // Token universe tracking
    pub token_metadata:
        Arc<RwLock<FxHashMap<tycho_simulation::tycho_common::Bytes, TokenMetadata>>>,
    pub universe_stats: Arc<RwLock<TokenUniverseStats>>,

    // Stream state
    pub initialized: Arc<RwLock<bool>>,
    pub event_sender: Arc<Mutex<Option<mpsc::UnboundedSender<TrackerEvent>>>>,
}

impl ComponentTracker {
    /// Create a new, empty tracker.
    pub fn new() -> Self {
        Self {
            all_pools: Arc::new(RwLock::new(FxHashMap::default())),
            pool_states: Arc::new(RwLock::new(FxHashMap::default())),
            all_tokens: Arc::new(RwLock::new(FxHashMap::default())),
            callbacks: Arc::new(Mutex::new(Vec::new())),
            token_metadata: Arc::new(RwLock::new(FxHashMap::default())),
            universe_stats: Arc::new(RwLock::new(TokenUniverseStats {
                total_tokens: 0,
                tokens_with_tvl: 0,
                tokens_with_volume: 0,
                total_tvl: Decimal::ZERO,
                total_volume_24h: Decimal::ZERO,
                last_updated: Utc::now(),
                memory_usage_bytes: 0,
            })),
            initialized: Arc::new(RwLock::new(false)),
            event_sender: Arc::new(Mutex::new(None)),
        }
    }

    /// Register a callback to be called on every Tycho stream update.
    pub fn register_callback<F>(&self, cb: F)
    where
        F: Fn(&Update) + Send + Sync + 'static,
    {
        self.callbacks.lock().unwrap().push(Box::new(cb));
    }

    /// Notify all registered callbacks.
    fn notify_callbacks(&self, update: &Update) {
        for cb in self.callbacks.lock().unwrap().iter() {
            cb(update);
        }
    }

    /// Start the Tycho stream and return an event receiver
    /// This properly consumes the stream in a spawned task like the working orderbook SDK
    pub async fn stream_updates(
        &self,
        tycho_url: &str,
        chain: Chain,
        api_key: &str,
        tvl_threshold: f64,
    ) -> anyhow::Result<mpsc::UnboundedReceiver<TrackerEvent>> {
        use tracing::info;
        use tycho_simulation::utils::load_all_tokens;

        println!("🚀 DEBUG: Starting Tycho Indexer connection...");
        info!("🔄 Starting data ingestion from Tycho API...");
        info!("📡 Tycho URL: {}", tycho_url);
        info!("🔑 API Key: {}", redact_secret(api_key));
        info!("💰 TVL Threshold: {} ETH", tvl_threshold);

        // Load all tokens first
        println!("📥 Loading tokens from Tycho...");
        let all_tokens =
            load_all_tokens(tycho_url, false, Some(api_key), true, chain, None, None).await?;

        println!("✅ Loaded {} tokens", all_tokens.len());
        info!("✅ Loaded {} tokens", all_tokens.len());
        *self.all_tokens.write().unwrap() = all_tokens.clone().into_iter().collect();

        // Use the provided TVL threshold
        let tvl_filter = ComponentFilter::with_tvl_range(tvl_threshold, f64::INFINITY);
        info!("🎯 Using TVL threshold: {} ETH", tvl_threshold);

        // Build protocol stream following the working orderbook SDK pattern
        println!("🏗️  Building protocol stream...");
        info!("🏗️  Building protocol stream...");

        // Add timeout to prevent hanging
        let build_timeout = std::time::Duration::from_secs(30);
        println!("⏱️  Setting 30-second timeout for protocol stream building...");

        let protocol_stream_result = tokio::time::timeout(build_timeout, async {
            // Build the protocol stream with ALL protocols like the quickstart
            let mut builder = ProtocolStreamBuilder::new(tycho_url, chain);

            match chain {
                Chain::Ethereum => {
                    builder = builder
                        .exchange::<UniswapV2State>("uniswap_v2", tvl_filter.clone(), None)
                        .exchange::<UniswapV2State>("sushiswap_v2", tvl_filter.clone(), None)
                        .exchange::<PancakeswapV2State>("pancakeswap_v2", tvl_filter.clone(), None)
                        .exchange::<UniswapV3State>("uniswap_v3", tvl_filter.clone(), None)
                        .exchange::<UniswapV3State>("pancakeswap_v3", tvl_filter.clone(), None)
                        .exchange::<EVMPoolState<PreCachedDB>>(
                            "vm:balancer_v2",
                            tvl_filter.clone(),
                            Some(balancer_v2_pool_filter),
                        )
                        .exchange::<UniswapV4State>("uniswap_v4", tvl_filter.clone(), None)
                        .exchange::<UniswapV4State>("uniswap_v4_hooks", tvl_filter.clone(), None)
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
                    // For other chains, at least add basic protocols
                    builder = builder
                        .exchange::<UniswapV2State>("uniswap_v2", tvl_filter.clone(), None)
                        .exchange::<UniswapV3State>("uniswap_v3", tvl_filter.clone(), None);
                }
            }

            builder
                .auth_key(Some(api_key.to_string()))
                .skip_state_decode_failures(true)
                .set_tokens(all_tokens)
                .await
                .build()
                .await
        })
        .await;

        let protocol_stream = match protocol_stream_result {
            Ok(Ok(stream)) => {
                println!("✅ Protocol stream built successfully!");
                info!("✅ Protocol stream built successfully!");
                stream
            }
            Ok(Err(e)) => {
                println!("❌ Protocol stream build failed: {:?}", e);
                return Err(anyhow::anyhow!("Protocol stream build failed: {:?}", e));
            }
            Err(_) => {
                println!("⏰ Protocol stream build timed out after 30 seconds");
                return Err(anyhow::anyhow!(
                    "Protocol stream build timed out after 30 seconds"
                ));
            }
        };

        // Create event channel
        let (event_tx, event_rx) = mpsc::unbounded_channel();
        *self.event_sender.lock().unwrap() = Some(event_tx.clone());

        // Clone the tracker components for the spawned task
        let tracker_for_task = self.clone();

        // Spawn task to consume the stream continuously (like the orderbook SDK)
        tokio::spawn(async move {
            println!("🚀 Starting stream consumption task...");
            info!("🚀 Stream consumption task started");

            // Pin the stream for continuous consumption
            futures::pin_mut!(protocol_stream);

            let mut message_count = 0;
            let start_time = std::time::Instant::now();
            let mut is_initialized = false;
            let mut last_log_time = std::time::Instant::now();

            println!("📡 Waiting for messages from Tycho stream...");

            // Continuously consume the stream like the working orderbook SDK
            while let Some(msg) = protocol_stream.next().await {
                // Log every 5 seconds if no messages received
                if message_count == 0 && last_log_time.elapsed().as_secs() >= 5 {
                    println!(
                        "⏳ Still waiting for first message... ({}s elapsed)",
                        start_time.elapsed().as_secs()
                    );
                    last_log_time = std::time::Instant::now();
                }

                if message_count == 0 {
                    println!(
                        "🎉 SUCCESS: Received first message after {:.2}s!",
                        start_time.elapsed().as_secs_f64()
                    );
                }
                message_count += 1;
                println!("📨 Processing message #{}", message_count);

                match msg {
                    Ok(update) => {
                        println!("✅ Message parsed successfully as BlockUpdate");
                        info!("🔄 RECEIVED UPDATE from Tycho API:");
                        info!("   - Block: {}", update.block_number_or_timestamp);
                        info!("   - New pools: {}", update.new_pairs.len());
                        info!("   - Removed pools: {}", update.removed_pairs.len());
                        info!("   - Pool states: {}", update.states.len());

                        // Log detailed info about each new pool
                        for (id, comp) in update.new_pairs.iter() {
                            info!("📊 NEW POOL: {}", id);
                            info!("   - Protocol: {}", comp.protocol_system);
                            info!("   - Tokens: {}", comp.tokens.len());
                            for (i, token) in comp.tokens.iter().enumerate() {
                                info!("     Token {}: {} ({})", i, token.symbol, token.address);
                            }
                        }

                        // Update internal state
                        {
                            let mut pools_w = tracker_for_task.all_pools.write().unwrap();
                            let mut states_w = tracker_for_task.pool_states.write().unwrap();

                            let pools_before = pools_w.len();
                            let states_before = states_w.len();

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

                            let pools_after = pools_w.len();
                            let states_after = states_w.len();

                            info!("📈 UPDATE COMPLETE:");
                            info!(
                                "   - Pools: {} -> {} (net: +{})",
                                pools_before,
                                pools_after,
                                pools_after as i32 - pools_before as i32
                            );
                            info!(
                                "   - States: {} -> {} (net: +{})",
                                states_before,
                                states_after,
                                states_after as i32 - states_before as i32
                            );

                            // Log target token analysis
                            let weth_pools: Vec<_> = pools_w
                                .iter()
                                .filter(|(_, pool)| {
                                    pool.tokens.iter().any(|t| {
                                        t.address.to_string().to_lowercase()
                                            == "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
                                    })
                                })
                                .map(|(id, _)| id.clone())
                                .collect();
                            let usdt_pools: Vec<_> = pools_w
                                .iter()
                                .filter(|(_, pool)| {
                                    pool.tokens.iter().any(|t| {
                                        t.address.to_string().to_lowercase()
                                            == "0xdac17f958d2ee523a2206206994597c13d831ec7"
                                    })
                                })
                                .map(|(id, _)| id.clone())
                                .collect();

                            info!("🎯 TARGET TOKEN ANALYSIS:");
                            info!("   - Pools with WETH: {} pools", weth_pools.len());
                            info!("   - Pools with USDT: {} pools", usdt_pools.len());
                        }

                        // Update initialized status on first message
                        if !is_initialized {
                            *tracker_for_task.initialized.write().unwrap() = true;
                            is_initialized = true;
                            println!(
                                "✅ Tracker initialized with {} pools",
                                update.new_pairs.len()
                            );
                            let _ = event_tx
                                .send(TrackerEvent::Initialized(update.block_number_or_timestamp));
                        }

                        // Notify callbacks
                        tracker_for_task.notify_callbacks(&update);

                        // Send event
                        let _ = event_tx.send(TrackerEvent::NewUpdate(
                            update.block_number_or_timestamp,
                            update.new_pairs.len(),
                            update.states.len(),
                        ));

                        println!("✅ Update processed successfully");
                    }
                    Err(e) => {
                        println!("❌ Failed to parse message: {:?}", e);
                        let error_msg = format!("Stream error: {:?}", e);
                        let _ = event_tx.send(TrackerEvent::Error(error_msg));
                    }
                }
            }

            println!("🔚 Stream ended");
            info!("🔚 Tycho stream ended");
        });

        println!("🚀 Stream task spawned, returning event receiver");
        Ok(event_rx)
    }

    /// Check if the tracker has been initialized with data
    pub fn is_initialized(&self) -> bool {
        *self.initialized.read().unwrap()
    }

    /// Get the current pool count
    pub fn pool_count(&self) -> usize {
        self.all_pools.read().unwrap().len()
    }

    /// Get the current state count
    pub fn state_count(&self) -> usize {
        self.pool_states.read().unwrap().len()
    }

    /// Get tokens filtered by TVL and transaction volume criteria
    pub async fn get_filtered_tokens(&self, filter: &TokenUniverseFilter) -> Vec<TokenMetadata> {
        let metadata_guard = self.token_metadata.read().unwrap();
        let mut filtered_tokens: Vec<TokenMetadata> = metadata_guard
            .values()
            .filter(|token| {
                // Apply TVL filter
                if let Some(min_tvl) = filter.min_tvl {
                    if let Some(tvl) = token.total_value_locked {
                        if tvl < min_tvl {
                            return false;
                        }
                    } else {
                        return false; // Exclude tokens without TVL data
                    }
                }

                // Apply volume filter
                if let Some(min_volume) = filter.min_daily_volume {
                    if let Some(volume) = token.daily_volume {
                        if volume < min_volume {
                            return false;
                        }
                    } else {
                        return false; // Exclude tokens without volume data
                    }
                }

                // Apply transaction count filter
                if let Some(min_tx_count) = filter.min_thirty_day_tx_count {
                    if let Some(tx_count) = token.thirty_day_tx_count {
                        if tx_count < min_tx_count {
                            return false;
                        }
                    } else {
                        return false; // Exclude tokens without transaction data
                    }
                }

                // TODO: Add stablecoin and governance token filtering logic
                true
            })
            .cloned()
            .collect();

        // Sort by TVL descending, then by volume
        filtered_tokens.sort_by(|a, b| {
            let tvl_cmp = b
                .total_value_locked
                .unwrap_or(Decimal::ZERO)
                .cmp(&a.total_value_locked.unwrap_or(Decimal::ZERO));
            if tvl_cmp == std::cmp::Ordering::Equal {
                b.daily_volume
                    .unwrap_or(Decimal::ZERO)
                    .cmp(&a.daily_volume.unwrap_or(Decimal::ZERO))
            } else {
                tvl_cmp
            }
        });

        // Apply max tokens limit
        if let Some(max_tokens) = filter.max_tokens {
            filtered_tokens.truncate(max_tokens);
        }

        filtered_tokens
    }

    /// Update token metadata with TVL and volume information
    pub async fn update_token_universe(&self, metadata_updates: &[TokenMetadata]) {
        let mut metadata_guard = self.token_metadata.write().unwrap();
        let mut stats_guard = self.universe_stats.write().unwrap();

        for metadata in metadata_updates {
            metadata_guard.insert(metadata.address.clone(), metadata.clone());
        }

        // Recalculate universe statistics
        let total_tokens = metadata_guard.len();
        let tokens_with_tvl = metadata_guard
            .values()
            .filter(|t| t.total_value_locked.is_some())
            .count();
        let tokens_with_volume = metadata_guard
            .values()
            .filter(|t| t.daily_volume.is_some())
            .count();
        let total_tvl = metadata_guard
            .values()
            .filter_map(|t| t.total_value_locked)
            .sum();
        let total_volume_24h = metadata_guard.values().filter_map(|t| t.daily_volume).sum();

        // Estimate memory usage (rough calculation)
        let memory_usage_bytes = total_tokens * 200; // ~200 bytes per token metadata

        *stats_guard = TokenUniverseStats {
            total_tokens,
            tokens_with_tvl,
            tokens_with_volume,
            total_tvl,
            total_volume_24h,
            last_updated: Utc::now(),
            memory_usage_bytes,
        };
    }

    /// Refresh token metadata from external sources (mock implementation)
    pub async fn refresh_token_metadata(
        &self,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // This is a placeholder for real implementation that would:
        // 1. Query DeFi data providers (DefiLlama, CoinGecko, etc.)
        // 2. Calculate TVL from on-chain data
        // 3. Fetch transaction counts from blockchain indexers

        // For now, generate mock data for existing tokens
        let token_addresses: Vec<_> = self.all_tokens.read().unwrap().keys().cloned().collect();
        let mut mock_metadata = Vec::new();

        for (i, address) in token_addresses.iter().enumerate().take(1000) {
            // Limit for performance
            let metadata = TokenMetadata {
                address: address.clone(),
                symbol: format!("TOKEN{}", i),
                name: format!("Token {}", i),
                decimals: 18,
                chain_id: 1,           // Ethereum mainnet
                last_updated_block: 0, // Mock block number
                total_value_locked: Some(Decimal::from(1_000_000 + i * 100_000)), // Mock TVL
                daily_volume: Some(Decimal::from(50_000 + i * 10_000)), // Mock volume
                market_cap: Some(Decimal::from(10_000_000 + i * 1_000_000)), // Mock market cap
                thirty_day_tx_count: Some(1000 + (i * 500) as u64), // Mock tx count
                is_verified: true,     // Mock: assume verified
                is_stablecoin: false,  // Mock: assume not stablecoin
                is_governance_token: false, // Mock: assume not governance token
                price_usd: Some(Decimal::from(100 + i)), // Mock price
                tags: vec!["defi".to_string(), "erc20".to_string()], // Mock tags
                last_updated: Utc::now(),
            };
            mock_metadata.push(metadata);
        }

        self.update_token_universe(&mock_metadata).await;
        Ok(())
    }
}

impl Default for ComponentTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Implement TokenUniverseProvider for ComponentTracker
#[async_trait]
impl TokenUniverseProvider for ComponentTracker {
    async fn get_token_universe(
        &self,
        filter: &TokenUniverseFilter,
    ) -> crate::types::Result<Vec<TokenMetadata>> {
        Ok(self.get_filtered_tokens(filter).await)
    }

    async fn get_token_metadata(
        &self,
        token_address: &tycho_simulation::tycho_common::Bytes,
    ) -> crate::types::Result<Option<TokenMetadata>> {
        let metadata_guard = self.token_metadata.read().unwrap();
        Ok(metadata_guard.get(token_address).cloned())
    }

    async fn update_token_metadata(&self, metadata: &[TokenMetadata]) -> crate::types::Result<()> {
        self.update_token_universe(metadata).await;
        Ok(())
    }

    async fn get_universe_stats(&self) -> crate::types::Result<TokenUniverseStats> {
        let stats_guard = self.universe_stats.read().unwrap();
        Ok(stats_guard.clone())
    }
    // TODO: Add callback registration, graph update hooks, etc.
}
