import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { changePassword } from '../services/auth';
import { getUserStats, getWeeklyStats, type UserStats, type WeeklyStatItem } from '../services/stats';
import { useSchedule } from '../hooks/useSchedule';

// Lightweight visual components (no external deps)
const MiniBarChart: React.FC<{ values: number[]; width?: number; height?: number }>
  = ({ values, width = 320, height = 72 }) => {
    if (!values || values.length === 0) return null;
    const max = Math.max(...values, 1);
    const padding = 6;
    const barGap = 4;
    const n = values.length;
    const barWidth = Math.max(2, (width - padding * 2 - barGap * (n - 1)) / n);
    return (
      <svg width={width} height={height} className="block">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity={0.2} />
        {values.map((v, i) => {
          const h = Math.round(((v / max) * (height - padding * 2)) || 0);
          const x = padding + i * (barWidth + barGap);
          const y = height - padding - h;
          return (
            <rect key={i} x={x} y={y} width={barWidth} height={h}
                  className="fill-slate-700 dark:fill-slate-300" rx={2} />
          );
        })}
      </svg>
    );
  };

const DonutChart: React.FC<{ counts: { name: string; count: number }[]; size?: number }>
  = ({ counts, size = 120 }) => {
    const total = counts.reduce((a, b) => a + (b.count || 0), 0);
    if (total === 0) return <p className="text-sm text-gray-500">Noch keine Schichten erfasst.</p>;
    const r = size / 2 - 8;
    const cx = size / 2, cy = size / 2;
    const C = 2 * Math.PI * r;
    const palette = ['#38bdf8', '#f59e0b', '#22c55e', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308'];
    let acc = 0;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <circle cx={cx} cy={cy} r={r} stroke="#e5e7eb" className="dark:stroke-slate-700" strokeWidth={10} fill="none" />
        {counts.map((c, i) => {
          const len = (c.count / total) * C;
          const dash = `${len} ${C - len}`;
          const offset = -acc;
          acc += len;
          return (
            <circle key={c.name} cx={cx} cy={cy} r={r} fill="none"
                    stroke={palette[i % palette.length]} strokeWidth={10}
                    strokeDasharray={dash} strokeDashoffset={offset}
                    transform={`rotate(-90 ${cx} ${cy})`} />
          );
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              className="fill-slate-800 dark:fill-slate-100" fontSize={14} fontWeight={600}>{total}</text>
      </svg>
    );
  };

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

  const [weekly, setWeekly] = useState<WeeklyStatItem[] | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  const me = useMemo(() => users.find(u => u.id === user?.id), [users, user?.id]);
  const [birthday, setBirthday] = useState<string>('');
  const [anniversary, setAnniversary] = useState<string>('');

  const initials = useMemo(() => {
    const n = user?.name || '';
    return n
      .split(' ')
      .map(p => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [user?.name]);

  const weeklyTotals = useMemo(() => weekly?.map(w => w.total) ?? [], [weekly]);

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

  // Load weekly stats (last ~12 weeks)
  useEffect(() => {
    let cancelled = false;
    async function loadWeekly() {
      if (!user) return;
      setWeeklyError(null);
      setWeeklyLoading(true);
      try {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7 * 11); // approx 12 weeks including current
        const toISO = (d: Date) => d.toISOString().slice(0, 10);
        const data = await getWeeklyStats(toISO(startDate), toISO(today));
        if (!cancelled) setWeekly(data);
      } catch (e: any) {
        if (!cancelled) setWeeklyError(e?.message || 'Konnte Wochenstatistik nicht laden');
      } finally {
        if (!cancelled) setWeeklyLoading(false);
      }
    }
    loadWeekly();
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

  // Helpers for base64url <-> ArrayBuffer
  const b64urlToBuffer = (b64url: string): ArrayBuffer => {
    const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
    const str = atob(b64);
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
    return bytes.buffer;
  };
  const bufferToB64url = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf);
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    const b64 = btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    return b64;
  };

  const onRegisterPasskey = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      // Start options from server
      const startRes = await fetch('/api/auth/passkey/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` },
        body: '{}'
      });
      if (!startRes.ok) throw new Error(await startRes.text());
      const options = await startRes.json();

      // Convert base64url strings to ArrayBuffers where required
      const publicKey: PublicKeyCredentialCreationOptions['publicKey'] = {
        ...options,
        challenge: b64urlToBuffer(options.challenge),
        user: {
          ...options.user,
          id: typeof options.user?.id === 'string' ? b64urlToBuffer(options.user.id) : options.user.id,
        },
        excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
          ...c,
          id: typeof c.id === 'string' ? b64urlToBuffer(c.id) : c.id,
        })),
      } as any;

      // Create credential with browser
      const cred = await navigator.credentials.create({ publicKey });
      if (!cred) throw new Error('Kein Credential erstellt.');

      const att = cred as PublicKeyCredential;
      const response = att.response as AuthenticatorAttestationResponse;
      const payload = {
        id: att.id,
        rawId: bufferToB64url(att.rawId),
        type: att.type,
        authenticatorAttachment: (att as any).authenticatorAttachment,
        response: {
          attestationObject: bufferToB64url(response.attestationObject),
          clientDataJSON: bufferToB64url(response.clientDataJSON),
        },
        clientExtensionResults: (att as any).getClientExtensionResults?.() || {},
        transports: (response as any).getTransports?.() || undefined,
      };

      // Finish registration on server
      const finishRes = await fetch('/api/auth/passkey/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` },
        body: JSON.stringify(payload),
      });
      if (!finishRes.ok) throw new Error(await finishRes.text());

      setMessage('Passkey erfolgreich registriert.');
    } catch (e: any) {
      setError(e?.message || 'Fehler bei der Passkey-Registrierung.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 text-gray-800 dark:text-gray-100">
      {/* Header Card */}
      <section className="bg-white/70 dark:bg-slate-900/60 backdrop-blur border border-slate-200/60 dark:border-slate-700/60 p-6 rounded-xl shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-100 font-semibold">
            {initials || '🙂'}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold leading-tight">{user.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300">{user.role}</span>
              {stats && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{stats.total} Schichten insgesamt</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats + Charts */}
      <section className="bg-white/70 dark:bg-slate-900/60 backdrop-blur border border-slate-200/60 dark:border-slate-700/60 p-6 rounded-xl shadow-sm transition-colors">
        <h3 className="text-lg font-semibold mb-4">Meine Statistik</h3>
        {statsLoading ? (
          <p className="text-sm text-gray-500">Lade Statistiken…</p>
        ) : statsError ? (
          <p className="text-sm text-red-500">{statsError}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                <DonutChart counts={(stats?.byShiftType ?? []).map(s => ({ name: s.name, count: s.count }))} />
              </div>
              <div className="space-y-2">
                <div className="px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-800/70">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Gesamt</div>
                  <div className="text-lg font-semibold">{stats?.total ?? 0}</div>
                </div>
                <div className="px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-800/70">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Letzte Schicht</div>
                  <div className="text-lg font-semibold">{stats?.lastDate ?? '—'}</div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Nach Schichtart</div>
                <div className="flex flex-wrap gap-2">
                  {(stats?.byShiftType ?? []).map(s => (
                    <span key={s.shiftTypeId} className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs ${s.color}`}>
                      <span className="font-medium">{s.name}</span>
                      <span className="font-bold">{s.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Wochenentwicklung</div>
                {weekly && weekly.length > 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    KW {weekly[0].week}–{weekly[weekly.length - 1].week}
                  </div>
                )}
              </div>
              {weeklyLoading ? (
                <p className="text-sm text-gray-500">Lade…</p>
              ) : weeklyError ? (
                <p className="text-sm text-red-500">{weeklyError}</p>
              ) : weekly && weekly.length > 0 ? (
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-md p-3">
                  <MiniBarChart values={weeklyTotals} />
                </div>
              ) : (
                <p className="text-sm text-gray-500">Keine Wochenstatistik vorhanden.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white/70 dark:bg-slate-900/60 backdrop-blur border border-slate-200/60 dark:border-slate-700/60 p-6 rounded-xl shadow-sm transition-colors">
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
