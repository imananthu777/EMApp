/**
 * Service for interacting with the Netlify serverless function for user data
 */
import { throttle } from './utils';

// Interface definitions
interface UserDataParams {
  mobile: string;
  name?: string;
  data?: any;
}

// Cache implementation
type CacheEntry = {
  data: any;
  timestamp: number;
};

const DATA_CACHE: Record<string, CacheEntry> = {};
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Central request tracking to prevent duplicate requests
const pendingRequests: Record<string, Promise<any>> = {};

// API URL that works in both development and production with caching
const getApiUrl = (() => {
  // Use closure to cache the result
  let cachedUrl: string | null = null;
  
  return () => {
    if (cachedUrl) return cachedUrl;
    
    // Check if we're in development by looking at the URL
    const isDev = window.location.hostname === 'localhost';
    
    // Use localhost:8888 directly for development if needed
    if (isDev && window.location.port !== '8888') {
      console.log('Using development API URL with port 8888');
      cachedUrl = 'http://localhost:8888/.netlify/functions/userData';
    } else {
      // Default relative path works for both dev (with netlify dev) and production
      cachedUrl = '/.netlify/functions/userData';
    }
    
    return cachedUrl;
  };
})();

// Utility function to create cache keys
const createCacheKey = (params: any): string => {
  return `${params.mobile}_${params.dataType || 'user'}_${params.action}`;
};

// Helper for fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number): Promise<Response> => {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/**
 * Fetches user data from the server with caching and request deduplication
 */
export async function fetchUserData(params: { mobile: string }): Promise<any> {
  const cacheKey = createCacheKey({ ...params, action: 'get' });
  
  // Check cache first
  const cachedData = DATA_CACHE[cacheKey];
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    console.log('Using cached user data for:', params.mobile);
    return cachedData.data;
  }
  
  // Check if there's already a pending request for this data
  if (pendingRequests[cacheKey]) {
    console.log('Using existing request for:', params.mobile);
    return pendingRequests[cacheKey];
  }
  
  // Make the request and store the promise
  const requestPromise = (async () => {
    try {
      const apiUrl = getApiUrl();
      console.log('Fetching user data from:', apiUrl);
      
      const response = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: params.mobile,
            action: 'get',
          })
        },
        REQUEST_TIMEOUT
      );
      
      // Clear from pending requests
      delete pendingRequests[cacheKey];
      
      if (!response.ok) {
        if (response.status === 404) {
          // No data found for this user is not an error
          return null;
        }
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the result
      DATA_CACHE[cacheKey] = {
        data,
        timestamp: Date.now()
      };
      
      return data;
    } catch (error) {
      // Clear from pending requests on error
      delete pendingRequests[cacheKey];
      console.error('Error fetching user data:', error);
      throw error;
    }
  })();
  
  // Store the promise in pendingRequests
  pendingRequests[cacheKey] = requestPromise;
  
  return requestPromise;
}

/**
 * Saves user data to the server with retry logic
 */
export async function saveUserData(params: { mobile: string, data: any }): Promise<any> {
  if (!params.data) {
    throw new Error('No data provided for saving');
  }
  
  // Invalidate cache
  Object.keys(DATA_CACHE).forEach(key => {
    if (key.startsWith(`${params.mobile}_`)) {
      delete DATA_CACHE[key];
    }
  });
  
  // Retry logic
  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt < MAX_RETRIES) {
    try {
      const apiUrl = getApiUrl();
      console.log(`Saving user data to: ${apiUrl} (attempt ${attempt + 1}/${MAX_RETRIES})`);
      
      const response = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: params.mobile,
            action: 'save',
            data: params.data
          })
        },
        REQUEST_TIMEOUT
      );
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error(`Error saving user data (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
      lastError = error;
      attempt++;
      
      if (attempt < MAX_RETRIES) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed to save user data after multiple attempts');
}

// Create a throttled version of saveUserData to prevent too many writes
export const throttledSaveUserData = throttle(saveUserData, 5000);

/**
 * Fetches specific user data type from the server with caching
 */
export async function fetchUserDataByType(params: UserDataParams & { dataType: string }): Promise<any> {
  const cacheKey = createCacheKey({ ...params, action: 'get' });
  
  // Check cache first
  const cachedData = DATA_CACHE[cacheKey];
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    console.log(`Using cached ${params.dataType} data for:`, params.mobile);
    return cachedData.data;
  }
  
  // Check if there's already a pending request for this data
  if (pendingRequests[cacheKey]) {
    console.log(`Using existing request for ${params.dataType}:`, params.mobile);
    return pendingRequests[cacheKey];
  }
  
  // Make the request and store the promise
  const requestPromise = (async () => {
    try {
      const apiUrl = getApiUrl();
      console.log(`Fetching ${params.dataType} data from:`, apiUrl);
      
      const response = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: params.mobile,
            name: params.name,
            action: 'get',
            dataType: params.dataType
          })
        },
        REQUEST_TIMEOUT
      );
      
      // Clear from pending requests
      delete pendingRequests[cacheKey];
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the result
      DATA_CACHE[cacheKey] = {
        data,
        timestamp: Date.now()
      };
      
      return data;
    } catch (error) {
      // Clear from pending requests on error
      delete pendingRequests[cacheKey];
      console.error(`Error fetching ${params.dataType} data:`, error);
      throw error;
    }
  })();
  
  // Store the promise in pendingRequests
  pendingRequests[cacheKey] = requestPromise;
  
  return requestPromise;
}

/**
 * Saves specific user data type to the server with retry logic
 */
export async function saveUserDataByType(params: UserDataParams & { dataType: string }): Promise<any> {
  if (!params.data) {
    throw new Error('No data provided for saving');
  }
  
  // Invalidate relevant cache entries
  const cacheKeyPrefix = `${params.mobile}_${params.dataType}_`;
  Object.keys(DATA_CACHE).forEach(key => {
    if (key.startsWith(cacheKeyPrefix)) {
      delete DATA_CACHE[key];
    }
  });
  
  // Retry logic
  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt < MAX_RETRIES) {
    try {
      const apiUrl = getApiUrl();
      console.log(`Saving ${params.dataType} data to: ${apiUrl} (attempt ${attempt + 1}/${MAX_RETRIES})`);
      
      const response = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: params.mobile,
            name: params.name,
            action: 'save',
            dataType: params.dataType,
            data: params.data
          })
        },
        REQUEST_TIMEOUT
      );
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error(`Error saving ${params.dataType} data (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
      lastError = error;
      attempt++;
      
      if (attempt < MAX_RETRIES) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`Failed to save ${params.dataType} data after multiple attempts`);
}

// Create a throttled version of saveUserDataByType to prevent too many writes
export const throttledSaveUserDataByType = throttle(saveUserDataByType, 5000);

/**
 * Clears all cached data for a specific user
 */
export function clearUserCache(mobile: string): void {
  Object.keys(DATA_CACHE).forEach(key => {
    if (key.startsWith(`${mobile}_`)) {
      delete DATA_CACHE[key];
    }
  });
}

/**
 * Clears all cached data
 */
export function clearAllCache(): void {
  Object.keys(DATA_CACHE).forEach(key => {
    delete DATA_CACHE[key];
  });
}