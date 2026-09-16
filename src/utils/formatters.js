// src/utils/formatters.js
// ============================================================================
// Data Formatting Utilities
// ============================================================================
// Purpose: Helper functions for formatting common data types.
// ============================================================================

/** Format a number as USD currency. Handles NaN/null/undefined gracefully. */
export function formatUSD(amount) {
  const num = safeNumber(amount, 0);
  if (!Number.isFinite(num)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/** Format a decimal as a percentage string. Input: 0.42 -> Output: "42%" */
export function formatPercent(value, decimals = 0) {
  const num = safeNumber(value, 0);
  if (!Number.isFinite(num)) return '0%';
  return (Math.round(num * 100 * Math.pow(10, decimals)) / Math.pow(10, decimals)) + '%';
}

/** Format a number with commas and specified decimal places. */
export function formatNumber(value, decimals = 0) {
  const num = safeNumber(value, 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/** Safely convert a value to a number. */
export function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return value;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/** Safely convert a value to a string. */
export function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  return String(value);
}

/** Remove markdown formatting from text (code blocks, headers, bold, etc.) */
export function stripMarkdown(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/```[\s\S]*?```/g, '')            // Code blocks
    .replace(/`([^`]+)`/g, '$1')                // Inline code
    .replace(/^#{1,6}\s+/gm, '')                // Headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // Bold
    .replace(/\*([^*]+)\*/g, '$1')              // Italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // Links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')     // Images
    .replace(/>\s*/g, '')                       // Blockquotes
    .replace(/^-{2,}/g, '')                     // Horizontal rules
    .replace(/^\s*[-*+]\s+/gm, '')              // List items
    .trim();
}

/** Truncate text to a maximum length, adding ellipsis if needed. */
export function truncate(text, maxLength) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/** Generate a simple unique ID. */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? prefix + '-' + timestamp + random : timestamp + random;
}

export default {
  formatUSD,
  formatPercent,
  formatNumber,
  safeNumber,
  safeString,
  stripMarkdown,
  truncate,
  generateId,
};