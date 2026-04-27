"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  useNetworkRealTime, 
  NetworkToken, 
  OptimalPath, 
  NetworkConnection 
} from './network-real-time-context';
import { 
  Route, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Clock, 
  DollarSign,
  ArrowRight,
  Network,
  Activity,
  AlertTriangle,
  CheckCircle,
  Info,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Shuffle,
  Target
} from 'lucide-react';
import { ProtocolIcon } from '@/components/protocol-icon';

interface PathCardProps {
  path: OptimalPath;
  isSelected: boolean;
  onSelect: (path: OptimalPath) => void;
}

function PathCard({ path, isSelected, onSelect }: PathCardProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-400';
    if (confidence >= 75) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) return CheckCircle;
    if (confidence >= 75) return AlertTriangle;
    return Info;
  };

  const ConfidenceIcon = getConfidenceIcon(path.confidence);

  return (
    <Card 
      className={`cursor-pointer transition-all ${
        isSelected 
          ? 'ring-2 ring-primary bg-primary/5' 
          : 'hover:bg-muted/50'
      } glass-morphism`}
      onClick={() => onSelect(path)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <span className="font-bold text-sm">{path.from.symbol}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span className="font-bold text-sm">{path.to.symbol}</span>
            </div>
            {path.isOptimal && (
              <Badge variant="outline" className="text-xs tycho-positive">
                Optimal
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <ConfidenceIcon className={`w-4 h-4 ${getConfidenceColor(path.confidence)}`} />
            <span className={`text-xs font-medium ${getConfidenceColor(path.confidence)}`}>
              {path.confidence.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Route visualization */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          {path.route.map((token, index) => (
            <React.Fragment key={token.id}>
              <div className="flex items-center space-x-1 min-w-0">
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: token.category === 'blue-chip' ? '#3B82F6' : 
                                   token.category === 'stablecoin' ? '#10B981' :
                                   token.category === 'defi' ? '#8B5CF6' : '#6B7280',
                    color: 'white'
                  }}
                >
                  {token.symbol.slice(0, 2)}
                </div>
                <span className="text-xs font-medium truncate">{token.symbol}</span>
              </div>
              {index < path.route.length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Output:</span>
            <div className="font-bold">{path.estimatedOutput.toFixed(4)} {path.to.symbol}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Price Impact:</span>
            <div className={`font-bold ${path.totalPriceImpact < 1 ? 'text-green-400' : 
                                      path.totalPriceImpact < 3 ? 'text-yellow-400' : 'text-red-400'}`}>
              {path.totalPriceImpact.toFixed(2)}%
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Total Fees:</span>
            <div className="font-bold">{path.totalFees.toFixed(3)}%</div>
          </div>
          <div>
            <span className="text-muted-foreground">Gas Est:</span>
            <div className="font-bold">{(path.gasEstimate / 1000).toFixed(0)}k</div>
          </div>
        </div>

        {/* Hop details */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Route Details:</span>
          {path.hops.map((hop, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: hop.pool.protocolColor }}
                />
                <ProtocolIcon protocol={hop.pool.dex} size={12} />
                <span>{hop.pool.dex}</span>
                <span className="text-muted-foreground">({hop.pool.fee}%)</span>
              </span>
              <span className={`${hop.priceImpact < 0.5 ? 'text-green-400' : 
                              hop.priceImpact < 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                {hop.priceImpact.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>

        {/* Last updated */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Updated: {path.lastUpdated.toLocaleTimeString()}</span>
          <span>{path.hops.length} hop{path.hops.length !== 1 ? 's' : ''}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface ConnectionCardProps {
  connection: NetworkConnection;
  fromToken: NetworkToken;
  toToken: NetworkToken;
  onSelect: (connection: NetworkConnection) => void;
}

function ConnectionCard({ connection, fromToken, toToken, onSelect }: ConnectionCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-all glass-morphism"
      onClick={() => onSelect(connection)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-sm">{fromToken.symbol}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="font-medium text-sm">{toToken.symbol}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {connection.pools.length} pool{connection.pools.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Volume:</span>
            <div className="font-medium">${(connection.volume / 1000000).toFixed(1)}M</div>
          </div>
          <div>
            <span className="text-muted-foreground">Impact:</span>
            <div className={`font-medium ${connection.priceImpact < 1 ? 'text-green-400' : 
                                         connection.priceImpact < 3 ? 'text-yellow-400' : 'text-red-400'}`}>
              {connection.priceImpact.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="space-y-1">
          {connection.pools.slice(0, 2).map((pool, index) => (
            <div key={index} className="flex items-center space-x-2 text-xs">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: pool.protocolColor }}
              />
              <ProtocolIcon protocol={pool.dex} size={12} />
              <span>{pool.dex}</span>
              <span className="text-muted-foreground">TVL: ${(pool.tvl / 1000000).toFixed(1)}M</span>
            </div>
          ))}
          {connection.pools.length > 2 && (
            <div className="text-xs text-muted-foreground">
              +{connection.pools.length - 2} more pools
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function NetworkPathsSidebar() {
  const { 
    tokens, 
    optimalPaths, 
    selectedToken, 
    selectedPath, 
    setSelectedPath,
    getTokenConnections,
    findOptimalPath
  } = useNetworkRealTime();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'confidence' | 'impact' | 'fees' | 'output'>('confidence');
  const [filterBy, setFilterBy] = useState<'all' | 'optimal' | 'multi-hop'>('all');
  const [fromToken, setFromToken] = useState<string>('');
  const [toToken, setToToken] = useState<string>('');

  // Filter and sort paths
  const filteredPaths = useMemo(() => {
    let paths = [...optimalPaths];

    // Apply search filter
    if (searchQuery) {
      paths = paths.filter(path => 
        path.from.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        path.to.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        path.route.some(token => token.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply category filter
    if (filterBy === 'optimal') {
      paths = paths.filter(path => path.isOptimal);
    } else if (filterBy === 'multi-hop') {
      paths = paths.filter(path => path.hops.length > 1);
    }

    // Sort paths
    paths.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'impact':
          return a.totalPriceImpact - b.totalPriceImpact;
        case 'fees':
          return a.totalFees - b.totalFees;
        case 'output':
          return b.estimatedOutput - a.estimatedOutput;
        default:
          return 0;
      }
    });

    return paths;
  }, [optimalPaths, searchQuery, sortBy, filterBy]);

  // Get connections for selected token
  const tokenConnections = useMemo(() => {
    if (!selectedToken) return [];
    return getTokenConnections(selectedToken.id);
  }, [selectedToken, getTokenConnections]);

  const handleFindPath = () => {
    if (fromToken && toToken && fromToken !== toToken) {
      const path = findOptimalPath(fromToken, toToken);
      if (path) {
        setSelectedPath(path);
      }
    }
  };

  return (
    <div className="w-96 h-full bg-background/95 backdrop-blur-sm border-l border-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold mb-3">Network Analysis</h2>
        
        {/* Search and filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex space-x-2">
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confidence">Confidence</SelectItem>
                <SelectItem value="impact">Price Impact</SelectItem>
                <SelectItem value="fees">Total Fees</SelectItem>
                <SelectItem value="output">Output</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Paths</SelectItem>
                <SelectItem value="optimal">Optimal Only</SelectItem>
                <SelectItem value="multi-hop">Multi-hop</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs defaultValue="paths" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 mx-4 mt-2">
          <TabsTrigger value="paths">Paths</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="pathfinder">Path Finder</TabsTrigger>
        </TabsList>

        <TabsContent value="paths" className="flex-1 overflow-hidden m-0">
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {filteredPaths.length} path{filteredPaths.length !== 1 ? 's' : ''}
              </span>
              <Badge variant="outline" className="text-xs">
                Live Updates
              </Badge>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {filteredPaths.map((path) => (
              <PathCard
                key={path.id}
                path={path}
                isSelected={selectedPath?.id === path.id}
                onSelect={setSelectedPath}
              />
            ))}
            
            {filteredPaths.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No paths found</p>
                <p className="text-xs">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="connections" className="flex-1 overflow-hidden m-0">
          <div className="p-4">
            {selectedToken ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: selectedToken.category === 'blue-chip' ? '#3B82F6' : 
                                     selectedToken.category === 'stablecoin' ? '#10B981' :
                                     selectedToken.category === 'defi' ? '#8B5CF6' : '#6B7280',
                      color: 'white'
                    }}
                  >
                    {selectedToken.symbol.slice(0, 2)}
                  </div>
                  <span className="font-bold">{selectedToken.symbol}</span>
                  <Badge variant="outline" className="text-xs">
                    {tokenConnections.length} connections
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select a token to view connections</p>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {tokenConnections.map((connection, index) => {
              const fromToken = tokens.find(t => t.id === connection.from);
              const toToken = tokens.find(t => t.id === connection.to);
              
              if (!fromToken || !toToken) return null;
              
              return (
                <ConnectionCard
                  key={`${connection.from}-${connection.to}-${index}`}
                  connection={connection}
                  fromToken={fromToken}
                  toToken={toToken}
                  onSelect={() => {}}
                />
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="pathfinder" className="flex-1 overflow-hidden m-0">
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">From Token</label>
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select token..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map(token => (
                      <SelectItem key={token.id} value={token.id}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{
                              backgroundColor: token.category === 'blue-chip' ? '#3B82F6' : 
                                             token.category === 'stablecoin' ? '#10B981' :
                                             token.category === 'defi' ? '#8B5CF6' : '#6B7280'
                            }}
                          />
                          <span>{token.symbol}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const temp = fromToken;
                    setFromToken(toToken);
                    setToToken(temp);
                  }}
                  disabled={!fromToken || !toToken}
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">To Token</label>
                <Select value={toToken} onValueChange={setToToken}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select token..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map(token => (
                      <SelectItem key={token.id} value={token.id}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{
                              backgroundColor: token.category === 'blue-chip' ? '#3B82F6' : 
                                             token.category === 'stablecoin' ? '#10B981' :
                                             token.category === 'defi' ? '#8B5CF6' : '#6B7280'
                            }}
                          />
                          <span>{token.symbol}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleFindPath}
                disabled={!fromToken || !toToken || fromToken === toToken}
                className="w-full"
              >
                <Route className="w-4 h-4 mr-2" />
                Find Optimal Path
              </Button>
            </div>
            
            {selectedPath && (fromToken === selectedPath.from.id && toToken === selectedPath.to.id) && (
              <div className="mt-4">
                <PathCard
                  path={selectedPath}
                  isSelected={true}
                  onSelect={() => {}}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 