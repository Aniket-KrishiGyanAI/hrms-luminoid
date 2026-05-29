import { useEffect, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import api from '../utils/api';

export const useAutoRefresh = (endpoint, key, options = {}) => {
  const {
    interval = 30000, // 30 seconds default
    enabled = true,
    onSuccess,
    onError,
    transform
  } = options;

  const { state, setData, setLoading } = useData();
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async (isInitial = false) => {
    if (!enabled || !isMountedRef.current) return;

    try {
      // Only show loading on initial fetch, not on auto-refresh
      if (isInitial) {
        setLoading(key, true);
      }
      const response = await api.get(endpoint);
      const data = transform ? transform(response.data) : response.data;
      
      if (isMountedRef.current) {
        setData(key, data);
        onSuccess?.(data);
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error(`Error fetching ${key}:`, error);
        onError?.(error);
      }
    } finally {
      if (isMountedRef.current && isInitial) {
        setLoading(key, false);
      }
    }
  }, [endpoint, key, enabled, transform, setData, setLoading, onSuccess, onError]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (enabled) {
      fetchData(true); // Initial fetch with loading
      
      if (interval > 0) {
        intervalRef.current = setInterval(() => fetchData(false), interval);
      }
    }

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, interval, enabled]);

  return {
    data: state[key],
    loading: state.loading[key],
    refresh: fetchData
  };
};
