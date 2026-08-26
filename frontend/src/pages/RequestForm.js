import React, { useState, useEffect } from 'react';
import { requestService, adminConfigService, userService } from '../services/api.service';
import { useUser } from '../UserContext';

const RequestForm = () => {
  const { currentUser } = useUser();
  const [categories, setCategories] = useState([]);
  const [managers, setManagers] = useState([]);
  const [primaryCategory, setPrimaryCategory] = useState('');
  const [secondaryCategory, setSecondaryCategory] = useState('');
  
  const [formData, setFormData] = useState({
    justification: '',
    urgency: 'Medium',
    total_cost: 0,
    currency: 'USD',
    fulfillment_type: 'New Purchase',
    designated_manager_id: currentUser?.manager?.id || '',
  });
  
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currencyOptions = [
    { code: 'USD', symbol: '$', label: 'USD ($)' },
    { code: 'EUR', symbol: '€', label: 'EUR (€)' },
    { code: 'GBP', symbol: '£', label: 'GBP (£)' },
    { code: 'INR', symbol: '₹', label: 'INR (₹)' },
    { code: 'AED', symbol: 'AED', label: 'AED (AED)' },
    { code: 'SAR', symbol: 'SAR', label: 'SAR (SAR)' },
  ];

  useEffect(() => {
    async function fetchData() {
      try {
        const [catData, userData] = await Promise.all([
          adminConfigService.getCategories(),
          userService.getUsers(),
        ]);
        setCategories(catData);
        
        // Filter potential managers / approvers
        const appUsers = userData.filter(u => u.role?.role_name === 'Approver' || u.role?.role_name === 'Super Admin' || u.role?.role_name === 'IT Agent');
        setManagers(appUsers);

        if (currentUser?.manager?.id) {
          setFormData(prev => ({ ...prev, designated_manager_id: currentUser.manager.id }));
        }
      } catch (err) {
        console.error('Error fetching initial data', err);
      }
    }
    fetchData();
  }, [currentUser]);

  const getPrimaryCategories = () => {
    return categories.filter(c => !c.parent && !c.parent_id);
  };

  const getSecondaryCategories = () => {
    if (!primaryCategory) return [];
    const pId = Number(primaryCategory);
    return categories.filter(c => {
      const parentId = c.parent?.id || c.parent_id;
      return Number(parentId) === pId;
    });
  };

  const handlePrimaryChange = (e) => {
    setPrimaryCategory(e.target.value);
    setSecondaryCategory('');
  };

  const handleSecondaryChange = (e) => {
    setSecondaryCategory(e.target.value);
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles([...files, ...selectedFiles]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!secondaryCategory) {
      alert('Please select a Secondary Category');
      return;
    }

    setStatus('');
    setSubmitting(true);

    try {
      const payload = {
        requestData: {
          category: { id: Number(secondaryCategory) },
          category_id: Number(secondaryCategory),
          justification: formData.justification,
          urgency: formData.urgency,
          total_cost: formData.fulfillment_type === 'Re-issue from Stock' ? 0 : Number(formData.total_cost),
          currency: formData.currency,
          fulfillment_type: formData.fulfillment_type,
          designated_manager_id: formData.designated_manager_id || null,
          requestor: { id: currentUser?.id },
        },
        fields: [
          { key: 'primary_category_id', value: primaryCategory },
          { key: 'secondary_category_id', value: secondaryCategory },
        ],
        attachments: files.map(f => ({ name: f.name, path: `/uploads/${f.name}`, type: f.type })),
      };

      const created = await requestService.createRequest(payload);
      setStatus(`Request submitted successfully! Tracking ID: ${created.tracking_id}`);
      
      // Reset form
      setPrimaryCategory('');
      setSecondaryCategory('');
      setFormData({
        justification: '',
        urgency: 'Medium',
        total_cost: 0,
        currency: 'USD',
        fulfillment_type: 'New Purchase',
        designated_manager_id: currentUser?.manager?.id || '',
      });
      setFiles([]);
    } catch (err) {
      setStatus('Error submitting request: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto' }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        padding: '2rem'
      }}>
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '700' }}>Submit New Request</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Select category, designated manager, fulfillment source, and details
          </p>
        </div>

        {/* User Context Banner */}
        <div style={{
          backgroundColor: '#f8fafc',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          fontSize: '0.875rem'
        }}>
          <div><strong>Requestor:</strong> {currentUser?.full_name || 'N/A'}</div>
          <div><strong>Email:</strong> {currentUser?.email || 'N/A'}</div>
          <div><strong>Department:</strong> {currentUser?.department || 'Operations'}</div>
          <div><strong>Assigned Line Manager:</strong> {currentUser?.manager?.full_name || 'Auto Routing'}</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Designated Manager Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Select Approving Line Manager</label>
            <select
              value={formData.designated_manager_id}
              onChange={(e) => setFormData({ ...formData, designated_manager_id: e.target.value })}
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                backgroundColor: 'white'
              }}
            >
              <option value="">-- Use Default Assigned Manager ({currentUser?.manager?.full_name || 'Department Manager'}) --</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name} ({m.department || m.role?.role_name}) - {m.email}</option>
              ))}
            </select>
          </div>

          {/* Primary Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Primary Request Category *</label>
            <select
              value={primaryCategory}
              onChange={handlePrimaryChange}
              required
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                backgroundColor: 'white'
              }}
            >
              <option value="">-- Select Primary Category --</option>
              {getPrimaryCategories().map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Secondary Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Secondary Category / Specific Item *</label>
            <select
              value={secondaryCategory}
              onChange={handleSecondaryChange}
              disabled={!primaryCategory}
              required
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                backgroundColor: primaryCategory ? 'white' : '#f1f5f9'
              }}
            >
              <option value="">{primaryCategory ? '-- Select Specific Requirement --' : 'Select Primary Category First'}</option>
              {getSecondaryCategories().map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Fulfillment Source Option */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Fulfillment Source / Asset Status</label>
            <select
              value={formData.fulfillment_type}
              onChange={(e) => setFormData({ ...formData, fulfillment_type: e.target.value })}
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                backgroundColor: 'white'
              }}
            >
              <option value="New Purchase">🛍️ New Purchase / Procured Expense Required</option>
              <option value="Re-issue from Stock">📦 Re-issue from Existing IT/Admin Stock (Zero New Cost)</option>
            </select>
          </div>

          {/* Justification */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Business Justification & Details *</label>
            <textarea
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              required
              placeholder="Provide context, specifications, or business justification..."
              rows={4}
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem'
              }}
            />
          </div>

          {/* Currency & Cost Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  backgroundColor: 'white'
                }}
              >
                {currencyOptions.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Estimated Cost</label>
              <input
                type="number"
                min="0"
                step="1"
                disabled={formData.fulfillment_type === 'Re-issue from Stock'}
                value={formData.fulfillment_type === 'Re-issue from Stock' ? 0 : formData.total_cost}
                onChange={(e) => setFormData({ ...formData, total_cost: parseFloat(e.target.value) || 0 })}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  backgroundColor: formData.fulfillment_type === 'Re-issue from Stock' ? '#f1f5f9' : 'white'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Urgency Level</label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  backgroundColor: 'white'
                }}
              >
                <option value="Low">🟢 Low</option>
                <option value="Medium">🟡 Medium</option>
                <option value="High">🟠 High</option>
                <option value="Critical">🔴 Critical</option>
              </select>
            </div>
          </div>

          {/* File Attachments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Attachments (Quotes / Specs / Screenshots)</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              style={{
                padding: '0.5rem',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                backgroundColor: '#f8fafc'
              }}
            />
            {files.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                Selected: {files.map(f => f.name).join(', ')}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '0.875rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
            }}
          >
            {submitting ? 'Submitting Request...' : 'Submit Workflow Request'}
          </button>
        </form>

        {status && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            borderRadius: '8px',
            backgroundColor: status.includes('Error') ? '#fee2e2' : '#dcfce7',
            color: status.includes('Error') ? '#b91c1c' : '#15803d',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestForm;
