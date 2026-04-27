"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown,
  Search,
  Star,
  StarOff,
  BarChart3,
  Clock,
  Network,
  Zap,
  ChevronRight
} from 'lucide-react';
import { ExtendedToken, SortField, SortDirection } from '../data/mock-data';
import { PricePathHover } from '@/components/price-path-hover';
import { formatPrice, formatMarketCap, formatPercentage, formatTimeAgo, getTokenLogoUrl, getFallbackLogoHTML } from '../utils/formatters';

interface TokensTableProps {
  tokens: ExtendedToken[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onToggleWatchlist: (tokenId: string) => void;
  priceChanges: { [key: string]: 'increase' | 'decrease' | null };
  isClient?: boolean;
  isMobile?: boolean;
}

const TokenLogo = ({ token }: { token: ExtendedToken }) => {
  const logoUrl = getTokenLogoUrl(token.symbol);
  
  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt={token.symbol}
        className="w-6 h-6 rounded-full bg-muted flex-shrink-0"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = getFallbackLogoHTML(token);
          }
        }}
      />
    );
  } else {
    return <div dangerouslySetInnerHTML={{ __html: getFallbackLogoHTML(token) }} />;
  }
};

const SortableHeader = ({ 
  field, 
  children, 
  sortField, 
  onSort 
}: { 
  field: SortField; 
  children: React.ReactNode;
  sortField: SortField;
  onSort: (field: SortField) => void;
}) => (
  <TableHead 
    className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
    onClick={() => onSort(field)}
  >
    <div className="flex items-center space-x-1">
      <span>{children}</span>
      <ArrowUpDown className="w-3 h-3 opacity-50" />
      {sortField === field && (
        <div className="w-2 h-2 rounded-full bg-primary" />
      )}
    </div>
  </TableHead>
);

// Mobile Card Component for individual tokens
const MobileTokenCard = ({ 
  token, 
  pathQuality, 
  priceChanges, 
  onToggleWatchlist, 
  isClient 
}: {
  token: ExtendedToken;
  pathQuality: any;
  priceChanges: { [key: string]: 'increase' | 'decrease' | null };
  onToggleWatchlist: (tokenId: string) => void;
  isClient: boolean;
}) => (
  <Card className="mobile-token-card mb-3 border border-border/40 bg-card/60 backdrop-blur-sm">
    <CardContent className="p-3 sm:p-4">
      {/* Header Row - Token Info and Price */}
      <div className="flex items-start justify-between mb-3 space-x-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-start space-x-2">
            <TokenLogo token={token} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-x-2">
                <p className="text-sm font-semibold truncate max-w-[120px] sm:max-w-[150px]">{token.name}</p>
                <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded whitespace-nowrap">
                  #{token.rank}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-[200px]">{token.symbol}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0 hover:bg-transparent"
            onClick={() => onToggleWatchlist(token.id)}
          >
            {token.isWatchlisted ? (
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
            ) : (
              <StarOff className="w-4 h-4 text-muted-foreground hover:text-yellow-500 transition-colors" />
            )}
          </Button>
          <div className={`transition-colors duration-300 text-right ${
            priceChanges[token.id] === 'increase' ? 'text-[#03ffbb] animate-pulse' :
            priceChanges[token.id] === 'decrease' ? 'text-[#ff3366] animate-pulse' :
            ''
          }`}>
            <p className="text-base sm:text-lg font-bold tycho-mono price-hover-effect">
              {formatPrice(token.price || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Price Changes Row */}
      <div className="flex flex-wrap items-center justify-between mb-3 bg-muted/20 rounded-lg p-2 sm:p-2.5 space-y-2 sm:space-y-0">
        <div className="text-center flex-1 min-w-[70px] px-1">
          <p className="text-xs text-muted-foreground mb-0.5">24h</p>
          <div className={`flex items-center justify-center space-x-1 transition-colors duration-300 text-sm ${
            priceChanges[token.id] === 'increase' ? 'text-[#03ffbb] animate-pulse' :
            priceChanges[token.id] === 'decrease' ? 'text-[#ff3366] animate-pulse' :
            (token.priceChange24h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
          }`}>
            {token.priceChange24h !== undefined ? (
              <>
                {(token.priceChange24h || 0) >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span className="font-medium tycho-mono">
                  {formatPercentage(token.priceChange24h || 0)}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">No data</span>
            )}
          </div>
        </div>
        
        {token.priceChange7d !== undefined && (
          <>
            <div className="hidden sm:block w-px h-8 bg-border/50"></div>
            <div className="text-center flex-1 min-w-[70px] px-1">
              <p className="text-xs text-muted-foreground mb-0.5">7d</p>
              <div className={`flex items-center justify-center space-x-1 text-sm ${
                (token.priceChange7d || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
              }`}>
                {(token.priceChange7d || 0) >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span className="font-medium tycho-mono">
                  {formatPercentage(token.priceChange7d || 0)}
                </span>
              </div>
            </div>
          </>
        )}

        {token.marketCap && (
          <>
            <div className="hidden sm:block w-px h-8 bg-border/50"></div>
            <div className="text-center flex-1 min-w-[90px] px-1">
              <p className="text-xs text-muted-foreground mb-0.5">MCap</p>
              <p className="text-sm font-medium tycho-mono">
                {formatMarketCap(token.marketCap)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Path Quality Section */}
      <div className="bg-muted/10 rounded-lg p-2 sm:p-2.5 mb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-1.5 sm:mb-2">
          <p className="text-xs font-medium text-muted-foreground mb-1 sm:mb-0">Trading Path</p>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground tycho-mono">
            <div className="flex items-center space-x-1">
              <span>{pathQuality.hops} hop{pathQuality.hops > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Zap className="w-3 h-3" />
              <span>${pathQuality.gasEstimate.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <PricePathHover token={token}>
            <div className="flex flex-wrap items-center gap-x-1 cursor-help hover:bg-muted/50 rounded px-1.5 py-1 sm:px-2 sm:py-1 transition-colors">
              {pathQuality.path.map((tokenSymbol: string, index: number) => (
                <React.Fragment key={index}>
                  <span className={`font-medium text-xs whitespace-nowrap ${
                    tokenSymbol === 'USDC' ? 'tycho-positive' :
                    tokenSymbol === 'WETH' || tokenSymbol === 'ETH' ? 'text-purple-400' :
                    tokenSymbol === 'DAI' ? 'text-orange-400' :
                    'text-blue-400'
                  }`}>
                    {tokenSymbol}
                  </span>
                  {index < pathQuality.path.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-[#03ffbb] flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </PricePathHover>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex flex-wrap items-center justify-between pt-2 sm:pt-2.5 border-t border-border/30 gap-2">
        <div className="flex items-center space-x-1 text-xs text-muted-foreground tycho-mono whitespace-nowrap">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>{formatTimeAgo(token.lastUpdated, isClient)}</span>
        </div>
        <div className="flex items-center space-x-2">
          <HoverCard openDelay={100} closeDelay={50}>
            <HoverCardTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs tycho-focus">
                <BarChart3 className="w-3 h-3 mr-1.5" />
                Chart
              </Button>
            </HoverCardTrigger>
            <HoverCardContent 
              className="hover-card-ultra-glass p-3 w-auto min-w-[200px] max-w-[240px]"
              side="top"
              align="end"
            >
              <p className="text-xs text-center text-muted-foreground">Chart coming soon!</p>
            </HoverCardContent>
          </HoverCard>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs tycho-focus">
            <Network className="w-3 h-3 mr-1.5" />
            Swap
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

export function TokensTable({
  tokens,
  sortField,
  sortDirection,
  onSort,
  onToggleWatchlist,
  priceChanges,
  isClient = true,
  isMobile = false
}: TokensTableProps) {

  const getPathQuality = (symbol: string) => {
    const mockPaths: { [key: string]: any } = {
      'BTC': { 
        path: ['USDC', 'WBTC', 'BTC'], 
        hops: 2, 
        gasEstimate: 0.052,
        quality: 'good'
      },
      'ETH': { 
        path: ['USDC', 'WETH'], 
        hops: 1, 
        gasEstimate: 0.024,
        quality: 'excellent'
      },
      'USDC': { 
        path: ['USDC'], 
        hops: 0, 
        gasEstimate: 0,
        quality: 'excellent'
      },
      'USDT': { 
        path: ['USDC', 'USDT'], 
        hops: 1, 
        gasEstimate: 0.012,
        quality: 'excellent'
      },
      'DAI': { 
        path: ['USDC', 'DAI'], 
        hops: 1, 
        gasEstimate: 0.014,
        quality: 'excellent'
      },
      'UNI': { 
        path: ['USDC', 'WETH', 'UNI'], 
        hops: 2, 
        gasEstimate: 0.045,
        quality: 'good'
      },
      'ARB': { 
        path: ['USDC', 'ARB'], 
        hops: 1, 
        gasEstimate: 0.018,
        quality: 'excellent'
      }
    };
    
    return mockPaths[symbol] || { 
      path: ['USDC', 'WETH', symbol], 
      hops: 2, 
      gasEstimate: 0.055,
      quality: 'fair'
    };
  };

  if (tokens.length === 0) {
    return (
      <Card className="data-card">
        <CardContent className="p-8">
          <div className="text-center py-8">
            <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-muted-foreground">No tokens found</h3>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search criteria or filters
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="mobile-tokens-container">
        {/* Mobile Sort Controls */}
        <Card className="mb-4 border border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
              <div className="flex space-x-1">
                <Button
                  variant={sortField === 'rank' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onSort('rank')}
                  className="h-7 px-2 text-xs"
                >
                  Rank
                </Button>
                <Button
                  variant={sortField === 'price' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onSort('price')}
                  className="h-7 px-2 text-xs"
                >
                  Price
                </Button>
                <Button
                  variant={sortField === 'priceChange24h' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onSort('priceChange24h')}
                  className="h-7 px-2 text-xs"
                >
                  24h %
                </Button>
                <Button
                  variant={sortField === 'marketCap' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onSort('marketCap')}
                  className="h-7 px-2 text-xs"
                >
                  MCap
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Token Cards */}
        <div className="space-y-3">
          {tokens.map((token) => {
            const pathQuality = getPathQuality(token.symbol);
            return (
              <MobileTokenCard
                key={token.id}
                token={token}
                pathQuality={pathQuality}
                priceChanges={priceChanges}
                onToggleWatchlist={onToggleWatchlist}
                isClient={isClient}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop Table Layout
  return (
    <Card className={`data-card ${isMobile ? 'mobile-compact' : ''}`}>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="rank" sortField={sortField} onSort={onSort}>#</SortableHeader>
                <SortableHeader field="name" sortField={sortField} onSort={onSort}>Token</SortableHeader>
                <SortableHeader field="price" sortField={sortField} onSort={onSort}>Price</SortableHeader>
                <TableHead className="hidden lg:table-cell">Path Quality</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors select-none hidden md:table-cell"
                  onClick={() => onSort('priceChange1h')}
                >
                  <div className="flex items-center space-x-1">
                    <span>1h</span>
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                    {sortField === 'priceChange1h' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                </TableHead>
                <SortableHeader field="priceChange24h" sortField={sortField} onSort={onSort}>24h</SortableHeader>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors select-none hidden lg:table-cell"
                  onClick={() => onSort('priceChange7d')}
                >
                  <div className="flex items-center space-x-1">
                    <span>7d</span>
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                    {sortField === 'priceChange7d' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors select-none hidden xl:table-cell"
                  onClick={() => onSort('marketCap')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Market Cap</span>
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                    {sortField === 'marketCap' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => {
                const pathQuality = getPathQuality(token.symbol);
                
                return (
                  <TableRow key={token.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="py-2 text-sm font-medium text-muted-foreground">
                      {token.rank}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <TokenLogo token={token} />
                          <div>
                            <p className="text-sm font-medium">{token.name}</p>
                            <p className="text-xs text-muted-foreground">{token.symbol}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 hover:bg-transparent"
                          onClick={() => onToggleWatchlist(token.id)}
                        >
                          {token.isWatchlisted ? (
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          ) : (
                            <StarOff className="w-4 h-4 text-muted-foreground hover:text-yellow-500 transition-colors" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className={`transition-colors duration-300 ${
                        priceChanges[token.id] === 'increase' ? 'text-[#03ffbb] animate-pulse' :
                        priceChanges[token.id] === 'decrease' ? 'text-[#ff3366] animate-pulse' :
                        ''
                      }`}>
                        <p className="text-sm font-medium tycho-mono price-hover-effect">
                          {formatPrice(token.price || 0)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-1">
                          <PricePathHover 
                            token={token}
                          >
                            <div className="flex flex-wrap items-center gap-x-1 cursor-help hover:bg-muted/50 rounded px-1.5 py-1 sm:px-2 sm:py-1 transition-colors">
                              {pathQuality.path.map((tokenSymbol: string, index: number) => (
                                <React.Fragment key={index}>
                                  <span className={`font-medium text-xs whitespace-nowrap ${
                                    tokenSymbol === 'USDC' ? 'tycho-positive' :
                                    tokenSymbol === 'WETH' || tokenSymbol === 'ETH' ? 'text-purple-400' :
                                    tokenSymbol === 'DAI' ? 'text-orange-400' :
                                    'text-blue-400'
                                  }`}>
                                    {tokenSymbol}
                                  </span>
                                  {index < pathQuality.path.length - 1 && (
                                    <div className="w-1 h-0.5 bg-[#03ffbb] rounded-full pointer-events-none"></div>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </PricePathHover>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground tycho-mono">
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <div className="flex items-center space-x-1 cursor-help hover:text-[#03ffbb] transition-colors">
                                <span>{pathQuality.hops} hop{pathQuality.hops > 1 ? 's' : ''}</span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-[#03ffbb]">Trading Hops</h4>
                                <p className="text-xs text-muted-foreground">
                                  Number of intermediate tokens in the trading path from USDC to {token.symbol}.
                                </p>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <div className="flex items-center space-x-1 cursor-help hover:text-[#03ffbb] transition-colors">
                                <Zap className="w-3 h-3" />
                                <span>${pathQuality.gasEstimate.toFixed(2)}</span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-[#03ffbb]">Gas Cost Estimate</h4>
                                <p className="text-xs text-muted-foreground">
                                  Estimated transaction cost in USD for executing this trade path.
                                </p>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 hidden md:table-cell">
                      <div className={`flex items-center space-x-1 transition-colors duration-300 ${
                        priceChanges[token.id] === 'increase' ? 'text-[#03ffbb] animate-pulse' :
                        priceChanges[token.id] === 'decrease' ? 'text-[#ff3366] animate-pulse' :
                        (token.priceChange1h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                      }`}>
                        {token.priceChange1h !== undefined ? (
                          <>
                            {(token.priceChange1h || 0) >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-sm font-medium tycho-mono price-hover-effect">
                              {formatPercentage(token.priceChange1h || 0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No data</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className={`flex items-center space-x-1 transition-colors duration-300 ${
                        priceChanges[token.id] === 'increase' ? 'text-[#03ffbb] animate-pulse' :
                        priceChanges[token.id] === 'decrease' ? 'text-[#ff3366] animate-pulse' :
                        (token.priceChange24h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                      }`}>
                        {token.priceChange24h !== undefined ? (
                          <>
                            {(token.priceChange24h || 0) >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-sm font-medium tycho-mono price-hover-effect">
                              {formatPercentage(token.priceChange24h || 0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No data</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      <div className={`flex items-center space-x-1 ${
                        (token.priceChange7d || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                      }`}>
                        {token.priceChange7d !== undefined ? (
                          <>
                            {(token.priceChange7d || 0) >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-sm font-medium tycho-mono price-hover-effect">
                              {formatPercentage(token.priceChange7d || 0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No data</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-sm font-medium tycho-mono price-hover-effect hidden xl:table-cell">
                      {token.marketCap ? formatMarketCap(token.marketCap) : <span className="text-muted-foreground italic">No data</span>}
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      <div className="flex flex-wrap items-center justify-between pt-2 sm:pt-2.5 border-t border-border/30 gap-2">
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground tycho-mono whitespace-nowrap">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span>{formatTimeAgo(token.lastUpdated, isClient)}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <HoverCard openDelay={100} closeDelay={50}>
                            <HoverCardTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs tycho-focus">
                                <BarChart3 className="w-3 h-3 mr-1.5" />
                                Chart
                              </Button>
                            </HoverCardTrigger>
                            <HoverCardContent 
                              className="hover-card-ultra-glass p-3 w-auto min-w-[200px] max-w-[240px]"
                              side="top"
                              align="end"
                            >
                              <p className="text-xs text-center text-muted-foreground">Chart coming soon!</p>
                            </HoverCardContent>
                          </HoverCard>
                          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs tycho-focus">
                            <Network className="w-3 h-3 mr-1.5" />
                            Swap
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
} 
