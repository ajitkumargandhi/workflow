import React, { useState, useEffect } from 'react';
import { requestService } from '../services/api.service';
import { useUser } from '../UserContext';
import RequestHistory from './RequestHistory';

const SupportDashboard = () => {
  const { currentUser } = useUser();
  const [viewMode, setViewMode] = useState('queue'); // 'queue' or 'history'
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetails, setRequestDetails] = useState(null);
  
  const [workNote, setWorkNote] = useState('');
  const [newStatus, setNewStatus] = useState('In Progress');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [status, setStatus] = useState('');

  const currencySymbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'AED ', SAR: 'SAR ' };

  useEffect(() => {
    fetchFilteredRequests();
  }, [currentUser]);

  useEffect(() => {
    setSelectedRequest(null);
    setRequestDetails(null);
  }, [viewMode]);

  const fetchFilteredRequests = async () => {
    try {
      setLoading(true);
      const data = await requestService.getMyRequests('all');
      
      // Filter requests by status AND support team category segregation
      const filtered = data.filter(req => {
        const isApprovedOrActive = ['Approved', 'In Progress', 'Fulfilled'].includes(req.status);
        if (!isApprovedOrActive) return false;

        const prim = (req.primary_category || '').toLowerCase();
        
        // IT Agent sees IT categories
        if (currentUser?.role === 'IT Agent') {
          return prim.includes('it assets') || prim.includes('it support');
        }
        // Admin Agent sees Office Admin categories
        if (currentUser?.role === 'Admin Agent') {
          return prim.includes('office admin');
        }
        // Super Admin or general agent sees all
        return true;
      });

      setApprovedRequests(filtered);
    } catch (err) {
      console.error('Error fetching support queue', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRequest = async (req) => {
    setSelectedRequest(req);
    setLoadingDetails(true);
    try {
      const details = await requestService.getRequestDetails(req.id);
      setRequestDetails(details);
      setFulfillmentNotes(details.fulfillment_notes || '');
    } catch (err) {
      console.error('Error fetching details', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePostWorkUpdate = async (e) => {
    e.preventDefault();
    if (!workNote.trim()) return;

    setStatus('Posting work update...');
    try {
      await requestService.addWorkUpdate(selectedRequest.id, {
        agentId: currentUser?.id,
        note: workNote,
        status: newStatus,
      });
      setStatus('Work update added!');
      setWorkNote('');
      setTimeout(() => setStatus(''), 3000);
      
      // Refresh details & queue
      const updatedDetails = await requestService.getRequestDetails(selectedRequest.id);
      setRequestDetails(updatedDetails);
      fetchFilteredRequests();
    } catch (err) {
      setStatus('Error adding update: ' + err.message);
    }
  };

  const handleFulfill = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setStatus('Fulfilling request...');
    try {
      await requestService.fulfillRequest(selectedRequest.id, {
        notes: fulfillmentNotes,
        agentId: currentUser?.id,
      });
      setStatus('Request marked as Fulfilled successfully!');
      setTimeout(() => setStatus(''), 3000);
      
      const updatedDetails = await requestService.getRequestDetails(selectedRequest.id);
      setRequestDetails(updatedDetails);
      fetchFilteredRequests();
    } catch (err) {
      setStatus('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Are you sure you want to mark this request as Closed?')) return;
    setStatus('Closing ticket...');
    try {
      await requestService.closeRequest(selectedRequest.id, {
        userId: currentUser?.id,
        notes: 'Ticket marked as Closed by Support Team.',
      });
      setStatus('Ticket closed successfully!');
      setTimeout(() => setStatus(''), 3000);

      const updatedDetails = await requestService.getRequestDetails(selectedRequest.id);
      setRequestDetails(updatedDetails);
      fetchFilteredRequests();
    } catch (err) {
      setStatus('Error closing ticket: ' + err.message);
    }
  };

  const formatCost = (req) => {
    const symbol = currencySymbols[req.currency] || '$';
    return `${symbol}${req.total_cost}`;
  };

  const getTeamName = () => {
    if (currentUser?.role === 'IT Agent') return 'IT Support Team Queue';
    if (currentUser?.role === 'Admin Agent') return 'Office Admin Team Queue';
    return 'All Support Queues';
  };

  if (viewMode === 'history') {
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => setViewMode('queue')}
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
            ← Back to Active Support Queue ({approvedRequests.length})
          </button>
        </div>
        <RequestHistory authUser={currentUser} title="Support Agent Handled & Actioned Histories" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '700' }}>{getTeamName()}</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Work on tickets, post progress notes, fulfill assets/services, and close requests
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
            📜 View Actioned & Handled Histories
          </button>

          <button
            onClick={fetchFilteredRequests}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            🔄 Refresh Queue
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
        {/* Support Queue Table */}
        <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading team queue...</div>
          ) : approvedRequests.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
              <p>No active tickets pending in your team queue.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Tracking ID</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Requestor</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Source / Cost</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedRequests.map(req => {
                  const isSelected = selectedRequest?.id === req.id;
                  return (
                    <tr
                      key={req.id}
                      onClick={() => handleSelectRequest(req)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#ecfdf5' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#059669' }}>{req.tracking_id}</td>
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
                        <span className={`badge ${req.status === 'Fulfilled' ? 'badge-fulfilled' : req.status === 'Closed' ? 'badge-approved' : 'badge-pending'}`}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Fulfillment & Work Notes Action Panel */}
        {selectedRequest && (
          <div style={{
            width: '460px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>Ticket Management</h3>
              <button onClick={() => setSelectedRequest(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}>✕</button>
            </div>

            {loadingDetails ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: '#64748b' }}>Loading ticket details...</div>
            ) : (
              <div>
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div><strong>Tracking ID:</strong> <span style={{ color: '#059669', fontWeight: '600' }}>{requestDetails?.tracking_id}</span></div>
                  <div><strong>Requestor:</strong> {requestDetails?.requestor?.full_name} ({requestDetails?.requestor?.email})</div>
                  <div><strong>Category:</strong> {requestDetails?.primary_category} ➔ {requestDetails?.secondary_category}</div>
                  <div><strong>Source:</strong> {requestDetails?.fulfillment_type} | <strong>Cost:</strong> {formatCost(requestDetails || {})}</div>
                  <div><strong>Status:</strong> <span className="badge badge-approved">{requestDetails?.status}</span></div>
                  <div style={{ marginTop: '0.375rem', padding: '0.5rem', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                    <strong>Justification:</strong> {requestDetails?.justification}
                  </div>
                </div>

                {/* Existing Progress Updates Log */}
                {requestDetails?.updates && requestDetails.updates.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>Agent Progress Log</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '140px', overflowY: 'auto' }}>
                      {requestDetails.updates.map(up => (
                        <div key={up.id} style={{ backgroundColor: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>
                            [{up.status}] by {up.agent?.full_name || 'Agent'}
                          </div>
                          <div style={{ color: '#334155' }}>{up.note}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{new Date(up.timestamp).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Work Update Form */}
                <form onSubmit={handlePostWorkUpdate} style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: '700' }}>Post Work Progress Update</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Set Status</label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: 'white' }}
                      >
                        <option value="In Progress">In Progress</option>
                        <option value="Approved">Approved</option>
                        <option value="Fulfilled">Fulfilled</option>
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={workNote}
                    onChange={(e) => setWorkNote(e.target.value)}
                    required
                    placeholder="Enter progress update (e.g. Asset prepared, hardware diagnosed, stock item re-issued)..."
                    rows={2}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                  />
                  <button type="submit" style={{ width: '100%', padding: '0.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                    + Post Work Update
                  </button>
                </form>

                {/* Mark as Fulfilled Form */}
                <form onSubmit={handleFulfill} style={{ marginBottom: '1rem' }}>
                  <label style={{ fontWeight: '600', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                    Fulfillment / Completion Notes
                  </label>
                  <textarea
                    value={fulfillmentNotes}
                    onChange={(e) => setFulfillmentNotes(e.target.value)}
                    placeholder="Enter final fulfillment notes or serial/license details..."
                    rows={2}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="submit"
                      style={{
                        padding: '0.6rem',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Mark Fulfilled
                    </button>

                    <button
                      type="button"
                      onClick={handleClose}
                      style={{
                        padding: '0.6rem',
                        backgroundColor: '#475569',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      🔒 Close Ticket
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportDashboard;
