"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Star, 
  Search, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  AlertTriangle,
  Heart,
  MoreVertical,
  Filter,
  Download,
  Upload
} from 'lucide-react';

export function Watchlist() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const watchlistCategories = [
    { id: 'all', name: 'All Tokens', count: 47 },
    { id: 'favorites', name: 'Favorites', count: 12 },
    { id: 'defi', name: 'DeFi', count: 18 },
    { id: 'layer1', name: 'Layer 1', count: 8 },
    { id: 'layer2', name: 'Layer 2', count: 6 },
    { id: 'memes', name: 'Meme Coins', count: 3 },
  ];

  const watchlistTokens = [
    {
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      price: '$2,316.43',
      change24h: '-3.16%',
      change7d: '-0.96%',
      volume: '$20.8B',
      marketCap: '$279.5B',
      category: 'layer1',
      isFavorite: true,
      alerts: 2,
      trend: 'down'
    },
    {
      symbol: 'USDC',
      name: 'USDC',
      price: '$0.99977',
      change24h: '+0.04%',
      change7d: '-0.00%',
      volume: '$16.8B',
      marketCap: '$78.2B',
      category: 'defi',
      isFavorite: false,
      alerts: 0,
      trend: 'stable'
    },
    {
      symbol: 'UNI',
      name: 'Uniswap',
      price: '$7.23',
      change24h: '-0.87%',
      change7d: '+8.92%',
      volume: '$123M',
      marketCap: '$4.3B',
      category: 'defi',
      isFavorite: true,
      alerts: 1,
      trend: 'down'
    },
    {
      symbol: 'MATIC',
      name: 'Polygon',
      price: '$0.82',
      change24h: '+4.23%',
      change7d: '+15.67%',
      volume: '$98M',
      marketCap: '$7.8B',
      category: 'layer2',
      isFavorite: false,
      alerts: 0,
      trend: 'up'
    },
    {
      symbol: 'ARB',
      name: 'Arbitrum',
      price: '$1.42',
      change24h: '+1.23%',
      change7d: '+6.78%',
      volume: '$67M',
      marketCap: '$1.9B',
      category: 'layer2',
      isFavorite: true,
      alerts: 3,
      trend: 'up'
    },
  ];

  const filteredTokens = watchlistTokens.filter(token => {
    const matchesSearch = token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         token.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'favorites' && token.isFavorite) ||
                           token.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const portfolioStats = [
    { label: 'Total Value', value: '$124,567.89', change: '+12.45%' },
    { label: '24h P&L', value: '+$1,234.56', change: '+2.34%' },
    { label: 'Active Alerts', value: '6', change: '+2' },
    { label: 'Tracked Tokens', value: '47', change: '+3' },
  ];

  return (
    <div className="w-full px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Watchlist</h1>
          <p className="text-muted-foreground">Track and manage your favorite tokens</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Token
          </Button>
        </div>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {portfolioStats.map((stat, index) => (
          <Card key={index} className="glass-morphism">
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    stat.change.startsWith('+') ? 'tycho-positive' : 'tycho-negative'
                  }`}
                >
                  {stat.change}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
        
        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          {watchlistCategories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="flex items-center space-x-2"
            >
              <span>{category.name}</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {category.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Watchlist Table */}
      <Card className="glass-morphism">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Star className="w-5 h-5 mr-2" />
            Your Watchlist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTokens.map((token, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 transition-all cursor-pointer"
              >
                {/* Token Info */}
                <div className="flex items-center space-x-4">
                  <button className="p-1 rounded-full hover:bg-background/50 transition-colors">
                    <Heart 
                      className={`w-4 h-4 ${
                        token.isFavorite 
                          ? 'fill-red-500 text-red-500' 
                          : 'text-muted-foreground hover:text-red-500'
                      }`} 
                    />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <span className="text-sm font-bold">{token.symbol.slice(0, 2)}</span>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium">{token.symbol}</p>
                      <Badge variant="outline" className="text-xs">
                        {token.category}
                      </Badge>
                      {token.alerts > 0 && (
                        <div className="flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3 text-orange-500" />
                          <span className="text-xs text-orange-500">{token.alerts}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{token.name}</p>
                  </div>
                </div>

                {/* Price Info */}
                <div className="text-right space-y-1">
                  <p className="font-medium">{token.price}</p>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        token.change24h.startsWith('+') ? 'tycho-positive' : 'tycho-negative'
                      }`}
                    >
                      {token.change24h.startsWith('+') ? (
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 mr-1" />
                      )}
                      {token.change24h}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">24h</p>
                </div>

                {/* 7d Change */}
                <div className="text-right space-y-1">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      token.change7d.startsWith('+') ? 'tycho-positive' : 'tycho-negative'
                    }`}
                  >
                    {token.change7d}
                  </Badge>
                  <p className="text-xs text-muted-foreground">7d</p>
                </div>

                {/* Volume & Market Cap */}
                <div className="text-right space-y-1">
                  <p className="text-sm font-medium">{token.volume}</p>
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="text-xs text-muted-foreground">{token.marketCap}</p>
                </div>

                {/* Trend Indicator */}
                <div className="flex items-center space-x-2">
                  {token.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                  {token.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                  {token.trend === 'stable' && <div className="w-4 h-4 rounded-full bg-gray-400" />}
                  <Button variant="ghost" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
