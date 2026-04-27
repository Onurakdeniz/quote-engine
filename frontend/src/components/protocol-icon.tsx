"use client";

import React from 'react';
import Image from 'next/image';

interface ProtocolIconProps {
  protocol: string;
  size?: number;
  className?: string;
}

// Protocol name mapping to normalize different variations
const getProtocolKey = (protocol: string): string => {
  const normalized = protocol.toLowerCase().trim();
  
  if (normalized.includes('uniswap')) return 'uniswap';
  if (normalized.includes('sushiswap') || normalized.includes('sushi')) return 'sushiswap';
  if (normalized.includes('curve')) return 'curve';
  if (normalized.includes('balancer')) return 'balancer';
  if (normalized.includes('pancakeswap') || normalized.includes('pancake')) return 'pancakeswap';
  if (normalized.includes('unichain')) return 'unichain';
  
  return normalized;
};

// Protocol configuration with colors and fallback info
const protocolConfig = {
  uniswap: {
    icon: '/Uniswap.svg',
    color: '#FF007A',
    fallback: '🦄'
  },
  sushiswap: {
    icon: '/Sushiswap.svg',
    color: '#FA52A0',
    fallback: '🍣'
  },
  curve: {
    icon: '/Curve.svg',
    color: '#40E0D0',
    fallback: '🌊'
  },
  balancer: {
    icon: '/Balancer.svg',
    color: '#1E1E1E',
    fallback: '⚖️'
  },
  pancakeswap: {
    icon: '/PancakeSwap.svg',
    color: '#D1884F',
    fallback: '🥞'
  },
  unichain: {
    icon: '/Unichain.svg',
    color: '#FF007A',
    fallback: '⛓️'
  }
};

export function ProtocolIcon({ protocol, size = 16, className = '' }: ProtocolIconProps) {
  const protocolKey = getProtocolKey(protocol);
  const config = protocolConfig[protocolKey as keyof typeof protocolConfig];
  
  // If we have a config for this protocol, show the icon
  if (config) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <Image
          src={config.icon}
          alt={`${protocol} logo`}
          width={size}
          height={size}
          className="object-contain"
          onError={(e) => {
            // Fallback to emoji if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <span 
          className="hidden text-xs"
          style={{ color: config.color }}
        >
          {config.fallback}
        </span>
      </div>
    );
  }
  
  // Fallback for unknown protocols - show a generic icon with protocol color
  const getProtocolColor = (protocolName: string) => {
    const name = protocolName.toLowerCase();
    if (name.includes('uni')) return '#FF007A';
    if (name.includes('sushi')) return '#FA52A0';
    if (name.includes('curve')) return '#40E0D0';
    if (name.includes('balancer')) return '#9333EA';
    if (name.includes('1inch')) return '#1FC7D4';
    return '#6366F1'; // Default purple
  };

  return (
    <div 
      className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{ 
        width: size, 
        height: size,
        backgroundColor: getProtocolColor(protocol) + '20',
        border: `1px solid ${getProtocolColor(protocol)}40`
      }}
    >
      <span 
        className="text-xs font-bold"
        style={{ 
          color: getProtocolColor(protocol),
          fontSize: Math.max(8, size * 0.4)
        }}
      >
        {protocol.charAt(0).toUpperCase()}
      </span>
    </div>
  );
} 