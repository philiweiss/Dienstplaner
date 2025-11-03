
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSchedule } from '../hooks/useSchedule';
import { useToast } from '../hooks/useToast';
import { Role, WeekStatus, User, AbsenceType, AbsencePart, Absence } from '../types';
import { getOrCreateCalendarUrl, regenerateCalendarUrl } from '../services/calendar';
import { ChevronLeftIcon, ChevronRightIcon, LockClosedIcon, PlusIcon, TrashIcon, ExclamationIcon, LockOpenIcon } from './icons';
import AdminModal from './AdminModal';

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

// Map stronger tailwind color pairs like "bg-sky-200 text-sky-800" to very light pastels
// Example result: "bg-sky-50 text-sky-700 border border-sky-200"
const pastelizeShiftColor = (color: string) => {
    try {
        // Extract first bg color token
        const match = color.match(/bg-([a-z]+)-(\d{2,3})/i);
        const hue = match?.[1] || 'sky';
        // Compose pastel classes (Option A palette tendencies)
        return `bg-${hue}-50 text-${hue}-700 border border-${hue}-200`;
    } catch {
        return 'bg-sky-50 text-sky-700 border border-sky-200';
    }
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

    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const wrapRef = React.useRef<HTMLDivElement | null>(null);

    const availableUsers = useMemo(() => {
        const assignedIds = new Set(assignedUsers.map(u => u.id));
        // Include absent users as disabled options (we'll gray them out with reason in the UI)
        return users.filter(u => !assignedIds.has(u.id));
    }, [users, assignedUsers]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return availableUsers;
        return availableUsers.filter(u => (u.name || '').toLowerCase().includes(q));
    }, [availableUsers, query]);

    const typeLabelLocal = (t: AbsenceType) => t === 'VACATION' ? 'Urlaub' : (t === 'SEMINAR' ? 'Seminar' : 'Krank');
    const partLabelLocal = (p?: AbsencePart) => p === 'AM' ? 'Vorm.' : (p === 'PM' ? 'Nachm.' : undefined);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const doAssign = (userId: string) => {
        if (!userId) return;
        const isAdmin = user?.role === Role.ADMIN;
        assignShift(
            date,
            shiftTypeId,
            userId,
            isAdmin ? { allowOverbook: true, adminId: user!.id } : undefined
        );
        setQuery('');
        setIsOpen(false);
        setHighlighted(0);
    };

    const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            setIsOpen(true);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const choice = filtered[highlighted];
            if (choice && !isUserAbsent(date, choice.id)) doAssign(choice.id);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div ref={wrapRef} className="relative mt-2">
            <div className="flex items-center gap-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-slate-500">
                        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                        <input
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setHighlighted(0); }}
                            onFocus={() => setIsOpen(true)}
                            onKeyDown={onKeyDown}
                            className="w-full bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
                            placeholder="Person suchen und zuweisen…"
                        />
                        <button
                            type="button"
                            onClick={() => setIsOpen((o) => !o)}
                            className="rounded p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            aria-label="Aufklappen"
                        >
                            <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                                                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                                        </svg>
                        </button>
                    </div>
                </div>
                {/* Fallback add button for mouse users when an option is highlighted */}
                <button
                    onClick={() => { const choice = filtered[highlighted]; if (choice && !isUserAbsent(date, choice.id)) doAssign(choice.id); }}
                    disabled={filtered.length === 0 || (!!filtered[highlighted] && !!isUserAbsent(date, filtered[highlighted].id))}
                    className="p-2 bg-slate-700 text-white rounded-md hover:bg-slate-800 disabled:bg-gray-300"
                    title="Ausgewählten Benutzer zuweisen"
                >
                    <PlusIcon className="h-5 w-5" />
                </button>
            </div>

            {isOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Keine Treffer</div>
                    ) : (
                        <ul className="max-h-56 overflow-auto py-1">
                            {filtered.map((u, idx) => {
                                const abs = isUserAbsent(date, u.id);
                                const disabled = !!abs;
                                const reason = abs ? `${typeLabelLocal(abs.type)}${abs.part && abs.part !== 'FULL' ? ` · ${partLabelLocal(abs.part)}` : ''}` : '';
                                return (
                                    <li
                                        key={u.id}
                                        onMouseEnter={() => setHighlighted(idx)}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            if (!disabled) doAssign(u.id);
                                        }}
                                        aria-disabled={disabled}
                                        title={disabled ? reason : undefined}
                                        className={`${idx === highlighted ? 'bg-slate-100 dark:bg-slate-700' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} px-3 py-2 flex items-center gap-2`}
                                    >
                                        <Avatar user={u} size={20} />
                                        <span className={`text-sm ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{u.name}</span>
                                        {disabled && (
                                            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300 border border-gray-200 dark:border-slate-600">
                                                {reason}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};


const ScheduleView: React.FC = () => {
    const [showAdmin, setShowAdmin] = useState(false);
    const [showShiftManager, setShowShiftManager] = useState(false);
    const [showUserManager, setShowUserManager] = useState(false);
    const [newShift, setNewShift] = useState({ name: '', startTime: '08:00', endTime: '16:00', color: 'bg-gray-200 text-gray-800', minUsers: 1, maxUsers: 1 });
    const [shiftError, setShiftError] = useState<string>('');
    const [userError, setUserError] = useState<string>('');
    const [newUser, setNewUser] = useState<{ name: string; role: Role; birthday?: string | null; anniversary?: string | null }>({ name: '', role: Role.USER, birthday: null, anniversary: null });
    const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
    const [calLoading, setCalLoading] = useState(false);
    const [calError, setCalError] = useState<string | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const exportWrap = useRef<HTMLDivElement | null>(null);
    const [undoWeek, setUndoWeek] = useState<{ year: number; weekNumber: number; prev: WeekStatus } | null>(null);
    const [showConflicts, setShowConflicts] = useState(false);
    const { user } = useAuth();
    const toast = useToast();
    const { users, shiftTypes, assignments, weekConfigs, assignShift, unassignShift, handoversIncoming, handoversOutgoing, handoversAdmin, refreshHandovers, requestHandover, respondHandover, approveHandover, declineHandover, getEffectiveShiftLimits, absences, isUserAbsent, addAbsence, addAbsenceRange, removeAbsence, dayNotes, setDayNote, removeDayNote, updateWeekStatus, updateWeekOverride, addShiftType, updateShiftType, deleteShiftType, addUser, updateUser, deleteUser } = useSchedule();
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

    // Export-Dropdown: Click-Outside schließen
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!exportWrap.current) return;
            if (!exportWrap.current.contains(e.target as Node)) setExportOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    // Konflikt-Zähler: Übergaben + Unter-/Überbesetzung
    const conflictCount = useMemo(() => {
        let c = 0;
        try {
            // Übergaben
            c += (handoversAdmin?.length || 0) + handoversIncoming.filter(h => h.status === 'REQUESTED').length;
            // Unter-/Überbesetzung pro Tag/Schicht
            for (const day of daysOfWeek) {
                const date = day.toISOString().slice(0, 10);
                for (const st of shiftTypes) {
                    const limits = getEffectiveShiftLimits(date, st.id);
                    const assigned = (assignments[date]?.[st.id] || []).length;
                    if (limits?.min != null && assigned < limits.min) c++;
                    if (limits?.max != null && assigned > limits.max) c++;
                }
            }
        } catch (_e) { /* fail-safe */ }
        return c;
    }, [handoversAdmin, handoversIncoming, daysOfWeek, shiftTypes, assignments, getEffectiveShiftLimits]);

    // Woche sperren/öffnen mit Undo-Status
    const handleToggleWeek = async () => {
        const next = isWeekOpen ? WeekStatus.LOCKED : WeekStatus.OPEN;
        const prev = isWeekOpen ? WeekStatus.OPEN : WeekStatus.LOCKED;
        try {
            await updateWeekStatus(year, weekNumber, next);
            setUndoWeek({ year, weekNumber, prev });
            toast.success(next === WeekStatus.OPEN ? 'Woche geöffnet' : 'Woche gesperrt');
        } catch (e: any) {
            toast.error(e?.message || 'Fehler beim Aktualisieren');
        }
    };

    useEffect(() => {
        if (user) {
            refreshHandovers(user.id);
            if (user.role === Role.ADMIN) {
                refreshHandovers(undefined, true);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            {/* NEO HEADER */}
            <div className="relative sticky top-0 z-20 -m-4 sm:-m-6 p-3 sm:p-4 bg-white/60 dark:bg-slate-900/30 backdrop-blur-lg ring-1 ring-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                {/* Accent gradient line */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-emerald-400 opacity-80" />
                <div className="flex items-center justify-between gap-3">
                    {/* Left cluster: week nav + pill */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <button onClick={() => changeWeek('prev')} aria-label="Vorige Woche" className="group h-9 w-9 grid place-items-center rounded-full bg-white/60 dark:bg-slate-800/50 ring-1 ring-black/5 hover:bg-white/80 transition">
                            <ChevronLeftIcon className="h-5 w-5 text-slate-700 dark:text-slate-200 group-hover:translate-x-[-1px] transition-transform" />
                        </button>
                        <div className="hidden sm:block h-9 w-px bg-gradient-to-b from-transparent via-slate-200/80 to-transparent dark:via-slate-700/60" />
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-slate-50/80 to-white/70 dark:from-slate-800/60 dark:to-slate-900/40 ring-1 ring-slate-200/70 dark:ring-slate-700/60">
                            <span className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-200">KW {weekNumber}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{year}</span>
                            <span className="hidden md:inline text-[11px] text-slate-400 dark:text-slate-500">{daysOfWeek[0].toLocaleDateString('de-DE')} – {daysOfWeek[4].toLocaleDateString('de-DE')}</span>
                        </div>
                        <button onClick={() => changeWeek('next')} aria-label="Nächste Woche" className="group h-9 w-9 grid place-items-center rounded-full bg-white/60 dark:bg-slate-800/50 ring-1 ring-black/5 hover:bg-white/80 transition">
                            <ChevronRightIcon className="h-5 w-5 text-slate-700 dark:text-slate-200 group-hover:translate-x-[1px] transition-transform" />
                        </button>
                    </div>

                    {/* Center cluster: status + conflicts */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full ring-1 ${
                            isWeekOpen
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 ring-emerald-200/80'
                                : 'text-amber-700 dark:text-amber-300 bg-amber-50/80 ring-amber-200/80'
                        }`} aria-live="polite">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${isWeekOpen ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {isWeekOpen ? 'offen' : 'gesperrt'}
                        </div>

                        {conflictCount > 0 && (
                            <button onClick={() => setShowConflicts(true)} title="Konflikte und offene Anfragen"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-rose-50/90 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 active:scale-[0.98] transition">
                                <ExclamationIcon className="h-4 w-4" /> {conflictCount}
                            </button>
                        )}
                    </div>

                    {/* Right cluster: actions */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {isAdmin && (
                            <button onClick={handleToggleWeek} aria-pressed={!isWeekOpen}
                                    title={isWeekOpen ? 'Diese Woche sperren' : 'Diese Woche öffnen'}
                                    className="group inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-white/70 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-white/90 dark:hover:bg-slate-800 transition">
                                {isWeekOpen ? (
                                    <LockClosedIcon className="h-4 w-4 text-slate-700 dark:text-slate-200 group-active:scale-95 transition" />
                                ) : (
                                    <LockOpenIcon className="h-4 w-4 text-slate-700 dark:text-slate-200 group-active:scale-95 transition" />
                                )}
                                <span className="hidden sm:inline text-sm text-slate-800 dark:text-slate-100">{isWeekOpen ? 'Sperren' : 'Öffnen'}</span>
                            </button>
                        )}

                        {undoWeek && (
                            <button onClick={async () => { try { await updateWeekStatus(undoWeek.year, undoWeek.weekNumber, undoWeek.prev); setUndoWeek(null); toast.success('Änderung rückgängig gemacht'); } catch (e: any) { toast.error(e?.message || 'Fehler beim Rückgängig machen'); } }}
                                    className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-white/70 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-white/90 dark:hover:bg-slate-800 text-[11px]">
                                Rückgängig
                            </button>
                        )}

                        {/* Export menu */}
                        <div className="relative" ref={exportWrap}>
                            <button onClick={() => setExportOpen(v => !v)} aria-haspopup="menu" aria-expanded={exportOpen}
                                    className="group inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-white/70 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-white/90 dark:hover:bg-slate-800 transition">
                                <span className="text-sm text-slate-800 dark:text-slate-100">Export</span>
                                <svg className="h-3.5 w-3.5 text-slate-500 group-aria-expanded:rotate-180 transition" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {exportOpen && (
                                <div role="menu" className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white/95 dark:bg-slate-900/95 ring-1 ring-black/5 shadow-xl overflow-hidden">
                                    <div className="py-1">
                                        <button role="menuitem" onClick={copyUrl} disabled={!calendarUrl}
                                                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50/80 dark:hover:bg-slate-800/70">
                                            Link kopieren
                                        </button>
                                        {calendarUrl ? (
                                            <a role="menuitem" href={calendarUrl} target="_blank" rel="noreferrer"
                                               className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/70">Öffnen</a>
                                        ) : (
                                            <button role="menuitem" onClick={handleExport}
                                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/70">Erzeugen & Öffnen</button>
                                        )}
                                        {isAdmin && (
                                            <button role="menuitem" onClick={handleRegenerate}
                                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/70">Neu generieren</button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {isAdmin && (
                            <button onClick={() => setShowAdmin(true)}
                                    className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow hover:opacity-95 active:scale-[0.98] transition">
                                Admin
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Admin Modal */}
            {isAdmin && (
                <AdminModal open={showAdmin} onClose={() => setShowAdmin(false)} currentMonday={daysOfWeek[0]} />
            )}

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

            {isAdmin && handoversAdmin && handoversAdmin.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="font-semibold text-blue-800 mb-2">Übergaben warten auf Bestätigung ({handoversAdmin.length})</p>
                    <div className="space-y-2">
                        {handoversAdmin.map(h => {
                            const st = shiftTypes.find(s => s.id === h.shiftTypeId);
                            const fromUser = users.find(u => u.id === h.fromUserId);
                            const toUser = users.find(u => u.id === h.toUserId);
                            return (
                                <div key={h.id} className="flex items-center justify-between text-sm">
                                    <span>
                                        {fromUser?.name} → {toUser?.name} • {st?.name} am {new Date(h.date).toLocaleDateString('de-DE')}
                                    </span>
                                    <div className="flex gap-2">
                                        <button onClick={() => user && declineHandover(h.id, user.id)} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Ablehnen</button>
                                        <button onClick={() => user && approveHandover(h.id, user.id)} className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">Freigeben</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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
                                        <div key={shiftType.id} className={`p-2.5 rounded-md shadow-sm border ${containerClasses} ${cardHasSick ? 'border-rose-400 ring-1 ring-rose-200' : ''}`} title={titleText}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className={`text-sm font-semibold px-2 py-0.5 rounded-full inline-block ${pastelizeShiftColor(shiftType.color)}`}>
                                                        {shiftType.name}
                                                    </p>
                                                    <p className={`text-xs ${isPerfect ? 'text-emerald-700' : 'text-gray-500'} mt-1`}>{shiftType.startTime} - {shiftType.endTime}</p>
                                                </div>
                                                <div className="text-right">
                                                     <p className={`text-xs font-semibold ${countTextClass}`}>
                                                        {assignedUsers.length} / {effective.maxUsers}
                                                    </p>
                                                    {isUnderstaffed && <ExclamationIcon className="h-5 w-5 text-rose-600 mt-1" title={`Mindestbesetzung: ${effective.minUsers}`} />}
                                                </div>
                                            </div>

                                            {cardHasSick && (
                                                <div className="mt-2 p-2 rounded border border-rose-200 bg-rose-50 text-rose-800 text-xs">
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
                                                    <div key={assignedUser.id} className={`flex items-center justify-between p-2 rounded-lg text-sm font-medium shadow-sm ${isSick ? 'bg-rose-50 text-rose-800 border border-rose-200' : (user?.id === assignedUser.id ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-800 border border-gray-200')}`}>
                                                        <span className="flex items-center gap-2">
                                                            <Avatar user={assignedUser} size={22} />
                                                            <span>{assignedUser.name}</span>
                                                            {isSick && <span className="px-1 py-0.5 text-[10px] rounded bg-red-200 text-red-900">Krank</span>}
                                                            {hasBirthday && <span title="Geburtstag" className="ml-1">🎂</span>}
                                                            {hasAnniversary && <span title="Jubiläum" className="ml-0.5">🎉</span>}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 md:gap-3 flex-wrap md:flex-nowrap justify-end min-w-0">
                                                            {isSick && isAdmin && candidateUsers.length > 0 && (
                                                                <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible pr-1 md:pr-2">
                                                                    <span className="text-[11px] md:text-xs text-gray-600 whitespace-nowrap">Ersatz:</span>
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
                                                                            className="pl-1.5 pr-2 py-0.5 md:px-2 md:py-0.5 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-[11px] md:text-xs flex items-center gap-1.5 md:gap-2"
                                                                            title={`Ersetzen durch ${c.name}`}
                                                                        >
                                                                            <Avatar user={c} size={14} />
                                                                            <span className="whitespace-nowrap">{c.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {/* Separator for desktop to improve spacing between groups */}
                                                            <span className="hidden md:block h-5 w-px bg-gray-200 mx-2 md:mx-3" />
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
                <div className="bg-white dark:bg-slate-800 dark:text-gray-100 rounded-lg shadow-xl w-full max-w-md p-4 border border-gray-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-3">Schicht an anderen Nutzer übergeben</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Wähle den Empfänger aus. Dieser muss die Anfrage annehmen; anschließend muss ein Admin bestätigen.</p>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Empfänger</label>
                        <select
                            value={transferModal.toUserId}
                            onChange={(e) => setTransferModal({ ...transferModal, toUserId: e.target.value })}
                            className="block w-full text-sm rounded-md border border-gray-300 dark:border-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 p-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
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
                        <button onClick={() => setTransferModal(null)} className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-700 dark:text-gray-100 dark:hover:bg-slate-600">Abbrechen</button>
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
                            className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800 disabled:bg-gray-300 dark:disabled:bg-slate-600/50"
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
        {/* Shift-Typen verwalten (Admin) */}
        {isAdmin && showShiftManager && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-slate-800 dark:text-gray-100 rounded-lg shadow-xl w-full max-w-3xl p-4 border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">Schichttypen verwalten</h3>
                        <button onClick={() => setShowShiftManager(false)} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Schließen</button>
                    </div>
                    {shiftError && (<div className="mb-2 text-sm text-red-600">{shiftError}</div>)}
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700">
                                    <th className="py-2 pr-2">Name</th>
                                    <th className="py-2 pr-2">Start</th>
                                    <th className="py-2 pr-2">Ende</th>
                                    <th className="py-2 pr-2">Farbe (Tailwind Klassen)</th>
                                    <th className="py-2 pr-2">Min</th>
                                    <th className="py-2 pr-2">Max</th>
                                    <th className="py-2 pr-2">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shiftTypes.map(st => (
                                    <tr key={st.id} className="border-b border-gray-100 dark:border-slate-700/60">
                                        <td className="py-1 pr-2">
                                            <input defaultValue={st.name} onBlur={(e) => updateShiftType(st.id, { name: e.target.value })} className="w-40 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <input type="time" defaultValue={st.startTime} onBlur={(e) => updateShiftType(st.id, { startTime: e.target.value })} className="w-28 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <input type="time" defaultValue={st.endTime} onBlur={(e) => updateShiftType(st.id, { endTime: e.target.value })} className="w-28 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <input defaultValue={st.color} onBlur={(e) => updateShiftType(st.id, { color: e.target.value })} className="w-64 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <input type="number" min={0} defaultValue={st.minUsers} onBlur={(e) => updateShiftType(st.id, { minUsers: Math.max(0, parseInt(e.target.value || '0', 10)) })} className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <input type="number" min={0} defaultValue={st.maxUsers} onBlur={(e) => updateShiftType(st.id, { maxUsers: Math.max(0, parseInt(e.target.value || '0', 10)) })} className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <button onClick={() => { if (confirm('Diesen Schichttyp wirklich löschen? Dies entfernt auch zugehörige Zuweisungen.')) deleteShiftType(st.id); }} className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700">Löschen</button>
                                        </td>
                                    </tr>
                                ))}
                                <tr>
                                    <td className="py-1 pr-2">
                                        <input value={newShift.name} onChange={(e) => setNewShift(s => ({ ...s, name: e.target.value }))} placeholder="Name" className="w-40 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                    </td>
                                    <td className="py-1 pr-2">
                                        <input type="time" value={newShift.startTime} onChange={(e) => setNewShift(s => ({ ...s, startTime: e.target.value }))} className="w-28 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                    </td>
                                    <td className="py-1 pr-2">
                                        <input type="time" value={newShift.endTime} onChange={(e) => setNewShift(s => ({ ...s, endTime: e.target.value }))} className="w-28 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                    </td>
                                    <td className="py-1 pr-2">
                                        <input value={newShift.color} onChange={(e) => setNewShift(s => ({ ...s, color: e.target.value }))} placeholder="bg-sky-200 text-sky-800" className="w-64 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                    </td>
                                    <td className="py-1 pr-2">
                                        <input type="number" min={0} value={newShift.minUsers} onChange={(e) => setNewShift(s => ({ ...s, minUsers: Math.max(0, parseInt(e.target.value || '0', 10)) }))} className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                    </td>
                                    <td className="py-1 pr-2">
                                        <input type="number" min={0} value={newShift.maxUsers} onChange={(e) => setNewShift(s => ({ ...s, maxUsers: Math.max(0, parseInt(e.target.value || '0', 10)) }))} className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                    </td>
                                    <td className="py-1 pr-2">
                                        <button onClick={() => {
                                            setShiftError('');
                                            if (!newShift.name.trim()) { setShiftError('Name darf nicht leer sein.'); return; }
                                            if (newShift.maxUsers < newShift.minUsers) { setShiftError('Max darf nicht kleiner als Min sein.'); return; }
                                            addShiftType({ name: newShift.name.trim(), startTime: newShift.startTime, endTime: newShift.endTime, color: newShift.color.trim() || 'bg-gray-200 text-gray-800', minUsers: newShift.minUsers, maxUsers: newShift.maxUsers });
                                            setNewShift({ name: '', startTime: '08:00', endTime: '16:00', color: 'bg-gray-200 text-gray-800', minUsers: 1, maxUsers: 1 });
                                        }} className="px-2 py-1 rounded bg-slate-700 text-white hover:bg-slate-800">Hinzufügen</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* Benutzer verwalten (Admin) */}
        {isAdmin && showUserManager && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-slate-800 dark:text-gray-100 rounded-lg shadow-xl w-full max-w-4xl p-4 border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">Benutzer verwalten</h3>
                        <button onClick={() => setShowUserManager(false)} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Schließen</button>
                    </div>
                    {userError && (<div className="mb-2 text-sm text-red-600">{userError}</div>)}

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700">
                                    <th className="py-2 pr-2">Name</th>
                                    <th className="py-2 pr-2">Rolle</th>
                                    <th className="py-2 pr-2">Geburtstag</th>
                                    <th className="py-2 pr-2">Jubiläum</th>
                                    <th className="py-2 pr-2">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} className="border-b border-gray-100 dark:border-slate-700/60">
                                        <td className="py-1 pr-2">
                                            <input defaultValue={u.name} onBlur={(e) => updateUser(u.id, { name: e.target.value })} className="w-48 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <select defaultValue={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value as any })} className="w-36 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900">
                                                <option value={Role.USER}>User</option>
                                                <option value={Role.ADMIN}>Admin</option>
                                            </select>
                                        </td>
                                        <td className="py-1 pr-2">
                                            <input type="date" defaultValue={u.birthday || ''} onBlur={(e) => updateUser(u.id, { birthday: e.target.value || null })} className="w-40 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <input type="date" defaultValue={u.anniversary || ''} onBlur={(e) => updateUser(u.id, { anniversary: e.target.value || null })} className="w-40 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <button onClick={() => { if (confirm('Diesen Benutzer wirklich löschen?')) deleteUser(u.id); }} className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700">Löschen</button>
                                        </td>
                                    </tr>
                                ))}
                                <tr>
                                    <td className="py-1 pr-2">
                                        <input value={newUser.name} onChange={(e) => setNewUser(n => ({ ...n, name: e.target.value }))} placeholder="Name" className="w-48 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                    </td>
                                    <td className="py-1 pr-2">
                                        <select value={newUser.role} onChange={(e) => setNewUser(n => ({ ...n, role: e.target.value as any }))} className="w-36 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900">
                                            <option value={Role.USER}>User</option>
                                            <option value={Role.ADMIN}>Admin</option>
                                        </select>
                                    </td>
                                    <td className="py-1 pr-2">
                                        <input type="date" value={newUser.birthday || ''} onChange={(e) => setNewUser(n => ({ ...n, birthday: e.target.value || null }))} className="w-40 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                    </td>
                                    <td className="py-1 pr-2">
                                        <input type="date" value={newUser.anniversary || ''} onChange={(e) => setNewUser(n => ({ ...n, anniversary: e.target.value || null }))} className="w-40 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                                    </td>
                                    <td className="py-1 pr-2">
                                        <button onClick={() => {
                                            setUserError('');
                                            if (!newUser.name.trim()) { setUserError('Name darf nicht leer sein.'); return; }
                                            addUser({ name: newUser.name.trim(), role: newUser.role, birthday: newUser.birthday || null, anniversary: newUser.anniversary || null });
                                            setNewUser({ name: '', role: Role.USER, birthday: null, anniversary: null });
                                        }} className="px-2 py-1 rounded bg-slate-700 text-white hover:bg-slate-800">Anlegen</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

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