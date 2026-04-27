import { useState } from 'react';
import { QuotingConfig, Token } from '@/types/price-quoter';

// Mock data
const mockTrackedTokens: Token[] = [
  {
    id: 'eth',
    address: '0x0000000000000000000000000000000000000000',
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  },
  {
    id: 'usdc',
    address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6
  },
  {
    id: 'uni',
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    name: 'Uniswap',
    symbol: 'UNI',
    decimals: 18
  }
];

export const numeraireOptions: Token[] = [
  {
    id: 'eth',
    address: '0x0000000000000000000000000000000000000000',
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  },
  {
    id: 'usdc',
    address: '0xa0b86a33e6c0132d5c3f38f2d2c3e5f4c5b86a33',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6
  },
  {
    id: 'dai',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    name: 'Dai Stablecoin',
    symbol: 'DAI',
    decimals: 18
  },
  {
    id: 'eurc',
    address: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
    name: 'Euro Coin',
    symbol: 'EURC',
    decimals: 6
  }
];

const defaultConfig: QuotingConfig = {
  numeraire: numeraireOptions[1], // USDC
  probingDepth: '1.0',
  maxHops: 3,
  tvlFilter: 100000,
  gasPrice: 25,
  includeGasInPrice: true
};

export function useSettings() {
  const [config, setConfig] = useState<QuotingConfig>(defaultConfig);
  const [trackedTokens, setTrackedTokens] = useState<Token[]>(mockTrackedTokens);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleConfigChange = (field: keyof QuotingConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveSettings = () => {
    // Here you would save to backend or local storage
    console.log('Saving config:', config);
    console.log('Saving tracked tokens:', trackedTokens);
    setHasUnsavedChanges(false);
  };

  const handleResetSettings = () => {
    setConfig(defaultConfig);
    setTrackedTokens(mockTrackedTokens);
    setHasUnsavedChanges(false);
  };

  const addTrackedToken = (token: Token) => {
    setTrackedTokens(prev => [...prev, token]);
    setHasUnsavedChanges(true);
  };

  const removeTrackedToken = (tokenId: string) => {
    setTrackedTokens(prev => prev.filter(t => t.id !== tokenId));
    setHasUnsavedChanges(true);
  };

  return {
    // State
    config,
    trackedTokens,
    hasUnsavedChanges,
    numeraireOptions,
    
    // Actions
    handleConfigChange,
    handleSaveSettings,
    handleResetSettings,
    addTrackedToken,
    removeTrackedToken
  };
} 