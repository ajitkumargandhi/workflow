import React, { useState, useEffect, useMemo } from 'react';
import { requestService, adminConfigService, userService } from '../services/api.service';

const RequestHistory = ({ authUser, title = "Request Histories & Audit Log" }) => {
  const [scope, setScope] = useState('all'); // 'all', 'submitted', 'actioned'
  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetails, setRequestDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Extra Info / Commenting & Edit Resubmit States
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentStatus, setCommentStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    justification: '',
    total_cost: 0,
    currency: 'USD',
    fulfillment_type: 'New Purchase',
    designated_manager_id: '',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Filter States
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', '7days', '30days', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const currencySymbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'AED ', SAR: 'SAR ' };

  useEffect(() => {
    fetchInitialData();
  }, [authUser, scope]);

  useEffect(() => {
    setSelectedRequest(null);
    setRequestDetails(null);
  }, [scope, dateFilter, selectedCategory, selectedStatus, searchQuery]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [catData, userData] = await Promise.all([
        adminConfigService.getCategories(),
        userService.getUsers(),
      ]);
      setCategories(catData);
      const appUsers = userData.filter(u => u.role?.role_name === 'Approver' || u.role?.role_name === 'Super Admin' || u.role?.role_name === 'IT Agent');
      setManagers(appUsers);

      let data = [];
      if (scope === 'submitted') {
        data = await requestService.getMyRequests(authUser?.id || 'all');
      } else if (scope === 'actioned') {
        data = await requestService.getActionedRequests(authUser?.id || 'all');
      } else {
        // Combine both submitted and actioned
        const [sub, act] = await Promise.all([
          requestService.getMyRequests(authUser?.id || 'all'),
          requestService.getActionedRequests(authUser?.id || 'all'),
        ]);
        const map = new Map();
        [...sub, ...act].forEach(item => map.set(item.id, item));
        data = Array.from(map.values());
      }

      setRequests(data);
    } catch (err) {
      console.error('Error fetching history requests', err);
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
      setIsEditing(false); // Reset edit state when switching tickets
    } catch (err) {
      console.error('Error loading request details', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPostingComment(true);
    setCommentStatus('');
    try {
      await requestService.addWorkUpdate(requestDetails.id, {
        agentId: authUser?.id,
        note: commentText,
        status: requestDetails.status,
      });
      setCommentText('');
      setCommentStatus('Comment posted successfully!');
      
      const details = await requestService.getRequestDetails(requestDetails.id);
      setRequestDetails(details);
      setTimeout(() => setCommentStatus(''), 3000);
    } catch (err) {
      setCommentStatus('Error posting comment: ' + err.message);
    } finally {
      setPostingComment(false);
    }
  };

  const handleCloseRequest = async () => {
    if (!window.confirm('Are you sure you want to close this request?')) return;
    setPostingComment(true);
    setCommentStatus('');
    try {
      await requestService.closeRequest(requestDetails.id, {
        userId: authUser?.id,
        notes: 'Request closed by the creator.',
      });
      setCommentStatus('Request closed successfully!');
      
      fetchInitialData();
      const details = await requestService.getRequestDetails(requestDetails.id);
      setRequestDetails(details);
      setTimeout(() => setCommentStatus(''), 3000);
    } catch (err) {
      setCommentStatus('Error closing request: ' + err.message);
    } finally {
      setPostingComment(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmittingEdit(true);
    setCommentStatus('');
    try {
      await requestService.updateRequest(requestDetails.id, {
        justification: editFormData.justification,
        total_cost: editFormData.fulfillment_type === 'Re-issue from Stock' ? 0 : Number(editFormData.total_cost),
        currency: editFormData.currency,
        fulfillment_type: editFormData.fulfillment_type,
        designated_manager_id: editFormData.designated_manager_id || null,
        status: 'Pending',
      });
      setCommentStatus('Request resubmitted successfully!');
      setIsEditing(false);
      
      fetchInitialData();
      const details = await requestService.getRequestDetails(requestDetails.id);
      setRequestDetails(details);
      setTimeout(() => setCommentStatus(''), 3000);
    } catch (err) {
      setCommentStatus('Error resubmitting request: ' + err.message);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const startEditing = () => {
    setEditFormData({
      justification: requestDetails.justification || '',
      total_cost: requestDetails.total_cost || 0,
      currency: requestDetails.currency || 'USD',
      fulfillment_type: requestDetails.fulfillment_type || 'New Purchase',
      designated_manager_id: requestDetails.designated_manager?.id || '',
    });
    setIsEditing(true);
  };

  const handleSendClarification = async () => {
    if (!commentText.trim()) {
      alert('Please type your clarification/remark in the message box below first.');
      return;
    }
    setPostingComment(true);
    setCommentStatus('');
    try {
      await requestService.addWorkUpdate(requestDetails.id, {
        agentId: authUser?.id,
        note: `Clarification provided: ${commentText}`,
        status: 'Pending',
      });
      setCommentText('');
      setCommentStatus('Clarification response submitted successfully! Request is now back under review.');
      
      fetchInitialData();
      const details = await requestService.getRequestDetails(requestDetails.id);
      setRequestDetails(details);
      setTimeout(() => setCommentStatus(''), 3000);
    } catch (err) {
      setCommentStatus('Error sending clarification: ' + err.message);
    } finally {
      setPostingComment(false);
    }
  };

  // Filtered Logic
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // 1. Status Filter
      if (selectedStatus && req.status !== selectedStatus) return false;

      // 2. Category Filter
      if (selectedCategory) {
        const catId = Number(selectedCategory);
        const match = req.category?.id === catId || req.category?.parent?.id === catId;
        if (!match) return false;
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const tracking = (req.tracking_id || '').toLowerCase();
        const requestor = (req.requestor?.full_name || '').toLowerCase();
        const justification = (req.justification || '').toLowerCase();
        const prim = (req.primary_category || '').toLowerCase();
        const sec = (req.secondary_category || '').toLowerCase();

        if (!tracking.includes(q) && !requestor.includes(q) && !justification.includes(q) && !prim.includes(q) && !sec.includes(q)) {
          return false;
        }
      }

      // 4. Date Range Filter
      const reqDate = new Date(req.created_at || req.updated_at);
      const now = new Date();

      if (dateFilter === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (reqDate < todayStart) return false;
      } else if (dateFilter === '7days') {
        const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (reqDate < past7) return false;
      } else if (dateFilter === '30days') {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (reqDate < past30) return false;
      } else if (dateFilter === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate);
          if (reqDate < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (reqDate > end) return false;
        }
      }

      return true;
    });
  }, [requests, selectedStatus, selectedCategory, searchQuery, dateFilter, customStartDate, customEndDate]);

  const formatCost = (req) => {
    const symbol = currencySymbols[req.currency] || '$';
    return `${symbol}${req.total_cost}`;
  };

  const renderStatusBadge = (status) => {
    let className = 'badge badge-pending';
    if (status === 'Approved') className = 'badge badge-approved';
    if (status === 'In Progress') className = 'badge badge-pending';
    if (status === 'Rejected') className = 'badge badge-rejected';
    if (status === 'SentBack') className = 'badge badge-sentback';
    if (status === 'Fulfilled') className = 'badge badge-fulfilled';
    if (status === 'Closed') className = 'badge badge-approved';

    return <span className={className}>{status}</span>;
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '700' }}>{title}</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Filter, inspect, and analyze submitted and actioned requests across custom date ranges and categories
          </p>
        </div>

        {/* History Scope Tabs */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setScope('all')}
            style={{
              padding: '0.5rem 0.875rem',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              backgroundColor: scope === 'all' ? 'white' : 'transparent',
              color: scope === 'all' ? '#2563eb' : '#64748b',
              boxShadow: scope === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            📋 All History ({requests.length})
          </button>

          <button
            onClick={() => setScope('submitted')}
            style={{
              padding: '0.5rem 0.875rem',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              backgroundColor: scope === 'submitted' ? 'white' : 'transparent',
              color: scope === 'submitted' ? '#2563eb' : '#64748b',
              boxShadow: scope === 'submitted' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            👤 Submitted Requests
          </button>

          <button
            onClick={() => setScope('actioned')}
            style={{
              padding: '0.5rem 0.875rem',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              backgroundColor: scope === 'actioned' ? 'white' : 'transparent',
              color: scope === 'actioned' ? '#2563eb' : '#64748b',
              boxShadow: scope === 'actioned' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            ✍️ Actioned / Approved
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        alignItems: 'end'
      }}>
        {/* Search Query */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.375rem' }}>
            🔍 Search Keywords
          </label>
          <input
            type="text"
            placeholder="Tracking ID, requestor, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
        </div>

        {/* Date Filter Selection */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.375rem' }}>
            📅 Date Range
          </label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: 'white' }}
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="custom">Custom Date Range...</option>
          </select>
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'custom' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.375rem' }}>
                From Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.375rem' }}>
                To Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
          </>
        )}

        {/* Request Category Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.375rem' }}>
            📂 Request Type / Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: 'white' }}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.parent ? `  └ ${c.name}` : `📁 ${c.name}`}
              </option>
            ))}
          </select>
        </div>

        {/* Request Status Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.375rem' }}>
            🏷️ Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: 'white' }}
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="SentBack">SentBack</option>
            <option value="Fulfilled">Fulfilled</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        {/* Reset Button */}
        <div>
          <button
            type="button"
            onClick={() => {
              setDateFilter('all');
              setCustomStartDate('');
              setCustomEndDate('');
              setSelectedCategory('');
              setSelectedStatus('');
              setSearchQuery('');
            }}
            style={{
              width: '100%',
              padding: '0.55rem',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Main Table & Details Layout */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* History Table */}
        <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading request history...</div>
          ) : filteredRequests.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
              <p style={{ margin: 0 }}>No request records match the selected filter criteria.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Tracking ID</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Requestor</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Cost / Source</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => {
                  const isSelected = selectedRequest?.id === req.id;
                  return (
                    <tr
                      key={req.id}
                      onClick={() => handleSelectRequest(req)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#2563eb' }}>{req.tracking_id}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '500' }}>{req.requestor?.full_name || 'Employee'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{req.requestor?.department}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>{req.primary_category} ➔ {req.secondary_category}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '600' }}>{formatCost(req)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{req.fulfillment_type || 'New Purchase'}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>{renderStatusBadge(req.status)}</td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.8rem' }}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* History Details & Action Log Drawer */}
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>Request Audit Log</h3>
              <button onClick={() => setSelectedRequest(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}>✕</button>
            </div>

            {loadingDetails ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: '#64748b' }}>Loading history log...</div>
            ) : (
              <div>
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '1rem', marginBottom: '0.25rem' }}>{requestDetails?.tracking_id}</div>
                  <div><strong>Requestor:</strong> {requestDetails?.requestor?.full_name} ({requestDetails?.requestor?.email})</div>
                  <div><strong>Designated Manager:</strong> {requestDetails?.designated_manager?.full_name || requestDetails?.requestor?.manager?.full_name || 'Line Manager'}</div>
                  <div><strong>Category:</strong> {requestDetails?.primary_category} ➔ {requestDetails?.secondary_category}</div>
                  <div><strong>Source / Cost:</strong> {requestDetails?.fulfillment_type} ({formatCost(requestDetails || {})})</div>
                  <div><strong>Status:</strong> {renderStatusBadge(requestDetails?.status)}</div>
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                    <strong>Justification:</strong> {requestDetails?.justification}
                  </div>
                </div>

                {isEditing ? (
                  <form onSubmit={handleEditSubmit} style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#fdfaee', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: '700', color: '#b45309' }}>Edit & Resubmit Request</h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Line Manager</label>
                      <select
                        value={editFormData.designated_manager_id}
                        onChange={(e) => setEditFormData({ ...editFormData, designated_manager_id: e.target.value })}
                        style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: 'white' }}
                      >
                        <option value="">-- Select Approver Manager --</option>
                        {managers.map(m => (
                          <option key={m.id} value={m.id}>{m.full_name} ({m.department || m.role?.role_name})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Fulfillment Source</label>
                      <select
                        value={editFormData.fulfillment_type}
                        onChange={(e) => setEditFormData({ ...editFormData, fulfillment_type: e.target.value })}
                        style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: 'white' }}
                      >
                        <option value="New Purchase">New Purchase</option>
                        <option value="Re-issue from Stock">Re-issue from Stock</option>
                      </select>
                    </div>

                    {editFormData.fulfillment_type !== 'Re-issue from Stock' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Currency</label>
                          <select
                            value={editFormData.currency}
                            onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                            style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: 'white' }}
                          >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="INR">INR (₹)</option>
                            <option value="AED">AED (AED)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Estimated Cost</label>
                          <input
                            type="number"
                            min="0"
                            value={editFormData.total_cost}
                            onChange={(e) => setEditFormData({ ...editFormData, total_cost: parseFloat(e.target.value) || 0 })}
                            style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Justification</label>
                      <textarea
                        value={editFormData.justification}
                        onChange={(e) => setEditFormData({ ...editFormData, justification: e.target.value })}
                        required
                        rows={3}
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="submit"
                        disabled={submittingEdit}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        {submittingEdit ? 'Resubmitting...' : 'Resubmit Ticket'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {/* Action buttons (Close ticket, Edit request) */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                      {requestDetails?.status === 'SentBack' && requestDetails.requestor?.id === authUser?.id && (
                        <button
                          onClick={startEditing}
                          style={{ flex: 1, padding: '0.6rem', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          ↩ Edit & Resubmit
                        </button>
                      )}
                      
                      {requestDetails?.status === 'Fulfilled' && requestDetails.requestor?.id === authUser?.id && (
                        <button
                          onClick={handleCloseRequest}
                          style={{ flex: 1, padding: '0.6rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          🔒 Close Request & Confirm Resolution
                        </button>
                      )}
                    </div>

                    {/* Comment Feed Input for requestor/agent */}
                    <form onSubmit={handlePostComment} style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: '700' }}>Provide Extra Information / Message</h4>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        required
                        placeholder="Add details, specify configuration requests, or reply to clarification requests..."
                        rows={2}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="submit"
                          disabled={postingComment}
                          style={{ flex: 1, padding: '0.5rem', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          {postingComment ? 'Posting...' : 'Post Message'}
                        </button>
                        {requestDetails?.status === 'SentBack' && requestDetails.requestor?.id === authUser?.id && (
                          <button
                            type="button"
                            onClick={handleSendClarification}
                            disabled={postingComment}
                            style={{ flex: 2, padding: '0.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                          >
                            {postingComment ? 'Sending...' : '💬 Send back to Approver'}
                          </button>
                        )}
                      </div>
                    </form>
                  </>
                )}

                {commentStatus && (
                  <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: commentStatus.includes('Error') ? '#fee2e2' : '#e0f2fe', color: commentStatus.includes('Error') ? '#b91c1c' : '#0369a1', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    {commentStatus}
                  </div>
                )}

                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>Historical Audit Trail</h4>

                <div className="timeline">
                  {/* Step 1: Submission */}
                  <div className="timeline-item">
                    <div className="timeline-point completed">✓</div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>Submitted by {requestDetails?.requestor?.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(requestDetails?.created_at).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Approval Logs */}
                  {requestDetails?.logs && requestDetails.logs.map((log, index) => (
                    <div className="timeline-item" key={log.id}>
                      <div className={`timeline-point ${log.action === 'Approve' ? 'completed' : 'active'}`}>
                        {log.action === 'Approve' ? '✓' : '✕'}
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>
                          Manager Action: <span style={{ color: log.action === 'Approve' ? '#16a34a' : '#dc2626' }}>{log.action}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>By {log.approver?.full_name} • {new Date(log.timestamp).toLocaleString()}</div>
                        {log.comments && (
                          <div style={{ marginTop: '0.25rem', padding: '0.4rem', backgroundColor: '#f1f5f9', borderRadius: '4px', fontStyle: 'italic', fontSize: '0.8rem' }}>
                            "{log.comments}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Work Updates */}
                  {requestDetails?.updates && requestDetails.updates.map(up => (
                    <div className="timeline-item" key={`up-${up.id}`}>
                      <div className="timeline-point active">🛠️</div>
                      <div style={{ fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: '600', color: '#2563eb' }}>Support Update: [{up.status}]</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>By {up.agent?.full_name || 'Support Agent'} • {new Date(up.timestamp).toLocaleString()}</div>
                        <div style={{ marginTop: '0.25rem', padding: '0.4rem', backgroundColor: '#eff6ff', borderRadius: '4px', fontSize: '0.8rem', color: '#1e40af' }}>
                          {up.note}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestHistory;
