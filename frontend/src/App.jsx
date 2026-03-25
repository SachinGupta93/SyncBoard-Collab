import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Board from './pages/Board';
import AdminDashboard from './pages/AdminDashboard';
import { LogOut, LayoutDashboard } from 'lucide-react';
import './index.css';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" /> : children;
}

function AppLayout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <nav className="navbar">
        <a href="/dashboard" className="navbar-brand">
          <div className="logo-icon">⚡</div>
          <span style={{ color: 'var(--text-primary)' }}>SyncBoard</span>
        </a>
        <div className="navbar-actions">
          <a href="/dashboard" className="btn btn-ghost">
            <LayoutDashboard size={16} />
            Dashboard
          </a>
          <div className="avatar" title={user?.display_name}>
            {user?.display_name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || '?'}
          </div>
          <button className="btn btn-ghost" onClick={logout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/board/:workspaceId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Board />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/:workspaceId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AdminDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
