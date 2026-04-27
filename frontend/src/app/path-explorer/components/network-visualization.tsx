"use client";

import React from 'react';
import { Network } from 'lucide-react';
import { PricePath } from '@/types/price-quoter';
import { ProtocolIcon } from '@/components/protocol-icon';
import { TokenNode } from './token-node';

interface NetworkVisualizationProps {
  selectedPath: PricePath | null;
  isAnimating: boolean;
}

export function NetworkVisualization({ selectedPath, isAnimating }: NetworkVisualizationProps) {
  return (
    <div className="relative h-[600px] bg-gradient-to-br from-background via-background to-muted/20 rounded-2xl border border-border/30 overflow-hidden shadow-2xl">
      {/* Enhanced background for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-br from-card/10 via-transparent to-card/5" />
      
      {/* Background Grid Pattern - Made more visible */}
      <div className="absolute inset-0 opacity-[0.08]">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Network Graph */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="relative w-full h-full max-w-5xl">
          
          {/* SVG Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 800 600">
            <defs>
              {/* Gradient definitions for connections */}
              <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                <stop offset="50%" stopColor="hsl(var(--secondary))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="secondaryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.9" />
              </linearGradient>
              
              {/* Arrow markers */}
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
              </marker>
              <marker id="arrowheadSecondary" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--secondary))" />
              </marker>
              <marker id="arrowheadAccent" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--accent))" />
              </marker>
              <marker id="arrowheadInactive" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" opacity="0.7" />
              </marker>
            </defs>
            
            {/* Direct path: ETH -> USDC */}
            {selectedPath?.path.length === 2 && (
              <>
                <path
                  d="M 160 300 Q 400 250 640 300"
                  stroke={isAnimating ? "url(#primaryGradient)" : "hsl(var(--muted-foreground))"}
                  strokeWidth={isAnimating ? "4" : "3"} 
                  fill="none"
                  strokeOpacity={isAnimating ? "1" : "0.7"}
                  markerEnd={isAnimating ? "url(#arrowhead)" : "url(#arrowheadInactive)"}
                  className="transition-all duration-700 ease-out"
                  strokeDasharray={isAnimating ? "0" : "0"}
                />
                {/* Protocol label for direct path */}
                {selectedPath.hops[0] && (
                  <g>
                    <rect x="375" y="235" width="50" height="40" rx="8" 
                          fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.95" />
                    <foreignObject x="385" y="240" width="30" height="20">
                      <div className="flex items-center justify-center">
                        <ProtocolIcon protocol={selectedPath.hops[0].pool.dex} size={16} />
                      </div>
                    </foreignObject>
                    <text x="400" y="265" textAnchor="middle" className="text-[7px] font-semibold fill-primary">
                      {selectedPath.hops[0].pool.dex}
                    </text>
                    <text x="400" y="272" textAnchor="middle" className="text-[6px] fill-muted-foreground">
                      {selectedPath.hops[0].pool.fee}%
                    </text>
                  </g>
                )}
              </>
            )}
            
            {/* 3-hop path: ETH -> WETH -> USDC */}
            {selectedPath?.path.length === 3 && (
              <>
                {/* ETH to WETH */}
                <path
                  d="M 160 300 Q 250 200 340 180"
                  stroke={isAnimating ? "url(#primaryGradient)" : "hsl(var(--muted-foreground))"}
                  strokeWidth={isAnimating ? "3" : "3"}
                  fill="none"
                  strokeOpacity={isAnimating ? "1" : "0.7"}
                  markerEnd={isAnimating ? "url(#arrowheadSecondary)" : "url(#arrowheadInactive)"}
                  className="transition-all duration-700 ease-out"
                  strokeDasharray={isAnimating ? "0" : "0"}
                />
                {/* Protocol label ETH->WETH */}
                {selectedPath.hops[0] && (
                  <g>
                    <rect x="220" y="210" width="50" height="40" rx="8" 
                          fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.95" />
                    <foreignObject x="230" y="215" width="30" height="20">
                      <div className="flex items-center justify-center">
                        <ProtocolIcon protocol={selectedPath.hops[0].pool.dex} size={14} />
                      </div>
                    </foreignObject>
                    <text x="245" y="240" textAnchor="middle" className="text-[7px] font-semibold fill-secondary">
                      {selectedPath.hops[0].pool.dex}
                    </text>
                    <text x="245" y="247" textAnchor="middle" className="text-[6px] fill-muted-foreground">
                      {selectedPath.hops[0].pool.fee}%
                    </text>
                  </g>
                )}
                
                {/* WETH to USDC */}
                <path
                  d="M 380 180 Q 500 220 640 300"
                  stroke={isAnimating ? "url(#secondaryGradient)" : "hsl(var(--muted-foreground))"}
                  strokeWidth={isAnimating ? "3" : "3"}
                  fill="none"
                  strokeOpacity={isAnimating ? "1" : "0.7"}
                  markerEnd={isAnimating ? "url(#arrowhead)" : "url(#arrowheadInactive)"}
                  className="transition-all duration-700 ease-out"
                  strokeDasharray={isAnimating ? "0" : "0"}
                />
                {/* Protocol label WETH->USDC */}
                {selectedPath.hops[1] && (
                  <g>
                    <rect x="480" y="190" width="50" height="40" rx="8" 
                          fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.95" />
                    <foreignObject x="490" y="195" width="30" height="20">
                      <div className="flex items-center justify-center">
                        <ProtocolIcon protocol={selectedPath.hops[1].pool.dex} size={14} />
                      </div>
                    </foreignObject>
                    <text x="505" y="220" textAnchor="middle" className="text-[7px] font-semibold fill-destructive">
                      {selectedPath.hops[1].pool.dex}
                    </text>
                    <text x="505" y="227" textAnchor="middle" className="text-[6px] fill-muted-foreground">
                      {selectedPath.hops[1].pool.fee}%
                    </text>
                  </g>
                )}
              </>
            )}
            
            {/* 4-hop path: ETH -> WETH -> DAI -> USDC */}
            {selectedPath?.path.length === 4 && (
              <>
                {/* ETH to WETH */}
                <path
                  d="M 160 300 Q 250 200 340 180"
                  stroke={isAnimating ? "url(#primaryGradient)" : "hsl(var(--muted-foreground))"}
                  strokeWidth={isAnimating ? "3" : "3"}
                  fill="none"
                  strokeOpacity={isAnimating ? "1" : "0.7"}
                  markerEnd={isAnimating ? "url(#arrowheadSecondary)" : "url(#arrowheadInactive)"}
                  className="transition-all duration-700 ease-out"
                  strokeDasharray={isAnimating ? "0" : "0"}
                />
                {/* Protocol label ETH->WETH */}
                {selectedPath.hops[0] && (
                  <g>
                    <rect x="220" y="210" width="50" height="40" rx="8" 
                          fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.95" />
                    <foreignObject x="230" y="215" width="30" height="20">
                      <div className="flex items-center justify-center">
                        <ProtocolIcon protocol={selectedPath.hops[0].pool.dex} size={14} />
                      </div>
                    </foreignObject>
                    <text x="245" y="240" textAnchor="middle" className="text-[7px] font-semibold fill-secondary">
                      {selectedPath.hops[0].pool.dex}
                    </text>
                    <text x="245" y="247" textAnchor="middle" className="text-[6px] fill-muted-foreground">
                      {selectedPath.hops[0].pool.fee}%
                    </text>
                  </g>
                )}
                
                {/* WETH to DAI */}
                <path
                  d="M 380 180 Q 450 300 520 420"
                  stroke={isAnimating ? "url(#secondaryGradient)" : "hsl(var(--muted-foreground))"}
                  strokeWidth={isAnimating ? "3" : "3"}
                  fill="none"
                  strokeOpacity={isAnimating ? "1" : "0.7"}
                  markerEnd={isAnimating ? "url(#arrowheadAccent)" : "url(#arrowheadInactive)"}
                  className="transition-all duration-700 ease-out"
                  strokeDasharray={isAnimating ? "0" : "0"}
                />
                {/* Protocol label WETH->DAI */}
                {selectedPath.hops[1] && (
                  <g>
                    <rect x="410" y="270" width="50" height="40" rx="8" 
                          fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.95" />
                    <foreignObject x="420" y="275" width="30" height="20">
                      <div className="flex items-center justify-center">
                        <ProtocolIcon protocol={selectedPath.hops[1].pool.dex} size={14} />
                      </div>
                    </foreignObject>
                    <text x="435" y="300" textAnchor="middle" className="text-[7px] font-semibold fill-accent">
                      {selectedPath.hops[1].pool.dex}
                    </text>
                    <text x="435" y="307" textAnchor="middle" className="text-[6px] fill-muted-foreground">
                      {selectedPath.hops[1].pool.fee}%
                    </text>
                  </g>
                )}
                
                {/* DAI to USDC */}
                <path
                  d="M 560 420 Q 600 360 640 300"
                  stroke={isAnimating ? "url(#accentGradient)" : "hsl(var(--muted-foreground))"}
                  strokeWidth={isAnimating ? "3" : "3"}
                  fill="none"
                  strokeOpacity={isAnimating ? "1" : "0.7"}
                  markerEnd={isAnimating ? "url(#arrowhead)" : "url(#arrowheadInactive)"}
                  className="transition-all duration-700 ease-out"
                  strokeDasharray={isAnimating ? "0" : "0"}
                />
                {/* Protocol label DAI->USDC */}
                {selectedPath.hops[2] && (
                  <g>
                    <rect x="570" y="340" width="50" height="40" rx="8" 
                          fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.95" />
                    <foreignObject x="580" y="345" width="30" height="20">
                      <div className="flex items-center justify-center">
                        <ProtocolIcon protocol={selectedPath.hops[2].pool.dex} size={14} />
                      </div>
                    </foreignObject>
                    <text x="595" y="370" textAnchor="middle" className="text-[7px] font-semibold fill-primary">
                      {selectedPath.hops[2].pool.dex}
                    </text>
                    <text x="595" y="377" textAnchor="middle" className="text-[6px] fill-muted-foreground">
                      {selectedPath.hops[2].pool.fee}%
                    </text>
                  </g>
                )}
              </>
            )}

            {/* Always visible connection lines for better visibility */}
            {!selectedPath && (
              <>
                {/* Default visible paths when no path is selected */}
                <path
                  d="M 160 300 Q 400 250 640 300"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="3"
                  fill="none"
                  strokeOpacity="0.6"
                  markerEnd="url(#arrowheadInactive)"
                  className="transition-all duration-700 ease-out"
                />
                <path
                  d="M 160 300 Q 250 200 340 180"
                  stroke="hsl(var(--secondary))"
                  strokeWidth="3"
                  fill="none"
                  strokeOpacity="0.6"
                  markerEnd="url(#arrowheadInactive)"
                  className="transition-all duration-700 ease-out"
                />
                <path
                  d="M 380 180 Q 500 220 640 300"
                  stroke="hsl(var(--secondary))"
                  strokeWidth="3"
                  fill="none"
                  strokeOpacity="0.6"
                  markerEnd="url(#arrowheadInactive)"
                  className="transition-all duration-700 ease-out"
                />
                <path
                  d="M 380 180 Q 450 300 520 420"
                  stroke="hsl(var(--accent))"
                  strokeWidth="3"
                  fill="none"
                  strokeOpacity="0.6"
                  markerEnd="url(#arrowheadInactive)"
                  className="transition-all duration-700 ease-out"
                />
                <path
                  d="M 560 420 Q 600 360 640 300"
                  stroke="hsl(var(--accent))"
                  strokeWidth="3"
                  fill="none"
                  strokeOpacity="0.6"
                  markerEnd="url(#arrowheadInactive)"
                  className="transition-all duration-700 ease-out"
                />
              </>
            )}
            
            {/* Animated flow particles */}
            {isAnimating && selectedPath && (
              <>
                {selectedPath.path.length === 2 && (
                  <circle r="4" fill="hsl(var(--primary))" opacity="0.8">
                    <animateMotion dur="2s" repeatCount="indefinite">
                      <mpath href="#directPath" />
                    </animateMotion>
                  </circle>
                )}
                
                {selectedPath.path.length >= 3 && (
                  <>
                    <circle r="3" fill="hsl(var(--primary))" opacity="0.8">
                      <animateMotion dur="1.5s" repeatCount="indefinite">
                        <mpath href="#path1" />
                      </animateMotion>
                    </circle>
                    <circle r="3" fill="hsl(var(--secondary))" opacity="0.8">
                      <animateMotion dur="1.5s" repeatCount="indefinite" begin="0.5s">
                        <mpath href="#path2" />
                      </animateMotion>
                    </circle>
                  </>
                )}
                
                {selectedPath.path.length === 4 && (
                  <circle r="3" fill="hsl(var(--accent))" opacity="0.8">
                    <animateMotion dur="1.5s" repeatCount="indefinite" begin="1s">
                      <mpath href="#path3" />
                    </animateMotion>
                  </circle>
                )}
              </>
            )}
            
            {/* Hidden paths for animation */}
            <path id="directPath" d="M 160 300 Q 400 250 640 300" fill="none" opacity="0" />
            <path id="path1" d="M 160 300 Q 250 200 340 180" fill="none" opacity="0" />
            <path id="path2" d="M 380 180 Q 500 220 640 300" fill="none" opacity="0" />
            <path id="path3" d="M 560 420 Q 600 360 640 300" fill="none" opacity="0" />
          </svg>
          
          {/* Token Nodes */}
          <TokenNode
            token={{ symbol: 'ETH', name: 'Ethereum', price: '$2,316.43' }}
            position={{ top: '50%', left: '8%' }}
            isActive={selectedPath?.path.includes('ETH') || false}
            isAnimating={isAnimating}
            nodeType="source"
            size="large"
          />
          
          {/* WETH Node with enhanced visibility */}
          <div className="absolute top-[12%] left-[42.5%] transform -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-0 w-40 h-40 bg-secondary/5 rounded-full blur-xl -z-10"></div>
            <TokenNode
              token={{ symbol: 'WETH', name: 'Wrapped ETH', price: '$2,316.43' }}
              position={{ top: '0', left: '50%' }}
              isActive={selectedPath?.path.includes('WETH') || false}
              isAnimating={isAnimating}
              nodeType="intermediate"
              size="large"
            />
          </div>
          
          {/* DAI Node with enhanced visibility */}
          <div className="absolute top-[88%] left-[65%] transform -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-0 w-40 h-40 bg-accent/5 rounded-full blur-xl -z-10"></div>
            <TokenNode
              token={{ symbol: 'DAI', name: 'DAI Stable', price: '$1.00' }}
              position={{ top: '0', left: '50%' }}
              isActive={selectedPath?.path.includes('DAI') || false}
              isAnimating={isAnimating}
              nodeType="intermediate"
              size="large"
            />
          </div>
          
          <TokenNode
            token={{ symbol: 'USDC', name: 'USD Coin', price: '$1.00' }}
            position={{ top: '50%', right: '8%' }}
            isActive={selectedPath?.path.includes('USDC') || false}
            isAnimating={isAnimating}
            nodeType="destination"
            size="large"
          />

          {/* Connection indicators for better visibility */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Node connection hints */}
            <div className="absolute top-[50%] left-[18%] w-4 h-4 bg-primary/60 rounded-full animate-pulse shadow-lg border-2 border-primary/40" style={{ animationDelay: '0s' }} />
            <div className="absolute top-[12%] left-[52.5%] w-4 h-4 bg-secondary/60 rounded-full animate-pulse shadow-lg border-2 border-secondary/40" style={{ animationDelay: '0.5s' }} />
            <div className="absolute top-[88%] left-[75%] w-4 h-4 bg-accent/60 rounded-full animate-pulse shadow-lg border-2 border-accent/40" style={{ animationDelay: '1s' }} />
            <div className="absolute top-[50%] right-[18%] w-4 h-4 bg-destructive/60 rounded-full animate-pulse shadow-lg border-2 border-destructive/40" style={{ animationDelay: '1.5s' }} />

            {/* Node position labels for clarity */}
            <div className="absolute top-[45%] left-[1%] text-xs text-muted-foreground/60 font-medium">
              SOURCE
            </div>
            <div className="absolute top-[7%] left-[40%] text-xs text-muted-foreground/70 font-medium">
              BRIDGE
            </div>
            <div className="absolute top-[93%] left-[62%] text-xs text-muted-foreground/70 font-medium">
              STABLE
            </div>
            <div className="absolute top-[45%] right-[1%] text-xs text-muted-foreground/60 font-medium">
              TARGET
            </div>
          </div>
        </div>
      </div>
      
      {/* Graph-style corner indicators - Made more visible */}
      <div className="absolute top-6 right-6 text-muted-foreground/40">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full border-2 border-primary/50 animate-pulse" />
          <div className="w-2 h-2 rounded-full border border-secondary/50 animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="w-2 h-2 rounded-full border border-accent/50 animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
      </div>
      <div className="absolute bottom-6 left-6 text-muted-foreground/30">
        <Network className="w-6 h-6" />
      </div>
    </div>
  );
} 
