import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSchedule } from '../hooks/useSchedule';
import { useToast } from '../hooks/useToast';
import { getOrCreateCalendarUrl, regenerateCalendarUrl } from '../services/calendar';
import { WeekStatus, AbsencePart, AbsenceType, Role } from '../types';

// Small helpers reused from ScheduleView context
const getWeekNumber = (d: Date): [number, number] => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return [d.getUTCFullYear(), weekNo];
};

const TABS = ['Woche', 'Abwesenheit', 'Export', 'Besetzung', 'Schichttypen', 'Benutzer'] as const;
export type AdminTab = typeof TABS[number];

const FieldLabel: React.FC<{ label: string }> = ({ label }) => (
  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</label>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{title}</h4>
    <div className="space-y-2">{children}</div>
  </div>
);

const AdminModal: React.FC<{ open: boolean; onClose: () => void; currentMonday: Date; daysOfWeek: Date[] }>
= ({ open, onClose, currentMonday, daysOfWeek }) => {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'Admin';
  const {
    users,
    shiftTypes,
    weekConfigs,
    updateWeekStatus,
    updateWeekOverride,
    addAbsenceRange,
  } = useSchedule();

  const [active, setActive] = useState<AdminTab>('Woche');

  useEffect(() => {
    if (open) setActive('Woche');
  }, [open]);

  const [year, weekNumber] = useMemo(() => getWeekNumber(currentMonday), [currentMonday]);
  const isWeekOpen = useMemo(() => {
    const wk = weekConfigs.find(w => w.year === year && w.weekNumber === weekNumber);
    return (wk?.status || WeekStatus.OPEN) === WeekStatus.OPEN;
  }, [weekConfigs, year, weekNumber]);

  // Export: iCal token based URL
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  import { getOrCreateCalendarUrl, regenerateCalendarUrl } from '../services/calendar';

  const ensureCalendar = async () => {
    if (!user) return;
    setCalError(null);
    setCalLoading(true);
    try {
      const res = await getOrCreateCalendarUrl(user.id);
      setCalendarUrl(res.url);
    } catch (e: any) {
      setCalError(e?.message || 'Fehler beim Erzeugen der Kalender-URL');
    } finally {
      setCalLoading(false);
    }
  };
  const handleRegenerate = async () => {
    if (!user) return;
    setCalError(null);
    setCalLoading(true);
    try {
      const res = await regenerateCalendarUrl(user.id);
      setCalendarUrl(res.url);
    } catch (e: any) {
      setCalError(e?.message || 'Fehler beim Neu-Generieren');
    } finally {
      setCalLoading(false);
    }
  };
  const copyUrl = async () => {
    if (!calendarUrl) return;
    try { await navigator.clipboard.writeText(calendarUrl); toast.success('URL kopiert'); }
    catch { toast.error('Kopieren fehlgeschlagen'); }
  };

  // Abwesenheit (Woche) form state
  const monday = daysOfWeek[0];
  const sunday = daysOfWeek[daysOfWeek.length - 1];
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const [absUser, setAbsUser] = useState('');
  const [absType, setAbsType] = useState<AbsenceType>('SICK');
  const [absPart, setAbsPart] = useState<AbsencePart>('FULL');
  const [absNote, setAbsNote] = useState('');
  const [absStart, setAbsStart] = useState(fmt(monday));
  const [absEnd, setAbsEnd] = useState(fmt(sunday));
  const [submittingAbs, setSubmittingAbs] = useState(false);

  const submitAbsence = async () => {
    if (!absUser || !absStart || !absEnd) { toast.warn('Bitte Benutzer, Start und Ende wählen.'); return; }
    const s = new Date(absStart + 'T00:00:00Z');
    const e = new Date(absEnd + 'T00:00:00Z');
    if (e < s) { toast.warn('Ende darf nicht vor Start liegen.'); return; }
    try {
      setSubmittingAbs(true);
      const res = await addAbsenceRange(absUser, absStart, absEnd, absType, absNote || null, absPart);
      toast.success(`Abwesenheiten angelegt: ${res.created.length}${res.skipped.length ? `, übersprungen: ${res.skipped.length}` : ''}`);
    } catch (e: any) {
      toast.error(e?.message || 'Fehler beim Anlegen der Abwesenheit');
    } finally {
      setSubmittingAbs(false);
    }
  };

  // Besetzung (Wochen-Overrides)
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [minUsers, setMinUsers] = useState<string>('');
  const [maxUsers, setMaxUsers] = useState<string>('');
  const saveOverride = async () => {
    if (!selectedShift) { toast.warn('Bitte Schichttyp wählen'); return; }
    const min = minUsers.trim() !== '' ? Math.max(0, parseInt(minUsers, 10) || 0) : undefined;
    const max = maxUsers.trim() !== '' ? Math.max(0, parseInt(maxUsers, 10) || 0) : undefined;
    if (min === undefined && max === undefined) { toast.warn('Mindestens Min oder Max angeben'); return; }
    if (min !== undefined && max !== undefined && max < min) { toast.warn('Max darf nicht kleiner als Min sein'); return; }
    try {
      await updateWeekOverride({ year, weekNumber, shiftTypeId: selectedShift, minUsers: min, maxUsers: max });
      toast.success('Wochen-Besetzung gespeichert');
    } catch (e: any) {
      toast.error(e?.message || 'Fehler beim Speichern');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative bg-white dark:bg-slate-800 dark:text-gray-100 w-full max-w-3xl rounded-lg shadow-xl border border-gray-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold">Admin</h3>
          <button onClick={onClose} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600">Schließen</button>
        </div>
        {/* Tabs */}
        <div className="px-4 pt-3">
          <div className="flex flex-wrap gap-2 mb-3">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActive(tab)}
                className={`px-3 py-1.5 rounded-full text-sm border ${active===tab? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pb-4 max-h-[70vh] overflow-auto space-y-6">
          {/* Woche */}
          {active === 'Woche' && (
            <div className="space-y-3">
              <Section title={`Kalenderwoche ${weekNumber}/${year}`}>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs border ${isWeekOpen? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {isWeekOpen ? 'Offen' : 'Gesperrt'}
                  </span>
                  {isAdmin && (
                    <button onClick={() => updateWeekStatus(year, weekNumber, isWeekOpen ? WeekStatus.LOCKED : WeekStatus.OPEN)}
                      className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600">{isWeekOpen ? 'Woche sperren' : 'Woche öffnen'}</button>
                  )}
                </div>
              </Section>
            </div>
          )}

          {/* Abwesenheit */}
          {active === 'Abwesenheit' && (
            <div className="space-y-3">
              <Section title="Abwesenheit für Zeitraum eintragen">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel label="Benutzer" />
                    <select value={absUser} onChange={e=>setAbsUser(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600">
                      <option value="">— auswählen —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel label="Typ" />
                    <select value={absType} onChange={e=>setAbsType(e.target.value as AbsenceType)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600">
                      <option value="SICK">Krank</option>
                      <option value="VACATION">Urlaub</option>
                      <option value="SEMINAR">Seminar</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel label="Start" />
                    <input type="date" value={absStart} onChange={e=>setAbsStart(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                  </div>
                  <div>
                    <FieldLabel label="Ende" />
                    <input type="date" value={absEnd} onChange={e=>setAbsEnd(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                  </div>
                  <div>
                    <FieldLabel label="Teil" />
                    <select value={absPart} onChange={e=>setAbsPart(e.target.value as AbsencePart)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600">
                      <option value="FULL">Ganzer Tag</option>
                      <option value="AM">Vormittag</option>
                      <option value="PM">Nachmittag</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel label="Notiz (optional)" />
                    <input type="text" value={absNote} onChange={e=>setAbsNote(e.target.value)} placeholder="z. B. Attest, Info"
                      className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                  </div>
                </div>
                <div className="pt-2">
                  <button disabled={submittingAbs} onClick={submitAbsence}
                    className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-60">
                    {submittingAbs? 'Speichern…' : 'Abwesenheit anlegen'}
                  </button>
                </div>
              </Section>
            </div>
          )}

          {/* Export */}
          {active === 'Export' && (
            <div className="space-y-3">
              <Section title="Kalender (iCal)">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={ensureCalendar} disabled={calLoading} className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-60">URL erzeugen</button>
                  <button onClick={handleRegenerate} disabled={calLoading} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600 disabled:opacity-60">Neu generieren</button>
                  {calendarUrl && (
                    <>
                      <input value={calendarUrl} readOnly className="flex-1 min-w-[200px] px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                      <button onClick={copyUrl} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600">Kopieren</button>
                    </>
                  )}
                </div>
                {calError && <p className="text-sm text-rose-600">{calError}</p>}
              </Section>
            </div>
          )}

          {/* Besetzung */}
          {active === 'Besetzung' && (
            <div className="space-y-3">
              <Section title={`Wochen-Override für KW ${weekNumber}/${year}`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <FieldLabel label="Schichttyp" />
                    <select value={selectedShift} onChange={e=>setSelectedShift(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600">
                      <option value="">— auswählen —</option>
                      {shiftTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel label="Min Besetzung (optional)" />
                    <input inputMode="numeric" pattern="[0-9]*" value={minUsers} onChange={e=>setMinUsers(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                  </div>
                  <div>
                    <FieldLabel label="Max Besetzung (optional)" />
                    <input inputMode="numeric" pattern="[0-9]*" value={maxUsers} onChange={e=>setMaxUsers(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                  </div>
                </div>
                <div className="pt-2">
                  <button onClick={saveOverride} className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800">Speichern</button>
                </div>
              </Section>
            </div>
          )}

          {/* Schichttypen */}
          {active === 'Schichttypen' && (
            <div className="space-y-2">
              {shiftTypes.length === 0 && <p className="text-sm text-gray-500">Keine Schichttypen vorhanden.</p>}
              {shiftTypes.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded border bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${s.color}`}>{s.name}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">{s.startTime}–{s.endTime}</span>
                  </div>
                  <div className="text-xs text-gray-500">min {s.minUsers} · max {s.maxUsers}</div>
                </div>
              ))}
            </div>
          )}

          {/* Benutzer */}
          {active === 'Benutzer' && (
            <div className="space-y-3">
              <Section title="Alle Nutzer">
                <UserList />
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const UserList: React.FC = () => {
  const { users } = useSchedule();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u => (u.name || '').toLowerCase().includes(s));
  }, [q, users]);
  return (
    <div className="space-y-2">
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Suchen…" className="w-full px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
      <div className="max-h-64 overflow-auto divide-y divide-gray-200 dark:divide-slate-700">
        {filtered.map(u => (
          <div key={u.id} className="py-2 text-sm flex justify-between items-center">
            <span>{u.name}</span>
            <span className="text-xs text-gray-500">{u.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminModal;
