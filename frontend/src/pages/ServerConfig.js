import React, { useState, useEffect } from 'react';
import { adminConfigService } from '../services/api.service';

const ServerConfig = () => {
  const [config, setConfig] = useState({
    systemName: 'Enterprise Workflow Engine',
    sessionTimeout: 60,
    maintenanceMode: false,
    ldapEnabled: true,
    ldapUrl: 'ldap://ad.company.local:389',
    ldapBaseDn: 'DC=company,DC=local',
    ldapBindDn: 'CN=Admin,DC=company,DC=local',
    ldapBindPassword: 'SecretPassword123',
    smtpHost: 'smtp.company.com',
    smtpPort: 587,
    smtpUser: 'notifications@company.com',
    smtpPassword: 'SmtpSecretPassword123',
    smtpProtocol: 'STARTTLS',
  });

  const [status, setStatus] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreFileContent, setRestoreFileContent] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await adminConfigService.getServerConfig();
      if (data) setConfig(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error('Error fetching server config', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await adminConfigService.saveServerConfig(config);
      setStatus('Server configuration saved successfully!');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Error saving server configuration: ' + err.message);
    }
  };

  const handleSyncLdap = async () => {
    setSyncing(true);
    setSyncStatus('Initiating Active Directory / LDAP synchronization...');
    try {
      const res = await adminConfigService.syncLdapUsers();
      setSyncStatus(res.message);
      setTimeout(() => setSyncStatus(''), 5000);
    } catch (err) {
      setSyncStatus('Error syncing AD users: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupStatus('Generating database backup snapshot...');
    try {
      const data = await adminConfigService.exportDatabaseBackup();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `workflow_db_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupStatus('Database backup snapshot downloaded successfully!');
      setTimeout(() => setBackupStatus(''), 4000);
    } catch (err) {
      setBackupStatus('Error generating backup: ' + err.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setRestoreFileContent(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFileContent) {
      alert('Please select a valid JSON backup file first.');
      return;
    }

    if (!window.confirm('CAUTION: Restoring a database backup will overwrite existing records. Are you sure you want to proceed with database restoration?')) {
      return;
    }

    setRestoring(true);
    setBackupStatus('Executing database restoration...');
    try {
      const parsed = JSON.parse(restoreFileContent);
      const res = await adminConfigService.restoreDatabaseBackup(parsed);
      setBackupStatus(res.message);
      setTimeout(() => setBackupStatus(''), 6000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setBackupStatus('Restore failed: ' + msg);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '700' }}>Super Admin Server & Database Control</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
          Manage system configuration, SMTP settings, Active Directory sync, and Database Backup/Restore
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

      {syncStatus && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: syncStatus.includes('Error') ? '#fee2e2' : '#e0f2fe',
          color: syncStatus.includes('Error') ? '#b91c1c' : '#0369a1',
          fontWeight: '600',
          marginBottom: '1.5rem'
        }}>
          {syncStatus}
        </div>
      )}

      {backupStatus && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: backupStatus.includes('failed') || backupStatus.includes('Error') ? '#fee2e2' : '#dcfce7',
          color: backupStatus.includes('failed') || backupStatus.includes('Error') ? '#b91c1c' : '#15803d',
          fontWeight: '600',
          marginBottom: '1.5rem'
        }}>
          {backupStatus}
        </div>
      )}

      {/* Database Backup & Restore Card */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
          💾 Database Backup & Disaster Recovery
        </h3>
        <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
          Export system-wide database snapshots (users, roles, categories, requests, workflows, and logs) or restore from a previous backup file.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {/* Download Backup Section */}
          <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#0f172a', fontWeight: '700' }}>⬇️ Export Database Backup</h4>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                Download complete database state in JSON snapshot format for offsite backup.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadBackup}
              style={{
                padding: '0.75rem',
                backgroundColor: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              📥 Download Backup File (.json)
            </button>
          </div>

          {/* Restore Backup Section */}
          <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#0f172a', fontWeight: '700' }}>📤 Restore Database</h4>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                Select a previously exported `.json` database backup file to restore.
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}
              />
              {selectedFileName && (
                <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '600' }}>
                  Selected File: {selectedFileName}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleRestoreBackup}
              disabled={!restoreFileContent || restoring}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: (!restoreFileContent || restoring) ? '#94a3b8' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: (!restoreFileContent || restoring) ? 'not-allowed' : 'pointer'
              }}
            >
              {restoring ? 'Restoring Database...' : '⚠️ Execute Database Restore'}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* System Settings Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>⚙️ General System Settings</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>System Name</label>
              <input
                type="text"
                value={config.systemName}
                onChange={(e) => setConfig({ ...config, systemName: e.target.value })}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Session Timeout (Minutes)</label>
              <input
                type="number"
                value={config.sessionTimeout}
                onChange={(e) => setConfig({ ...config, sessionTimeout: Number(e.target.value) })}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="maintenanceMode"
              checked={config.maintenanceMode}
              onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })}
              style={{ width: '1rem', height: '1rem' }}
            />
            <label htmlFor="maintenanceMode" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#334155' }}>
              Enable System Maintenance Mode (Restricts portal access to Super Admins)
            </label>
          </div>
        </div>

        {/* Active Directory LDAP Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>🛡️ Active Directory / LDAP Sync & Auth</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={config.ldapEnabled}
                onChange={(e) => setConfig({ ...config, ldapEnabled: e.target.checked })}
              />
              Enable AD Auth & User Sync
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Server LDAP URL</label>
              <input
                type="text"
                value={config.ldapUrl}
                onChange={(e) => setConfig({ ...config, ldapUrl: e.target.value })}
                disabled={!config.ldapEnabled}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: config.ldapEnabled ? 'white' : '#f1f5f9' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Base DN</label>
              <input
                type="text"
                value={config.ldapBaseDn}
                onChange={(e) => setConfig({ ...config, ldapBaseDn: e.target.value })}
                disabled={!config.ldapEnabled}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: config.ldapEnabled ? 'white' : '#f1f5f9' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Bind DN User</label>
              <input
                type="text"
                value={config.ldapBindDn}
                onChange={(e) => setConfig({ ...config, ldapBindDn: e.target.value })}
                disabled={!config.ldapEnabled}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: config.ldapEnabled ? 'white' : '#f1f5f9' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Bind Password</label>
              <input
                type="password"
                value={config.ldapBindPassword}
                onChange={(e) => setConfig({ ...config, ldapBindPassword: e.target.value })}
                disabled={!config.ldapEnabled}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: config.ldapEnabled ? 'white' : '#f1f5f9' }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncLdap}
            disabled={!config.ldapEnabled || syncing}
            style={{
              padding: '0.6rem 1.2rem',
              backgroundColor: '#0284c7',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: (!config.ldapEnabled || syncing) ? 'not-allowed' : 'pointer'
            }}
          >
            {syncing ? 'Synchronizing AD Users...' : '🔄 Sync Users from Active Directory Now'}
          </button>
        </div>

        {/* Email SMTP Settings */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>📧 Email Notification (SMTP) Configuration</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>SMTP Server Host</label>
              <input
                type="text"
                value={config.smtpHost}
                onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>SMTP Port</label>
              <input
                type="number"
                value={config.smtpPort}
                onChange={(e) => setConfig({ ...config, smtpPort: Number(e.target.value) })}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>SMTP Username / Sender Email</label>
              <input
                type="text"
                value={config.smtpUser}
                onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>SMTP Auth Password</label>
              <input
                type="password"
                value={config.smtpPassword}
                onChange={(e) => setConfig({ ...config, smtpPassword: e.target.value })}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Security Protocol</label>
              <select
                value={config.smtpProtocol}
                onChange={(e) => setConfig({ ...config, smtpProtocol: e.target.value })}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
              >
                <option value="STARTTLS">STARTTLS (TLS on port 587 - Recommended)</option>
                <option value="SSL/TLS">SSL / TLS (Implicit SSL on port 465)</option>
                <option value="None">None (Unencrypted on port 25)</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          style={{
            padding: '0.875rem',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
          }}
        >
          Save All Server Settings
        </button>
      </form>
    </div>
  );
};

export default ServerConfig;
