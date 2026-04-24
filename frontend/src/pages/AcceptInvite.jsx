import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getInviteByToken, acceptInvite } from '../api/endpoints';
import { Users, CheckCircle, XCircle, LogIn } from 'lucide-react';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    fetchInvite();
  }, [token]);

  const fetchInvite = async () => {
    try {
      const res = await getInviteByToken(token);
      setInvite(res.data);
      if (res.data.status !== 'pending') {
        setError(`This invite has already been ${res.data.status}.`);
      }
    } catch {
      setError('Invite not found or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await acceptInvite(token);
      setAccepted(true);
      toast.success(`You've joined ${invite?.workspace_name}!`);
      setTimeout(() => navigate(`/board/${res.data.workspace_id}`), 1500);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading invite...</p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <XCircle size={48} style={{ color: 'var(--accent-danger)', marginBottom: 16 }} />
            <h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>Invalid Invite</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error}</p>
            <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
          </>
        ) : accepted ? (
          <>
            <CheckCircle size={48} style={{ color: 'var(--accent-success)', marginBottom: 16 }} />
            <h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>You're In!</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Redirecting to {invite?.workspace_name}...
            </p>
          </>
        ) : (
          <>
            <div className="avatar avatar-lg" style={{ margin: '0 auto 16px', width: 64, height: 64, fontSize: '1.5rem' }}>
              <Users size={28} />
            </div>
            <h1 style={{ fontSize: '1.25rem', marginBottom: 4 }}>You've Been Invited!</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              <strong>{invite?.inviter_name}</strong> invited you to join<br />
              <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>{invite?.workspace_name}</strong>
            </p>
            <div style={{ marginBottom: 24 }}>
              <span className={`badge badge-${invite?.role}`} style={{ fontSize: '0.8rem', padding: '6px 16px' }}>
                Role: {invite?.role}
              </span>
            </div>
            {isAuthenticated ? (
              <button className="btn btn-primary btn-lg" onClick={handleAccept} disabled={accepting}
                style={{ width: '100%' }}>
                <CheckCircle size={18} />
                {accepting ? 'Joining...' : 'Accept & Join Workspace'}
              </button>
            ) : (
              <>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: 16 }}>
                  You need an account to join. Sign in or register first.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Link to={`/login?redirect=/invite/${token}`} className="btn btn-primary" style={{ flex: 1 }}>
                    <LogIn size={16} /> Sign In
                  </Link>
                  <Link to={`/register?redirect=/invite/${token}`} className="btn btn-secondary" style={{ flex: 1 }}>
                    Register
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
