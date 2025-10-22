import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './Auth.css';

function VerifyEmail() {
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const response = await api.get(`/auth/verify-email/${token}`);

      if (response.data.success) {
        setStatus('success');
        setMessage('Email verified successfully! Redirecting to dashboard...');
        
        // Store token
        localStorage.setItem('token', response.data.token);
        
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (error) {
      setStatus('error');
      setMessage(
        error.response?.data?.message || 
        'Email verification failed. The link may be invalid or expired.'
      );
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {status === 'verifying' && (
          <>
            <div className="verify-spinner">
              <div className="loading-spinner-large"></div>
            </div>
            <h2 className="verify-title">Verifying Your Email...</h2>
            <p className="verify-text">Please wait while we verify your email address.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="verify-success-icon">✅</div>
            <h2 className="verify-title success">Email Verified!</h2>
            <p className="verify-text">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="verify-error-icon">❌</div>
            <h2 className="verify-title error">Verification Failed</h2>
            <p className="verify-text error">{message}</p>
            <div className="verify-actions">
              <Link to="/login" className="verify-button">
                Go to Login
              </Link>
              <Link to="/signup" className="verify-button secondary">
                Sign Up Again
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;