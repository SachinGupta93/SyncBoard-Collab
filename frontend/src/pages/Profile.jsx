import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { updateProfile } from '../api/endpoints';
import { User, Mail, Calendar, Save } from 'lucide-react';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const res = await updateProfile({ display_name: displayName.trim() });
      updateUser(res.data);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div className="page-enter" style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 32 }}>Profile Settings</h1>

      <div className="card" style={{ marginBottom: 24, textAlign: 'center', padding: '40px 24px' }}>
        <div className="avatar avatar-lg" style={{ margin: '0 auto 16px', width: 80, height: 80, fontSize: '1.5rem' }}>
          {getInitials(user?.display_name)}
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{user?.display_name}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>{user?.email}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            <Calendar size={14} /> Joined {user?.created_at ? formatDate(user.created_at) : 'Unknown'}
          </span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={18} /> Edit Profile
        </h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label>Display Name</label>
              <input className="input" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} required minLength={1} maxLength={100} />
            </div>
            <div className="input-group">
              <label>Email</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <Mail size={16} /> {user?.email}
                <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Verified</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-primary)' }}>
            <button type="submit" className="btn btn-primary" disabled={saving || displayName === user?.display_name}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
