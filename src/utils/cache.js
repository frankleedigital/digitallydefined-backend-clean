// src/utils/cache.js
// ============================================================================
// In-Memory TTL Cache
// ============================================================================
// Purpose: Simple key/value cache with expiry for external API responses.
// ============================================================================

const caches = new Map();

export function getCache(key) {
  const entry = caches.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    caches.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data, ttlMs = 5 * 60 * 1000) {
  caches.set(key, { data, expiry: Date.now() + ttlMs });
  return data;
}

export function clearCache(pattern) {
  if (!pattern) {
    caches.clear();
    return;
  }
  for (const key of caches.keys()) {
    if (key.includes(pattern)) caches.delete(key);
  }
}

export function cacheSize() {
  return caches.size;
}

export default { getCache, setCache, clearCache, cacheSize };