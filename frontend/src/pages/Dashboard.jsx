import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWorkspaces, createWorkspace } from '../api/endpoints';
import { Plus, Users, Calendar, FolderKanban } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await getWorkspaces();
      setWorkspaces(res.data);
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await createWorkspace({ name: newName, description: newDesc });
      setWorkspaces([...workspaces, res.data]);
      setShowCreateModal(false);
      setNewName('');
      setNewDesc('');
    } catch (err) {
      console.error('Failed to create workspace:', err);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading workspaces...</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="dashboard-header">
        <div>
          <h1>Welcome, {user?.display_name || 'User'} 👋</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.9rem' }}>
            Manage your workspaces and collaborate with your team
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} />
          New Workspace
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <h3>No workspaces yet</h3>
          <p>Create your first workspace to start managing tasks with your team</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} />
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="workspace-grid">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="card card-glow workspace-card"
              onClick={() => navigate(`/board/${ws.id}`)}
            >
              <h3>{ws.name}</h3>
              <p>{ws.description || 'No description'}</p>
              <div className="workspace-card-footer">
                <div className="meta">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={14} />
                    {ws.member_count || 1} members
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={14} />
                    {formatDate(ws.created_at)}
                  </span>
                </div>
                <span className={`badge badge-${ws.my_role}`}>{ws.my_role}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Workspace</h2>
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label>Workspace Name</label>
                  <input
                    className="input"
                    placeholder="e.g., Marketing Team"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label>Description (optional)</label>
                  <textarea
                    className="input"
                    placeholder="What is this workspace for?"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  <FolderKanban size={16} />
                  {creating ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
