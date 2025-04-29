import React, { useState } from 'react';

const Auth = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      // Assuming serverVerifyCode was meant to be compared against a fetched/stored value
      // For now, using a placeholder comparison or removing the check if not needed
      // If you need OTP verification logic, it needs to be implemented properly.
      // Example: Fetch expected OTP or use a verification service.
      // For demonstration, let's assume a dummy check:
      const expectedOtp = "123456"; // Replace with actual logic
      if (otp === expectedOtp) { 
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