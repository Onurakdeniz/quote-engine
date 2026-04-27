import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Fuel, Gauge } from 'lucide-react';
import { QuotingConfig } from '@/types/price-quoter';

interface GasConfigurationProps {
  config: QuotingConfig;
  onConfigChange: (field: keyof QuotingConfig, value: any) => void;
}

export function GasConfiguration({ config, onConfigChange }: GasConfigurationProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Fuel className="w-5 h-5" />
          <span>Gas Configuration</span>
        </CardTitle>
        <CardDescription>
          Configure gas settings for price calculations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Gas Price */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Network Gas</p>
              <p className="text-2xl font-bold">25 gwei</p>
              <p className="text-sm text-green-500">Standard: 22 gwei</p>
            </div>
            <Gauge className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        {/* Gas Price Override */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Gas Price Override</label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              min="1"
              step="1"
              value={config.gasPrice}
              onChange={(e) => onConfigChange('gasPrice', parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">gwei</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Override automatic gas price detection (0 = auto)
          </p>
        </div>

        {/* Include Gas in Price */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Include Gas Cost in Net Price</label>
              <p className="text-xs text-muted-foreground">
                Whether to subtract estimated gas costs from quoted prices
              </p>
            </div>
            <Button
              variant={config.includeGasInPrice ? "default" : "outline"}
              size="sm"
              onClick={() => onConfigChange('includeGasInPrice', !config.includeGasInPrice)}
            >
              {config.includeGasInPrice ? 'ON' : 'OFF'}
            </Button>
          </div>
        </div>

        {/* Gas Estimation Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Simple Swap</p>
              <p className="font-medium">~21,000 gas</p>
            </div>
            <div>
              <p className="text-muted-foreground">Multi-hop Swap</p>
              <p className="font-medium">~150,000 gas</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 