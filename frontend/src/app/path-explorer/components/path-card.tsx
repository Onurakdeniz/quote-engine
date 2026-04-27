"use client";

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ProtocolIcon } from '@/components/protocol-icon';
import { 
  ArrowUp,
  ArrowDown,
  Minus,
  Zap
} from 'lucide-react';
import { PricePath } from '@/types/price-quoter';

interface PathCardProps {
  path: PricePath;
  index: number;
  isSelected: boolean;
  onSelect: (path: PricePath) => void;
}

interface PriceChange {
  value: number;
  direction: 'up' | 'down' | 'neutral';
  percentage: number;
}

export function PathCard({ path, index, isSelected, onSelect }: PathCardProps) {
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<PriceChange | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Track price changes - only on client side
  useEffect(() => {
    if (!isClient) return;
    
    if (previousPrice !== null && previousPrice !== path.netPrice) {
      const change = path.netPrice - previousPrice;
      const percentage = (change / previousPrice) * 100;
      
      setPriceChange({
        value: Math.abs(change),
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
        percentage: Math.abs(percentage)
      });

      // Show update animation
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 1000);
      
      // Clear price change indicator after 3 seconds
      setTimeout(() => setPriceChange(null), 3000);
    }
    setPreviousPrice(path.netPrice);
  }, [path.netPrice, previousPrice, isClient]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const getPriceChangeIcon = () => {
    if (!priceChange) return null;
    
    switch (priceChange.direction) {
      case 'up':
        return <ArrowUp className="w-3 h-3 text-green-500" />;
      case 'down':
        return <ArrowDown className="w-3 h-3 text-red-500" />;
      default:
        return <Minus className="w-3 h-3 text-gray-500" />;
    }
  };

  const getPriceChangeColor = () => {
    if (!priceChange) return '';
    
    switch (priceChange.direction) {
      case 'up':
        return 'text-green-500';
      case 'down':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  // Get DEX names for the route
  const getDexNames = () => {
    return path.hops.map(hop => hop.pool.dex).join(', ');
  };

  // Calculate total trading fees
  const getTotalTradingFees = () => {
    return path.hops.reduce((total, hop) => total + hop.pool.fee, 0);
  };

  // Format fee percentage
  const formatFeePercentage = (fee: number) => {
    return `${(fee * 100).toFixed(3)}%`;
  };

  // Calculate estimated fee cost in USD (approximation based on trade amount)
  const getEstimatedFeeCost = () => {
    const totalFeePercentage = getTotalTradingFees();
    return (path.grossPrice * totalFeePercentage);
  };

  return (
    <div 
      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'border-primary bg-primary/5 shadow-sm' 
          : 'border-border hover:border-primary/50 bg-card'
      } ${isUpdating ? 'ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10 border-blue-500/50' : ''}`}
      onClick={() => onSelect(path)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant={index === 0 ? "default" : "outline"} className="text-xs">
            #{index + 1}
          </Badge>
          <span className="font-medium text-foreground">
            {path.path.join(' → ')}
          </span>
          {priceChange && isClient && (
            <div className="flex items-center gap-1">
              {getPriceChangeIcon()}
              <span className={`text-xs ${getPriceChangeColor()}`}>
                {priceChange.direction === 'up' ? '+' : ''}{priceChange.percentage.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        {isUpdating && isClient && (
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4 text-blue-500 animate-pulse" />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
          </div>
        )}
      </div>

      {/* Route Details */}
      <div className="text-sm text-muted-foreground mb-3">
        {path.hops.length} hop{path.hops.length !== 1 ? 's' : ''} via {getDexNames()}
      </div>

      {/* Price Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-foreground">
            {formatPrice(path.netPrice)}
          </span>
          <Badge 
            variant={path.confidence > 95 ? "default" : "secondary"}
            className="px-2 py-1"
          >
            {path.confidence.toFixed(1)}% confidence
          </Badge>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Net price (after gas: ${(path.totalGasCost * 2500).toFixed(2)})
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-muted-foreground">Gross Price</span>
            <div className="font-medium">{formatPrice(path.grossPrice)}</div>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Spread</span>
            <div className="font-medium">{path.spread.toFixed(2)}%</div>
          </div>
        </div>

        {/* Trading Fees Section */}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-border/30">
          <div>
            <span className="text-muted-foreground">Trading Fees</span>
            <div className="font-medium text-orange-600">
              {formatFeePercentage(getTotalTradingFees())}
            </div>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Est. Fee Cost</span>
            <div className="font-medium text-orange-600">
              {formatPrice(getEstimatedFeeCost())}
            </div>
          </div>
        </div>

        {/* Route Details */}
        <div className="pt-3 border-t border-border/50">
          <div className="text-xs text-muted-foreground font-medium mb-2">Route Details:</div>
          <div className="space-y-1">
            {path.hops.map((hop, hopIndex) => (
              <div key={hopIndex} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span>{hop.tokenIn.symbol} → {hop.tokenOut.symbol}</span>
                  <div className="flex items-center gap-1">
                    <ProtocolIcon protocol={hop.pool.dex} size={12} />
                    <Badge variant="outline" className="text-xs">
                      {hop.pool.dex}
                    </Badge>
                  </div>
                </div>
                <div className="text-orange-600 font-medium">
                  {formatFeePercentage(hop.pool.fee)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 