
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';
import { CalendarIcon, CogIcon, LogoutIcon, MoonIcon, SunIcon } from './icons';
import { getUserStats, type UserStats } from '../services/stats';
import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
    currentView: 'schedule' | 'admin' | 'profile';
    setView: (view: 'schedule' | 'admin' | 'profile') => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(false);

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
        <header className="bg-white border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                           <h1 className="text-xl font-bold text-slate-900 dark:text-white">IT-Dienstplaner Pro</h1>
                        </div>
                        <nav className="hidden md:block ml-10">
                            <div className="flex items-baseline space-x-4">
                                <a onClick={() => setView('schedule')} className={`${navItemClasses} ${currentView === 'schedule' ? activeClasses : inactiveClasses}`}>
                                    <CalendarIcon className="h-5 w-5 mr-2" />
                                    Dienstplan
                                </a>
                                {user.role === Role.ADMIN && (
                                    <a onClick={() => setView('admin')} className={`${navItemClasses} ${currentView === 'admin' ? activeClasses : inactiveClasses}`}>
                                        <CogIcon className="h-5 w-5 mr-2" />
                                        Admin-Panel
                                    </a>
                                )}
                                <a onClick={() => setView('profile')} className={`${navItemClasses} ${currentView === 'profile' ? activeClasses : inactiveClasses}`}>
                                    <span className="h-5 w-5 mr-2 inline-block rounded-full bg-slate-600 text-white text-xs leading-5 text-center">P</span>
                                    Profil
                                </a>
                            </div>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Compact stats */}
                        <div className="hidden lg:flex items-center gap-2">
                            <span className="text-slate-700 dark:text-slate-200 text-sm">Schichten:</span>
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white text-sm font-semibold" title="Gesamtzahl deiner Schichten">
                                {loading ? '…' : (stats?.total ?? 0)}
                            </span>
                            {stats?.byShiftType?.map((s) => (
                                <span key={s.shiftTypeId} className={`px-2 py-0.5 rounded text-xs font-medium ${s.color}`} title={`${s.name}: ${s.count}`}>
                                    {s.count}
                                </span>
                            ))}
                        </div>
                        <div className="hidden sm:block">
                             <span className="text-slate-700 dark:text-white text-sm mr-1">
                                Angemeldet als: <span className="font-semibold">{user.name}</span> ({user.role})
                            </span>
                        </div>
                        <button onClick={toggleTheme} className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-slate-500" title={theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}>
                            {theme === 'dark' ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
                        </button>
                        <button onClick={logout} className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-slate-500" title="Abmelden">
                            <LogoutIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </div>
             {/* Mobile Nav */}
            <nav className="md:hidden bg-slate-800 border-t border-slate-700">
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 flex justify-around">
                    <a onClick={() => setView('schedule')} className={`${navItemClasses} w-full justify-center ${currentView === 'schedule' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                        <CalendarIcon className="h-5 w-5 mr-2" />
                        Plan
                    </a>
                    {user.role === Role.ADMIN && (
                        <a onClick={() => setView('admin')} className={`${navItemClasses} w-full justify-center ${currentView === 'admin' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                            <CogIcon className="h-5 w-5 mr-2" />
                            Admin
                        </a>
                    )}
                    <a onClick={() => setView('profile')} className={`${navItemClasses} w-full justify-center ${currentView === 'profile' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                        <span className="h-5 w-5 mr-2 inline-block rounded-full bg-slate-600 text-white text-xs leading-5 text-center">P</span>
                        Profil
                    </a>
                </div>
            </nav>
        </header>
    );
};

export default Header;