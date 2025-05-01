import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Stack, TextField, Paper } from '@mui/material';

function generateRandomPassword() {
  return Math.random().toString(36).slice(-8);
}

export default function AdminDashboard() {
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [resetTokens, setResetTokens] = useState<any>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const allUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    setUsers(Object.keys(allUsers).map(id => ({ id, ...allUsers[id] })));
    setResetTokens(JSON.parse(localStorage.getItem('resetTokens') || '{}'));
  }, []);

  const handleResetPassword = (userId: string) => {
    if (!resetTokens[userId]) {
      setMessage('No reset token found for this user.');
      return;
    }
    const randomPass = generateRandomPassword();
    const allUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    allUsers[userId].password = randomPass;
    allUsers[userId].mustChangePassword = true;
    localStorage.setItem('registeredUsers', JSON.stringify(allUsers));
    setNewPassword(randomPass);
    setMessage(`Password reset for ${userId}. New password: ${randomPass}`);
    // Remove reset token after reset
    const tokens = { ...resetTokens };
    delete tokens[userId];
    localStorage.setItem('resetTokens', JSON.stringify(tokens));
    setResetTokens(tokens);
  };

  // Admin login handler
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    // For demo, hardcode admin credentials
    if (adminUsername === 'admin' && adminPassword === 'admin123') {
      setIsLoggedIn(true);
    } else {
      setLoginError('Invalid admin credentials');
    }
  };

  if (!isLoggedIn) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" width="100vw" height="100vh">
        <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
          <form onSubmit={handleAdminLogin}>
            <Stack spacing={3}>
              <Typography variant="h6" fontWeight={700} textAlign="center">
                Admin Login
              </Typography>
              <TextField
                label="Admin Username"
                value={adminUsername}
                onChange={e => setAdminUsername(e.target.value)}
                fullWidth
                required
                autoFocus
              />
              <TextField
                label="Admin Password"
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                fullWidth
                required
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{ borderRadius: 3, fontWeight: 600 }}
              >
                Login as Admin
              </Button>
              {loginError && (
                <Typography mt={2} textAlign="center" color="error">
                  {loginError}
                </Typography>
              )}
            </Stack>
          </form>
        </Paper>
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h5" fontWeight={700} mb={2}>Admin User Management</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Users with Password Reset Requests</Typography>
        <Stack spacing={2} mt={2}>
          {Object.keys(resetTokens).length === 0 && <Typography>No users have requested a password reset.</Typography>}
          {Object.keys(resetTokens).map(userId => (
            <Stack key={userId} direction="row" spacing={2} alignItems="center">
              <Typography>{userId}</Typography>
              <Button variant="contained" color="primary" onClick={() => handleResetPassword(userId)}>
                Reset Password
              </Button>
            </Stack>
          ))}
        </Stack>
        {newPassword && (
          <Typography color="success.main" mt={2}>
            New password for user: <b>{newPassword}</b>
          </Typography>
        )}
        {message && (
          <Typography color="primary.main" mt={2}>{message}</Typography>
        )}
      </Paper>
    </Box>
  );
}
