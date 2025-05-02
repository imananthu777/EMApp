import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import * as crypto from 'crypto';
import { getStore } from "@netlify/blobs";

// Secret salt for additional security - in production, use environment variables
const HASH_SALT = process.env.HASH_SALT || 'em-app-secure-salt-1994';

// TTL for cached data in seconds (10 minutes)
const CACHE_TTL = 600;

// Cache implementation
type CacheEntry = {
  data: any;
  timestamp: number;
};

const dataCache: Record<string, CacheEntry> = {};

// Function to get user-specific hash for encryption (mobile only)
function getUserHash(mobile: string): string {
  const mobileDigits = mobile.replace(/\D/g, '').slice(-10);
  const input = `${mobileDigits}${HASH_SALT}`;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
}

// Encryption utilities with improved error handling
function encryptData(data: any, key: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

function decryptData(encryptedData: string, key: string): any {
  try {
    const [ivHex, dataHex] = encryptedData.split(':');
    if (!ivHex || !dataHex) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(dataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// In-memory cache for development/testing
let inMemoryDataStore: Record<string, any> = {};

// Netlify Blob Storage helper functions
async function saveToBlobStore(key: string, data: string): Promise<boolean> {
  try {
    const store = getStore({
      name: "emapp-user-data",
      siteID: process.env.SITE_ID || "local-dev-site"
    });
    
    await store.set(key, data);
    return true;
  } catch (error) {
    console.error('Error saving data to Blob Store:', error);
    return false;
  }
}

async function loadFromBlobStore(key: string): Promise<string | null> {
  try {
    const store = getStore({
      name: "emapp-user-data",
      siteID: process.env.SITE_ID || "local-dev-site"
    });
    
    const data = await store.get(key);
    return data ? data.toString() : null;
  } catch (error) {
    console.error('Error reading data from Blob Store:', error);
    return null;
  }
}

// Rate limiting implementation
const rateLimits: Record<string, { count: number, resetTime: number }> = {};

function isRateLimited(clientIP: string, limit = 30): boolean {
  const now = Date.now();
  
  if (!rateLimits[clientIP] || now > rateLimits[clientIP].resetTime) {
    // Reset or initialize rate limit
    rateLimits[clientIP] = {
      count: 1,
      resetTime: now + 60000 // 1 minute window
    };
    return false;
  }
  
  if (rateLimits[clientIP].count >= limit) {
    return true; // Rate limited
  }
  
  // Increment request count
  rateLimits[clientIP].count++;
  return false;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Get client IP for rate limiting
  const clientIP = event.headers['client-ip'] || 
                   event.headers['x-forwarded-for'] || 
                   'unknown-ip';
  
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204, // No content needed for preflight
      headers,
      body: ''
    };
  }

  // Check rate limit
  if (isRateLimited(clientIP)) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Too many requests, please try again later' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { mobile, action, data, dataType, name } = body;

    if (!mobile) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Mobile number is required' })
      };
    }

    // Generate encryption key from user data (mobile only)
    const userKey = getUserHash(mobile);
    
    // Handle user registration and login (default dataType to 'user' if not specified for auth operations)
    const actualDataType = dataType || 'user';
    const userDataKey = `${mobile}:${actualDataType}`;

    // Create a cache key that includes action
    const cacheKey = `${userDataKey}:${action}`;

    if (action === 'save') {
      if (!data) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No data provided for saving' })
        };
      }
      
      // Encrypt user data
      const encryptedData = encryptData(data, userKey);
      
      // Store in memory for fast access
      inMemoryDataStore[userDataKey] = encryptedData;
      
      // Persist to Netlify Blob Storage for durability
      await saveToBlobStore(userDataKey, encryptedData);
      
      // Invalidate cache
      delete dataCache[`${userDataKey}:get`];
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Data saved successfully to Netlify Blob Storage',
          details: {
            user: mobile,
            dataType: actualDataType,
            timestamp: new Date().toISOString()
          }
        })
      };
    } else if (action === 'get') {
      // Check cache first
      const cachedEntry = dataCache[cacheKey];
      if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL * 1000) {
        return {
          statusCode: 200,
          headers: {
            ...headers,
            'X-Cache': 'HIT',
            'Cache-Control': 'max-age=60' // Allow client to cache for 1 minute
          },
          body: JSON.stringify(cachedEntry.data)
        };
      }
      
      // Retrieve user data (first from memory, then from Blob Store)
      let encryptedUserData = inMemoryDataStore[userDataKey];
      
      if (!encryptedUserData) {
        // Try loading from Blob Storage
        encryptedUserData = await loadFromBlobStore(userDataKey);
        
        if (encryptedUserData) {
          // Update memory store
          inMemoryDataStore[userDataKey] = encryptedUserData;
        }
      }
      
      if (!encryptedUserData) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'No data found for this user' })
        };
      }
      
      const decryptedData = decryptData(encryptedUserData, userKey);
      if (!decryptedData) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to decrypt data' })
        };
      }
      
      // Update cache
      dataCache[cacheKey] = {
        data: decryptedData,
        timestamp: Date.now()
      };
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'X-Cache': 'MISS'
        },
        body: JSON.stringify(decryptedData)
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action' })
      };
    }
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error' 
      })
    };
  }
};

export { handler };