import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useUser, UserProvider } from './UserContext';
import RequestForm from './pages/RequestForm';
import ApproverDashboard from './pages/ApproverDashboard';
import AdminPortal from './pages/AdminPortal';
import AdminUserManagement from './pages/AdminUserManagement';
import MyRequests from './pages/MyRequests';
import SupportDashboard from './pages/SupportDashboard';
import ServerConfig from './pages/ServerConfig';
import RequestHistory from './pages/RequestHistory';
import Login from './pages/Login';

function AppContent() {
  const { currentUser, logout } = useUser();

  const getRoleName = () => {
    if (!currentUser) return '';
    if (typeof currentUser.role === 'string') return currentUser.role;
    return currentUser.role?.role_name || 'Requestor';
  };

  const role = getRoleName();
  const isSuperAdmin = role === 'Super Admin';
  const isAdmin = isSuperAdmin || role === 'Admin Agent';
  const isApprover = role === 'Approver' || isAdmin;
  const isSupport = role === 'IT Agent' || role === 'Admin Agent' || isSuperAdmin;

  return (
    <Router>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
        {currentUser && (
          <header style={{
            background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '0.8rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '-0.5px' }}>
                <span style={{ fontSize: '1.5rem' }}>⚡</span>
                <span>Enterprise Workflow</span>
              </div>
              <nav style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
                <Link to="/" style={navLinkStyle}>New Request</Link>
                <Link to="/my-requests" style={navLinkStyle}>My Requests</Link>
                
                {isApprover && (
                  <Link to="/approvals" style={navLinkStyle}>Pending Approvals</Link>
                )}
                
                {isSupport && (
                  <Link to="/support" style={navLinkStyle}>Support Queue</Link>
                )}

                {isSuperAdmin && (
                  <>
                    <span style={{ color: '#475569' }}>|</span>
                    <Link to="/admin/history" style={navLinkStyle}>System-Wide Requests & History</Link>
                    <Link to="/admin" style={navLinkStyle}>Categories & Workflows</Link>
                    <Link to="/admin/users" style={navLinkStyle}>User Management</Link>
                    <Link to="/admin/server" style={navLinkStyle}>Server Config</Link>
                  </>
                )}
              </nav>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{currentUser.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: isSuperAdmin ? '#dc2626' : isAdmin ? '#3b82f6' : isApprover ? '#8b5cf6' : isSupport ? '#10b981' : '#64748b',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '0.65rem'
                  }}>
                    {role}
                  </span>
                  <span>{currentUser.department ? `• ${currentUser.department}` : ''}</span>
                </div>
              </div>

              <button
                onClick={logout}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              >
                Logout
              </button>
            </div>
          </header>
        )}

        <main style={{ flex: 1, padding: '2rem' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={currentUser ? <RequestForm /> : <Navigate to="/login" />}
            />
            <Route
              path="/my-requests"
              element={currentUser ? <MyRequests authUser={currentUser} /> : <Navigate to="/login" />}
            />
            <Route
              path="/approvals"
              element={currentUser && isApprover ? <ApproverDashboard /> : <Navigate to="/login" />}
            />
            <Route
              path="/support"
              element={currentUser && isSupport ? <SupportDashboard /> : <Navigate to="/login" />}
            />
            <Route
              path="/admin/history"
              element={currentUser && isSuperAdmin ? <RequestHistory authUser={{ id: 'all' }} title="Super Admin - System-Wide Request Statuses & Audit History" /> : <Navigate to="/login" />}
            />
            <Route
              path="/admin"
              element={currentUser && isSuperAdmin ? <AdminPortal /> : <Navigate to="/login" />}
            />
            <Route
              path="/admin/users"
              element={currentUser && isSuperAdmin ? <AdminUserManagement /> : <Navigate to="/login" />}
            />
            <Route
              path="/admin/server"
              element={currentUser && isSuperAdmin ? <ServerConfig /> : <Navigate to="/login" />}
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

const navLinkStyle = {
  color: '#e2e8f0',
  textDecoration: 'none',
  fontSize: '0.9rem',
  fontWeight: '500',
  transition: 'color 0.2s',
};

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;
