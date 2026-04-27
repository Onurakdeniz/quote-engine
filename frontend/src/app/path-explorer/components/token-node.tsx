"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Token } from '@/types/price-quoter';

interface TokenNodeProps {
  token: {
    symbol: string;
    name: string;
    price?: string;
  };
  position: {
    top?: string;
    left?: string;
    right?: string;
    bottom?: string;
  };
  isActive: boolean;
  isAnimating: boolean;
  nodeType: 'source' | 'destination' | 'intermediate';
  size?: 'small' | 'large';
}

export function TokenNode({
  token,
  position,
  isActive,
  isAnimating,
  nodeType,
  size = 'large'
}: TokenNodeProps) {
  const getNodeStyles = () => {
    const baseSize = size === 'large' ? 'w-32 h-32' : 'w-28 h-28';
    const textSize = size === 'large' ? 'text-2xl' : 'text-xl';
    
    let colorClasses = '';
    let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline';
    
    switch (nodeType) {
      case 'source':
        colorClasses = isActive 
          ? 'bg-primary/25 border-primary shadow-primary/50 shadow-2xl' 
          : 'bg-card/98 border-primary/50 hover:border-primary/80 shadow-xl hover:shadow-2xl';
        badgeVariant = isActive ? 'default' : 'outline';
        break;
      case 'destination':
        colorClasses = isActive 
          ? 'bg-destructive/25 border-destructive shadow-destructive/50 shadow-2xl' 
          : 'bg-card/98 border-destructive/50 hover:border-destructive/80 shadow-xl hover:shadow-2xl';
        badgeVariant = isActive ? 'destructive' : 'outline';
        break;
      case 'intermediate':
        if (token.symbol === 'WETH') {
          colorClasses = isActive 
            ? 'bg-secondary/30 border-secondary shadow-secondary/60 shadow-2xl' 
            : 'bg-card/99 border-secondary/70 hover:border-secondary/90 shadow-xl hover:shadow-2xl';
          badgeVariant = isActive ? 'secondary' : 'outline';
        } else {
          colorClasses = isActive 
            ? 'bg-accent/30 border-accent shadow-accent/60 shadow-2xl' 
            : 'bg-card/99 border-accent/70 hover:border-accent/90 shadow-xl hover:shadow-2xl';
          badgeVariant = isActive ? 'default' : 'outline';
        }
        break;
    }

    return {
      nodeClass: `relative ${baseSize} rounded-full flex items-center justify-center font-bold ${textSize} transition-all duration-500 backdrop-blur-sm border-4 ${colorClasses} ${isActive ? 'scale-115' : 'hover:scale-110'} ${isAnimating && isActive ? `animate-pulse shadow-[0_0_60px_20px_hsl(var(--${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'})/0.4)]` : ''}`,
      textClass: `transition-colors duration-300 font-extrabold ${isActive ? `text-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}` : `text-foreground group-hover:text-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}`}`,
      badgeVariant
    };
  };

  const styles = getNodeStyles();

  return (
    <div 
      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group"
      style={position}
    >
      <div className={styles.nodeClass}>
        <span className={styles.textClass}>
          {token.symbol}
        </span>
        
        {/* Pulse rings for active state */}
        {isAnimating && isActive && (
          <>
            <div className={`absolute inset-0 rounded-full border-2 border-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}/30 animate-ping`} />
            <div className={`absolute inset-0 rounded-full border border-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}/20 animate-ping`} style={{ animationDelay: nodeType === 'source' ? '0.5s' : nodeType === 'destination' ? '0.6s' : token.symbol === 'WETH' ? '0.3s' : '0.4s' }} />
          </>
        )}

        {/* Subtle glow effect for inactive nodes */}
        {!isActive && (
          <div className={`absolute inset-0 rounded-full border border-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}/20 group-hover:border-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}/40 transition-all duration-300`} />
        )}
      </div>
      
      {/* Simple badge-style information */}
      <div className="mt-3 flex flex-col items-center gap-1">
        <Badge 
          variant={styles.badgeVariant}
          className={`text-xs px-2 py-1 font-medium transition-all duration-300 ${
            isActive 
              ? `bg-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}/20 text-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'} border-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}/50` 
              : `border-muted-foreground/40 text-muted-foreground/80 hover:border-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}/50 hover:text-${nodeType === 'source' ? 'primary' : nodeType === 'destination' ? 'destructive' : token.symbol === 'WETH' ? 'secondary' : 'accent'}`
          }`}
        >
          {token.name}
        </Badge>
        
        {token.price && (
          <div className="text-xs text-muted-foreground/70 font-medium px-2 py-0.5 bg-background/60 rounded-md backdrop-blur-sm">
            {token.price}
          </div>
        )}
      </div>
    </div>
  );
} 