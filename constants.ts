import { User, Role, ShiftType, ShiftAssignment, WeekConfig, WeekStatus } from './types';

export const USERS: User[] = [
    { id: 'u1', name: 'Alice Admin', role: Role.ADMIN },
    { id: 'u2', name: 'Bob Bauer', role: Role.USER },
    { id: 'u3', name: 'Charlie Schmidt', role: Role.USER },
    { id: 'u4', name: 'Diana Fischer', role: Role.USER },
];

export const SHIFT_TYPES: ShiftType[] = [
    { id: 'st1', name: 'Frühschicht', startTime: '06:00', endTime: '14:00', color: 'bg-sky-200 text-sky-800', minUsers: 2, maxUsers: 2 },
    { id: 'st2', name: 'Spätschicht', startTime: '14:00', endTime: '22:00', color: 'bg-amber-200 text-amber-800', minUsers: 1, maxUsers: 1 },
    { id: 'st3', name: 'Nachtschicht', startTime: '22:00', endTime: '06:00', color: 'bg-indigo-200 text-indigo-800', minUsers: 1, maxUsers: 1 },
];

// Demo assignments
export const SHIFT_ASSIGNMENTS: ShiftAssignment[] = [
    { date: '2024-07-22', shiftTypeId: 'st1', userIds: ['u2'] },
    { date: '2024-07-22', shiftTypeId: 'st2', userIds: ['u3'] },
    { date: '2024-07-23', shiftTypeId: 'st1', userIds: ['u4'] },
    { date: '2024-07-23', shiftTypeId: 'st3', userIds: ['u2'] },
];

export const WEEK_CONFIGS: WeekConfig[] = [
    { year: 2024, weekNumber: 30, status: WeekStatus.OPEN },
    { year: 2024, weekNumber: 31, status: WeekStatus.LOCKED },
];