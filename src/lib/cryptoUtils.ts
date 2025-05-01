import * as crypto from 'crypto';

/**
 * Generates a user-specific hash for encryption
 * @param mobile Mobile number (without country code)
 * @param name User's name
 * @returns A 32-character encryption key
 */
export function getUserHash(mobile: string, name: string): string {
  // Extract numbers only from mobile (without country code)
  const mobileDigits = mobile.replace(/\D/g, '').slice(-10);
  // Use a combination of mobile, name, and a fixed salt for key generation
  const input = `${mobileDigits}${name.toLowerCase().trim()}1994`;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
}

/**
 * Encrypts data with AES-256-CBC using the provided key
 * @param data Data to encrypt
 * @param key Encryption key (32 chars)
 * @returns Encrypted data string (iv:encryptedData)
 */
export function encryptData(data: any, key: string): string {
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

/**
 * Decrypts data using AES-256-CBC and the provided key
 * @param encryptedData Encrypted data string (iv:encryptedData)
 * @param key Decryption key (32 chars)
 * @returns Decrypted data object
 */
export function decryptData(encryptedData: string, key: string): any {
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