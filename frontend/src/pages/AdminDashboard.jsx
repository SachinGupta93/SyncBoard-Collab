import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getWorkspace,
  getMembers,
  addMember,
  updateMemberRole,
  removeMember,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceActivity,
  getAdminStats,
  createInvite,
  getInvites,
  revokeInvite,
} from '../api/endpoints';
import {
  ArrowLeft,
  Settings,
  Users,
  Activity,
  BarChart3,
  UserPlus,
  Trash2,
  Edit3,
  Save,
  X,
  Shield,
  Eye,
  Pencil,
  CheckCircle,
  Clock,
  ListTodo,
  AlertCircle,
  Link2,
  Copy,
  Mail,
} from 'lucide-react';

export default function AdminDashboard() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Edit workspace state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');
  const [addingMember, setAddingMember] = useState(false);

  // Invite state
  const [invites, setInvites] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    try {
      const [wsRes, membersRes, activityRes, statsRes] = await Promise.all([
        getWorkspace(workspaceId),
        getMembers(workspaceId),
        getWorkspaceActivity(workspaceId, 50),
        getAdminStats(workspaceId),
      ]);

      if (wsRes.data.my_role !== 'admin') {
        navigate(`/board/${workspaceId}`);
        return;
      }

      setWorkspace(wsRes.data);
      setMembers(membersRes.data);
      setActivity(activityRes.data);
      setStats(statsRes.data);
      setEditForm({
        name: wsRes.data.name,
        description: wsRes.data.description || '',
      });

      // Load invites
      try {
        const invRes = await getInvites(workspaceId);
        setInvites(invRes.data);
      } catch { /* invites may not be available */ }
    } catch (err) {
      toast.error('Failed to load admin dashboard');
      if (err.response?.status === 403) {
        navigate(`/board/${workspaceId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWorkspace = async (e) => {
    e.preventDefault();
    try {
      const res = await updateWorkspace(workspaceId, editForm);
      setWorkspace({ ...workspace, ...res.data });
      setIsEditing(false);
      toast.success('Workspace updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update workspace');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (deleteConfirmText !== workspace.name) return;
    try {
      await deleteWorkspace(workspaceId);
      toast.success('Workspace deleted');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete workspace');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setAddingMember(true);
    try {
      await addMember(workspaceId, { email: newMemberEmail, role: newMemberRole });
      const res = await getMembers(workspaceId);
      setMembers(res.data);
      setShowAddMember(false);
      setNewMemberEmail('');
      setNewMemberRole('viewer');
      toast.success('Member added successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await updateMemberRole(workspaceId, userId, { role: newRole });
      setMembers(members.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m)));
      toast.success('Role updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId, displayName) => {
    if (!confirm(`Remove ${displayName} from this workspace?`)) return;
    try {
      await removeMember(workspaceId, userId);
      setMembers(members.filter((m) => m.user_id !== userId));
      toast.success(`${displayName} removed from workspace`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove member');
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const timeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield size={14} />;
      case 'editor':
        return <Pencil size={14} />;
      default:
        return <Eye size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-left">
          <button className="btn btn-ghost" onClick={() => navigate(`/board/${workspaceId}`)}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Admin Dashboard</h1>
            <p className="admin-subtitle">{workspace?.name}</p>
          </div>
        </div>
        <span className="badge badge-admin">Admin</span>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={16} />
          Overview
        </button>
        <button
          className={`admin-tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <Users size={16} />
          Members
        </button>
        <button
          className={`admin-tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Activity size={16} />
          Activity
        </button>
        <button
          className={`admin-tab ${activeTab === 'invites' ? 'active' : ''}`}
          onClick={() => setActiveTab('invites')}
        >
          <Mail size={16} />
          Invites
          {invites.filter(i => i.status === 'pending').length > 0 && (
            <span className="filter-badge">{invites.filter(i => i.status === 'pending').length}</span>
          )}
        </button>
        <button
          className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="admin-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="admin-overview">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                  <Users size={24} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div className="stat-info">
                  <h3>{stats.stats.member_count}</h3>
                  <p>Total Members</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                  <ListTodo size={24} style={{ color: 'var(--accent-success)' }} />
                </div>
                <div className="stat-info">
                  <h3>{stats.stats.total_tasks}</h3>
                  <p>Total Tasks</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                  <Activity size={24} style={{ color: 'var(--accent-warning)' }} />
                </div>
                <div className="stat-info">
                  <h3>{stats.stats.recent_activity_count}</h3>
                  <p>Activities (7 days)</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                  <CheckCircle size={24} style={{ color: 'var(--accent-secondary)' }} />
                </div>
                <div className="stat-info">
                  <h3>{stats.stats.tasks_by_status.done}</h3>
                  <p>Completed Tasks</p>
                </div>
              </div>
            </div>

            <div className="overview-grid">
              {/* Task Distribution */}
              <div className="card">
                <h3 style={{ marginBottom: 20, fontWeight: 700 }}>Task Distribution</h3>
                <div className="task-distribution">
                  {[
                    { key: 'todo', label: 'To Do', color: 'var(--col-todo)' },
                    { key: 'in_progress', label: 'In Progress', color: 'var(--col-in-progress)' },
                    { key: 'review', label: 'Review', color: 'var(--col-review)' },
                    { key: 'done', label: 'Done', color: 'var(--col-done)' },
                  ].map((status) => {
                    const count = stats.stats.tasks_by_status[status.key] || 0;
                    const percentage = stats.stats.total_tasks > 0
                      ? Math.round((count / stats.stats.total_tasks) * 100)
                      : 0;
                    return (
                      <div key={status.key} className="distribution-row">
                        <div className="distribution-label">
                          <span className="distribution-dot" style={{ background: status.color }}></span>
                          {status.label}
                        </div>
                        <div className="distribution-bar-container">
                          <div
                            className="distribution-bar"
                            style={{ width: `${percentage}%`, background: status.color }}
                          ></div>
                        </div>
                        <span className="distribution-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Role Distribution */}
              <div className="card">
                <h3 style={{ marginBottom: 20, fontWeight: 700 }}>Team Roles</h3>
                <div className="role-distribution">
                  {[
                    { key: 'admin', label: 'Admins', icon: Shield },
                    { key: 'editor', label: 'Editors', icon: Pencil },
                    { key: 'viewer', label: 'Viewers', icon: Eye },
                  ].map((role) => {
                    const count = stats.stats.role_breakdown[role.key] || 0;
                    const Icon = role.icon;
                    return (
                      <div key={role.key} className="role-row">
                        <div className="role-info">
                          <span className={`badge badge-${role.key}`}>
                            <Icon size={12} />
                            {role.label}
                          </span>
                        </div>
                        <span className="role-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="admin-members">
            <div className="members-header">
              <h2>Team Members ({members.length})</h2>
              <button className="btn btn-primary" onClick={() => setShowAddMember(true)}>
                <UserPlus size={16} />
                Add Member
              </button>
            </div>

            <div className="members-table">
              <div className="table-header">
                <span>Member</span>
                <span>Role</span>
                <span>Joined</span>
                <span>Actions</span>
              </div>
              {members.map((member) => (
                <div key={member.user_id} className="table-row">
                  <div className="member-cell">
                    <div className="avatar avatar-sm">{getInitials(member.user_display_name)}</div>
                    <div>
                      <h4>{member.user_display_name}</h4>
                      <p>{member.user_email}</p>
                    </div>
                  </div>
                  <div className="role-cell">
                    <select
                      className="input role-select"
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                      disabled={workspace?.owner_id === member.user_id}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="date-cell">{formatDate(member.joined_at)}</div>
                  <div className="actions-cell">
                    {workspace?.owner_id !== member.user_id && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRemoveMember(member.user_id, member.user_display_name)}
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {workspace?.owner_id === member.user_id && (
                      <span className="owner-badge">Owner</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="admin-activity">
            <h2 style={{ marginBottom: 20 }}>Recent Activity</h2>
            <div className="activity-feed">
              {activity.length === 0 && (
                <p style={{ color: 'var(--text-tertiary)' }}>No activity recorded yet.</p>
              )}
              {activity.map((a) => (
                <div key={a.id} className="activity-item">
                  <div className="avatar avatar-sm">{getInitials(a.user_display_name)}</div>
                  <div className="activity-text">
                    <strong>{a.user_display_name}</strong> {a.action_type.replace(/_/g, ' ')}
                    {a.task_title && (
                      <>
                        {' '}&mdash; <em>{a.task_title}</em>
                      </>
                    )}
                    <div className="activity-time">{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="admin-settings">
            <div className="settings-section">
              <h2>Workspace Settings</h2>
              <p className="settings-desc">Manage your workspace name and description.</p>

              {!isEditing ? (
                <div className="card settings-card">
                  <div className="settings-info">
                    <div>
                      <label>Name</label>
                      <p>{workspace?.name}</p>
                    </div>
                    <div>
                      <label>Description</label>
                      <p>{workspace?.description || 'No description'}</p>
                    </div>
                    <div>
                      <label>Created</label>
                      <p>{formatDate(workspace?.created_at)}</p>
                    </div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                    <Edit3 size={16} />
                    Edit
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUpdateWorkspace} className="card settings-card">
                  <div className="settings-form">
                    <div className="input-group">
                      <label>Workspace Name</label>
                      <input
                        className="input"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="input-group">
                      <label>Description</label>
                      <textarea
                        className="input"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="settings-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setIsEditing(false)}>
                      <X size={16} />
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <Save size={16} />
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="settings-section danger-zone">
              <h2>
                <AlertCircle size={20} />
                Danger Zone
              </h2>
              <p className="settings-desc">
                Permanently delete this workspace and all its data. This action cannot be undone.
              </p>
              <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} />
                Delete Workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Team Member</h2>
              <button className="btn btn-ghost" onClick={() => setShowAddMember(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddMember}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label>Email Address</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="teammate@example.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label>Role</label>
                  <select
                    className="input"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                  >
                    <option value="admin">Admin - Full access</option>
                    <option value="editor">Editor - Can edit tasks</option>
                    <option value="viewer">Viewer - Read only</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMember(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addingMember}>
                  <UserPlus size={16} />
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}

      {/* Invites Tab Content */}
      {activeTab === 'invites' && (
        <div>
          <div className="members-header">
            <h2>Invitations ({invites.length})</h2>
            <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
              <Mail size={16} /> Send Invite
            </button>
          </div>

          {invites.length === 0 ? (
            <div className="empty-state">
              <div className="icon">✉️</div>
              <h3>No invites sent yet</h3>
              <p>Send invite links to bring teammates into this workspace</p>
            </div>
          ) : (
            <div className="activity-feed">
              {invites.map((inv) => {
                const inviteUrl = `${window.location.origin}/invite/${inv.token}`;
                return (
                  <div key={inv.id} className="activity-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="avatar avatar-sm">
                        <Mail size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong>{inv.email}</strong>
                        <span className={`badge badge-${inv.role}`} style={{ marginLeft: 8 }}>{inv.role}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {inv.status === 'pending' ? 'Pending' : inv.status === 'accepted' ? '✓ Accepted' : inv.status}
                        </div>
                      </div>
                      {inv.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" title="Copy invite link"
                            onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success('Invite link copied!'); }}>
                            <Copy size={14} />
                          </button>
                          <button className="btn btn-ghost btn-sm" title="Revoke invite"
                            onClick={async () => { await revokeInvite(inv.id); setInvites(invites.filter(i => i.id !== inv.id)); toast.info('Invite revoked'); }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {inv.status === 'pending' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        <Link2 size={12} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteUrl}</span>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                          onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success('Link copied!'); }}>
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Send Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Send Invite</h2>
              <button className="btn btn-ghost" onClick={() => setShowInviteModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSendingInvite(true);
              try {
                const res = await createInvite(workspaceId, { email: inviteEmail, role: inviteRole });
                setInvites([res.data, ...invites]);
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteRole('viewer');
                const inviteUrl = `${window.location.origin}/invite/${res.data.token}`;
                navigator.clipboard.writeText(inviteUrl);
                toast.success('Invite created! Link copied to clipboard');
              } catch (err) {
                toast.error(err.response?.data?.detail || 'Failed to send invite');
              } finally {
                setSendingInvite(false);
              }
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label>Email Address</label>
                  <input className="input" type="email" placeholder="teammate@example.com"
                    value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required autoFocus />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    We'll save this email so you can send invitations later
                  </span>
                </div>
                <div className="input-group">
                  <label>Role</label>
                  <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="admin">Admin - Full access</option>
                    <option value="editor">Editor - Can edit tasks</option>
                    <option value="viewer">Viewer - Read only</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={sendingInvite}>
                  <Mail size={16} /> {sendingInvite ? 'Sending...' : 'Create Invite Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ color: 'var(--accent-danger)' }}>Delete Workspace</h2>
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                This will permanently delete <strong>{workspace?.name}</strong> and all its tasks,
                members, and activity history. This action cannot be undone.
              </p>
              <div className="input-group">
                <label>Type "{workspace?.name}" to confirm</label>
                <input
                  className="input"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={workspace?.name}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteWorkspace}
                disabled={deleteConfirmText !== workspace?.name}
              >
                <Trash2 size={16} />
                Delete Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
