/**
 * Global Spinner Utility
 * 
 * Import and use the GlobalSpinner component anywhere in your app
 * 
 * Usage Examples:
 * 
 * 1. Inline Loading (default):
 *    import { Spinner } from '../utils/spinner';
 *    {loading && <Spinner />}
 * 
 * 2. Full Screen Loading:
 *    {loading && <Spinner fullScreen />}
 * 
 * 3. With Text:
 *    {loading && <Spinner text="Loading data..." />}
 * 
 * 4. Different Sizes:
 *    <Spinner size="small" />
 *    <Spinner size="medium" />
 *    <Spinner size="large" />
 * 
 * 5. Button Spinner (inline):
 *    <button disabled={loading}>
 *      {loading ? <span className="btn-spinner"></span> : <i className="fas fa-save"></i>}
 *      Save
 *    </button>
 */

import GlobalSpinner from '../components/GlobalSpinner';

// Export as named export for convenience
export const Spinner = GlobalSpinner;

// Export default
export default GlobalSpinner;

// Helper function to show/hide full screen spinner programmatically
let spinnerElement = null;

export const showSpinner = (text = '') => {
  if (spinnerElement) return;
  
  spinnerElement = document.createElement('div');
  spinnerElement.id = 'global-spinner-root';
  document.body.appendChild(spinnerElement);
  
  const spinner = document.createElement('div');
  spinner.className = 'global-spinner-overlay';
  spinner.innerHTML = `
    <div class="global-spinner-container">
      <div class="gradient-spinner" style="width: 60px; height: 60px;"></div>
      ${text ? `<div class="spinner-text">${text}</div>` : ''}
    </div>
  `;
  
  spinnerElement.appendChild(spinner);
};

export const hideSpinner = () => {
  if (spinnerElement) {
    spinnerElement.remove();
    spinnerElement = null;
  }
};
