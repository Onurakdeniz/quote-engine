"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Route, Network, Zap, Clock, Blocks, Shuffle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PricePath } from '@/types/price-quoter';
import { PathCard } from './path-card';
import { useRealTime } from './real-time-context';

interface PathsSidebarProps {
  paths: PricePath[];
  selectedPath: PricePath | null;
  onPathSelect: (path: PricePath) => void;
}

// Skeleton loader component for individual path cards
function PathCardSkeleton({ index }: { index: number }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-card animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-5 bg-muted rounded"></div>
          <div className="w-24 h-4 bg-muted rounded"></div>
        </div>
        <div className="w-4 h-4 bg-muted rounded"></div>
      </div>

      {/* Route details skeleton */}
      <div className="w-32 h-3 bg-muted rounded mb-3"></div>

      {/* Price info skeleton */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="w-20 h-8 bg-muted rounded"></div>
          <div className="w-16 h-6 bg-muted rounded"></div>
        </div>
        
        <div className="w-40 h-3 bg-muted rounded"></div>

        <div className="flex items-center justify-between">
          <div>
            <div className="w-16 h-3 bg-muted rounded mb-1"></div>
            <div className="w-12 h-4 bg-muted rounded"></div>
          </div>
          <div>
            <div className="w-12 h-3 bg-muted rounded mb-1"></div>
            <div className="w-10 h-4 bg-muted rounded"></div>
          </div>
        </div>

        {/* Trading fees skeleton */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div>
            <div className="w-20 h-3 bg-muted rounded mb-1"></div>
            <div className="w-12 h-4 bg-muted rounded"></div>
          </div>
          <div>
            <div className="w-16 h-3 bg-muted rounded mb-1"></div>
            <div className="w-14 h-4 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Empty state component for when no paths are available
function EmptyPathsState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="relative mb-6">
        {/* Main icon container */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center border-2 border-muted/20">
          <Route className="w-10 h-10 text-muted-foreground/60" />
        </div>
        
        {/* Floating decorative elements */}
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
          <Network className="w-3 h-3 text-primary/60" />
        </div>
        <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-secondary/10 rounded-full flex items-center justify-center">
          <Zap className="w-2 h-2 text-secondary/60" />
        </div>
      </div>
      
      <div className="text-center space-y-3 max-w-xs">
        <h3 className="text-lg font-semibold text-foreground">
          Ready to Discover Routes
        </h3>
        
        <p className="text-sm text-muted-foreground leading-relaxed">
          Start path finding to see optimal trading routes across multiple DEXs. We'll analyze liquidity, fees, and slippage in real-time.
        </p>
        
        <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-border/30">
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Network className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground">Multi-DEX</span>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 bg-green-50 dark:bg-green-950/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground">Real-time</span>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 bg-purple-50 dark:bg-purple-950/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Route className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground">Optimal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PathsSidebar({ paths, selectedPath, onPathSelect }: PathsSidebarProps) {
  const { isLoading, lastUpdated, currentBlock } = useRealTime();
  const [isClient, setIsClient] = useState(false);
  const [showingSkeleton, setShowingSkeleton] = useState(false);
  const [nextBlockCountdown, setNextBlockCountdown] = useState(12);

  // Ensure we're on the client side to avoid hydration mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show skeleton when loading starts, hide it after a brief delay when loading ends
  useEffect(() => {
    if (isLoading) {
      setShowingSkeleton(true);
    } else {
      // Add a small delay to show the transition
      const timer = setTimeout(() => {
        setShowingSkeleton(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Countdown timer for next block
  useEffect(() => {
    if (!isClient) return;
    
    const interval = setInterval(() => {
      if (lastUpdated) {
        const now = Date.now();
        const timeSinceLastUpdate = Math.floor((now - lastUpdated.getTime()) / 1000);
        const timeUntilNextBlock = Math.max(0, 12 - (timeSinceLastUpdate % 12));
        setNextBlockCountdown(timeUntilNextBlock);
      } else {
        setNextBlockCountdown(12);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated, isClient]);

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

  // Check if routing might change in the next block
  const isRoutingChangeBlock = currentBlock % 5 === 4; // Next block will be a routing change

  return (
    <Card className="shadow-none border-0 bg-card/90 backdrop-blur-md h-full rounded-none flex flex-col overflow-hidden">
      <CardHeader className="px-6 py-4 flex-shrink-0">
        <CardTitle className="text-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Route className="w-5 h-5 text-secondary-foreground" />
            <span>Available Paths</span>
            {isLoading && (
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-blue-500 animate-pulse" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              </div>
            )}
            {isRoutingChangeBlock && !isLoading && (
              <Shuffle className="w-4 h-4 text-amber-500 animate-pulse" />
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Network className="w-4 h-4 text-blue-500" />
            <Badge variant="outline" className="text-xs px-2 py-1">
              Ethereum
            </Badge>
          </div>
        </CardTitle>
        <div className="text-muted-foreground/80 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span>Updates every block (~12s minimum)</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last: {isClient ? formatLastUpdated(lastUpdated) : 'Loading...'}
              </span>
              <span className="flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${nextBlockCountdown <= 3 ? 'text-blue-500' : ''}`} />
                Next: {isClient ? `${nextBlockCountdown}s` : '12s'}
              </span>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs">
            <Blocks className="w-3 h-3" />
            <span>{isClient ? `Block #${formatBlockNumber(currentBlock)}` : 'Block #---'}</span>
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="px-6 flex-1 flex flex-col overflow-hidden">
        <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {showingSkeleton ? (
            // Show skeleton loaders when processing
            <>
              {[...Array(Math.max(3, paths.length || 3))].map((_, index) => (
                <PathCardSkeleton key={`skeleton-${index}`} index={index} />
              ))}
            </>
          ) : paths.length === 0 ? (
            // Show empty state when no paths and not loading
            <EmptyPathsState />
          ) : (
            // Show actual path cards
            paths.map((path, index) => (
              <PathCard
                key={path.id}
                path={path}
                index={index}
                isSelected={selectedPath?.id === path.id}
                onSelect={onPathSelect}
              />
            ))
          )}
        </div>
        
        {/* Live update status */}
        <div className="mt-4 pt-4 border-t border-border/20 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                isLoading ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50' : 'bg-green-500'
              }`}></div>
              <span>{isLoading ? 'Processing block...' : 'Block synced'}</span>
              {isRoutingChangeBlock && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  Routes changing
                </Badge>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {showingSkeleton ? 'Updating...' : `${paths.length} path${paths.length !== 1 ? 's' : ''} available`}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 