import React, { useState } from 'react';
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

export default function Auth({ onLogin }: AuthProps) {
  const [mode, setMode] = useState<'greeting' | 'login' | 'register' | 'otp' | 'forgot-password'>('greeting');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimeout, setOtpTimeout] = useState(false);
  const [serverVerifyCode, setServerVerifyCode] = useState('');
  const OTP_TIMEOUT = 300;
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPassword2, setNewUserPassword2] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);
  // State for showing reset password to user
  const [resetPasswordForUser, setResetPasswordForUser] = useState<string | null>(null);

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
    // eslint-disable-next-line
  }, [mode, otpSent]);

  // On mount, set default phone for login
  React.useEffect(() => {
    if (mode === 'login') {
      const lastPhone = localStorage.getItem('lastLoginPhone');
      setPhone(lastPhone || '+91');
    }
  }, [mode]);

  const formatTimer = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  // Removed unused targetPhone parameter
  const handleSendOtp = async () => {
    setLoading(true);
    setMessage('');
    try {
      // Using dummy OTP for testing
      const dummyOtp = "123456";
      setServerVerifyCode(dummyOtp);
      setOtpSent(true);
      setOtpTimeout(false);
      setMode('otp');
      setMessage('OTP sent! (For testing, use: 123456)');
    } catch (error: any) {
      setMessage(error.message || 'Network error.');
    }
    setLoading(false);
  };

  // Handle login with server-side user data ONLY (no localStorage)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      // Always fetch user from server using mobile number
      let serverData = null;
      try {
        serverData = await fetchUserData({ mobile: phone });
      } catch (err) {
        setMessage("Server error. Please try again later.");
        setLoading(false);
        return;
      }
      if (serverData && serverData.password === password) {
        if (serverData.mustChangePassword) {
          setMustChangePassword(true);
          setPendingUser({ ...serverData, id: phone });
        } else {
          onLogin({ ...serverData, id: phone });
          setMessage("Login successful!");
        }
      } else {
        setMessage("Invalid phone number or password.");
      }
    } catch (error: any) {
      setMessage(error.message || "Login failed.");
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Basic validation
      if (!name || !phone || !email || !password || !confirmPassword) {
        setMessage('Please fill in all fields');
        setLoading(false);
        return;
      }

      // Phone number validation
      if (!phone.startsWith('+')) {
        setMessage('Please enter mobile number with country code (e.g. +91)');
        setLoading(false);
        return;
      }

      // Check if phone number is valid format
      const phoneRegex = /^\+[1-9]\d{10,14}$/;
      if (!phoneRegex.test(phone)) {
        setMessage('Invalid phone number format. Please enter a valid international number.');
        setLoading(false);
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setMessage('Please enter a valid email address');
        setLoading(false);
        return;
      }

      // Password validation
      if (password !== confirmPassword) {
        setMessage('Passwords do not match');
        setLoading(false);
        return;
      }

      if (password.length < 8) {
        setMessage('Password must be at least 8 characters long');
        setLoading(false);
        return;
      }

      // Password strength validation
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(password)) {
        setMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
        setLoading(false);
        return;
      }

      // Check if user already exists
      const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
      if (existingUsers[phone]) {
        setMessage('This phone number is already registered. Please login or use a different number.');
        setLoading(false);
        return;
      }

      // Check if email is already used
      const isEmailUsed = Object.values(existingUsers).some((user: any) => user.email === email);
      if (isEmailUsed) {
        setMessage('This email is already registered. Please use a different email.');
        setLoading(false);
        return;
      }

      // If all validations pass, store registration data and proceed with OTP
      localStorage.setItem('tempRegistration', JSON.stringify({ 
        name, 
        phone, 
        email, 
        password,
        registrationAttemptTime: new Date().toISOString()
      }));
      // Set onboarding flag for this user
      localStorage.setItem(`showOnboardingForUser_${phone}`, 'true');
      // Proceed with OTP sending (no longer needs phone passed)
      await handleSendOtp();
    } catch (error: any) {
      setMessage(error.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  // Handle registration with server-side data
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (otp === serverVerifyCode) {
        const tempData = JSON.parse(localStorage.getItem('tempRegistration') || '{}');
        const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        // Create user data
        const userData = {
          name: tempData.name,
          email: tempData.email,
          password: tempData.password,
          registeredAt: new Date().toISOString()
        };
        // Save locally
        existingUsers[tempData.phone] = userData;
        localStorage.setItem('registeredUsers', JSON.stringify(existingUsers));
        localStorage.removeItem('tempRegistration');
        // Save to server (mobile only)
        try {
          await saveUserData({
            mobile: tempData.phone,
            data: userData
          });
          setMessage('Registration successful! Please login.');
        } catch (serverError) {
          console.error('Server save error:', serverError);
          setMessage('Registration successful, but cloud sync failed. Please login.');
        }
        setTimeout(() => setMode('login'), 2000);
      } else {
        setMessage('Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      setMessage(error.message || 'Verification failed.');
    }
    setLoading(false);
  };

  // Forgot password handler (user)
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      // Generate a random password and set it for the user
      const randomPass = Math.random().toString(36).slice(-8);
      const users = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
      
      if (!users[phone]) {
        setMessage('No user found with this phone number.');
        setLoading(false);
        return;
      }
      
      // Update user data locally
      users[phone].password = randomPass;
      users[phone].mustChangePassword = true;
      localStorage.setItem('registeredUsers', JSON.stringify(users));
      
      // Update on server
      try {
        // First fetch any existing server data
        const serverData = await fetchUserData({
          mobile: phone,
        }).catch(() => null);
        
        // Then save updated data
        await saveUserData({
          mobile: phone,
          data: { 
            ...(serverData || users[phone]),
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
    
    if (!newUserPassword || !newUserPassword2) {
      setChangePasswordError('Please enter and confirm your new password.');
      return;
    }
    if (newUserPassword !== newUserPassword2) {
      setChangePasswordError('Passwords do not match.');
      return;
    }
    if (newUserPassword.length < 8) {
      setChangePasswordError('Password must be at least 8 characters long.');
      return;
    }
    
    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newUserPassword)) {
      setChangePasswordError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      return;
    }
    
    setLoading(true);
    
    try {
      // Update user password and clear mustChangePassword
      const users = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
      users[pendingUser.id].password = newUserPassword;
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
            password: newUserPassword,
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
      setNewUserPassword('');
      setNewUserPassword2('');
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
                value={newUserPassword}
                onChange={e => setNewUserPassword(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Confirm New Password"
                type="password"
                value={newUserPassword2}
                onChange={e => setNewUserPassword2(e.target.value)}
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
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  fullWidth
                  required
                  inputProps={{ maxLength: 15 }}
                  autoFocus
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
                  value={name}
                  onChange={e => setName(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                />
                <TextField
                  label="Mobile Number"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  fullWidth
                  required
                  inputProps={{ maxLength: 15 }}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
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
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  fullWidth
                  required
                  inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
                  autoFocus
                  disabled={otpTimeout}
                />
                <Typography variant="body2" color="text.secondary">
                  Sent to: <b>{phone}</b>
                </Typography>
                <Typography variant="caption" color={otpTimeout ? 'error' : 'primary'}>
                  {otpTimeout ? 'OTP expired. Please resend.' : `Expires in: ${formatTimer(timer)}`}
                </Typography>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={loading || otpTimeout || otp.length !== 6}
                  sx={{ borderRadius: 3, fontWeight: 600 }}
                  endIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  fullWidth
                  onClick={() => handleSendOtp()} // Call without phone
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
                value={phone}
                onChange={e => setPhone(e.target.value)}
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