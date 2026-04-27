"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Star, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  ExternalLink,
  DollarSign,
  Activity
} from 'lucide-react';
import { WatchlistItem, TopMover } from '@/types/price-quoter';
import { formatPrice, formatPercentage, formatVolume, getTokenLogoUrl, getFallbackLogoHTML } from '../utils/formatters';

interface InfoWidgetsProps {
  watchlist: WatchlistItem[];
  topMovers: TopMover[];
}

const TokenLogo = ({ symbol }: { symbol: string }) => {
  const logoUrl = getTokenLogoUrl(symbol);
  
  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt={symbol}
        className="w-5 h-5 rounded-full bg-muted flex-shrink-0"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = getFallbackLogoHTML({ symbol } as any).replace('w-6 h-6', 'w-5 h-5');
          }
        }}
      />
    );
  } else {
    return <div dangerouslySetInnerHTML={{ __html: getFallbackLogoHTML({ symbol } as any).replace('w-6 h-6', 'w-5 h-5') }} />;
  }
};

export function InfoWidgets({ watchlist, topMovers }: InfoWidgetsProps) {
  const mockProtocols = [
    { name: 'Uniswap V3', symbol: 'UNI', tvl: 4200000000, change: 2.3 },
    { name: 'Aave', symbol: 'AAVE', tvl: 12800000000, change: -1.1 },
    { name: 'Compound', symbol: 'COMP', tvl: 8900000000, change: 5.7 }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Compact Watchlist Widget */}
      <Card className="data-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center space-x-2">
              <Star className="w-4 h-4" />
              <span>Watchlist</span>
            </h3>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {watchlist.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-2">
                  <TokenLogo symbol={item.token.symbol} />
                  <div>
                    <p className="text-xs font-medium">{item.token.symbol}</p>
                    <p className="text-xs text-muted-foreground tycho-mono">
                      {formatPrice(item.token.price || 0)}
                    </p>
                  </div>
                </div>
                <div className={`text-xs tycho-mono flex items-center space-x-1 ${
                  (item.token.priceChange24h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                }`}>
                  {(item.token.priceChange24h || 0) >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{formatPercentage(item.token.priceChange24h || 0)}</span>
                </div>
              </div>
            ))}
            {watchlist.length === 0 && (
              <div className="text-center py-4">
                <Star className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground">No tokens in watchlist</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compact Top Movers Widget */}
      <Card className="data-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Top Movers</span>
            </h3>
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              24h
            </Badge>
          </div>
          <div className="space-y-2">
            {topMovers.map((mover, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-2">
                  <TokenLogo symbol={mover.token.symbol} />
                  <div>
                    <p className="text-xs font-medium">{mover.token.symbol}</p>
                    <p className="text-xs text-muted-foreground tycho-mono">
                      {formatVolume(mover.volume24h || 0)}
                    </p>
                  </div>
                </div>
                <div className="text-xs tycho-mono flex items-center space-x-1 tycho-positive">
                  <TrendingUp className="w-3 h-3" />
                  <span>{formatPercentage(mover.priceChangePercent)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compact Protocols Widget */}
      <Card className="data-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Top Protocols</span>
            </h3>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
              <ExternalLink className="w-3 h-3 mr-1" />
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {mockProtocols.map((protocol, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-2">
                  <TokenLogo symbol={protocol.symbol} />
                  <div>
                    <p className="text-xs font-medium">{protocol.name}</p>
                    <p className="text-xs text-muted-foreground tycho-mono">
                      TVL: {formatVolume(protocol.tvl)}
                    </p>
                  </div>
                </div>
                <div className={`text-xs tycho-mono flex items-center space-x-1 ${
                  protocol.change >= 0 ? 'tycho-positive' : 'tycho-negative'
                }`}>
                  {protocol.change >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{formatPercentage(protocol.change)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 