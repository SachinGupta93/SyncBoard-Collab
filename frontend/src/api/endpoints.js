import api from './axios';

// Auth
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

// Workspaces
export const getWorkspaces = () => api.get('/workspaces');
export const createWorkspace = (data) => api.post('/workspaces', data);
export const getWorkspace = (id) => api.get(`/workspaces/${id}`);
export const updateWorkspace = (id, data) => api.put(`/workspaces/${id}`, data);
export const deleteWorkspace = (id) => api.delete(`/workspaces/${id}`);

// Members
export const getMembers = (workspaceId) => api.get(`/workspaces/${workspaceId}/members`);
export const addMember = (workspaceId, data) => api.post(`/workspaces/${workspaceId}/members`, data);
export const updateMemberRole = (workspaceId, userId, data) =>
  api.put(`/workspaces/${workspaceId}/members/${userId}`, data);
export const removeMember = (workspaceId, userId) =>
  api.delete(`/workspaces/${workspaceId}/members/${userId}`);

// Tasks
export const getTasks = (workspaceId, status) => {
  const params = status ? { status } : {};
  return api.get(`/workspaces/${workspaceId}/tasks`, { params });
};
export const createTask = (workspaceId, data) =>
  api.post(`/workspaces/${workspaceId}/tasks`, data);
export const getTask = (taskId) => api.get(`/tasks/${taskId}`);
export const updateTask = (taskId, data) => api.put(`/tasks/${taskId}`, data);
export const moveTask = (taskId, data) => api.patch(`/tasks/${taskId}/move`, data);
export const deleteTask = (taskId) => api.delete(`/tasks/${taskId}`);

// Activity
export const getWorkspaceActivity = (workspaceId, limit = 50, offset = 0) =>
  api.get(`/workspaces/${workspaceId}/activity`, { params: { limit, offset } });
export const getTaskActivity = (taskId, limit = 50) =>
  api.get(`/tasks/${taskId}/activity`, { params: { limit } });

// Admin
export const getAdminStats = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/admin/stats`);

// Comments
export const getComments = (taskId) => api.get(`/tasks/${taskId}/comments`);
export const addComment = (taskId, data) => api.post(`/tasks/${taskId}/comments`, data);
export const deleteComment = (commentId) => api.delete(`/tasks/comments/${commentId}`);

// Profile
export const updateProfile = (data) => api.put('/auth/me', data);
