"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  Plus, 
  Search, 
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Volume2,
  VolumeX,
  Settings,
  Trash2,
  Edit,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Zap
} from 'lucide-react';

export function Alerts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  const alertStats = [
    { label: 'Active Alerts', value: '23', icon: Bell, color: 'text-blue-500' },
    { label: 'Triggered Today', value: '7', icon: CheckCircle, color: 'text-green-500' },
    { label: 'Waiting', value: '16', icon: Clock, color: 'text-orange-500' },
    { label: 'Total Alerts', value: '156', icon: Target, color: 'text-purple-500' },
  ];

  const activeAlerts = [
    {
      id: 1,
      token: 'WETH',
      name: 'Wrapped Ethereum',
      type: 'price_above',
      condition: 'Price > $2,500',
      currentPrice: '$2,316.43',
      target: '$2,500.00',
      status: 'active',
      created: '2024-01-15',
      timeLeft: '2h 34m',
      priority: 'high'
    },
    {
      id: 2,
      token: 'UNI',
      name: 'Uniswap',
      type: 'price_below',
      condition: 'Price < $3.00',
      currentPrice: '$3.23',
      target: '$3.00',
      status: 'active',
      created: '2024-01-14',
      timeLeft: '1d 12h',
      priority: 'medium'
    },
    {
      id: 3,
      token: 'MATIC',
      name: 'Polygon',
      type: 'volume_surge',
      condition: 'Volume > $150M',
      currentVolume: '$98M',
      target: '$150M',
      status: 'active',
      created: '2024-01-13',
      timeLeft: '6h 22m',
      priority: 'low'
    }
  ];

  const triggeredAlerts = [
    {
      id: 4,
      token: 'ARB',
      name: 'Arbitrum',
      type: 'price_above',
      condition: 'Price > $0.12',
      triggeredPrice: '$0.1241',
      target: '$0.12',
      status: 'triggered',
      triggeredAt: '2024-01-16 14:32',
      priority: 'high'
    },
    {
      id: 5,
      token: 'LINK',
      name: 'Chainlink',
      type: 'price_below',
      condition: 'Price < $9.50',
      triggeredPrice: '$9.19',
      target: '$9.50',
      status: 'triggered',
      triggeredAt: '2024-01-16 09:15',
      priority: 'medium'
    }
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'price_above':
        return <ArrowUpRight className="w-4 h-4 text-green-500" />;
      case 'price_below':
        return <ArrowDownRight className="w-4 h-4 text-red-500" />;
      case 'volume_surge':
        return <Volume2 className="w-4 h-4 text-blue-500" />;
      case 'volume_drop':
        return <VolumeX className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-500/10';
      case 'medium':
        return 'border-orange-500 bg-orange-500/10';
      case 'low':
        return 'border-green-500 bg-green-500/10';
      default:
        return 'border-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div className="w-full px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Price Alerts</h1>
          <p className="text-muted-foreground">Set up and manage your price and volume alerts</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create Alert
          </Button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {alertStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="glass-morphism">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className="p-3 rounded-full bg-primary/10">
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="glass-morphism">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Quick Alert Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="p-4 h-auto flex-col space-y-2">
              <ArrowUpRight className="w-6 h-6 text-green-500" />
              <span className="font-medium">Price Breakout</span>
              <span className="text-xs text-muted-foreground">Alert when price breaks resistance</span>
            </Button>
            <Button variant="outline" className="p-4 h-auto flex-col space-y-2">
              <ArrowDownRight className="w-6 h-6 text-red-500" />
              <span className="font-medium">Price Drop</span>
              <span className="text-xs text-muted-foreground">Alert when price falls below support</span>
            </Button>
            <Button variant="outline" className="p-4 h-auto flex-col space-y-2">
              <Volume2 className="w-6 h-6 text-blue-500" />
              <span className="font-medium">Volume Spike</span>
              <span className="text-xs text-muted-foreground">Alert on unusual volume activity</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Alerts Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active Alerts</TabsTrigger>
          <TabsTrigger value="triggered">Recently Triggered</TabsTrigger>
          <TabsTrigger value="history">Alert History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Card className="glass-morphism">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Active Alerts ({activeAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-4 rounded-lg border-2 ${getPriorityColor(alert.priority)} transition-all`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getAlertIcon(alert.type)}
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <span className="text-xs font-bold">{alert.token.slice(0, 2)}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{alert.token}</p>
                            <Badge variant="outline" className="text-xs">
                              {alert.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.name}</p>
                          <p className="text-xs text-muted-foreground">{alert.condition}</p>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <p className="text-sm font-medium">
                          {alert.type.includes('price') ? alert.currentPrice : alert.currentVolume}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Target: {alert.target}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {alert.timeLeft}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="triggered" className="space-y-4">
          <Card className="glass-morphism">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                Recently Triggered ({triggeredAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {triggeredAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className="p-4 rounded-lg border border-green-500/50 bg-green-500/5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center">
                            <span className="text-xs font-bold">{alert.token.slice(0, 2)}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{alert.token}</p>
                            <Badge variant="outline" className="text-xs text-green-600">
                              Triggered
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.name}</p>
                          <p className="text-xs text-muted-foreground">{alert.condition}</p>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <p className="text-sm font-medium text-green-600">
                          {alert.triggeredPrice}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Target: {alert.target}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alert.triggeredAt}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">
                          <Bell className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="glass-morphism">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Alert History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Alert History</h3>
                <p className="text-muted-foreground">View your complete alert history and analytics</p>
                <Button className="mt-4" variant="outline">
                  Load History
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 
