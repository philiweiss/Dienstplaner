
import { ShiftAssignment, ShiftType, User } from '../types';

// Simple UID generator
const generateUID = () => `uid-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Format date for iCalendar
const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

export const generateICS = (user: User, userAssignments: { assignment: ShiftAssignment; shiftType: ShiftType }[]) => {
    const now = new Date();
    const VCALENDAR_START = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//IT-Dienstplaner//DE',
    ];

    const VCALENDAR_END = ['END:VCALENDAR'];

    const events = userAssignments.map(({ assignment, shiftType }) => {
        const startDate = new Date(`${assignment.date}T${shiftType.startTime}:00`);
        let endDate = new Date(`${assignment.date}T${shiftType.endTime}:00`);

        // Handle overnight shifts
        if (endDate <= startDate) {
            endDate.setDate(endDate.getDate() + 1);
        }

        return [
            'BEGIN:VEVENT',
            `UID:${generateUID()}`,
            `DTSTAMP:${formatICSDate(now)}`,
            `DTSTART:${formatICSDate(startDate)}`,
            `DTEND:${formatICSDate(endDate)}`,
            `SUMMARY:${shiftType.name}`,
            `DESCRIPTION:Dienstplan für ${user.name}: ${shiftType.name}`,
            'END:VEVENT'
        ].join('\r\n');
    });

    const icsContent = [...VCALENDAR_START, ...events, ...VCALENDAR_END].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dienstplan_${user.name.replace(/\s/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
