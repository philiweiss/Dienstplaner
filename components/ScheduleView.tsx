
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSchedule } from '../hooks/useSchedule';
import { useToast } from '../hooks/useToast';
import { Role, WeekStatus, User, AbsenceType, AbsencePart } from '../types';
import { getOrCreateCalendarUrl, regenerateCalendarUrl } from '../services/calendar';
import { ChevronLeftIcon, ChevronRightIcon, LockClosedIcon, PlusIcon, TrashIcon, ExclamationIcon } from './icons';

// Lightweight Avatar component (no backend changes). Uses DiceBear by name as seed with initials fallback.
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};
const getInitials = (name: string) => name.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();

const Avatar: React.FC<{ user: User; size?: number; className?: string }> = ({ user, size = 24, className = '' }) => {
    const [error, setError] = useState(false);
    const bg = stringToColor(user.name || user.id);
    const initials = getInitials(user.name || 'U');
    const url = `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(user.name || user.id)}&radius=50&backgroundType=gradientLinear`;
    return (
        <div className={`rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-black/5 ${className}`} style={{ width: size, height: size, background: bg }}>
            {!error ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={url}
                    alt={user.name}
                    width={size}
                    height={size}
                    onError={() => setError(true)}
                />
            ) : (
                <span className="text-white text-[10px] font-semibold" aria-hidden>
                    {initials}
                </span>
            )}
        </div>
    );
};

// Helper to get week number
const getWeekNumber = (d: Date): [number, number] => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
};

const AdminAssignControl: React.FC<{
    date: string;
    shiftTypeId: string;
    assignedUsers: User[];
}> = ({ date, shiftTypeId, assignedUsers }) => {
    const { users, assignShift, isUserAbsent } = useSchedule();
    const { user } = useAuth();
    const [selectedUserId, setSelectedUserId] = useState('');

    const availableUsers = useMemo(() => {
        const assignedIds = new Set(assignedUsers.map(u => u.id));
        return users.filter(u => !assignedIds.has(u.id) && !isUserAbsent(date, u.id));
    }, [users, assignedUsers, date, isUserAbsent]);

    const handleAssign = () => {
        if (selectedUserId) {
            const isAdmin = user?.role === Role.ADMIN;
            assignShift(
                date,
                shiftTypeId,
                selectedUserId,
                isAdmin ? { allowOverbook: true, adminId: user!.id } : undefined
            );
            setSelectedUserId('');
        }
    };

    return (
        <div className="flex items-center space-x-2 mt-2">
            <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="block w-full text-sm rounded-md border border-gray-300 dark:border-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 transition-colors"
            >
                <option value="">Benutzer wählen...</option>
                {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                ))}
            </select>
            <button
                onClick={handleAssign}
                disabled={!selectedUserId}
                className="p-2 bg-slate-700 text-white rounded-md hover:bg-slate-800 disabled:bg-gray-300"
            >
                <PlusIcon className="h-5 w-5" />
            </button>
        </div>
    );
};


const ScheduleView: React.FC = () => {
    const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
    const [calLoading, setCalLoading] = useState(false);
    const [calError, setCalError] = useState<string | null>(null);
    const { user } = useAuth();
    const toast = useToast();
    const { users, shiftTypes, assignments, weekConfigs, assignShift, unassignShift, handoversIncoming, handoversOutgoing, refreshHandovers, requestHandover, respondHandover, getEffectiveShiftLimits, absences, isUserAbsent, addAbsence, addAbsenceRange, removeAbsence, dayNotes, setDayNote, removeDayNote, updateWeekStatus } = useSchedule();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [transferModal, setTransferModal] = useState<{ open: boolean; date: string; shiftTypeId: string; toUserId: string } | null>(null);
    const [noteEditor, setNoteEditor] = useState<{ date: string; text: string; adminOnly: boolean } | null>(null);
    const [absenceModal, setAbsenceModal] = useState<{
        open: boolean;
        userId: string;
        type: AbsenceType;
        start: string;
        end: string;
        part: AbsencePart;
        note: string;
        submitting?: boolean;
        result?: { created: { date: string }[]; skipped: { date: string; reason: string }[] } | null;
    } | null>(null);

    const [year, weekNumber] = getWeekNumber(currentDate);

    const weekConfig = weekConfigs.find(wc => wc.year === year && wc.weekNumber === weekNumber) || { status: WeekStatus.LOCKED };
    const isWeekOpen = weekConfig.status === WeekStatus.OPEN;
    const isAdmin = user?.role === Role.ADMIN;

    const daysOfWeek = useMemo(() => {
        const firstDay = new Date(currentDate);
        const dayOfWeek = firstDay.getDay();
        const diff = firstDay.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(firstDay.setDate(diff));

        // Only Monday–Friday
        return Array.from({ length: 5 }).map((_, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            return date;
        });
    }, [currentDate]);

    useEffect(() => {
        if (user) {
            refreshHandovers(user.id);
        }
    }, [user]);

    const changeWeek = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() + (direction === 'prev' ? -7 : 7));
        setCurrentDate(newDate);
    };

    const handleExport = async () => {
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
        try {
            await navigator.clipboard.writeText(calendarUrl);
            toast.success('URL kopiert');
        } catch (_e) {
            toast.error('Kopieren fehlgeschlagen');
        }
    };
    
    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-2 sm:space-x-4">
                    <button onClick={() => changeWeek('prev')} className="p-2 rounded-full hover:bg-gray-200 transition">
                        <ChevronLeftIcon className="h-6 w-6 text-gray-600" />
                    </button>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center whitespace-nowrap">
                        KW {weekNumber}, {year}
                    </h2>
                    <button onClick={() => changeWeek('next')} className="p-2 rounded-full hover:bg-gray-200 transition">
                        <ChevronRightIcon className="h-6 w-6 text-gray-600" />
                    </button>
                </div>
                <div className="flex items-center space-x-2">
                     {!isWeekOpen && (
                        <div className="flex items-center text-sm font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 px-3 py-1.5 rounded-full">
                            <LockClosedIcon className="h-4 w-4 mr-2" />
                            Woche gesperrt
                        </div>
                    )}
                    <button 
                        onClick={handleExport}
                        className="bg-slate-700 text-white px-4 py-2 rounded-md font-semibold hover:bg-slate-800 transition shadow"
                    >
                        Exportieren
                    </button>
                    {isAdmin && (
                        <div className="hidden sm:flex items-center space-x-2 ml-2">
                            <button
                                onClick={() => {
                                    // Prefill current week Mon-Fri
                                    const start = daysOfWeek[0].toISOString().slice(0,10);
                                    const end = daysOfWeek[daysOfWeek.length - 1].toISOString().slice(0,10);
                                    setAbsenceModal({ open: true, userId: '', type: 'SICK', start, end, part: 'FULL', note: '' });
                                }}
                                className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600 dark:hover:bg-slate-700"
                                title="Abwesenheit für Woche eintragen"
                            >
                                + Abwesenheit (Woche)
                            </button>
                            <button
                                onClick={() => {
                                    const next = isWeekOpen ? WeekStatus.LOCKED : WeekStatus.OPEN;
                                    updateWeekStatus(year, weekNumber, next);
                                    toast.success(`Woche ${isWeekOpen ? 'gesperrt' : 'geöffnet'}`);
                                }}
                                className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600 dark:hover:bg-slate-700"
                                title="Woche sperren/öffnen"
                            >
                                {isWeekOpen ? 'Woche sperren' : 'Woche öffnen'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {calLoading && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm">
                    Kalender-Link wird erzeugt...
                </div>
            )}
            {calError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                    {calError}
                </div>
            )}
            {calendarUrl && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-900">
                    <p className="font-semibold mb-2">Dein Kalender-Abo-Link (ICS)</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                            type="text"
                            readOnly
                            value={calendarUrl}
                            className="w-full border border-green-300 rounded px-2 py-1 bg-white text-gray-800"
                            onFocus={(e) => e.currentTarget.select()}
                        />
                        <div className="flex gap-2 mt-2 sm:mt-0">
                            <button onClick={copyUrl} className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800">Kopieren</button>
                            <a href={calendarUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">Öffnen</a>
                            <button onClick={handleRegenerate} className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">Neu generieren</button>
                        </div>
                    </div>
                    <p className="text-xs text-green-800 mt-2">
                        Tipp: Als Internet-/URL-Kalender in Outlook/Apple/Google abonnieren. Bei "Neu generieren" wird der alte Link ungültig.
                    </p>
                </div>
            )}

            {/* Eingehende Übergaben */}
            {user && handoversIncoming.filter(h => h.status === 'REQUESTED').length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="font-semibold text-amber-800 mb-2">Offene Übergabe-Anfragen an dich</p>
                    <div className="space-y-2">
                        {handoversIncoming.filter(h => h.status === 'REQUESTED').map(h => {
                            const st = shiftTypes.find(s => s.id === h.shiftTypeId);
                            const fromUser = users.find(u => u.id === h.fromUserId);
                            return (
                                <div key={h.id} className="flex items-center justify-between text-sm">
                                    <span>
                                        {fromUser?.name} möchte dir die Schicht {st?.name} am {new Date(h.date).toLocaleDateString('de-DE')} übergeben.
                                    </span>
                                    <div className="flex gap-2">
                                        <button onClick={() => respondHandover(h.id, user.id, 'reject')} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Ablehnen</button>
                                        <button onClick={() => respondHandover(h.id, user.id, 'accept')} className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">Annehmen</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Wochenraster */}
            <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                {daysOfWeek.map(day => {
                    const dateString = day.toISOString().split('T')[0];
                    return (
                        <div key={day.toISOString()} className="p-3">
                            <h3 className="font-bold text-center text-gray-700">
                                {day.toLocaleDateString('de-DE', { weekday: 'long' })}
                            </h3>
                            <p className="text-center text-sm text-gray-500 mb-2">
                                {day.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                            </p>

                            {/* Geburtstage/Jubiläen (tagesbezogen, unabhängig von Einteilungen) */}
                            {(() => {
                                const md = dateString.slice(5);
                                const birthdays = users.filter(u => u.birthday && u.birthday.slice(5) === md);
                                const anniversaries = users.filter(u => u.anniversary && u.anniversary.slice(5) === md);
                                if (birthdays.length === 0 && anniversaries.length === 0) return null;
                                return (
                                    <div className="mb-3 space-y-1">
                                        {birthdays.length > 0 && (
                                            <div className="flex flex-wrap justify-center gap-1 text-xs">
                                                <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-800 border border-pink-200">🎂 Geburtstage:</span>
                                                {birthdays.map(b => (
                                                    <span key={b.id} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">{b.name}</span>
                                                ))}
                                            </div>
                                        )}
                                        {anniversaries.length > 0 && (
                                            <div className="flex flex-wrap justify-center gap-1 text-xs">
                                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">🎉 Jubiläum:</span>
                                                {anniversaries.map(a => (
                                                    <span key={a.id} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">{a.name}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Tagesnotizen */}
                            {(() => {
                                const note = dayNotes.find(n => n.date === dateString);
                                const canSee = note ? (!note.adminOnly || isAdmin) : true;
                                const isPending = note ? !note.approved : false;
                                return (
                                  <div className="mb-3">
                                    {canSee && note && note.note && (
                                      <div className={`p-2 rounded-md text-xs border ${isPending ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                                        <div className="flex justify-between items-start gap-2">
                                          <div className="whitespace-pre-wrap break-words">{note.note}</div>
                                          <div className="flex items-center gap-1">
                                            {note.adminOnly && <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">Admin</span>}
                                            {isPending && <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">Ausstehend</span>}
                                          </div>
                                        </div>
                                        {isAdmin && (
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            <button onClick={() => setNoteEditor({ date: dateString, text: note.note, adminOnly: !!note.adminOnly })} className="px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 text-xs hover:bg-gray-50">Bearbeiten</button>
                                            {!note.approved && <button onClick={() => setDayNote(dateString, { note: note.note, adminOnly: !!note.adminOnly, approved: true, approvedBy: user?.id || undefined })} className="px-2 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700">Freigeben</button>}
                                            <button onClick={() => setDayNote(dateString, { note: note.note, adminOnly: !note.adminOnly, approved: !!note.approved, approvedBy: note.approved ? (user?.id || undefined) : undefined })} className="px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 text-xs hover:bg-gray-50">{note.adminOnly ? 'Admin-Only aus' : 'Admin-Only an'}</button>
                                            <button onClick={() => removeDayNote(dateString)} className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700">Löschen</button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {/* Editor toggle buttons */}
                                    {(!note || isAdmin) && (
                                      <div className="flex justify-center">
                                        <button onClick={() => setNoteEditor({ date: dateString, text: note?.note || '', adminOnly: !!note?.adminOnly })} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 text-xs">
                                          {note ? (isAdmin ? 'Notiz bearbeiten' : 'Vorschlag ändern') : (isAdmin ? 'Notiz hinzufügen' : 'Vorschlag hinzufügen')}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                            })()}

                            {/* Admin-Übersicht: Wer ist abwesend (alle Typen) + Schnellzugriff anlegen */}
                            {isAdmin && (
                                <div className="mb-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-xs font-semibold text-gray-600">Abwesend:</div>
                                        <button
                                            onClick={() => setAbsenceModal({ open: true, userId: '', type: 'SICK', start: dateString, end: dateString, part: 'FULL', note: '' })}
                                            className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700"
                                            title="Abwesenheit für Nutzer eintragen"
                                        >
                                            + Eintragen
                                        </button>
                                    </div>
                                    {(() => {
                                        const dayAbs = absences.filter(a => a.date === dateString);
                                        if (dayAbs.length === 0) return <div className="text-xs text-gray-400">—</div>;
                                        const partLabel = (p?: AbsencePart) => p === 'AM' ? '(VM)' : p === 'PM' ? '(NM)' : '';
                                        const typeLabel = (t: AbsenceType) => t === 'VACATION' ? 'Urlaub' : (t === 'SEMINAR' ? 'Seminar' : 'Krank');
                                        return (
                                            <div className="flex flex-wrap gap-1.5">
                                                {dayAbs.map(a => {
                                                    const u = users.find(x => x.id === a.userId);
                                                    return (
                                                        <span key={a.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${a.type === 'SICK' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                                            <span>{a.userName || u?.name || a.userId} · {typeLabel(a.type)} {partLabel(a.part)}</span>
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Abwesenheit wirklich entfernen?')) {
                                                                        removeAbsence(a.id);
                                                                    }
                                                                }}
                                                                className={`${a.type === 'SICK' ? 'text-red-700 hover:text-red-900' : 'text-blue-700 hover:text-blue-900'}`}
                                                                title="Abwesenheit löschen"
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Abwesenheit (Urlaub/Seminar) für aktuellen Nutzer – immer möglich, auch in gesperrter Woche */}
                            {user && (
                                <div className="mb-3 flex items-center justify-center gap-2">
                                    {(() => {
                                        const myAbs = isUserAbsent(dateString, user.id);
                                        if (myAbs) {
                                            const label = myAbs.type === 'VACATION' ? 'Urlaub' : 'Seminar';
                                            return (
                                                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs">
                                                    <span>{label}</span>
                                                    <button
                                                        onClick={() => removeAbsence(myAbs.id)}
                                                        className="text-blue-700 hover:text-blue-900"
                                                        title="Abwesenheit entfernen"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => addAbsence(user.id, dateString, 'VACATION')}
                                                    className="px-2 py-1 rounded text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700"
                                                >
                                                    Urlaub
                                                </button>
                                                <button
                                                    onClick={() => addAbsence(user.id, dateString, 'SEMINAR')}
                                                    className="px-2 py-1 rounded text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700"
                                                >
                                                    Seminar
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            <div className="space-y-3">
                                {shiftTypes.map(shiftType => {
                                    const assignment = assignments.find(a => a.date === dateString && a.shiftTypeId === shiftType.id);
                                    const assignedUsers = assignment ? assignment.userIds.map(uid => users.find(u => u.id === uid)).filter((u): u is User => !!u) : [];

                                    // Helpers for sickness/conflicts and replacement suggestions
                                    const timeToMinutes = (t: string) => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm; };
                                    const stStart = timeToMinutes(shiftType.startTime);
                                    const stEnd = timeToMinutes(shiftType.endTime);
                                    const targetOvernight = stEnd <= stStart;
                                    const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
                                        // Treat as intervals possibly overnight; simplify: if overnight, extend end by +1440
                                        const norm = (s: number, e: number) => e <= s ? [s, e + 1440] : [s, e];
                                        const [as, ae] = norm(aStart, aEnd);
                                        const [bs, be] = norm(bStart, bEnd);
                                        return as < be && bs < ae;
                                    };
                                    const userHasOverlappingShift = (uid: string) => {
                                        const dayAssignments = assignments.filter(a => a.date === dateString);
                                        for (const a of dayAssignments) {
                                            if (!a.userIds.includes(uid)) continue;
                                            const st = shiftTypes.find(s => s.id === a.shiftTypeId);
                                            if (!st) continue;
                                            const s1 = timeToMinutes(st.startTime);
                                            const e1 = timeToMinutes(st.endTime);
                                            if (overlaps(stStart, stEnd, s1, e1)) return true;
                                        }
                                        return false;
                                    };

                                    const effective = getEffectiveShiftLimits(dateString, shiftType.id);
                                    const isFull = assignedUsers.length >= effective.maxUsers;
                                    const isOverbooked = assignedUsers.length > effective.maxUsers;
                                    const isUnderstaffed = assignedUsers.length < effective.minUsers;
                                    const userIsAssigned = user ? assignedUsers.some(u => u.id === user.id) : false;
                                    const canSelfRegister = !isFull && isWeekOpen && !userIsAssigned && !(user && isUserAbsent(dateString, user.id));

                                    const sickOfDay = absences.filter(a => a.date === dateString && a.type === 'SICK');
                                    const sickAssigned = assignedUsers.filter(u => sickOfDay.some(a => a.userId === u.id));

                                    const weekOf = (d: Date) => {
                                        const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                                        tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
                                        const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
                                        const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
                                        return [tmp.getUTCFullYear(), weekNo] as [number, number];
                                    };
                                    const [wy, wn] = weekOf(new Date(dateString + 'T00:00:00Z'));
                                    const countAssignmentsInWeek = (uid: string) => {
                                        return assignments.filter(a => {
                                            if (!a.userIds.includes(uid)) return false;
                                            const [y, w] = getWeekNumber(new Date(a.date));
                                            return y === wy && w === wn;
                                        }).length;
                                    };

                                    const candidateUsers = users
                                        .filter(u0 => !assignedUsers.some(u => u.id === u0.id))
                                        .filter(u0 => !isUserAbsent(dateString, u0.id))
                                        .filter(u0 => !userHasOverlappingShift(u0.id))
                                        .sort((a, b) => {
                                            const ca = countAssignmentsInWeek(a.id);
                                            const cb = countAssignmentsInWeek(b.id);
                                            return ca === cb ? a.name.localeCompare(b.name, 'de') : ca - cb;
                                        })
                                        .slice(0, 5);

                                    const handleSignUp = () => {
                                       if(canSelfRegister && user) {
                                            assignShift(dateString, shiftType.id, user.id);
                                        }
                                    };
                                    
                                    const handleSignOut = (userId: string) => {
                                        if (isAdmin || (isWeekOpen && user?.id === userId)) {
                                            unassignShift(dateString, shiftType.id, userId);
                                        }
                                    };

                                    // Color coding rules (Option A — very light pastels)
                                    const isPerfect = !isOverbooked && assignedUsers.length === effective.maxUsers && assignedUsers.length >= effective.minUsers;
                                    // Use subtle backgrounds and borders; avoid saturated fills
                                    const containerClasses = (
                                        isOverbooked ? 'bg-amber-50 border-amber-200' : // warning
                                        isUnderstaffed ? 'bg-rose-50 border-rose-200' : // error
                                        isPerfect ? 'bg-white border-emerald-200' : // success (light border only)
                                        'bg-white border-gray-200'
                                    );
                                    const countTextClass = (
                                        isOverbooked ? 'text-amber-700' :
                                        isUnderstaffed ? 'text-rose-700' :
                                        isPerfect ? 'text-emerald-700' :
                                        'text-gray-600'
                                    );
                                    const titleText = (
                                        isOverbooked ? 'Überbelegt' :
                                        isUnderstaffed ? 'Unterbesetzt' :
                                        isPerfect ? 'Top gebucht' :
                                        undefined
                                    );

                                    const cardHasSick = sickAssigned.length > 0;
                                    return (
                                        <div key={shiftType.id} className={`p-2.5 rounded-md shadow-sm border ${containerClasses} ${cardHasSick ? 'border-red-500 ring-1 ring-red-300' : ''}`} title={titleText}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className={`text-sm font-semibold px-2 py-0.5 rounded-full inline-block ${shiftType.color}`}>
                                                        {shiftType.name}
                                                    </p>
                                                    <p className={`text-xs ${isPerfect ? 'text-white/90' : 'text-gray-500'} mt-1`}>{shiftType.startTime} - {shiftType.endTime}</p>
                                                </div>
                                                <div className="text-right">
                                                     <p className={`text-xs font-semibold ${countTextClass}`}>
                                                        {assignedUsers.length} / {effective.maxUsers}
                                                    </p>
                                                    {isUnderstaffed && <ExclamationIcon className="h-5 w-5 text-red-500 mt-1" title={`Mindestbesetzung: ${effective.minUsers}`} />}
                                                </div>
                                            </div>

                                            {cardHasSick && (
                                                <div className="mt-2 p-2 rounded border border-red-200 bg-red-50 text-red-800 text-xs">
                                                    <span className="font-semibold">Krank:</span>{' '}
                                                    {sickAssigned.map(u => u.name).join(', ')}
                                                </div>
                                            )}
                                           
                                            <div className="space-y-2 mt-3">
                                                {assignedUsers.map(assignedUser => {
                                                    const md = dateString.slice(5); // MM-DD
                                                    const hasBirthday = assignedUser.birthday ? assignedUser.birthday.slice(5) === md : false;
                                                    const hasAnniversary = assignedUser.anniversary ? assignedUser.anniversary.slice(5) === md : false;
                                                    const isSick = sickAssigned.some(u => u.id === assignedUser.id);
                                                    return (
                                                    <div key={assignedUser.id} className={`flex items-center justify-between p-2 rounded-lg text-sm font-medium shadow-sm ${isSick ? 'bg-red-100 text-red-800 border border-red-200' : (user?.id === assignedUser.id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800')}`}>
                                                        <span className="flex items-center gap-2">
                                                            <Avatar user={assignedUser} size={22} />
                                                            <span>{assignedUser.name}</span>
                                                            {isSick && <span className="px-1 py-0.5 text-[10px] rounded bg-red-200 text-red-900">Krank</span>}
                                                            {hasBirthday && <span title="Geburtstag" className="ml-1">🎂</span>}
                                                            {hasAnniversary && <span title="Jubiläum" className="ml-0.5">🎉</span>}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                            {isSick && isAdmin && candidateUsers.length > 0 && (
                                                                <div className="flex items-center gap-1.5 mr-1">
                                                                    <span className="text-[11px] text-gray-600">Ersatz:</span>
                                                                    {candidateUsers.slice(0,3).map(c => (
                                                                        <button
                                                                            key={c.id}
                                                                            onClick={async () => {
                                                                                if (!confirm(`Soll ${assignedUser.name} durch ${c.name} ersetzt werden?`)) return;
                                                                                try {
                                                                                    // zuerst austragen, dann eintragen (mit Admin-Overbook falls nötig)
                                                                                    await unassignShift(dateString, shiftType.id, assignedUser.id);
                                                                                    assignShift(dateString, shiftType.id, c.id, { allowOverbook: true, adminId: user?.id });
                                                                                } catch (e: any) {
                                                                                    toast.error(e?.message || 'Ersetzen fehlgeschlagen');
                                                                                }
                                                                            }}
                                                                            className="pl-1.5 pr-2 py-0.5 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-[11px] flex items-center gap-1.5"
                                                                            title={`Ersetzen durch ${c.name}`}
                                                                        >
                                                                            <Avatar user={c} size={14} />
                                                                            <span>{c.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {(isAdmin || (user?.id === assignedUser.id && isWeekOpen)) && (
                                                                <button onClick={() => handleSignOut(assignedUser.id)} className="text-red-500 hover:text-red-700 p-1" title="Austragen">
                                                                    <TrashIcon className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            {user?.id === assignedUser.id && isWeekOpen && (
                                                                <button onClick={() => setTransferModal({ open: true, date: dateString, shiftTypeId: shiftType.id, toUserId: '' })} className="text-slate-700 hover:text-slate-900 text-xs font-semibold underline px-1">
                                                                    Übergeben
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                            
                                            {isAdmin && (
                                                <AdminAssignControl date={dateString} shiftTypeId={shiftType.id} assignedUsers={assignedUsers} />
                                            )}

                                            {!isAdmin && canSelfRegister && (
                                                <button 
                                                    onClick={handleSignUp}
                                                    className="w-full flex items-center justify-center p-2 mt-2 rounded text-sm font-medium transition bg-gray-200 text-gray-600 hover:bg-slate-200 hover:text-slate-800"
                                                >
                                                    <PlusIcon className="h-4 w-4 mr-1"/>
                                                    Eintragen
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        {/* Übergabe-Modal */}
        {transferModal?.open && user && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4">
                    <h3 className="text-lg font-semibold mb-3">Schicht an anderen Nutzer übergeben</h3>
                    <p className="text-sm text-gray-600 mb-3">Wähle den Empfänger aus. Dieser muss die Anfrage annehmen; anschließend muss ein Admin bestätigen.</p>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Empfänger</label>
                        <select
                            value={transferModal.toUserId}
                            onChange={(e) => setTransferModal({ ...transferModal, toUserId: e.target.value })}
                            className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 p-2 bg-gray-50"
                        >
                            <option value="">Benutzer wählen...</option>
                            {users
                              .filter(u => u.id !== user.id)
                              .map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setTransferModal(null)} className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300">Abbrechen</button>
                        <button
                            onClick={async () => {
                                if (!transferModal.toUserId) return;
                                try {
                                    await requestHandover(transferModal.date, transferModal.shiftTypeId, user.id, transferModal.toUserId);
                                    toast.success('Übergabe-Anfrage wurde gesendet.');
                                    setTransferModal(null);
                                } catch (e: any) {
                                    toast.error(e?.message || 'Anfrage fehlgeschlagen');
                                }
                            }}
                            disabled={!transferModal.toUserId}
                            className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800 disabled:bg-gray-300"
                        >
                            Anfrage senden
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Admin: Abwesenheit eintragen Modal */}
        {isAdmin && absenceModal?.open && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-slate-800 dark:text-gray-100 rounded-lg shadow-xl w-full max-w-lg p-4 border border-gray-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-3">Abwesenheit eintragen</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Benutzer</label>
                            <select
                                value={absenceModal.userId}
                                onChange={(e) => setAbsenceModal(m => m ? { ...m, userId: e.target.value } : m)}
                                className="block w-full text-sm rounded-md border border-gray-300 dark:border-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 p-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                            >
                                <option value="">Benutzer wählen…</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Typ</label>
                            <select
                                value={absenceModal.type}
                                onChange={(e) => setAbsenceModal(m => m ? { ...m, type: e.target.value as AbsenceType } : m)}
                                className="block w-full text-sm rounded-md border border-gray-300 dark:border-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 p-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                            >
                                <option value="SICK">Krank</option>
                                <option value="VACATION">Urlaub</option>
                                <option value="SEMINAR">Seminar</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Start</label>
                            <input type="date" value={absenceModal.start} onChange={(e) => setAbsenceModal(m => m ? { ...m, start: e.target.value } : m)} className="block w-full text-sm rounded-md border border-gray-300 dark:border-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 p-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Ende</label>
                            <input type="date" value={absenceModal.end} onChange={(e) => setAbsenceModal(m => m ? { ...m, end: e.target.value } : m)} className="block w-full text-sm rounded-md border border-gray-300 dark:border-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 p-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Teil</label>
                            <select
                                value={absenceModal.part}
                                onChange={(e) => setAbsenceModal(m => m ? { ...m, part: e.target.value as AbsencePart } : m)}
                                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 p-2 bg-gray-50"
                            >
                                <option value="FULL">Ganzer Tag</option>
                                <option value="AM">Vormittag</option>
                                <option value="PM">Nachmittag</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Notiz (optional)</label>
                            <input
                                type="text"
                                value={absenceModal.note}
                                onChange={(e) => setAbsenceModal(m => m ? { ...m, note: e.target.value } : m)}
                                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 p-2"
                                placeholder="z. B. Arztbesuch, Fortbildung…"
                            />
                        </div>
                    </div>

                    {absenceModal.result && (
                        <div className="mt-3 p-2 rounded border text-sm bg-slate-50 border-slate-200 text-slate-800">
                            <div className="font-semibold mb-1">Ergebnis</div>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">angelegt: {absenceModal.result.created.length}</span>
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">übersprungen: {absenceModal.result.skipped.length}</span>
                            </div>
                            {absenceModal.result.skipped.length > 0 && (
                                <ul className="mt-2 list-disc pl-5 text-xs text-slate-700">
                                    {absenceModal.result.skipped.map(s => (
                                        <li key={s.date}>{new Date(s.date).toLocaleDateString('de-DE')} – {s.reason === 'ASSIGNED' ? 'bereits in Schicht' : s.reason === 'DUPLICATE' ? 'bereits vorhanden' : 'Fehler'}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <div className="flex justify-between items-center gap-2 mt-4">
                        <button onClick={() => setAbsenceModal(null)} className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300">Schließen</button>
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!absenceModal?.userId || !absenceModal.start || !absenceModal.end) { toast.warn('Bitte Benutzer, Start und Ende wählen.'); return; }
                                    const s = new Date(absenceModal.start + 'T00:00:00Z');
                                    const e = new Date(absenceModal.end + 'T00:00:00Z');
                                    if (e < s) { toast.warn('Ende darf nicht vor Start liegen.'); return; }
                                    try {
                                        setAbsenceModal(m => m ? { ...m, submitting: true, result: null } : m);
                                        const res = await addAbsenceRange(absenceModal.userId, absenceModal.start, absenceModal.end, absenceModal.type, absenceModal.note || null, absenceModal.part);
                                        setAbsenceModal(m => m ? { ...m, submitting: false, result: { created: res.created.map(c => ({ date: c.date })), skipped: res.skipped } } : m);
                                    } catch (e: any) {
                                        toast.error(e?.message || 'Fehler beim Anlegen der Abwesenheit');
                                        setAbsenceModal(m => m ? { ...m, submitting: false } : m);
                                    }
                                }}
                                disabled={!!absenceModal?.submitting}
                                className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800 disabled:bg-gray-300"
                            >
                                {absenceModal?.submitting ? 'Speichern…' : 'Speichern'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Tagesnotiz-Editor */}
        {noteEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">Tagesnotiz für {new Date(noteEditor.date).toLocaleDateString('de-DE')}</h3>
                    <textarea
                        value={noteEditor.text}
                        onChange={(e) => setNoteEditor({ ...noteEditor, text: e.target.value })}
                        className="w-full h-32 border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-slate-500 focus:border-slate-500 text-sm"
                        placeholder="Wichtige Information zum Tag…"
                    />
                    <div className="mt-2 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={noteEditor.adminOnly} onChange={(e) => setNoteEditor({ ...noteEditor, adminOnly: e.target.checked })} disabled={!isAdmin} />
                            <span>Nur für Admins sichtbar</span>
                        </label>
                        {!isAdmin && <span className="text-xs text-gray-500">Hinweis: Deine Notiz muss von einem Admin freigegeben werden.</span>}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setNoteEditor(null)} className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300">Abbrechen</button>
                        <button
                            onClick={async () => {
                                if (!user) return;
                                try {
                                    if (isAdmin) {
                                        await setDayNote(noteEditor.date, { note: noteEditor.text, adminOnly: noteEditor.adminOnly, approved: true, approvedBy: user.id });
                                    } else {
                                        await setDayNote(noteEditor.date, { note: noteEditor.text, adminOnly: false, approved: false, createdBy: user.id });
                                    }
                                    setNoteEditor(null);
                                } catch (e: any) {
                                    toast.error(e?.message || 'Notiz konnte nicht gespeichert werden.');
                                }
                            }}
                            className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800"
                        >
                            Speichern
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
    );
};

export default ScheduleView;