"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PricePath } from '@/types/price-quoter';

interface RealTimeContextType {
  paths: PricePath[];
  selectedPath: PricePath | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  updateInterval: number;
  currentBlock: number;
  setSelectedPath: (path: PricePath | null) => void;
  refreshPaths: () => Promise<void>;
  setUpdateInterval: (interval: number) => void;
}

const RealTimeContext = createContext<RealTimeContextType | null>(null);

export function useRealTime() {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
}

// Available DEX options for different hops
const AVAILABLE_DEXES = [
  { name: 'Uniswap V3', fee: 0.05 },
  { name: 'Uniswap V2', fee: 0.3 },
  { name: 'SushiSwap', fee: 0.3 },
  { name: 'Curve', fee: 0.04 },
  { name: 'Balancer', fee: 0.1 },
  { name: '1inch', fee: 0.1 },
];

// Available intermediate tokens for multi-hop routes
const INTERMEDIATE_TOKENS = [
  { id: 'weth', symbol: 'WETH', name: 'Wrapped Ether', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', decimals: 18 },
  { id: 'dai', symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18 },
  { id: 'wbtc', symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8 },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', address: '0x514910771af9ca656af840dff83e8264ecf986ca', decimals: 18 },
];

// Mock function to simulate real-time path data fetching with dynamic routing
const generateDynamicPaths = (blockNumber: number): PricePath[] => {
  // Avoid hydration mismatch by using block number as seed for deterministic "randomness"
  const blockSeed = blockNumber % 1000;
  const random = (seed: number) => (Math.sin(seed * 12.9898 + 78.233) * 43758.5453123) % 1;
  
  const baseVariation = () => 0.95 + (Math.abs(random(blockSeed)) * 0.1); // ±5% variation
  const gasVariation = () => 0.003 + (Math.abs(random(blockSeed + 1)) * 0.006); // 0.003-0.009 ETH
  
  // Sometimes change routing (every ~5 blocks on average)
  const shouldChangeRouting = blockNumber % 5 === 0;
  
  const paths: PricePath[] = [];

  // FIRST PATH: Complex 3-hop path (maximum 3 hops)
  const complexPathVariation = blockSeed % 3;
  let firstPathHops = [];
  let firstPath = [];
  
  if (complexPathVariation === 0) {
    // 3-hop path: ETH -> WETH -> DAI -> USDC
    firstPath = ['ETH', 'WETH', 'DAI', 'USDC'];
    firstPathHops = [
      {
        pool: {
          id: '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
          name: 'ETH/WETH',
          dex: 'Uniswap V3',
          tokenA: { id: 'eth', address: '0x0000000000000000000000000000000000000000', name: 'Ethereum', symbol: 'ETH', decimals: 18 },
          tokenB: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
          reserve0: (1000000000000000000000 * baseVariation()).toString(),
          reserve1: (1000000000000000000000 * baseVariation()).toString(),
          tvl: 125000000 * baseVariation(),
          fee: 0.05
        },
        tokenIn: { id: 'eth', address: '0x0000000000000000000000000000000000000000', name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        tokenOut: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
        amountIn: '1000000000000000000',
        amountOut: (999500000000000000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 0.9995 * baseVariation()
      },
      {
        pool: {
          id: '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490',
          name: 'WETH/DAI',
          dex: 'Curve',
          tokenA: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
          tokenB: { id: 'dai', address: '0x6b175474e89094c44da98b954eedeac495271d0f', name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18 },
          reserve0: (300000000000000000000 * baseVariation()).toString(),
          reserve1: (736700000000000000000000 * baseVariation()).toString(),
          tvl: 85000000 * baseVariation(),
          fee: 0.04
        },
        tokenIn: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
        tokenOut: { id: 'dai', address: '0x6b175474e89094c44da98b954eedeac495271d0f', name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18 },
        amountIn: (999500000000000000 * baseVariation()).toString(),
        amountOut: (2455670000000000000000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 2456.67 * baseVariation()
      },
      {
        pool: {
          id: '0x5777d92f208679db4b9778590fa3cab3ac9e2168',
          name: 'DAI/USDC',
          dex: 'Curve',
          tokenA: { id: 'dai', address: '0x6b175474e89094c44da98b954eedeac495271d0f', name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18 },
          tokenB: { id: 'usdc', address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
          reserve0: (2500000000000000000000000 * baseVariation()).toString(),
          reserve1: (2500000000000 * baseVariation()).toString(),
          tvl: 45000000 * baseVariation(),
          fee: 0.04
        },
        tokenIn: { id: 'dai', address: '0x6b175474e89094c44da98b954eedeac495271d0f', name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18 },
        tokenOut: { id: 'usdc', address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
        amountIn: (2455670000000000000000 * baseVariation()).toString(),
        amountOut: (2453890000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 0.999 * baseVariation()
      }
    ];
  } else if (complexPathVariation === 1) {
    // 3-hop path: ETH -> WETH -> WBTC -> USDC
    firstPath = ['ETH', 'WETH', 'WBTC', 'USDC'];
    firstPathHops = [
      {
        pool: {
          id: '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
          name: 'ETH/WETH',
          dex: 'Uniswap V2',
          tokenA: { id: 'eth', address: '0x0000000000000000000000000000000000000000', name: 'Ethereum', symbol: 'ETH', decimals: 18 },
          tokenB: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
          reserve0: (1000000000000000000000 * baseVariation()).toString(),
          reserve1: (1000000000000000000000 * baseVariation()).toString(),
          tvl: 95000000 * baseVariation(),
          fee: 0.30
        },
        tokenIn: { id: 'eth', address: '0x0000000000000000000000000000000000000000', name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        tokenOut: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
        amountIn: '1000000000000000000',
        amountOut: (997000000000000000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 0.997 * baseVariation()
      },
      {
        pool: {
          id: '0xcbcdf9626bc03e24f779434178a73a0b4bad62ed',
          name: 'WETH/WBTC',
          dex: 'Balancer',
          tokenA: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
          tokenB: { id: 'wbtc', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', name: 'Wrapped Bitcoin', symbol: 'WBTC', decimals: 8 },
          reserve0: (150000000000000000000 * baseVariation()).toString(),
          reserve1: (610000000 * baseVariation()).toString(),
          tvl: 75000000 * baseVariation(),
          fee: 0.25
        },
        tokenIn: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
        tokenOut: { id: 'wbtc', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', name: 'Wrapped Bitcoin', symbol: 'WBTC', decimals: 8 },
        amountIn: (997000000000000000 * baseVariation()).toString(),
        amountOut: (4066750 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 0.0408 * baseVariation()
      },
      {
        pool: {
          id: '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36',
          name: 'WBTC/USDC',
          dex: 'Uniswap V3',
          tokenA: { id: 'wbtc', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', name: 'Wrapped Bitcoin', symbol: 'WBTC', decimals: 8 },
          tokenB: { id: 'usdc', address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
          reserve0: (45000000 * baseVariation()).toString(),
          reserve1: (2700000000000 * baseVariation()).toString(),
          tvl: 55000000 * baseVariation(),
          fee: 0.01
        },
        tokenIn: { id: 'wbtc', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', name: 'Wrapped Bitcoin', symbol: 'WBTC', decimals: 8 },
        tokenOut: { id: 'usdc', address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
        amountIn: (4066750 * baseVariation()).toString(),
        amountOut: (2450890000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 60250.45 * baseVariation()
      }
    ];
  } else {
    // 3-hop path: ETH -> WETH -> UNI -> USDC
    firstPath = ['ETH', 'WETH', 'UNI', 'USDC'];
    firstPathHops = [
      {
        pool: {
          id: '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
          name: 'ETH/WETH',
          dex: 'Uniswap V3',
          tokenA: { id: 'eth', address: '0x0000000000000000000000000000000000000000', name: 'Ethereum', symbol: 'ETH', decimals: 18 },
          tokenB: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
          reserve0: (1000000000000000000000 * baseVariation()).toString(),
          reserve1: (1000000000000000000000 * baseVariation()).toString(),
          tvl: 115000000 * baseVariation(),
          fee: 0.05
        },
        tokenIn: { id: 'eth', address: '0x0000000000000000000000000000000000000000', name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        tokenOut: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
        amountIn: '1000000000000000000',
        amountOut: (999500000000000000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 0.9995 * baseVariation()
      },
      {
        pool: {
          id: '0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801',
          name: 'WETH/UNI',
          dex: 'Uniswap V3',
          tokenA: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
          tokenB: { id: 'uni', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap Token', symbol: 'UNI', decimals: 18 },
          reserve0: (125000000000000000000 * baseVariation()).toString(),
          reserve1: (2380000000000000000000000 * baseVariation()).toString(),
          tvl: 65000000 * baseVariation(),
          fee: 0.30
        },
        tokenIn: { id: 'weth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
        tokenOut: { id: 'uni', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap Token', symbol: 'UNI', decimals: 18 },
        amountIn: (999500000000000000 * baseVariation()).toString(),
        amountOut: (297550000000000000000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 297.8 * baseVariation()
      },
      {
        pool: {
          id: '0x17231dcf2649e48ac3c8d2b93206a1d1bb55dd85',
          name: 'UNI/USDC',
          dex: 'SushiSwap',
          tokenA: { id: 'uni', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap Token', symbol: 'UNI', decimals: 18 },
          tokenB: { id: 'usdc', address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
          reserve0: (345000000000000000000000 * baseVariation()).toString(),
          reserve1: (2835000000000000 * baseVariation()).toString(),
          tvl: 25000000 * baseVariation(),
          fee: 0.30
        },
        tokenIn: { id: 'uni', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap Token', symbol: 'UNI', decimals: 18 },
        tokenOut: { id: 'usdc', address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
        amountIn: (297550000000000000000 * baseVariation()).toString(),
        amountOut: (2447320000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 8.22 * baseVariation()
      }
    ];
  }

  // Add the complex first path
  paths.push({
      id: '1',
    fromToken: {
      id: 'eth',
      address: '0x0000000000000000000000000000000000000000',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    toToken: {
      id: 'usdc',
      address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6
    },
    hops: firstPathHops,
    totalGasCost: gasVariation() * firstPathHops.length,
    grossPrice: firstPathHops[firstPathHops.length - 1].executionPrice * 0.998,
    netPrice: firstPathHops[firstPathHops.length - 1].executionPrice * 0.985,
    spread: 1.5 * baseVariation(),
    confidence: 92.5 * (0.95 + Math.abs(random(blockSeed + 2)) * 0.1),
    path: firstPath
  });

  // Direct path (second option now)
  paths.push({
    id: '2',
      fromToken: {
        id: 'eth',
        address: '0x0000000000000000000000000000000000000000',
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
      },
      toToken: {
        id: 'usdc',
        address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6
      },
      hops: [
        {
          pool: {
            id: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
            name: 'ETH/USDC',
            dex: shouldChangeRouting && blockSeed % 3 === 0 ? 'Uniswap V2' : 'Uniswap V3',
            tokenA: {
              id: 'eth',
              address: '0x0000000000000000000000000000000000000000',
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18
            },
            tokenB: {
              id: 'usdc',
              address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
              name: 'USD Coin',
              symbol: 'USDC',
              decimals: 6
            },
            reserve0: (1000000000000000000000 * baseVariation()).toString(),
            reserve1: (2456780000000 * baseVariation()).toString(),
            tvl: 125000000 * baseVariation(),
            fee: shouldChangeRouting && blockSeed % 3 === 0 ? 0.3 : 0.05
          },
          tokenIn: {
            id: 'eth',
            address: '0x0000000000000000000000000000000000000000',
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18
          },
          tokenOut: {
            id: 'usdc',
            address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
            name: 'USD Coin',
            symbol: 'USDC',
            decimals: 6
          },
          amountIn: '1000000000000000000',
          amountOut: (2316430000 * baseVariation()).toString(),
          gasCost: gasVariation(),
          executionPrice: 2316.43 * baseVariation()
        }
      ],
      totalGasCost: gasVariation(),
      grossPrice: 2316.43 * baseVariation(),
      netPrice: 2307.09 * baseVariation(),
      spread: 0.4 * baseVariation(),
      confidence: 98.5 * (0.95 + Math.abs(random(blockSeed + 2)) * 0.1),
      path: ['ETH', 'USDC']
  });

  // Add 2-hop path (ETH -> WETH -> USDC or ETH -> DAI -> USDC)
  const intermediateToken = shouldChangeRouting && blockSeed % 4 === 0 
    ? INTERMEDIATE_TOKENS[1] // DAI
    : INTERMEDIATE_TOKENS[0];
  
  const firstDex = AVAILABLE_DEXES[blockSeed % AVAILABLE_DEXES.length];
  const secondDex = AVAILABLE_DEXES[(blockSeed + 1) % AVAILABLE_DEXES.length];

  paths.push({
    id: '3',
    fromToken: {
      id: 'eth',
      address: '0x0000000000000000000000000000000000000000',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    toToken: {
      id: 'usdc',
      address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6
    },
    hops: [
      {
        pool: {
          id: '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
          name: `ETH/${intermediateToken.symbol}`,
          dex: firstDex.name,
          tokenA: {
            id: 'eth',
            address: '0x0000000000000000000000000000000000000000',
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18
          },
          tokenB: {
            id: intermediateToken.id,
            address: intermediateToken.address,
            name: intermediateToken.name,
            symbol: intermediateToken.symbol,
            decimals: 18
          },
          reserve0: (1000000000000000000000 * baseVariation()).toString(),
          reserve1: (1000000000000000000000 * baseVariation()).toString(),
          tvl: 85000000 * baseVariation(),
          fee: firstDex.fee
        },
        tokenIn: {
          id: 'eth',
          address: '0x0000000000000000000000000000000000000000',
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18
        },
        tokenOut: {
          id: intermediateToken.id,
          address: intermediateToken.address,
          name: intermediateToken.name,
          symbol: intermediateToken.symbol,
          decimals: 18
        },
        amountIn: '1000000000000000000',
        amountOut: (999700000000000000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 0.9997 * baseVariation()
      },
      {
        pool: {
          id: '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
          name: `${intermediateToken.symbol}/USDC`,
          dex: secondDex.name,
          tokenA: {
            id: intermediateToken.id,
            address: intermediateToken.address,
            name: intermediateToken.name,
            symbol: intermediateToken.symbol,
            decimals: 18
          },
          tokenB: {
            id: 'usdc',
            address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
            name: 'USD Coin',
            symbol: 'USDC',
            decimals: 6
          },
          reserve0: (500000000000000000000 * baseVariation()).toString(),
          reserve1: (1228390000000 * baseVariation()).toString(),
          tvl: 65000000 * baseVariation(),
          fee: secondDex.fee
        },
        tokenIn: {
          id: intermediateToken.id,
          address: intermediateToken.address,
          name: intermediateToken.name,
          symbol: intermediateToken.symbol,
          decimals: 18
        },
        tokenOut: {
          id: 'usdc',
          address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6
        },
        amountIn: (999700000000000000 * baseVariation()).toString(),
        amountOut: (2454320000 * baseVariation()).toString(),
        gasCost: gasVariation(),
        executionPrice: 2454.32 * baseVariation()
      }
    ],
    totalGasCost: gasVariation() * 2,
    grossPrice: 2454.32 * baseVariation(),
    netPrice: 2437.21 * baseVariation(),
    spread: 0.7 * baseVariation(),
    confidence: 96.8 * (0.95 + Math.abs(random(blockSeed + 3)) * 0.1),
    path: ['ETH', intermediateToken.symbol, 'USDC']
  });

  return paths;
};

interface RealTimeProviderProps {
  children: React.ReactNode;
  initialUpdateInterval?: number;
}

export function RealTimeProvider({ children, initialUpdateInterval = 12000 }: RealTimeProviderProps) {
  const [paths, setPaths] = useState<PricePath[]>([]);
  const [selectedPath, setSelectedPath] = useState<PricePath | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Enforce minimum 12-second interval (1 block) - never update faster than block time
  const [updateInterval, setUpdateInterval] = useState(Math.max(initialUpdateInterval, 12000));
  const [currentBlock, setCurrentBlock] = useState(19000000); // Simulated block number
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side to avoid hydration mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Custom setter that enforces minimum block time
  const setUpdateIntervalWithMinimum = useCallback((interval: number) => {
    // Never allow updates faster than 1 block (12 seconds)
    const constrainedInterval = Math.max(interval, 12000);
    setUpdateInterval(constrainedInterval);
  }, []);

  const refreshPaths = useCallback(async () => {
    if (!isClient) return; // Only run on client side
    
    setIsLoading(true);
    try {
      // Simulate block processing delay (realistic block processing time)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setCurrentBlock(prevBlock => {
        const newBlockNumber = prevBlock + 1;
        
        const newPaths = generateDynamicPaths(newBlockNumber);
        setPaths(newPaths);
        setLastUpdated(new Date());
        
        // Update selected path if it exists, or try to maintain selection by index
        setSelectedPath(prevSelectedPath => {
          if (prevSelectedPath) {
            const updatedSelectedPath = newPaths.find(p => p.id === prevSelectedPath.id);
            if (updatedSelectedPath) {
              return updatedSelectedPath;
            } else {
              // If the exact path no longer exists, try to select a similar one
              const similarPath = newPaths.find(p => 
                p.path.length === prevSelectedPath.path.length &&
                p.path[0] === prevSelectedPath.path[0] &&
                p.path[p.path.length - 1] === prevSelectedPath.path[prevSelectedPath.path.length - 1]
              );
              return similarPath || newPaths[0] || null;
            }
          } else {
            // Set first path as default selected
            return newPaths[0] || null;
          }
        });
        
        return newBlockNumber;
      });
    } catch (error) {
      console.error('Failed to refresh paths:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isClient]); // Removed currentBlock and selectedPath from dependencies

  // Initial load - only on client
  useEffect(() => {
    if (isClient) {
      refreshPaths();
    }
  }, [isClient, refreshPaths]);

  // Set up real-time updates - only on client, enforcing block time minimum
  useEffect(() => {
    if (!isClient) return;
    
    // Ensure we never update faster than 1 block (12 seconds)
    const safeInterval = Math.max(updateInterval, 12000);
    const interval = setInterval(refreshPaths, safeInterval);
    return () => clearInterval(interval);
  }, [updateInterval, refreshPaths, isClient]);

  const contextValue: RealTimeContextType = {
    paths,
    selectedPath,
    isLoading,
    lastUpdated,
    updateInterval,
    currentBlock,
    setSelectedPath,
    refreshPaths,
    setUpdateInterval: setUpdateIntervalWithMinimum
  };

  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  );
} 
