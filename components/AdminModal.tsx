import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSchedule } from '../hooks/useSchedule';
import { useToast } from '../hooks/useToast';
import { getOrCreateCalendarUrl, regenerateCalendarUrl } from '../services/calendar';
import { getNextShifts, type NextShiftItem } from '../services/users';
import { adminDeletePassword } from '../services/auth';
import { ShiftType, User } from '../types';

// Small helpers reused from ScheduleView context
const getWeekNumber = (d: Date): [number, number] => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return [d.getUTCFullYear(), weekNo];
};

const TABS = ['Export', 'Besetzung', 'Schichttypen', 'Benutzer'] as const;
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

const AdminModal: React.FC<{ open: boolean; onClose: () => void; currentMonday: Date }>
= ({ open, onClose, currentMonday }) => {
  const { user } = useAuth();
  const toast = useToast();
  const {
    shiftTypes,
    updateWeekOverride,
    addShiftType,
    updateShiftType,
    deleteShiftType,
  } = useSchedule();

  const [active, setActive] = useState<AdminTab>('Export');

  useEffect(() => {
    if (open) setActive('Export');
  }, [open]);

  const [year, weekNumber] = useMemo(() => getWeekNumber(currentMonday), [currentMonday]);

  // Export: iCal token based URL
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);

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
          {/* (Woche und Abwesenheit wurden entfernt; Woche-Sperren jetzt direkt in der Planungsübersicht) */}

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
            <div className="space-y-4">
              {/* Neu anlegen */}
              <Section title="Neuen Schichttyp anlegen">
                <NewShiftTypeForm onCreate={(data)=>{
                  try {
                    addShiftType(data);
                    toast.success('Schichttyp angelegt');
                  } catch (e: any) {
                    toast.error(e?.message || 'Fehler beim Anlegen');
                  }
                }} />
              </Section>

              <Section title="Vorhandene Schichttypen">
                {shiftTypes.length === 0 && <p className="text-sm text-gray-500">Keine Schichttypen vorhanden.</p>}
                <EditableShiftTypeList shiftTypes={shiftTypes} onUpdate={(id, fields)=>{
                  try {
                    updateShiftType(id, fields);
                    toast.success('Gespeichert');
                  } catch (e: any) {
                    toast.error(e?.message || 'Fehler beim Speichern');
                  }
                }} onDelete={(id)=>{
                  if (!confirm('Diesen Schichttyp wirklich löschen?')) return;
                  try {
                    deleteShiftType(id);
                    toast.success('Gelöscht');
                  } catch (e: any) {
                    toast.error(e?.message || 'Fehler beim Löschen');
                  }
                }} />
              </Section>
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

type ShiftInput = Omit<ShiftType, 'id'>;

const pastelHues = ['sky','emerald','amber','rose','violet','cyan','slate','gray'] as const;
const makeColor = (hue: string) => `bg-${hue}-200 text-${hue}-800`;

const timeOk = (t: string) => /^\d{2}:\d{2}$/.test(t);

const NewShiftTypeForm: React.FC<{ onCreate: (data: ShiftInput) => void }>=({ onCreate })=>{
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [minUsers, setMinUsers] = useState('1');
  const [maxUsers, setMaxUsers] = useState('1');
  const [hue, setHue] = useState<(typeof pastelHues)[number]>('sky');
  const [customColor, setCustomColor] = useState('');
  const [saving, setSaving] = useState(false);

  const color = customColor.trim() || makeColor(hue);

  const submit = () => {
    const min = Math.max(0, parseInt(minUsers || '0', 10) || 0);
    const max = Math.max(0, parseInt(maxUsers || '0', 10) || 0);
    if (!name.trim()) return alert('Name ist erforderlich');
    if (!timeOk(startTime) || !timeOk(endTime)) return alert('Zeitformat HH:mm verwenden');
    if (max < min) return alert('Max darf nicht kleiner als Min sein');
    setSaving(true);
    try {
      const data: ShiftInput = { name: name.trim(), startTime, endTime, color, minUsers: min, maxUsers: max };
      onCreate(data);
      // reset
      setName(''); setStartTime('08:00'); setEndTime('16:00'); setMinUsers('1'); setMaxUsers('1'); setCustomColor(''); setHue('sky');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <FieldLabel label="Name" />
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
        </div>
        <div>
          <FieldLabel label="Start" />
          <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
        </div>
        <div>
          <FieldLabel label="Ende" />
          <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
        </div>
        <div>
          <FieldLabel label="Min" />
          <input inputMode="numeric" pattern="[0-9]*" value={minUsers} onChange={e=>setMinUsers(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
        </div>
        <div>
          <FieldLabel label="Max" />
          <input inputMode="numeric" pattern="[0-9]*" value={maxUsers} onChange={e=>setMaxUsers(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
        </div>
        <div>
          <FieldLabel label="Farbe" />
          <div className="flex gap-2 items-center mt-1">
            <select value={hue} onChange={e=>setHue(e.target.value as any)} className="px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600">
              {pastelHues.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className={`px-2 py-0.5 rounded-full text-xs border ${color}`}>Vorschau</span>
          </div>
          <div className="mt-2">
            <input value={customColor} onChange={e=>setCustomColor(e.target.value)} placeholder="Optional: Tailwind Klassen z.B. bg-sky-200 text-sky-800" className="w-full px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
          </div>
        </div>
      </div>
      <div>
        <button disabled={saving} onClick={submit} className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-60">Anlegen</button>
      </div>
    </div>
  );
};

const EditableShiftTypeList: React.FC<{ shiftTypes: ShiftType[]; onUpdate: (id: string, fields: Partial<ShiftInput>) => void; onDelete: (id: string) => void }>=({ shiftTypes, onUpdate, onDelete })=>{
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ShiftInput>>({});

  const startEdit = (s: ShiftType) => {
    setEditing(s.id);
    setDrafts(prev => ({ ...prev, [s.id]: { name: s.name, startTime: s.startTime, endTime: s.endTime, color: s.color, minUsers: s.minUsers, maxUsers: s.maxUsers } }));
  };
  const cancel = () => setEditing(null);
  const change = (id: string, field: keyof ShiftInput, value: any) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };
  const save = (id: string) => {
    const d = drafts[id];
    if (!d) return;
    if (!d.name.trim()) return alert('Name ist erforderlich');
    if (!timeOk(d.startTime) || !timeOk(d.endTime)) return alert('Zeitformat HH:mm verwenden');
    if (d.maxUsers < d.minUsers) return alert('Max darf nicht kleiner als Min sein');
    onUpdate(id, d);
    setEditing(null);
  };

  return (
    <div className="space-y-2">
      {shiftTypes.map(s => {
        const isEd = editing === s.id;
        const d = drafts[s.id] || ({} as ShiftInput);
        const color = isEd ? (d.color || s.color) : s.color;
        return (
          <div key={s.id} className="p-2 rounded border bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600">
            {!isEd ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs border shrink-0 ${color}`}>{s.name}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">{s.startTime}–{s.endTime}</span>
                  <span className="text-xs text-gray-500">min {s.minUsers} · max {s.maxUsers}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>startEdit(s)} className="px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 text-xs hover:bg-gray-50">Bearbeiten</button>
                  <button onClick={()=>onDelete(s.id)} className="px-2 py-1 rounded bg-rose-600 text-white text-xs hover:bg-rose-700">Löschen</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                <input value={d.name} onChange={e=>change(s.id,'name', e.target.value)} className="px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                <input type="time" value={d.startTime} onChange={e=>change(s.id,'startTime', e.target.value)} className="px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                <input type="time" value={d.endTime} onChange={e=>change(s.id,'endTime', e.target.value)} className="px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                <input inputMode="numeric" pattern="[0-9]*" value={String(d.minUsers)} onChange={e=>change(s.id,'minUsers', Math.max(0, parseInt(e.target.value||'0',10)||0))} className="px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                <input inputMode="numeric" pattern="[0-9]*" value={String(d.maxUsers)} onChange={e=>change(s.id,'maxUsers', Math.max(0, parseInt(e.target.value||'0',10)||0))} className="px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                <div className="flex items-center gap-2">
                  <input value={d.color} onChange={e=>change(s.id,'color', e.target.value)} className="flex-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                  <span className={`px-2 py-0.5 rounded-full text-xs border whitespace-nowrap ${color}`}>Vorschau</span>
                </div>
                <div className="md:col-span-6 flex gap-2">
                  <button onClick={()=>save(s.id)} className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800 text-sm">Speichern</button>
                  <button onClick={cancel} className="px-3 py-1.5 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Abbrechen</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()).join('');
const colorFromId = (id: string) => {
  const hues = ['sky','emerald','amber','rose','violet','cyan','slate','gray'];
  let h = 0; for (let i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i)) >>> 0;
  return hues[h % hues.length];
};

const Avatar: React.FC<{ user: User; size?: number }> = ({ user, size = 28 }) => {
  const hue = colorFromId(user.id);
  const cls = `bg-${hue}-200 text-${hue}-800`;
  const style: React.CSSProperties = { width: size, height: size };
  return (
    <div className={`rounded-full flex items-center justify-center text-xs font-semibold border ${cls}`} style={style} title={user.name}>
      {initials(user.name || '?')}
    </div>
  );
};

const UserList: React.FC = () => {
  const { users, updateUser } = useSchedule();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftBirthday, setDraftBirthday] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [calUrl, setCalUrl] = useState<string | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [nextShifts, setNextShifts] = useState<NextShiftItem[] | null>(null);
  const [loadingShifts, setLoadingShifts] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = users;
    if (!s) return list;
    return list.filter(u => (u.name || '').toLowerCase().includes(s));
  }, [q, users]);

  useEffect(() => {
    if (!selected) return;
    // sync drafts when selection or users list updates
    const fresh = users.find(u => u.id === selected.id) || selected;
    setSelected(fresh);
    setDraftName(fresh.name || '');
    setDraftBirthday(fresh.birthday || '');
    // load calendar url
    (async ()=>{
      try { setCalLoading(true); const res = await getOrCreateCalendarUrl(fresh.id); setCalUrl(res.url); }
      catch(_) { setCalUrl(null); }
      finally { setCalLoading(false); }
    })();
    // load next shifts
    (async ()=>{
      try { setLoadingShifts(true); const rows = await getNextShifts(fresh.id, 5); setNextShifts(rows); }
      catch(_) { setNextShifts([]); }
      finally { setLoadingShifts(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, users.length]);

  const save = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      const fields: any = {};
      if (draftName !== (selected.name || '')) fields.name = draftName.trim();
      const b = draftBirthday || null;
      if (b !== (selected.birthday || null)) fields.birthday = b;
      if (Object.keys(fields).length === 0) { toast.info('Keine Änderungen'); return; }
      await updateUser(selected.id, fields);
      toast.success('Benutzer gespeichert');
    } catch (e: any) {
      toast.error(e?.message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const delPwd = async () => {
    if (!selected) return;
    if (!confirm('Passwort wirklich löschen? Benutzer muss ein neues setzen.')) return;
    try {
      await adminDeletePassword(selected.id);
      toast.success('Passwort gelöscht');
    } catch (e: any) {
      toast.error(e?.message || 'Fehler beim Löschen des Passworts');
    }
  };

  const regenCal = async () => {
    if (!selected) return;
    try { setCalLoading(true); const res = await regenerateCalendarUrl(selected.id); setCalUrl(res.url); toast.success('Kalender-URL zurückgesetzt'); }
    catch (e: any) { toast.error(e?.message || 'Fehler beim Zurücksetzen'); }
    finally { setCalLoading(false); }
  };

  const copyCal = async () => {
    if (!calUrl) return;
    try { await navigator.clipboard.writeText(calUrl); toast.success('URL kopiert'); }
    catch { toast.error('Kopieren fehlgeschlagen'); }
  };

  const formatLastLogin = (u?: User | null) => {
    const v = u?.lastLogin; if (!v) return '—';
    // show as dd.mm.yyyy HH:MM
    const d = new Date(v.replace(' ', 'T'));
    if (isNaN(d.getTime())) return v;
    return d.toLocaleString('de-DE');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-2 md:max-h-80 md:overflow-auto">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Suchen…" className="w-full px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {filtered.map(u => (
            <button key={u.id} onClick={()=>setSelected(u)} className={`w-full py-2 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 px-2 rounded ${selected?.id===u.id?'bg-sky-50 dark:bg-slate-700':''}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Avatar user={u} />
                <span className="truncate">{u.name}</span>
              </div>
              <div className="text-xs text-gray-500">
                {u.role}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {!selected ? (
          <div className="text-sm text-gray-500">Benutzer auswählen…</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar user={selected} size={40} />
              <div className="min-w-0">
                <div className="font-semibold truncate">{selected.name}</div>
                <div className="text-xs text-gray-500">Letzter Login: {formatLastLogin(selected)}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <FieldLabel label="Name" />
                <input value={draftName} onChange={e=>setDraftName(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
              </div>
              <div>
                <FieldLabel label="Geburtstag" />
                <input type="date" value={draftBirthday || ''} onChange={e=>setDraftBirthday(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
              </div>
            </div>
            <div className="flex gap-2">
              <button disabled={saving} onClick={save} className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-60">Speichern</button>
              <button onClick={delPwd} className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700">Passwort löschen</button>
            </div>

            <div className="space-y-2">
              <FieldLabel label="Kalender-URL" />
              <div className="flex items-center gap-2">
                <input readOnly value={calUrl || ''} placeholder={calLoading? 'Lade…' : '—'} className="flex-1 px-2 py-1.5 rounded border border-gray-300 bg-white dark:bg-slate-700 dark:border-slate-600" />
                <button disabled={!calUrl || calLoading} onClick={copyCal} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600">Kopieren</button>
                <button disabled={calLoading} onClick={regenCal} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600">Zurücksetzen</button>
              </div>
            </div>

            <div>
              <FieldLabel label="Nächste Schichten" />
              {!nextShifts || loadingShifts ? (
                <div className="text-sm text-gray-500 mt-1">Lade…</div>
              ) : nextShifts.length === 0 ? (
                <div className="text-sm text-gray-500 mt-1">Keine Schichten geplant.</div>
              ) : (
                <ul className="mt-1 text-sm list-disc pl-5">
                  {nextShifts.map((it, idx) => (
                    <li key={idx}>{new Date(it.date+'T00:00:00').toLocaleDateString('de-DE')} · {it.shiftName} ({it.startTime}–{it.endTime})</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminModal;
