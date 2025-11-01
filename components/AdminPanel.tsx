
import React, { useEffect, useState } from 'react';
import { useSchedule } from '../hooks/useSchedule';
import { WeekStatus, Role, User, ShiftType } from '../types';
import { LockClosedIcon, LockOpenIcon, PlusIcon, TrashIcon } from './icons';
import { useAuth } from '../hooks/useAuth';

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

    const renderWeekConfig = (offset: number) => {
        const date = new Date();
        date.setDate(date.getDate() + offset * 7);
        const [year, weekNumber] = getWeekNumber(date);
        const config = weekConfigs.find(wc => wc.year === year && wc.weekNumber === weekNumber) || { status: WeekStatus.LOCKED };

        const toggleStatus = () => {
            const newStatus = config.status === WeekStatus.OPEN ? WeekStatus.LOCKED : WeekStatus.OPEN;
            updateWeekStatus(year, weekNumber, newStatus);
        };

        const setOverride = async () => {
            if (shiftTypes.length === 0) {
                alert('Keine Schichttypen vorhanden.');
                return;
            }
            const list = shiftTypes.map((s, idx) => `${idx + 1}: ${s.name}`).join('\n');
            const sel = window.prompt(`Für welche Schicht soll die Wochen-Besetzung angepasst werden?\n${list}\nGib die Nummer ein:`);
            if (!sel) return;
            const idx = parseInt(sel, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= shiftTypes.length) {
                alert('Ungültige Auswahl.');
                return;
            }
            const st = shiftTypes[idx];
            const minStr = window.prompt(`Min. Besetzung für KW ${weekNumber}/${year} (${st.name}). Leer lassen, um Basiswert zu verwenden.`, '');
            const maxStr = window.prompt(`Max. Besetzung für KW ${weekNumber}/${year} (${st.name}). Leer lassen, um Basiswert zu verwenden.`, '');
            const minUsers = minStr !== null && minStr.trim() !== '' ? Math.max(0, parseInt(minStr, 10) || 0) : undefined;
            const maxUsers = maxStr !== null && maxStr.trim() !== '' ? Math.max(0, parseInt(maxStr, 10) || 0) : undefined;
            if (minUsers === undefined && maxUsers === undefined) {
                alert('Mindestens einen Wert (min oder max) angeben.');
                return;
            }
            if (minUsers !== undefined && maxUsers !== undefined && maxUsers < minUsers) {
                alert('Max darf nicht kleiner als Min sein.');
                return;
            }
            try {
                await updateWeekOverride({ year, weekNumber, shiftTypeId: st.id, minUsers, maxUsers });
                alert('Override gespeichert.');
            } catch (e: any) {
                alert(`Fehler beim Speichern: ${e?.message || e}`);
            }
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

    const onEditShift = (st: ShiftType) => {
        const name = window.prompt('Name', st.name)?.trim();
        if (!name) return;
        const startTime = window.prompt('Start (HH:MM)', st.startTime)?.trim();
        if (!startTime) return;
        const endTime = window.prompt('Ende (HH:MM)', st.endTime)?.trim();
        if (!endTime) return;
        const minStr = window.prompt('Min. Besetzung', String(st.minUsers))?.trim();
        if (minStr === null || minStr === undefined) return;
        const maxStr = window.prompt('Max. Besetzung', String(st.maxUsers))?.trim();
        if (maxStr === null || maxStr === undefined) return;
        const minUsers = Math.max(0, parseInt(minStr || '0', 10) || 0);
        const maxUsers = Math.max(0, parseInt(maxStr || '0', 10) || 0);
        const timeRe = /^\d{2}:\d{2}$/;
        if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
            alert('Zeitformat muss HH:MM sein.');
            return;
        }
        if (maxUsers < minUsers) {
            alert('Max. Besetzung darf nicht kleiner als Min. Besetzung sein.');
            return;
        }
        updateShiftType(st.id, { name, startTime, endTime, minUsers, maxUsers });
    };

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
             <form onSubmit={handleAddShift} className="p-4 bg-gray-50 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Name der Schicht</label>
                    <input type="text" value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm p-2" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Start</label>
                    <input type="time" value={newShift.startTime} onChange={e => setNewShift({...newShift, startTime: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm p-2" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Ende</label>
                    <input type="time" value={newShift.endTime} onChange={e => setNewShift({...newShift, endTime: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm p-2" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Min. Bes.</label>
                    <input type="number" min="0" value={newShift.minUsers} onChange={e => setNewShift({...newShift, minUsers: parseInt(e.target.value) || 0})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm p-2" required />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Max. Bes.</label>
                    <input type="number" min="1" value={newShift.maxUsers} onChange={e => setNewShift({...newShift, maxUsers: parseInt(e.target.value) || 1})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm p-2" required />
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

const UserManagement: React.FC = () => {
    const { users, addUser, deleteUser } = useSchedule();
    const [newUser, setNewUser] = useState({ name: '', role: Role.USER });

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (newUser.name) {
            addUser(newUser as Omit<User, 'id'>);
            setNewUser({ name: '', role: Role.USER });
        }
    };
    
    return (
        <div>
             <form onSubmit={handleAddUser} className="p-4 bg-gray-50 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Benutzername</label>
                    <input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm p-2" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Rolle</label>
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as Role})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm p-2">
                        <option value={Role.USER}>User</option>
                        <option value={Role.ADMIN}>Admin</option>
                    </select>
                </div>
                <div className="md:col-span-full">
                    <button type="submit" className="w-full md:w-auto bg-slate-700 text-white p-2 px-4 rounded-md font-semibold hover:bg-slate-800 flex items-center justify-center">
                        <PlusIcon className="h-5 w-5 mr-2" /> Benutzer hinzufügen
                    </button>
                </div>
            </form>
            <div className="space-y-3">
                {users.map(user => (
                    <div key={user.id} className="p-3 bg-white rounded-lg flex justify-between items-center shadow-sm">
                        <div>
                            <p className="font-semibold text-gray-800">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.role}</p>
                        </div>
                        <button onClick={() => window.confirm(`Benutzer "${user.name}" wirklich löschen?`) && deleteUser(user.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full">
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'weeks' | 'shifts' | 'users' | 'handovers'>('weeks');
    
    const TabButton: React.FC<{ tabId: 'weeks' | 'shifts' | 'users' | 'handovers', children: React.ReactNode}> = ({tabId, children}) => {
        const isActive = activeTab === tabId;
        return (
            <button onClick={() => setActiveTab(tabId)} className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isActive ? 'bg-slate-200 text-slate-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                {children}
            </button>
        )
    };

    const { user } = useAuth();
    const { handoversAdmin, refreshHandovers, approveHandover, declineHandover, shiftTypes, users } = useSchedule();

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
                    <p className="text-sm text-gray-600">Keine Übergaben warten auf Bestätigung.</p>
                )}
                {handoversAdmin.map(h => {
                    const st = shiftTypes.find(s => s.id === h.shiftTypeId);
                    const fromUser = users.find(u => u.id === h.fromUserId);
                    const toUser = users.find(u => u.id === h.toUserId);
                    return (
                        <div key={h.id} className="p-3 bg-white rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-2">
                            <div>
                                <p className="font-semibold text-gray-800">{st?.name} – {new Date(h.date).toLocaleDateString('de-DE')}</p>
                                <p className="text-sm text-gray-600">Von {fromUser?.name} an {toUser?.name}</p>
                            </div>
                            <div className="flex gap-2 self-end sm:self-center">
                                <button onClick={() => user && declineHandover(h.id, user.id)} className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300">Ablehnen</button>
                                <button onClick={() => user && approveHandover(h.id, user.id)} className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700">Bestätigen</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Admin-Panel</h2>
            <p className="text-gray-600">Verwalten Sie hier die Einstellungen des Dienstplaners.</p>

            {/* Admin-Header Hinweis wie beim User: Übergaben, die auf Bestätigung warten */}
            {user?.role === Role.ADMIN && handoversAdmin.length > 0 && (
                <div className="mt-3 mb-6 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="font-semibold text-amber-800 mb-2">
                        Übergaben warten auf Bestätigung ({handoversAdmin.length})
                    </p>
                    <div className="space-y-2">
                        {handoversAdmin.slice(0, 3).map(h => {
                            const st = shiftTypes.find(s => s.id === h.shiftTypeId);
                            const fromUser = users.find(u => u.id === h.fromUserId);
                            const toUser = users.find(u => u.id === h.toUserId);
                            return (
                                <div key={h.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm">
                                    <span>
                                        {fromUser?.name} → {toUser?.name}: {st?.name} am {new Date(h.date).toLocaleDateString('de-DE')}
                                    </span>
                                    <div className="flex gap-2 mt-2 sm:mt-0">
                                        <button onClick={() => user && declineHandover(h.id, user.id)} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Ablehnen</button>
                                        <button onClick={() => user && approveHandover(h.id, user.id)} className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">Bestätigen</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {handoversAdmin.length > 3 && (
                        <p className="text-xs text-amber-800 mt-2">Weitere Einträge finden Sie im Tab „Übergaben“.</p>
                    )}
                </div>
            )}
            
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabId="weeks">Wochen</TabButton>
                    <TabButton tabId="shifts">Schichten</TabButton>
                    <TabButton tabId="users">Nutzer</TabButton>
                    <TabButton tabId="handovers">Übergaben</TabButton>
                </nav>
            </div>

            <div>
                {activeTab === 'weeks' && <WeekManagement />}
                {activeTab === 'shifts' && <ShiftManagement />}
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'handovers' && <HandoversManagement />}
            </div>
        </div>
    );
};

export default AdminPanel;