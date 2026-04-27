"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealTimeData } from '@/hooks/useRealTimeData';
import { usePriceAnimation } from '@/hooks/usePriceAnimation';
import { Token } from '@/types/price-quoter';

// Mock data since the lib/mock-data doesn't exist
const mockTokensInitial: Token[] = [
  {
    id: 'eth',
    address: '0x0000000000000000000000000000000000000000',
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    price: 2316.43,
    priceChange24h: -3.160703789200186,
    marketCap: 279548970931,
    volume24h: 20834579103
  },
  {
    id: 'usdc',
    address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
    price: 0.99977,
    priceChange24h: 0.042177443091488936,
    marketCap: 78201491027,
    volume24h: 16836357613
  }
];

const generateTokenPriceUpdate = (tokens: Token[]): Token[] => {
  return tokens.map(token => ({
    ...token,
    price: (token.price || 0) * (1 + (Math.random() - 0.5) * 0.02) // ±1% price variation
  }));
};

export function PriceList() {
  const [tokens, setTokens] = useState<Token[]>(mockTokensInitial);

  // Example usage of the hooks
  const { data, loading } = useRealTimeData(async () => {
    return generateTokenPriceUpdate(tokens);
  }, { interval: 5000 });

  // Use the price animation hook for the first token as an example
  const firstTokenPrice = tokens[0]?.price || 0;
  const priceAnimation = usePriceAnimation(firstTokenPrice);

  useEffect(() => {
    if (data) {
      setTokens(data);
    }
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price List</CardTitle>
        <CardDescription>
          Real-time token prices with animations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Loading prices...</div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token: Token) => (
              <div 
                key={token.id} 
                className={`p-3 border rounded ${priceAnimation.getAnimationClass()}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{token.name} ({token.symbol})</span>
                  <span className="text-lg font-mono">
                    ${token.price?.toFixed(4) || '0.0000'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
