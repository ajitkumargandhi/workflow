import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import { authService } from '../services/api.service';

const Login = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useUser();
  const [activeTab, setActiveTab] = useState('requestor');
  const [email, setEmail] = useState('employee@company.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: enter email, 2: enter token & new pass

  const tabAccounts = {
    requestor: { email: 'employee@company.com', role: 'Requestor', title: 'Requestor Portal', desc: 'Submit and track service or asset requests' },
    manager: { email: 'manager@company.com', role: 'Approver', title: 'Manager Portal', desc: 'Review, approve, or reject team workflow requests' },
    support: { email: 'support@company.com', role: 'IT Support Agent', title: 'IT & Admin Support Portal', desc: 'Fulfill approved requests and record work updates' },
    admin: { email: 'admin@company.com', role: 'Super Admin', title: 'Admin & System Config', desc: 'Manage users, category workflows, and AD/SMTP settings' },
  };

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setEmail(tabAccounts[tabKey].email);
    setPassword('admin123');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authService.login(email, password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setCurrentUser(data.user);

      if (data.user.role === 'Super Admin') navigate('/admin');
      else if (data.user.role === 'Approver') navigate('/approver');
      else if (data.user.role === 'IT Agent' || data.user.role === 'Admin Agent') navigate('/support');
      else navigate('/requestor');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotStatus('Sending reset request...');
    try {
      const res = await authService.forgotPassword(forgotEmail);
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setForgotStatus(`Reset token generated: ${res.resetToken}`);
        setResetStep(2);
      } else {
        setForgotStatus(res.message);
      }
    } catch (err) {
      setForgotStatus('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setForgotStatus('Updating password...');
    try {
      const res = await authService.resetPasswordToken(resetToken, newPassword);
      setForgotStatus(res.message);
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStatus('');
        setResetStep(1);
      }, 2500);
    } catch (err) {
      setForgotStatus('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0',
        padding: '2.25rem'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            fontSize: '1.75rem',
            marginBottom: '0.75rem'
          }}>
            ⚡
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>Enterprise Workflow</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Unified Request & Multi-Level Approval Engine
          </p>
        </div>

        {/* Portal Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          backgroundColor: '#f1f5f9',
          padding: '4px',
          borderRadius: '10px',
          marginBottom: '1.5rem'
        }}>
          {Object.keys(tabAccounts).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => handleTabChange(tabKey)}
              style={{
                padding: '0.5rem 0',
                fontSize: '0.75rem',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: activeTab === tabKey ? 'white' : 'transparent',
                color: activeTab === tabKey ? '#2563eb' : '#64748b',
                boxShadow: activeTab === tabKey ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {tabKey === 'requestor' ? '👤 Employee' : tabKey === 'manager' ? '👔 Manager' : tabKey === 'support' ? '🛠️ Support' : '⚙️ Admin'}
            </button>
          ))}
        </div>

        {/* Info Box */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          borderLeft: '4px solid #2563eb',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: '#475569'
        }}>
          <strong>{tabAccounts[activeTab].title}</strong>: {tabAccounts[activeTab].desc}
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.375rem' }}>
              Work Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotEmail(email);
                }}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '500' }}
              >
                Forgot Password?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              padding: '0.875rem',
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
            {loading ? 'Authenticating...' : `Sign In to Portal`}
          </button>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '420px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Password Reset Assistance</h3>
              <button onClick={() => setShowForgotModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {forgotStatus && (
              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: forgotStatus.includes('Error') ? '#fee2e2' : '#e0f2fe', color: forgotStatus.includes('Error') ? '#b91c1c' : '#0369a1', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {forgotStatus}
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                  Enter your account email to receive a password reset token link via SMTP notification.
                </p>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Account Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <button type="submit" style={{ padding: '0.75rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                  Request Reset Token
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Reset Token</label>
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <button type="submit" style={{ padding: '0.75rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                  Set New Password
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
