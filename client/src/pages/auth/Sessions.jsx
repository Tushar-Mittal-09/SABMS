import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Laptop,
  Smartphone,
  Globe,
  Shield,
  LogOut,
  KeyRound,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Loading from '../../components/Loading';
import { authApi } from '../../services/auth.api';
import { useAuthStore } from '../../store/auth.store';

export const Sessions = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setActionError(null);
      const res = await authApi.getSessions();
      setSessions(res.data || []);
    } catch (err) {
      setActionError(err.message || 'Failed to load active sessions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSingle = async (sessionId) => {
    try {
      setRevokingId(sessionId);
      setActionError(null);
      setActionSuccess(null);
      await authApi.revokeSession(sessionId);
      setActionSuccess('Session revoked successfully.');
      setSessions((prev) =>
        prev.filter((s) => s.id !== sessionId && s._id !== sessionId)
      );
    } catch (err) {
      setActionError(err.message || 'Failed to revoke session.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    try {
      setIsRevokingAll(true);
      setActionError(null);
      setActionSuccess(null);
      await authApi.revokeAllOtherSessions();
      setActionSuccess('All other sessions have been terminated.');
      await fetchSessions();
    } catch (err) {
      setActionError(err.message || 'Failed to revoke other sessions.');
    } finally {
      setIsRevokingAll(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getDeviceIcon = (userAgent = '') => {
    const ua = userAgent.toLowerCase();
    if (
      ua.includes('mobile') ||
      ua.includes('android') ||
      ua.includes('iphone')
    ) {
      return <Smartphone className="h-5 w-5 text-indigo-500" />;
    }
    if (ua.includes('mac') || ua.includes('windows') || ua.includes('linux')) {
      return <Laptop className="h-5 w-5 text-indigo-500" />;
    }
    return <Globe className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="bg-primary-50 text-primary-600 flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {user?.name || 'User'}
                </h1>
                <span className="bg-primary-100 text-primary-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {user?.role || 'MEMBER'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>

          <div className="flex w-full items-center gap-2.5 sm:w-auto">
            <Link to="/change-password">
              <Button variant="outline" size="sm" icon={KeyRound}>
                Password
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-red-200 text-red-600 hover:bg-red-50"
              icon={LogOut}
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {actionError && (
          <Alert
            type="error"
            title="Session Error"
            message={actionError}
            onClose={() => setActionError(null)}
          />
        )}

        {actionSuccess && (
          <Alert
            type="success"
            title="Success"
            message={actionSuccess}
            onClose={() => setActionSuccess(null)}
          />
        )}

        {/* Sessions Panel */}
        <div className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-start justify-between gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="text-primary-600 h-5 w-5" />
                <h2 className="text-lg font-bold text-gray-900">
                  Active Device Sessions
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                Manage signed-in devices and revoke unrecognized sessions
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSessions}
                loading={isLoading}
                icon={RefreshCw}
              >
                Refresh
              </Button>
              {sessions.filter((s) => !s.isCurrent).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeAllOthers}
                  loading={isRevokingAll}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  icon={AlertTriangle}
                >
                  Revoke Others
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loading text="Loading active sessions..." />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No active sessions found.
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const sId = session.id || session._id;
                return (
                  <div
                    key={sId}
                    className={`flex flex-col items-start justify-between gap-4 rounded-xl border p-4 transition-all sm:flex-row sm:items-center ${
                      session.isCurrent
                        ? 'border-primary-200 bg-primary-50/20 shadow-xs'
                        : 'border-gray-100 bg-gray-50/40 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="shadow-xs mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 bg-white">
                        {getDeviceIcon(session.userAgent)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {session.userAgent || 'Unknown Device / Browser'}
                          </span>
                          {session.isCurrent && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                              Current Session
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span>IP: {session.ipAddress || '127.0.0.1'}</span>
                          {session.lastActiveAt && (
                            <>
                              <span>•</span>
                              <span>
                                Active:{' '}
                                {new Date(
                                  session.lastActiveAt
                                ).toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!session.isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSingle(sId)}
                        loading={revokingId === sId}
                        className="border-gray-200 text-red-600 hover:border-red-200 hover:bg-red-50"
                        icon={Trash2}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sessions;
