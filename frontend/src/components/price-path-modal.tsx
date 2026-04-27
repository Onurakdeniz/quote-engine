"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProtocolIcon } from '@/components/protocol-icon';
import { 
  Network, 
  ArrowRight, 
  Zap, 
  TrendingUp,
  DollarSign,
  Fuel,
  Clock,
  Route,
  Eye,
  X,
  CheckCircle,
  Info,
  Star
} from 'lucide-react';
import { PricePath, Token, Pool } from '@/types/price-quoter';

interface PricePathModalProps {
  token: Token;
  isOpen: boolean;
  onClose: () => void;
}

// Mock price paths with detailed pool information
const generateMockPaths = (token: Token): PricePath[] => {
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
        path: ['USDC', 'ETH']
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
        path: ['USDC', 'WETH', 'ETH']
      }
    ];
  }

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
      path: ['USDC', token.symbol]
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
      path: ['USDC', 'ETH', token.symbol]
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
      path: ['USDC', 'WETH', 'DAI', token.symbol]
    }
  ];
};

// Mock pool data
const mockPools = [
  { name: 'Uniswap V3', dex: 'Uniswap', tvl: 125000000, fee: 0.3, volume24h: 45000000 },
  { name: 'Curve Finance', dex: 'Curve', tvl: 89000000, fee: 0.04, volume24h: 32000000 },
  { name: 'Balancer V2', dex: 'Balancer', tvl: 67000000, fee: 0.25, volume24h: 18000000 },
  { name: 'SushiSwap', dex: 'SushiSwap', tvl: 34000000, fee: 0.3, volume24h: 12000000 }
];

export function PricePathModal({ token, isOpen, onClose }: PricePathModalProps) {
  const [selectedPath, setSelectedPath] = useState<PricePath | null>(null);
  const paths = generateMockPaths(token);
  const bestPath = paths[0];

  React.useEffect(() => {
    if (isOpen && paths.length > 0) {
      setSelectedPath(paths[0]);
    }
  }, [isOpen, paths]);

  if (!isOpen) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price);
  };

  const formatGas = (gas: number) => {
    return `${gas.toFixed(6)} ETH`;
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(2)}%`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    return `$${volume.toFixed(0)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold">
                {token.symbol.slice(0, 2)}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{token.name} Price Paths</h2>
              <p className="text-muted-foreground">
                Price discovery analysis for {token.symbol}/USDC
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Path Graph */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Network className="w-5 h-5" />
                  <span>Path Visualization</span>
                </CardTitle>
                <CardDescription>
                  Interactive graph showing token routing and pool connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative h-80 bg-muted rounded-lg p-4 overflow-hidden">
                  {/* Enhanced network visualization */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-full h-full">
                      {/* USDC Node */}
                      <div className="absolute top-1/2 left-8 transform -translate-y-1/2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white font-bold border-4 border-white shadow-lg">
                          USDC
                        </div>
                        <p className="text-center text-xs mt-1 font-medium">Start</p>
                      </div>
                      
                      {/* Intermediate nodes based on selected path */}
                      {selectedPath && selectedPath.path.length > 2 && (
                        <>
                          {selectedPath.path.slice(1, -1).map((tokenSymbol, index) => (
                            <div key={index} className={`absolute ${
                              index === 0 ? 'top-1/4 left-1/3' : 'top-3/4 left-1/2'
                            } transform -translate-y-1/2`}>
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs border-4 border-yellow-400 shadow-lg shadow-yellow-400/50">
                                {tokenSymbol}
                              </div>
                              <p className="text-center text-xs mt-1">{tokenSymbol}</p>
                            </div>
                          ))}
                        </>
                      )}
                      
                      {/* Target Token Node */}
                      <div className="absolute top-1/2 right-8 transform -translate-y-1/2">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold border-4 ${selectedPath ? 'border-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-white'} transition-all duration-300`}>
                          {token.symbol.slice(0, 2)}
                        </div>
                        <p className="text-center text-xs mt-1 font-medium">{token.symbol}</p>
                      </div>
                      
                      {/* Pool Information Overlays */}
                      {selectedPath && (
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="bg-background/90 backdrop-blur-sm rounded-lg p-3 border">
                            <h4 className="font-medium text-sm mb-2">Active Pools</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {mockPools.slice(0, selectedPath.path.length - 1).map((pool, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded bg-muted">
                                  <div className="flex items-center gap-2">
                                    <ProtocolIcon protocol={pool.dex} size={14} />
                                    <span className="font-medium">{pool.dex}</span>
                                  </div>
                                  <Badge variant="secondary" className="text-xs">
                                    {pool.fee}%
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Animated connections */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        <defs>
                          <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" 
                           refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#eab308" />
                          </marker>
                          <marker id="arrowhead-default" markerWidth="10" markerHeight="7" 
                           refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                          </marker>
                        </defs>
                        
                        {selectedPath && selectedPath.path.length === 2 && (
                          <line 
                            x1="20%" y1="50%" x2="80%" y2="50%" 
                            stroke="#eab308" 
                            strokeWidth="3" 
                            markerEnd="url(#arrowhead-selected)"
                            className="animate-pulse"
                          />
                        )}
                        
                        {selectedPath && selectedPath.path.length === 3 && (
                          <>
                            <line 
                              x1="20%" y1="50%" x2="40%" y2="25%" 
                              stroke="#eab308" 
                              strokeWidth="3" 
                              markerEnd="url(#arrowhead-selected)"
                              className="animate-pulse"
                            />
                            <line 
                              x1="40%" y1="25%" x2="80%" y2="50%" 
                              stroke="#eab308" 
                              strokeWidth="3" 
                              markerEnd="url(#arrowhead-selected)"
                              className="animate-pulse"
                            />
                          </>
                        )}
                        
                        {selectedPath && selectedPath.path.length === 4 && (
                          <>
                            <line 
                              x1="20%" y1="50%" x2="40%" y2="25%" 
                              stroke="#eab308" 
                              strokeWidth="3" 
                              markerEnd="url(#arrowhead-selected)"
                              className="animate-pulse"
                            />
                            <line 
                              x1="40%" y1="25%" x2="60%" y2="75%" 
                              stroke="#eab308" 
                              strokeWidth="3" 
                              markerEnd="url(#arrowhead-selected)"
                              className="animate-pulse"
                            />
                            <line 
                              x1="60%" y1="75%" x2="80%" y2="50%" 
                              stroke="#eab308" 
                              strokeWidth="3" 
                              markerEnd="url(#arrowhead-selected)"
                              className="animate-pulse"
                            />
                          </>
                        )}
                        
                        {/* Alternative paths (dimmed) */}
                        {paths.filter(p => p.id !== selectedPath?.id).map((path, pathIndex) => (
                          <g key={path.id} opacity="0.3">
                            {path.path.length === 2 && (
                              <line 
                                x1="20%" y1={`${45 + pathIndex * 2}%`} x2="80%" y2={`${45 + pathIndex * 2}%`}
                                stroke="#64748b" 
                                strokeWidth="1" 
                                markerEnd="url(#arrowhead-default)"
                              />
                            )}
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Path selector */}
                <div className="mt-4 space-y-2">
                  <h4 className="font-medium text-sm">Select Path to Visualize:</h4>
                  <div className="flex flex-wrap gap-2">
                    {paths.map((path, index) => (
                      <Button
                        key={path.id}
                        variant={selectedPath?.id === path.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPath(path)}
                        className="text-xs"
                      >
                        <Badge variant={index === 0 ? "secondary" : "outline"} className="mr-2 text-xs">
                          {index === 0 ? 'Best' : `#${index + 1}`}
                        </Badge>
                        {path.path.join(' → ')}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Path Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Route className="w-5 h-5" />
                  <span>Path Analysis</span>
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of price discovery algorithm results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Algorithm Selection Reasoning */}
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-800 dark:text-green-400">Selected Path</h4>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        <strong>{bestPath.path.join(' → ')}</strong> chosen for optimal net price after gas costs
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-green-600 dark:text-green-400">Net Price:</span>
                          <span className="font-medium ml-1">{formatPrice(bestPath.netPrice)}</span>
                        </div>
                        <div>
                          <span className="text-green-600 dark:text-green-400">Confidence:</span>
                          <span className="font-medium ml-1">{formatPercentage(bestPath.confidence)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected Path Details */}
                {selectedPath && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center space-x-2">
                      <Info className="w-4 h-4" />
                      <span>Path Details</span>
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-3">
                        <div>
                          <p className="text-muted-foreground">Gross Price</p>
                          <p className="font-medium">{formatPrice(selectedPath.grossPrice)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Gas Cost</p>
                          <p className="font-medium">{formatGas(selectedPath.totalGasCost)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Net Price</p>
                          <p className="font-medium text-green-600">{formatPrice(selectedPath.netPrice)}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-muted-foreground">Spread</p>
                          <p className="font-medium">{formatPercentage(selectedPath.spread)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Confidence</p>
                          <p className="font-medium">{formatPercentage(selectedPath.confidence)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Hops</p>
                          <p className="font-medium">{selectedPath.path.length - 1}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pool Information */}
                <div className="space-y-3">
                  <h4 className="font-medium">Pools Used</h4>
                  <div className="space-y-2">
                    {mockPools.slice(0, selectedPath ? selectedPath.path.length - 1 : 1).map((pool, index) => (
                      <div key={index} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ProtocolIcon protocol={pool.dex} size={16} />
                            <span className="font-medium">{pool.name}</span>
                          </div>
                          <Badge variant="secondary">{pool.dex}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div>TVL: {formatVolume(pool.tvl)}</div>
                          <div>Fee: {pool.fee}%</div>
                          <div>24h Vol: {formatVolume(pool.volume24h)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alternative Paths Table */}
          <Card>
            <CardHeader>
              <CardTitle>Alternative Paths Comparison</CardTitle>
              <CardDescription>
                All discovered paths ranked by algorithm efficiency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paths.map((path, index) => (
                  <div 
                    key={path.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedPath?.id === path.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    } ${index === 0 ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}
                    onClick={() => setSelectedPath(path)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {index === 0 && <CheckCircle className="w-5 h-5 text-green-500" />}
                        <Badge variant={index === 0 ? "default" : "outline"} className="text-xs">
                          {index === 0 ? 'Best Path' : `Alternative #${index}`}
                        </Badge>
                        <span className="font-medium">
                          {path.path.join(' → ')}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {path.path.length - 1} hop{path.path.length > 2 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Gross Price</p>
                        <p className="font-medium">{formatPrice(path.grossPrice)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Gas Cost</p>
                        <p className="font-medium">{formatGas(path.totalGasCost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Net Price</p>
                        <p className={`font-medium ${index === 0 ? 'text-green-600' : ''}`}>
                          {formatPrice(path.netPrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Spread</p>
                        <p className="font-medium">{formatPercentage(path.spread)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Confidence</p>
                        <p className="font-medium">{formatPercentage(path.confidence)}</p>
                      </div>
                    </div>
                    
                    {index === 0 && (
                      <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/30 rounded text-xs text-green-700 dark:text-green-300">
                        <strong>Why chosen:</strong> Highest net price after deducting gas costs with excellent liquidity confidence
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 
