export enum Role {
    USER = 'User',
    ADMIN = 'Admin',
}

export interface User {
    id: string;
    name: string;
    role: Role;
    birthday?: string | null; // YYYY-MM-DD
    anniversary?: string | null; // YYYY-MM-DD (Betriebszugehörigkeit)
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

export type AbsenceType = 'VACATION' | 'SEMINAR' | 'SICK';
export type AbsencePart = 'FULL' | 'AM' | 'PM';

export interface Absence {
    id: string;
    userId: string;
    date: string; // YYYY-MM-DD
    type: AbsenceType;
    part?: AbsencePart; // FULL (default) | AM | PM
    note?: string | null;
    userName?: string; // optional: provided by backend for convenience in admin views
}

export interface DayNote {
    date: string; // YYYY-MM-DD
    note: string;
    adminOnly?: boolean; // visible only to admins if true
    approved?: boolean; // must be approved by admin if created by user
    updatedAt?: string; // ISO timestamp
    createdBy?: string | null; // user id who created the note
    approvedBy?: string | null; // admin id who approved
}