import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, DollarSign } from 'lucide-react';
import { QuotingConfig, Token } from '@/types/price-quoter';

interface QuotingParametersProps {
  config: QuotingConfig;
  numeraireOptions: Token[];
  onConfigChange: (field: keyof QuotingConfig, value: any) => void;
}

export function QuotingParameters({ config, numeraireOptions, onConfigChange }: QuotingParametersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="w-5 h-5" />
          <span>Quoting Parameters</span>
        </CardTitle>
        <CardDescription>
          Configure how price quotes are calculated
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Numeraire Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Numeraire Token</label>
          <div className="grid grid-cols-2 gap-2">
            {numeraireOptions.map((token) => (
              <Button
                key={token.id}
                variant={config.numeraire.id === token.id ? "default" : "outline"}
                size="sm"
                onClick={() => onConfigChange('numeraire', token)}
                className="justify-start"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                {token.symbol}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The token used as the base currency for price calculations
          </p>
        </div>

        {/* Probing Depth */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Probing Depth</label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              step="0.1"
              value={config.probingDepth}
              onChange={(e) => onConfigChange('probingDepth', e.target.value)}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">
              {config.numeraire.symbol}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            The amount of numeraire used to probe liquidity depth
          </p>
        </div>

        {/* Max Hops */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Maximum Hops</label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              min="1"
              max="5"
              value={config.maxHops}
              onChange={(e) => onConfigChange('maxHops', parseInt(e.target.value))}
              className="w-20"
            />
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((hops) => (
                <Button
                  key={hops}
                  variant={config.maxHops === hops ? "default" : "outline"}
                  size="sm"
                  onClick={() => onConfigChange('maxHops', hops)}
                >
                  {hops}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum number of intermediate tokens in a swap path
          </p>
        </div>

        {/* TVL Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">TVL Filter</label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              step="10000"
              value={config.tvlFilter}
              onChange={(e) => onConfigChange('tvlFilter', parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">USD</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum pool TVL required to be included in path finding
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 