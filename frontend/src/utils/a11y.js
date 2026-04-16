export const a11y = {
  button: (label) => ({
    'aria-label': label,
    role: 'button',
    tabIndex: 0,
  }),
  
  link: (label) => ({
    'aria-label': label,
    role: 'link',
    tabIndex: 0,
  }),
  
  handleKeyPress: (callback) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback(e);
    }
  },
};
