import React, { useState, useEffect } from 'react';
import { adminConfigService, roleService } from '../services/api.service';

const AdminPortal = () => {
  const [categories, setCategories] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  
  // Category Modal/Form state
  const [newCatName, setNewCatName] = useState('');
  const [parentCatId, setParentCatId] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catData, roleData] = await Promise.all([
        adminConfigService.getCategories(),
        roleService.getRoles()
      ]);
      setCategories(catData);
      setRoles(roleData);
    } catch (err) {
      console.error('Error loading admin config data', err);
    } finally {
      setLoading(false);
    }
  };

  const primaryCategories = categories.filter(c => !c.parent && !c.parent_id);

  const getSubCategories = (parentId) => {
    return categories.filter(c => {
      const pId = c.parent?.id || c.parent_id;
      return Number(pId) === Number(parentId);
    });
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const payload = {
        name: newCatName.trim(),
        parent: parentCatId ? { id: Number(parentCatId) } : null,
      };

      if (editingCategory) {
        await adminConfigService.updateCategory(editingCategory.id, payload);
        setStatus('Category updated successfully!');
      } else {
        await adminConfigService.createCategory(payload);
        setStatus('Category created successfully!');
      }

      setNewCatName('');
      setParentCatId('');
      setEditingCategory(null);
      fetchData();
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Error saving category: ' + err.message);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await adminConfigService.deleteCategory(id);
      setStatus('Category deleted!');
      fetchData();
      if (selectedCategory?.id === id) setSelectedCategory(null);
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Error deleting category: ' + err.message);
    }
  };

  const handleSelectCategoryForWorkflow = async (category) => {
    setSelectedCategory(category);
    try {
      const steps = await adminConfigService.getWorkflow(category.id);
      setWorkflowSteps(steps.length > 0 ? steps : [
        { step_order: 1, approver_role: { id: 2 }, min_cost_threshold: 0, is_mandatory: true }
      ]);
    } catch (err) {
      console.error('Error fetching workflow steps', err);
    }
  };

  const handleAddWorkflowStep = () => {
    setWorkflowSteps([
      ...workflowSteps,
      {
        step_order: workflowSteps.length + 1,
        approver_role: { id: 2 },
        min_cost_threshold: 0,
        is_mandatory: true
      }
    ]);
  };

  const handleRemoveWorkflowStep = (index) => {
    const updated = workflowSteps.filter((_, i) => i !== index);
    setWorkflowSteps(updated.map((s, idx) => ({ ...s, step_order: idx + 1 })));
  };

  const handleSaveWorkflow = async () => {
    if (!selectedCategory) return;
    try {
      const payload = workflowSteps.map((step, idx) => ({
        step_order: idx + 1,
        approver_role: { id: Number(step.approver_role?.id || step.approver_role) },
        min_cost_threshold: Number(step.min_cost_threshold || 0),
        is_mandatory: step.is_mandatory !== false,
      }));

      await adminConfigService.setWorkflow(selectedCategory.id, payload);
      setStatus(`Workflow steps saved for ${selectedCategory.name}!`);
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Error saving workflow: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '700' }}>Categories & Workflow Steps Admin</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
          Configure Primary Categories, Sub-Categories, and Multi-Step Approval Workflows
        </p>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Category Hierarchy Manager */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
            {editingCategory ? 'Edit Category' : 'Add New Category'}
          </h3>

          <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Category Name *</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
                placeholder="e.g. IT Assets, Software License..."
                style={{ padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Parent Category (Leave empty for Primary)</label>
              <select
                value={parentCatId}
                onChange={(e) => setParentCatId(e.target.value)}
                style={{ padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
              >
                <option value="">-- None (Create Primary Category) --</option>
                {primaryCategories.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
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
                {editingCategory ? 'Update Category' : '+ Add Category'}
              </button>

              {editingCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setNewCatName('');
                    setParentCatId('');
                  }}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase' }}>Category Hierarchy Tree</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {primaryCategories.map(pCat => (
              <div key={pCat.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>📁 {pCat.name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleSelectCategoryForWorkflow(pCat)}
                      style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Workflow
                    </button>
                    <button
                      onClick={() => {
                        setEditingCategory(pCat);
                        setNewCatName(pCat.name);
                        setParentCatId('');
                      }}
                      style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(pCat.id)}
                      style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Subcategories */}
                <div style={{ padding: '0.5rem 1rem 0.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {getSubCategories(pCat.id).map(subCat => (
                    <div key={subCat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', padding: '0.375rem 0', borderBottom: '1px border #f1f5f9' }}>
                      <span>📄 {subCat.name}</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleSelectCategoryForWorkflow(subCat)}
                          style={{ fontSize: '0.75rem', padding: '2px 6px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Workflow
                        </button>
                        <button
                          onClick={() => {
                            setEditingCategory(subCat);
                            setNewCatName(subCat.name);
                            setParentCatId(pCat.id);
                          }}
                          style={{ fontSize: '0.75rem', padding: '2px 6px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(subCat.id)}
                          style={{ fontSize: '0.75rem', padding: '2px 6px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Mapping Configuration Panel */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
            {selectedCategory ? `Workflow Steps for "${selectedCategory.name}"` : 'Select a Category to Map Workflow'}
          </h3>

          {selectedCategory ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {workflowSteps.map((step, idx) => (
                <div key={idx} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', color: '#2563eb' }}>
                    <span>Step #{idx + 1}</span>
                    {workflowSteps.length > 1 && (
                      <button
                        onClick={() => handleRemoveWorkflowStep(idx)}
                        style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Remove Step
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>Required Approver Role</label>
                      <select
                        value={step.approver_role?.id || step.approver_role}
                        onChange={(e) => {
                          const updated = [...workflowSteps];
                          updated[idx].approver_role = { id: Number(e.target.value) };
                          setWorkflowSteps(updated);
                        }}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.role_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>Min Cost Threshold ($)</label>
                      <input
                        type="number"
                        min="0"
                        value={step.min_cost_threshold || 0}
                        onChange={(e) => {
                          const updated = [...workflowSteps];
                          updated[idx].min_cost_threshold = Number(e.target.value);
                          setWorkflowSteps(updated);
                        }}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  onClick={handleAddWorkflowStep}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  + Add Next Approval Step
                </button>

                <button
                  onClick={handleSaveWorkflow}
                  style={{
                    padding: '0.6rem 1.2rem',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  💾 Save Workflow Configuration
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚙️</div>
              <p>Click "Workflow" next to any category on the left to configure its multi-step approval rules.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
