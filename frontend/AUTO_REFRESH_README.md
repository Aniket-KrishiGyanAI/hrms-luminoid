# Auto-Refresh Implementation Guide

## ✅ What's Been Added

1. **DataContext** - Global state management
2. **useAutoRefresh** - Hook for automatic data fetching
3. **useMutation** - Hook for create/update/delete operations
4. **SmoothLoader** - Single unified loading component

## 🚀 How to Use in Your Components

### Basic Auto-Refresh

```jsx
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import SmoothLoader from '../components/SmoothLoader';

function MyComponent() {
  const { data, loading, refresh } = useAutoRefresh(
    '/api/endpoint',
    'uniqueKey',
    { interval: 30000 } // 30 seconds
  );

  // Only show loader on initial load
  if (loading && !data) return <SmoothLoader />;

  return <div>{/* Your UI */}</div>;
}
```

### With Create/Update/Delete

```jsx
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useMutation } from '../hooks/useMutation';

function TaskList() {
  const { data: tasks } = useAutoRefresh('/api/tasks', 'tasks', { interval: 15000 });
  const { create, update, remove } = useMutation('tasks');

  const handleCreate = async (taskData) => {
    await create('/api/tasks', taskData);
    // UI updates automatically!
  };

  const handleUpdate = async (id, updates) => {
    await update(`/api/tasks/${id}`, id, updates);
    // UI updates automatically!
  };

  const handleDelete = async (id) => {
    await remove(`/api/tasks/${id}`, id);
    // UI updates automatically!
  };

  return <div>{/* Your UI */}</div>;
}
```

## 🎨 Loading Spinner Options

```jsx
<SmoothLoader type="gradient" size="medium" />
<SmoothLoader type="dots" />
<SmoothLoader type="pulse" />
<SmoothLoader type="bars" />
```

## 🔧 Configuration Options

```jsx
useAutoRefresh('/api/endpoint', 'key', {
  interval: 30000,        // Refresh interval in ms (0 = no auto-refresh)
  enabled: true,          // Enable/disable auto-refresh
  transform: (data) => data.filter(...), // Transform data before setting
  onSuccess: (data) => console.log(data),
  onError: (error) => console.error(error)
});
```

## ⚡ Key Features

- ✅ **No page refresh needed** - Data updates automatically
- ✅ **Single loading spinner** - Only shows on initial load
- ✅ **Smooth updates** - Background refresh without UI flicker
- ✅ **Optimistic updates** - UI updates immediately on mutations
- ✅ **Memory safe** - Cleans up intervals on unmount
- ✅ **Configurable** - Control refresh intervals per component

## 📝 Migration Example

**Before:**
```jsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    const response = await api.get('/api/employees');
    setData(response.data);
    setLoading(false);
  };
  fetchData();
}, []);
```

**After:**
```jsx
const { data, loading } = useAutoRefresh('/api/employees', 'employees', {
  interval: 30000
});

if (loading && !data) return <SmoothLoader />;
```

## 🎯 Best Practices

1. **Use unique keys** for each data type (e.g., 'employees', 'tasks', 'attendance')
2. **Set appropriate intervals** - Don't refresh too frequently
3. **Only show loader on initial load** - `if (loading && !data)`
4. **Use transform** to filter/sort data before setting state
5. **Disable auto-refresh** when not needed (e.g., modal closed)

## 📦 Files Created

- `src/context/DataContext.js` - Global state management
- `src/hooks/useAutoRefresh.js` - Auto-refresh hook
- `src/hooks/useMutation.js` - Mutation hook
- `src/components/SmoothLoader.js` - Loading component
- `src/examples/AutoRefreshExamples.js` - Usage examples
