"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Star, 
  BarChart3, 
  Settings, 
  Network,
  History,
  Bell,
  List,
  Globe,
  Menu,
  X,
  ChevronDown,
  Layers,
  Fuel
} from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = [
    { id: 'prices', label: 'Price List', icon: List, href: '/' },
    { id: 'path-explorer', label: 'Path Explorer', icon: Network, href: '/path-explorer' },
    { id: 'token-network', label: 'Token Network', icon: Globe, href: '/token-network' },
    { id: 'watchlist', label: 'Watchlist', icon: Star, href: '/watchlist' },
    { id: 'alerts', label: 'Alerts', icon: Bell, href: '/alerts' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  return (
    <div className="nav-glass w-full relative border-0">
      <div className="w-full">
        <div className={`flex items-center justify-between ${isMobile ? 'h-14 px-4' : 'h-16 px-6'}`}>
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity duration-200">
              <div className="relative">
                <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl bg-gradient-to-br from-[#03ffbb] to-[#00d199] flex items-center justify-center shadow-lg`}>
                  <div className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-lg bg-[#1a0b2e] flex items-center justify-center`}>
                    <div className={`${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} bg-[#03ffbb] rounded-sm`}></div>
                  </div>
                </div>
                <div className={`absolute -top-1 -right-1 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} bg-gradient-to-r from-[#ff3366] to-[#ff6b9d] rounded-full shadow-md`}></div>
              </div>
              <div>
                <h1 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold bg-gradient-to-r from-[#fff4e0] to-[#03ffbb] bg-clip-text text-transparent`}>
                  Price Quoter
                </h1>
                <p className="text-xs text-muted-foreground -mt-1">Live DeFi Prices</p>
              </div>
            </Link>
          </div>

          {/* Desktop Status Info */}
          {!isMobile && (
            <>
              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Status Info */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#1a0b2e]/50 to-[#2a1a3e]/50 backdrop-blur-sm border border-[#03ffbb]/20 shadow-lg">
                  <Layers className="w-3.5 h-3.5 text-[#03ffbb]" />
                  <span className="text-xs font-mono text-[#03ffbb] font-medium">
                    18,457,892
                  </span>
                </div>
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#1a0b2e]/50 to-[#2a1a3e]/50 backdrop-blur-sm border border-orange-400/20 shadow-lg">
                  <Fuel className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-mono text-orange-400 font-medium">
                    25 gwei
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Mobile Status Info */}
          {isMobile && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-[#1a0b2e]/50 to-[#2a1a3e]/50 backdrop-blur-sm border border-[#03ffbb]/20 shadow-md">
                <Layers className="w-3 h-3 text-[#03ffbb]" />
                <span className="text-xs font-mono text-[#03ffbb] font-medium">
                  18,457,892
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Navigation Tabs */}
        {!isMobile && (
          <div className="flex space-x-3 py-2 px-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.id} href={item.href} className="cursor-pointer">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex items-center space-x-2 tycho-focus rounded-lg transition-all duration-300 px-4 py-2 cursor-pointer ${
                      isActive 
                        ? 'nav-tab-active font-medium' 
                        : 'nav-tab-inactive hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        )}

        {/* Mobile Horizontal Scrollable Tabs */}
        {isMobile && (
          <div className="mobile-tabs-container">
            <div className="mobile-tabs-scroll">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.id} href={item.href} className="cursor-pointer">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`mobile-tab-item cursor-pointer ${
                        isActive 
                          ? 'mobile-tab-active' 
                          : 'mobile-tab-inactive hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}