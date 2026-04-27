"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, TrendingDown, RefreshCw, Activity, Filter, SlidersHorizontal } from 'lucide-react';
import { ExtendedToken } from '../data/mock-data';
import { formatPrice, formatPercentage, getTokenLogoUrl, getFallbackLogoHTML } from '../utils/formatters';

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showSearchResults: boolean;
  setShowSearchResults: (show: boolean) => void;
  filteredTokens: ExtendedToken[];
  showWidgets: boolean;
  setShowWidgets: (show: boolean) => void;
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

export function SearchBar({
  searchTerm,
  setSearchTerm,
  showSearchResults,
  setShowSearchResults,
  filteredTokens,
  showWidgets,
  setShowWidgets,
  isMobile = false
}: SearchBarProps) {
  return (
    <Card className="frosted-card">
      <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
        {isMobile ? (
          // Mobile Layout - Stacked
          <div className="space-y-3">
            {/* Search Input - Full Width */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search tokens..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => setShowSearchResults(searchTerm.length > 0)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                className="pl-10 h-10 text-sm tycho-focus border"
              />
              
              {/* Mobile Search Results Dropdown */}
              {showSearchResults && filteredTokens.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground mb-2 px-2">
                      {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''} found
                    </p>
                    {filteredTokens.slice(0, 6).map((token) => (
                      <div
                        key={token.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSearchTerm(token.symbol);
                          setShowSearchResults(false);
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <TokenLogo token={token} />
                          <div>
                            <p className="text-sm font-medium">{token.name}</p>
                            <p className="text-xs text-muted-foreground">{token.symbol}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tycho-mono">
                            {formatPrice(token.price || 0)}
                          </p>
                          <div className={`flex items-center justify-end space-x-1 ${
                            (token.priceChange24h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                          }`}>
                            {(token.priceChange24h || 0) >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-xs tycho-mono">
                              {formatPercentage(token.priceChange24h || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredTokens.length > 6 && (
                      <div className="text-center p-2 text-xs text-muted-foreground">
                        +{filteredTokens.length - 6} more results
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Controls Row */}
            <div className="flex items-center justify-between gap-2">
              {/* Left side - Token count */}
              <Badge variant="outline" className="tycho-mono text-xs px-2 py-1 flex-shrink-0">
                {filteredTokens.length} tokens
              </Badge>

              {/* Right side - Action buttons */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
                <Button 
                  variant={showWidgets ? "default" : "outline"} 
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowWidgets(!showWidgets)}
                >
                  <Activity className="w-3 h-3 mr-1" />
                  Widgets
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <SlidersHorizontal className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Desktop Layout - Horizontal
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search tokens by name, symbol, or address for live prices..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => setShowSearchResults(searchTerm.length > 0)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                className="pl-12 h-12 text-base tycho-focus border"
              />
              
              {/* Desktop Search Results Dropdown */}
              {showSearchResults && filteredTokens.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground mb-2 px-2">
                      {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''} found
                    </p>
                    {filteredTokens.slice(0, 8).map((token) => (
                      <div
                        key={token.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSearchTerm(token.symbol);
                          setShowSearchResults(false);
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <TokenLogo token={token} />
                          <div>
                            <p className="text-sm font-medium">{token.name}</p>
                            <p className="text-xs text-muted-foreground">{token.symbol}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tycho-mono">
                            {formatPrice(token.price || 0)}
                          </p>
                          <div className={`flex items-center justify-end space-x-1 ${
                            (token.priceChange24h || 0) >= 0 ? 'tycho-positive' : 'tycho-negative'
                          }`}>
                            {(token.priceChange24h || 0) >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-xs tycho-mono">
                              {formatPercentage(token.priceChange24h || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredTokens.length > 8 && (
                      <div className="text-center p-2 text-xs text-muted-foreground">
                        +{filteredTokens.length - 8} more results
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Desktop Controls */}
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="tycho-mono px-3 py-1 text-sm">
                {filteredTokens.length} tokens
              </Badge>
              <Button variant="outline" size="sm" className="h-10 px-4">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant={showWidgets ? "default" : "outline"} 
                size="sm"
                className="h-10 px-4"
                onClick={() => setShowWidgets(!showWidgets)}
              >
                <Activity className="w-4 h-4 mr-2" />
                {showWidgets ? 'Hide Widgets' : 'Show Widgets'}
              </Button>
              <Button variant="outline" size="sm" className="h-10 px-4">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 