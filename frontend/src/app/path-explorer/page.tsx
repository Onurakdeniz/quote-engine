import { PathExplorer } from './components/path-explorer';
import { RealTimeProvider } from './components/real-time-context';

export default function PathExplorerPage() {
  return (
    <RealTimeProvider initialUpdateInterval={12000}>
      <div className="min-h-full overflow-visible bg-gradient-to-br from-background via-background to-muted/30">
        <PathExplorer />
      </div>
    </RealTimeProvider>
  );
} 
