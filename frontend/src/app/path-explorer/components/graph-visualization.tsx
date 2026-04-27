import React, { useCallback, useMemo, useState } from 'react';
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
  Background,
  MarkerType
} from 'reactflow';
import { PricePath } from '@/types/price-quoter';
import { Badge } from '@/components/ui/badge';
import { ProtocolIcon } from '@/components/protocol-icon';
import { Card, CardContent } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { TrendingUp, TrendingDown, Activity, Zap, DollarSign, BarChart3, Network } from 'lucide-react';
import 'reactflow/dist/style.css';

interface GraphVisualizationProps {
  selectedPath?: PricePath | null;
  isAnimating?: boolean;
}

// Enhanced Token Node Component with modern styling
function EnhancedTokenNode({ data }: { data: any }) {
  const { 
    label, 
    badge, 
    price, 
    badgeColor, 
    isActive, 
    isInPath,
    priceChange24h = 0,
    onSelect,
    category = 'other',
    role = 'none' // Add role parameter
  } = data;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ethereum': return '#10ffca';
      case 'bitcoin': return '#f7931a';
      case 'stablecoin': return '#10B981';
      case 'defi': return '#8B5CF6';
      case 'exchange': return '#ff007a';
      default: return '#6B7280';
    }
  };

  // Get color based on role in path
  const getTokenColor = (category: string, role: string) => {
    switch (role) {
      case 'source': return '#00ff88'; // Bright green for source
      case 'target': return '#ff4757'; // Bright red for target
      case 'intermediate': return getCategoryColor(category); // Original category color
      default: return getCategoryColor(category); // Default when no path selected
    }
  };

  // Enhanced node sizing based on category and importance
  const getNodeSize = (category: string) => {
    return 35; // Same small size for all tokens
  };

  const categoryColor = getTokenColor(category, role);
  const nodeSize = getNodeSize(category);
  const opacity = isInPath ? 1 : 0.25;
  const scale = isActive ? 1.25 : (isInPath ? 1.1 : 1);

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
        border: `1px solid ${categoryColor}`,
        opacity: 0.4,
        zIndex: 0
      }} />
      
      {/* Outer glow ring for selection */}
      {isActive && (
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
      {isInPath && (
        <div style={{
          position: 'absolute',
          top: -8,
          left: -8,
          width: nodeSize + 16,
          height: nodeSize + 16,
          borderRadius: '50%',
          border: `2px solid ${categoryColor}`,
          animation: 'pathFlow 3s infinite',
          zIndex: 1
        }} />
      )}
      
      {/* Main node */}
      <div 
        onClick={() => onSelect?.(label)}
        style={{
          width: nodeSize,
          height: nodeSize,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${categoryColor}20, ${categoryColor}60)`,
          border: `1px solid ${categoryColor}`,
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
          fontSize: Math.max(9, nodeSize / 6),
          fontWeight: 'bold',
          color: categoryColor,
          marginBottom: 2,
          textShadow: '0 0 4px rgba(0,0,0,0.5)',
          filter: 'brightness(1.2)'
        }}>
          {label}
        </div>
        
        {/* Price - only show for larger nodes */}
        {nodeSize > 65 && (
          <div style={{
            fontSize: Math.max(8, nodeSize / 8),
            color: '#fff',
            opacity: 0.9,
            textShadow: '0 0 2px rgba(0,0,0,0.7)'
          }}>
            {price}
          </div>
        )}
        
        {/* Importance indicator for major tokens */}
        {(category === 'ethereum' || category === 'bitcoin') && (
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
      
      {/* Enhanced badge below the node */}
      <div style={{
        position: 'absolute',
        top: nodeSize + 15,
        left: '50%',
        transform: 'translateX(-50%)',
        whiteSpace: 'nowrap',
        zIndex: 2,
        opacity: isInPath ? 1 : 0.4,
        transition: 'opacity 0.3s ease',
      }}>
        <Badge 
          variant="outline" 
          className="text-[10px] glass-morphism"
          style={{ 
            borderColor: categoryColor,
            backgroundColor: `${categoryColor}20`,
            color: categoryColor,
            backdropFilter: 'blur(8px)'
          }}
        >
          {badge}
        </Badge>
        
        {/* Price below badge */}
        <div style={{
          fontSize: 8,
          color: '#aaa',
          marginTop: 3,
          textAlign: 'center',
        }}>
          {price}
        </div>
      </div>
    </div>
  );
}

// Enhanced Pool Node Component
function EnhancedPoolNode({ data }: { data: any }) {
  const { protocol, pool, tvl, fee, protocolColor, isActive, isInPath, poolId = 'N/A' } = data;
  const [hoverSide, setHoverSide] = useState<"top" | "bottom">("top");
  
  const handleMouseEnter = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const elementCenter = rect.top + rect.height / 2;
    
    // If element is in upper half of viewport, show below; otherwise show above
    if (elementCenter < viewportHeight / 2) {
      setHoverSide("bottom");
    } else {
      setHoverSide("top");
    }
  };
  
  return (
    <div style={{ position: 'relative', zIndex: 10000 }}>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
      
 
        <HoverCard openDelay={100} closeDelay={100}>
          <HoverCardTrigger asChild>
            {/* Enhanced pool container with glass morphism - more compact for icon only */}
            <div 
              style={{
                background: `linear-gradient(135deg, ${protocolColor}10, ${protocolColor}30)`,
                border: `2px solid ${protocolColor}`,
                borderRadius: 8,
                padding: '4px',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                backdropFilter: 'blur(12px)',
                boxShadow: `0 0 20px 0 ${protocolColor}40`,
                opacity: isInPath ? 1 : 0.25,
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                position: 'relative',
           
              }}
              className="hover:shadow-lg z-[99999]"
              onMouseEnter={handleMouseEnter}
            >
              {/* Glow effect for active pools */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: -4,
                  left: -4,
                  right: -4,
                  bottom: -4,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${protocolColor}30, ${protocolColor}60)`,
                  animation: 'pulse 2s infinite',
                  zIndex: -1
                }} />
              )}
              
              {/* Protocol Icon - centered in the square */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.3))',
                zIndex: 2
              }}>
                <ProtocolIcon protocol={protocol} size={20} />
              </div>
            </div>
          </HoverCardTrigger>
          
          <HoverCardContent 
            className="w-48 p-0 z-[999999]" 
            side="right" 
            align="center"
            style={{ 
              zIndex: 9999999,
              position: 'fixed',
              isolation: 'isolate'
            }}
            sideOffset={24}
            avoidCollisions={false}
            sticky="always"
            alignOffset={10}
            forceMount={true}
            collisionBoundary={undefined}
            hideWhenDetached={false}
          >
            <Card 
              className="border-0 shadow-2xl backdrop-blur-md bg-card/95 !z-[999999]" 
              style={{ 
                zIndex: 999999,
                position: 'relative',
                isolation: 'isolate'
              }}
            >
              <CardContent className="p-2">
                {/* Header with protocol info */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <ProtocolIcon protocol={protocol} size={16} />
                    <div>
                      <div className="font-semibold text-[10px]">{protocol}</div>
                      <div className="text-[8px] text-muted-foreground">{pool}</div>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="text-[8px] px-1 py-0 h-4"
                    style={{ 
                      borderColor: protocolColor,
                      backgroundColor: `${protocolColor}10`,
                      color: protocolColor
                    }}
                  >
                    Active
                  </Badge>
                </div>
                
                {/* Pool metrics */}
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1 p-1 bg-muted/30 rounded">
                    <DollarSign className="w-2.5 h-2.5 text-green-500" />
                    <div>
                      <div className="text-[7px] text-muted-foreground">TVL</div>
                      <div className="font-medium text-[9px]">{tvl}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 p-1 bg-muted/30 rounded">
                    <BarChart3 className="w-2.5 h-2.5 text-blue-500" />
                    <div>
                      <div className="text-[7px] text-muted-foreground">Fee</div>
                      <div className="font-medium text-[9px]">{fee}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 p-1 bg-muted/30 rounded col-span-2">
                    <Network className="w-2.5 h-2.5 text-purple-500" />
                    <div className="flex-1">
                      <div className="text-[7px] text-muted-foreground">Pool ID</div>
                      <div className="font-mono text-[8px] truncate" title={poolId}>
                        {poolId.length > 12 ? `${poolId.substring(0, 12)}...` : poolId}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Additional metrics */}
                <div className="border-t border-muted/30 pt-1.5">
                  <div className="flex items-center justify-between text-[8px]">
                    <div className="flex items-center gap-1">
                      <Zap className="w-2 h-2 text-yellow-500" />
                      <span className="text-muted-foreground">Volume:</span>
                    </div>
                    <span className="font-medium">
                      {protocol === 'Uniswap V3' ? '$5.2M' : 
                       protocol === 'Curve' ? '$1.8M' : 
                       protocol === 'Balancer' ? '$3.1M' : 
                       protocol === 'SushiSwap' ? '$2.4M' : '$2.5M'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-[8px] mt-1">
                    <div className="flex items-center gap-1">
                      <Activity className="w-2 h-2 text-orange-500" />
                      <span className="text-muted-foreground">Utilization:</span>
                    </div>
                    <span className="font-medium">
                      {protocol === 'Uniswap V3' ? '85%' : 
                       protocol === 'Curve' ? '92%' : 
                       protocol === 'Balancer' ? '67%' : 
                       protocol === 'SushiSwap' ? '71%' : '78%'}
                    </span>
                  </div>
                  
                  {/* Pool performance indicator */}
                  <div className="flex items-center justify-between text-[8px] mt-1 pt-1 border-t border-muted/20">
                    <div className="flex items-center gap-1">
                      <div className={`w-1 h-1 rounded-full ${
                        isActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                      }`} />
                      <span className="text-muted-foreground">Status:</span>
                    </div>
                    <span className={`font-medium text-[8px] ${
                      isActive ? 'text-green-500' : 'text-yellow-500'
                    }`}>
                      {isActive ? 'Active' : 'Available'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </HoverCardContent>
        </HoverCard>
    
      
      {/* Small text labels under the icon */}
      <div style={{
        position: 'absolute',
        top: 36,
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        opacity: isInPath ? 0.9 : 0.4,
        transition: 'opacity 0.3s ease',
      }}>
        {/* Protocol name */}
        <div style={{
          fontSize: '7px',
          fontWeight: '600',
          color: protocolColor,
          lineHeight: '8px',
          textShadow: '0 0 2px rgba(0,0,0,0.8)',
          marginBottom: '1px',
          whiteSpace: 'nowrap'
        }}>
          {protocol}
        </div>
        
        {/* Fee */}
        <div style={{
          fontSize: '6px',
          color: '#fff',
          opacity: 0.8,
          lineHeight: '7px',
          textShadow: '0 0 2px rgba(0,0,0,0.8)',
          whiteSpace: 'nowrap'
        }}>
          {fee}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  enhancedToken: EnhancedTokenNode,
  enhancedPool: EnhancedPoolNode,
};

export default function GraphVisualization({ selectedPath, isAnimating }: GraphVisualizationProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Helper function to check if a token is in the selected path
  const isTokenInPath = (tokenSymbol: string): boolean => {
    if (!selectedPath) return true; // Show all if no path selected
    return selectedPath.path.includes(tokenSymbol);
  };

  // Helper function to check if a pool is in the selected path
  const isPoolInPath = (poolId: string): boolean => {
    if (!selectedPath) return true; // Show all if no path selected
    return selectedPath.hops.some(hop => hop.pool.id === poolId);
  };

  // Helper function to get token category
  const getTokenCategory = (symbol: string): string => {
    switch (symbol) {
      case 'ETH':
      case 'WETH':
        return 'ethereum';
      case 'WBTC':
        return 'bitcoin';
      case 'DAI':
      case 'USDC':
      case 'USDT':
      case 'FRAX':
        return 'stablecoin';
      case 'UNI':
        return 'defi';
      default:
        return 'other';
    }
  };

  // Helper function to get token role in selected path
  const getTokenRole = (tokenSymbol: string): string => {
    if (!selectedPath) return 'none';
    if (selectedPath.path[0] === tokenSymbol) return 'source';
    if (selectedPath.path[selectedPath.path.length - 1] === tokenSymbol) return 'target';
    if (selectedPath.path.includes(tokenSymbol)) return 'intermediate';
    return 'none';
  };

  // Enhanced token data with categories and price changes
  const getEnhancedTokenData = (symbol: string) => {
    const tokenData: Record<string, any> = {
      'ETH': { price: '$2,316.43', priceChange24h: -3.16, badge: 'Ethereum' },
      'WETH': { price: '$2,316.43', priceChange24h: -3.16, badge: 'Wrapped Ether' },
      'DAI': { price: '$0.999668', priceChange24h: 0.00, badge: 'Dai Stablecoin' },
      'USDC': { price: '$0.99977', priceChange24h: 0.04, badge: 'USDC' },
      'WBTC': { price: '$77,182.00', priceChange24h: -0.90, badge: 'Wrapped Bitcoin' },
      'UNI': { price: '$3.23', priceChange24h: -4.69, badge: 'Uniswap Token' },
      'FRAX': { price: '$1.00', priceChange24h: 0.01, badge: 'Frax' },
      'USDT': { price: '$1.00', priceChange24h: 0.02, badge: 'Tether USD' },
    };
    return tokenData[symbol] || { price: '$0.00', priceChange24h: 0, badge: symbol };
  };

  // Handle node click
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    setSelectedNode(node.id);
    console.log('Node clicked:', node.id, node.data);
  }, []);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((event, node) => {
    setHoveredNode(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const nodes: Node[] = [
    // Enhanced Token Nodes with modern styling
    {
      id: 'eth',
      type: 'enhancedToken',
      position: { x: 120, y: 320 },
      data: {
        label: 'ETH',
        ...getEnhancedTokenData('ETH'),
        category: 'ethereum',
        role: getTokenRole('ETH'),
        badgeColor: '#10ffca',
        isInPath: isTokenInPath('ETH'),
        isActive: selectedPath?.path[0] === 'ETH' || selectedNode === 'eth',
        onSelect: (token: string) => setSelectedNode('eth'),
      },
    },
    {
      id: 'weth',
      type: 'enhancedToken',
      position: { x: 360, y: 220 },
      data: {
        label: 'WETH',
        ...getEnhancedTokenData('WETH'),
        category: 'ethereum',
        role: getTokenRole('WETH'),
        badgeColor: '#00b4ff',
        isInPath: isTokenInPath('WETH'),
        isActive: selectedPath?.path.includes('WETH') || selectedNode === 'weth',
        onSelect: (token: string) => setSelectedNode('weth'),
      },
    },
    {
      id: 'dai',
      type: 'enhancedToken',
      position: { x: 560, y: 420 },
      data: {
        label: 'DAI',
        ...getEnhancedTokenData('DAI'),
        category: 'stablecoin',
        role: getTokenRole('DAI'),
        badgeColor: '#ffc800',
        isInPath: isTokenInPath('DAI'),
        isActive: selectedPath?.path.includes('DAI') || selectedNode === 'dai',
        onSelect: (token: string) => setSelectedNode('dai'),
      },
    },
    {
      id: 'wbtc',
      type: 'enhancedToken',
      position: { x: 560, y: 120 },
      data: {
        label: 'WBTC',
        ...getEnhancedTokenData('WBTC'),
        category: 'bitcoin',
        role: getTokenRole('WBTC'),
        badgeColor: '#f7931a',
        isInPath: isTokenInPath('WBTC'),
        isActive: selectedPath?.path.includes('WBTC') || selectedNode === 'wbtc',
        onSelect: (token: string) => setSelectedNode('wbtc'),
      },
    },
    {
      id: 'uni',
      type: 'enhancedToken',
      position: { x: 560, y: 270 },
      data: {
        label: 'UNI',
        ...getEnhancedTokenData('UNI'),
        category: 'defi',
        role: getTokenRole('UNI'),
        badgeColor: '#ff007a',
        isInPath: isTokenInPath('UNI'),
        isActive: selectedPath?.path.includes('UNI') || selectedNode === 'uni',
        onSelect: (token: string) => setSelectedNode('uni'),
      },
    },
    {
      id: 'usdc',
      type: 'enhancedToken',
      position: { x: 760, y: 320 },
      data: {
        label: 'USDC',
        ...getEnhancedTokenData('USDC'),
        category: 'stablecoin',
        role: getTokenRole('USDC'),
        badgeColor: '#ff1066',
        isInPath: isTokenInPath('USDC'),
        isActive: selectedPath?.path[selectedPath?.path.length - 1] === 'USDC' || selectedNode === 'usdc',
        onSelect: (token: string) => setSelectedNode('usdc'),
      },
    },
  ];

  // Only show additional tokens when no specific path is selected or they are in the path
  if (!selectedPath || isTokenInPath('FRAX')) {
    nodes.push({
      id: 'frax',
      type: 'enhancedToken',
      position: { x: 560, y: 520 },
      data: {
        label: 'FRAX',
        ...getEnhancedTokenData('FRAX'),
        category: 'stablecoin',
        role: getTokenRole('FRAX'),
        badgeColor: '#ff6b35',
        isInPath: isTokenInPath('FRAX'),
        isActive: selectedPath?.path.includes('FRAX') || selectedNode === 'frax',
        onSelect: (token: string) => setSelectedNode('frax'),
      },
    });
  }

  if (!selectedPath || isTokenInPath('USDT')) {
    nodes.push({
      id: 'usdt',
      type: 'enhancedToken',
      position: { x: 760, y: 520 },
      data: {
        label: 'USDT',
        ...getEnhancedTokenData('USDT'),
        category: 'stablecoin',
        role: getTokenRole('USDT'),
        badgeColor: '#26a69a',
        isInPath: isTokenInPath('USDT'),
        isActive: selectedPath?.path.includes('USDT') || selectedNode === 'usdt',
        onSelect: (token: string) => setSelectedNode('usdt'),
      },
    });
  }

  // Helper function to get pool data from selected path
  const getPoolDataFromPath = (poolIdentifier: string) => {
    if (!selectedPath) return null;
    
    // Map pool identifiers to actual pool data
    const poolMappings: Record<string, string> = {
      'pool-eth-weth': '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
      'pool-weth-dai': '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490',
      'pool-dai-usdc': '0x5777d92f208679db4b9778590fa3cab3ac9e2168',
      'pool-weth-usdc': '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
      'pool-eth-usdc': '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
      'pool-dai-frax': '0xd632f22692fac7611d2aa1c0d552930d43caed3b',
      'pool-frax-usdc': '0x3175df0976dfa876431c2e9ee6bc45b65d3473cc',
      'pool-wbtc-usdc': '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36',
      'pool-weth-wbtc': '0xcbcdf9626bc03e24f779434178a73a0b4bad62ed',
      'pool-wbtc-dai': '0x231e687c9961d3a27e6e266ac5c433ce4f8253e4',
      'pool-weth-uni': '0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801',
      'pool-uni-usdc': '0x17231dcf2649e48ac3c8d2b93206a1d1bb55dd85',
    };
    
    const actualPoolId = poolMappings[poolIdentifier];
    if (!actualPoolId) {
      console.warn(`No pool mapping found for ${poolIdentifier}`);
      return null;
    }
    
    const foundPool = selectedPath.hops.find(hop => hop.pool.id === actualPoolId);
    if (!foundPool) {
      // Debug log to help identify missing pools
      console.log(`Pool ${poolIdentifier} (${actualPoolId}) not found in path. Available pools:`, 
        selectedPath.hops.map(h => `${h.pool.name} (${h.pool.id})`));
    }
    
    return foundPool;
  };

  // Add pool nodes dynamically based on selected path
  const poolNodes: Node[] = [];
  
  // ETH/USDC direct pool - center position for direct route
  const ethUsdcPoolData = getPoolDataFromPath('pool-eth-usdc');
  if (ethUsdcPoolData || !selectedPath) {
    poolNodes.push({
      id: 'pool-eth-usdc',
      type: 'enhancedPool',
      position: { x: 440, y: 320 }, // Centered between ETH and USDC with internal padding
      data: {
        protocol: ethUsdcPoolData?.pool.dex || 'Uniswap V3',
        pool: 'ETH/USDC',
        tvl: ethUsdcPoolData ? `$${(ethUsdcPoolData.pool.tvl / 1000000).toFixed(1)}M` : '$125.0M',
        fee: ethUsdcPoolData ? `${ethUsdcPoolData.pool.fee}%` : '0.05%',
        poolId: ethUsdcPoolData?.pool.id || '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
        protocolColor: '#FF007A',
        isInPath: isPoolInPath('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'),
        isActive: isAnimating && isPoolInPath('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'),
      },
    });
  }

  // ETH/WETH pool - positioned between ETH and WETH
  const ethWethPoolData = getPoolDataFromPath('pool-eth-weth');
  if (ethWethPoolData) { // Show when this pool is in the selected path
    poolNodes.push({
      id: 'pool-eth-weth',
      type: 'enhancedPool',
      position: { x: 240, y: 270 }, // Between ETH and WETH
      data: {
        protocol: ethWethPoolData?.pool.dex || 'Uniswap V2',
        pool: 'ETH/WETH',
        tvl: ethWethPoolData ? `$${(ethWethPoolData.pool.tvl / 1000000).toFixed(1)}M` : '$85.0M',
        fee: ethWethPoolData ? `${ethWethPoolData.pool.fee}%` : '0.30%',
        poolId: ethWethPoolData?.pool.id || '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
        protocolColor: '#FF007A',
        isInPath: isPoolInPath('0xa478c2975ab1ea89e8196811f51a7b7ade33eb11'),
        isActive: isAnimating && isPoolInPath('0xa478c2975ab1ea89e8196811f51a7b7ade33eb11'),
      },
    });
  }

  // WETH/DAI pool - positioned between WETH and DAI
  const wethDaiPoolData = getPoolDataFromPath('pool-weth-dai');
  if (wethDaiPoolData) { // Show when this pool is in the selected path
    poolNodes.push({
      id: 'pool-weth-dai',
      type: 'enhancedPool',
      position: { x: 460, y: 320 }, // Between WETH and DAI
      data: {
        protocol: wethDaiPoolData?.pool.dex || 'Curve',
        pool: 'WETH/DAI',
        tvl: wethDaiPoolData ? `$${(wethDaiPoolData.pool.tvl / 1000000).toFixed(1)}M` : '$45.0M',
        fee: wethDaiPoolData ? `${wethDaiPoolData.pool.fee}%` : '0.04%',
        poolId: wethDaiPoolData?.pool.id || '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490',
        protocolColor: '#FFC107',
        isInPath: isPoolInPath('0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'),
        isActive: isAnimating && isPoolInPath('0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'),
      },
    });
  }

  // DAI/USDC pool - positioned between DAI and USDC
  const daiUsdcPoolData = getPoolDataFromPath('pool-dai-usdc');
  if (daiUsdcPoolData) { // Show when this pool is in the selected path
    poolNodes.push({
      id: 'pool-dai-usdc',
      type: 'enhancedPool',
      position: { x: 660, y: 370 }, // Between DAI and USDC
      data: {
        protocol: daiUsdcPoolData?.pool.dex || 'Curve',
        pool: 'DAI/USDC',
        tvl: daiUsdcPoolData ? `$${(daiUsdcPoolData.pool.tvl / 1000000).toFixed(1)}M` : '$45.0M',
        fee: daiUsdcPoolData ? `${daiUsdcPoolData.pool.fee}%` : '0.04%',
        poolId: daiUsdcPoolData?.pool.id || '0x5777d92f208679db4b9778590fa3cab3ac9e2168',
        protocolColor: '#84cc16',
        isInPath: isPoolInPath('0x5777d92f208679db4b9778590fa3cab3ac9e2168'),
        isActive: isAnimating && isPoolInPath('0x5777d92f208679db4b9778590fa3cab3ac9e2168'),
      },
    });
  }

  // WETH/WBTC pool - positioned between WETH and WBTC
  const wethWbtcPoolData = getPoolDataFromPath('pool-weth-wbtc');
  if (wethWbtcPoolData) { // Show when this pool is in the selected path
    poolNodes.push({
      id: 'pool-weth-wbtc',
      type: 'enhancedPool',
      position: { x: 460, y: 170 }, // Between WETH and WBTC
      data: {
        protocol: wethWbtcPoolData?.pool.dex || 'Balancer',
        pool: 'WETH/WBTC',
        tvl: wethWbtcPoolData ? `$${(wethWbtcPoolData.pool.tvl / 1000000).toFixed(1)}M` : '$75.0M',
        fee: wethWbtcPoolData ? `${wethWbtcPoolData.pool.fee}%` : '0.25%',
        poolId: wethWbtcPoolData?.pool.id || '0xcbcdf9626bc03e24f779434178a73a0b4bad62ed',
        protocolColor: '#ec4899',
        isInPath: isPoolInPath('0xcbcdf9626bc03e24f779434178a73a0b4bad62ed'),
        isActive: isAnimating && isPoolInPath('0xcbcdf9626bc03e24f779434178a73a0b4bad62ed'),
      },
    });
  }

  // WBTC/USDC pool - positioned between WBTC and USDC
  const wbtcUsdcPoolData = getPoolDataFromPath('pool-wbtc-usdc');
  if (wbtcUsdcPoolData) { // Show when this pool is in the selected path
    poolNodes.push({
      id: 'pool-wbtc-usdc',
      type: 'enhancedPool',
      position: { x: 660, y: 220 }, // Between WBTC and USDC
      data: {
        protocol: wbtcUsdcPoolData?.pool.dex || 'Uniswap V3',
        pool: 'WBTC/USDC',
        tvl: wbtcUsdcPoolData ? `$${(wbtcUsdcPoolData.pool.tvl / 1000000).toFixed(1)}M` : '$55.0M',
        fee: wbtcUsdcPoolData ? `${wbtcUsdcPoolData.pool.fee}%` : '0.01%',
        poolId: wbtcUsdcPoolData?.pool.id || '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36',
        protocolColor: '#FF007A',
        isInPath: isPoolInPath('0x4e68ccd3e89f51c3074ca5072bbac773960dfa36'),
        isActive: isAnimating && isPoolInPath('0x4e68ccd3e89f51c3074ca5072bbac773960dfa36'),
      },
    });
  }

  // WETH/UNI pool - positioned between WETH and UNI
  const wethUniPoolData = getPoolDataFromPath('pool-weth-uni');
  if (wethUniPoolData) { // Show when this pool is in the selected path
    poolNodes.push({
      id: 'pool-weth-uni',
      type: 'enhancedPool',
      position: { x: 460, y: 245 }, // Between WETH and UNI
      data: {
        protocol: wethUniPoolData?.pool.dex || 'Uniswap V3',
        pool: 'WETH/UNI',
        tvl: wethUniPoolData ? `$${(wethUniPoolData.pool.tvl / 1000000).toFixed(1)}M` : '$65.0M',
        fee: wethUniPoolData ? `${wethUniPoolData.pool.fee}%` : '0.30%',
        poolId: wethUniPoolData?.pool.id || '0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801',
        protocolColor: '#FF007A',
        isInPath: isPoolInPath('0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801'),
        isActive: isAnimating && isPoolInPath('0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801'),
      },
    });
  }

  // UNI/USDC pool - positioned between UNI and USDC - THIS IS THE CRITICAL LAST HOP
  const uniUsdcPoolData = getPoolDataFromPath('pool-uni-usdc');
  if (uniUsdcPoolData) { // Show when this pool is in the selected path
    poolNodes.push({
      id: 'pool-uni-usdc',
      type: 'enhancedPool',
      position: { x: 660, y: 295 }, // Between UNI and USDC
      data: {
        protocol: uniUsdcPoolData?.pool.dex || 'SushiSwap',
        pool: 'UNI/USDC',
        tvl: uniUsdcPoolData ? `$${(uniUsdcPoolData.pool.tvl / 1000000).toFixed(1)}M` : '$25.0M',
        fee: uniUsdcPoolData ? `${uniUsdcPoolData.pool.fee}%` : '0.30%',
        poolId: uniUsdcPoolData?.pool.id || '0x17231dcf2649e48ac3c8d2b93206a1d1bb55dd85',
        protocolColor: '#0ea5e9',
        isInPath: isPoolInPath('0x17231dcf2649e48ac3c8d2b93206a1d1bb55dd85'),
        isActive: isAnimating && isPoolInPath('0x17231dcf2649e48ac3c8d2b93206a1d1bb55dd85'),
      },
    });
  }

  // Only show additional pools when no specific path is selected or they are in the path
  const wethUsdcPoolData = getPoolDataFromPath('pool-weth-usdc');
  if (wethUsdcPoolData) { // Show when this pool is in the selected path
    poolNodes.push({
      id: 'pool-weth-usdc',
      type: 'enhancedPool',
      position: { x: 560, y: 270 }, // Between WETH and USDC
      data: {
        protocol: wethUsdcPoolData?.pool.dex || 'SushiSwap',
        pool: 'WETH/USDC',
        tvl: wethUsdcPoolData ? `$${(wethUsdcPoolData.pool.tvl / 1000000).toFixed(1)}M` : '$65.0M',
        fee: wethUsdcPoolData ? `${wethUsdcPoolData.pool.fee}%` : '0.30%',
        poolId: wethUsdcPoolData?.pool.id || '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
        protocolColor: '#0E7BFF',
        isInPath: isPoolInPath('0x397ff1542f962076d0bfe58ea045ffa2d347aca0'),
        isActive: isAnimating && isPoolInPath('0x397ff1542f962076d0bfe58ea045ffa2d347aca0'),
      },
    });
  }

  const allNodes = [...nodes, ...poolNodes];

  // Create edges based on the selected path
  const createEdgesForPath = (): Edge[] => {
    if (!selectedPath) {
      // Return all possible edges when no path is selected
      return [
        {
          id: 'eth-pool-eth-usdc',
          source: 'eth',
          target: 'pool-eth-usdc',
          animated: false,
          style: { 
            stroke: '#10ffca', 
            strokeWidth: 2, 
            opacity: 0.4,
            strokeDasharray: '5,5'
          },
          type: 'bezier',
        },
        {
          id: 'pool-eth-usdc-usdc',
          source: 'pool-eth-usdc',
          target: 'usdc',
          animated: false,
          style: { 
            stroke: '#ff1066', 
            strokeWidth: 2, 
            opacity: 0.4,
            strokeDasharray: '5,5'
          },
          type: 'bezier',
        },
        // ETH to WETH path
        {
          id: 'eth-pool-eth-weth',
          source: 'eth',
          target: 'pool-eth-weth',
          animated: false,
          style: { 
            stroke: '#10ffca', 
            strokeWidth: 2, 
            opacity: 0.3,
            strokeDasharray: '3,3'
          },
          type: 'bezier',
        },
        {
          id: 'pool-eth-weth-weth',
          source: 'pool-eth-weth',
          target: 'weth',
          animated: false,
          style: { 
            stroke: '#00b4ff', 
            strokeWidth: 2, 
            opacity: 0.3,
            strokeDasharray: '3,3'
          },
          type: 'bezier',
        },
        // WETH to USDC path
        {
          id: 'weth-pool-weth-usdc',
          source: 'weth',
          target: 'pool-weth-usdc',
          animated: false,
          style: { 
            stroke: '#00b4ff', 
            strokeWidth: 2, 
            opacity: 0.3,
            strokeDasharray: '3,3'
          },
          type: 'bezier',
        },
        {
          id: 'pool-weth-usdc-usdc',
          source: 'pool-weth-usdc',
          target: 'usdc',
          animated: false,
          style: { 
            stroke: '#ff1066', 
            strokeWidth: 2, 
            opacity: 0.3,
            strokeDasharray: '3,3'
          },
          type: 'bezier',
        },
        // WETH to DAI path
        {
          id: 'weth-pool-weth-dai',
          source: 'weth',
          target: 'pool-weth-dai',
          animated: false,
          style: { 
            stroke: '#00b4ff', 
            strokeWidth: 2, 
            opacity: 0.3,
            strokeDasharray: '3,3'
          },
          type: 'bezier',
        },
        {
          id: 'pool-weth-dai-dai',
          source: 'pool-weth-dai',
          target: 'dai',
          animated: false,
          style: { 
            stroke: '#ffc800', 
            strokeWidth: 2, 
            opacity: 0.3,
            strokeDasharray: '3,3'
          },
          type: 'bezier',
        },
        // DAI to USDC path
        {
          id: 'dai-pool-dai-usdc',
          source: 'dai',
          target: 'pool-dai-usdc',
          animated: false,
          style: { 
            stroke: '#ffc800', 
            strokeWidth: 2, 
            opacity: 0.3,
            strokeDasharray: '3,3'
          },
          type: 'bezier',
        },
        {
          id: 'pool-dai-usdc-usdc',
          source: 'pool-dai-usdc',
          target: 'usdc',
          animated: false,
          style: { 
            stroke: '#ff1066', 
            strokeWidth: 2, 
            opacity: 0.3,
            strokeDasharray: '3,3'
          },
          type: 'bezier',
        },
      ];
    }

    // Dynamic edge creation based on actual path hops
    const edges: Edge[] = [];
    
    // Token colors mapping for dynamic edge styling
    const tokenColors: Record<string, string> = {
      'ETH': '#10ffca',
      'WETH': '#00b4ff',
      'DAI': '#ffc800',
      'FRAX': '#ff6b35',
      'USDT': '#26a17b',
      'WBTC': '#f7931a',
      'UNI': '#ff007a',
      'USDC': '#ff1066'
    };

    // Create pool identifier mapping for each hop
    const getPoolNodeId = (hop: any): string => {
      // Create consistent pool identifiers based on token pairs
      const tokenA = hop.tokenIn.symbol.toLowerCase();
      const tokenB = hop.tokenOut.symbol.toLowerCase();
      
      // Handle specific pool mappings
      const poolMappings: Record<string, string> = {
        '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11': 'pool-eth-weth',
        '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490': 'pool-weth-dai',
        '0x5777d92f208679db4b9778590fa3cab3ac9e2168': 'pool-dai-usdc',
        '0x397ff1542f962076d0bfe58ea045ffa2d347aca0': 'pool-weth-usdc',
        '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640': 'pool-eth-usdc',
        '0xd632f22692fac7611d2aa1c0d552930d43caed3b': 'pool-dai-frax',
        '0x3175df0976dfa876431c2e9ee6bc45b65d3473cc': 'pool-frax-usdc',
        '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36': 'pool-wbtc-usdc',
        '0xcbcdf9626bc03e24f779434178a73a0b4bad62ed': 'pool-weth-wbtc',
        '0x231e687c9961d3a27e6e266ac5c433ce4f8253e4': 'pool-wbtc-dai',
        '0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801': 'pool-weth-uni',
        '0x17231dcf2649e48ac3c8d2b93206a1d1bb55dd85': 'pool-uni-usdc',
      };
      
      return poolMappings[hop.pool.id] || `pool-${tokenA}-${tokenB}`;
    };

    // Process each hop in the path
    selectedPath.hops.forEach((hop, index) => {
      const tokenInSymbol = hop.tokenIn.symbol.toLowerCase();
      const tokenOutSymbol = hop.tokenOut.symbol.toLowerCase();
      const poolNodeId = getPoolNodeId(hop);
      
      const inputTokenColor = tokenColors[hop.tokenIn.symbol] || '#888888';
      const outputTokenColor = tokenColors[hop.tokenOut.symbol] || '#888888';

      // Edge from input token to pool
      edges.push({
        id: `${tokenInSymbol}-${poolNodeId}`,
        source: tokenInSymbol,
        target: poolNodeId,
        animated: isAnimating,
        style: { 
          stroke: inputTokenColor, 
          strokeWidth: 4, 
          opacity: 1,
          filter: `drop-shadow(0px 0px 6px ${inputTokenColor})`
        },
        type: 'bezier',
      });

      // Edge from pool to output token
      edges.push({
        id: `${poolNodeId}-${tokenOutSymbol}`,
        source: poolNodeId,
        target: tokenOutSymbol,
        animated: isAnimating,
        style: { 
          stroke: outputTokenColor, 
          strokeWidth: 4, 
          opacity: 1,
          filter: `drop-shadow(0px 0px 6px ${outputTokenColor})`
        },
        type: 'bezier',
      });
    });

    return edges;
  };

  const edges = createEdgesForPath();

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={allNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.3 }}
        style={{ zIndex: 1 }}
      >
        <Background />
      </ReactFlow>
      
      {/* Network status indicator - moved to top left */}
      <div className="absolute top-4 left-4 z-50">
        <Card className="glass-morphism border border-primary/30 shadow-lg shadow-primary/10">
          <CardContent className="p-3">
            <div className="text-xs space-y-1">
              <div className="font-bold text-primary flex items-center space-x-2">
                <Activity className="w-3 h-3 text-primary" />
                <span>Network Status</span>
              </div>
              <div className="text-foreground font-medium">Tokens: {allNodes.filter(n => n.type === 'enhancedToken').length}</div>
              <div className="text-foreground font-medium">Pools: {allNodes.filter(n => n.type === 'enhancedPool').length}</div>
              <div className="text-foreground font-medium">Connections: {edges.length}</div>
              
              {isAnimating && (
                <div className="flex items-center space-x-1 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Path Active</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Node details overlay */}
      {selectedNode && (
        <div className="absolute top-4 right-4">
          <Card className="glass-morphism">
            <CardContent className="p-3">
              <div className="text-xs space-y-2">
                <div className="font-bold text-primary">Token Details</div>
                <div className="font-medium">{selectedNode.toUpperCase()}</div>
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <div className="font-medium capitalize">{getTokenCategory(selectedNode.toUpperCase())}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Price:</span>
                  <div className="font-medium">{getEnhancedTokenData(selectedNode.toUpperCase()).price}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">24h Change:</span>
                  <div className={`font-medium ${getEnhancedTokenData(selectedNode.toUpperCase()).priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {getEnhancedTokenData(selectedNode.toUpperCase()).priceChange24h >= 0 ? '+' : ''}{getEnhancedTokenData(selectedNode.toUpperCase()).priceChange24h.toFixed(2)}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 
