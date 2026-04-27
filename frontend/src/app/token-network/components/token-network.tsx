"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useNetworkRealTime, 
  NetworkToken, 
  OptimalPath 
} from './network-real-time-context';
import NetworkGraphVisualization from './network-graph-visualization';
import NetworkPathsSidebar from './network-paths-sidebar';
import { 
  Network, 
  BarChart3, 
  Globe2, 
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Users,
  DollarSign,
  RefreshCw,
  Play,
  Pause,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

export function TokenNetwork() {
  const { 
    tokens, 
    pools, 
    optimalPaths, 
    selectedToken, 
    selectedPath, 
    metrics, 
    isLoading, 
    lastUpdated, 
    updateInterval, 
    currentBlock, 
    networkHealth,
    setSelectedToken,
    setSelectedPath,
    refreshNetworkData,
    setUpdateInterval
  } = useNetworkRealTime();

  const [showSidebar, setShowSidebar] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [selectedView, setSelectedView] = useState<'graph' | 'topology' | 'analysis'>('graph');

  const networkStats = [
    { 
      label: 'Total Tokens', 
      value: metrics.totalNodes.toString(), 
      icon: Globe2, 
      change: `+${Math.floor(metrics.totalNodes * 0.05)}`,
      color: 'text-blue-400'
    },
    { 
      label: 'Active Connections', 
      value: metrics.totalEdges.toString(), 
      icon: Network, 
      change: `+${Math.floor(metrics.totalEdges * 0.12)}`,
      color: 'text-green-400'
    },
    { 
      label: 'Network Density', 
      value: `${(metrics.networkDensity * 100).toFixed(1)}%`, 
      icon: BarChart3, 
      change: `+${(metrics.networkDensity * 5).toFixed(1)}%`,
      color: 'text-purple-400'
    },
    { 
      label: 'Avg Connectivity', 
      value: metrics.avgConnectivity.toFixed(1), 
      icon: TrendingUp, 
      change: `+${(metrics.avgConnectivity * 0.1).toFixed(1)}`,
      color: 'text-yellow-400'
    },
  ];

  const handleTokenSelect = (token: NetworkToken) => {
    setSelectedToken(token);
  };

  const handlePathSelect = (path: OptimalPath) => {
    setSelectedPath(path);
  };

  const toggleAutoUpdate = () => {
    if (autoUpdate) {
      setUpdateInterval(0);
      setAutoUpdate(false);
    } else {
      setUpdateInterval(8000);
      setAutoUpdate(true);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return '🟢';
      case 'warning': return '🟡';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="w-full min-h-[calc(100dvh-9rem)] flex flex-col overflow-visible">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-3xl font-bold">Enhanced Token Network</h1>
            <p className="text-muted-foreground">
              Real-time network analysis with optimal path discovery
            </p>
          </div>
          
          {/* Network health indicator */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Network Health:</span>
            <Badge variant="outline" className={getHealthColor(networkHealth)}>
              {getHealthIcon(networkHealth)} {networkHealth.toUpperCase()}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Real-time status */}
          <div className="flex items-center space-x-2 text-sm">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${autoUpdate ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-muted-foreground">
                {autoUpdate ? 'Live' : 'Paused'}
              </span>
            </div>
            {lastUpdated && (
              <span className="text-muted-foreground">
                • Block {currentBlock.toLocaleString()}
              </span>
            )}
          </div>
          
          {/* Controls */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAutoUpdate}
            className="flex items-center space-x-2"
          >
            {autoUpdate ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={refreshNetworkData}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSidebar(!showSidebar)}
            className="flex items-center space-x-2"
          >
            {showSidebar ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Hide Panel</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Show Panel</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Network Stats */}
      <div className="p-6 border-b border-border bg-background/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {networkStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="glass-morphism">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <Badge variant="outline" className="text-xs tycho-positive">
                        {stat.change}
                      </Badge>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-[640px] flex overflow-visible xl:overflow-hidden">
        {/* Main Visualization Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View Selector */}
          <div className="p-4 border-b border-border">
            <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="graph">Network Graph</TabsTrigger>
                <TabsTrigger value="topology">Topology</TabsTrigger>
                <TabsTrigger value="analysis">Deep Analysis</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {/* Visualization Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs value={selectedView} className="h-full">
              <TabsContent value="graph" className="h-full m-0">
                <NetworkGraphVisualization
                  selectedPath={selectedPath}
                  onTokenSelect={handleTokenSelect}
                  onPathSelect={handlePathSelect}
                />
              </TabsContent>
              
              <TabsContent value="topology" className="h-full m-0 p-6">
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Network className="w-16 h-16 mx-auto text-muted-foreground" />
                    <h3 className="text-xl font-bold">Network Topology View</h3>
                    <p className="text-muted-foreground max-w-md">
                      Advanced topology analysis showing network structure, clustering, 
                      and centrality metrics will be displayed here.
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-6 max-w-md mx-auto">
                      <Card className="glass-morphism">
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-blue-400">
                            {(metrics.centralityScore * 100).toFixed(1)}%
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Centrality Score
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="glass-morphism">
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-green-400">
                            {Object.keys(metrics.liquidityDistribution).length}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Liquidity Hubs
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="analysis" className="h-full m-0 p-6">
                <div className="h-full space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Volume Flow Analysis */}
                    <Card className="glass-morphism">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <BarChart3 className="w-5 h-5 mr-2" />
                          Volume Flow Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(metrics.volumeFlow)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 5)
                            .map(([token, volume]) => {
                              const tokenData = tokens.find(t => t.symbol === token);
                              return (
                                <div key={token} className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div 
                                      className="w-4 h-4 rounded-full" 
                                      style={{
                                        backgroundColor: tokenData?.category === 'blue-chip' ? '#3B82F6' : 
                                                       tokenData?.category === 'stablecoin' ? '#10B981' :
                                                       tokenData?.category === 'defi' ? '#8B5CF6' : '#6B7280'
                                      }}
                                    />
                                    <span className="font-medium">{token}</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    ${(volume / 1000000).toFixed(1)}M
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Liquidity Distribution */}
                    <Card className="glass-morphism">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <DollarSign className="w-5 h-5 mr-2" />
                          Liquidity Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(metrics.liquidityDistribution)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 5)
                            .map(([token, tvl]) => {
                              const tokenData = tokens.find(t => t.symbol === token);
                              const percentage = (tvl / Object.values(metrics.liquidityDistribution).reduce((a, b) => a + b, 0)) * 100;
                              return (
                                <div key={token} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div 
                                        className="w-4 h-4 rounded-full" 
                                        style={{
                                          backgroundColor: tokenData?.category === 'blue-chip' ? '#3B82F6' : 
                                                         tokenData?.category === 'stablecoin' ? '#10B981' :
                                                         tokenData?.category === 'defi' ? '#8B5CF6' : '#6B7280'
                                        }}
                                      />
                                      <span className="font-medium">{token}</span>
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                      {percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-muted h-2 rounded-full">
                                    <div 
                                      className="h-2 rounded-full"
                                      style={{
                                        width: `${percentage}%`,
                                        backgroundColor: tokenData?.category === 'blue-chip' ? '#3B82F6' : 
                                                       tokenData?.category === 'stablecoin' ? '#10B981' :
                                                       tokenData?.category === 'defi' ? '#8B5CF6' : '#6B7280'
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Optimal Paths Summary */}
                  <Card className="glass-morphism">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Zap className="w-5 h-5 mr-2" />
                        Optimal Paths Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">
                            {optimalPaths.filter(p => p.isOptimal).length}
                          </div>
                          <div className="text-sm text-muted-foreground">Optimal Paths</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">
                            {(optimalPaths.reduce((sum, p) => sum + p.confidence, 0) / optimalPaths.length).toFixed(1)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Avg Confidence</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-400">
                            {(optimalPaths.reduce((sum, p) => sum + p.totalPriceImpact, 0) / optimalPaths.length).toFixed(2)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Avg Impact</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        {/* Sidebar */}
        {showSidebar && <NetworkPathsSidebar />}
      </div>
    </div>
  );
} 
