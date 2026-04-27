import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Filter, Plus, Trash2 } from 'lucide-react';
import { Token } from '@/types/price-quoter';

interface TrackedTokensProps {
  trackedTokens: Token[];
  onAddToken: (token: Token) => void;
  onRemoveToken: (tokenId: string) => void;
}

export function TrackedTokens({ trackedTokens, onAddToken, onRemoveToken }: TrackedTokensProps) {
  const [newTokenAddress, setNewTokenAddress] = useState('');

  const handleAddToken = () => {
    if (newTokenAddress && !trackedTokens.find(t => t.address.toLowerCase() === newTokenAddress.toLowerCase())) {
      // In real app, you'd fetch token info from the address
      const newToken: Token = {
        id: `token-${Date.now()}`,
        address: newTokenAddress,
        name: 'Unknown Token',
        symbol: '???',
        decimals: 18
      };
      onAddToken(newToken);
      setNewTokenAddress('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Filter className="w-5 h-5" />
          <span>Tracked Tokens</span>
        </CardTitle>
        <CardDescription>
          Manage tokens that are tracked for price history
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Add New Token */}
        <div className="flex space-x-2 mb-6">
          <Input
            placeholder="Enter token address (0x...)"
            value={newTokenAddress}
            onChange={(e) => setNewTokenAddress(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAddToken} disabled={!newTokenAddress}>
            <Plus className="w-4 h-4 mr-2" />
            Add Token
          </Button>
        </div>

        {/* Tracked Tokens List */}
        <div className="space-y-3">
          {trackedTokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {token.symbol.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{token.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-xs">
                  {token.symbol}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveToken(token.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 