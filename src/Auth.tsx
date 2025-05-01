import React, { useState } from 'react';
import { saveUserData } from './lib/userDataService';
import * as crypto from 'crypto';

const Auth = () => {
  const [isRegistration, setIsRegistration] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [resetPasswordForUser, setResetPasswordForUser] = useState<string | null>(null);

  // Function to hash password
  const hashPassword = (password: string) => {
    return crypto.createHash('sha256').update(password).digest('hex');
  };

  // Function to generate random password
  const generateRandomPassword = () => {
    // Generate an 8-character random password with letters and numbers
    return Math.random().toString(36).slice(-8);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Basic validations
    if (!phone || !password || !confirmPassword || !name || !email) {
      setMessage('All fields are required');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setLoading(false);
      return;
    }

    // Send OTP for verification (use dummy OTP for demo)
    
    // Store registration data temporarily
    const registrationData = {
      name,
      email,
      phone,
      password: hashPassword(password), // Hash the password
      registeredAt: new Date().toISOString()
    };
    
    // Store temporarily for OTP verification
    localStorage.setItem('registrationData', JSON.stringify(registrationData));
    
    setIsOtpSent(true);
    setMessage('OTP sent! For testing, use: 123456');
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      console.log('Debug - Login attempt with:', phone);
      console.log('Debug - Password entered:', password);
      console.log('Debug - Password hash:', hashPassword(password));
      
      let userData = null;
      let source = 'server';
      
      // Try server first
      try {
        // Fetch user data from server
        const response = await fetch('/.netlify/functions/userData', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mobile: phone,
            action: 'get',
            dataType: 'user'
          })
        });

        if (response.ok) {
          userData = await response.json();
          console.log('Debug - User data retrieved from server:', JSON.stringify(userData, null, 2));
        } else if (response.status !== 404) {
          console.error('Server error:', response.status);
        }
      } catch (serverError) {
        console.error('Server fetch error:', serverError);
      }
      
      // Fall back to localStorage if server fails
      if (!userData) {
        source = 'local';
        // For development/demo: Check local storage
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        userData = registeredUsers[phone];
        console.log('Debug - User data retrieved from localStorage:', userData ? JSON.stringify(userData, null, 2) : 'No data found');
        
        if (!userData) {
          setMessage('User not found. Please register first.');
          setLoading(false);
          return;
        }
      }

      console.log('Debug - Stored password hash:', userData.password);
      console.log('Debug - Hash comparison:', userData.password === hashPassword(password));
      
      // Check if password matches
      if (userData.password === hashPassword(password)) {
        // Create a session for the authenticated user
        const user = {
          id: phone,
          phone: phone,
          name: userData.name,
          email: userData.email
        };
        
        // Store the authenticated user data
        localStorage.setItem('authenticatedUser', JSON.stringify(user));
        
        // Trigger authentication state change
        window.dispatchEvent(new Event('auth-state-changed'));
        
        setMessage(`Login successful! (using ${source} data)`);
        
        // If we found data in localStorage, try to sync it to server for next time
        if (source === 'local') {
          try {
            await saveUserData({
              mobile: phone,
              data: { ...userData, lastLogin: new Date().toISOString() }
            });
            console.log('Debug - Local user data synced to server');
          } catch (syncError) {
            console.error('Failed to sync local data to server:', syncError);
          }
        }
      } else {
        setMessage('Invalid phone number or password.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setMessage(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      // For demo, use hardcoded OTP
      const expectedOtp = "123456";
      
      if (otp === expectedOtp) {
        // Get registration data from localStorage
        const registrationData = JSON.parse(localStorage.getItem('registrationData') || '{}');
        
        if (!registrationData.phone) {
          throw new Error('Registration data not found');
        }
        
        // Save user data to server
        await saveUserData({
          mobile: registrationData.phone,
          data: registrationData
        });
        
        setMessage('Registration successful! You can now login.');
        
        // Clear registration data from localStorage
        localStorage.removeItem('registrationData');
        setIsOtpSent(false);
        setIsRegistration(false);
        
        // Reset form
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setOtp('');
      } else {
        setMessage('Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      setMessage(error.message || 'An error occurred during verification.');
    }
    
    setLoading(false);
  };

  // Handle forgot password with fallback
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setResetPasswordForUser(null);

    try {
      if (!phone) {
        setMessage('Please enter your mobile number');
        setLoading(false);
        return;
      }

      // Generate new random password
      const randomPass = generateRandomPassword();
      console.log('Debug - Generated password:', randomPass);
      
      let userData = null;
      
      // Try to get user data from server first
      try {
        // Check if user exists on server
        const response = await fetch('/.netlify/functions/userData', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mobile: phone,
            action: 'get',
            dataType: 'user'
          })
        });

        if (response.ok) {
          userData = await response.json();
        } else if (response.status !== 404) {
          console.error('Server error:', response.status);
        }
      } catch (serverError) {
        console.error('Server fetch error:', serverError);
      }
      
      // If no server data, try localStorage as fallback
      if (!userData) {
        // For development/demo: Check local storage
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        if (!registeredUsers[phone]) {
          setMessage('No user found with this mobile number');
          setLoading(false);
          return;
        }
        userData = registeredUsers[phone];
      }
      
      // Update password
      userData.password = hashPassword(randomPass);
      userData.passwordResetAt = new Date().toISOString();
      
      // Try to save to server
      let serverSaveSuccess = false;
      try {
        await saveUserData({
          mobile: phone,
          data: userData
        });
        serverSaveSuccess = true;
      } catch (serverSaveError) {
        console.error('Server password reset error:', serverSaveError);
      }
      
      // If server save failed, update localStorage as fallback
      if (!serverSaveSuccess) {
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        registeredUsers[phone] = userData;
        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
      }
      
      // Display new password to user
      setResetPasswordForUser(randomPass);
      setMessage(serverSaveSuccess 
        ? 'Your password has been reset. Please use the new password to login.' 
        : 'Your password has been reset locally. Please use the new password to login. Note: This change may not sync across devices.');
      
    } catch (error: any) {
      console.error('Password reset error:', error);
      setMessage(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Switch back to login from forgot password
  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setMessage('');
    setResetPasswordForUser(null);
  };

  if (isOtpSent) {
    return (
      <div className="auth-container">
        <h2>Verify OTP</h2>
        <form onSubmit={handleVerifyOtp}>
          <div className="form-group">
            <label>Enter OTP sent to your phone</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit OTP"
              maxLength={6}
            />
          </div>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
        {message && <p className="message">{message}</p>}
        <p className="toggle-text">
          <button onClick={() => setIsOtpSent(false)} className="link-btn">
            Back
          </button>
        </p>
      </div>
    );
  }

  if (isForgotPassword) {
    return (
      <div className="auth-container">
        <h2>Forgot Password</h2>
        <form onSubmit={handleForgotPassword}>
          <div className="form-group">
            <label>Mobile Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your registered mobile number"
            />
          </div>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>
        {resetPasswordForUser && (
          <div className="password-reset-box">
            <p>Your new password:</p>
            <p className="new-password">{resetPasswordForUser}</p>
            <p>Please save this password. You'll need it to login.</p>
          </div>
        )}
        {message && <p className="message">{message}</p>}
        <p className="toggle-text">
          <button onClick={handleBackToLogin} className="link-btn">
            Back to Login
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <h2>{isRegistration ? 'Register' : 'Login'}</h2>
      <form onSubmit={isRegistration ? handleRegister : handleLogin}>
        <div className="form-group">
          <label>Mobile Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile number"
          />
        </div>
        
        {isRegistration && (
          <>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
              />
            </div>
          </>
        )}
        
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </div>
        
        {isRegistration && (
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
            />
          </div>
        )}
        
        <button type="submit" disabled={loading} className="submit-btn">
          {loading 
            ? (isRegistration ? 'Registering...' : 'Logging in...') 
            : (isRegistration ? 'Register' : 'Login')}
        </button>
        
        {!isRegistration && (
          <div className="forgot-password">
            <button 
              type="button" 
              onClick={() => setIsForgotPassword(true)} 
              className="forgot-btn"
            >
              Forgot Password?
            </button>
          </div>
        )}
      </form>
      
      {message && <p className="message">{message}</p>}
      
      <p className="toggle-text">
        {isRegistration 
          ? 'Already have an account? ' 
          : 'Don\'t have an account? '}
        <button 
          onClick={() => setIsRegistration(!isRegistration)} 
          className="link-btn"
        >
          {isRegistration ? 'Login' : 'Register'}
        </button>
      </p>
    </div>
  );
};

export default Auth;