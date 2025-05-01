/**
 * Service for interacting with the Netlify serverless function for user data
 */

interface UserDataParams {
  mobile: string;
  name: string;
  data?: any;
}

// API URL that works in both development and production
const getApiUrl = () => {
  // Check if we're in development by looking at the URL
  const isDev = window.location.hostname === 'localhost';
  
  // Use localhost:8888 directly for development if needed
  if (isDev && window.location.port !== '8888') {
    console.log('Using development API URL with port 8888');
    return 'http://localhost:8888/.netlify/functions/userData';
  }
  
  // Default relative path works for both dev (with netlify dev) and production
  return '/.netlify/functions/userData';
};

/**
 * Fetches user data from the server
 * @param params User identity parameters
 * @returns Promise with user data or null if not found
 */
export async function fetchUserData(params: { mobile: string }): Promise<any> {
  try {
    const apiUrl = getApiUrl();
    console.log('Fetching user data from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: params.mobile,
        action: 'get',
      })
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No data found for this user is not an error
        return null;
      }
      throw new Error(`Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

/**
 * Saves user data to the server
 * @param params User identity and data parameters
 * @returns Promise with success status
 */
export async function saveUserData(params: { mobile: string, data: any }): Promise<any> {
  if (!params.data) {
    throw new Error('No data provided for saving');
  }

  try {
    const apiUrl = getApiUrl();
    console.log('Saving user data to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: params.mobile,
        action: 'save',
        data: params.data
      })
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving user data:', error);
    throw error;
  }
}

/**
 * Fetches specific user data type from the server
 * @param params User identity parameters and data type
 * @returns Promise with user data or null if not found
 */
export async function fetchUserDataByType(params: UserDataParams & { dataType: string }): Promise<any> {
  try {
    const apiUrl = getApiUrl();
    console.log('Fetching user data by type from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: params.mobile,
        name: params.name,
        action: 'get',
        dataType: params.dataType
      })
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user data by type:', error);
    throw error;
  }
}

/**
 * Saves specific user data type to the server
 * @param params User identity, data type, and data parameters
 * @returns Promise with success status
 */
export async function saveUserDataByType(params: UserDataParams & { dataType: string }): Promise<any> {
  if (!params.data) {
    throw new Error('No data provided for saving');
  }

  try {
    const apiUrl = getApiUrl();
    console.log('Saving user data by type to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: params.mobile,
        name: params.name,
        action: 'save',
        dataType: params.dataType,
        data: params.data
      })
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving user data by type:', error);
    throw error;
  }
}