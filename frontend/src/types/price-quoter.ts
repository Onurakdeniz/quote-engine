export interface Token {
  id: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
}

export interface Pool {
  id: string;
  name: string;
  dex: string;
  tokenA: Token;
  tokenB: Token;
  reserve0: string;
  reserve1: string;
  tvl: number;
  fee: number;
}

export interface PathHop {
  pool: Pool;
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  gasCost: number;
  executionPrice: number;
}

export interface PricePath {
  id: string;
  fromToken: Token;
  toToken: Token;
  hops: PathHop[];
  totalGasCost: number;
  grossPrice: number;
  netPrice: number;
  spread: number;
  confidence: number;
  path: string[];
}

export interface PriceQuote {
  id: string;
  numeraire: Token;
  targetToken: Token;
  amount: string;
  timestamp: number;
  blockNumber: number;
  bestPath: PricePath;
  alternativePaths: PricePath[];
  marketDepth: {
    depth0_5: number;
    depth1: number;
    depth2: number;
  };
}

export interface TokenPriceHistory {
  tokenAddress: string;
  numeraire: string;
  timestamp: number;
  blockNumber: number;
  price: number;
  confidence: number;
}

export interface QuotingConfig {
  numeraire: Token;
  probingDepth: string;
  maxHops: number;
  tvlFilter: number;
  gasPrice: number;
  includeGasInPrice: boolean;
}

export interface WatchlistItem {
  token: Token;
  numeraire: Token;
  addedAt: number;
  alerts?: {
    priceAbove?: number;
    priceBelow?: number;
    changeAbove?: number;
    changeBelow?: number;
  };
}

export interface PriceAlert {
  id: string;
  token: Token;
  condition: 'above' | 'below' | 'change_above' | 'change_below';
  value: number;
  currentValue: number;
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

export interface TopMover {
  token: Token;
  priceChange: number;
  priceChangePercent: number;
  volume24h: number;
  rank: number;
}

export interface NetworkNode {
  id: string;
  token: Token;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  pool: Pool;
  weight: number;
  color: string;
  animated?: boolean;
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  bestPath: string[];
}

export type TimeFrame = '1m' | '5m' | '1h' | '4h' | '1d' | '1w' | 'all';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'dashboard' | 'detail' | 'graph' | 'history' | 'settings'; 