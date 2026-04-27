"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface NetworkToken {
  id: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  connections: number;
  tvl: number;
  isStable: boolean;
  category: 'blue-chip' | 'stablecoin' | 'defi' | 'gaming' | 'meme' | 'other';
}

export interface NetworkPool {
  id: string;
  name: string;
  tokenA: NetworkToken;
  tokenB: NetworkToken;
  dex: string;
  tvl: number;
  volume24h: number;
  fee: number;
  apy: number;
  utilization: number;
  reserve0: string;
  reserve1: string;
  protocolColor: string;
  isActive: boolean;
}

export interface NetworkConnection {
  from: string;
  to: string;
  weight: number;
  pools: NetworkPool[];
  volume: number;
  priceImpact: number;
}

export interface OptimalPath {
  id: string;
  from: NetworkToken;
  to: NetworkToken;
  route: NetworkToken[];
  hops: {
    tokenIn: NetworkToken;
    tokenOut: NetworkToken;
    pool: NetworkPool;
    priceImpact: number;
    fee: number;
  }[];
  totalPriceImpact: number;
  estimatedOutput: number;
  totalFees: number;
  gasEstimate: number;
  confidence: number;
  lastUpdated: Date;
  isOptimal: boolean;
}

export interface NetworkMetrics {
  totalNodes: number;
  totalEdges: number;
  avgConnectivity: number;
  networkDensity: number;
  centralityScore: number;
  liquidityDistribution: { [key: string]: number };
  volumeFlow: { [key: string]: number };
  priceCorrelations: { [key: string]: number };
}

interface NetworkRealTimeContextType {
  tokens: NetworkToken[];
  pools: NetworkPool[];
  connections: NetworkConnection[];
  optimalPaths: OptimalPath[];
  selectedToken: NetworkToken | null;
  selectedPath: OptimalPath | null;
  metrics: NetworkMetrics;
  isLoading: boolean;
  lastUpdated: Date | null;
  updateInterval: number;
  currentBlock: number;
  networkHealth: 'healthy' | 'warning' | 'critical';
  setSelectedToken: (token: NetworkToken | null) => void;
  setSelectedPath: (path: OptimalPath | null) => void;
  refreshNetworkData: () => Promise<void>;
  setUpdateInterval: (interval: number) => void;
  findOptimalPath: (fromToken: string, toToken: string) => OptimalPath | null;
  getTokenConnections: (tokenId: string) => NetworkConnection[];
}

const NetworkRealTimeContext = createContext<NetworkRealTimeContextType | null>(null);

export function useNetworkRealTime() {
  const context = useContext(NetworkRealTimeContext);
  if (!context) {
    throw new Error('useNetworkRealTime must be used within a NetworkRealTimeProvider');
  }
  return context;
}

// Mock data generators
const generateTokens = (blockNumber: number): NetworkToken[] => {
  const blockSeed = blockNumber % 1000;
  const random = (seed: number) => (Math.sin(seed * 12.9898 + 78.233) * 43758.5453123) % 1;
  const variation = () => 0.95 + (Math.abs(random(blockSeed)) * 0.1);

  return [
    // Blue Chip Tokens
    {
      id: 'eth',
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      price: 2316.43 * variation(),
      priceChange24h: -3.160703789200186 * variation(),
      volume24h: 20834579103 * variation(),
      marketCap: 279548970931 * variation(),
      connections: 147,
      tvl: 45000000000 * variation(),
      isStable: false,
      category: 'blue-chip'
    },
    {
      id: 'weth',
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
      price: 2316.43 * variation(),
      priceChange24h: -3.160703789200186 * variation(),
      volume24h: 20834579103 * variation(),
      marketCap: 279548970931 * variation(),
      connections: 234,
      tvl: 42000000000 * variation(),
      isStable: false,
      category: 'blue-chip'
    },
    {
      id: 'wbtc',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
      price: 77182 * variation(),
      priceChange24h: -0.9014817525263334 * variation(),
      volume24h: 229440384 * variation(),
      marketCap: 9161040542 * variation(),
      connections: 89,
      tvl: 3400000000 * variation(),
      isStable: false,
      category: 'blue-chip'
    },
    {
      id: 'bnb',
      symbol: 'BNB',
      name: 'BNB',
      address: '0xb8c77482e45f1f44de1745f52c74426c631bdd52',
      decimals: 18,
      price: 631.83 * variation(),
      priceChange24h: -1.616303272274612 * variation(),
      volume24h: 1176450709 * variation(),
      marketCap: 85161648718 * variation(),
      connections: 67,
      tvl: 2100000000 * variation(),
      isStable: false,
      category: 'blue-chip'
    },
    {
      id: 'matic',
      symbol: 'MATIC',
      name: 'Polygon',
      address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
      decimals: 18,
      price: 0.093123 * variation(),
      priceChange24h: -1.4313633611291665 * variation(),
      volume24h: 48729104 * variation(),
      marketCap: 989894097 * variation(),
      connections: 78,
      tvl: 1800000000 * variation(),
      isStable: false,
      category: 'blue-chip'
    },
    {
      id: 'avax',
      symbol: 'AVAX',
      name: 'Avalanche',
      address: '0x85f138bfee4ef8e540890cfb48f620571d67eda3',
      decimals: 18,
      price: 9.23 * variation(),
      priceChange24h: -3.6501557837144336 * variation(),
      volume24h: 237018802 * variation(),
      marketCap: 3984542961 * variation(),
      connections: 56,
      tvl: 1200000000 * variation(),
      isStable: false,
      category: 'blue-chip'
    },

    // Stablecoins
    {
      id: 'usdc',
      symbol: 'USDC',
      name: 'USDC',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      price: 0.99977 * variation(),
      priceChange24h: 0.042177443091488936 * variation(),
      volume24h: 16836357613 * variation(),
      marketCap: 78201491027 * variation(),
      connections: 189,
      tvl: 28000000000 * variation(),
      isStable: true,
      category: 'stablecoin'
    },
    {
      id: 'usdt',
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
      price: 1 * variation(),
      priceChange24h: 0.016561969962644363 * variation(),
      volume24h: 75355343949 * variation(),
      marketCap: 188839589651 * variation(),
      connections: 198,
      tvl: 35000000000 * variation(),
      isStable: true,
      category: 'stablecoin'
    },
    {
      id: 'dai',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      decimals: 18,
      price: 0.999668 * variation(),
      priceChange24h: 0.0004402546650617787 * variation(),
      volume24h: 273298394 * variation(),
      marketCap: 4422674319 * variation(),
      connections: 156,
      tvl: 12000000000 * variation(),
      isStable: true,
      category: 'stablecoin'
    },
    {
      id: 'frax',
      symbol: 'FRAX',
      name: 'Frax',
      address: '0x853d955acef822db058eb8505911ed77f175b99e',
      decimals: 18,
      price: 1.001 * variation(),
      priceChange24h: 0.05 * variation(),
      volume24h: 67000000 * variation(),
      marketCap: 1200000000 * variation(),
      connections: 94,
      tvl: 890000000 * variation(),
      isStable: true,
      category: 'stablecoin'
    },
    {
      id: 'busd',
      symbol: 'BUSD',
      name: 'Binance USD',
      address: '0x4fabb145d64652a948d72533023f6e7a623c7c53',
      decimals: 18,
      price: 1.000 * variation(),
      priceChange24h: -0.01 * variation(),
      volume24h: 234000000 * variation(),
      marketCap: 4500000000 * variation(),
      connections: 87,
      tvl: 3200000000 * variation(),
      isStable: true,
      category: 'stablecoin'
    },
    {
      id: 'lusd',
      symbol: 'LUSD',
      name: 'Liquity USD',
      address: '0x5f98805a4e8be255a32880fdec7f6728c6568ba0',
      decimals: 18,
      price: 1.002 * variation(),
      priceChange24h: 0.03 * variation(),
      volume24h: 23000000 * variation(),
      marketCap: 234000000 * variation(),
      connections: 34,
      tvl: 180000000 * variation(),
      isStable: true,
      category: 'stablecoin'
    },

    // DeFi Tokens
    {
      id: 'uni',
      symbol: 'UNI',
      name: 'Uniswap',
      address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      decimals: 18,
      price: 3.23 * variation(),
      priceChange24h: -4.692674162850327 * variation(),
      volume24h: 172631945 * variation(),
      marketCap: 2045611131 * variation(),
      connections: 167,
      tvl: 2100000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'link',
      symbol: 'LINK',
      name: 'Chainlink',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
      price: 9.19 * variation(),
      priceChange24h: -3.479801850450903 * variation(),
      volume24h: 296625084 * variation(),
      marketCap: 6682004244 * variation(),
      connections: 78,
      tvl: 1800000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'aave',
      symbol: 'AAVE',
      name: 'Aave',
      address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
      decimals: 18,
      price: 91.48 * variation(),
      priceChange24h: -2.1669424233502435 * variation(),
      volume24h: 316714541 * variation(),
      marketCap: 1389120746 * variation(),
      connections: 89,
      tvl: 890000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'comp',
      symbol: 'COMP',
      name: 'Compound',
      address: '0xc00e94cb662c3520282e6f5717214004a7f26888',
      decimals: 18,
      price: 45.67 * variation(),
      priceChange24h: -1.23 * variation(),
      volume24h: 34000000 * variation(),
      marketCap: 456000000 * variation(),
      connections: 67,
      tvl: 340000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'mkr',
      symbol: 'MKR',
      name: 'Maker',
      address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
      decimals: 18,
      price: 1234.56 * variation(),
      priceChange24h: 3.45 * variation(),
      volume24h: 23000000 * variation(),
      marketCap: 1200000000 * variation(),
      connections: 45,
      tvl: 560000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'crv',
      symbol: 'CRV',
      name: 'Curve DAO Token',
      address: '0xd533a949740bb3306d119cc777fa900ba034cd52',
      decimals: 18,
      price: 0.78 * variation(),
      priceChange24h: 1.89 * variation(),
      volume24h: 45000000 * variation(),
      marketCap: 890000000 * variation(),
      connections: 78,
      tvl: 670000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'bal',
      symbol: 'BAL',
      name: 'Balancer',
      address: '0xba100000625a3754423978a60c9317c58a424e3d',
      decimals: 18,
      price: 4.56 * variation(),
      priceChange24h: -0.67 * variation(),
      volume24h: 12000000 * variation(),
      marketCap: 234000000 * variation(),
      connections: 34,
      tvl: 180000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'sushi',
      symbol: 'SUSHI',
      name: 'SushiSwap',
      address: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
      decimals: 18,
      price: 1.23 * variation(),
      priceChange24h: 2.34 * variation(),
      volume24h: 34000000 * variation(),
      marketCap: 156000000 * variation(),
      connections: 56,
      tvl: 120000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'snx',
      symbol: 'SNX',
      name: 'Synthetix',
      address: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
      decimals: 18,
      price: 2.89 * variation(),
      priceChange24h: 4.56 * variation(),
      volume24h: 23000000 * variation(),
      marketCap: 890000000 * variation(),
      connections: 45,
      tvl: 340000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'yfi',
      symbol: 'YFI',
      name: 'yearn.finance',
      address: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
      decimals: 18,
      price: 6789.12 * variation(),
      priceChange24h: -2.34 * variation(),
      volume24h: 12000000 * variation(),
      marketCap: 234000000 * variation(),
      connections: 23,
      tvl: 89000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: '1inch',
      symbol: '1INCH',
      name: '1inch',
      address: '0x111111111117dc0aa78b770fa6a738034120c302',
      decimals: 18,
      price: 0.45 * variation(),
      priceChange24h: 1.23 * variation(),
      volume24h: 18000000 * variation(),
      marketCap: 456000000 * variation(),
      connections: 67,
      tvl: 230000000 * variation(),
      isStable: false,
      category: 'defi'
    },

    // Gaming Tokens
    {
      id: 'axs',
      symbol: 'AXS',
      name: 'Axie Infinity',
      address: '0xbb0e17ef65f82ab018d8edd776e8dd940327b28b',
      decimals: 18,
      price: 8.45 * variation(),
      priceChange24h: 5.67 * variation(),
      volume24h: 34000000 * variation(),
      marketCap: 890000000 * variation(),
      connections: 23,
      tvl: 120000000 * variation(),
      isStable: false,
      category: 'gaming'
    },
    {
      id: 'sand',
      symbol: 'SAND',
      name: 'The Sandbox',
      address: '0x3845badade8e6dff049820680d1f14bd3903a5d0',
      decimals: 18,
      price: 0.67 * variation(),
      priceChange24h: -2.34 * variation(),
      volume24h: 23000000 * variation(),
      marketCap: 1200000000 * variation(),
      connections: 34,
      tvl: 89000000 * variation(),
      isStable: false,
      category: 'gaming'
    },
    {
      id: 'mana',
      symbol: 'MANA',
      name: 'Decentraland',
      address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
      decimals: 18,
      price: 0.89 * variation(),
      priceChange24h: 3.45 * variation(),
      volume24h: 45000000 * variation(),
      marketCap: 1600000000 * variation(),
      connections: 45,
      tvl: 156000000 * variation(),
      isStable: false,
      category: 'gaming'
    },
    {
      id: 'enj',
      symbol: 'ENJ',
      name: 'Enjin Coin',
      address: '0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c',
      decimals: 18,
      price: 0.34 * variation(),
      priceChange24h: 1.23 * variation(),
      volume24h: 12000000 * variation(),
      marketCap: 340000000 * variation(),
      connections: 23,
      tvl: 45000000 * variation(),
      isStable: false,
      category: 'gaming'
    },

    // Meme Tokens
    {
      id: 'doge',
      symbol: 'DOGE',
      name: 'Dogecoin',
      address: '0x4206931337dc273a630d328da6441786bfad668f',
      decimals: 8,
      price: 0.089 * variation(),
      priceChange24h: 8.45 * variation(),
      volume24h: 234000000 * variation(),
      marketCap: 12000000000 * variation(),
      connections: 67,
      tvl: 890000000 * variation(),
      isStable: false,
      category: 'meme'
    },
    {
      id: 'shib',
      symbol: 'SHIB',
      name: 'Shiba Inu',
      address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
      decimals: 18,
      price: 0.0000089 * variation(),
      priceChange24h: 12.34 * variation(),
      volume24h: 156000000 * variation(),
      marketCap: 5200000000 * variation(),
      connections: 45,
      tvl: 340000000 * variation(),
      isStable: false,
      category: 'meme'
    },
    {
      id: 'pepe',
      symbol: 'PEPE',
      name: 'Pepe',
      address: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
      decimals: 18,
      price: 0.00000123 * variation(),
      priceChange24h: 23.45 * variation(),
      volume24h: 89000000 * variation(),
      marketCap: 890000000 * variation(),
      connections: 23,
      tvl: 120000000 * variation(),
      isStable: false,
      category: 'meme'
    },

    // Other/Layer 2 Tokens
    {
      id: 'arb',
      symbol: 'ARB',
      name: 'Arbitrum',
      address: '0x912ce59144191c1204e64559fe8253a0e49e6548',
      decimals: 18,
      price: 0.124065 * variation(),
      priceChange24h: -3.429646436419394 * variation(),
      volume24h: 108130179 * variation(),
      marketCap: 749619387 * variation(),
      connections: 56,
      tvl: 450000000 * variation(),
      isStable: false,
      category: 'other'
    },
    {
      id: 'op',
      symbol: 'OP',
      name: 'Optimism',
      address: '0x4200000000000000000000000000000000000042',
      decimals: 18,
      price: 0.118365 * variation(),
      priceChange24h: -7.132376216544289 * variation(),
      volume24h: 47932061 * variation(),
      marketCap: 254497511 * variation(),
      connections: 67,
      tvl: 670000000 * variation(),
      isStable: false,
      category: 'other'
    },
    {
      id: 'ldo',
      symbol: 'LDO',
      name: 'Lido DAO',
      address: '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
      decimals: 18,
      price: 2.89 * variation(),
      priceChange24h: 3.45 * variation(),
      volume24h: 34000000 * variation(),
      marketCap: 2600000000 * variation(),
      connections: 45,
      tvl: 890000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'rpl',
      symbol: 'RPL',
      name: 'Rocket Pool',
      address: '0xd33526068d116ce69f19a9ee46f0bd304f21a51f',
      decimals: 18,
      price: 23.45 * variation(),
      priceChange24h: 2.34 * variation(),
      volume24h: 12000000 * variation(),
      marketCap: 456000000 * variation(),
      connections: 23,
      tvl: 234000000 * variation(),
      isStable: false,
      category: 'defi'
    },
    {
      id: 'grt',
      symbol: 'GRT',
      name: 'The Graph',
      address: '0xc944e90c64b2c07662a292be6244bdf05cda44a7',
      decimals: 18,
      price: 0.156 * variation(),
      priceChange24h: 1.89 * variation(),
      volume24h: 23000000 * variation(),
      marketCap: 1500000000 * variation(),
      connections: 34,
      tvl: 340000000 * variation(),
      isStable: false,
      category: 'other'
    }
  ];
};

const generatePools = (tokens: NetworkToken[], blockNumber: number): NetworkPool[] => {
  const blockSeed = blockNumber % 1000;
  const random = (seed: number) => (Math.sin(seed * 12.9898 + 78.233) * 43758.5453123) % 1;
  const variation = () => 0.95 + (Math.abs(random(blockSeed)) * 0.1);

  const dexes = [
    { name: 'Uniswap V3', color: '#FF007A', fee: 0.05 },
    { name: 'Uniswap V2', color: '#FF007A', fee: 0.3 },
    { name: 'SushiSwap', color: '#FA52A0', fee: 0.3 },
    { name: 'Curve', color: '#40E0D0', fee: 0.04 },
    { name: 'Balancer', color: '#1E1E1E', fee: 0.1 },
    { name: '1inch', color: '#1FC7D4', fee: 0.1 },
    { name: 'PancakeSwap', color: '#D1884F', fee: 0.25 },
    { name: 'Trader Joe', color: '#E84142', fee: 0.3 },
    { name: 'Kyber', color: '#31CB9E', fee: 0.08 },
    { name: 'Bancor', color: '#000D2B', fee: 0.2 }
  ];

  const pools: NetworkPool[] = [];
  
  // Helper function to find token by symbol
  const findToken = (symbol: string) => tokens.find(t => t.symbol === symbol);
  
  // Major trading pairs - high liquidity pools
  const majorPairs = [
    // ETH pairs
    ['ETH', 'WETH'], ['WETH', 'USDC'], ['WETH', 'USDT'], ['WETH', 'DAI'],
    ['WETH', 'WBTC'], ['WETH', 'UNI'], ['WETH', 'LINK'], ['WETH', 'AAVE'],
    ['WETH', 'MATIC'], ['WETH', 'AVAX'], ['WETH', 'BNB'], ['WETH', 'CRV'],
    
    // Stablecoin pairs
    ['USDC', 'USDT'], ['USDC', 'DAI'], ['USDC', 'FRAX'], ['USDC', 'BUSD'],
    ['USDT', 'DAI'], ['USDT', 'FRAX'], ['DAI', 'FRAX'], ['DAI', 'LUSD'],
    ['USDC', 'LUSD'], ['BUSD', 'FRAX'],
    
    // BTC pairs
    ['WBTC', 'USDC'], ['WBTC', 'USDT'], ['WBTC', 'DAI'],
    
    // DeFi pairs
    ['UNI', 'USDC'], ['LINK', 'USDC'], ['AAVE', 'USDC'], ['COMP', 'USDC'],
    ['MKR', 'USDC'], ['CRV', 'USDC'], ['BAL', 'USDC'], ['SUSHI', 'USDC'],
    ['SNX', 'USDC'], ['YFI', 'USDC'], ['1INCH', 'USDC'], ['LDO', 'USDC'],
    
    // Cross-DeFi pairs
    ['UNI', 'LINK'], ['AAVE', 'COMP'], ['CRV', 'BAL'], ['SUSHI', 'UNI'],
    ['MKR', 'AAVE'], ['SNX', 'LINK'], ['YFI', 'COMP'], ['LDO', 'RPL'],
    
    // Gaming pairs
    ['AXS', 'USDC'], ['SAND', 'USDC'], ['MANA', 'USDC'], ['ENJ', 'USDC'],
    ['AXS', 'WETH'], ['SAND', 'WETH'], ['MANA', 'WETH'],
    
    // Meme pairs
    ['DOGE', 'USDC'], ['SHIB', 'USDC'], ['PEPE', 'USDC'],
    ['DOGE', 'WETH'], ['SHIB', 'WETH'], ['PEPE', 'WETH'],
    
    // Layer 2 pairs
    ['ARB', 'USDC'], ['OP', 'USDC'], ['ARB', 'WETH'], ['OP', 'WETH'],
    ['MATIC', 'USDC'], ['AVAX', 'USDC'], ['BNB', 'USDC'],
    
    // Additional cross pairs
    ['MATIC', 'LINK'], ['AVAX', 'AAVE'], ['BNB', 'UNI'], ['ARB', 'OP'],
    ['GRT', 'USDC'], ['GRT', 'WETH'], ['RPL', 'WETH'], ['RPL', 'USDC']
  ];

  // Create pools for major pairs across multiple DEXs
  majorPairs.forEach((pair, index) => {
    const tokenA = findToken(pair[0]);
    const tokenB = findToken(pair[1]);
    
    if (tokenA && tokenB) {
      // Create 1-3 pools per pair on different DEXs
      const numPools = Math.floor(Math.abs(random(blockSeed + index)) * 3) + 1;
      
      for (let i = 0; i < numPools; i++) {
        const dex = dexes[(index + i) % dexes.length];
        const poolIndex = index * 10 + i;
        
        // Adjust TVL based on token categories and pair importance
        let baseTvl = 10000000; // 10M base
        if (tokenA.category === 'blue-chip' || tokenB.category === 'blue-chip') baseTvl *= 5;
        if (tokenA.category === 'stablecoin' && tokenB.category === 'stablecoin') baseTvl *= 3;
        if (tokenA.symbol === 'WETH' || tokenB.symbol === 'WETH') baseTvl *= 2;
        
        pools.push({
          id: `pool-${tokenA.symbol.toLowerCase()}-${tokenB.symbol.toLowerCase()}-${dex.name.toLowerCase().replace(/\s+/g, '')}-${i}`,
          name: `${tokenA.symbol}/${tokenB.symbol}`,
          tokenA,
          tokenB,
          dex: dex.name,
          tvl: (baseTvl + Math.abs(random(blockSeed + poolIndex)) * baseTvl * 2) * variation(),
          volume24h: (baseTvl * 0.1 + Math.abs(random(blockSeed + poolIndex + 1)) * baseTvl * 0.5) * variation(),
          fee: dex.fee + (Math.abs(random(blockSeed + poolIndex + 2)) * 0.1),
          apy: (3 + Math.abs(random(blockSeed + poolIndex + 3)) * 25) * variation(),
          utilization: (40 + Math.abs(random(blockSeed + poolIndex + 4)) * 50) * variation(),
          reserve0: ((1000 + Math.abs(random(blockSeed + poolIndex + 5)) * 50000) * Math.pow(10, tokenA.decimals)).toString(),
          reserve1: ((1000 + Math.abs(random(blockSeed + poolIndex + 6)) * 50000) * Math.pow(10, tokenB.decimals)).toString(),
          protocolColor: dex.color,
          isActive: Math.abs(random(blockSeed + poolIndex + 7)) > 0.05 // 95% active
        });
      }
    }
  });

  // Add some exotic/long-tail pairs for network complexity
  const exoticPairs = [
    ['YFI', 'MKR'], ['COMP', 'BAL'], ['SNX', 'CRV'], ['SUSHI', '1INCH'],
    ['AXS', 'SAND'], ['MANA', 'ENJ'], ['DOGE', 'SHIB'], ['PEPE', 'SHIB'],
    ['ARB', 'LDO'], ['OP', 'GRT'], ['RPL', 'LDO'], ['AVAX', 'MATIC'],
    ['BNB', 'AVAX'], ['LINK', 'GRT'], ['AAVE', 'SNX'], ['UNI', 'CRV']
  ];

  exoticPairs.forEach((pair, index) => {
    const tokenA = findToken(pair[0]);
    const tokenB = findToken(pair[1]);
    
    if (tokenA && tokenB) {
      const dex = dexes[index % dexes.length];
      const poolIndex = majorPairs.length * 10 + index;
      
      pools.push({
        id: `pool-exotic-${tokenA.symbol.toLowerCase()}-${tokenB.symbol.toLowerCase()}-${index}`,
        name: `${tokenA.symbol}/${tokenB.symbol}`,
        tokenA,
        tokenB,
        dex: dex.name,
        tvl: (1000000 + Math.abs(random(blockSeed + poolIndex)) * 10000000) * variation(), // Lower TVL for exotic pairs
        volume24h: (100000 + Math.abs(random(blockSeed + poolIndex + 1)) * 2000000) * variation(),
        fee: dex.fee + (Math.abs(random(blockSeed + poolIndex + 2)) * 0.2),
        apy: (10 + Math.abs(random(blockSeed + poolIndex + 3)) * 40) * variation(), // Higher APY for exotic pairs
        utilization: (20 + Math.abs(random(blockSeed + poolIndex + 4)) * 60) * variation(),
        reserve0: ((100 + Math.abs(random(blockSeed + poolIndex + 5)) * 5000) * Math.pow(10, tokenA.decimals)).toString(),
        reserve1: ((100 + Math.abs(random(blockSeed + poolIndex + 6)) * 5000) * Math.pow(10, tokenB.decimals)).toString(),
        protocolColor: dex.color,
        isActive: Math.abs(random(blockSeed + poolIndex + 7)) > 0.1 // 90% active for exotic pairs
      });
    }
  });

  return pools;
};

const generateConnections = (tokens: NetworkToken[], pools: NetworkPool[]): NetworkConnection[] => {
  const connections: NetworkConnection[] = [];
  
  tokens.forEach(tokenA => {
    tokens.forEach(tokenB => {
      if (tokenA.id !== tokenB.id) {
        const relevantPools = pools.filter(pool => 
          (pool.tokenA.id === tokenA.id && pool.tokenB.id === tokenB.id) ||
          (pool.tokenA.id === tokenB.id && pool.tokenB.id === tokenA.id)
        );
        
        if (relevantPools.length > 0) {
          const totalVolume = relevantPools.reduce((sum, pool) => sum + pool.volume24h, 0);
          const avgPriceImpact = relevantPools.reduce((sum, pool) => sum + (pool.volume24h / pool.tvl * 100), 0) / relevantPools.length;
          
          connections.push({
            from: tokenA.id,
            to: tokenB.id,
            weight: Math.min(totalVolume / 1000000, 100), // Normalize weight
            pools: relevantPools,
            volume: totalVolume,
            priceImpact: avgPriceImpact
          });
        }
      }
    });
  });
  
  return connections;
};

const generateOptimalPaths = (tokens: NetworkToken[], pools: NetworkPool[]): OptimalPath[] => {
  const paths: OptimalPath[] = [];
  
  // Generate some key paths
  const pathConfigs = [
    { from: 'eth', to: 'usdc', route: ['eth', 'weth', 'usdc'] },
    { from: 'eth', to: 'dai', route: ['eth', 'weth', 'dai'] },
    { from: 'wbtc', to: 'usdc', route: ['wbtc', 'weth', 'usdc'] },
    { from: 'uni', to: 'dai', route: ['uni', 'weth', 'dai'] },
    { from: 'link', to: 'usdc', route: ['link', 'weth', 'usdc'] }
  ];
  
  pathConfigs.forEach((config, index) => {
    const fromToken = tokens.find(t => t.id === config.from);
    const toToken = tokens.find(t => t.id === config.to);
    const routeTokens = config.route.map(id => tokens.find(t => t.id === id)).filter(Boolean) as NetworkToken[];
    
    if (fromToken && toToken && routeTokens.length >= 2) {
      const hops = [];
      for (let i = 0; i < routeTokens.length - 1; i++) {
        const tokenIn = routeTokens[i];
        const tokenOut = routeTokens[i + 1];
        const relevantPool = pools.find(pool => 
          (pool.tokenA.id === tokenIn.id && pool.tokenB.id === tokenOut.id) ||
          (pool.tokenA.id === tokenOut.id && pool.tokenB.id === tokenIn.id)
        );
        
        if (relevantPool) {
          hops.push({
            tokenIn,
            tokenOut,
            pool: relevantPool,
            priceImpact: Math.random() * 2,
            fee: relevantPool.fee
          });
        }
      }
      
      if (hops.length > 0) {
        paths.push({
          id: `path-${index}`,
          from: fromToken,
          to: toToken,
          route: routeTokens,
          hops,
          totalPriceImpact: hops.reduce((sum, hop) => sum + hop.priceImpact, 0),
          estimatedOutput: 1000 * (0.95 + Math.random() * 0.1),
          totalFees: hops.reduce((sum, hop) => sum + hop.fee, 0),
          gasEstimate: 150000 + Math.random() * 200000,
          confidence: 85 + Math.random() * 15,
          lastUpdated: new Date(),
          isOptimal: index === 0
        });
      }
    }
  });
  
  return paths;
};

const calculateMetrics = (tokens: NetworkToken[], connections: NetworkConnection[]): NetworkMetrics => {
  const totalNodes = tokens.length;
  const totalEdges = connections.length;
  const avgConnectivity = totalEdges / totalNodes;
  const maxPossibleEdges = totalNodes * (totalNodes - 1) / 2;
  const networkDensity = totalEdges / maxPossibleEdges;
  
  // Calculate centrality score (simplified)
  const centralityScore = tokens.reduce((sum, token) => {
    const tokenConnections = connections.filter(c => c.from === token.id || c.to === token.id);
    return sum + tokenConnections.length;
  }, 0) / totalNodes;
  
  // Liquidity distribution
  const liquidityDistribution: { [key: string]: number } = {};
  tokens.forEach(token => {
    liquidityDistribution[token.symbol] = token.tvl;
  });
  
  // Volume flow
  const volumeFlow: { [key: string]: number } = {};
  tokens.forEach(token => {
    volumeFlow[token.symbol] = token.volume24h;
  });
  
  // Price correlations (simplified)
  const priceCorrelations: { [key: string]: number } = {};
  tokens.forEach(token => {
    priceCorrelations[token.symbol] = Math.random() * 2 - 1; // Random correlation for demo
  });
  
  return {
    totalNodes,
    totalEdges,
    avgConnectivity,
    networkDensity,
    centralityScore,
    liquidityDistribution,
    volumeFlow,
    priceCorrelations
  };
};

interface NetworkRealTimeProviderProps {
  children: React.ReactNode;
  initialUpdateInterval?: number;
}

export function NetworkRealTimeProvider({ children, initialUpdateInterval = 8000 }: NetworkRealTimeProviderProps) {
  const [tokens, setTokens] = useState<NetworkToken[]>([]);
  const [pools, setPools] = useState<NetworkPool[]>([]);
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [optimalPaths, setOptimalPaths] = useState<OptimalPath[]>([]);
  const [selectedToken, setSelectedToken] = useState<NetworkToken | null>(null);
  const [selectedPath, setSelectedPath] = useState<OptimalPath | null>(null);
  const [metrics, setMetrics] = useState<NetworkMetrics>({
    totalNodes: 0,
    totalEdges: 0,
    avgConnectivity: 0,
    networkDensity: 0,
    centralityScore: 0,
    liquidityDistribution: {},
    volumeFlow: {},
    priceCorrelations: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updateInterval, setUpdateInterval] = useState(initialUpdateInterval);
  const [currentBlock, setCurrentBlock] = useState(18500000);

  const refreshNetworkData = useCallback(async () => {
    setIsLoading(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const newTokens = generateTokens(currentBlock);
    const newPools = generatePools(newTokens, currentBlock);
    const newConnections = generateConnections(newTokens, newPools);
    const newOptimalPaths = generateOptimalPaths(newTokens, newPools);
    const newMetrics = calculateMetrics(newTokens, newConnections);
    
    setTokens(newTokens);
    setPools(newPools);
    setConnections(newConnections);
    setOptimalPaths(newOptimalPaths);
    setMetrics(newMetrics);
    setLastUpdated(new Date());
    setCurrentBlock(prev => prev + 1);
    setIsLoading(false);
  }, [currentBlock]);

  const findOptimalPath = useCallback((fromToken: string, toToken: string): OptimalPath | null => {
    return optimalPaths.find(path => path.from.id === fromToken && path.to.id === toToken) || null;
  }, [optimalPaths]);

  const getTokenConnections = useCallback((tokenId: string): NetworkConnection[] => {
    return connections.filter(conn => conn.from === tokenId || conn.to === tokenId);
  }, [connections]);

  const networkHealth: 'healthy' | 'warning' | 'critical' = 
    metrics.networkDensity > 0.3 ? 'healthy' : 
    metrics.networkDensity > 0.15 ? 'warning' : 'critical';

  // Initial load
  useEffect(() => {
    refreshNetworkData();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (updateInterval > 0) {
      const interval = setInterval(refreshNetworkData, updateInterval);
      return () => clearInterval(interval);
    }
  }, [updateInterval, refreshNetworkData]);

  const contextValue: NetworkRealTimeContextType = {
    tokens,
    pools,
    connections,
    optimalPaths,
    selectedToken,
    selectedPath,
    metrics,
    isLoading,
    lastUpdated,
    updateInterval,
    currentBlock,
    networkHealth,
    setSelectedToken,
    setSelectedPath,
    refreshNetworkData,
    setUpdateInterval,
    findOptimalPath,
    getTokenConnections
  };

  return (
    <NetworkRealTimeContext.Provider value={contextValue}>
      {children}
    </NetworkRealTimeContext.Provider>
  );
} 
