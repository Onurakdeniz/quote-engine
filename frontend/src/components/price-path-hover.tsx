"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { ProtocolIcon } from '@/components/protocol-icon';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  Zap, 
  Clock,
  DollarSign,
  Activity,
  Target,
  Fuel,
  BarChart3,
  Network,
  Route,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { PricePath, Token } from '@/types/price-quoter';

// Global state to prevent multiple hover cards
let activeHoverCard: string | null = null;

interface PricePathHoverProps {
  token: Token;
  children: React.ReactNode;
}

// Protocol information for different trading pairs
interface ProtocolHop {
  fromToken: string;
  toToken: string;
  protocol: string;
  poolFee: string;
  liquidity: string;
}

// Mock price paths with detailed pool and protocol information
const generateMockPaths = (token: Token): (PricePath & { protocols: ProtocolHop[] })[] => {
  const numeraire: Token = {
    id: 'usdc',
    address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6
  };

  // Different possible paths based on token
  if (token.symbol === 'ETH') {
    return [
      {
        id: '1',
        fromToken: numeraire,
        toToken: token,
        hops: [],
        totalGasCost: 0.004,
        grossPrice: 2316.43,
        netPrice: 2307.09,
        spread: 0.4,
        confidence: 98.5,
        path: ['USDC', 'ETH'],
        protocols: [
          {
            fromToken: 'USDC',
            toToken: 'ETH',
            protocol: 'Uniswap V3',
            poolFee: '0.05%',
            liquidity: '$45.2M'
          }
        ]
      },
      {
        id: '2',
        fromToken: numeraire,
        toToken: token,
        hops: [],
        totalGasCost: 0.007,
        grossPrice: 2314.11,
        netPrice: 2297.91,
        spread: 0.7,
        confidence: 96.8,
        path: ['USDC', 'WETH', 'ETH'],
        protocols: [
          {
            fromToken: 'USDC',
            toToken: 'WETH',
            protocol: 'Uniswap V3',
            poolFee: '0.05%',
            liquidity: '$45.2M'
          },
          {
            fromToken: 'WETH',
            toToken: 'ETH',
            protocol: 'Curve',
            poolFee: '0.04%',
            liquidity: '$12.8M'
          }
        ]
      }
    ];
  }

  // Generate protocol paths for other tokens
  const getProtocolsForPath = (path: string[]): ProtocolHop[] => {
    const protocols: ProtocolHop[] = [];
    const protocolOptions = ['Uniswap V3', 'Uniswap V2', 'Curve', 'Balancer', 'SushiSwap'];
    
    for (let i = 0; i < path.length - 1; i++) {
      const fromToken = path[i];
      const toToken = path[i + 1];
      
      // Choose protocol based on token pair
      let protocol = 'Uniswap V3';
      let poolFee = '0.05%';
      let liquidity = '$25.4M';
      
      if ((fromToken === 'USDC' && toToken === 'DAI') || (fromToken === 'DAI' && toToken === 'USDC')) {
        protocol = 'Curve';
        poolFee = '0.04%';
        liquidity = '$89.2M';
      } else if (fromToken === 'WETH' || toToken === 'WETH') {
        protocol = Math.random() > 0.5 ? 'Uniswap V3' : 'Balancer';
        poolFee = protocol === 'Uniswap V3' ? '0.05%' : '0.25%';
        liquidity = protocol === 'Uniswap V3' ? '$67.8M' : '$23.1M';
      } else if (path.length > 2) {
        protocol = protocolOptions[Math.floor(Math.random() * protocolOptions.length)];
        poolFee = ['0.05%', '0.30%', '0.04%', '0.25%', '0.30%'][protocolOptions.indexOf(protocol)];
        liquidity = `$${(Math.random() * 50 + 10).toFixed(1)}M`;
      }
      
      protocols.push({
        fromToken,
        toToken,
        protocol,
        poolFee,
        liquidity
      });
    }
    
    return protocols;
  };

  return [
    {
      id: '1',
      fromToken: numeraire,
      toToken: token,
      hops: [],
      totalGasCost: 0.005,
      grossPrice: token.price || 0,
      netPrice: (token.price || 0) * 0.995,
      spread: 0.5,
      confidence: 97.2,
      path: ['USDC', token.symbol],
      protocols: getProtocolsForPath(['USDC', token.symbol])
    },
    {
      id: '2',
      fromToken: numeraire,
      toToken: token,
      hops: [],
      totalGasCost: 0.008,
      grossPrice: (token.price || 0) * 0.998,
      netPrice: (token.price || 0) * 0.985,
      spread: 1.2,
      confidence: 94.5,
      path: ['USDC', 'WETH', token.symbol],
      protocols: getProtocolsForPath(['USDC', 'WETH', token.symbol])
    },
    {
      id: '3',
      fromToken: numeraire,
      toToken: token,
      hops: [],
      totalGasCost: 0.012,
      grossPrice: (token.price || 0) * 0.996,
      netPrice: (token.price || 0) * 0.975,
      spread: 2.1,
      confidence: 91.8,
      path: ['USDC', 'WETH', 'DAI', token.symbol],
      protocols: getProtocolsForPath(['USDC', 'WETH', 'DAI', token.symbol])
    }
  ];
};

export function PricePathHover({ token, children }: PricePathHoverProps) {
  // State for real-time updates
  const [paths, setPaths] = useState(() => generateMockPaths(token));
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [priceChanges, setPriceChanges] = useState<{[key: string]: 'increase' | 'decrease' | null}>({});

  // Memoize the best path to avoid unnecessary recalculations
  const bestPath = useMemo(() => paths[0], [paths]);

  // Function to simulate real-time path updates
  const updatePaths = useCallback(() => {
    setIsUpdating(true);
    
    // Simulate price fluctuations and path recalculation
    const updatedPaths = generateMockPaths(token).map(path => ({
      ...path,
      // Add some randomness to simulate real market conditions
      grossPrice: path.grossPrice * (0.995 + Math.random() * 0.01),
      netPrice: path.netPrice * (0.995 + Math.random() * 0.01),
      totalGasCost: path.totalGasCost * (0.98 + Math.random() * 0.04),
      confidence: Math.max(85, Math.min(99, path.confidence + (Math.random() - 0.5) * 4)),
      spread: Math.max(0.1, path.spread + (Math.random() - 0.5) * 0.2)
    }));

    // Track price changes for visual effects
    const oldBestPrice = paths[0]?.netPrice || 0;
    const newBestPrice = updatedPaths[0]?.netPrice || 0;
    
    if (oldBestPrice && newBestPrice) {
      const changeType = newBestPrice > oldBestPrice ? 'increase' : 
                        newBestPrice < oldBestPrice ? 'decrease' : null;
      setPriceChanges(prev => ({
        ...prev,
        [token.id]: changeType
      }));

      // Clear the change indicator after animation
      setTimeout(() => {
        setPriceChanges(prev => ({
          ...prev,
          [token.id]: null
        }));
      }, 2000);
    }

    setPaths(updatedPaths);
    setLastUpdate(Date.now());
    setUpdateCount(prev => prev + 1);
    
    setTimeout(() => setIsUpdating(false), 500);
  }, [token, paths]);

  // Auto-update every 3-5 seconds with some randomness
  useEffect(() => {
    const interval = setInterval(() => {
      updatePaths();
    }, 3000 + Math.random() * 2000); // 3-5 seconds

    return () => clearInterval(interval);
  }, [updatePaths]);

  // Update paths when token changes
  useEffect(() => {
    const newPaths = generateMockPaths(token);
    setPaths(newPaths);
    setLastUpdate(Date.now());
  }, [token.id, token.price]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(price);
  };

  const formatGas = (gas: number) => {
    return `${gas.toFixed(4)} ETH`;
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <HoverCard 
      openDelay={300}
      closeDelay={400}
      

    >
      <HoverCardTrigger asChild >
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-80 min-w-80 max-w-80 hover-card-path-ultra-glass" 
        side="top" 
        align="center"
        sideOffset={15}
        alignOffset={0}
      >
        <div className="space-y-4 overflow-hidden">
          {/* Header with update status */}
          <div className="flex items-center justify-between mb-2 min-h-[20px]">
            <div className="flex items-center space-x-2">
              <Activity className={`w-3 h-3 ${isUpdating ? 'text-[#03ffbb] animate-pulse' : 'text-[#fff4e0]/60'}`} />
              <span className="text-xs text-[#fff4e0]/80">Live Path Analysis</span>
            </div>
            <div className="flex items-center space-x-2">
              <RefreshCw className={`w-3 h-3 text-[#03ffbb] ${isUpdating ? 'animate-spin' : ''}`} />
              <span className="text-[10px] text-[#fff4e0]/60">{formatTimeAgo(lastUpdate)}</span>
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 bg-[#03ffbb]/20 text-[#03ffbb] border-[#03ffbb]/40">
                #{updateCount}
              </Badge>
            </div>
          </div>

          {/* Best Path */}
          <div className={`p-4 rounded-xl border border-[#03ffbb]/30 transition-all duration-500 ${
            isUpdating ? 'border-[#03ffbb]/50 bg-[#03ffbb]/5' : ''
          } ${
            priceChanges[token.id] === 'increase' ? 'animate-pulse border-green-400/50 bg-green-400/5' :
            priceChanges[token.id] === 'decrease' ? 'animate-pulse border-red-400/50 bg-red-400/5' : ''
          }`}>
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="w-4 h-4 text-[#03ffbb]" />
                <span className="text-sm font-semibold text-[#03ffbb]">Best Path</span>
                {isUpdating && (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 bg-[#03ffbb]/30 text-[#03ffbb] border-[#03ffbb]/50 animate-pulse">
                    Updating...
                  </Badge>
                )}
              </div>
              
              {/* Visual path - Made smaller */}
              <div className="flex items-center space-x-1 mb-3">
                {bestPath.path.map((tokenSymbol, index) => (
                  <React.Fragment key={index}>
                    <Badge 
                      variant="outline" 
                      className="text-[10px] px-1.5 py-0.5 bg-[#1a0b2e]/60 border-[#03ffbb]/40 text-[#fff4e0] h-5"
                    >
                      {tokenSymbol}
                    </Badge>
                    {index < bestPath.path.length - 1 && (
                      <div className="w-2 h-0.5 bg-[#03ffbb] rounded-full"></div>
                    )}
                  </React.Fragment>
                ))}
              </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#fff4e0]/60">Net Price:</span>
                  <p className={`font-semibold tycho-mono transition-all duration-300 ${
                    priceChanges[token.id] === 'increase' ? 'text-green-400 animate-pulse' :
                    priceChanges[token.id] === 'decrease' ? 'text-red-400 animate-pulse' : 
                    'text-[#03ffbb]'
                  }`}>
                    {formatPrice(bestPath.netPrice)}
                    {priceChanges[token.id] && (
                      <TrendingUp className={`inline w-3 h-3 ml-1 ${
                        priceChanges[token.id] === 'increase' ? 'text-green-400' : 'text-red-400 rotate-180'
                      }`} />
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-[#fff4e0]/60">Confidence:</span>
                  <p className={`font-semibold transition-all duration-300 ${
                    bestPath.confidence > 95 ? 'text-green-400' :
                    bestPath.confidence > 90 ? 'text-[#03ffbb]' : 'text-yellow-400'
                  } ${isUpdating ? 'animate-pulse' : ''}`}>
                    {formatPercentage(bestPath.confidence)}
                    {bestPath.confidence > 95 && <CheckCircle className="inline w-3 h-3 ml-1" />}
                  </p>
                </div>
                <div>
                  <span className="text-[#fff4e0]/60">Gas Cost:</span>
                  <p className={`font-semibold text-[#fff4e0] tycho-mono transition-all duration-300 ${
                    isUpdating ? 'animate-pulse' : ''
                  }`}>{formatGas(bestPath.totalGasCost)}</p>
                </div>
                <div>
                  <span className="text-[#fff4e0]/60">Spread:</span>
                  <p className={`font-semibold transition-all duration-300 ${
                    bestPath.spread < 0.5 ? 'text-green-400' :
                    bestPath.spread < 1.0 ? 'text-[#fff4e0]' : 'text-yellow-400'
                  } ${isUpdating ? 'animate-pulse' : ''}`}>{formatPercentage(bestPath.spread)}</p>
                </div>
              </div>
          </div>

          {/* Alternative Paths Summary */}
          {paths.length > 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Route className="w-3 h-3 text-[#fff4e0]/60" />
                  <p className="text-xs font-medium text-[#fff4e0]/80">Alternative Routes ({paths.length - 1})</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePaths();
                  }}
                  className="flex items-center space-x-1 px-2 py-1 rounded bg-[#03ffbb]/20 hover:bg-[#03ffbb]/30 transition-colors border border-[#03ffbb]/40"
                  disabled={isUpdating}
                >
                  <RefreshCw className={`w-3 h-3 text-[#03ffbb] ${isUpdating ? 'animate-spin' : ''}`} />
                  <span className="text-[9px] text-[#03ffbb]">Refresh</span>
                </button>
              </div>
              <div className="space-y-2">
                {paths.slice(1, 3).map((path, index) => (
                  <div key={path.id} className={`p-2 rounded-lg border border-[#fff4e0]/20 bg-[#1a0b2e]/20 transition-all duration-300 ${
                    isUpdating ? 'opacity-50 animate-pulse' : 'opacity-75 hover:opacity-90'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-[9px] bg-[#fff4e0]/10 border-[#fff4e0]/30 text-[#fff4e0]/70 h-4 px-1.5">
                          #{index + 2}
                        </Badge>
                        <span className="text-[#fff4e0]/70 text-[10px]">{path.path.join(' → ')}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[#fff4e0]/80 tycho-mono text-[10px]">{formatPrice(path.netPrice)}</p>
                        <p className="text-[#fff4e0]/50 text-[9px]">{formatPercentage(path.confidence)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(new Set(path.protocols.map(p => p.protocol))).map((protocol) => (
                        <div key={protocol} className="flex items-center gap-1">
                          <ProtocolIcon protocol={protocol} size={10} />
                          <Badge 
                            variant="secondary" 
                            className={`text-[8px] px-1 py-0 h-3 opacity-60 ${
                              protocol === 'Uniswap V3' ? 'bg-[#ff007a]/10 text-[#ff007a]/80 border-[#ff007a]/20' :
                              protocol === 'Uniswap V2' ? 'bg-[#ff007a]/8 text-[#ff007a]/80 border-[#ff007a]/15' :
                              protocol === 'Curve' ? 'bg-[#40e0d0]/10 text-[#40e0d0]/80 border-[#40e0d0]/20' :
                              protocol === 'Balancer' ? 'bg-[#9333ea]/10 text-[#9333ea]/80 border-[#9333ea]/20' :
                              protocol === 'SushiSwap' ? 'bg-[#fa52a0]/10 text-[#fa52a0]/80 border-[#fa52a0]/20' :
                              'bg-[#03ffbb]/10 text-[#03ffbb]/80 border-[#03ffbb]/20'
                            }`}
                          >
                            {protocol}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Protocol Information */}
          <div className="pt-3 border-t border-[#fff4e0]/10">
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle className="w-3 h-3 text-[#03ffbb]" />
              <p className="text-xs font-semibold text-[#03ffbb]">Selected Route:</p>
            </div>
            <div className="space-y-2">
              {bestPath.protocols.map((hop, index) => (
                <div key={index} className="relative p-3 rounded-lg bg-gradient-to-r from-[#03ffbb]/10 to-[#03ffbb]/5 border-2 border-[#03ffbb]/30 shadow-lg shadow-[#03ffbb]/10">
                  {/* Selected indicator */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#03ffbb] rounded-full border-2 border-[#1a0b2e] flex items-center justify-center">
                    <div className="w-1 h-1 bg-[#1a0b2e] rounded-full"></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-[10px] px-2 py-1 bg-[#03ffbb]/30 text-[#03ffbb] border-[#03ffbb]/50 h-5 font-medium">
                          {hop.fromToken}
                        </Badge>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-0.5 bg-[#03ffbb] rounded-full"></div>
                          <div className="w-1 h-0.5 bg-[#03ffbb] rounded-full"></div>
                          <span className="text-[#03ffbb] text-[12px] font-bold">→</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] px-2 py-1 bg-[#03ffbb]/30 text-[#03ffbb] border-[#03ffbb]/50 h-5 font-medium">
                          {hop.toToken}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2 mb-1">
                        <ProtocolIcon protocol={hop.protocol} size={14} />
                        <Badge 
                          variant="secondary" 
                          className={`text-[10px] px-2 py-1 h-5 font-medium border ${
                            hop.protocol === 'Uniswap V3' ? 'bg-[#ff007a]/25 text-[#ff007a] border-[#ff007a]/40' :
                            hop.protocol === 'Uniswap V2' ? 'bg-[#ff007a]/20 text-[#ff007a] border-[#ff007a]/35' :
                            hop.protocol === 'Curve' ? 'bg-[#40e0d0]/25 text-[#40e0d0] border-[#40e0d0]/40' :
                            hop.protocol === 'Balancer' ? 'bg-[#9333ea]/25 text-[#9333ea] border-[#9333ea]/40' :
                            hop.protocol === 'SushiSwap' ? 'bg-[#fa52a0]/25 text-[#fa52a0] border-[#fa52a0]/40' :
                            'bg-[#03ffbb]/25 text-[#03ffbb] border-[#03ffbb]/40'
                          }`}
                        >
                          {hop.protocol}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-center">
                          <span className="text-[9px] text-[#fff4e0]/50 block">Fee</span>
                          <span className="text-[10px] text-[#03ffbb] font-medium">{hop.poolFee}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[9px] text-[#fff4e0]/50 block">TVL</span>
                          <span className="text-[10px] text-[#03ffbb] font-medium">{hop.liquidity}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Protocol Summary */}
            <div className="mt-3 pt-2 border-t border-[#fff4e0]/10">
              <p className="text-xs text-[#fff4e0]/60 mb-2">Protocols Used:</p>
              <div className="flex flex-wrap gap-1">
                {Array.from(new Set(bestPath.protocols.map(p => p.protocol))).map((protocol) => (
                  <div key={protocol} className="flex items-center gap-1">
                    <ProtocolIcon protocol={protocol} size={12} />
                    <Badge 
                      variant="secondary" 
                      className={`text-[9px] px-1.5 py-0.5 h-4 ${
                        protocol === 'Uniswap V3' ? 'bg-[#ff007a]/20 text-[#ff007a] border-[#ff007a]/30' :
                        protocol === 'Uniswap V2' ? 'bg-[#ff007a]/15 text-[#ff007a] border-[#ff007a]/25' :
                        protocol === 'Curve' ? 'bg-[#40e0d0]/20 text-[#40e0d0] border-[#40e0d0]/30' :
                        protocol === 'Balancer' ? 'bg-[#9333ea]/20 text-[#9333ea] border-[#9333ea]/30' :
                        protocol === 'SushiSwap' ? 'bg-[#fa52a0]/20 text-[#fa52a0] border-[#fa52a0]/30' :
                        'bg-[#03ffbb]/20 text-[#03ffbb] border-[#03ffbb]/30'
                      }`}
                    >
                      {protocol}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
} 
