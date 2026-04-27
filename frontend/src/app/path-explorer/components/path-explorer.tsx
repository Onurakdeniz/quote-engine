"use client";

import React, { useState } from 'react';
import GraphVisualization from './graph-visualization';
import { PathsSidebar } from './paths-sidebar';
import { RealTimeStatus } from './real-time-status';
import { useRealTime } from './real-time-context';
import { Card, CardContent } from '@/components/ui/card';
import { SearchX, TrendingUp, ArrowRight, Zap, Network, Route } from 'lucide-react';

// No Data Component
function NoDataComponent({ fromToken, toToken, pathFindingActive }: { 
  fromToken: string; 
  toToken: string; 
  pathFindingActive: boolean; 
}) {
  return (
    <Card className="h-full flex items-center justify-center bg-gradient-to-br from-card/50 to-muted/30 border-dashed border-2 border-muted-foreground/20 rounded-none">
      <CardContent className="text-center p-8">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
              <SearchX className="w-10 h-10 text-muted-foreground/60" />
            </div>
            {pathFindingActive && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-foreground">
              {pathFindingActive ? 'Searching for Paths...' : 'No Paths Available'}
            </h3>
            
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <span className="px-3 py-1 bg-primary/10 rounded-full text-sm font-medium">
                {fromToken}
              </span>
              <ArrowRight className="w-4 h-4" />
              <span className="px-3 py-1 bg-destructive/10 rounded-full text-sm font-medium">
                {toToken}
              </span>
            </div>
            
            <p className="text-muted-foreground max-w-md">
              {pathFindingActive 
                ? 'Real-time path finding is active. New optimal routes will appear as they are discovered.'
                : 'Click "Find Paths" to start discovering optimal trading routes between these tokens.'
              }
            </p>
          </div>
          
          {pathFindingActive && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live monitoring active</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PathExplorer() {
  const { paths, selectedPath, setSelectedPath, isLoading } = useRealTime();
  const [isAnimating, setIsAnimating] = useState(false);
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState('1');
  const [hops, setHops] = useState('2');
  const [isPathFinding, setIsPathFinding] = useState(false);
  const [pathFindingActive, setPathFindingActive] = useState(true);

  // Only show paths when path finding is active
  const displayPaths = pathFindingActive ? paths : [];
  const displaySelectedPath = pathFindingActive ? selectedPath : null;

  const animatePath = (path: any) => {
    setSelectedPath(path);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 3000);
  };

  const handleSearch = () => {
    setIsPathFinding(true);
    console.log('Starting path finding:', { fromToken, toToken, amount, hops });
    
    // Simulate starting process
    setTimeout(() => {
      setIsPathFinding(false);
      setPathFindingActive(true);
      console.log('Path finding activated');
    }, 2000);
  };

  const handleStop = () => {
    setPathFindingActive(false);
    setSelectedPath(null); // Clear selected path when stopping
    console.log('Path finding stopped');
  };

  return (
    <div className="w-full min-h-[calc(100dvh-9rem)] overflow-visible flex flex-col">
      {/* Header Section with Real-time Status and Search Controls */}
      <div className="bg-card/30 backdrop-blur-sm border-b flex-shrink-0">
        <div className="w-full px-6 py-2">
          <RealTimeStatus
            fromToken={fromToken}
            toToken={toToken}
            amount={amount}
            onFromTokenChange={setFromToken}
            onToTokenChange={setToToken}
            onAmountChange={setAmount}
            onSearch={handleSearch}
            onStop={handleStop}
            isPathFinding={isPathFinding}
            pathFindingActive={pathFindingActive}
            hops={hops}
            onHopsChange={setHops}
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="w-full flex-1 min-h-[640px] overflow-visible xl:overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-0 min-h-[640px] xl:h-full">
          {/* Network Visualization - Takes 2 columns */}
          <div className="xl:col-span-2 min-h-[420px] xl:h-full overflow-hidden">
            {(!displayPaths || displayPaths.length === 0) ? (
              <NoDataComponent 
                fromToken={fromToken} 
                toToken={toToken} 
                pathFindingActive={pathFindingActive}
              />
            ) : (
              <GraphVisualization 
                selectedPath={displaySelectedPath}
                isAnimating={isAnimating}
              />
            )}
          </div>

          {/* Alternative Paths - Takes 1 column */}
          <div className="xl:col-span-1 min-h-[360px] xl:h-full border-l border-border/20 overflow-hidden">
            {(!displayPaths || displayPaths.length === 0) ? (
              <Card className="h-full flex items-center justify-center bg-gradient-to-br from-card/50 to-muted/30 border-dashed border-2 border-muted-foreground/20 rounded-none">
                <CardContent className="text-center p-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-muted-foreground/60" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground">No Paths Found</h4>
                      <p className="text-sm text-muted-foreground">
                        Alternative trading routes will appear here when discovered.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <PathsSidebar
                paths={displayPaths}
                selectedPath={displaySelectedPath}
                onPathSelect={animatePath}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 
