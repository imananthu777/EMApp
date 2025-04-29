import React, { useState } from 'react';

const Auth = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [serverVerifyCode, setServerVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (otp === serverVerifyCode) {
        setMessage('OTP verified successfully!');
        // Create a session for the authenticated user
        const user = {
          id: phone,
          phone: phone,
          ...JSON.parse(localStorage.getItem('registrationData') || '{}')
        };
        // Store the authenticated user data
        localStorage.setItem('authenticatedUser', JSON.stringify(user));
        // Trigger authentication state change
        window.dispatchEvent(new Event('auth-state-changed'));
      } else {
        setMessage('Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      setMessage(error.message || 'An error occurred during verification.');
    }
    setLoading(false);
  };

  return (
    <div>
      <form onSubmit={handleVerifyOtp}>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
        />
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="OTP"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Auth;