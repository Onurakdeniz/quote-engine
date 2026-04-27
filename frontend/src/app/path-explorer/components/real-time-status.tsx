"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Activity, 
  Clock, 
  Settings, 
  CheckCircle,
  AlertCircle,
  Zap,
  Blocks,
  ArrowUpDown,
  Loader2,
  Plus,
  Minus,
  Square,
  Play
} from 'lucide-react';
import { useRealTime } from './real-time-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RealTimeStatusProps {
  fromToken: string;
  toToken: string;
  amount: string;
  onFromTokenChange: (value: string) => void;
  onToTokenChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onSearch: () => void;
  onStop?: () => void;
  isPathFinding?: boolean;
  pathFindingActive?: boolean;
  hops?: string;
  onHopsChange?: (value: string) => void;
}

const popularTokens = [
  { symbol: 'ETH', name: 'Ethereum', price: '$2,316.43' },
  { symbol: 'USDC', name: 'USDC', price: '$0.99977' },
  { symbol: 'USDT', name: 'Tether USD', price: '$1.00' },
  { symbol: 'WETH', name: 'Wrapped ETH', price: '$2,316.43' },
  { symbol: 'DAI', name: 'Dai Stablecoin', price: '$0.999668' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', price: '$77,182.00' },
  { symbol: 'UNI', name: 'Uniswap', price: '$3.23' },
  { symbol: 'LINK', name: 'Chainlink', price: '$9.19' }
];

const slippageOptions = ['0.1%', '0.5%', '1.0%', '3.0%'];

export function RealTimeStatus({
  fromToken,
  toToken,
  amount,
  onFromTokenChange,
  onToTokenChange,
  onAmountChange,
  onSearch,
  onStop,
  isPathFinding,
  pathFindingActive,
  hops,
  onHopsChange
}: RealTimeStatusProps) {
  const { 
    selectedPath, 
    isLoading, 
    lastUpdated, 
    updateInterval, 
    currentBlock,
    refreshPaths, 
    setUpdateInterval 
  } = useRealTime();

  const [isClient, setIsClient] = useState(false);
  const [slippage, setSlippage] = useState('0.5%');
  const [isSearching, setIsSearching] = useState(false);

  // Ensure we're on the client side to avoid hydration mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  // Use consistent number formatting to avoid hydration issues
  const formatBlockNumber = (blockNumber: number) => {
    return blockNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const intervalOptions = [
    { label: '1 block (~12s)', value: 12000 },
    { label: '2 blocks (~24s)', value: 24000 },
    { label: '3 blocks (~36s)', value: 36000 },
    { label: '5 blocks (~1m)', value: 60000 },
    { label: '10 blocks (~2m)', value: 120000 },
    { label: '25 blocks (~5m)', value: 300000 },
  ];

  const getUpdateFrequencyBadge = () => {
    const blocks = Math.round(updateInterval / 12000);
    if (blocks === 1) return 'Live (1 block)';
    if (blocks <= 3) return 'High Frequency';
    if (blocks <= 10) return 'Standard';
    return 'Low Frequency';
  };

  const handleSwapTokens = () => {
    const temp = fromToken;
    onFromTokenChange(toToken);
    onToTokenChange(temp);
  };

  const handleSearch = () => {
    setIsSearching(true);
    onSearch();
    
    // Simulate search process (in real app, this would be handled by the parent component)
    setTimeout(() => {
      setIsSearching(false);
    }, 3000);
  };

  return (
    <Card className="bg-card/90 backdrop-blur-md border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-6">
          {/* Left section - Status and Block Info - Only show when path finding is active */}
      

          {/* Right section - Search Controls */}
          <div className={`flex items-center gap-3`}>
            {/* Token Pair */}
            <div className="flex items-center gap-2">
              <Select value={fromToken} onValueChange={onFromTokenChange}>
                <SelectTrigger className="h-8 w-20 text-sm font-medium bg-background/50 border border-primary/20 hover:border-primary/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {popularTokens.map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{token.symbol}</span>
                        <span className="text-xs text-muted-foreground ml-2">{token.price}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="icon"
                onClick={handleSwapTokens}
                className="h-8 w-8 rounded-full border hover:bg-primary/5 transition-all duration-200 hover:scale-105"
              >
                <ArrowUpDown className="h-3 w-3" />
              </Button>
              
              <Select value={toToken} onValueChange={onToTokenChange}>
                <SelectTrigger className="h-8 w-20 text-sm font-medium bg-background/50 border border-destructive/20 hover:border-destructive/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {popularTokens.map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{token.symbol}</span>
                        <span className="text-xs text-muted-foreground ml-2">{token.price}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="flex items-center">
              <div className="flex items-center bg-muted/20 rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const currentAmount = parseFloat(amount) || 0;
                    const newAmount = Math.max(0, currentAmount - 0.1);
                    onAmountChange(newAmount.toFixed(1));
                  }}
                  className="h-8 w-8 p-0 hover:bg-muted/40 rounded-none border-0"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                
                <div className="relative">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => onAmountChange(e.target.value)}
                    className="h-8 w-20 text-sm text-center border-0 bg-transparent focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    step="0.1"
                    min="0"
                  />
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const currentAmount = parseFloat(amount) || 0;
                    const newAmount = currentAmount + 0.1;
                    onAmountChange(newAmount.toFixed(1));
                  }}
                  className="h-8 w-8 p-0 hover:bg-muted/40 rounded-none border-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="ml-2 text-xs text-muted-foreground font-medium">
                {fromToken}
              </div>
            </div>

            {/* Hops Selector */}
            {onHopsChange && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Hops:</span>
                <div className="inline-flex bg-muted/20 rounded-lg p-1 gap-0.5">
                  {['1', '2', '3'].map((hopCount) => (
                    <Button
                      key={hopCount}
                      variant="ghost"
                      size="sm"
                      onClick={() => onHopsChange(hopCount)}
                      className={`h-6 w-8 p-0 text-xs font-semibold transition-all duration-200 rounded-md ${
                        hops === hopCount
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'hover:bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      {hopCount}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Settings */}
            <Select value={slippage} onValueChange={setSlippage}>
              <SelectTrigger className="h-8 w-16 text-sm border hover:border-accent/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {slippageOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Search Button */}
            <Button 
              className="h-8 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200"
              onClick={pathFindingActive ? onStop : handleSearch}
              disabled={isPathFinding}
            >
              {isPathFinding ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Starting...
                </>
              ) : pathFindingActive ? (
                <>
                  <Square className="w-3 h-3 mr-1.5" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1.5" />
                  Find Paths
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
