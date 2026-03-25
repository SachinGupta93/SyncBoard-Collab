import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  getTasks,
  createTask,
  updateTask,
  moveTask as moveTaskAPI,
  deleteTask,
  getWorkspace,
  getMembers,
  getWorkspaceActivity,
} from '../api/endpoints';
import {
  Plus,
  ArrowLeft,
  Trash2,
  Edit3,
  Clock,
  User,
  Activity,
  Users,
  GripVertical,
} from 'lucide-react';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'var(--col-todo)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--col-in-progress)' },
  { id: 'review', label: 'Review', color: 'var(--col-review)' },
  { id: 'done', label: 'Done', color: 'var(--col-done)' },
];

export default function Board() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [workspace, setWorkspace] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState(null);

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'todo',
    assigned_to: '',
  });

  // Side panel
  const [sidePanel, setSidePanel] = useState(null); // 'members' | 'activity' | null

  // Drag state
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // WebSocket handler
  const handleWSMessage = useCallback((data) => {
    if (data.type === 'task_update') {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === data.task.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data.task;
          return updated;
        }
        return [...prev, data.task];
      });
    } else if (data.type === 'task_created') {
      setTasks((prev) => [...prev, data.task]);
    } else if (data.type === 'task_deleted') {
      setTasks((prev) => prev.filter((t) => t.id !== data.task_id));
    }
  }, []);

  const { isConnected, onlineUsers } = useWebSocket(workspaceId, token, handleWSMessage);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wsRes, tasksRes, membersRes, actRes] = await Promise.all([
          getWorkspace(workspaceId),
          getTasks(workspaceId),
          getMembers(workspaceId),
          getWorkspaceActivity(workspaceId, 30),
        ]);
        setWorkspace(wsRes.data);
        setTasks(tasksRes.data);
        setMembers(membersRes.data);
        setActivity(actRes.data);
        setMyRole(wsRes.data.my_role);
      } catch (err) {
        console.error('Failed to load board:', err);
        if (err.response?.status === 403) navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workspaceId, navigate]);

  const canEdit = myRole === 'admin' || myRole === 'editor';

  // Task CRUD
  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await createTask(workspaceId, {
        ...taskForm,
        assigned_to: taskForm.assigned_to || null,
      });
      setTasks([...tasks, res.data]);
      setShowTaskModal(false);
      resetTaskForm();
    } catch (err) {
      console.error('Failed to create task:', err);
      alert(err.response?.data?.detail || 'Failed to create task');
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await updateTask(editingTask.id, {
        ...taskForm,
        assigned_to: taskForm.assigned_to || null,
        version: editingTask.version,
      });
      setTasks(tasks.map((t) => (t.id === res.data.id ? res.data : t)));
      setShowTaskModal(false);
      setEditingTask(null);
      resetTaskForm();
    } catch (err) {
      if (err.response?.status === 409) {
        alert('Conflict: This task was modified by another user. Refreshing...');
        const tasksRes = await getTasks(workspaceId);
        setTasks(tasksRes.data);
      } else {
        alert(err.response?.data?.detail || 'Failed to update task');
      }
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(taskId);
      setTasks(tasks.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const resetTaskForm = () => {
    setTaskForm({ title: '', description: '', status: 'todo', assigned_to: '' });
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      assigned_to: task.assigned_to || '',
    });
    setShowTaskModal(true);
  };

  const openCreateModal = (status = 'todo') => {
    setEditingTask(null);
    setTaskForm({ title: '', description: '', status, assigned_to: '' });
    setShowTaskModal(true);
  };

  // Drag & Drop (native HTML5 DnD)
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedTask || draggedTask.status === columnId) return;

    // Optimistic update
    const oldTasks = [...tasks];
    setTasks(
      tasks.map((t) =>
        t.id === draggedTask.id ? { ...t, status: columnId } : t
      )
    );

    try {
      const res = await moveTaskAPI(draggedTask.id, {
        status: columnId,
        position: 0,
        version: draggedTask.version,
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === res.data.id ? res.data : t))
      );
    } catch (err) {
      // Rollback on error
      setTasks(oldTasks);
      if (err.response?.status === 409) {
        alert('Conflict: Refreshing board...');
        const tasksRes = await getTasks(workspaceId);
        setTasks(tasksRes.data);
      }
    }
  };

  const getTasksByStatus = (status) =>
    tasks.filter((t) => t.status === status);

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading board...</p>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ height: '100%' }}>
      {/* Board Header */}
      <div className="board-header">
        <div className="board-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} />
          </button>
          <h1>{workspace?.name || 'Board'}</h1>
          <span className={`badge badge-${myRole}`}>{myRole}</span>
        </div>
        <div className="board-header-right">
          <div className="connection-indicator">
            <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
            {isConnected ? 'Live' : 'Connecting...'}
          </div>

          {onlineUsers.length > 0 && (
            <div className="online-avatars avatar-stack">
              {onlineUsers.slice(0, 5).map((u) => (
                <div key={u.user_id} className="avatar avatar-sm" title={u.display_name}>
                  {getInitials(u.display_name)}
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <div className="avatar avatar-sm" style={{ background: 'var(--bg-tertiary)' }}>
                  +{onlineUsers.length - 5}
                </div>
              )}
            </div>
          )}

          <button
            className={`btn btn-ghost ${sidePanel === 'members' ? 'active' : ''}`}
            onClick={() => setSidePanel(sidePanel === 'members' ? null : 'members')}
            title="Members"
          >
            <Users size={18} />
          </button>
          <button
            className={`btn btn-ghost ${sidePanel === 'activity' ? 'active' : ''}`}
            onClick={() => setSidePanel(sidePanel === 'activity' ? null : 'activity')}
            title="Activity"
          >
            <Activity size={18} />
          </button>

          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={() => openCreateModal()}>
              <Plus size={16} />
              Add Task
            </button>
          )}
        </div>
      </div>

      {/* Main board area with optional side panel */}
      <div style={{ display: 'flex', gap: 20, overflow: 'hidden' }}>
        {/* Kanban Columns */}
        <div className="kanban-container" style={{ flex: 1 }}>
          {COLUMNS.map((col) => {
            const colTasks = getTasksByStatus(col.id);
            return (
              <div
                key={col.id}
                className="kanban-column"
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="column-header">
                  <div className="column-header-left">
                    <div className="column-dot" style={{ background: col.color }}></div>
                    <h3>{col.label}</h3>
                    <span className="column-count">{colTasks.length}</span>
                  </div>
                  {canEdit && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openCreateModal(col.id)}
                      title={`Add to ${col.label}`}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
                <div
                  className={`column-tasks ${dragOverColumn === col.id ? 'drag-over' : ''}`}
                >
                  {colTasks.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                      No tasks
                    </div>
                  )}
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="task-card"
                      draggable={canEdit}
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                    >
                      {canEdit && (
                        <div style={{ position: 'absolute', top: 8, left: 6, color: 'var(--text-tertiary)', opacity: 0.3 }}>
                          <GripVertical size={14} />
                        </div>
                      )}
                      <h4>{task.title}</h4>
                      {task.description && (
                        <p className="task-desc">{task.description}</p>
                      )}
                      <div className="task-card-footer">
                        <div className="task-meta">
                          {task.assignee_name && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <User size={12} />
                              {task.assignee_name}
                            </span>
                          )}
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={12} />
                            {timeAgo(task.updated_at)}
                          </span>
                        </div>
                        {canEdit && (
                          <div className="task-card-actions">
                            <button onClick={() => openEditModal(task)} title="Edit">
                              <Edit3 size={12} />
                            </button>
                            <button onClick={() => handleDeleteTask(task.id)} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Side Panel */}
        {sidePanel && (
          <div
            style={{
              width: 320,
              flexShrink: 0,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              maxHeight: 'calc(100vh - 180px)',
              overflowY: 'auto',
              animation: 'slideInRight 0.3s ease',
            }}
          >
            {sidePanel === 'members' && (
              <>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>
                  Members ({members.length})
                </h3>
                <div className="members-list">
                  {members.map((m) => {
                    const isOnline = onlineUsers.some(
                      (u) => u.user_id === String(m.user_id)
                    );
                    return (
                      <div key={m.user_id} className="member-item">
                        <div style={{ position: 'relative' }}>
                          <div className="avatar avatar-sm">
                            {getInitials(m.user_display_name)}
                          </div>
                          <span
                            className={`status-dot ${isOnline ? 'online' : 'offline'}`}
                            style={{
                              position: 'absolute',
                              bottom: -1,
                              right: -1,
                              border: '2px solid var(--bg-secondary)',
                            }}
                          ></span>
                        </div>
                        <div className="member-info">
                          <h4>{m.user_display_name}</h4>
                          <p>{m.user_email}</p>
                        </div>
                        <span className={`badge badge-${m.role}`}>{m.role}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {sidePanel === 'activity' && (
              <>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>
                  Recent Activity
                </h3>
                <div className="activity-feed">
                  {activity.length === 0 && (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      No activity yet
                    </p>
                  )}
                  {activity.map((a) => (
                    <div key={a.id} className="activity-item">
                      <div className="avatar avatar-sm">
                        {getInitials(a.user_display_name)}
                      </div>
                      <div className="activity-text">
                        <strong>{a.user_display_name}</strong>{' '}
                        {a.action_type.replace(/_/g, ' ')}
                        {a.task_title && (
                          <> — <em>{a.task_title}</em></>
                        )}
                        <div className="activity-time">{timeAgo(a.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => { setShowTaskModal(false); setEditingTask(null); resetTaskForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTask ? 'Edit Task' : 'Create Task'}</h2>
              <button
                className="btn btn-ghost"
                onClick={() => { setShowTaskModal(false); setEditingTask(null); resetTaskForm(); }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label>Title</label>
                  <input
                    className="input"
                    placeholder="Task title"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label>Description</label>
                  <textarea
                    className="input"
                    placeholder="Describe the task..."
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Status</label>
                    <select
                      className="input"
                      value={taskForm.status}
                      onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    >
                      {COLUMNS.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Assign to</label>
                    <select
                      className="input"
                      value={taskForm.assigned_to}
                      onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowTaskModal(false); setEditingTask(null); resetTaskForm(); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
