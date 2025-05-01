import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Fade,
  Paper,
  Stack,
  Slide,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { fetchUserData, saveUserData } from '../lib/userDataService';

const CenteredPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: 400,
  width: '100%',
  borderRadius: theme.spacing(3),
  boxShadow: theme.shadows[4],
}));

interface AuthProps {
  onLogin: (userData: any) => void;
}

// Form validation utility
const validateForm = (formData: Record<string, string>, formType: string): string | null => {
  // Basic validation
  if (formType === 'register') {
    const { name, phone, email, password, confirmPassword } = formData;
    
    if (!name || !phone || !email || !password || !confirmPassword) {
      return 'Please fill in all fields';
    }

    // Phone validation
    if (!phone.startsWith('+')) {
      return 'Please enter mobile number with country code (e.g. +91)';
    }

    const phoneRegex = /^\+[1-9]\d{10,14}$/;
    if (!phoneRegex.test(phone)) {
      return 'Invalid phone number format. Please enter a valid international number.';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }

    // Password validation
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
    }
  } else if (formType === 'login') {
    const { phone, password } = formData;
    if (!phone || !password) {
      return 'Please enter both phone and password';
    }
  }
  
  return null;
};

// Constants
const CACHE_EXPIRE_TIME = 1000 * 60 * 30; // 30 minutes
const OTP_TIMEOUT = 300; // 5 minutes

export default function Auth({ onLogin }: AuthProps) {
  const [mode, setMode] = useState<'greeting' | 'login' | 'register' | 'otp' | 'forgot-password'>('greeting');
  const [loading, setLoading] = useState(false);
  
  // Form state - grouped in a single object for easier handling
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
    confirmPassword: '',
    otp: '',
    name: '',
    email: '',
    newUserPassword: '',
    newUserPassword2: '',
  });
  
  // Other state
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimeout, setOtpTimeout] = useState(false);
  const [serverVerifyCode, setServerVerifyCode] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [resetPasswordForUser, setResetPasswordForUser] = useState<string | null>(null);
  
  // Memoized cache for user data
  const [userDataCache, setUserDataCache] = useState<{
    data: any;
    timestamp: number;
    mobile: string;
  } | null>(null);

  // Handle form input changes with a single handler
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  // Format timer function
  const formatTimer = useMemo(() => {
    return (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  }, []);

  // OTP timer effect
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (mode === 'otp' && otpSent && !otpTimeout) {
      setTimer(OTP_TIMEOUT);
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setOtpTimeout(true);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [mode, otpSent]);

  // Load last used phone on mount for login
  React.useEffect(() => {
    if (mode === 'login') {
      const lastPhone = localStorage.getItem('lastLoginPhone');
      if (lastPhone) {
        setFormData(prev => ({ ...prev, phone: lastPhone }));
      }
    }
  }, [mode]);

  // Optimized server data fetching with caching
  const fetchUserDataWithCache = useCallback(async (mobile: string) => {
    // Check if we have valid cached data
    if (
      userDataCache && 
      userDataCache.mobile === mobile && 
      (Date.now() - userDataCache.timestamp < CACHE_EXPIRE_TIME)
    ) {
      console.log("Using cached user data");
      return userDataCache.data;
    }
    
    console.log("Fetching fresh user data");
    try {
      const data = await fetchUserData({ mobile });
      // Cache the result
      setUserDataCache({
        data,
        timestamp: Date.now(),
        mobile
      });
      return data;
    } catch (err) {
      console.error("Error fetching user data:", err);
      throw err;
    }
  }, [userDataCache]);

  // Send OTP - optimized with better error handling
  const handleSendOtp = useCallback(async () => {
    setLoading(true);
    setMessage('');
    
    try {
      // In a real app, this would call a server API
      // Using dummy OTP for testing
      const dummyOtp = "123456";
      setServerVerifyCode(dummyOtp);
      setOtpSent(true);
      setOtpTimeout(false);
      setMode('otp');
      setMessage('OTP sent! (For testing, use: 123456)');
    } catch (error: any) {
      setMessage(error.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Optimized login handler with better error handling and caching
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationError = validateForm(formData, 'login');
    if (validationError) {
      setMessage(validationError);
      return;
    }
    
    setLoading(true);
    setMessage("");
    
    try {
      // Clear any cached data if phone number changed
      if (userDataCache && userDataCache.mobile !== formData.phone) {
        setUserDataCache(null);
      }
      
      console.log("Login attempt starting for:", formData.phone);
      
      // Fetch user data with caching
      let serverData = null;
      try {
        serverData = await fetchUserDataWithCache(formData.phone);
        console.log("Server response received:", serverData ? "Data found" : "No data");
      } catch (err: any) {
        console.error("Server fetch error:", err);
        setMessage(`Server connection error: ${err.message || "Unknown error"}. Checking local data...`);
        
        // Try localStorage as fallback
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        if (users[formData.phone]) {
          console.log("User found in localStorage");
          serverData = users[formData.phone];
        } else {
          setMessage("No account found with this phone number. Please register first.");
          setLoading(false);
          return;
        }
      }
      
      if (!serverData) {
        console.log("No user data found, checking localStorage fallback");
        // Fallback to localStorage if server data not found
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        if (users[formData.phone]) {
          console.log("User found in localStorage");
          serverData = users[formData.phone];
        } else {
          console.log("User not found in localStorage either");
          setMessage("No account found with this phone number. Please register first.");
          setLoading(false);
          return;
        }
      }
      
      if (serverData && serverData.password === formData.password) {
        // Save the last login phone for convenience
        localStorage.setItem('lastLoginPhone', formData.phone);
        
        if (serverData.mustChangePassword) {
          setMustChangePassword(true);
          setPendingUser({ ...serverData, id: formData.phone });
        } else {
          onLogin({ ...serverData, id: formData.phone });
          setMessage("Login successful!");
        }
      } else {
        setMessage("Invalid phone number or password.");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setMessage(`Login error: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [formData, onLogin, fetchUserDataWithCache, userDataCache]);

  // Optimized register handler
  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationError = validateForm(formData, 'register');
    if (validationError) {
      setMessage(validationError);
      return;
    }
    
    setLoading(true);
    setMessage('');

    try {
      // Check if user already exists
      const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
      if (existingUsers[formData.phone]) {
        setMessage('This phone number is already registered. Please login or use a different number.');
        setLoading(false);
        return;
      }

      // Check if email is already used
      const isEmailUsed = Object.values(existingUsers).some((user: any) => user.email === formData.email);
      if (isEmailUsed) {
        setMessage('This email is already registered. Please use a different email.');
        setLoading(false);
        return;
      }

      // Store registration data
      localStorage.setItem('tempRegistration', JSON.stringify({ 
        name: formData.name, 
        phone: formData.phone, 
        email: formData.email, 
        password: formData.password,
        registrationAttemptTime: new Date().toISOString()
      }));
      
      // Set onboarding flag
      localStorage.setItem(`showOnboardingForUser_${formData.phone}`, 'true');
      
      // Send OTP
      await handleSendOtp();
    } catch (error: any) {
      setMessage(error.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  }, [formData, handleSendOtp]);

  // Verify OTP handler - optimized with better error handling
  const handleVerifyOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    try {
      if (formData.otp === serverVerifyCode) {
        const tempData = JSON.parse(localStorage.getItem('tempRegistration') || '{}');
        const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        
        // Create user data
        const userData = {
          name: tempData.name,
          email: tempData.email,
          password: tempData.password,
          registeredAt: new Date().toISOString()
        };
        
        // Save to localStorage
        existingUsers[tempData.phone] = userData;
        localStorage.setItem('registeredUsers', JSON.stringify(existingUsers));
        localStorage.removeItem('tempRegistration');
        
        // Save to server with retry logic
        let serverSaveSuccess = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!serverSaveSuccess && retryCount < maxRetries) {
          try {
            await saveUserData({
              mobile: tempData.phone,
              data: userData
            });
            serverSaveSuccess = true;
          } catch (serverError) {
            console.error(`Server save error (attempt ${retryCount + 1}):`, serverError);
            retryCount++;
            
            if (retryCount >= maxRetries) {
              setMessage('Registration successful, but cloud sync failed. Please login.');
              break;
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (serverSaveSuccess) {
          setMessage('Registration successful! Please login.');
        }
        
        // Clear form data
        setFormData({
          phone: '',
          password: '',
          confirmPassword: '',
          otp: '',
          name: '',
          email: '',
          newUserPassword: '',
          newUserPassword2: '',
        });
        
        setTimeout(() => setMode('login'), 2000);
      } else {
        setMessage('Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      setMessage(error.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }, [formData.otp, serverVerifyCode]);

  // Forgot password handler (user)
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      // Generate a random password and set it for the user
      const randomPass = Math.random().toString(36).slice(-8);
      const users = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
      
      if (!users[formData.phone]) {
        setMessage('No user found with this phone number.');
        setLoading(false);
        return;
      }
      
      // Update user data locally
      users[formData.phone].password = randomPass;
      users[formData.phone].mustChangePassword = true;
      localStorage.setItem('registeredUsers', JSON.stringify(users));
      
      // Update on server
      try {
        // First fetch any existing server data
        const serverData = await fetchUserData({
          mobile: formData.phone,
        }).catch(() => null);
        
        // Then save updated data
        await saveUserData({
          mobile: formData.phone,
          data: { 
            ...(serverData || users[formData.phone]),
            password: randomPass,
            mustChangePassword: true,
            passwordResetAt: new Date().toISOString()
          }
        });
        
        setResetPasswordForUser(randomPass);
        setMessage('Your password has been reset on all devices. Use the password below to login. You will be asked to change it after login.');
      } catch (serverError) {
        console.error('Server password reset error:', serverError);
        setResetPasswordForUser(randomPass);
        setMessage('Your password has been reset. Use the password below to login. You will be asked to change it after login. (Note: Changes may not sync to other devices)');
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to reset password.');
    }
    setLoading(false);
  };

  // Handle forced password change after admin reset
  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');
    
    if (!formData.newUserPassword || !formData.newUserPassword2) {
      setChangePasswordError('Please enter and confirm your new password.');
      return;
    }
    if (formData.newUserPassword !== formData.newUserPassword2) {
      setChangePasswordError('Passwords do not match.');
      return;
    }
    if (formData.newUserPassword.length < 8) {
      setChangePasswordError('Password must be at least 8 characters long.');
      return;
    }
    
    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(formData.newUserPassword)) {
      setChangePasswordError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      return;
    }
    
    setLoading(true);
    
    try {
      // Update user password and clear mustChangePassword
      const users = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
      users[pendingUser.id].password = formData.newUserPassword;
      delete users[pendingUser.id].mustChangePassword;
      localStorage.setItem('registeredUsers', JSON.stringify(users));
      
      // Update on server
      try {
        // Get latest server data first
        const serverData = await fetchUserData({
          mobile: pendingUser.id,
        }).catch(() => null);
        
        // Update with new password
        await saveUserData({
          mobile: pendingUser.id,
          data: {
            ...(serverData || users[pendingUser.id]),
            password: formData.newUserPassword,
            mustChangePassword: undefined,
            passwordChangedAt: new Date().toISOString()
          }
        });
      } catch (serverError) {
        console.error('Server password change error:', serverError);
        // Continue with local update even if server fails
      }
      
      setMustChangePassword(false);
      setPendingUser(null);
      setFormData(prev => ({
        ...prev,
        newUserPassword: '',
        newUserPassword2: '',
      }));
      setChangePasswordError('');
      onLogin({ ...users[pendingUser.id], id: pendingUser.id });
    } catch (error) {
      setChangePasswordError('Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (mustChangePassword && pendingUser) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" width="100vw" height="100vh">
        <CenteredPaper>
          <form onSubmit={handleForcePasswordChange}>
            <Stack spacing={3}>
              <Typography variant="h6" fontWeight={700} textAlign="center">
                Change Your Password
              </Typography>
              <TextField
                label="New Password"
                type="password"
                name="newUserPassword"
                value={formData.newUserPassword}
                onChange={handleInputChange}
                fullWidth
                required
              />
              <TextField
                label="Confirm New Password"
                type="password"
                name="newUserPassword2"
                value={formData.newUserPassword2}
                onChange={handleInputChange}
                fullWidth
                required
              />
              {changePasswordError && (
                <Typography color="error" textAlign="center">{changePasswordError}</Typography>
              )}
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{ borderRadius: 3, fontWeight: 600 }}
              >
                Change Password & Login
              </Button>
            </Stack>
          </form>
        </CenteredPaper>
      </Box>
    );
  }

  if (mode === 'greeting') {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" width="100vw" height="100vh">
        <CenteredPaper>
          <Stack spacing={3} alignItems="center">
            <Typography variant="h5" fontWeight={700} textAlign="center">
              Welcome to Expense Manager!
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<LoginIcon />}
              fullWidth
              onClick={() => setMode('login')}
              sx={{ borderRadius: 3, fontWeight: 600 }}
            >
              Login
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<PersonAddIcon />}
              fullWidth
              onClick={() => setMode('register')}
              sx={{ borderRadius: 3, fontWeight: 600 }}
            >
              Register
            </Button>
          </Stack>
        </CenteredPaper>
      </Box>
    );
  }

  if (mode === 'login') {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" width="100vw" height="100vh">
        <Slide direction="left" in={mode === 'login'} mountOnEnter unmountOnExit>
          <CenteredPaper>
            <form onSubmit={handleLogin}>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700} textAlign="center">
                  Login
                </Typography>
                <TextField
                  label="Mobile Number"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  inputProps={{ maxLength: 15 }}
                  autoFocus
                />
                <TextField
                  label="Password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={loading}
                  sx={{ borderRadius: 3, fontWeight: 600 }}
                  endIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
                <Stack direction="row" justifyContent="space-between" width="100%">
                  <Button
                    variant="text"
                    color="primary"
                    onClick={() => setMode('greeting')}
                    sx={{ borderRadius: 3 }}
                  >
                    Back
                  </Button>
                  <Button
                    variant="text"
                    color="primary"
                    onClick={() => setMode('forgot-password')}
                    sx={{ borderRadius: 3 }}
                  >
                    Forgot Password?
                  </Button>
                </Stack>
              </Stack>
              {message && (
                <Typography mt={2} textAlign="center" color="error">
                  {message}
                </Typography>
              )}
            </form>
          </CenteredPaper>
        </Slide>
      </Box>
    );
  }

  if (mode === 'register') {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" width="100vw" height="100vh">
        <Slide direction="right" in={mode === 'register'} mountOnEnter unmountOnExit>
          <CenteredPaper>
            <form onSubmit={handleRegister}>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700} textAlign="center">
                  Register
                </Typography>
                <TextField
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  autoFocus
                />
                <TextField
                  label="Mobile Number"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  inputProps={{ maxLength: 15 }}
                />
                <TextField
                  label="Email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                <TextField
                  label="Password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                <TextField
                  label="Confirm Password"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={loading}
                  sx={{ borderRadius: 3, fontWeight: 600 }}
                  endIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {loading ? 'Sending OTP...' : 'Register'}
                </Button>
                <Button
                  variant="text"
                  color="primary"
                  fullWidth
                  onClick={() => setMode('greeting')}
                  sx={{ borderRadius: 3 }}
                >
                  Back
                </Button>
              </Stack>
              {message && (
                <Typography mt={2} textAlign="center" color="error">
                  {message}
                </Typography>
              )}
            </form>
          </CenteredPaper>
        </Slide>
      </Box>
    );
  }

  if (mode === 'otp') {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" width="100vw" height="100vh">
        <Fade in={mode === 'otp'}>
          <CenteredPaper>
            <form onSubmit={handleVerifyOtp}>
              <Stack spacing={3} alignItems="center">
                <Typography variant="h6" fontWeight={700} textAlign="center">
                  Enter OTP
                </Typography>
                <TextField
                  label="6-digit OTP"
                  name="otp"
                  value={formData.otp}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
                  autoFocus
                  disabled={otpTimeout}
                />
                <Typography variant="body2" color="text.secondary">
                  Sent to: <b>{formData.phone}</b>
                </Typography>
                <Typography variant="caption" color={otpTimeout ? 'error' : 'primary'}>
                  {otpTimeout ? 'OTP expired. Please resend.' : `Expires in: ${formatTimer(timer)}`}
                </Typography>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={loading || otpTimeout || formData.otp.length !== 6}
                  sx={{ borderRadius: 3, fontWeight: 600 }}
                  endIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  fullWidth
                  onClick={handleSendOtp}
                  disabled={loading || !otpTimeout}
                  sx={{ borderRadius: 3 }}
                >
                  Resend OTP
                </Button>
                <Button
                  variant="text"
                  color="primary"
                  fullWidth
                  onClick={() => setMode('register')}
                  sx={{ borderRadius: 3 }}
                >
                  Back
                </Button>
              </Stack>
              {message && (
                <Typography mt={2} textAlign="center" color="primary.main">
                  {message}
                </Typography>
              )}
            </form>
          </CenteredPaper>
        </Fade>
      </Box>
    );
  }

  if (mode === 'forgot-password') {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" width="100vw" height="100vh">
        <CenteredPaper>
          <form onSubmit={handleForgotPassword}>
            <Stack spacing={3}>
              <Typography variant="h6" fontWeight={700} textAlign="center">
                Forgot Password
              </Typography>
              <TextField
                label="Mobile Number"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                fullWidth
                required
                inputProps={{ maxLength: 15 }}
                autoFocus
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                sx={{ borderRadius: 3, fontWeight: 600 }}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
              {resetPasswordForUser && (
                <Typography mt={2} textAlign="center" color="success.main">
                  Your new password: <b>{resetPasswordForUser}</b>
                </Typography>
              )}
              {message && (
                <Typography mt={2} textAlign="center" color="primary.main">
                  {message}
                </Typography>
              )}
              <Button
                variant="text"
                color="primary"
                fullWidth
                onClick={() => setMode('login')}
                sx={{ borderRadius: 3 }}
              >
                Back to Login
              </Button>
            </Stack>
          </form>
        </CenteredPaper>
      </Box>
    );
  }

  return null;
}