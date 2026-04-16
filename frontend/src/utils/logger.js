const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const logger = {
  log: (...args) => !IS_PRODUCTION && console.log(...args),
  error: (...args) => !IS_PRODUCTION && console.error(...args),
  warn: (...args) => !IS_PRODUCTION && console.warn(...args),
  info: (...args) => !IS_PRODUCTION && console.info(...args),
};
