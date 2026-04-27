"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Clock, Activity, TrendingUp } from 'lucide-react';

interface StatsData {
  quotesToday: number;
  quotesChange: number;
  avgResponse: number;
  responseChange: number;
  trackedTokens: number;
  newTokens: number;
  activePools: number;
  poolsUptime: number;
}

interface StatsWidgetsProps {
  statsData: StatsData;
}

export function StatsWidgets({ statsData }: StatsWidgetsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card className="stats-card">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Quotes Today</p>
              <p className="text-lg font-bold tycho-mono modern-number transition-all duration-500 hover:scale-105 hover:text-[#03ffbb] hover:drop-shadow-[0_0_8px_rgba(3,255,187,0.5)]">
                {statsData.quotesToday.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </p>
            </div>
            <Eye className="w-6 h-6 text-muted-foreground animate-card-icon-pulse" />
          </div>
          <p className={`text-xs modern-number transition-colors duration-300 ${
            statsData.quotesChange >= 0 ? 'tycho-positive' : 'tycho-negative'
          }`}>
            {statsData.quotesChange >= 0 ? '+' : ''}{statsData.quotesChange.toFixed(1)}%
          </p>
        </CardContent>
      </Card>
      
      <Card className="stats-card">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Avg Response</p>
              <p className="text-lg font-bold tycho-mono modern-number transition-all duration-500 hover:scale-105 hover:text-[#03ffbb] hover:drop-shadow-[0_0_8px_rgba(3,255,187,0.5)]">
                {statsData.avgResponse.toFixed(1)}s
              </p>
            </div>
            <Clock className="w-6 h-6 text-muted-foreground animate-card-icon-spin" />
          </div>
          <p className={`text-xs modern-number transition-colors duration-300 ${
            statsData.responseChange <= 0 ? 'tycho-positive' : 'tycho-negative'
          }`}>
            {statsData.responseChange <= 0 ? '' : '+'}{statsData.responseChange.toFixed(2)}s
          </p>
        </CardContent>
      </Card>
      
      <Card className="stats-card">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Tracked Tokens</p>
              <p className="text-lg font-bold tycho-mono modern-number transition-all duration-500 hover:scale-105 hover:text-[#03ffbb] hover:drop-shadow-[0_0_8px_rgba(3,255,187,0.5)]">
                {statsData.trackedTokens.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </p>
            </div>
            <Activity className="w-6 h-6 text-muted-foreground animate-card-icon-pulse" />
          </div>
          <p className="text-xs text-blue-500 modern-number transition-all duration-300">
            +{statsData.newTokens} new
          </p>
        </CardContent>
      </Card>
      
      <Card className="stats-card">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Active Pools</p>
              <p className="text-lg font-bold tycho-mono modern-number transition-all duration-500 hover:scale-105 hover:text-[#03ffbb] hover:drop-shadow-[0_0_8px_rgba(3,255,187,0.5)]">
                {statsData.activePools.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </p>
            </div>
            <TrendingUp className="w-6 h-6 text-muted-foreground animate-card-icon-bounce" />
          </div>
          <p className="text-xs tycho-positive modern-number transition-all duration-300">
            {statsData.poolsUptime.toFixed(1)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 