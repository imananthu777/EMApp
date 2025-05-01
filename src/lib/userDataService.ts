/**
 * Service for interacting with the Netlify serverless function for user data
 */

interface UserDataParams {
  mobile: string;
  name: string;
  data?: any;
}

/**
 * Fetches user data from the server
 * @param params User identity parameters
 * @returns Promise with user data or null if not found
 */
export async function fetchUserData(params: UserDataParams): Promise<any> {
  try {
    const response = await fetch('/.netlify/functions/userData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: params.mobile,
        name: params.name,
        action: 'get'
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
export async function saveUserData(params: UserDataParams): Promise<any> {
  if (!params.data) {
    throw new Error('No data provided for saving');
  }

  try {
    const response = await fetch('/.netlify/functions/userData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: params.mobile,
        name: params.name,
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