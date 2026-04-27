"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown,
  Search,
  Star,
  StarOff,
  BarChart3,
  DollarSign,
  Clock,
  Filter,
  RefreshCw,
  Network,
  Route,
  Zap,
  Eye,
  Activity,
  Plus,
  ExternalLink
} from 'lucide-react';
import { Token, SortDirection } from '@/types/price-quoter';
import { PricePathHover } from '@/components/price-path-hover';
import { ScrollArea } from "@/components/ui/scroll-area"
import { mockTokensInitial, mockWatchlist, mockTopMovers } from './data/mock-data';

type SortField = 'rank' | 'name' | 'price' | 'priceChange1h' | 'priceChange24h' | 'priceChange7d' | 'marketCap';

// Helper to create a simulated previous day's prices
const getSimulatedPreviousDayPrices = (currentTokens: typeof mockTokensInitial) => {
  const priceMap: Record<string, number> = {};
  currentTokens.forEach(token => {
    // Simulate a price from 24 hours ago. For simplicity, we'll base it on the current price
    // by adjusting it by the current 24h change, or a small random factor if that's zero.
    let previousPrice = token.price || 0;
    const currentPrice = token.price || 0;
    const currentPriceChange24h = token.priceChange24h || 0;

    if (currentPriceChange24h !== 0) {
      previousPrice = currentPrice / (1 + (currentPriceChange24h / 100));
    } else {
      previousPrice = currentPrice * (1 - (Math.random() - 0.5) * 0.02); // +/- 1%
    }
    priceMap[token.id] = previousPrice;
  });
  return priceMap;
};

// Function to generate distinctive token logos using external icon services
const getTokenLogo = (token: Token) => {
  // Use CryptoIcons.co for reliable token icons
  const iconUrl = `https://cryptoicons.org/api/icon/${token.symbol.toLowerCase()}/32`;
  
  return (
    <div className="w-6 h-6 rounded-full overflow-hidden shadow-lg ring-2 ring-white/10 transition-all duration-200 hover:scale-110 hover:shadow-xl bg-white">
      <img 
        src={iconUrl}
        alt={token.symbol}
        className="w-full h-full object-cover"
        onError={(e) => {
          // Fallback to gradient logo if image fails to load
          const target = e.target as HTMLImageElement;
          const parent = target.parentElement;
          if (parent) {
            parent.className = "w-6 h-6 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white/10 transition-all duration-200 hover:scale-110 hover:shadow-xl";
            parent.innerHTML = getFallbackLogoHTML(token);
          }
        }}
      />
    </div>
  );
};


// Fallback gradient logo with proper styling
const getFallbackLogoHTML = (token: Token): string => {
  const tokenColors: Record<string, { from: string; to: string; icon?: string }> = {
    'ETH': { from: '#627eea', to: '#4f46e5', icon: 'Ξ' },
    'BTC': { from: '#f7931a', to: '#ff8c00', icon: '₿' },
    'USDC': { from: '#2775ca', to: '#1e40af', icon: '$' },
    'USDT': { from: '#26a17b', to: '#059669', icon: '₮' },
    'BNB': { from: '#f3ba2f', to: '#eab308', icon: 'B' },
    'ADA': { from: '#0033ad', to: '#1e40af', icon: '₳' },
    'SOL': { from: '#9945ff', to: '#7c3aed', icon: '◎' },
    'XRP': { from: '#23292f', to: '#374151', icon: 'X' },
    'DOT': { from: '#e6007a', to: '#ec4899', icon: '●' },
    'DOGE': { from: '#c2a633', to: '#ca8a04', icon: 'Ð' },
    'AVAX': { from: '#e84142', to: '#dc2626', icon: '▲' },
    'SHIB': { from: '#ffa409', to: '#f59e0b', icon: '🐕' },
    'MATIC': { from: '#8247e5', to: '#7c3aed', icon: '⬟' },
    'LTC': { from: '#bfbbbb', to: '#9ca3af', icon: 'Ł' },
    'UNI': { from: '#ff007a', to: '#ec4899', icon: '🦄' },
    'LINK': { from: '#375bd2', to: '#2563eb', icon: '🔗' },
    'ATOM': { from: '#2e3148', to: '#374151', icon: '⚛' },
    'ETC': { from: '#328332', to: '#16a34a', icon: 'Ξ' },
    'XLM': { from: '#000000', to: '#374151', icon: '*' },
    'BCH': { from: '#8dc351', to: '#65a30d', icon: '₿' },
    'ALGO': { from: '#000000', to: '#374151', icon: 'A' },
    'VET': { from: '#15bdff', to: '#0ea5e9', icon: 'V' },
    'ICP': { from: '#29abe2', to: '#0ea5e9', icon: '∞' },
    'FIL': { from: '#0090ff', to: '#0ea5e9', icon: 'F' },
    'TRX': { from: '#ff060a', to: '#dc2626', icon: 'T' },
    'ARB': { from: '#28a0f0', to: '#1e40af', icon: 'A' },
    'OP': { from: '#ff0420', to: '#dc2626', icon: 'O' },
    'AAVE': { from: '#b6509e', to: '#9333ea', icon: 'A' }
  };

  const colors = tokenColors[token.symbol] || { from: '#6366f1', to: '#8b5cf6' };
  const displayText = colors.icon || token.symbol.slice(0, 2);

  return `
    <div style="
      width: 100%; 
      height: 100%; 
      background: linear-gradient(135deg, ${colors.from}, ${colors.to});
      display: flex; 
      align-items: center; 
      justify-content: center;
      border-radius: 50%;
    ">
      <span style="
        color: white; 
        font-size: 10px; 
        font-weight: bold; 
        letter-spacing: -0.025em;
      ">${displayText}</span>
    </div>
  `;
};

export function PriceList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showWatchlistedOnly, setShowWatchlistedOnly] = useState(false);
  const [tokens, setTokens] = useState(mockTokensInitial);
  const [previousDayPrices, setPreviousDayPrices] = useState<Record<string, number>>(() => getSimulatedPreviousDayPrices(mockTokensInitial));
  const [quoteAmount, setQuoteAmount] = useState('1');
  const [showWidgets, setShowWidgets] = useState(true);
  // Simple terminal-style price update tracking
  const [priceUpdates, setPriceUpdates] = useState<Record<string, {
    isUpdating: boolean;
    direction: 'increase' | 'decrease' | null;
    timestamp: number;
  }>>({});
  const [pathQualityUpdateTrigger, setPathQualityUpdateTrigger] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [protocolUptimes, setProtocolUptimes] = useState({
    uniswapV3: 98.5,
    uniswapV2: 99.2,
    pancakeSwap: 97.8,
    curve: 99.7
  });
  const [statsData, setStatsData] = useState({
    quotesToday: 1247,
    avgResponse: 1.2,
    trackedTokens: 4892,
    activePools: 12456,
    quotesChange: 12,
    responseChange: -0.3,
    newTokens: 23,
    poolsUptime: 99.8
  });
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [mainTableFilter, setMainTableFilter] = useState(''); // Separate filter for main table
  const [searchInputRect, setSearchInputRect] = useState<DOMRect | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Update input position when dropdown should show
  useEffect(() => {
    if (showSearchResults && searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setSearchInputRect(rect);
    }
  }, [showSearchResults]);

  // Effect for real-time updates with simple terminal animation
  useEffect(() => {
    const intervalId = setInterval(() => {
      setTokens(currentTokens =>
        currentTokens.map(token => {
          const price = token.price || 0;
          // Simulate a small price change: +/- 0.01% to 0.1%
          const changePercent = (Math.random() - 0.5) * 0.002; // Max 0.1% change
          const newPrice = Math.max(0.000001, price * (1 + changePercent)); // Ensure price doesn't go to 0 or negative
          
          const prevDayPrice = previousDayPrices[token.id] || newPrice / (1 + (Math.random() - 0.5) * 0.02); // Fallback if not found
          const newPriceChange24h = ((newPrice - prevDayPrice) / prevDayPrice) * 100;

          // Simple terminal-style price change tracking
          if (newPrice !== price && Math.abs(newPrice - price) > 0.000001) { // Only trigger if there's a meaningful change
            const direction = newPrice > price ? 'increase' : 'decrease';
            
            setPriceUpdates(prev => ({ 
              ...prev, 
              [token.id]: {
                isUpdating: true,
                direction,
                timestamp: Date.now()
              }
            }));
          }

          // Simulate 1h price change as well
          const newPriceChange1h = token.priceChange1h !== undefined 
            ? token.priceChange1h + (Math.random() - 0.5) * 0.1 // Small random change
            : undefined;

          return {
            ...token,
            price: newPrice,
            priceChange1h: newPriceChange1h,
            priceChange24h: newPriceChange24h,
            lastUpdated: Date.now(),
          };
        })
      );
    }, 12000); // Update every 12 seconds

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, [previousDayPrices]); // Rerun if previousDayPrices changes (though it won't in this setup after init)

  // Simple animation cleanup effect
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    
    Object.keys(priceUpdates).forEach(tokenId => {
      const update = priceUpdates[tokenId];
      if (update && update.isUpdating) {
        const timeout = setTimeout(() => {
          setPriceUpdates(prev => ({ 
            ...prev, 
            [tokenId]: { ...prev[tokenId], isUpdating: false }
          }));
        }, 500); // Reduced from 1200ms to 500ms
        timeouts.push(timeout);
      }
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [priceUpdates]);

  // Helper function to generate simplified price change effect
  const getTerminalPriceClasses = (tokenId: string) => {
    const update = priceUpdates[tokenId];
    if (!update || !update.isUpdating) return '';
    
    const isIncrease = update.direction === 'increase';
    
    // Simplified styling - just color and subtle background, no padding to avoid text movement
    return `${isIncrease ? 'text-[#03ffbb]' : 'text-[#ff3366]'} 
            font-medium
            ${isIncrease 
              ? 'bg-[#03ffbb]/10' 
              : 'bg-[#ff3366]/10'
            }
            rounded transition-all duration-150 ease-out`;
  };

  // Effect for real-time stats updates
  useEffect(() => {
    const statsIntervalId = setInterval(() => {
      setStatsData(prevStats => {
        // Generate realistic incremental changes
        const quotesIncrement = Math.floor(Math.random() * 10) + 1; // 1-10 new quotes
        const responseChange = (Math.random() - 0.5) * 0.1; // +/- 0.05s
        const newTokensChance = Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0; // Occasional new tokens
        const poolsIncrement = Math.random() > 0.8 ? Math.floor(Math.random() * 5) + 1 : 0; // Occasional new pools
        
        return {
          quotesToday: prevStats.quotesToday + quotesIncrement,
          avgResponse: Math.max(0.5, Math.min(3.0, prevStats.avgResponse + responseChange)), // Keep between 0.5-3.0s
          trackedTokens: prevStats.trackedTokens + newTokensChance,
          activePools: prevStats.activePools + poolsIncrement,
          quotesChange: Math.floor((quotesIncrement / prevStats.quotesToday) * 100 * 100) / 100, // Calculate percentage
          responseChange: responseChange,
          newTokens: prevStats.newTokens + newTokensChance,
          poolsUptime: Math.max(95.0, Math.min(100.0, prevStats.poolsUptime + (Math.random() - 0.5) * 0.1)) // Keep between 95-100%
        };
      });
    }, 8000); // Update stats every 8 seconds (different from price updates)

    return () => clearInterval(statsIntervalId);
  }, []);

  // Effect to set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Effect for path quality updates
  useEffect(() => {
    if (!isClient) return;
    
    const pathQualityIntervalId = setInterval(() => {
      setPathQualityUpdateTrigger(prev => prev + 1);
    }, 5000); // Update path quality every 5 seconds

    return () => clearInterval(pathQualityIntervalId);
  }, []); // Empty dependency array to prevent re-running

  // Effect for protocol uptime updates
  useEffect(() => {
    if (!isClient) return;
    
    const protocolUptimeIntervalId = setInterval(() => {
      setProtocolUptimes(prev => ({
        uniswapV3: Math.max(95.0, Math.min(99.9, prev.uniswapV3 + (Math.random() - 0.5) * 0.2)),
        uniswapV2: Math.max(95.0, Math.min(99.9, prev.uniswapV2 + (Math.random() - 0.5) * 0.15)),
        pancakeSwap: Math.max(95.0, Math.min(99.9, prev.pancakeSwap + (Math.random() - 0.5) * 0.25)),
        curve: Math.max(95.0, Math.min(99.9, prev.curve + (Math.random() - 0.5) * 0.1))
      }));
    }, 7000); // Update protocol uptimes every 7 seconds

    return () => clearInterval(protocolUptimeIntervalId);
  }, []); // Empty dependency array to prevent re-running

  // Separate filtering logic for search dropdown
  const searchDropdownResults = useMemo(() => {
    if (!searchTerm) return [];
    
    return tokens.filter(token => {
      return token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
             token.address.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [tokens, searchTerm]);

  // Main table filtering logic (separate from search dropdown)
  const filteredAndSortedTokens = useMemo(() => {
    let filtered = tokens.filter(token => {
      const matchesSearch = mainTableFilter ? (
        token.name.toLowerCase().includes(mainTableFilter.toLowerCase()) ||
        token.symbol.toLowerCase().includes(mainTableFilter.toLowerCase()) ||
        token.address.toLowerCase().includes(mainTableFilter.toLowerCase())
      ) : true;
      
      const matchesWatchlist = !showWatchlistedOnly || token.isWatchlisted;
      
      return matchesSearch && matchesWatchlist;
    });

    return filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tokens, mainTableFilter, sortField, sortDirection, showWatchlistedOnly]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleWatchlist = (tokenId: string) => {
    setTokens(prev => prev.map(token => 
      token.id === tokenId 
        ? { ...token, isWatchlisted: !token.isWatchlisted }
        : token
    ));
  };

  const formatPrice = (price: number) => {
    if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 4 : 2
    }).format(price);
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${marketCap.toFixed(0)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
    return `$${volume.toFixed(2)}`;
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const formatTimeAgo = (timestamp: number) => {
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
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        <ArrowUpDown className="w-3 h-3 opacity-50" />
        {sortField === field && (
          <div className="w-2 h-2 rounded-full bg-primary" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="w-full px-6 py-4 space-y-4">
      {/* Quick Search Card - Always Visible */}
      <Card className="frosted-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="relative flex-1 max-w-2xl">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search tokens by name, symbol, or address for live prices..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSearchResults(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowSearchResults(searchTerm.length > 0)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                  className="pl-12 h-12 text-base tycho-focus border"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="tycho-mono px-3 py-1 text-sm">
                  {filteredAndSortedTokens.length} tokens
                </Badge>
                {mainTableFilter && (
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-[#03ffbb]/10 to-[#00d199]/10 border border-[#03ffbb]/30 rounded-lg backdrop-blur-sm">
                    <div className="flex items-center space-x-2">
                      <Filter className="w-4 h-4 text-[#03ffbb]" />
                      <span className="text-sm font-medium text-[#03ffbb]">Filter:</span>
                      <Badge variant="secondary" className="bg-[#03ffbb]/20 text-[#03ffbb] border-[#03ffbb]/30 tycho-mono">
                        {mainTableFilter}
                      </Badge>
                    </div>
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-[#03ffbb]/20 text-[#03ffbb] hover:text-[#03ffbb]"
                      onClick={() => setMainTableFilter('')}
                    >
                      ×
                    </Button>
                  </div>
                )}
                <Button variant="outline" size="sm" className="h-10 px-4">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
            
            {/* Hide Widgets button moved to the right */}
            <div className="ml-4">
              <Button 
                variant={showWidgets ? "default" : "outline"} 
                size="sm"
                className="h-10 px-4"
                onClick={() => setShowWidgets(!showWidgets)}
              >
                <Activity className="w-4 h-4 mr-2" />
                {showWidgets ? 'Hide Widgets' : 'Show Widgets'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showWidgets && (
        <>

          {/* Compact Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="stats-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Quotes Today</p>
                <p className="text-lg font-bold tycho-mono modern-number transition-all duration-500 hover:scale-105 hover:text-[#03ffbb] hover:drop-shadow-[0_0_8px_rgba(3,255,187,0.5)]">
                  {statsData.quotesToday.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                </p>
              </div>
              <Eye className="w-6 h-6 text-muted-foreground animate-card-icon-pulse" />
            </div>
            <p className={`text-xs modern-number transition-colors duration-300 ${
              statsData.quotesChange >= 0 ? 'tycho-positive' : 'tycho-negative'
            }`}>
              {statsData.quotesChange >= 0 ? '+' : ''}{statsData.quotesChange.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        
        <Card className="stats-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Response</p>
                <p className="text-lg font-bold tycho-mono modern-number transition-all duration-500 hover:scale-105 hover:text-[#03ffbb] hover:drop-shadow-[0_0_8px_rgba(3,255,187,0.5)]">
                  {statsData.avgResponse.toFixed(1)}s
                </p>
              </div>
              <Clock className="w-6 h-6 text-muted-foreground animate-card-icon-spin" />
            </div>
            <p className={`text-xs modern-number transition-colors duration-300 ${
              statsData.responseChange <= 0 ? 'tycho-positive' : 'tycho-negative'
            }`}>
              {statsData.responseChange <= 0 ? '' : '+'}{statsData.responseChange.toFixed(2)}s
            </p>
          </CardContent>
        </Card>
        
        <Card className="stats-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tracked Tokens</p>
                <p className="text-lg font-bold tycho-mono modern-number transition-all duration-500 hover:scale-105 hover:text-[#03ffbb] hover:drop-shadow-[0_0_8px_rgba(3,255,187,0.5)]">
                  {statsData.trackedTokens.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                </p>
              </div>
              <Activity className="w-6 h-6 text-muted-foreground animate-card-icon-pulse" />
            </div>
            <p className="text-xs text-blue-500 modern-number transition-all duration-300">
              +{statsData.newTokens} new
            </p>
          </CardContent>
        </Card>
        
        <Card className="stats-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Pools</p>
                <p className="text-lg font-bold tycho-mono modern-number transition-all duration-500 hover:scale-105 hover:text-[#03ffbb] hover:drop-shadow-[0_0_8px_rgba(3,255,187,0.5)]">
                  {statsData.activePools.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-muted-foreground animate-card-icon-bounce" />
            </div>
            <p className="text-xs tycho-positive modern-number transition-all duration-300">
              {statsData.poolsUptime.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>



      {/* Compact Watchlist, Top Movers, and Protocols */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compact Watchlist Widget */}
        <Card className="data-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center space-x-2">
                <Star className="w-4 h-4" />
                <span>Watchlist</span>
              </h3>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
            <ScrollArea className="h-32 w-full">
              <div className="space-y-2">
                {mockWatchlist.slice(0, 3).map((item) => (
                  <div key={item.token.id} className="mini-card flex items-center justify-between py-2 rounded px-3 mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {item.token.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.token.symbol}</p>
                        <p className="text-xs text-muted-foreground">{item.token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium tycho-mono ${
                        getTerminalPriceClasses(item.token.id) || ''
                      }`}>
                        {formatPrice(item.token.price || 0)}
                      </p>
                      <div className={`flex items-center justify-end space-x-1 ${
                        (item.token.priceChange24h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                      }`}>
                        {(item.token.priceChange24h || 0) >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span className="text-xs tycho-mono">
                          {formatPercentage(item.token.priceChange24h || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Compact Top Movers Widget */}
        <Card className="data-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Top Movers (24h)</span>
              </h3>
              <Badge variant="outline" className="text-xs">Live</Badge>
            </div>
            <ScrollArea className="h-32 w-full">
              <div className="space-y-2">
                {mockTopMovers.slice(0, 3).map((mover) => (
                  <div key={mover.token.id} className="mini-card flex items-center justify-between py-2 rounded px-3 mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs w-6 h-5 flex items-center justify-center p-0">
                        {mover.rank}
                      </Badge>
                      {getTokenLogo(mover.token)}
                      <div>
                        <p className="text-sm font-medium">{mover.token.symbol}</p>
                        <p className="text-xs text-muted-foreground">{formatVolume(mover.volume24h)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium tycho-mono ${
                        getTerminalPriceClasses(mover.token.id) || ''
                      }`}>
                        {formatPrice(mover.token.price || 0)}
                      </p>
                      <div className={`flex items-center justify-end space-x-1 ${
                        (mover.token.priceChange24h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                      }`}>
                        {(mover.token.priceChange24h || 0) >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span className="text-xs tycho-mono">
                          {formatPercentage(mover.token.priceChange24h || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Compact Protocols Widget */}
        <Card className="data-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center space-x-2">
                <Network className="w-4 h-4" />
                <span>Active Protocols</span>
              </h3>
              <Badge variant="outline" className="text-xs">12 DEXs</Badge>
            </div>
            <ScrollArea className="h-32 w-full">
              <div className="space-y-2">
                {/* Uniswap V3 */}
                <div className="mini-card flex items-center justify-between py-2 rounded px-3 mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#ff007a] to-[#ff4081] flex items-center justify-center shadow-lg ring-2 ring-white/10">
                      <span className="text-white text-xs font-bold">U3</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Uniswap V3</p>
                      <p className="text-xs text-muted-foreground">Concentrated liquidity</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <p className="text-sm font-medium tycho-mono text-[#03ffbb] cursor-help hover:scale-105 transition-transform">{protocolUptimes.uniswapV3.toFixed(1)}%</p>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64" side="top">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-[#03ffbb]">Uniswap V3 Uptime</h4>
                          <p className="text-xs text-muted-foreground">
                            Protocol availability and reliability over the last 24 hours. High uptime indicates stable liquidity and consistent trading opportunities.
                          </p>
                          <div className="pt-2 border-t border-border">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Current:</span>
                              <span className="text-[#03ffbb]">{protocolUptimes.uniswapV3.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                    <p className="text-xs text-muted-foreground">uptime</p>
                  </div>
                </div>

                {/* Uniswap V2 */}
                <div className="mini-card flex items-center justify-between py-2 rounded px-3 mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#ff007a] to-[#ff6b9d] flex items-center justify-center shadow-lg ring-2 ring-white/10">
                      <span className="text-white text-xs font-bold">U2</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Uniswap V2</p>
                      <p className="text-xs text-muted-foreground">Classic AMM</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <p className="text-sm font-medium tycho-mono text-[#03ffbb] cursor-help hover:scale-105 transition-transform">{protocolUptimes.uniswapV2.toFixed(1)}%</p>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64" side="top">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-[#03ffbb]">Uniswap V2 Uptime</h4>
                          <p className="text-xs text-muted-foreground">
                            Classic AMM protocol availability. V2 typically has higher uptime due to its simpler architecture and battle-tested codebase.
                          </p>
                          <div className="pt-2 border-t border-border">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Current:</span>
                              <span className="text-[#03ffbb]">{protocolUptimes.uniswapV2.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                    <p className="text-xs text-muted-foreground">uptime</p>
                  </div>
                </div>

                {/* PancakeSwap */}
                <div className="mini-card flex items-center justify-between py-2 rounded px-3 mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#d1884f] to-[#ffb300] flex items-center justify-center shadow-lg ring-2 ring-white/10">
                      <span className="text-white text-xs font-bold">🥞</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">PancakeSwap</p>
                      <p className="text-xs text-muted-foreground">BSC leader</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <p className="text-sm font-medium tycho-mono text-[#03ffbb] cursor-help hover:scale-105 transition-transform">{protocolUptimes.pancakeSwap.toFixed(1)}%</p>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64" side="top">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-[#03ffbb]">PancakeSwap Uptime</h4>
                          <p className="text-xs text-muted-foreground">
                            Leading BSC DEX availability. Cross-chain operations may experience slightly more variability due to network dependencies.
                          </p>
                          <div className="pt-2 border-t border-border">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Current:</span>
                              <span className="text-[#03ffbb]">{protocolUptimes.pancakeSwap.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                    <p className="text-xs text-muted-foreground">uptime</p>
                  </div>
                </div>

                {/* Curve */}
                <div className="mini-card flex items-center justify-between py-2 rounded px-3 mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#40e0d0] to-[#00ced1] flex items-center justify-center shadow-lg ring-2 ring-white/10">
                      <span className="text-white text-xs font-bold">⚡</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Curve</p>
                      <p className="text-xs text-muted-foreground">Stablecoin specialist</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <p className="text-sm font-medium tycho-mono text-[#03ffbb] cursor-help hover:scale-105 transition-transform">{protocolUptimes.curve.toFixed(1)}%</p>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64" side="top">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-[#03ffbb]">Curve Uptime</h4>
                          <p className="text-xs text-muted-foreground">
                            Stablecoin-focused DEX with exceptional reliability. Optimized for low-slippage trades between similar assets.
                          </p>
                          <div className="pt-2 border-t border-border">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Current:</span>
                              <span className="text-[#03ffbb]">{protocolUptimes.curve.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                    <p className="text-xs text-muted-foreground">uptime</p>
                  </div>
                </div>

                {/* SushiSwap */}
                <div className="mini-card flex items-center justify-between py-2 rounded px-3 mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#fa52a0] to-[#a755dd] flex items-center justify-center shadow-lg ring-2 ring-white/10">
                      <span className="text-white text-xs font-bold">🍣</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">SushiSwap</p>
                      <p className="text-xs text-muted-foreground">Multi-chain DEX</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tycho-mono text-[#03ffbb]">98.2%</p>
                    <p className="text-xs text-muted-foreground">uptime</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
            
            {/* More protocols indicator */}
            <div className="text-center pt-2">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-[#03ffbb]">
                <Plus className="w-3 h-3 mr-1" />
                +7 more protocols
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
        </>
      )}

      {/* Compact Header */}
      <div className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#03ffbb] to-[#00d199] flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#1a0b2e]" />
            </div>
            <span>Price List</span>
          </h1>
          <p className="text-sm text-muted-foreground ml-11">
            {showWidgets ? 'Live prices with widgets and advanced analysis' : 'Clean price list view'}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button 
            variant={showWatchlistedOnly ? "default" : "outline"} 
            size="sm"
            className="h-9 px-4"
            onClick={() => setShowWatchlistedOnly(!showWatchlistedOnly)}
          >
            <Star className="w-4 h-4 mr-2" />
            Watchlist Only
          </Button>
        </div>
      </div>



      {/* Price Table */}
      <Card className="table-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <DollarSign className="w-4 h-4" />
            <span>Token Prices</span>
          </CardTitle>
          <CardDescription className="text-sm">
            Live prices with 1h, 24h and 7d changes, market cap data, and price path analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 h-10"></TableHead>
                <SortableHeader field="rank">#</SortableHeader>
                <SortableHeader field="name">Token</SortableHeader>
                <SortableHeader field="price">Price</SortableHeader>
                <TableHead>Path Quality</TableHead>
                <SortableHeader field="priceChange1h">1h %</SortableHeader>
                <SortableHeader field="priceChange24h">24h %</SortableHeader>
                <SortableHeader field="priceChange7d">7d %</SortableHeader>
                <SortableHeader field="marketCap">Market Cap</SortableHeader>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedTokens.map((token) => {
                // Dynamic path quality data that changes over time
                const getPathQuality = (symbol: string) => {
                  // Use stable values during SSR, dynamic values on client
                  const now = isClient ? Date.now() + pathQualityUpdateTrigger : 0;
                  const timeVariation = isClient ? Math.sin(now / 10000) * 0.5 + Math.cos(now / 15000) * 0.3 : 0;
                  const gasVariation = isClient ? Math.sin(now / 8000) * 0.002 + Math.cos(now / 12000) * 0.001 : 0;
                  
                  const baseValues: Record<string, { confidence: number; hops: number; gasEstimate: number; paths: string[][] }> = {
                    'ETH': { 
                      confidence: 98.5, 
                      hops: 1, 
                      gasEstimate: 0.004,
                      paths: [['USDC', 'ETH'], ['WETH', 'ETH'], ['DAI', 'WETH', 'ETH']]
                    },
                    'USDC': { 
                      confidence: 99.2, 
                      hops: 1, 
                      gasEstimate: 0.003,
                      paths: [['USDC'], ['DAI', 'USDC'], ['WETH', 'USDC']]
                    },
                    'UNI': { 
                      confidence: 96.8, 
                      hops: 2, 
                      gasEstimate: 0.006,
                      paths: [['WETH', 'UNI'], ['USDC', 'WETH', 'UNI'], ['DAI', 'UNI']]
                    },
                    'ARB': { 
                      confidence: 95.4, 
                      hops: 2, 
                      gasEstimate: 0.007,
                      paths: [['WETH', 'ARB'], ['USDC', 'ARB'], ['WETH', 'USDC', 'ARB']]
                    },
                    'OP': { 
                      confidence: 94.9, 
                      hops: 2, 
                      gasEstimate: 0.008,
                      paths: [['WETH', 'OP'], ['USDC', 'WETH', 'OP'], ['DAI', 'OP']]
                    },
                    'MATIC': { 
                      confidence: 97.1, 
                      hops: 2, 
                      gasEstimate: 0.005,
                      paths: [['WETH', 'MATIC'], ['USDC', 'MATIC'], ['WETH', 'USDC', 'MATIC']]
                    },
                    'LINK': { 
                      confidence: 96.3, 
                      hops: 2, 
                      gasEstimate: 0.006,
                      paths: [['WETH', 'LINK'], ['USDC', 'WETH', 'LINK'], ['DAI', 'LINK']]
                    },
                    'AAVE': { 
                      confidence: 95.7, 
                      hops: 3, 
                      gasEstimate: 0.009,
                      paths: [['WETH', 'USDC', 'AAVE'], ['DAI', 'WETH', 'AAVE'], ['USDC', 'AAVE']]
                    }
                  };
                  
                  const base = baseValues[symbol] || { 
                    confidence: 95.0, 
                    hops: 2, 
                    gasEstimate: 0.007,
                    paths: [['WETH', symbol], ['USDC', 'WETH', symbol], ['DAI', symbol]]
                  };
                  
                  // Select path based on time for variety
                  const pathIndex = isClient ? Math.floor((now / 8000) % base.paths.length) : 0;
                  const selectedPath = base.paths[pathIndex];
                  
                  return {
                    confidence: Math.max(85, Math.min(99.9, base.confidence + timeVariation)),
                    hops: selectedPath.length - 1,
                    gasEstimate: Math.max(0.001, base.gasEstimate + gasVariation),
                    path: selectedPath
                  };
                };
                
                const pathQuality = getPathQuality(token.symbol);

                return (
                  <TableRow key={token.id} className="enhanced-row h-14">
                    <TableCell className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleWatchlist(token.id)}
                        className="p-1 h-6 w-6 tycho-focus"
                      >
                        {token.isWatchlisted ? (
                          <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        ) : (
                          <StarOff className="w-3 h-3 text-muted-foreground" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-xs h-5 tycho-mono">
                        #{token.rank}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center space-x-2">
                        {getTokenLogo(token)}
                        <div>
                          <p className="text-sm font-medium">{token.name}</p>
                          <p className="text-xs text-muted-foreground">{token.symbol}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`py-2 text-sm font-medium tycho-mono ${
                      getTerminalPriceClasses(token.id) || 'price-hover-effect'
                    }`}>
                      {formatPrice(token.price || 0)}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1">
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <Badge variant={pathQuality.confidence >= 95 ? "default" : "secondary"} className="text-xs h-4 tycho-mono cursor-help">
                                {pathQuality.confidence.toFixed(1)}%
                              </Badge>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80" side="top">
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-[#03ffbb]">Path Confidence</h4>
                                <p className="text-xs text-muted-foreground">
                                  Indicates the reliability and success rate of this trading path. Higher confidence means:
                                </p>
                                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                                  <li>• More stable liquidity pools</li>
                                  <li>• Lower slippage risk</li>
                                  <li>• Better price execution</li>
                                  <li>• Higher success rate for trades</li>
                                </ul>
                                <div className="pt-2 border-t border-border">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Current:</span>
                                    <span className={pathQuality.confidence >= 95 ? "text-[#03ffbb]" : "text-yellow-500"}>
                                      {pathQuality.confidence.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                          <Route className="w-3 h-3 text-muted-foreground" />
                        </div>
                        
                        {/* Mini path visualization with PricePathHover */}
                        <div className="flex items-center space-x-1">
                          <PricePathHover token={token}>
                            <div className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md cursor-pointer transition-all duration-200 backdrop-blur-sm bg-gradient-to-r from-[#1a0b2e]/30 to-[#2a1a3e]/20 border border-[#fff4e0]/10 hover:border-[#03ffbb]/30 hover:bg-gradient-to-r hover:from-[#1a0b2e]/40 hover:to-[#2a1a3e]/30" onClick={(e) => e.stopPropagation()}>
                              {pathQuality.path.map((tokenSymbol, index) => (
                                <React.Fragment key={index}>
                                  <span className={`font-medium text-[10px] pointer-events-none ${
                                    tokenSymbol === 'USDC' ? 'tycho-positive' :
                                    tokenSymbol === 'WETH' || tokenSymbol === 'ETH' ? 'text-purple-400' :
                                    tokenSymbol === 'DAI' ? 'text-orange-400' :
                                    'text-blue-400'
                                  }`}>
                                    {tokenSymbol}
                                  </span>
                                  {index < pathQuality.path.length - 1 && (
                                    <div className="w-1 h-0.5 bg-[#03ffbb] rounded-full pointer-events-none"></div>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </PricePathHover>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground tycho-mono">
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <div className="flex items-center space-x-1 cursor-help hover:text-[#03ffbb] transition-colors">
                                <span>{pathQuality.hops} hop{pathQuality.hops > 1 ? 's' : ''}</span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80" side="top">
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-[#03ffbb]">Trading Hops</h4>
                                <p className="text-xs text-muted-foreground">
                                  Number of intermediate tokens in the trading path from USDC to {token.symbol}.
                                </p>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">1 hop:</span>
                                    <span className="text-[#03ffbb]">Direct pair (best)</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">2 hops:</span>
                                    <span className="text-yellow-500">Via 1 intermediate</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">3+ hops:</span>
                                    <span className="text-orange-500">Multiple intermediates</span>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-border">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Current path:</span>
                                    <span className="text-[#03ffbb]">{pathQuality.hops} hop{pathQuality.hops > 1 ? 's' : ''}</span>
                                  </div>
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <div className="flex items-center space-x-1 cursor-help hover:text-[#03ffbb] transition-colors">
                                <Zap className="w-3 h-3" />
                                <span>${pathQuality.gasEstimate.toFixed(3)}</span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80" side="top">
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-[#03ffbb]">Gas Cost Estimate</h4>
                                <p className="text-xs text-muted-foreground">
                                  Estimated transaction cost in USD for executing this trade path. Includes:
                                </p>
                                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                                  <li>• Base transaction fee</li>
                                  <li>• DEX protocol fees</li>
                                  <li>• Network congestion impact</li>
                                  <li>• Multi-hop execution costs</li>
                                </ul>
                                <div className="pt-2 border-t border-border">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Current estimate:</span>
                                    <span className="text-[#03ffbb]">${pathQuality.gasEstimate.toFixed(3)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs mt-1">
                                    <span className="text-muted-foreground">Updates:</span>
                                    <span className="text-yellow-500">Real-time</span>
                                  </div>
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className={`flex items-center space-x-1 ${
                        (token.priceChange1h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                      }`}>
                        {token.priceChange1h !== undefined ? (
                          <>
                            {(token.priceChange1h || 0) >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-sm font-medium tycho-mono price-hover-effect">
                              {formatPercentage(token.priceChange1h || 0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No data</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className={`flex items-center space-x-1 ${
                        (token.priceChange24h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                      }`}>
                        {token.priceChange24h !== undefined ? (
                          <>
                            {(token.priceChange24h || 0) >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-sm font-medium tycho-mono price-hover-effect">
                              {formatPercentage(token.priceChange24h || 0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No data</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className={`flex items-center space-x-1 ${
                        (token.priceChange7d || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                      }`}>
                        {token.priceChange7d !== undefined ? (
                          <>
                            {(token.priceChange7d || 0) >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-sm font-medium tycho-mono price-hover-effect">
                              {formatPercentage(token.priceChange7d || 0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No data</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-sm font-medium tycho-mono price-hover-effect">
                      {token.marketCap ? formatMarketCap(token.marketCap) : <span className="text-muted-foreground italic">No data</span>}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground tycho-mono">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(token.lastUpdated)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm" className="h-6 px-2 text-xs tycho-focus">
                          <Network className="w-3 h-3 mr-1" />
                          Path
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 tycho-focus"
                          title="View in Network Graph"
                        >
                          <BarChart3 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredAndSortedTokens.length === 0 && (
            <div className="text-center py-8">
              <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-muted-foreground">No tokens found</h3>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search criteria or filters
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results Dropdown - Fixed positioned at the end of component */}
      {showSearchResults && searchInputRect && isClient && (
        <div 
          className="fixed bg-card border border-border rounded-lg shadow-2xl max-h-80 overflow-y-auto"
          style={{
            top: searchInputRect.bottom + window.scrollY + 8,
            left: searchInputRect.left + window.scrollX,
            width: searchInputRect.width,
            zIndex: 999999,
            position: 'fixed'
          }}
        >
          {searchDropdownResults.length > 0 ? (
            <div className="p-2">
              <p className="text-xs text-muted-foreground mb-2 px-2">
                {searchDropdownResults.length} token{searchDropdownResults.length !== 1 ? 's' : ''} found
              </p>
              {searchDropdownResults.slice(0, 8).map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setMainTableFilter(token.symbol);
                    setSearchTerm('');
                    setShowSearchResults(false);
                  }}
                >
                  <div className="flex items-center space-x-3">
                    {getTokenLogo(token)}
                    <div>
                      <p className="text-sm font-medium">{token.name}</p>
                      <p className="text-xs text-muted-foreground">{token.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tycho-mono">
                      {formatPrice(token.price || 0)}
                    </p>
                    <div className={`flex items-center justify-end space-x-1 ${
                      (token.priceChange24h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                    }`}>
                      {(token.priceChange24h || 0) >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span className="text-xs tycho-mono">
                        {formatPercentage(token.priceChange24h || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {searchDropdownResults.length > 8 && (
                <div className="text-center p-2 text-xs text-muted-foreground">
                  +{searchDropdownResults.length - 8} more results
                </div>
              )}
            </div>
          ) : searchTerm ? (
            <div className="p-4">
              <div className="text-center">
                <Search className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No tokens found for "{searchTerm}"</p>
                <p className="text-xs text-muted-foreground">Try a different search term</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
} 
