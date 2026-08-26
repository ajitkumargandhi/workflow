import React, { useState, useEffect } from 'react';
import { userService, roleService } from '../services/api.service';

const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  // Add/Edit User Form State
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    department: '',
    manager_id: '',
    role_id: 1,
    auth_source: 'Local',
  });

  // Password Reset Modal State
  const [resetModalUserId, setResetModalUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [showCsvImport, setShowCsvImport] = useState(false);

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const fetchUsersAndRoles = async () => {
    try {
      setLoading(true);
      const [uData, rData] = await Promise.all([
        userService.getUsers(),
        roleService.getRoles()
      ]);
      setUsers(uData);
      setRoles(rData);
    } catch (err) {
      console.error('Error fetching users/roles', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        full_name: userForm.full_name,
        email: userForm.email,
        department: userForm.department,
        role: { id: Number(userForm.role_id) },
        manager: userForm.manager_id ? { id: userForm.manager_id } : null,
        auth_source: userForm.auth_source,
      };

      if (userForm.password) {
        payload.password = userForm.password;
      }

      if (editingUserId) {
        await userService.updateUser(editingUserId, payload);
        setStatus('User updated successfully!');
      } else {
        await userService.createUser(payload);
        setStatus('User created successfully!');
      }

      setShowForm(false);
      setEditingUserId(null);
      setUserForm({ full_name: '', email: '', password: '', department: '', manager_id: '', role_id: 1, auth_source: 'Local' });
      fetchUsersAndRoles();
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Error saving user: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await userService.updateStatus(userId, !currentStatus);
      setStatus(`User status updated to ${!currentStatus ? 'Active' : 'Disabled'}`);
      fetchUsersAndRoles();
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Error updating user status: ' + err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalUserId || !newPassword) return;
    try {
      await userService.resetPassword(resetModalUserId, newPassword);
      setStatus('Password reset successfully!');
      setResetModalUserId(null);
      setNewPassword('');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Error resetting password: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await userService.deleteUser(userId);
      setStatus('User deleted!');
      fetchUsersAndRoles();
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Error deleting user: ' + err.message);
    }
  };

  const handleCsvImport = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) return;

    try {
      const res = await userService.importUsers(csvText);
      setStatus(`CSV Import completed! ${res.success} users created/updated. ${res.errors?.length || 0} errors.`);
      setShowCsvImport(false);
      setCsvText('');
      fetchUsersAndRoles();
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      setStatus('Error importing CSV: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '700' }}>User Management Portal</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Add, edit, enable/disable, reset passwords, and bulk import users
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => {
              setShowCsvImport(!showCsvImport);
              setShowForm(false);
            }}
            style={{
              padding: '0.6rem 1rem',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            📥 Import Users (CSV)
          </button>

          <button
            onClick={() => {
              setShowForm(!showForm);
              setShowCsvImport(false);
              setEditingUserId(null);
              setUserForm({ full_name: '', email: '', password: '', department: '', manager_id: '', role_id: 1, auth_source: 'Local' });
            }}
            style={{
              padding: '0.6rem 1.2rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            + Create New User
          </button>
        </div>
      </div>

      {status && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: status.includes('Error') ? '#fee2e2' : '#dcfce7',
          color: status.includes('Error') ? '#b91c1c' : '#15803d',
          fontWeight: '600',
          marginBottom: '1.5rem'
        }}>
          {status}
        </div>
      )}

      {/* CSV Import Modal / Form */}
      {showCsvImport && (
        <form onSubmit={handleCsvImport} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '700' }}>Bulk Import Users from CSV</h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
            Expected Header: <code>full_name, email, department, manager_email, role_name, auth_source, password</code>
          </p>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder={`full_name, email, department, manager_email, role_name, auth_source, password\nJohn Doe, john@company.com, Finance, manager@company.com, user, Local, user123\nJane Smith, jane@company.com, IT, admin@company.com, support, Local, user123`}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '1rem' }}
          />

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" style={{ padding: '0.6rem 1.2rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
              Run CSV Import
            </button>
            <button type="button" onClick={() => setShowCsvImport(false)} style={{ padding: '0.6rem 1rem', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Add / Edit User Form */}
      {showForm && (
        <form onSubmit={handleSaveUser} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <h3 style={{ gridColumn: '1 / -1', margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '700' }}>
            {editingUserId ? 'Edit User Profile' : 'Add New User'}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Full Name *</label>
            <input
              type="text"
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              required
              placeholder="e.g. Alice Smith"
              style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Email Address *</label>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              required
              placeholder="alice@company.com"
              style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Password {editingUserId ? '(Leave blank to keep unchanged)' : '*'}</label>
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              required={!editingUserId}
              placeholder="••••••••"
              style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Department</label>
            <input
              type="text"
              value={userForm.department}
              onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
              placeholder="e.g. Operations, IT, Finance"
              style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>System Role *</label>
            <select
              value={userForm.role_id}
              onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}
              style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.role_name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Line Manager</label>
            <select
              value={userForm.manager_id}
              onChange={(e) => setUserForm({ ...userForm, manager_id: e.target.value })}
              style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
            >
              <option value="">-- No Direct Manager --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="submit" style={{ padding: '0.6rem 1.2rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
              {editingUserId ? 'Update User' : 'Save User'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.6rem 1rem', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Password Reset Modal */}
      {resetModalUserId && (
        <form onSubmit={handleResetPassword} style={{ backgroundColor: 'white', border: '2px solid #3b82f6', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', maxWidth: '400px' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '700' }}>Reset User Password</h3>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="Enter new password"
            style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '1rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
              Save New Password
            </button>
            <button type="button" onClick={() => setResetModalUserId(null)} style={{ padding: '0.5rem 1rem', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Users List Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading users database...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '0.875rem 1rem' }}>User</th>
                <th style={{ padding: '0.875rem 1rem' }}>Role</th>
                <th style={{ padding: '0.875rem 1rem' }}>Department</th>
                <th style={{ padding: '0.875rem 1rem' }}>Manager</th>
                <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                <th style={{ padding: '0.875rem 1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{u.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: u.role?.role_name === 'Super Admin' ? '#dbeafe' : '#f1f5f9',
                      color: u.role?.role_name === 'Super Admin' ? '#1e40af' : '#475569',
                      fontWeight: '600',
                      fontSize: '0.75rem'
                    }}>
                      {u.role?.role_name || 'Requestor'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{u.department || 'N/A'}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{u.manager?.full_name || 'None'}</td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => handleToggleStatus(u.id, u.is_active !== false)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        backgroundColor: u.is_active !== false ? '#dcfce7' : '#fee2e2',
                        color: u.is_active !== false ? '#15803d' : '#b91c1c'
                      }}
                    >
                      {u.is_active !== false ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => {
                          setEditingUserId(u.id);
                          setUserForm({
                            full_name: u.full_name,
                            email: u.email,
                            password: '',
                            department: u.department || '',
                            manager_id: u.manager?.id || '',
                            role_id: u.role?.id || 1,
                            auth_source: u.auth_source || 'Local',
                          });
                          setShowForm(true);
                          setShowCsvImport(false);
                        }}
                        style={{ fontSize: '0.75rem', padding: '3px 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => setResetModalUserId(u.id)}
                        style={{ fontSize: '0.75rem', padding: '3px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        🔑 Password
                      </button>

                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        style={{ fontSize: '0.75rem', padding: '3px 8px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminUserManagement;
