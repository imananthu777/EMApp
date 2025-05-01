import { Handler, HandlerEvent } from "@netlify/functions";
import * as fs from 'fs';
import * as path from 'path';
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

// Ensure the data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS for local development
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { mobile, action, data, dataType } = body;

    if (!mobile) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Mobile number is required' })
      };
    }

    // Generate encryption key from user data (mobile only)
    const userKey = getUserHash(mobile);
    
    // File path for the user data
    const dataFilePath = path.join(dataDir, 'userdata.json');
    
    // Initialize or load existing data
    let allUserData: Record<string, any> = {};
    if (fs.existsSync(dataFilePath)) {
      const fileContent = fs.readFileSync(dataFilePath, 'utf8');
      try {
        allUserData = JSON.parse(fileContent);
      } catch (e) {
        console.error('Error parsing data file:', e);
      }
    }

    // Handle user registration and login (default dataType to 'user' if not specified for auth operations)
    const actualDataType = dataType || 'user';

    if (action === 'save') {
      // Encrypt and save user data
      if (!allUserData[mobile]) {
        allUserData[mobile] = {};
      }
      allUserData[mobile][actualDataType] = encryptData(data, userKey);
      fs.writeFileSync(dataFilePath, JSON.stringify(allUserData, null, 2));
      
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Data saved successfully' })
      };
    } else if (action === 'get') {
      // Retrieve and decrypt user data
      const encryptedUserData = allUserData[mobile]?.[actualDataType];
      if (!encryptedUserData) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'No data found for this user' })
        };
      }
      
      const decryptedData = decryptData(encryptedUserData, userKey);
      if (!decryptedData) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to decrypt data' })
        };
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify(decryptedData)
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid action' })
      };
    }
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

export { handler };