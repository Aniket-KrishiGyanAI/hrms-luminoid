import { useState, useCallback } from 'react';
import { useData } from '../context/DataContext';
import api from '../utils/api';

export const useMutation = (key) => {
  const { updateItem, addItem, removeItem } = useData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = useCallback(async (endpoint, data) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(endpoint, data);
      addItem(key, response.data);
      return { success: true, data: response.data };
    } catch (err) {
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  }, [key, addItem]);

  const update = useCallback(async (endpoint, id, data) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put(endpoint, data);
      updateItem(key, id, response.data);
      return { success: true, data: response.data };
    } catch (err) {
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  }, [key, updateItem]);

  const remove = useCallback(async (endpoint, id) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(endpoint);
      removeItem(key, id);
      return { success: true };
    } catch (err) {
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  }, [key, removeItem]);

  return { create, update, remove, loading, error };
};
