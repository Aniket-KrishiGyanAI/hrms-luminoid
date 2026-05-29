# Global Spinner Migration Guide

## ✅ What's Been Created

1. **GlobalSpinner Component** - `src/components/GlobalSpinner.js`
2. **GlobalSpinner CSS** - `src/components/GlobalSpinner.css`
3. **Spinner Utility** - `src/utils/spinner.js`

## 🔄 Already Updated

- ✅ App.js (LoadingFallback)
- ✅ Dashboard.js
- ✅ Attendance.js

## 📝 How to Replace Spinners in Other Pages

### Old Pattern (Bootstrap Spinner):
```jsx
<div className="spinner-border text-primary" role="status"></div>
```

### New Pattern (Global Spinner):
```jsx
import GlobalSpinner from '../components/GlobalSpinner';

// Inline
<GlobalSpinner />

// With size
<GlobalSpinner size="small" />
<GlobalSpinner size="large" />

// Full screen
<GlobalSpinner fullScreen text="Loading..." />
```

### Button Spinners:
```jsx
// Old
<span className="spinner-border spinner-border-sm"></span>

// New
<span className="btn-spinner"></span>
```

## 🎯 Pages to Update

Search for these patterns and replace:
- `spinner-border`
- `loading-spinner`
- `text-center py-4` with spinner divs
- Custom spinner implementations

## 🚀 Quick Replace Commands

1. Import at top of file:
```jsx
import GlobalSpinner from '../components/GlobalSpinner';
```

2. Replace loading states:
```jsx
if (loading) return <GlobalSpinner />;
```

3. Replace button spinners:
```jsx
{loading ? <span className="btn-spinner"></span> : <i className="fas fa-icon"></i>}
```
