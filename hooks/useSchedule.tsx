import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Role, ShiftType, ShiftAssignment, WeekConfig, WeekStatus, HandoverRequest, WeekShiftOverride, Absence, AbsenceType } from '../types';
import * as userApi from '../services/users';
import * as assignmentsApi from '../services/assignments';
import * as shiftTypeApi from '../services/shiftTypes';
import * as weekConfigsApi from '../services/weekConfigs';
import * as weekOverridesApi from '../services/weekOverrides';
import * as handoverApi from '../services/handovers';
import * as absencesApi from '../services/absences';

interface ScheduleContextType {
    users: User[];
    shiftTypes: ShiftType[];
    assignments: ShiftAssignment[];
    weekConfigs: WeekConfig[];
    handoversIncoming: HandoverRequest[];
    handoversOutgoing: HandoverRequest[];
    handoversAdmin: HandoverRequest[];
    absences: Absence[];
    isUserAbsent: (date: string, userId: string) => Absence | undefined;
    addAbsence: (userId: string, date: string, type: AbsenceType, note?: string | null) => Promise<void>;
    removeAbsence: (id: string) => Promise<void>;
    refreshHandovers: (userId?: string, isAdmin?: boolean) => Promise<void>;
    requestHandover: (date: string, shiftTypeId: string, fromUserId: string, toUserId: string) => Promise<void>;
    respondHandover: (id: string, userId: string, action: 'accept' | 'reject') => Promise<void>;
    approveHandover: (id: string, adminId: string) => Promise<void>;
    declineHandover: (id: string, adminId: string) => Promise<void>;
    assignShift: (date: string, shiftTypeId: string, userId: string) => void;
    unassignShift: (date: string, shiftTypeId: string, userId: string) => void;
    updateWeekStatus: (year: number, weekNumber: number, status: WeekStatus) => void;
    addShiftType: (shiftType: Omit<ShiftType, 'id'>) => void;
    updateShiftType: (id: string, fields: Partial<Omit<ShiftType, 'id'>>) => void;
    deleteShiftType: (id: string) => void;
    addUser: (user: Omit<User, 'id'>) => void;
    updateUser: (id: string, fields: { name?: string; role?: Role; birthday?: string | null; anniversary?: string | null }) => void;
    deleteUser: (id: string) => void;
    getEffectiveShiftLimits: (date: string, shiftTypeId: string) => { minUsers: number; maxUsers: number };
    updateWeekOverride: (input: { year: number; weekNumber: number; shiftTypeId: string; minUsers?: number; maxUsers?: number }) => Promise<void>;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const ScheduleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
    const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
    const [weekConfigs, setWeekConfigs] = useState<WeekConfig[]>([]);
    const [handoversIncoming, setHandoversIncoming] = useState<HandoverRequest[]>([]);
    const [handoversOutgoing, setHandoversOutgoing] = useState<HandoverRequest[]>([]);
    const [handoversAdmin, setHandoversAdmin] = useState<HandoverRequest[]>([]);
    const [weekOverrides, setWeekOverrides] = useState<WeekShiftOverride[]>([]);
    const [absences, setAbsences] = useState<Absence[]>([]);

    // Load users, assignments, week configs, shift types, and absences from backend on mount
    useEffect(() => {
        (async () => {
            try {
                const data = await userApi.listUsers();
                setUsers(data);
            } catch (e) {
                console.error('[useSchedule] Failed to load users from API', e);
            }
            try {
                // Load shift types
                const sts = await shiftTypeApi.listShiftTypes();
                setShiftTypes(sts);
            } catch (e) {
                console.error('[useSchedule] Failed to load shift types from API', e);
            }
            try {
                // Load a rolling window: current week -4 to +8 weeks
                const today = new Date();
                const day = today.getDay();
                const monday = new Date(today);
                monday.setDate(today.getDate() - ((day + 6) % 7)); // get Monday of this week
                const start = new Date(monday);
                start.setDate(monday.getDate() - 28);
                const end = new Date(monday);
                end.setDate(monday.getDate() + 56);
                const fmt = (d: Date) => d.toISOString().slice(0,10);
                const dataA = await assignmentsApi.listAssignments(fmt(start), fmt(end));
                setAssignments(dataA);
                try {
                    const dataAbs = await absencesApi.list(fmt(start), fmt(end));
                    setAbsences(dataAbs);
                } catch (e) {
                    console.error('[useSchedule] Failed to load absences from API', e);
                }
            } catch (e) {
                console.error('[useSchedule] Failed to load assignments from API', e);
            }
            try {
                // Load week configs (current year only to reduce payload)
                const year = new Date().getFullYear();
                const configs = await weekConfigsApi.listWeekConfigs(year);
                setWeekConfigs(configs);
            } catch (e) {
                console.error('[useSchedule] Failed to load week configs from API', e);
            }
        })();
    }, []);

    // Load week overrides for current year
    useEffect(() => {
        (async () => {
            try {
                const year = new Date().getFullYear();
                const overrides = await weekOverridesApi.listWeekOverrides(year);
                setWeekOverrides(overrides);
            } catch (e) {
                console.error('[useSchedule] Failed to load week overrides', e);
            }
        })();
    }, []);

    const getIsoWeek = (d: Date): [number, number] => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return [date.getUTCFullYear(), weekNo];
    };

    const getEffectiveShiftLimits = (date: string, shiftTypeId: string) => {
        const base = shiftTypes.find(st => st.id === shiftTypeId);
        const baseMin = base?.minUsers ?? 0;
        const baseMax = base?.maxUsers ?? 0;
        const [y, w] = getIsoWeek(new Date(date));
        const ov = weekOverrides.find(o => o.year === y && o.weekNumber === w && o.shiftTypeId === shiftTypeId);
        const minUsers = ov?.minUsers !== undefined ? ov.minUsers : baseMin;
        const maxUsers = ov?.maxUsers !== undefined ? ov.maxUsers : baseMax;
        return { minUsers, maxUsers };
    };

    const updateWeekOverride = async (input: { year: number; weekNumber: number; shiftTypeId: string; minUsers?: number; maxUsers?: number }) => {
        try {
            const saved = await weekOverridesApi.updateWeekOverride(input);
            setWeekOverrides(prev => {
                const idx = prev.findIndex(o => o.year === saved.year && o.weekNumber === saved.weekNumber && o.shiftTypeId === saved.shiftTypeId);
                if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = saved;
                    return copy;
                }
                return [...prev, saved];
            });
        } catch (e) {
            console.error('[useSchedule] Failed to update week override', e);
            throw e;
        }
    };

    // Handovers API wrappers
    const refreshHandovers = async (userId?: string, isAdmin?: boolean) => {
        try {
            if (userId) {
                const mine = await handoverApi.listMine(userId);
                setHandoversIncoming(mine.incoming);
                setHandoversOutgoing(mine.outgoing);
            }
            if (isAdmin) {
                const admin = await handoverApi.listAdmin();
                setHandoversAdmin(admin);
            }
        } catch (e) {
            console.error('[useSchedule] Failed to load handovers', e);
        }
    };

    const isUserAbsent = (date: string, userId: string) => absences.find(a => a.date === date && a.userId === userId);

    const assignShift = (date: string, shiftTypeId: string, userId: string) => {
        // Prevent assigning if absent (UI-side guard; backend also enforces)
        if (isUserAbsent(date, userId)) {
            return;
        }
        // optimistic update
        setAssignments(prev => {
            const assignmentIndex = prev.findIndex(a => a.date === date && a.shiftTypeId === shiftTypeId);
            if (assignmentIndex > -1) {
                const updatedAssignments = [...prev];
                const assignment = { ...updatedAssignments[assignmentIndex] };
                if (!assignment.userIds.includes(userId)) {
                    assignment.userIds = [...assignment.userIds, userId];
                    updatedAssignments[assignmentIndex] = assignment;
                }
                return updatedAssignments;
            }
            return [...prev, { date, shiftTypeId, userIds: [userId] }];
        });
        // persist
        (async () => {
            try {
                await assignmentsApi.assign(date, shiftTypeId, userId);
            } catch (e) {
                console.error('[useSchedule] Failed to persist assignment', e);
                // rollback on error
                setAssignments(prev => prev.map(a => (
                    a.date === date && a.shiftTypeId === shiftTypeId
                      ? { ...a, userIds: a.userIds.filter(id => id !== userId) }
                      : a
                )));
            }
        })();
    };

    const addAbsence = async (userId: string, date: string, type: AbsenceType, note?: string | null) => {
        try {
            const created = await absencesApi.create(userId, date, type, note);
            setAbsences(prev => [...prev, created]);
        } catch (e) {
            console.error('[useSchedule] Failed to create absence', e);
            throw e;
        }
    };

    const removeAbsence = async (id: string) => {
        const prev = absences;
        setAbsences(prev => prev.filter(a => a.id !== id));
        try {
            await absencesApi.remove(id);
        } catch (e) {
            console.error('[useSchedule] Failed to delete absence', e);
            setAbsences(prev);
            throw e;
        }
    };

    const requestHandover = async (date: string, shiftTypeId: string, fromUserId: string, toUserId: string) => {
        try {
            await handoverApi.createHandover({ date, shiftTypeId, fromUserId, toUserId });
            // refresh lists for both users is ideal; here we refresh fromUser side
            await refreshHandovers(fromUserId);
        } catch (e) {
            console.error('[useSchedule] Failed to create handover', e);
            throw e;
        }
    };

    const respondHandover = async (id: string, userId: string, action: 'accept' | 'reject') => {
        try {
            await handoverApi.respond(id, userId, action);
            await refreshHandovers(userId);
        } catch (e) {
            console.error('[useSchedule] Failed to respond to handover', e);
            throw e;
        }
    };

    const approveHandover = async (id: string, adminId: string) => {
        try {
            const res = await handoverApi.approve(id, adminId);
            if (res.status === 'APPROVED') {
                // Optimistically reflect on assignments by reloading rolling window
                const today = new Date();
                const day = today.getDay();
                const monday = new Date(today);
                monday.setDate(today.getDate() - ((day + 6) % 7));
                const start = new Date(monday); start.setDate(monday.getDate() - 28);
                const end = new Date(monday); end.setDate(monday.getDate() + 56);
                const fmt = (d: Date) => d.toISOString().slice(0,10);
                const dataA = await assignmentsApi.listAssignments(fmt(start), fmt(end));
                setAssignments(dataA);
                await refreshHandovers(undefined, true);
            }
        } catch (e) {
            console.error('[useSchedule] Failed to approve handover', e);
            throw e;
        }
    };

    const declineHandover = async (id: string, adminId: string) => {
        try {
            await handoverApi.decline(id, adminId);
            await refreshHandovers(undefined, true);
        } catch (e) {
            console.error('[useSchedule] Failed to decline handover', e);
            throw e;
        }
    };

    const unassignShift = (date: string, shiftTypeId: string, userId: string) => {
        // optimistic update
        setAssignments(prev =>
            prev.map(a =>
                a.date === date && a.shiftTypeId === shiftTypeId
                    ? { ...a, userIds: a.userIds.filter(id => id !== userId) }
                    : a
            )
        );
        // persist
        (async () => {
            try {
                await assignmentsApi.unassign(date, shiftTypeId, userId);
            } catch (e) {
                console.error('[useSchedule] Failed to persist unassignment', e);
                // rollback: add back the user
                setAssignments(prev =>
                    prev.map(a =>
                        a.date === date && a.shiftTypeId === shiftTypeId
                            ? { ...a, userIds: a.userIds.includes(userId) ? a.userIds : [...a.userIds, userId] }
                            : a
                    )
                );
            }
        })();
    };
    
    const updateWeekStatus = (year: number, weekNumber: number, status: WeekStatus) => {
        // optimistic update
        setWeekConfigs(prev => {
            const existing = prev.find(wc => wc.year === year && wc.weekNumber === weekNumber);
            if (existing) {
                return prev.map(wc => wc.year === year && wc.weekNumber === weekNumber ? { ...wc, status } : wc);
            }
            return [...prev, { year, weekNumber, status }];
        });
        // persist and rollback on error
        (async () => {
            try {
                await weekConfigsApi.updateWeekConfig({ year, weekNumber, status });
            } catch (e) {
                console.error('[useSchedule] Failed to persist week status', e);
                // rollback: refetch or revert entry
                try {
                    const configs = await weekConfigsApi.listWeekConfigs(new Date().getFullYear());
                    setWeekConfigs(configs);
                } catch (e2) {
                    // fallback: revert only this item to opposite
                    setWeekConfigs(prev => prev.map(wc => (
                        wc.year === year && wc.weekNumber === weekNumber
                          ? { ...wc, status: wc.status === WeekStatus.OPEN ? WeekStatus.LOCKED : WeekStatus.OPEN }
                          : wc
                    )));
                }
            }
        })();
    };

    const addShiftType = (shiftType: Omit<ShiftType, 'id'>) => {
        (async () => {
            try {
                const created = await shiftTypeApi.createShiftType(shiftType);
                setShiftTypes(prev => [...prev, created]);
            } catch (e) {
                console.error('[useSchedule] Failed to create shift type', e);
            }
        })();
    };
    
    const updateShiftType = (id: string, fields: Partial<Omit<ShiftType, 'id'>>) => {
        // optimistic update
        const prevSnapshot = shiftTypes;
        setShiftTypes(prev => prev.map(st => st.id === id ? { ...st, ...fields } as ShiftType : st));
        (async () => {
            try {
                await shiftTypeApi.updateShiftType(id, fields);
            } catch (e) {
                console.error('[useSchedule] Failed to update shift type', e);
                // rollback on error
                setShiftTypes(prevSnapshot);
            }
        })();
    };

    const deleteShiftType = (id: string) => {
        // optimistic remove
        const prevShiftTypes = shiftTypes;
        const prevAssignments = assignments;
        setShiftTypes(prev => prev.filter(st => st.id !== id));
        setAssignments(prev => prev.filter(a => a.shiftTypeId !== id));
        (async () => {
            try {
                await shiftTypeApi.deleteShiftType(id);
            } catch (e) {
                console.error('[useSchedule] Failed to delete shift type', e);
                // rollback
                setShiftTypes(prevShiftTypes);
                setAssignments(prevAssignments);
            }
        })();
    };

    const addUser = (user: Omit<User, 'id'>) => {
        // fire-and-forget to backend; update state on success
        (async () => {
            try {
                const created = await userApi.createUser(user);
                setUsers(prev => [...prev, created]);
            } catch (e) {
                console.error('[useSchedule] Failed to create user', e);
            }
        })();
    };

    const deleteUser = (id: string) => {
        // optimistically remove, then confirm with backend
        setUsers(prev => prev.filter(u => u.id !== id));
        setAssignments(prev =>
            prev.map(a => ({
                ...a,
                userIds: a.userIds.filter(uid => uid !== id),
            }))
        );
        (async () => {
            try { await userApi.deleteUser(id); } catch (e) { console.error('[useSchedule] Failed to delete user', e); }
        })();
    };

    const updateUser = (id: string, fields: { name?: string; role?: Role; birthday?: string | null; anniversary?: string | null }) => {
        // optimistic update
        const prevSnapshot = users;
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ...fields } : u));
        (async () => {
            try {
                await userApi.updateUser(id, fields);
            } catch (e) {
                console.error('[useSchedule] Failed to update user', e);
                setUsers(prevSnapshot);
            }
        })();
    };

    return (
        <ScheduleContext.Provider value={{
            users,
            shiftTypes,
            assignments,
            weekConfigs,
            handoversIncoming,
            handoversOutgoing,
            handoversAdmin,
            absences,
            isUserAbsent,
            addAbsence,
            removeAbsence,
            refreshHandovers,
            requestHandover,
            respondHandover,
            approveHandover,
            declineHandover,
            assignShift,
            unassignShift,
            updateWeekStatus,
            addShiftType,
            updateShiftType,
            deleteShiftType,
            addUser,
            updateUser,
            deleteUser,
            getEffectiveShiftLimits,
            updateWeekOverride
        }}>
            {children}
        </ScheduleContext.Provider>
    );
};

export const useSchedule = (): ScheduleContextType => {
    const context = useContext(ScheduleContext);
    if (context === undefined) {
        throw new Error('useSchedule must be used within a ScheduleProvider');
    }
    return context;
};