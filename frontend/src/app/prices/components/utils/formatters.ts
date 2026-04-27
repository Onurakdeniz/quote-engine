import { Token } from '@/types/price-quoter';
import { ExtendedToken } from '../data/mock-data';

export const formatPrice = (price: number) => {
  if (price < 0.01) {
    return `$${price.toFixed(6)}`;
  } else if (price < 1) {
    return `$${price.toFixed(4)}`;
  } else if (price < 100) {
    return `$${price.toFixed(2)}`;
  } else {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

export const formatMarketCap = (marketCap: number) => {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  } else if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  } else {
    return `$${marketCap.toLocaleString()}`;
  }
};

export const formatVolume = (volume: number) => {
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`;
  } else if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(2)}M`;
  } else {
    return `$${volume.toLocaleString()}`;
  }
};

export const formatPercentage = (percentage: number) => {
  return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};

export const formatTimeAgo = (timestamp: number, isClient = true) => {
  if (!isClient) {
    // Return a static fallback for server-side rendering
    return 'Loading...';
  }
  
  // Ensure timestamp is valid
  if (!timestamp || timestamp <= 0) {
    return 'Unknown';
  }
  
  const now = Date.now();
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export const getTokenLogoUrl = (symbol: string): string | null => {
  const logoMap: { [key: string]: string } = {
    'BTC': 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400',
    'ETH': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    'USDT': 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661',
    'USDC': 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    'BNB': 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1696501970',
    'SOL': 'https://coin-images.coingecko.com/coins/images/4128/large/solana.png?1718769756',
    'XRP': 'https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png?1696501442',
    'TRX': 'https://coin-images.coingecko.com/coins/images/1094/large/photo_2026-04-13_09-59-16.png?1776048311',
    'DOGE': 'https://coin-images.coingecko.com/coins/images/5/large/dogecoin.png?1696501409',
    'ADA': 'https://coin-images.coingecko.com/coins/images/975/large/cardano.png?1696502090',
    'DAI': 'https://coin-images.coingecko.com/coins/images/9956/large/Badge_Dai.png?1696509996',
    'AVAX': 'https://coin-images.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png?1696512369',
    'UNI': 'https://cryptologos.cc/logos/uniswap-uni-logo.png',
    'ARB': 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    'OP': 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    'POL': 'https://coin-images.coingecko.com/coins/images/32440/large/pol.png?1759114181',
    'MATIC': 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    'LINK': 'https://cryptologos.cc/logos/chainlink-link-logo.png',
    'AAVE': 'https://cryptologos.cc/logos/aave-aave-logo.png'
  };

  return logoMap[symbol] || null;
};

export const getFallbackLogoHTML = (token: Token): string => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 
    'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-cyan-500'
  ];
  
  const colorIndex = token.symbol.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];
  
  return `
    <div class="w-6 h-6 rounded-full ${bgColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      ${token.symbol.charAt(0).toUpperCase()}
    </div>
  `;
};

export const getSimulatedPreviousDayPrices = (currentTokens: ExtendedToken[]) => {
  return currentTokens.map(token => ({
    ...token,
    previousPrice: token.price ? token.price / (1 + (token.priceChange24h || 0) / 100) : 0
  }));
}; 
