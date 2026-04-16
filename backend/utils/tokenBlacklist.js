// Simple in-memory token blacklist (use Redis in production for distributed systems)
const blacklistedTokens = new Set();

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of blacklistedTokens.entries()) {
    if (now > expiry) {
      blacklistedTokens.delete(token);
    }
  }
}, 60 * 60 * 1000);

module.exports = {
  addToken: (token, expiryTime) => {
    blacklistedTokens.add(token);
    // Auto-remove after expiry
    setTimeout(() => blacklistedTokens.delete(token), expiryTime - Date.now());
  },
  
  isBlacklisted: (token) => {
    return blacklistedTokens.has(token);
  }
};
