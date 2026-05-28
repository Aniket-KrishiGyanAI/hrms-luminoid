import React, { createContext, useContext, useReducer, useCallback } from 'react';

const DataContext = createContext();

const dataReducer = (state, action) => {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, [action.key]: action.payload };
    case 'UPDATE_ITEM':
      return {
        ...state,
        [action.key]: state[action.key]?.map(item =>
          item._id === action.id ? { ...item, ...action.updates } : item
        )
      };
    case 'ADD_ITEM':
      return {
        ...state,
        [action.key]: [action.payload, ...(state[action.key] || [])]
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        [action.key]: state[action.key]?.filter(item => item._id !== action.id)
      };
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, [action.key]: action.payload } };
    default:
      return state;
  }
};

export const DataProvider = ({ children }) => {
  const [state, dispatch] = useReducer(dataReducer, { loading: {} });

  const setData = useCallback((key, data) => {
    dispatch({ type: 'SET_DATA', key, payload: data });
  }, []);

  const updateItem = useCallback((key, id, updates) => {
    dispatch({ type: 'UPDATE_ITEM', key, id, updates });
  }, []);

  const addItem = useCallback((key, item) => {
    dispatch({ type: 'ADD_ITEM', key, payload: item });
  }, []);

  const removeItem = useCallback((key, id) => {
    dispatch({ type: 'REMOVE_ITEM', key, id });
  }, []);

  const setLoading = useCallback((key, loading) => {
    dispatch({ type: 'SET_LOADING', key, payload: loading });
  }, []);

  return (
    <DataContext.Provider value={{ state, setData, updateItem, addItem, removeItem, setLoading }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
