
import React, { useEffect, useMemo, useState } from 'react';
import { useSchedule } from '../hooks/useSchedule';
import { WeekStatus, Role, User, ShiftType } from '../types';
import { LockClosedIcon, LockOpenIcon, PlusIcon, TrashIcon } from './icons';
import { useAuth } from '../hooks/useAuth';
import { adminDeletePassword } from '../services/auth';
import { getUserStats, type UserStats, getWeeklyStats, type WeeklyStatItem } from '../services/stats';

// Re-using helper from ScheduleView
const getWeekNumber = (d: Date): [number, number] => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
};

const WeekManagement: React.FC = () => {
    const { weekConfigs, updateWeekStatus, shiftTypes, updateWeekOverride } = useSchedule();
    const [overrideOpen, setOverrideOpen] = useState<string | null>(null);
    const [overrideForm, setOverrideForm] = useState<{ shiftTypeId: string; minUsers?: number; maxUsers?: number }>({ shiftTypeId: '' });

    const renderWeekConfig = (offset: number) => {
        const date = new Date();
        date.setDate(date.getDate() + offset * 7);
        const [year, weekNumber] = getWeekNumber(date);
        const config = weekConfigs.find(wc => wc.year === year && wc.weekNumber === weekNumber) || { status: WeekStatus.LOCKED };

        const toggleStatus = () => {
            const newStatus = config.status === WeekStatus.OPEN ? WeekStatus.LOCKED : WeekStatus.OPEN;
            updateWeekStatus(year, weekNumber, newStatus);
        };

        const setOverride = () => {
            if (shiftTypes.length === 0) {
                alert('Keine Schichttypen vorhanden.');
                return;
            }
            setOverrideOpen(`${year}-${weekNumber}`);
            setOverrideForm({ shiftTypeId: shiftTypes[0].id, minUsers: undefined, maxUsers: undefined });
        };
        
        const isCurrentWeek = offset === 0;

        return (
            <div key={weekNumber} className={`p-4 rounded-lg flex flex-col md:flex-row md:justify-between md:items-center gap-3 ${isCurrentWeek ? 'bg-slate-50 border-slate-200 border' : 'bg-white'}`}>
                <div>
                    <p className="font-semibold text-gray-800">KW {weekNumber}, {year}</p>
                    <p className={`text-sm font-medium ${config.status === WeekStatus.OPEN ? 'text-green-600' : 'text-amber-600'}`}>
                        Status: {config.status}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={setOverride} className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">Wochen-Besetzung anpassen</button>
                    <button onClick={toggleStatus} className={`p-2 rounded-full transition-colors ${config.status === WeekStatus.OPEN ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}>
                        {config.status === WeekStatus.OPEN ? <LockClosedIcon className="h-5 w-5" /> : <LockOpenIcon className="h-5 w-5" />}
                    </button>
                </div>
                {overrideOpen === `${year}-${weekNumber}` && (
                    <div className="mt-3 p-3 rounded-md border border-slate-200 bg-white dark:bg-slate-900/60 dark:border-slate-700">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schichttyp</label>
                                <SelectList
                                    ariaLabel={`Schichttyp für KW ${weekNumber}/${year}`}
                                    options={shiftTypes.map(s => ({ label: s.name, value: s.id }))}
                                    value={overrideForm.shiftTypeId}
                                    onChange={(val) => setOverrideForm(f => ({...f, shiftTypeId: val}))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min</label>
                                <input type="number" min={0} className="block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors"
                                    value={overrideForm.minUsers ?? ''}
                                    onChange={e => setOverrideForm(f => ({...f, minUsers: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0)}))}
                                    placeholder="Basis" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max</label>
                                <input type="number" min={0} className="block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors"
                                    value={overrideForm.maxUsers ?? ''}
                                    onChange={e => setOverrideForm(f => ({...f, maxUsers: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0)}))}
                                    placeholder="Basis" />
                            </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                            <button
                                type="button"
                                onClick={async () => {
                                    const { shiftTypeId, minUsers, maxUsers } = overrideForm;
                                    if (!shiftTypeId) { alert('Bitte Schichttyp wählen.'); return; }
                                    if (minUsers !== undefined && maxUsers !== undefined && maxUsers < minUsers) { alert('Max darf nicht kleiner als Min sein.'); return; }
                                    try {
                                        await updateWeekOverride({ year, weekNumber, shiftTypeId, minUsers, maxUsers });
                                        setOverrideOpen(null);
                                        alert('Override gespeichert.');
                                    } catch (e: any) {
                                        alert(e?.message || 'Fehler beim Speichern');
                                    }
                                }}
                                className="px-3 py-2 text-sm rounded-md bg-slate-700 text-white hover:bg-slate-800"
                            >Speichern</button>
                            <button type="button" onClick={() => setOverrideOpen(null)} className="px-3 py-2 text-sm rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600">Abbrechen</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {[-1, 0, 1, 2, 3, 4].map(offset => renderWeekConfig(offset))}
        </div>
    );
};

const ShiftManagement: React.FC = () => {
    const { shiftTypes, addShiftType, updateShiftType, deleteShiftType } = useSchedule();
    const [newShift, setNewShift] = useState({ name: '', startTime: '08:00', endTime: '16:00', color: 'bg-gray-200 text-gray-800', minUsers: 1, maxUsers: 1 });
    const [error, setError] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [edit, setEdit] = useState<{ name: string; startTime: string; endTime: string; minUsers: number; maxUsers: number; color: string } | null>(null);

    const startEdit = (st: ShiftType) => {
        setEditingId(st.id);
        setEdit({ name: st.name, startTime: st.startTime, endTime: st.endTime, minUsers: st.minUsers, maxUsers: st.maxUsers, color: st.color });
    };

    const saveEdit = (id: string) => {
        if (!edit) return;
        const timeRe = /^\d{2}:\d{2}$/;
        if (!timeRe.test(edit.startTime) || !timeRe.test(edit.endTime)) { alert('Zeitformat muss HH:MM sein.'); return; }
        if (edit.maxUsers < edit.minUsers) { alert('Max. Besetzung darf nicht kleiner als Min. Besetzung sein.'); return; }
        updateShiftType(id, { name: edit.name, startTime: edit.startTime, endTime: edit.endTime, minUsers: edit.minUsers, maxUsers: edit.maxUsers, color: edit.color });
        setEditingId(null);
        setEdit(null);
    };

    const cancelEdit = () => { setEditingId(null); setEdit(null); };

    const colors = [
        { name: 'Sky', value: 'bg-sky-200 text-sky-800' },
        { name: 'Amber', value: 'bg-amber-200 text-amber-800' },
        { name: 'Indigo', value: 'bg-indigo-200 text-indigo-800' },
        { name: 'Teal', value: 'bg-teal-200 text-teal-800' },
        { name: 'Rose', value: 'bg-rose-200 text-rose-800' },
    ];

    const handleAddShift = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newShift.maxUsers < newShift.minUsers) {
            setError('Max. Besetzung darf nicht kleiner als Min. Besetzung sein.');
            return;
        }
        if (newShift.name && newShift.startTime && newShift.endTime) {
            addShiftType(newShift);
            setNewShift({ name: '', startTime: '08:00', endTime: '16:00', color: 'bg-gray-200 text-gray-800', minUsers: 1, maxUsers: 1 });
        }
    };
    
    return (
        <div>
             <form onSubmit={handleAddShift} className="p-4 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-6 gap-4 items-end transition-colors">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name der Schicht</label>
                    <input type="text" value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start</label>
                    <input type="time" value={newShift.startTime} onChange={e => setNewShift({...newShift, startTime: e.target.value})} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ende</label>
                    <input type="time" value={newShift.endTime} onChange={e => setNewShift({...newShift, endTime: e.target.value})} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Min. Bes.</label>
                    <input type="number" min="0" value={newShift.minUsers} onChange={e => setNewShift({...newShift, minUsers: parseInt(e.target.value) || 0})} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" required />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max. Bes.</label>
                    <input type="number" min="1" value={newShift.maxUsers} onChange={e => setNewShift({...newShift, maxUsers: parseInt(e.target.value) || 1})} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" required />
                </div>
                <div className="md:col-span-full">
                     <label className="block text-sm font-medium text-gray-700">Farbe</label>
                     <div className="flex flex-wrap gap-2 mt-1">
                        {colors.map(c => (
                            <button key={c.value} type="button" onClick={() => setNewShift({...newShift, color: c.value})} className={`p-1 rounded-md border-2 ${newShift.color === c.value ? 'border-slate-500' : 'border-transparent'}`}>
                                <span className={`${c.value} px-3 py-1 text-sm rounded-md`}>{c.name}</span>
                            </button>
                        ))}
                     </div>
                </div>
                 {error && <p className="text-red-500 text-sm md:col-span-full">{error}</p>}
                <div className="md:col-span-full">
                    <button type="submit" className="w-full md:w-auto bg-slate-700 text-white p-2 px-4 rounded-md font-semibold hover:bg-slate-800 flex items-center justify-center">
                        <PlusIcon className="h-5 w-5 mr-2" /> Schicht hinzufügen
                    </button>
                </div>
            </form>
            <div className="space-y-3">
                {shiftTypes.map(st => (
                    <div key={st.id} className="p-3 bg-white rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-2">
                        <div className="flex items-center space-x-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${st.color}`}>{st.name}</span>
                            <span className="text-sm text-gray-600 hidden md:inline">{st.startTime} - {st.endTime}</span>
                            <span className="text-sm text-gray-500 font-mono" title="Minimale/Maximale Besetzung">[{st.minUsers}/{st.maxUsers}]</span>
                        </div>
                        <button onClick={() => window.confirm(`Schicht "${st.name}" wirklich löschen?`) && deleteShiftType(st.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full self-end sm:self-center">
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Simple horizontal bar component
const HBar: React.FC<{ label: string; value: number; max: number; colorClass?: string }> = ({ label, value, max, colorClass }) => {
    const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
    return (
        <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                <span className="truncate mr-2" title={label}>{label}</span>
                <span className="font-medium">{value}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded">
                <div className={`h-2 rounded ${colorClass || 'bg-slate-500'}`} style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    );
};

// SelectList: non-dropdown option chooser with dark-mode styles
const SelectList: React.FC<{
    options: { label: string; value: string }[];
    value: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
}> = ({ options, value, onChange, ariaLabel }) => {
    return (
        <div role="listbox" aria-label={ariaLabel} className="flex flex-wrap gap-2">
            {options.map(opt => {
                const selected = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => onChange(opt.value)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50
                        ${selected
                            ? 'bg-slate-700 text-white border-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'}`}
                        >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
};

const AnalyticsPanel: React.FC = () => {
    const { users } = useSchedule();
    const [selectedUserId, setSelectedUserId] = useState<string>(() => users[0]?.id || '');
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [uLoading, setULoading] = useState(false);
    const [uError, setUError] = useState<string | null>(null);

    // weekly stats range: last 12 weeks by default
    const [range, setRange] = useState<{ start: string; end: string }>(() => {
        const endD = new Date();
        const startD = new Date();
        startD.setDate(endD.getDate() - 7 * 12);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        return { start: fmt(startD), end: fmt(endD) };
    });
    const [weekly, setWeekly] = useState<WeeklyStatItem[]>([]);
    const [wLoading, setWLoading] = useState(false);
    const [wError, setWError] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedUserId) return;
        let cancelled = false;
        (async () => {
            try {
                setULoading(true); setUError(null);
                const s = await getUserStats(selectedUserId);
                if (!cancelled) setUserStats(s);
            } catch (e: any) {
                if (!cancelled) setUError(e?.message || 'Fehler beim Laden der Nutzer-Statistiken');
            } finally {
                if (!cancelled) setULoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedUserId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setWLoading(true); setWError(null);
                const data = await getWeeklyStats(range.start, range.end);
                if (!cancelled) setWeekly(data);
            } catch (e: any) {
                if (!cancelled) setWError(e?.message || 'Fehler beim Laden der Wochen-Statistiken');
            } finally {
                if (!cancelled) setWLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [range.start, range.end]);

    const maxShiftCount = useMemo(() => Math.max(0, ...(userStats?.byShiftType.map(s => s.count) || [0])), [userStats]);
    const maxWeekly = useMemo(() => Math.max(0, ...(weekly.map(w => w.total) || [0])), [weekly]);

    const shiftTypeColorToBg = (color: string) => {
        // Backend color contains bg-xxx text-yyy, we want bg color only for the bar
        const bgClass = color.split(' ').find(c => c.startsWith('bg-')) || 'bg-slate-400';
        return bgClass;
    };

    const moveWeeks = (delta: number) => {
        const s = new Date(range.start);
        const e = new Date(range.end);
        s.setDate(s.getDate() + delta * 7);
        e.setDate(e.getDate() + delta * 7);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        setRange({ start: fmt(s), end: fmt(e) });
    };

    return (
        <div className="space-y-8">
            <section>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Wer macht wie oft was?</h3>
                <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
                    <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Nutzer</label>
                        <SelectList
                            ariaLabel="Nutzer wählen"
                            options={users.map(u => ({ label: u.name, value: u.id }))}
                            value={selectedUserId}
                            onChange={setSelectedUserId}
                        />
                    </div>
                </div>
                {uLoading ? (
                    <p className="text-sm text-gray-500">Lade Nutzer-Statistiken…</p>
                ) : uError ? (
                    <p className="text-sm text-red-600">{uError}</p>
                ) : userStats ? (
                    <div className="bg-gray-50 border border-gray-200 rounded p-4">
                        <div className="flex flex-wrap items-center gap-6 mb-4">
                            <div>
                                <div className="text-sm text-gray-500">Gesamt</div>
                                <div className="text-2xl font-bold">{userStats.total}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">Letzter Einsatz</div>
                                <div className="text-lg">{userStats.lastDate || '—'}</div>
                            </div>
                        </div>
                        <div>
                            {userStats.byShiftType.length === 0 ? (
                                <p className="text-sm text-gray-500">Keine Daten verfügbar.</p>
                            ) : (
                                userStats.byShiftType.map(s => (
                                    <HBar key={s.shiftTypeId} label={s.name} value={s.count} max={Math.max(maxShiftCount, 1)} colorClass={shiftTypeColorToBg(s.color)} />
                                ))
                            )}
                        </div>
                    </div>
                ) : null}
            </section>

            <section>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Eintragungen pro Woche (Planungsübersicht)</h3>
                <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => moveWeeks(-12)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded">« 12 Wochen</button>
                    <button onClick={() => moveWeeks(-4)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded">« 4</button>
                    <div className="text-sm text-gray-600 mx-2">{range.start} bis {range.end}</div>
                    <button onClick={() => moveWeeks(4)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded">4 »</button>
                    <button onClick={() => moveWeeks(12)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded">12 »</button>
                </div>
                {wLoading ? (
                    <p className="text-sm text-gray-500">Lade Wochen-Statistiken…</p>
                ) : wError ? (
                    <p className="text-sm text-red-600">{wError}</p>
                ) : weekly.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine Daten im Zeitraum.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="min-w-[600px]">
                            <div className="flex items-end gap-2 h-48 p-2 bg-gray-50 border border-gray-200 rounded">
                                {weekly.map(w => {
                                    const h = maxWeekly > 0 ? Math.max(4, Math.round((w.total / maxWeekly) * 100)) : 0;
                                    const label = `KW ${w.week}/${w.year}`;
                                    return (
                                        <div key={`${w.year}-${w.week}`} className="flex-1 flex flex-col items-center">
                                            <div className="w-6 bg-slate-500 rounded-t" style={{ height: `${h}%` }} title={`${label}: ${w.total}`}></div>
                                            <div className="mt-1 text-[10px] text-gray-600 rotate-0">{label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

const UserManagement: React.FC = () => {
    const { users, addUser, deleteUser, updateUser } = useSchedule();
    const [newUser, setNewUser] = useState({ name: '', role: Role.USER });

    // Modern additions
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<'ALL' | Role>("ALL");
    const [sortAsc, setSortAsc] = useState(true);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; role: Role; birthday: string | null; anniversary: string | null } | null>(null);
    const [pwDeleted, setPwDeleted] = useState<Set<string>>(() => new Set());

    const nameInitials = (name: string): string => {
        const n = name.trim();
        if (!n) return '??';
        const parts = n.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0,2).toLocaleUpperCase('de-DE');
        return ((parts[0][0]||'') + (parts[parts.length-1][0]||'')).toLocaleUpperCase('de-DE');
    };
    const hashColor = (name: string): string => {
        // Deterministic gradient pick from a small palette
        const palettes = [
            'from-indigo-500 via-purple-500 to-pink-500',
            'from-sky-500 via-cyan-500 to-teal-500',
            'from-amber-500 via-orange-500 to-rose-500',
            'from-emerald-500 via-teal-500 to-cyan-500',
            'from-fuchsia-500 via-pink-500 to-rose-500',
        ];
        let h = 0;
        for (let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) >>> 0;
        const idx = h % palettes.length;
        return palettes[idx];
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (newUser.name) {
            addUser(newUser as Omit<User, 'id'>);
            setNewUser({ name: '', role: Role.USER });
        }
    };

    const filtered = useMemo(() => {
        let list = [...users];
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(u => u.name.toLowerCase().includes(q));
        }
        if (roleFilter !== 'ALL') {
            list = list.filter(u => u.role === roleFilter);
        }
        list.sort((a,b) => sortAsc ? a.name.localeCompare(b.name, 'de') : b.name.localeCompare(a.name, 'de'));
        return list;
    }, [users, search, roleFilter, sortAsc]);

    const startEdit = (u: User) => {
        setEditingId(u.id);
        setEditForm({ name: u.name, role: u.role, birthday: u.birthday || null, anniversary: u.anniversary || null });
    };
    const cancelEdit = () => { setEditingId(null); setEditForm(null); };

    const saveEdit = async (id: string) => {
        if (!editForm) return;
        if (editForm.name.trim().length === 0) { alert('Name darf nicht leer sein.'); return; }
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        if (editForm.birthday && !dateRe.test(editForm.birthday)) { alert('Geburtstag bitte als YYYY-MM-DD eingeben.'); return; }
        if (editForm.anniversary && !dateRe.test(editForm.anniversary)) { alert('Jubiläum bitte als YYYY-MM-DD eingeben.'); return; }
        try {
            await updateUser(id, { name: editForm.name, role: editForm.role, birthday: editForm.birthday || null, anniversary: editForm.anniversary || null });
            cancelEdit();
        } catch (e: any) {
            alert(e?.message || 'Änderungen konnten nicht gespeichert werden.');
        }
    };

    return (
        <div className="space-y-4">
            {/* Create & Filter Bar */}
            <form onSubmit={handleAddUser} className="p-4 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg grid grid-cols-1 md:grid-cols-5 gap-4 items-end transition-colors">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Benutzername</label>
                    <input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rolle</label>
                    <SelectList
                        ariaLabel="Rolle wählen"
                        options={[{label:'User', value: Role.USER},{label:'Admin', value: Role.ADMIN}]}
                        value={newUser.role}
                        onChange={(val) => setNewUser({...newUser, role: val as Role})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Suche</label>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name…" className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filter</label>
                    <SelectList
                        ariaLabel="Rolle filtern"
                        options={[{label:'Alle', value:'ALL'},{label:'User', value: Role.USER},{label:'Admin', value: Role.ADMIN}]}
                        value={roleFilter}
                        onChange={(val) => setRoleFilter(val as any)}
                    />
                </div>
                <div className="md:col-span-full flex flex-wrap gap-2 items-center">
                    <button type="submit" className="bg-slate-700 text-white p-2 px-4 rounded-md font-semibold hover:bg-slate-800 flex items-center justify-center">
                        <PlusIcon className="h-5 w-5 mr-2" /> Benutzer hinzufügen
                    </button>
                    <button type="button" onClick={() => setSortAsc(s => !s)} className="px-3 py-2 rounded-md text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        Sortierung: {sortAsc ? 'A→Z' : 'Z→A'}
                    </button>
                </div>
            </form>

            {/* List */}
            <div className="space-y-3">
                {filtered.length === 0 && (
                    <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-600 dark:text-slate-300">Keine Nutzer gefunden.</div>
                )}
                {filtered.map(u => {
                    const isEditing = editingId === u.id && editForm;
                    return (
                        <div key={u.id} className="p-3 bg-white dark:bg-slate-900/60 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            {!isEditing ? (
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${hashColor(u.name)} text-white flex items-center justify-center text-sm font-bold shadow`} title={u.name} aria-label={`Avatar von ${u.name}`}>
                                            {nameInitials(u.name)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-gray-800 dark:text-gray-100">{u.name}</p>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100">{u.role}</span>
                                                {(!u.hasPassword || pwDeleted.has(u.id)) && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" title="Passwort gelöscht – Benutzer muss beim nächsten Login ein neues setzen">PW gelöscht</span>
                                                )}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-x-2">
                                                <span>🎂 {u.birthday || '—'}</span>
                                                <span>🎉 {u.anniversary || '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                                        <button onClick={() => startEdit(u)} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 text-sm">Bearbeiten</button>
                                        <button
                                            onClick={async () => {
                                                if (!window.confirm(`Passwort von "${u.name}" wirklich löschen?`)) return;
                                                try {
                                                    await adminDeletePassword(u.id);
                                                    setPwDeleted(prev => new Set(prev).add(u.id));
                                                } catch (e: any) {
                                                    alert(e?.message || 'Aktion fehlgeschlagen');
                                                }
                                            }}
                                            className="px-3 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 text-sm"
                                            title="Passwort löschen"
                                        >Passwort löschen</button>
                                        <button onClick={() => window.confirm(`Benutzer "${u.name}" wirklich löschen?`) && deleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full" title="Benutzer löschen">
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                                            <input type="text" value={editForm!.name} onChange={e => setEditForm(f => f ? {...f, name: e.target.value} : f)} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rolle</label>
                                            <SelectList
                                                ariaLabel="Rolle setzen"
                                                options={[{label:'User', value: Role.USER},{label:'Admin', value: Role.ADMIN}]}
                                                value={editForm!.role}
                                                onChange={(val) => setEditForm(f => f ? {...f, role: val as Role} : f)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Geburtstag</label>
                                            <input type="text" placeholder="YYYY-MM-DD" value={editForm!.birthday || ''} onChange={e => setEditForm(f => f ? {...f, birthday: e.target.value || null} : f)} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Jubiläum</label>
                                            <input type="text" placeholder="YYYY-MM-DD" value={editForm!.anniversary || ''} onChange={e => setEditForm(f => f ? {...f, anniversary: e.target.value || null} : f)} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm p-2 transition-colors" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => saveEdit(u.id)} className="px-3 py-2 text-sm rounded-md bg-slate-700 text-white hover:bg-slate-800">Speichern</button>
                                        <button type="button" onClick={cancelEdit} className="px-3 py-2 text-sm rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600">Abbrechen</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'weeks' | 'shifts' | 'users' | 'handovers' | 'analytics'>('dashboard');
    
    const TabButton: React.FC<{ tabId: 'dashboard' | 'weeks' | 'shifts' | 'users' | 'handovers' | 'analytics', children: React.ReactNode}> = ({tabId, children}) => {
        const isActive = activeTab === tabId;
        return (
            <button onClick={() => setActiveTab(tabId)} className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isActive ? 'bg-slate-200 text-slate-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                {children}
            </button>
        )
    };

    const { user } = useAuth();
    const { handoversAdmin, refreshHandovers, approveHandover, declineHandover, shiftTypes, users, weekConfigs } = useSchedule();

    useEffect(() => {
        if (user?.role === Role.ADMIN) {
            refreshHandovers(undefined, true);
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'handovers' && user?.role === Role.ADMIN) {
            refreshHandovers(undefined, true);
        }
    }, [activeTab, user]);

    const HandoversManagement: React.FC = () => {
        return (
            <div className="space-y-3">
                {handoversAdmin.length === 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">Keine Übergaben warten auf Bestätigung.</p>
                )}
                {handoversAdmin.map(h => {
                    const st = shiftTypes.find(s => s.id === h.shiftTypeId);
                    const fromUser = users.find(u => u.id === h.fromUserId);
                    const toUser = users.find(u => u.id === h.toUserId);
                    return (
                        <div key={h.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-2">
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-100">{st?.name} – {new Date(h.date).toLocaleDateString('de-DE')}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">Von {fromUser?.name} an {toUser?.name}</p>
                            </div>
                            <div className="flex gap-2 self-end sm:self-center">
                                <button onClick={() => user && declineHandover(h.id, user.id)} className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-100 dark:hover:bg-slate-600">Ablehnen</button>
                                <button onClick={() => user && approveHandover(h.id, user.id)} className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500">Bestätigen</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Dashboard view (landing)
    const Dashboard: React.FC = () => {
        const openWeeks = weekConfigs.filter(w => w.status === WeekStatus.OPEN).length;
        const lockedWeeks = weekConfigs.filter(w => w.status === WeekStatus.LOCKED).length;
        return (
            <div className="space-y-6">
                {handoversAdmin.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md dark:bg-amber-900/30 dark:border-amber-700">
                        <p className="font-semibold text-amber-800 mb-2 dark:text-amber-300">
                            Übergaben warten auf Bestätigung ({handoversAdmin.length})
                        </p>
                        <div className="space-y-2">
                            {handoversAdmin.slice(0, 3).map(h => {
                                const st = shiftTypes.find(s => s.id === h.shiftTypeId);
                                const fromUser = users.find(u => u.id === h.fromUserId);
                                const toUser = users.find(u => u.id === h.toUserId);
                                return (
                                    <div key={h.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm">
                                        <span className="text-gray-800 dark:text-gray-200">
                                            {fromUser?.name} → {toUser?.name}: {st?.name} am {new Date(h.date).toLocaleDateString('de-DE')}
                                        </span>
                                        <div className="flex gap-2 mt-2 sm:mt-0">
                                            <button onClick={() => user && declineHandover(h.id, user.id)} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-100 dark:hover:bg-slate-600">Ablehnen</button>
                                            <button onClick={() => user && approveHandover(h.id, user.id)} className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500">Bestätigen</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {handoversAdmin.length > 3 && (
                            <p className="text-xs text-amber-800 mt-2 dark:text-amber-300">Mehr unter „Übergaben“.</p>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-sm text-slate-500">Ausstehende Übergaben</div>
                        <div className="text-2xl font-bold text-slate-800">{handoversAdmin.length}</div>
                        <button onClick={() => setActiveTab('handovers')} className="mt-2 text-sm text-slate-600 hover:text-slate-900">Ansehen →</button>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-sm text-slate-500">Nutzer</div>
                        <div className="text-2xl font-bold text-slate-800">{users.length}</div>
                        <button onClick={() => setActiveTab('users')} className="mt-2 text-sm text-slate-600 hover:text-slate-900">Verwalten →</button>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-sm text-slate-500">Schichttypen</div>
                        <div className="text-2xl font-bold text-slate-800">{shiftTypes.length}</div>
                        <button onClick={() => setActiveTab('shifts')} className="mt-2 text-sm text-slate-600 hover:text-slate-900">Bearbeiten →</button>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-sm text-slate-500">Wochen (offen/gesperrt)</div>
                        <div className="text-2xl font-bold text-slate-800">{openWeeks}/{lockedWeeks}</div>
                        <button onClick={() => setActiveTab('weeks')} className="mt-2 text-sm text-slate-600 hover:text-slate-900">Steuern →</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white p-0 sm:p-0 rounded-lg shadow-lg overflow-hidden">
            <div className="flex">
                {/* Sidebar */}
                <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-3" aria-label="Admin Navigation">
                    <h2 className="px-2 pb-2 text-sm font-semibold text-slate-500 uppercase tracking-wide">Admin</h2>
                    <nav className="flex flex-col gap-1">
                        <button onClick={() => setActiveTab('dashboard')} className={`text-left px-2 py-2 rounded-md text-sm ${activeTab==='dashboard'?'bg-white shadow-sm text-slate-900':'text-slate-600 hover:bg-white/60'}`}>Dashboard</button>
                        <button onClick={() => setActiveTab('weeks')} className={`text-left px-2 py-2 rounded-md text-sm ${activeTab==='weeks'?'bg-white shadow-sm text-slate-900':'text-slate-600 hover:bg-white/60'}`}>Wochen</button>
                        <button onClick={() => setActiveTab('handovers')} className={`text-left px-2 py-2 rounded-md text-sm ${activeTab==='handovers'?'bg-white shadow-sm text-slate-900':'text-slate-600 hover:bg-white/60'}`}>Übergaben</button>
                        <button onClick={() => setActiveTab('users')} className={`text-left px-2 py-2 rounded-md text-sm ${activeTab==='users'?'bg-white shadow-sm text-slate-900':'text-slate-600 hover:bg-white/60'}`}>Nutzer</button>
                        <button onClick={() => setActiveTab('shifts')} className={`text-left px-2 py-2 rounded-md text-sm ${activeTab==='shifts'?'bg-white shadow-sm text-slate-900':'text-slate-600 hover:bg-white/60'}`}>Schichten</button>
                        <button onClick={() => setActiveTab('analytics')} className={`text-left px-2 py-2 rounded-md text-sm ${activeTab==='analytics'?'bg-white shadow-sm text-slate-900':'text-slate-600 hover:bg-white/60'}`}>Auswertungen</button>
                    </nav>
                </aside>

                {/* Content */}
                <main className="flex-1 p-4 sm:p-6">
                    <div className="mb-4">
                        <h1 className="text-2xl font-bold text-gray-800">Admin‑Panel</h1>
                        <p className="text-gray-600">Alles Wichtige an einem Ort.</p>
                    </div>

                    {activeTab === 'dashboard' && <Dashboard />}
                    {activeTab === 'weeks' && <WeekManagement />}
                    {activeTab === 'shifts' && <ShiftManagement />}
                    {activeTab === 'users' && <UserManagement />}
                    {activeTab === 'handovers' && <HandoversManagement />}
                    {activeTab === 'analytics' && <AnalyticsPanel />}
                </main>
            </div>
        </div>
    );
};

export default AdminPanel;