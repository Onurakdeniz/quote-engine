"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { ExtendedToken, SortField, SortDirection, mockTokensInitial, mockWatchlist, mockTopMovers, mockStatsData } from './data/mock-data';
import { getSimulatedPreviousDayPrices } from './utils/formatters';
import { SearchBar } from './search/search-bar';
import { StatsWidgets } from './widgets/stats-widgets';
import { InfoWidgets } from './widgets/info-widgets';
import { TokensTable } from './table/tokens-table';

export function PriceListRefactored() {
  // State management
  const [tokens, setTokens] = useState<ExtendedToken[]>(mockTokensInitial);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showWidgets, setShowWidgets] = useState(true);
  const [priceChanges, setPriceChanges] = useState<{ [key: string]: 'increase' | 'decrease' | null }>({});
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Effect to set client-side flag and detect mobile
  useEffect(() => {
    setIsClient(true);
    
    // Check if device is mobile
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
      
      // Automatically close widgets on mobile
      if (isMobileDevice) {
        setShowWidgets(false);
      }
    };

    checkMobile();
    
    // Listen for window resize
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Override showWidgets on mobile
  const effectiveShowWidgets = isMobile ? false : showWidgets;

  // Simulate price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTokens(prevTokens => {
        const previousDayPrices = getSimulatedPreviousDayPrices(prevTokens);
        
        return prevTokens.map(token => {
          const previousPrice = previousDayPrices.find(p => p.id === token.id)?.previousPrice || token.price || 0;
          
          if (Math.random() < 0.3) { // 30% chance of price change
            const changePercent = (Math.random() - 0.5) * 0.02; // ±1% max change
            const newPrice = (token.price || 0) * (1 + changePercent);
            const newChange24h = previousPrice > 0 ? ((newPrice - previousPrice) / previousPrice) * 100 : 0;
            
            // Track price change direction for animations
            if (newPrice > (token.price || 0)) {
              setPriceChanges(prev => ({ ...prev, [token.id]: 'increase' }));
            } else if (newPrice < (token.price || 0)) {
              setPriceChanges(prev => ({ ...prev, [token.id]: 'decrease' }));
            }
            
            // Clear animation after 1 second
            setTimeout(() => {
              setPriceChanges(prev => ({ ...prev, [token.id]: null }));
            }, 1000);
            
            return {
              ...token,
              price: newPrice,
              priceChange24h: newChange24h,
              lastUpdated: Date.now()
            };
          }
          return token;
        });
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Filtering and sorting logic
  const filteredAndSortedTokens = useMemo(() => {
    let filtered = tokens.filter(token => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        token.name.toLowerCase().includes(term) ||
        token.symbol.toLowerCase().includes(term) ||
        token.address.toLowerCase().includes(term)
      );
    });

    // Sort tokens
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      }

      if (aValue === undefined || aValue === null) aValue = 0;
      if (bValue === undefined || bValue === null) bValue = 0;

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [tokens, searchTerm, sortField, sortDirection]);

  // Event handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleWatchlist = (tokenId: string) => {
    setTokens(prevTokens => 
      prevTokens.map(token => 
        token.id === tokenId 
          ? { ...token, isWatchlisted: !token.isWatchlisted }
          : token
      )
    );
  };

  return (
    <div className={`w-full space-y-4 ${isMobile ? 'mobile-table-padding' : 'px-6'} py-4`}>
      {/* Search Bar */}
      <div className={isMobile ? 'mobile-hide-search' : ''}>
        <SearchBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          showSearchResults={showSearchResults}
          setShowSearchResults={setShowSearchResults}
          filteredTokens={filteredAndSortedTokens}
          showWidgets={effectiveShowWidgets}
          setShowWidgets={setShowWidgets}
          isMobile={isMobile}
        />
      </div>

      {/* Widgets Section */}
      {effectiveShowWidgets && (
        <div className={`space-y-4 ${isMobile ? 'mobile-hide-widgets' : ''}`}>
          {/* Stats Widgets */}
          <StatsWidgets statsData={mockStatsData} />

          {/* Info Widgets */}
          <InfoWidgets 
            watchlist={mockWatchlist} 
            topMovers={mockTopMovers} 
          />
        </div>
      )}

      {/* Tokens Table */}
      <div className="table-container">
        <TokensTable
          tokens={filteredAndSortedTokens}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onToggleWatchlist={toggleWatchlist}
          priceChanges={priceChanges}
          isClient={isClient}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
} 