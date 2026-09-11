import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../UserContext';
import { authService } from '../services/api.service';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setCurrentUser } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot / Reset Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');
  const [forgotStatusType, setForgotStatusType] = useState('info'); // 'info', 'success', 'error'
  const [resetStep, setResetStep] = useState(1); // 1: request token, 2: enter token & new pass
  const [resetLoading, setResetLoading] = useState(false);

  // Check if a reset token was provided in the query string
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl.trim());
      setResetStep(2);
      setShowForgotModal(true);
      setForgotStatus('Reset token detected from email link. Please set your new password below.');
      setForgotStatusType('info');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authService.login(email.trim(), password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setCurrentUser(data.user);

      // Single login: route dynamically according to the user's role
      const userRole = typeof data.user.role === 'string' ? data.user.role : data.user.role?.role_name;
      if (userRole === 'Super Admin') {
        navigate('/admin');
      } else if (userRole === 'Approver') {
        navigate('/approvals');
      } else if (userRole === 'IT Agent' || userRole === 'Admin Agent') {
        navigate('/support');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request reset email & token
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotStatus('Dispatching reset instructions to your email...');
    setForgotStatusType('info');
    setResetLoading(true);

    try {
      const res = await authService.forgotPassword(forgotEmail.trim());
      // Advance to step 2 immediately on success
      setResetStep(2);
      setForgotStatusType('success');
      setForgotStatus(
        `Reset instructions dispatched! Please check ${forgotEmail} for the reset link, or enter the token below along with your new password.`
      );
    } catch (err) {
      setForgotStatusType('error');
      setForgotStatus('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setResetLoading(false);
    }
  };

  // Step 2: Submit token and new password
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setForgotStatus('');

    if (!resetToken.trim()) {
      setForgotStatusType('error');
      setForgotStatus('Please enter the reset token received via email.');
      return;
    }

    if (newPassword.length < 6) {
      setForgotStatusType('error');
      setForgotStatus('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotStatusType('error');
      setForgotStatus('Passwords do not match. Please re-enter.');
      return;
    }

    setForgotStatus('Updating password...');
    setForgotStatusType('info');
    setResetLoading(true);

    try {
      const res = await authService.resetPasswordToken(resetToken.trim(), newPassword);
      setForgotStatusType('success');
      setForgotStatus(res.message || 'Password has been reset successfully! You can now log in.');

      // Auto fill the login email with the reset account and close modal after brief delay
      if (forgotEmail) {
        setEmail(forgotEmail);
      }
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStatus('');
        setResetStep(1);
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');
      }, 2500);
    } catch (err) {
      setForgotStatusType('error');
      setForgotStatus('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setResetLoading(false);
    }
  };

  const handleQuickFill = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f1f5f9',
      padding: '1.5rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)',
        border: '1px solid #e2e8f0',
        padding: '2.5rem'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            fontSize: '1.75rem',
            marginBottom: '0.85rem'
          }}>
            ⚡
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
            Enterprise Workflow
          </h1>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Sign in to access your workflow portal
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            {error}
          </div>
        )}

        {/* Single Unified Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
              Work Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.15s'
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotEmail(email);
                  setForgotStatus('');
                  setResetStep(1);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Forgot Password?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '0.75rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
              transition: 'background-color 0.15s'
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Accounts Quick-Fill Helper (Collapsible) */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
          <details style={{ fontSize: '0.8rem', color: '#64748b' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#475569', userSelect: 'none' }}>
              💡 Quick-Fill Demo Credentials
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleQuickFill('employee@company.com', 'admin123')}
                style={quickFillBtnStyle}
              >
                👤 Employee
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('manager@company.com', 'admin123')}
                style={quickFillBtnStyle}
              >
                👔 Approver
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('support@company.com', 'admin123')}
                style={quickFillBtnStyle}
              >
                💻 IT Agent
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('office_admin@company.com', 'admin123')}
                style={quickFillBtnStyle}
              >
                🏢 Admin Agent
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin@company.com', 'admin123')}
                style={{ ...quickFillBtnStyle, gridColumn: 'span 2', backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
              >
                ⚙️ Super Admin (admin@company.com)
              </button>
            </div>
          </details>
        </div>
      </div>

      {/* Forgot / Reset Password Modal */}
      {showForgotModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            maxWidth: '450px',
            width: '100%',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                {resetStep === 1 ? 'Reset Account Password' : 'Enter Token & New Password'}
              </h3>
              <button
                onClick={() => setShowForgotModal(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {forgotStatus && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: forgotStatusType === 'error' ? '#fef2f2' : forgotStatusType === 'success' ? '#f0fdf4' : '#f0f9ff',
                color: forgotStatusType === 'error' ? '#991b1b' : forgotStatusType === 'success' ? '#166534' : '#0369a1',
                border: `1px solid ${forgotStatusType === 'error' ? '#fecaca' : forgotStatusType === 'success' ? '#bbf7d0' : '#bae6fd'}`,
                fontSize: '0.85rem',
                lineHeight: 1.5,
                marginBottom: '1.25rem'
              }}>
                {forgotStatus}
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
                  Enter your registered account email. A secure password reset link and verification token will be dispatched to your inbox.
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
                    Account Email
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{
                    padding: '0.8rem',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: resetLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {resetLoading ? 'Sending Reset Instructions...' : 'Send Reset Link & Token'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setResetStep(2);
                      setForgotStatus('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Already have a reset token? Enter token directly &rarr;
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
                    Reset Verification Token
                  </label>
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste token from email"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      backgroundColor: '#f8fafc'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{
                    padding: '0.8rem',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: resetLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {resetLoading ? 'Saving New Password...' : 'Set New Password'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setResetStep(1);
                      setForgotStatus('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    &larr; Request a new reset token
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const quickFillBtnStyle = {
  padding: '6px 8px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: '500',
  color: '#475569',
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all 0.15s'
};

export default Login;
