import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { changePassword } from '../services/auth';
import { getUserStats, type UserStats } from '../services/stats';
import { useSchedule } from '../hooks/useSchedule';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { users, updateUser } = useSchedule();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const me = useMemo(() => users.find(u => u.id === user?.id), [users, user?.id]);
  const [birthday, setBirthday] = useState<string>('');
  const [anniversary, setAnniversary] = useState<string>('');

  useEffect(() => {
    setBirthday(me?.birthday ?? '');
    setAnniversary(me?.anniversary ?? '');
  }, [me?.birthday, me?.anniversary]);

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
    <div className="max-w-2xl mx-auto space-y-8 text-gray-800 dark:text-gray-100">
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg shadow transition-colors">
        <h2 className="text-xl font-semibold mb-4">Profil</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Angemeldet als <span className="font-medium">{user.name}</span> ({user.role})</p>
      </section>

      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg shadow transition-colors">
        <h3 className="text-lg font-semibold mb-4">Meine Statistik</h3>
        {statsLoading ? (
          <p className="text-sm text-gray-500">Lade Statistiken…</p>
        ) : statsError ? (
          <p className="text-sm text-red-600">{statsError}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3 py-2 bg-slate-100 rounded-md">
                <div className="text-xs text-gray-500">Gesamt</div>
                <div className="text-lg font-semibold">{stats?.total ?? 0}</div>
              </div>
              <div className="px-3 py-2 bg-slate-100 rounded-md">
                <div className="text-xs text-gray-500">Letzte Schicht</div>
                <div className="text-lg font-semibold">{stats?.lastDate ?? '—'}</div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Nach Schichtart</div>
              {(!stats || stats.byShiftType.length === 0) ? (
                <p className="text-sm text-gray-500">Noch keine Schichten erfasst.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stats.byShiftType.map(s => (
                    <span key={s.shiftTypeId} className={`inline-flex items-center gap-2 px-3 py-1 rounded ${s.color}`}>
                      <span className="text-xs font-semibold">{s.name}</span>
                      <span className="text-sm font-bold">{s.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg shadow transition-colors">
        <h3 className="text-lg font-semibold mb-4">Geburtstag & Jubiläum</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="birthday">Geburtstag</label>
            <input id="birthday" type="date" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm transition-colors" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="anniversary">Jubiläum (Betriebszugehörigkeit)</label>
            <input id="anniversary" type="date" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm transition-colors" value={anniversary} onChange={(e) => setAnniversary(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={async () => {
              if (!user) return;
              try {
                await updateUser(user.id, { birthday: birthday || null, anniversary: anniversary || null });
                alert('Profil gespeichert.');
              } catch (e: any) {
                alert(e?.message || 'Profil konnte nicht gespeichert werden.');
              }
            }}
            className="px-4 py-2 rounded-md text-white bg-slate-700 hover:bg-slate-800"
          >Speichern</button>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg shadow transition-colors">
        <h3 className="text-lg font-semibold mb-4">Passwort ändern</h3>
        <form onSubmit={onChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="currentPassword">Aktuelles Passwort</label>
            <input id="currentPassword" type="password" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm transition-colors" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="newPassword">Neues Passwort</label>
            <input id="newPassword" type="password" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm transition-colors" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
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
