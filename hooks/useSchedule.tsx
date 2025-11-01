import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Role, ShiftType, ShiftAssignment, WeekConfig, WeekStatus } from '../types';
import * as userApi from '../services/users';
import * as assignmentsApi from '../services/assignments';
import * as shiftTypeApi from '../services/shiftTypes';
import * as weekConfigsApi from '../services/weekConfigs';

interface ScheduleContextType {
    users: User[];
    shiftTypes: ShiftType[];
    assignments: ShiftAssignment[];
    weekConfigs: WeekConfig[];
    assignShift: (date: string, shiftTypeId: string, userId: string) => void;
    unassignShift: (date: string, shiftTypeId: string, userId: string) => void;
    updateWeekStatus: (year: number, weekNumber: number, status: WeekStatus) => void;
    addShiftType: (shiftType: Omit<ShiftType, 'id'>) => void;
    updateShiftType: (id: string, fields: Partial<Omit<ShiftType, 'id'>>) => void;
    deleteShiftType: (id: string) => void;
    addUser: (user: Omit<User, 'id'>) => void;
    deleteUser: (id: string) => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const ScheduleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
    const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
    const [weekConfigs, setWeekConfigs] = useState<WeekConfig[]>([]);

    // Load users, assignments, week configs, and shift types from backend on mount
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

    const assignShift = (date: string, shiftTypeId: string, userId: string) => {
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

    return (
        <ScheduleContext.Provider value={{ users, shiftTypes, assignments, weekConfigs, assignShift, unassignShift, updateWeekStatus, addShiftType, updateShiftType, deleteShiftType, addUser, deleteUser }}>
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