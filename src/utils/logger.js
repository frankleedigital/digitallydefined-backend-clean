// src/utils/logger.js
// ============================================================================
// Centralized Logging Utility
// ============================================================================
// Purpose: Structured logging with JSON output, timestamps, and levels.
// Features:
//   - info(msg, data): Log informational messages
//   - warn(msg, data): Log warnings
//   - error(msg, error): Log errors with stack traces
//   - debug(msg, data): Log debug info (only in non-production)
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  info: (msg, data = {}) => {
    console.log(JSON.stringify({
      level: 'info',
      msg,
      ...data,
      ts: new Date().toISOString(),
    }));
  },

  warn: (msg, data = {}) => {
    console.warn(JSON.stringify({
      level: 'warn',
      msg,
      ...data,
      ts: new Date().toISOString(),
    }));
  },

  error: (msg, error = null) => {
    console.error(JSON.stringify({
      level: 'error',
      msg,
      stack: error && error.stack ? error.stack : null,
      name: error && error.name ? error.name : null,
      ts: new Date().toISOString(),
    }));
  },

  debug: (msg, data = {}) => {
    if (!isProduction) {
      console.log(JSON.stringify({
        level: 'debug',
        msg,
        ...data,
        ts: new Date().toISOString(),
      }));
    }
  },

  // Pretty print for human-readable logs in development
  table: (label, data) => {
    if (!isProduction) {
      console.log('\n[' + label + ']');
      console.table(data);
      console.log('');
    }
  },
};

export default logger;