import { TokenNetwork } from './components/token-network';
import { NetworkRealTimeProvider } from './components/network-real-time-context';

export default function TokenNetworkPage() {
  return (
    <NetworkRealTimeProvider initialUpdateInterval={8000}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <TokenNetwork />
      </div>
    </NetworkRealTimeProvider>
  );
} 