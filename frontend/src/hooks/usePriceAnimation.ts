import { useState, useEffect, useRef } from 'react';

interface PriceAnimationState {
  isAnimating: boolean;
  animationType: 'increase' | 'decrease' | 'neutral';
  previousPrice?: number;
}

export function usePriceAnimation(currentPrice: number, duration: number = 1000) {
  const [animationState, setAnimationState] = useState<PriceAnimationState>({
    isAnimating: false,
    animationType: 'neutral'
  });
  
  const previousPriceRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (previousPriceRef.current !== undefined && previousPriceRef.current !== currentPrice) {
      const animationType = currentPrice > previousPriceRef.current ? 'increase' : 'decrease';
      
      setAnimationState({
        isAnimating: true,
        animationType,
        previousPrice: previousPriceRef.current
      });

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Stop animation after duration
      timeoutRef.current = setTimeout(() => {
        setAnimationState(prev => ({
          ...prev,
          isAnimating: false
        }));
      }, duration);
    }

    previousPriceRef.current = currentPrice;

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentPrice, duration]);

  const getAnimationClass = () => {
    if (!animationState.isAnimating) return '';
    
    switch (animationState.animationType) {
      case 'increase':
        return 'animate-price-increase';
      case 'decrease':
        return 'animate-price-decrease';
      default:
        return '';
    }
  };

  return {
    ...animationState,
    getAnimationClass,
    reset: () => setAnimationState({
      isAnimating: false,
      animationType: 'neutral'
    })
  };
} 