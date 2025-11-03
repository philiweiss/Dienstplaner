
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';
import { CalendarIcon, LogoutIcon, MoonIcon, SunIcon, BellIcon, CogIcon } from './icons';
import { getUserStats, type UserStats } from '../services/stats';
import { useTheme } from '../hooks/useTheme';
import { getUnreadChangesCount, getRecentChanges, markChangesSeen, formatChangeText, type ChangeItem } from '../services/changes';

interface HeaderProps {
    currentView: 'schedule' | 'profile';
    setView: (view: 'schedule' | 'profile') => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [unread, setUnread] = useState<number>(0);
    const [open, setOpen] = useState(false);
    const [recent, setRecent] = useState<ChangeItem[] | null>(null);
    const [loadingRecent, setLoadingRecent] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!user) return;
            setLoading(true);
            try {
                const s = await getUserStats(user.id);
                if (!cancelled) setStats(s);
            } catch (_e) {
                if (!cancelled) setStats(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [user?.id]);

    if (!user) return null;

    const navItemClasses = "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors";
    const activeClasses = "bg-slate-200 text-slate-900 dark:bg-slate-900 dark:text-white";
    const inactiveClasses = "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white";

    return (
        <header className="fixed top-0 inset-x-0 z-40 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14">
                    <div className="flex items-center gap-6">
                        <div className="flex-shrink-0 leading-none select-none">
                           <h1 className="text-lg sm:text-xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">IT‑Dienstplaner</h1>
                        </div>
                        <nav className="hidden md:block">
                            <div className="flex items-center rounded-full bg-slate-100/60 dark:bg-slate-800/60 p-1">
                                <a onClick={() => setView('schedule')} className={`${currentView === 'schedule' ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/50 dark:hover:text-white dark:hover:bg-slate-800/80'} flex items-center px-3 py-1.5 text-sm font-medium rounded-full cursor-pointer transition-colors`}>
                                    <CalendarIcon className="h-5 w-5 mr-1.5" />
                                    <span className="hidden sm:inline">Dienstplan</span>
                                    <span className="sm:hidden">Plan</span>
                                </a>
                                <a onClick={() => setView('profile')} className={`${currentView === 'profile' ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/50 dark:hover:text-white dark:hover:bg-slate-800/80'} flex items-center px-3 py-1.5 text-sm font-medium rounded-full cursor-pointer transition-colors ml-1`}>
                                    <span className="h-5 w-5 mr-1.5 inline-flex items-center justify-center rounded-full bg-slate-600 text-white text-[10px] leading-none">P</span>
                                    <span>Profil</span>
                                </a>
                            </div>
                        </nav>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Compact stats */}
                        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <span className="hidden xl:inline">Schichten</span>
                            <span className="mx-1 hidden xl:inline opacity-30">•</span>
                            <span className="inline-flex items-center px-2 h-6 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-900 dark:text-white font-medium" title="Gesamtzahl deiner Schichten">
                                {loading ? '…' : (stats?.total ?? 0)}
                            </span>
                            {stats?.byShiftType?.map((s) => (
                                <span key={s.shiftTypeId} className={`inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium ${s.color}`} title={`${s.name}: ${s.count}`}>
                                    {s.count}
                                </span>
                            ))}
                        </div>

                        <div className="hidden sm:block text-sm text-slate-600 dark:text-slate-300">
                            <span className="align-middle">{user.name}</span>
                            <span className="mx-1 opacity-30">·</span>
                            <span className="uppercase text-[11px] tracking-wide text-slate-500 dark:text-slate-400">{user.role}</span>
                        </div>

                        <button onClick={toggleTheme} className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-black/5 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50" title={theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}>
                            {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                        </button>
                        <button onClick={logout} className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-black/5 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50" title="Abmelden">
                            <LogoutIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Nav */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
                <div className="flex items-stretch justify-around">
                    <a onClick={() => setView('schedule')} className={`flex-1 flex flex-col items-center justify-center py-2 text-xs ${currentView === 'schedule' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'} active:opacity-80`}>
                        <CalendarIcon className="h-5 w-5 mb-0.5" />
                        <span>Plan</span>
                    </a>
                    {user.role === Role.ADMIN && (
                        <a onClick={() => setView('admin')} className={`flex-1 flex flex-col items-center justify-center py-2 text-xs ${currentView === 'admin' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'} active:opacity-80`}>
                            <CogIcon className="h-5 w-5 mb-0.5" />
                            <span>Admin</span>
                        </a>
                    )}
                    <a onClick={() => setView('profile')} className={`flex-1 flex flex-col items-center justify-center py-2 text-xs ${currentView === 'profile' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'} active:opacity-80`}>
                        <span className="h-5 w-5 mb-0.5 inline-flex items-center justify-center rounded-full bg-slate-600 text-white text-[10px] leading-none">P</span>
                        <span>Profil</span>
                    </a>
                </div>
            </nav>
        </header>
    );
};

export default Header;