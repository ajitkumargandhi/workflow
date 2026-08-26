import React, { useState } from 'react';
import { useUser } from '../UserContext';
import { userService } from '../services/api.service';

const UserSwitcher = () => {
  const { currentUser, setCurrentUser } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      alert('Error fetching users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '10px', 
      backgroundColor: '#f0f0f0', 
      borderBottom: '1px solid #ccc', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '15px',
      fontSize: '0.9rem'
    }}>
      <strong>Current User: </strong>
      {currentUser ? (
        <span>{currentUser.full_name} ({currentUser.role?.role_name})</span>
      ) : (
        <span>None (Guest)</span>
      )}
      
      <select 
        onChange={(e) => {
          const userId = e.target.value;
          const user = users.find(u => u.id === userId);
          setCurrentUser(user);
        }} 
        value={currentUser?.id || ''}
        style={{ padding: '4px' }}
      >
        <option value="">-- Switch User --</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.full_name} ({u.role?.role_name})</option>
        ))}
      </select>

      <button onClick={fetchUsers} disabled={loading} style={{ padding: '4px 8px', cursor: 'pointer' }}>
        {loading ? 'Loading...' : 'Refresh User List'}
      </button>
    </div>
  );
};

export default UserSwitcher;
