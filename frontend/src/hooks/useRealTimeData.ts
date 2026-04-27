import { useState, useEffect, useRef } from 'react';

interface RealTimeDataConfig {
  interval?: number;
  enabled?: boolean;
}

export function useRealTimeData<T>(
  fetchData: () => Promise<T> | T,
  config: RealTimeDataConfig = {}
) {
  const { interval = 5000, enabled = true } = config;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAndUpdate = async () => {
    try {
      setError(null);
      const result = await fetchData();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchAndUpdate();

    // Set up interval for real-time updates
    intervalRef.current = setInterval(fetchAndUpdate, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, enabled]);

  const refetch = () => {
    setLoading(true);
    fetchAndUpdate();
  };

  return {
    data,
    loading,
    error,
    refetch
  };
} 