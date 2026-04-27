import { Token, WatchlistItem, TopMover } from '@/types/price-quoter';

export type ExtendedToken = Token & {
  marketCap?: number;
  volume24h?: number;
  priceChange1h?: number;
  priceChange7d?: number;
  rank: number;
  lastUpdated: number;
  isWatchlisted?: boolean;
};

export type SortField = 'rank' | 'name' | 'price' | 'priceChange1h' | 'priceChange24h' | 'priceChange7d' | 'marketCap';

export type SortDirection = 'asc' | 'desc';

// Demo market data refreshed from CoinGecko on 2026-04-23.
export const mockTokensInitial: ExtendedToken[] = [
  {
    id: 'btc',
    address: 'native:bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 8,
    price: 77452,
    priceChange1h: -0.2987242007474791,
    priceChange24h: -1.0499768066806408,
    priceChange7d: 4.196631381689125,
    marketCap: 1550518475041,
    volume24h: 45620161623,
    rank: 1,
    lastUpdated: Date.now() - 60000,
    isWatchlisted: true
  },
  {
    id: 'eth',
    address: '0x0000000000000000000000000000000000000000',
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    price: 2316.43,
    priceChange1h: -0.025705426691107525,
    priceChange24h: -3.160703789200186,
    priceChange7d: -0.9613130348726647,
    marketCap: 279548970931,
    volume24h: 20834579103,
    rank: 2,
    lastUpdated: Date.now() - 120000,
    isWatchlisted: true
  },
  {
    id: 'usdt',
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    name: 'Tether',
    symbol: 'USDT',
    decimals: 6,
    price: 1,
    priceChange1h: 0.003272937528886171,
    priceChange24h: 0.016561969962644363,
    priceChange7d: 0.01859610617607201,
    marketCap: 188839589651,
    volume24h: 75355343949,
    rank: 3,
    lastUpdated: Date.now() - 80000,
    isWatchlisted: false
  },
  {
    id: 'xrp',
    address: 'native:xrp-ledger',
    name: 'XRP',
    symbol: 'XRP',
    decimals: 6,
    price: 1.41,
    priceChange1h: -0.1994053454265118,
    priceChange24h: -2.741927483664837,
    priceChange7d: 0.15465422824111077,
    marketCap: 86930562638,
    volume24h: 2328154165,
    rank: 4,
    lastUpdated: Date.now() - 80000,
    isWatchlisted: false
  },
  {
    id: 'bnb',
    address: 'native:bnb-chain',
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
    price: 631.83,
    priceChange1h: -0.2064705439147843,
    priceChange24h: -1.616303272274612,
    priceChange7d: 1.9282954772847596,
    marketCap: 85161648718,
    volume24h: 1176450709,
    rank: 5,
    lastUpdated: Date.now() - 80000,
    isWatchlisted: false
  },
  {
    id: 'usdc',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
    price: 0.99977,
    priceChange1h: 0.0029608521130868944,
    priceChange24h: 0.042177443091488936,
    priceChange7d: -0.0018241952814895567,
    marketCap: 78201491027,
    volume24h: 16836357613,
    rank: 6,
    lastUpdated: Date.now() - 180000,
    isWatchlisted: true
  },
  {
    id: 'sol',
    address: 'native:solana',
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
    price: 85.46,
    priceChange1h: -0.0705295645830809,
    priceChange24h: -3.2937504476825397,
    priceChange7d: 0.19567332810361704,
    marketCap: 49183829411,
    volume24h: 3782879450,
    rank: 7,
    lastUpdated: Date.now() - 90000,
    isWatchlisted: true
  },
  {
    id: 'trx',
    address: 'native:tron',
    name: 'TRON',
    symbol: 'TRX',
    decimals: 6,
    price: 0.328245,
    priceChange1h: -0.030923076717063683,
    priceChange24h: -1.6211646137096813,
    priceChange7d: 0.4700091500661972,
    marketCap: 31110895885,
    volume24h: 635991852,
    rank: 8,
    lastUpdated: Date.now() - 120000,
    isWatchlisted: false
  },
  {
    id: 'doge',
    address: 'native:dogecoin',
    name: 'Dogecoin',
    symbol: 'DOGE',
    decimals: 8,
    price: 0.09578,
    priceChange1h: 0.13098269084409203,
    priceChange24h: -2.515785226396292,
    priceChange7d: -0.26247954676830176,
    marketCap: 14738942411,
    volume24h: 1428789885,
    rank: 10,
    lastUpdated: Date.now() - 120000,
    isWatchlisted: false
  },
  {
    id: 'ada',
    address: 'native:cardano',
    name: 'Cardano',
    symbol: 'ADA',
    decimals: 6,
    price: 0.246053,
    priceChange1h: -0.050300998037073975,
    priceChange24h: -3.742399425577725,
    priceChange7d: -0.7951841493294894,
    marketCap: 9094467310,
    volume24h: 389157496,
    rank: 15,
    lastUpdated: Date.now() - 120000,
    isWatchlisted: false
  },
  {
    id: 'link',
    address: '0x514910771af9ca656af840dff83e8264ecf986ca',
    name: 'Chainlink',
    symbol: 'LINK',
    decimals: 18,
    price: 9.19,
    priceChange1h: -0.0556798795945252,
    priceChange24h: -3.479801850450903,
    priceChange7d: -0.7091797798843654,
    marketCap: 6682004244,
    volume24h: 296625084,
    rank: 18,
    lastUpdated: Date.now() - 150000,
    isWatchlisted: false
  },
  {
    id: 'dai',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    name: 'Dai',
    symbol: 'DAI',
    decimals: 18,
    price: 0.999668,
    priceChange1h: 0.0028442517712989252,
    priceChange24h: 0.0004402546650617787,
    priceChange7d: -0.0020874895484827923,
    marketCap: 4422674319,
    volume24h: 273298394,
    rank: 23,
    lastUpdated: Date.now() - 150000,
    isWatchlisted: false
  },
  {
    id: 'avax',
    address: 'native:avalanche',
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
    price: 9.23,
    priceChange1h: -0.21957676059166736,
    priceChange24h: -3.6501557837144336,
    priceChange7d: -2.2814434702640707,
    marketCap: 3984542961,
    volume24h: 237018802,
    rank: 27,
    lastUpdated: Date.now() - 150000,
    isWatchlisted: false
  },
  {
    id: 'uni',
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    name: 'Uniswap',
    symbol: 'UNI',
    decimals: 18,
    price: 3.23,
    priceChange1h: 0.08043204109503202,
    priceChange24h: -4.692674162850327,
    priceChange7d: -0.7040889727606007,
    marketCap: 2045611131,
    volume24h: 172631945,
    rank: 44,
    lastUpdated: Date.now() - 90000,
    isWatchlisted: false
  },
  {
    id: 'aave',
    address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    name: 'Aave',
    symbol: 'AAVE',
    decimals: 18,
    price: 91.48,
    priceChange1h: 0.11620504019720823,
    priceChange24h: -2.1669424233502435,
    priceChange7d: -13.729795919650604,
    marketCap: 1389120746,
    volume24h: 316714541,
    rank: 55,
    lastUpdated: Date.now() - 240000,
    isWatchlisted: false
  },
  {
    id: 'pol',
    address: '0x455e53cbb86018ac2b8092f5aa0a3f9fe77d6555',
    name: 'POL (ex-MATIC)',
    symbol: 'POL',
    decimals: 18,
    price: 0.093123,
    priceChange1h: -0.33941024167929484,
    priceChange24h: -1.4313633611291665,
    priceChange7d: 6.4832781208945045,
    marketCap: 989894097,
    volume24h: 48729104,
    rank: 70,
    lastUpdated: Date.now() - 180000,
    isWatchlisted: false
  },
  {
    id: 'arb',
    address: '0x912ce59144191c1204e64559fe8253a0e49e6548',
    name: 'Arbitrum',
    symbol: 'ARB',
    decimals: 18,
    price: 0.124065,
    priceChange1h: -0.7964875717803334,
    priceChange24h: -3.429646436419394,
    priceChange7d: 5.060209119400589,
    marketCap: 749619387,
    volume24h: 108130179,
    rank: 82,
    lastUpdated: Date.now() - 45000,
    isWatchlisted: false
  },
  {
    id: 'op',
    address: '0x4200000000000000000000000000000000000042',
    name: 'Optimism',
    symbol: 'OP',
    decimals: 18,
    price: 0.118365,
    priceChange1h: -0.533480668859555,
    priceChange24h: -7.132376216544289,
    priceChange7d: -2.820580445158357,
    marketCap: 254497511,
    volume24h: 47932061,
    rank: 155,
    lastUpdated: Date.now() - 210000,
    isWatchlisted: false
  }
];

// Mock watchlist data
export const mockWatchlist: WatchlistItem[] = [
  {
    token: mockTokensInitial.find(t => t.symbol === 'BTC')!,
    numeraire: mockTokensInitial.find(t => t.symbol === 'USDC')!,
    addedAt: Date.now() - 43200000
  },
  {
    token: mockTokensInitial.find(t => t.symbol === 'ETH')!,
    numeraire: mockTokensInitial.find(t => t.symbol === 'USDC')!,
    addedAt: Date.now() - 86400000
  },
  {
    token: mockTokensInitial.find(t => t.symbol === 'SOL')!,
    numeraire: mockTokensInitial.find(t => t.symbol === 'USDC')!,
    addedAt: Date.now() - 172800000
  }
];

// Mock top movers data
export const mockTopMovers: TopMover[] = [
  {
    token: mockTokensInitial.find(t => t.symbol === 'USDC')!,
    priceChange: 0.0004215,
    priceChangePercent: 0.042177443091488936,
    volume24h: 16836357613,
    rank: 6
  },
  {
    token: mockTokensInitial.find(t => t.symbol === 'USDT')!,
    priceChange: 0.00016563,
    priceChangePercent: 0.016561969962644363,
    volume24h: 75355343949,
    rank: 3
  },
  {
    token: mockTokensInitial.find(t => t.symbol === 'DAI')!,
    priceChange: 0.0000044,
    priceChangePercent: 0.0004402546650617787,
    volume24h: 273298394,
    rank: 23
  }
];

// Mock stats data
export const mockStatsData = {
  quotesToday: 147836,
  quotesChange: 12.4,
  avgResponse: 0.34,
  responseChange: -0.02,
  trackedTokens: 8247,
  newTokens: 23,
  activePools: 1204,
  poolsUptime: 99.7
}; 
