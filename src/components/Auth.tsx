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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const userData = localStorage.getItem('registeredUsers');
      const users = userData ? JSON.parse(userData) : {};
      
      if (users[phone]?.password === password) {
        onLogin({ ...users[phone], id: phone });
        setMessage('Login successful!');
      } else {
        setMessage('Invalid phone number or password.');
      }
    } catch (error: any) {
      setMessage(error.message || 'Login failed.');
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
      
      // Proceed with OTP sending (no longer needs phone passed)
      await handleSendOtp();
    } catch (error: any) {
      setMessage(error.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (otp === serverVerifyCode) {
        const tempData = JSON.parse(localStorage.getItem('tempRegistration') || '{}');
        const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        
        // Save the new user
        existingUsers[tempData.phone] = {
          name: tempData.name,
          email: tempData.email,
          password: tempData.password,
          registeredAt: new Date().toISOString()
        };
        
        localStorage.setItem('registeredUsers', JSON.stringify(existingUsers));
        localStorage.removeItem('tempRegistration');
        
        setMessage('Registration successful! Please login.');
        setTimeout(() => setMode('login'), 2000);
      } else {
        setMessage('Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      setMessage(error.message || 'Verification failed.');
    }
    setLoading(false);
  };

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

  return null;
}