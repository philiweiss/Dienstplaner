export enum Role {
    USER = 'User',
    ADMIN = 'Admin',
}

export interface User {
    id: string;
    name: string;
    role: Role;
}

export interface ShiftType {
    id: string;
    name: string;
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
    color: string;
    minUsers: number;
    maxUsers: number;
}

export interface ShiftAssignment {
    date: string; // "YYYY-MM-DD"
    shiftTypeId: string;
    userIds: string[];
}

export enum WeekStatus {
    LOCKED = 'Gesperrt',
    OPEN = 'Offen',
}

export interface WeekConfig {
    year: number;
    weekNumber: number;
    status: WeekStatus;
}

export interface WeekShiftOverride {
    year: number;
    weekNumber: number;
    shiftTypeId: string;
    minUsers?: number;
    maxUsers?: number;
}

export type HandoverStatus = 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'APPROVED' | 'DECLINED';

export interface HandoverRequest {
    id: string;
    assignmentId: string;
    fromUserId: string;
    toUserId: string;
    date: string; // YYYY-MM-DD
    shiftTypeId: string;
    status: HandoverStatus;
}