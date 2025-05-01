import { Handler, HandlerEvent } from "@netlify/functions";
import * as crypto from 'crypto';

// Function to get user-specific hash for encryption (mobile only)
function getUserHash(mobile: string): string {
  const mobileDigits = mobile.replace(/\D/g, '').slice(-10);
  const input = `${mobileDigits}1994`;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
}

// Encryption utilities
function encryptData(data: any, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptData(encryptedData: string, key: string): any {
  try {
    const [ivHex, dataHex] = encryptedData.split(':');
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

// In-memory cache for development/testing - not persisted between function invocations
let inMemoryDataStore: Record<string, any> = {};

const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
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
      
      // Store in memory (for development) - in production this isn't persisted between function calls
      inMemoryDataStore[userDataKey] = encryptedData;
      
      // For production, consider using Netlify's Edge Functions with KV store
      // or integrate with a database service like Supabase, Firebase, etc.
      
      // Log that data was saved (for debugging)
      console.log(`Data saved for ${mobile}, type: ${actualDataType}`);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Data saved successfully',
          details: {
            user: mobile,
            dataType: actualDataType,
            timestamp: new Date().toISOString()
          }
        })
      };
    } else if (action === 'get') {
      // Retrieve user data
      const encryptedUserData = inMemoryDataStore[userDataKey];
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
      
      return {
        statusCode: 200,
        headers,
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
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error' 
      })
    };
  }
};

export { handler };