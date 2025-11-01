
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSchedule } from '../hooks/useSchedule';
import { Role, WeekStatus, User } from '../types';
import { getOrCreateCalendarUrl, regenerateCalendarUrl } from '../services/calendar';
import { ChevronLeftIcon, ChevronRightIcon, LockClosedIcon, PlusIcon, TrashIcon, ExclamationIcon } from './icons';

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
    const [selectedUserId, setSelectedUserId] = useState('');

    const availableUsers = useMemo(() => {
        const assignedIds = new Set(assignedUsers.map(u => u.id));
        return users.filter(u => !assignedIds.has(u.id) && !isUserAbsent(date, u.id));
    }, [users, assignedUsers, date, isUserAbsent]);

    const handleAssign = () => {
        if (selectedUserId) {
            assignShift(date, shiftTypeId, selectedUserId);
            setSelectedUserId('');
        }
    };

    return (
        <div className="flex items-center space-x-2 mt-2">
            <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 p-2 bg-gray-50"
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
    const { users, shiftTypes, assignments, weekConfigs, assignShift, unassignShift, handoversIncoming, handoversOutgoing, refreshHandovers, requestHandover, respondHandover, getEffectiveShiftLimits, absences, isUserAbsent, addAbsence, removeAbsence } = useSchedule();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [transferModal, setTransferModal] = useState<{ open: boolean; date: string; shiftTypeId: string; toUserId: string } | null>(null);

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
            // simple feedback via alert to keep minimal
            alert('URL kopiert');
        } catch (_) {}
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
                        <div className="flex items-center text-sm font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full">
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

                            {/* Admin-Übersicht: Wer ist abwesend (Urlaub/Seminar) */}
                            {isAdmin && (() => {
                                const dayAbs = absences.filter(a => a.date === dateString);
                                if (dayAbs.length === 0) return null;
                                return (
                                    <div className="mb-3">
                                        <div className="text-xs font-semibold text-gray-600 mb-1">Abwesend:</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {dayAbs.map(a => {
                                                const u = users.find(x => x.id === a.userId);
                                                const label = a.type === 'VACATION' ? 'Urlaub' : 'Seminar';
                                                return (
                                                    <span key={a.id} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                                                        <span>{a.userName || u?.name || a.userId} · {label}</span>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('Abwesenheit wirklich entfernen?')) {
                                                                    removeAbsence(a.id);
                                                                }
                                                            }}
                                                            className="text-blue-700 hover:text-blue-900"
                                                            title="Abwesenheit löschen"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Abwesenheit (Urlaub/Seminar) für aktuellen Nutzer */}
                            {user && (
                                <div className="mb-3 flex items-center justify-center gap-2">
                                    {isWeekOpen ? (
                                        (() => {
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
                                        })()
                                    ) : (
                                        (() => {
                                            const myAbs = isUserAbsent(dateString, user.id);
                                            return myAbs ? (
                                                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs">
                                                    <span>{myAbs.type === 'VACATION' ? 'Urlaub' : 'Seminar'}</span>
                                                </div>
                                            ) : null;
                                        })()
                                    )}
                                </div>
                            )}

                            <div className="space-y-3">
                                {shiftTypes.map(shiftType => {
                                    const assignment = assignments.find(a => a.date === dateString && a.shiftTypeId === shiftType.id);
                                    const assignedUsers = assignment ? assignment.userIds.map(uid => users.find(u => u.id === uid)).filter((u): u is User => !!u) : [];
                                    
                                    const effective = getEffectiveShiftLimits(dateString, shiftType.id);
                                    const isFull = assignedUsers.length >= effective.maxUsers;
                                    const isUnderstaffed = assignedUsers.length < effective.minUsers;
                                    const userIsAssigned = user ? assignedUsers.some(u => u.id === user.id) : false;
                                    const canSelfRegister = !isFull && isWeekOpen && !userIsAssigned && !(user && isUserAbsent(dateString, user.id));
                                    
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

                                    return (
                                        <div key={shiftType.id} className={`p-2.5 rounded-md shadow-sm border bg-white ${isUnderstaffed && assignedUsers.length > 0 ? 'border-red-400' : 'border-gray-200'}`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className={`text-sm font-semibold px-2 py-0.5 rounded-full inline-block ${shiftType.color}`}>
                                                        {shiftType.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">{shiftType.startTime} - {shiftType.endTime}</p>
                                                </div>
                                                <div className="text-right">
                                                     <p className="text-xs font-semibold text-gray-600">
                                                        {assignedUsers.length} / {effective.maxUsers}
                                                    </p>
                                                    {isUnderstaffed && <ExclamationIcon className="h-5 w-5 text-red-500 mt-1" title={`Mindestbesetzung: ${effective.minUsers}`} />}
                                                </div>
                                            </div>
                                           
                                            <div className="space-y-1.5 mt-2">
                                                {assignedUsers.map(assignedUser => {
                                                    const md = dateString.slice(5); // MM-DD
                                                    const hasBirthday = assignedUser.birthday ? assignedUser.birthday.slice(5) === md : false;
                                                    const hasAnniversary = assignedUser.anniversary ? assignedUser.anniversary.slice(5) === md : false;
                                                    return (
                                                    <div key={assignedUser.id} className={`flex items-center justify-between p-1.5 rounded text-sm font-medium ${user?.id === assignedUser.id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                        <span className="flex items-center gap-1">
                                                            {assignedUser.name}
                                                            {hasBirthday && <span title="Geburtstag" className="ml-1">🎂</span>}
                                                            {hasAnniversary && <span title="Jubiläum" className="ml-0.5">🎉</span>}
                                                        </span>
                                                        <div className="flex items-center gap-1">
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
                                            
                                            {isAdmin && !isFull && (
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
                                    alert('Übergabe-Anfrage wurde gesendet.');
                                    setTransferModal(null);
                                } catch (e: any) {
                                    alert(e?.message || 'Anfrage fehlgeschlagen');
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
    </div>
    );
};

export default ScheduleView;