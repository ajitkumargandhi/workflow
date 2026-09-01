import React, { useState, useEffect } from 'react';
import { requestService } from '../services/api.service';
import { useUser } from '../UserContext';
import RequestHistory from './RequestHistory';

const ApproverDashboard = () => {
  const { currentUser } = useUser();
  const [viewMode, setViewMode] = useState('pending'); // 'pending' or 'history'
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionComments, setActionComments] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const currencySymbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'AED ', SAR: 'SAR ' };

  useEffect(() => {
    fetchPending();
  }, [currentUser]);

  useEffect(() => {
    setSelectedRequest(null);
    setActionComments('');
  }, [viewMode]);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const data = await requestService.getMyRequests('all');
      
      const pending = data.filter(req => {
        if (req.status !== 'Pending') return false;
        if (!req.current_step) return false;
        
        const reqRole = req.current_step.approverRole;
        if (!reqRole) return false;
        
        const userRole = typeof currentUser.role === 'string' ? currentUser.role : (currentUser.role?.role_name || '');
        
        if (reqRole.role_name === 'Approver') {
          const isDesignated = req.designated_manager?.id === currentUser.id;
          const isLineManager = req.requestor?.manager?.id === currentUser.id;
          return isDesignated || isLineManager || userRole === 'Super Admin';
        }
        
        return userRole === reqRole.role_name || userRole === 'Super Admin';
      });
      
      setPendingRequests(pending);
    } catch (err) {
      console.error('Error fetching requests', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    if ((action === 'Reject' || action === 'SendBack') && !actionComments.trim()) {
      alert(`Mandatory requirement: Please provide a comment/reason when performing a ${action} action.`);
      return;
    }

    setStatus('Processing decision...');
    try {
      await requestService.takeAction(id, {
        approverId: currentUser?.id,
        action,
        comments: actionComments,
      });
      setStatus(`Request successfully ${action}ed!`);
      setSelectedRequest(null);
      setActionComments('');
      setTimeout(() => setStatus(''), 3000);
      fetchPending();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Error executing managerial action';
      setStatus('Error: ' + errMsg);
    }
  };

  const formatCost = (req) => {
    const symbol = currencySymbols[req.currency] || '$';
    return `${symbol}${req.total_cost}`;
  };

  if (viewMode === 'history') {
    return (
      <div>
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setViewMode('pending')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← Back to Pending Queue ({pendingRequests.length})
          </button>
        </div>
        <RequestHistory authUser={currentUser} title="Manager Actioned & Decision Histories" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '700' }}>Manager & Approver Portal</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Review pending workflow requests requiring managerial review or view historical decisions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setViewMode('history')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            📜 View Actioned Histories & Audit Logs
          </button>

          <button
            onClick={fetchPending}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            🔄 Refresh
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

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Pending Requests Queue Table */}
        <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading pending approvals...</div>
          ) : pendingRequests.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
              <p>No pending approvals awaiting your decision.</p>
              <button
                onClick={() => setViewMode('history')}
                style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                View Actioned Request History
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Tracking ID</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Requestor</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Source & Cost</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map(req => {
                  const isSelected = selectedRequest?.id === req.id;
                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#f3e8ff' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#7c3aed' }}>{req.tracking_id}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '500' }}>{req.requestor?.full_name || 'Employee'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{req.requestor?.department}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>{req.primary_category} ➔ {req.secondary_category}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '600' }}>{formatCost(req)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{req.fulfillment_type || 'New Purchase'}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className="badge badge-pending">{req.urgency || 'Medium'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Approval Decision Panel */}
        {selectedRequest && (
          <div style={{
            width: '450px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>Review Request Details</h3>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div><strong>Tracking ID:</strong> <span style={{ color: '#7c3aed', fontWeight: '600' }}>{selectedRequest.tracking_id}</span></div>
              <div><strong>Requestor:</strong> {selectedRequest.requestor?.full_name} ({selectedRequest.requestor?.email})</div>
              <div><strong>Designated Manager:</strong> {selectedRequest.designated_manager?.full_name || selectedRequest.requestor?.manager?.full_name || 'Line Manager'}</div>
              <div><strong>Category:</strong> {selectedRequest.primary_category} ➔ {selectedRequest.secondary_category}</div>
              <div><strong>Fulfillment Source:</strong> {selectedRequest.fulfillment_type || 'New Purchase'}</div>
              <div><strong>Cost:</strong> <span style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>{formatCost(selectedRequest)}</span></div>
              <div><strong>Urgency:</strong> {selectedRequest.urgency}</div>
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                <strong>Justification:</strong>
                <p style={{ margin: '0.25rem 0 0', color: '#334155' }}>{selectedRequest.justification}</p>
              </div>
            </div>

            {/* Decision Comments */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem', display: 'block', marginBottom: '0.375rem' }}>
                Managerial Comments / Decision Reason
              </label>
              <textarea
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                placeholder="Enter approval comments or mandatory reason for rejection/sendback..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Decision Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              <button
                onClick={() => handleAction(selectedRequest.id, 'Approve')}
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ✓ Approve
              </button>

              <button
                onClick={() => handleAction(selectedRequest.id, 'SendBack')}
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#d97706',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ↩ Send Back
              </button>

              <button
                onClick={() => handleAction(selectedRequest.id, 'Reject')}
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ✕ Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApproverDashboard;
