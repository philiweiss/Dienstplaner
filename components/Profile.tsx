import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { changePassword } from '../services/auth';
import { getUserStats, type UserStats } from '../services/stats';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      setStatsError(null);
      setStatsLoading(true);
      try {
        const s = await getUserStats(user.id);
        if (!cancelled) setStats(s);
      } catch (e: any) {
        if (!cancelled) setStatsError(e?.message || 'Konnte Statistiken nicht laden');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!user) return null;

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword.length < 8) {
      setError('Neues Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (newPassword !== newPassword2) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    try {
      const res = await changePassword(user.name, currentPassword, newPassword);
      if (res.ok) {
        setMessage('Passwort wurde geändert.');
        setCurrentPassword('');
        setNewPassword('');
        setNewPassword2('');
      } else {
        setError('Passwort konnte nicht geändert werden.');
      }
    } catch (e: any) {
      setError(e?.message || 'Fehler beim Ändern des Passworts.');
    } finally {
      setLoading(false);
    }
  };

  const onRegisterPasskey = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      // Placeholder: call backend stub
      const res = await fetch('/api/auth/passkey/register/start', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        setMessage('Passkey-Registrierung wird später unterstützt.');
      } else {
        setError('Passkey-Registrierung nicht möglich.');
      }
    } catch (e: any) {
      setError(e?.message || 'Fehler bei der Passkey-Registrierung.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Profil</h2>
        <p className="text-sm text-gray-600">Angemeldet als <span className="font-medium">{user.name}</span> ({user.role})</p>
      </section>

      <section className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Passwort ändern</h3>
        <form onSubmit={onChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="currentPassword">Aktuelles Passwort</label>
            <input id="currentPassword" type="password" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="newPassword">Neues Passwort</label>
            <input id="newPassword" type="password" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="newPassword2">Neues Passwort wiederholen</label>
            <input id="newPassword2" type="password" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} required />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}
          <div>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md text-white ${loading ? 'bg-slate-400' : 'bg-slate-700 hover:bg-slate-800'}`}>Speichern</button>
          </div>
        </form>
      </section>

      <section className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Passkey</h3>
        <p className="text-sm text-gray-600 mb-4">Registrieren Sie einen Passkey, um sich künftig bequemer und sicherer anzumelden.</p>
        <button onClick={onRegisterPasskey} disabled={loading} className={`px-4 py-2 rounded-md text-white ${loading ? 'bg-slate-400' : 'bg-slate-700 hover:bg-slate-800'}`}>Passkey registrieren</button>
        {message && <p className="text-green-600 text-sm mt-3">{message}</p>}
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>
    </div>
  );
};

export default Profile;
