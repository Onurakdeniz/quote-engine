"use client";

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import ReactFlow, { 
  Node, 
  Edge, 
  Handle, 
  Position, 
  useNodesState, 
  useEdgesState, 
  OnNodesChange, 
  OnEdgesChange,
  NodeMouseHandler,
  Controls,
  MiniMap,
  Background,
  MarkerType
} from 'reactflow';
import { useNetworkRealTime, NetworkToken, NetworkPool, OptimalPath } from './network-real-time-context';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Zap, Activity, DollarSign } from 'lucide-react';
import 'reactflow/dist/style.css';

// Enhanced Token Node Component
function EnhancedTokenNode({ data }: { data: any }) {
  const { 
    token, 
    isSelected, 
    isInPath, 
    isConnected, 
    centralityScore,
    pathWeight,
    onSelect 
  } = data;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'blue-chip': return '#3B82F6';
      case 'stablecoin': return '#10B981';
      case 'defi': return '#8B5CF6';
      case 'gaming': return '#F59E0B';
      case 'meme': return '#EF4444';
      case 'other': return '#6B7280';
      default: return '#6B7280';
    }
  };

  // Improved node sizing based on category and importance
  const getNodeSize = (category: string, marketCap: number, centralityScore: number) => {
    let baseSize = 50;
    
    // Category-based sizing
    switch (category) {
      case 'blue-chip': baseSize = 85; break;
      case 'stablecoin': baseSize = 75; break;
      case 'defi': baseSize = 65; break;
      case 'gaming': baseSize = 55; break;
      case 'meme': baseSize = 50; break;
      case 'other': baseSize = 55; break;
    }
    
    // Market cap influence (normalized)
    const marketCapMultiplier = Math.min(1 + (marketCap / 100000000000), 1.4);
    
    // Centrality influence
    const centralityMultiplier = 1 + (centralityScore * 0.3);
    
    return Math.round(baseSize * marketCapMultiplier * centralityMultiplier);
  };

  const categoryColor = getCategoryColor(token.category);
  const nodeSize = getNodeSize(token.category, token.marketCap, centralityScore);
  const opacity = isConnected ? 1 : 0.15;
  const scale = isSelected ? 1.25 : (isInPath ? 1.1 : 1);

  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
      
      {/* Category indicator ring */}
      <div style={{
        position: 'absolute',
        top: -6,
        left: -6,
        width: nodeSize + 12,
        height: nodeSize + 12,
        borderRadius: '50%',
        border: `2px solid ${categoryColor}`,
        opacity: 0.4,
        zIndex: 0
      }} />
      
      {/* Outer glow ring for selection */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: -10,
          left: -10,
          width: nodeSize + 20,
          height: nodeSize + 20,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${categoryColor}44, ${categoryColor}88)`,
          animation: 'pulse 2s infinite',
          zIndex: 0
        }} />
      )}
      
      {/* Path flow indicator */}
      {isInPath && pathWeight > 0 && (
        <div style={{
          position: 'absolute',
          top: -8,
          left: -8,
          width: nodeSize + 16,
          height: nodeSize + 16,
          borderRadius: '50%',
          border: `3px solid ${categoryColor}`,
          animation: 'pathFlow 3s infinite',
          zIndex: 1
        }} />
      )}
      
      {/* Main node */}
      <div 
        onClick={() => onSelect(token)}
        style={{
          width: nodeSize,
          height: nodeSize,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${categoryColor}20, ${categoryColor}60)`,
          border: `3px solid ${categoryColor}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          opacity,
          transform: `scale(${scale})`,
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(8px)',
          boxShadow: `0 0 ${Math.max(15, nodeSize/4)}px ${categoryColor}40`,
          zIndex: 2,
          position: 'relative'
        }}
        className="hover:shadow-lg"
      >
        {/* Token symbol */}
        <div style={{
          fontSize: Math.max(12, nodeSize / 5),
          fontWeight: 'bold',
          color: categoryColor,
          marginBottom: 2,
          textShadow: '0 0 4px rgba(0,0,0,0.5)',
          filter: 'brightness(1.2)'
        }}>
          {token.symbol}
        </div>
        
        {/* Price - only show for larger nodes */}
        {nodeSize > 65 && (
          <div style={{
            fontSize: Math.max(8, nodeSize / 8),
            color: '#fff',
            opacity: 0.9,
            textShadow: '0 0 2px rgba(0,0,0,0.7)'
          }}>
            ${token.price > 1 ? token.price.toFixed(2) : token.price.toFixed(4)}
          </div>
        )}
        
        {/* Change indicator */}
        <div style={{
          position: 'absolute',
          top: -3,
          right: -3,
          width: Math.max(14, nodeSize / 6),
          height: Math.max(14, nodeSize / 6),
          borderRadius: '50%',
          backgroundColor: token.priceChange24h >= 0 ? '#10B981' : '#EF4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 0 8px rgba(0,0,0,0.3)'
        }}>
          {token.priceChange24h >= 0 ? (
            <TrendingUp size={Math.max(8, nodeSize / 10)} color="white" />
          ) : (
            <TrendingDown size={Math.max(8, nodeSize / 10)} color="white" />
          )}
        </div>
        
        {/* Importance indicator for major tokens */}
        {token.category === 'blue-chip' && (
          <div style={{
            position: 'absolute',
            top: -2,
            left: -2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: '#FFD700',
            border: '2px solid #FFA500',
            boxShadow: '0 0 6px rgba(255, 215, 0, 0.6)',
            zIndex: 3
          }} />
        )}
      </div>
      
      {/* Node details on hover/select */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: nodeSize + 10,
          left: '50%',
          transform: 'translateX(-50%)',
          minWidth: 200,
          zIndex: 10
        }}>
          <Card className="glass-morphism">
            <CardContent className="p-3 space-y-2">
              <div className="text-center">
                <h4 className="font-bold text-sm">{token.name}</h4>
                <Badge variant="outline" className="text-xs" style={{ borderColor: categoryColor }}>
                  {token.category}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Price:</span>
                  <div className="font-medium">${token.price.toFixed(4)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">24h:</span>
                  <div className={`font-medium ${token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Volume:</span>
                  <div className="font-medium">${(token.volume24h / 1000000).toFixed(1)}M</div>
                </div>
                <div>
                  <span className="text-muted-foreground">TVL:</span>
                  <div className="font-medium">${(token.tvl / 1000000000).toFixed(1)}B</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Connections:</span>
                  <div className="font-medium">{token.connections}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Centrality:</span>
                  <div className="font-medium">{(centralityScore * 100).toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  enhancedToken: EnhancedTokenNode,
};

interface NetworkGraphVisualizationProps {
  selectedPath?: OptimalPath | null;
  onTokenSelect?: (token: NetworkToken) => void;
  onPathSelect?: (path: OptimalPath) => void;
}

export default function NetworkGraphVisualization({ 
  selectedPath, 
  onTokenSelect, 
  onPathSelect 
}: NetworkGraphVisualizationProps) {
  const { 
    tokens, 
    pools,
    connections, 
    selectedToken, 
    setSelectedToken, 
    metrics,
    isLoading 
  } = useNetworkRealTime();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);

  // Calculate node positions for tokens only (no pools)
  const calculateNodePositions = useCallback((tokens: NetworkToken[]) => {
    const centerX = 600;
    const centerY = 400;
    const baseTokenRadius = 350;
    
    // Group tokens by category for better layout
    const categories = tokens.reduce((acc, token) => {
      if (!acc[token.category]) acc[token.category] = [];
      acc[token.category].push(token);
      return acc;
    }, {} as Record<string, NetworkToken[]>);
    
    const positions: Record<string, { x: number; y: number }> = {};
    
    // Define category layout with clear separation
    const categoryLayout = {
      'blue-chip': { 
        startAngle: 0, 
        angleSpan: Math.PI * 0.4, 
        radius: baseTokenRadius * 0.75,
        color: '#3B82F6'
      },
      'stablecoin': { 
        startAngle: Math.PI * 0.45, 
        angleSpan: Math.PI * 0.35, 
        radius: baseTokenRadius * 0.85,
        color: '#10B981'
      },
      'defi': { 
        startAngle: Math.PI * 0.85, 
        angleSpan: Math.PI * 0.7, 
        radius: baseTokenRadius * 1.0,
        color: '#8B5CF6'
      },
      'gaming': { 
        startAngle: Math.PI * 1.6, 
        angleSpan: Math.PI * 0.25, 
        radius: baseTokenRadius * 1.15,
        color: '#F59E0B'
      },
      'meme': { 
        startAngle: Math.PI * 1.9, 
        angleSpan: Math.PI * 0.2, 
        radius: baseTokenRadius * 1.25,
        color: '#EF4444'
      },
      'other': { 
        startAngle: Math.PI * 0.1, 
        angleSpan: Math.PI * 0.15, 
        radius: baseTokenRadius * 1.1,
        color: '#6B7280'
      }
    };
    
    // Position tokens with clear category separation
    Object.entries(categories).forEach(([categoryName, categoryTokens]) => {
      const layout = categoryLayout[categoryName as keyof typeof categoryLayout];
      if (!layout || categoryTokens.length === 0) return;
      
      categoryTokens.forEach((token, index) => {
        // Calculate position within category arc
        const progress = categoryTokens.length === 1 ? 0.5 : index / (categoryTokens.length - 1);
        const angle = layout.startAngle + (layout.angleSpan * progress);
        
        // Add slight radius variation for visual interest
        const radiusVariation = 1 + (Math.sin(index * 3.7) * 0.15);
        const finalRadius = layout.radius * radiusVariation;
        
        // Add small random offset to avoid perfect alignment
        const offsetX = (Math.random() - 0.5) * 30;
        const offsetY = (Math.random() - 0.5) * 30;
        
        positions[`token-${token.id}`] = {
          x: centerX + Math.cos(angle) * finalRadius + offsetX,
          y: centerY + Math.sin(angle) * finalRadius + offsetY
        };
      });
    });
    
    return positions;
  }, []);

  // Calculate centrality scores
  const calculateCentrality = useCallback((tokens: NetworkToken[], connections: any[]) => {
    const centrality: Record<string, number> = {};
    
    tokens.forEach(token => {
      const tokenConnections = connections.filter(conn => 
        conn.from === token.id || conn.to === token.id
      );
      const totalWeight = tokenConnections.reduce((sum, conn) => sum + conn.weight, 0);
      centrality[token.id] = Math.min(totalWeight / 100, 1); // Normalize to 0-1
    });
    
    return centrality;
  }, []);

  // Generate nodes (tokens only)
  const generateNodes = useMemo(() => {
    if (tokens.length === 0) return [];
    
    const positions = calculateNodePositions(tokens);
    const centrality = calculateCentrality(tokens, connections);
    const allNodes: Node[] = [];
    
    // Add token nodes only
    tokens.forEach(token => {
      const position = positions[`token-${token.id}`] || { x: 0, y: 0 };
      const isSelected = selectedToken?.id === token.id;
      const isInPath = selectedPath?.route.some(t => t.id === token.id) ?? false;
      const isConnected = selectedToken ? 
        connections.some(conn => 
          (conn.from === selectedToken.id && conn.to === token.id) ||
          (conn.to === selectedToken.id && conn.from === token.id)
        ) : true;
      
      allNodes.push({
        id: `token-${token.id}`,
        type: 'enhancedToken',
        position,
        data: {
          token,
          isSelected,
          isInPath,
          isConnected,
          centralityScore: centrality[token.id] || 0,
          pathWeight: isInPath ? 1 : 0,
          onSelect: (token: NetworkToken) => {
            setSelectedToken(token);
            setSelectedEdge(null);
            onTokenSelect?.(token);
          }
        },
        draggable: true,
        selectable: true
      } as Node);
    });
    
    return allNodes;
  }, [tokens, connections, selectedToken, selectedPath, calculateNodePositions, calculateCentrality, setSelectedToken, onTokenSelect]);

  // Generate direct token-to-token edges
  const generateEdges = useMemo(() => {
    if (pools.length === 0) return [];
    
    const allEdges: Edge[] = [];
    const tokenPairMap = new Map<string, any[]>();
    
    // Group pools by token pairs
    pools.forEach(pool => {
      const pairKey = [pool.tokenA.id, pool.tokenB.id].sort().join('-');
      if (!tokenPairMap.has(pairKey)) {
        tokenPairMap.set(pairKey, []);
      }
      tokenPairMap.get(pairKey)!.push(pool);
    });
    
    // Create direct edges between tokens
    tokenPairMap.forEach((poolsForPair, pairKey) => {
      const [tokenAId, tokenBId] = pairKey.split('-');
      const tokenA = tokens.find(t => t.id === tokenAId);
      const tokenB = tokens.find(t => t.id === tokenBId);
      
      if (!tokenA || !tokenB) return;
      
      const isInPath = selectedPath?.hops.some(hop => 
        poolsForPair.some(pool => pool.id === hop.pool.id)
      ) ?? false;
      
      const isConnectedToSelected = selectedToken ? 
        (tokenA.id === selectedToken.id || tokenB.id === selectedToken.id) : false;
      
      // Show edges based on selection state
      const shouldShowEdge = isInPath || isConnectedToSelected || (!selectedToken && !selectedPath);
      
      if (!shouldShowEdge) return;
      
      // Calculate edge properties based on all pools for this pair
      const totalTVL = poolsForPair.reduce((sum, pool) => sum + pool.tvl, 0);
      const totalVolume = poolsForPair.reduce((sum, pool) => sum + pool.volume24h, 0);
      const bestPool = poolsForPair.reduce((best, pool) => 
        pool.tvl > best.tvl ? pool : best, poolsForPair[0]);
      
      const baseOpacity = isConnectedToSelected ? 0.8 : 0.4;
      const opacity = isInPath ? 1 : baseOpacity;
      const strokeWidth = isInPath ? 5 : Math.max(2, Math.min(6, totalVolume / 50000000));
      
      // Enhanced edge styling
      const edgeStyle = {
        strokeWidth,
        stroke: bestPool.protocolColor,
        opacity,
        strokeDasharray: isInPath ? '0' : '6,6',
        filter: isInPath ? `drop-shadow(0 0 8px ${bestPool.protocolColor})` : 'none'
      };
      
      allEdges.push({
        id: `edge-${tokenA.id}-${tokenB.id}`,
        source: `token-${tokenA.id}`,
        target: `token-${tokenB.id}`,
        type: 'smoothstep',
        style: edgeStyle,
        markerEnd: isInPath ? {
          type: MarkerType.ArrowClosed,
          color: bestPool.protocolColor,
          width: 15,
          height: 15
        } : undefined,
        animated: isInPath,
        data: { 
          pools: poolsForPair, 
          totalTVL, 
          totalVolume, 
          bestPool,
          tokenA,
          tokenB,
          isInPath 
        }
      } as Edge);
    });
    
    return allEdges;
  }, [pools, tokens, selectedPath, selectedToken]);

  // Update nodes and edges when data changes
  useEffect(() => {
    setNodes(generateNodes);
    setEdges(generateEdges);
  }, [generateNodes, generateEdges, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    if (node.id.startsWith('token-')) {
      const tokenId = node.id.replace('token-', '');
      const token = tokens.find(t => t.id === tokenId);
      if (token) {
        setSelectedToken(token);
        setSelectedEdge(null);
        onTokenSelect?.(token);
      }
    }
  }, [tokens, setSelectedToken, onTokenSelect]);

  const onEdgeClick = useCallback((event: any, edge: any) => {
    setSelectedEdge(edge);
    setSelectedToken(null);
  }, []);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((event, node) => {
    setHoveredNode(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNode(null);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <Activity className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading network graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
      
      {/* Network metrics overlay */}
      <div className="absolute top-4 left-4 space-y-2">
        <Card className="glass-morphism">
          <CardContent className="p-3">
            <div className="text-xs space-y-1">
              <div className="font-bold text-primary">Network Metrics</div>
              <div>Tokens: {tokens.length}</div>
              <div>Pools: {pools.length}</div>
              <div>Connections: {edges.length}</div>
              <div>Density: {(metrics.networkDensity * 100).toFixed(1)}%</div>
            </div>
          </CardContent>
        </Card>
        
        {selectedPath && (
          <Card className="glass-morphism">
            <CardContent className="p-3">
              <div className="text-xs space-y-1">
                <div className="font-bold text-primary">Selected Path</div>
                <div>{selectedPath.from.symbol} → {selectedPath.to.symbol}</div>
                <div>Hops: {selectedPath.hops.length}</div>
                <div>Impact: {selectedPath.totalPriceImpact.toFixed(2)}%</div>
                <div>Fees: {selectedPath.totalFees.toFixed(3)}%</div>
                <div>Confidence: {selectedPath.confidence.toFixed(0)}%</div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {selectedEdge && (
          <Card className="glass-morphism">
            <CardContent className="p-3">
              <div className="text-xs space-y-2">
                <div className="font-bold text-primary">Connection Details</div>
                <div className="font-medium">{selectedEdge.data.tokenA.symbol} ↔ {selectedEdge.data.tokenB.symbol}</div>
                <div>
                  <span className="text-muted-foreground">Total TVL:</span>
                  <div className="font-medium">${(selectedEdge.data.totalTVL / 1000000).toFixed(1)}M</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Volume:</span>
                  <div className="font-medium">${(selectedEdge.data.totalVolume / 1000000).toFixed(1)}M</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Available Pools:</span>
                  <div className="font-medium">{selectedEdge.data.pools.length}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground text-xs">Top Pools:</div>
                  {selectedEdge.data.pools.slice(0, 3).map((pool: any, index: number) => (
                    <div key={pool.id} className="flex justify-between text-xs">
                      <span style={{ color: pool.protocolColor }}>{pool.dex}</span>
                      <span>${(pool.tvl / 1000000).toFixed(1)}M</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4">
        <Card className="glass-morphism">
          <CardContent className="p-3">
            <div className="text-xs space-y-2">
              <div className="font-bold text-primary">Network Legend</div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <span>Blue Chip Tokens ({tokens.filter(t => t.category === 'blue-chip').length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span>Stablecoins ({tokens.filter(t => t.category === 'stablecoin').length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                  <span>DeFi Tokens ({tokens.filter(t => t.category === 'defi').length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span>Gaming Tokens ({tokens.filter(t => t.category === 'gaming').length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span>Meme Tokens ({tokens.filter(t => t.category === 'meme').length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-gray-500"></div>
                  <span>Other Tokens ({tokens.filter(t => t.category === 'other').length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-1 bg-gray-400"></div>
                  <span>Direct Connections</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        
        @keyframes pathFlow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 