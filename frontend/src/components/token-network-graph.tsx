"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Network, 
  Zap,
  CheckCircle,
  ArrowRight,
  Target,
  Play,
  Pause,
  Settings,
  Eye,
  Layers,
  Activity,
  TrendingUp,
  Shuffle,
  RotateCcw,
  Clock,
  Calculator,
  Route,
  Sparkles
} from 'lucide-react';
import { Token, PricePath } from '@/types/price-quoter';
import * as d3 from 'd3';

interface TokenNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'token';
  token: Token;
  radius: number;
  color: string;
  isSelected?: boolean;
  volume24h: number;
  liquidity: number;
  priceChange24h: number;
}

interface PoolNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'pool';
  name: string;
  protocol: string;
  tokens: string[];
  tvl: number;
  volume24h: number;
  fee: number;
  apy: number;
  radius: number;
  color: string;
  isInPath?: boolean;
  isBeingExplored?: boolean;
}

type GraphNode = TokenNode | PoolNode;

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  type: 'token-pool';
  isSelected?: boolean;
  isBeingExplored?: boolean;
  weight: number;
}

interface RouteHop {
  fromToken: string;
  toToken: string;
  pool: string;
  expectedOutput: number;
  priceImpact: number;
  fee: number;
}

interface Route {
  id: string;
  hops: RouteHop[];
  totalOutput: number;
  totalFees: number;
  totalPriceImpact: number;
  gasEstimate: number;
  profitability: number;
  isOptimal?: boolean;
  explorationProgress: number;
}

interface BlockData {
  number: number;
  timestamp: number;
  gasPrice: number;
  poolPrices: Record<string, Record<string, number>>;
}

interface TokenNetworkGraphProps {
  selectedToken?: Token;
  onTokenSelect?: (token: Token) => void;
}

// Enhanced tokens
const networkTokens: Token[] = [
  { id: 'usdc', address: '0xa0b86...', name: 'USD Coin', symbol: 'USDC', decimals: 6, price: 1.0 },
  { id: 'eth', address: '0x0000...', name: 'Ethereum', symbol: 'ETH', decimals: 18, price: 2316.43 },
  { id: 'weth', address: '0xc02a...', name: 'Wrapped Ethereum', symbol: 'WETH', decimals: 18, price: 2316.43 },
  { id: 'dai', address: '0x6b17...', name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18, price: 0.999668 },
  { id: 'usdt', address: '0xdac1...', name: 'Tether USD', symbol: 'USDT', decimals: 6, price: 1.0 },
  { id: 'wbtc', address: '0x2260...', name: 'Wrapped Bitcoin', symbol: 'WBTC', decimals: 8, price: 77182.0 },
  { id: 'uni', address: '0x1f98...', name: 'Uniswap', symbol: 'UNI', decimals: 18, price: 3.23 },
  { id: 'link', address: '0x5149...', name: 'Chainlink', symbol: 'LINK', decimals: 18, price: 9.19 },
  { id: 'aave', address: '0x7fc6...', name: 'Aave', symbol: 'AAVE', decimals: 18, price: 91.48 },
  { id: 'mkr', address: '0x9f8f...', name: 'Maker', symbol: 'MKR', decimals: 18, price: 1234.56 }
];

// Realistic liquidity pools
const liquidityPools = [
  { id: 'univ3-usdc-eth', name: 'USDC/ETH', protocol: 'Uniswap V3', tokens: ['usdc', 'eth'], tvl: 125000000, volume24h: 45000000, fee: 0.05, apy: 12.5 },
  { id: 'univ3-usdc-weth', name: 'USDC/WETH', protocol: 'Uniswap V3', tokens: ['usdc', 'weth'], tvl: 89000000, volume24h: 32000000, fee: 0.05, apy: 15.2 },
  { id: 'univ3-weth-usdt', name: 'WETH/USDT', protocol: 'Uniswap V3', tokens: ['weth', 'usdt'], tvl: 67000000, volume24h: 28000000, fee: 0.05, apy: 11.8 },
  { id: 'univ3-wbtc-weth', name: 'WBTC/WETH', protocol: 'Uniswap V3', tokens: ['wbtc', 'weth'], tvl: 156000000, volume24h: 52000000, fee: 0.05, apy: 18.3 },
  { id: 'univ3-dai-usdc', name: 'DAI/USDC', protocol: 'Uniswap V3', tokens: ['dai', 'usdc'], tvl: 78000000, volume24h: 15000000, fee: 0.01, apy: 5.2 },
  { id: 'curve-3pool', name: '3Pool', protocol: 'Curve', tokens: ['usdc', 'usdt', 'dai'], tvl: 340000000, volume24h: 85000000, fee: 0.04, apy: 8.7 },
  { id: 'univ3-uni-weth', name: 'UNI/WETH', protocol: 'Uniswap V3', tokens: ['uni', 'weth'], tvl: 42000000, volume24h: 18000000, fee: 0.3, apy: 20.3 },
  { id: 'univ3-link-weth', name: 'LINK/WETH', protocol: 'Uniswap V3', tokens: ['link', 'weth'], tvl: 38000000, volume24h: 14000000, fee: 0.3, apy: 17.9 },
  { id: 'univ3-aave-weth', name: 'AAVE/WETH', protocol: 'Uniswap V3', tokens: ['aave', 'weth'], tvl: 32000000, volume24h: 12000000, fee: 0.3, apy: 19.5 },
  { id: 'univ3-mkr-dai', name: 'MKR/DAI', protocol: 'Uniswap V3', tokens: ['mkr', 'dai'], tvl: 25000000, volume24h: 8000000, fee: 0.3, apy: 15.6 },
  { id: 'sushi-weth-usdc', name: 'WETH/USDC', protocol: 'SushiSwap', tokens: ['weth', 'usdc'], tvl: 28000000, volume24h: 12000000, fee: 0.3, apy: 16.8 },
  { id: 'curve-weth-usdt', name: 'WETH/USDT', protocol: 'Curve', tokens: ['weth', 'usdt'], tvl: 22000000, volume24h: 9000000, fee: 0.04, apy: 12.3 }
];

export function TokenNetworkGraph({ selectedToken, onTokenSelect }: TokenNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [visualizationMode, setVisualizationMode] = useState<'force'>('force');
  const [showLabels, setShowLabels] = useState(true);
  const [isPathfinding, setIsPathfinding] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<BlockData>({
    number: 18500000,
    timestamp: Date.now(),
    gasPrice: 25,
    poolPrices: {}
  });
  const [routes, setRoutes] = useState<Route[]>([]);
  const [exploredRoutes, setExploredRoutes] = useState<string[]>([]);
  const [optimalRoute, setOptimalRoute] = useState<Route | null>(null);
  const [pathfindingProgress, setPathfindingProgress] = useState(0);
  const [fromToken, setFromToken] = useState<string>('uni');
  const [toToken, setToToken] = useState<string>('usdc');
  const [simulationRef, setSimulationRef] = useState<d3.Simulation<GraphNode, GraphEdge> | null>(null);

  const width = 1200;
  const height = 800;

  // Create nodes
  const tokenNodes = useMemo((): TokenNode[] => {
    return networkTokens.map((token) => {
      const volume24h = Math.random() * 5000000 + 500000;
      const liquidity = Math.random() * 50000000 + 5000000;
      const priceChange24h = (Math.random() - 0.5) * 10;
      
      return {
        id: token.id,
        type: 'token',
        token,
        radius: token.id === fromToken || token.id === toToken 
          ? 22 
          : Math.max(12, Math.min(18, Math.sqrt(liquidity) / 3000)),
        color: token.id === fromToken 
          ? '#ef4444' 
          : token.id === toToken 
          ? '#22c55e' 
            : priceChange24h > 0 
              ? '#10b981' 
            : '#8b5cf6',
        isSelected: token.id === fromToken || token.id === toToken,
        volume24h,
        liquidity,
        priceChange24h,
        x: width / 2,
        y: height / 2
      };
    });
  }, [fromToken, toToken, width, height]);

  const poolNodes = useMemo((): PoolNode[] => {
    return liquidityPools.map((pool) => {
      const isInOptimalPath = optimalRoute?.hops.some(hop => hop.pool === pool.id);
      const isBeingExplored = exploredRoutes.some(routeId => routeId.includes(pool.id));
      
      return {
        id: pool.id,
        type: 'pool',
        name: pool.name,
        protocol: pool.protocol,
        tokens: pool.tokens,
        tvl: pool.tvl,
        volume24h: pool.volume24h,
        fee: pool.fee,
        apy: pool.apy,
        radius: Math.max(8, Math.min(15, Math.sqrt(pool.tvl) / 4000)),
        color: pool.protocol === 'Uniswap V3' 
          ? '#ff007a' 
          : pool.protocol === 'Curve' 
            ? '#40e0d0' 
            : '#0e76fd',
        isInPath: isInOptimalPath,
        isBeingExplored,
        x: width / 2,
        y: height / 2
      };
    });
  }, [optimalRoute, exploredRoutes, width, height]);

  const allNodes = useMemo((): GraphNode[] => {
    return [...tokenNodes, ...poolNodes];
  }, [tokenNodes, poolNodes]);

  const edges = useMemo((): GraphEdge[] => {
    const connections: GraphEdge[] = [];

    poolNodes.forEach(pool => {
      pool.tokens.forEach(tokenId => {
        const tokenNode = tokenNodes.find(t => t.id === tokenId);
        if (tokenNode) {
          const isInOptimalPath = optimalRoute?.hops.some(hop => 
            hop.pool === pool.id && (hop.fromToken === tokenId || hop.toToken === tokenId)
          );
          const isBeingExplored = exploredRoutes.some(routeId => routeId.includes(`${tokenId}-${pool.id}`));

          connections.push({
            id: `${tokenId}-${pool.id}`,
            type: 'token-pool',
            source: tokenId,
            target: pool.id,
            isSelected: isInOptimalPath,
            isBeingExplored,
            weight: Math.log(pool.tvl) / 5
          });
        }
      });
    });

    return connections;
  }, [tokenNodes, poolNodes, optimalRoute, exploredRoutes]);

  // Pathfinding algorithm with multiple hops
  const findAllRoutes = useCallback((from: string, to: string, maxHops: number = 4): Route[] => {
    const routes: Route[] = [];
    const visited = new Set<string>();

    const dfs = (currentToken: string, path: RouteHop[], depth: number) => {
      if (depth > maxHops) return;
      
      if (currentToken === to && path.length > 0) {
        const totalOutput = path.reduce((acc, hop) => acc * (1 - hop.priceImpact / 100), 1000); // Start with 1000 USDC equivalent
        const totalFees = path.reduce((acc, hop) => acc + hop.fee, 0);
        const totalPriceImpact = path.reduce((acc, hop) => acc + hop.priceImpact, 0);
        const gasEstimate = path.length * 150000 * currentBlock.gasPrice; // Gwei
        const profitability = totalOutput - gasEstimate / 1e9 - totalFees;

        routes.push({
          id: path.map(h => h.pool).join('-'),
          hops: [...path],
          totalOutput,
          totalFees,
          totalPriceImpact,
          gasEstimate,
          profitability,
          explorationProgress: 0
        });
        return;
      }

      const availablePools = poolNodes.filter(pool => 
        pool.tokens.includes(currentToken) && !visited.has(pool.id)
      );

      for (const pool of availablePools) {
        const otherTokens = pool.tokens.filter(t => t !== currentToken);
        
        for (const nextToken of otherTokens) {
          if (path.some(hop => hop.fromToken === currentToken && hop.toToken === nextToken)) continue;

          visited.add(pool.id);
          
          const hop: RouteHop = {
            fromToken: currentToken,
            toToken: nextToken,
            pool: pool.id,
            expectedOutput: Math.random() * 0.998 + 0.995, // Simulated price
            priceImpact: Math.random() * 0.5 + 0.1, // 0.1-0.6%
            fee: pool.fee
          };

          path.push(hop);
          dfs(nextToken, path, depth + 1);
          path.pop();
          
          visited.delete(pool.id);
        }
      }
    };

    dfs(from, [], 0);
    return routes.sort((a, b) => b.profitability - a.profitability);
  }, [poolNodes, currentBlock.gasPrice]);

  // Real-time pathfinding simulation
  const startPathfinding = useCallback(() => {
    if (isPathfinding) return;
    
    setIsPathfinding(true);
    setRoutes([]);
    setExploredRoutes([]);
    setOptimalRoute(null);
    setPathfindingProgress(0);

    const allRoutes = findAllRoutes(fromToken, toToken, 4);
    let currentRouteIndex = 0;

    const exploreNextRoute = () => {
      if (currentRouteIndex >= allRoutes.length) {
        // Pathfinding complete - select optimal route
        const optimal = allRoutes[0];
        if (optimal) {
          optimal.isOptimal = true;
          setOptimalRoute(optimal);
        }
        setIsPathfinding(false);
        return;
      }

      const route = allRoutes[currentRouteIndex];
      const routeId = route.id;
      
      // Animate route exploration
      let hopIndex = 0;
      const exploreHop = () => {
        if (hopIndex >= route.hops.length) {
          setRoutes(prev => [...prev, route]);
          currentRouteIndex++;
          setPathfindingProgress((currentRouteIndex / allRoutes.length) * 100);
          setTimeout(exploreNextRoute, 300);
          return;
        }

        const hop = route.hops[hopIndex];
        setExploredRoutes(prev => [...prev, `${hop.fromToken}-${hop.pool}`, `${hop.toToken}-${hop.pool}`]);
        
        hopIndex++;
        setTimeout(exploreHop, 200);
      };

      exploreHop();
    };

    setTimeout(exploreNextRoute, 500);
  }, [fromToken, toToken, findAllRoutes, isPathfinding]);

  // Block simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBlock(prev => ({
        number: prev.number + 1,
        timestamp: Date.now(),
        gasPrice: 15 + Math.random() * 30, // 15-45 gwei
        poolPrices: {} // Would contain real price updates
      }));

      // Trigger pathfinding every few blocks if tokens are selected
      if (fromToken && toToken && Math.random() < 0.3) {
        startPathfinding();
      }
    }, 3000); // New block every 3 seconds (faster than real Ethereum)

    return () => clearInterval(interval);
  }, [fromToken, toToken, startPathfinding]);

  // D3 Force Simulation
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const simulation = d3.forceSimulation(allNodes)
      .force("link", d3.forceLink<GraphNode, GraphEdge>(edges)
        .id(d => d.id)
        .distance(80)
        .strength(0.6))
      .force("charge", d3.forceManyBody<GraphNode>()
        .strength(d => d.type === 'token' ? -300 : -150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>()
        .radius(d => d.radius + 12));

    setSimulationRef(simulation);

    // Create links
    const link = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(edges)
      .enter().append("line")
      .attr("stroke", d => d.isSelected ? "#22c55e" : d.isBeingExplored ? "#eab308" : "#94a3b8")
      .attr("stroke-opacity", d => d.isSelected ? 0.9 : d.isBeingExplored ? 0.7 : 0.3)
      .attr("stroke-width", d => d.isSelected ? 4 : d.isBeingExplored ? 3 : Math.max(1, d.weight))
      .style("filter", d => d.isSelected ? "drop-shadow(0px 0px 8px #22c55e)" : d.isBeingExplored ? "drop-shadow(0px 0px 6px #eab308)" : "none");

    // Create nodes
    const node = svg.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(allNodes)
      .enter().append("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    // Define gradients
    const defs = svg.append("defs");
    allNodes.forEach(d => {
      const gradient = defs.append("radialGradient")
        .attr("id", `gradient-${d.id}`)
        .attr("cx", "30%")
        .attr("cy", "30%");
      
      if (d.type === 'token') {
        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", d3.color(d.color)?.brighter(0.8)?.toString() || d.color);
        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", d.color);
      } else {
        const poolNode = d as PoolNode;
        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", poolNode.isBeingExplored ? "#fbbf24" : d3.color(d.color)?.brighter(0.3)?.toString() || d.color);
        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", poolNode.isBeingExplored ? "#f59e0b" : d3.color(d.color)?.darker(0.5)?.toString() || d.color);
      }
    });

    // Glow filter for selected/exploring nodes
    const glowFilter = defs.append("filter").attr("id", "glow");
    glowFilter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Node shapes
    node.each(function(d) {
      const nodeGroup = d3.select(this);
      
      if (d.type === 'token') {
        const tokenNode = d as TokenNode;
        nodeGroup.append("circle")
          .attr("r", d.radius)
          .attr("fill", `url(#gradient-${d.id})`)
          .attr("stroke", tokenNode.isSelected ? "#fbbf24" : "#ffffff")
          .attr("stroke-width", tokenNode.isSelected ? 3 : 2)
          .style("filter", tokenNode.isSelected ? "url(#glow)" : "none");
          
        if (showLabels) {
          nodeGroup.append("text")
            .text(tokenNode.token.symbol)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "white")
            .attr("font-size", Math.max(8, d.radius / 2))
            .attr("font-weight", "bold")
            .style("pointer-events", "none");
        }
      } else {
        const poolNode = d as PoolNode;
        nodeGroup.append("rect")
          .attr("width", d.radius * 2)
          .attr("height", d.radius * 1.2)
          .attr("x", -d.radius)
          .attr("y", -d.radius * 0.6)
          .attr("rx", 4)
          .attr("fill", `url(#gradient-${d.id})`)
          .attr("stroke", poolNode.isInPath ? "#22c55e" : poolNode.isBeingExplored ? "#eab308" : "#ffffff")
          .attr("stroke-width", poolNode.isInPath || poolNode.isBeingExplored ? 2 : 1)
          .style("filter", poolNode.isInPath || poolNode.isBeingExplored ? "url(#glow)" : "none");
          
        if (showLabels) {
          nodeGroup.append("text")
            .text(poolNode.name.length > 6 ? poolNode.name.substring(0, 6) + '...' : poolNode.name)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "white")
            .attr("font-size", Math.max(6, d.radius / 3))
            .attr("font-weight", "bold")
            .style("pointer-events", "none");
        }
      }
    });

    // Event handlers
    node
      .on("mouseover", (event, d) => {
        setHoveredNode(d.id);
      })
      .on("mouseout", () => {
        setHoveredNode(null);
      })
      .on("click", (event, d) => {
        if (d.type === 'token') {
          const tokenNode = d as TokenNode;
          if (tokenNode.id === fromToken) {
            setToToken(tokenNode.id);
            setFromToken(toToken);
          } else {
            setFromToken(tokenNode.id);
          }
        }
      });

    // Drag behavior
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [allNodes, edges, showLabels, fromToken, toToken, width, height]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 4 : 2
    }).format(price);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000000) return `$${(volume / 1000000000).toFixed(1)}B`;
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    return `$${(volume / 1000).toFixed(0)}K`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Route className="w-5 h-5" />
            <CardTitle>Real-Time MEV Pathfinder</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              Block #{currentBlock.number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {currentBlock.gasPrice.toFixed(1)} gwei
            </Badge>
          </div>
        </div>
        <CardDescription>
          Multi-hop route discovery with real-time profitability analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Trading Pair Selection */}
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">From:</span>
            <select 
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="px-2 py-1 rounded border bg-background"
            >
              {networkTokens.map(token => (
                <option key={token.id} value={token.id}>{token.symbol}</option>
              ))}
            </select>
          </div>
          <ArrowRight className="w-4 h-4 mt-1 text-muted-foreground" />
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">To:</span>
            <select 
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="px-2 py-1 rounded border bg-background"
            >
              {networkTokens.map(token => (
                <option key={token.id} value={token.id}>{token.symbol}</option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            onClick={startPathfinding}
            disabled={isPathfinding}
            className="ml-4"
          >
            {isPathfinding ? (
              <>
                <Clock className="w-4 h-4 mr-1 animate-spin" />
                Exploring...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1" />
                Find Routes
              </>
            )}
          </Button>
        </div>

        {/* Pathfinding Progress */}
        {isPathfinding && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-4 h-4 text-yellow-600 animate-pulse" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                Exploring routes... {pathfindingProgress.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2">
              <div 
                className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${pathfindingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Visualization */}
        <div className="relative border rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="w-full h-auto"
            viewBox={`0 0 ${width} ${height}`}
          >
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Hover tooltip */}
          <AnimatePresence>
            {hoveredNode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-4 right-4 bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border max-w-sm z-10"
              >
                {(() => {
                  const node = allNodes.find(n => n.id === hoveredNode);
                  if (!node) return null;
                  
                  if (node.type === 'token') {
                    const tokenNode = node as TokenNode;
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: tokenNode.color }}
                          />
                          <span className="font-semibold">{tokenNode.token.name}</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div>Price: {formatPrice(tokenNode.token.price || 0)}</div>
                          <div>24h Volume: {formatVolume(tokenNode.volume24h)}</div>
                          <div className={`${tokenNode.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            24h Change: {tokenNode.priceChange24h.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    const poolNode = node as PoolNode;
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-3 rounded-sm"
                            style={{ backgroundColor: poolNode.color }}
                          />
                          <span className="font-semibold">{poolNode.name}</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div>Protocol: {poolNode.protocol}</div>
                          <div>TVL: {formatVolume(poolNode.tvl)}</div>
                          <div>Fee: {poolNode.fee}%</div>
                          <div className="text-green-600">APY: {poolNode.apy.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  }
                })()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 p-3 rounded-lg shadow border text-xs space-y-2">
            <div className="font-medium">Legend</div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span>From Token</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span>To Token</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-3 rounded-sm bg-yellow-500"></div>
              <span>Exploring Pool</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-0.5 bg-green-500"></div>
              <span>Optimal Route</span>
            </div>
          </div>
        </div>

        {/* Routes Analysis */}
        {routes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-3"
          >
            <h3 className="font-medium flex items-center space-x-2">
              <Calculator className="w-4 h-4" />
              <span>Discovered Routes ({routes.length})</span>
            </h3>
            
            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {routes.slice(0, 5).map((route, index) => (
                <motion.div
                  key={route.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-3 rounded-lg border ${
                    route.isOptimal 
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                      : 'bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {route.isOptimal && <CheckCircle className="w-4 h-4 text-green-600" />}
                      <span className="font-medium text-sm">
                        Route #{index + 1} ({route.hops.length} hops)
                      </span>
                    </div>
                    <Badge variant={route.profitability > 0 ? "default" : "destructive"} className="text-xs">
                      {route.profitability > 0 ? '+' : ''}{route.profitability.toFixed(2)} USD
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Path: {route.hops.map(h => `${h.fromToken.toUpperCase()} → ${h.toToken.toUpperCase()}`).join(' → ')}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>Output: {route.totalOutput.toFixed(2)}</div>
                      <div>Fees: {route.totalFees.toFixed(3)}%</div>
                      <div>Gas: {(route.gasEstimate / 1e9).toFixed(4)} ETH</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Network Statistics */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="text-center p-3 bg-muted/50 rounded">
            <div className="text-2xl font-bold text-blue-600">{tokenNodes.length}</div>
            <div className="text-muted-foreground">Tokens</div>
              </div>
          <div className="text-center p-3 bg-muted/50 rounded">
            <div className="text-2xl font-bold text-pink-600">{poolNodes.length}</div>
            <div className="text-muted-foreground">Pools</div>
                </div>
          <div className="text-center p-3 bg-muted/50 rounded">
            <div className="text-2xl font-bold text-green-600">{routes.length}</div>
            <div className="text-muted-foreground">Routes Found</div>
                </div>
          <div className="text-center p-3 bg-muted/50 rounded">
            <div className="text-2xl font-bold text-yellow-600">
              {optimalRoute ? optimalRoute.hops.length : 0}
                </div>
            <div className="text-muted-foreground">Optimal Hops</div>
              </div>
          <div className="text-center p-3 bg-muted/50 rounded">
            <div className="text-2xl font-bold text-purple-600">
              {currentBlock.gasPrice.toFixed(0)}
            </div>
            <div className="text-muted-foreground">Gas (gwei)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
