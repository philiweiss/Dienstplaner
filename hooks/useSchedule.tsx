import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Role, ShiftType, ShiftAssignment, WeekConfig, WeekStatus } from '../types';
import { SHIFT_TYPES } from '../constants';
import * as userApi from '../services/users';
import * as assignmentsApi from '../services/assignments';
import * as weekConfigsApi from '../services/weekConfigs';

interface ScheduleContextType {
    users: User[];
    shiftTypes: ShiftType[];
    assignments: ShiftAssignment[];
    weekConfigs: WeekConfig[];
    assignShift: (date: string, shiftTypeId: string, userId: string) => void;
    unassignShift: (date: string, shiftTypeId: string, userId: string) => void;
    updateWeekStatus: (year: number, weekNumber: number, status: WeekStatus) => void;
    addShiftType: (shiftType: Omit<ShiftType, 'id' | 'minUsers' | 'maxUsers'> & { minUsers: number, maxUsers: number }) => void;
    deleteShiftType: (id: string) => void;
    addUser: (user: Omit<User, 'id'>) => void;
    deleteUser: (id: string) => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const ScheduleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(SHIFT_TYPES);
    const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
    const [weekConfigs, setWeekConfigs] = useState<WeekConfig[]>([]);

    // Load users and assignments from backend on mount
    useEffect(() => {
        (async () => {
            try {
                const data = await userApi.listUsers();
                setUsers(data);
            } catch (e) {
                console.error('[useSchedule] Failed to load users from API', e);
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
        setWeekConfigs(prev => {
            const existing = prev.find(wc => wc.year === year && wc.weekNumber === weekNumber);
            if (existing) {
                return prev.map(wc => wc.year === year && wc.weekNumber === weekNumber ? { ...wc, status } : wc);
            }
            return [...prev, { year, weekNumber, status }];
        });
    };

    const addShiftType = (shiftType: Omit<ShiftType, 'id'>) => {
        const newShiftType: ShiftType = { ...shiftType, id: `st-${Date.now()}` };
        setShiftTypes(prev => [...prev, newShiftType]);
    };
    
    const deleteShiftType = (id: string) => {
        setShiftTypes(prev => prev.filter(st => st.id !== id));
        setAssignments(prev => prev.filter(a => a.shiftTypeId !== id));
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
        <ScheduleContext.Provider value={{ users, shiftTypes, assignments, weekConfigs, assignShift, unassignShift, updateWeekStatus, addShiftType, deleteShiftType, addUser, deleteUser }}>
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