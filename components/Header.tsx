
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';
import { CalendarIcon, CogIcon, LogoutIcon } from './icons';

interface HeaderProps {
    currentView: 'schedule' | 'admin' | 'profile';
    setView: (view: 'schedule' | 'admin' | 'profile') => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
    const { user, logout } = useAuth();

    if (!user) return null;

    const navItemClasses = "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors";
    const activeClasses = "bg-slate-900 text-white";
    const inactiveClasses = "text-slate-300 hover:bg-slate-700 hover:text-white";

    return (
        <header className="bg-slate-800 shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                           <h1 className="text-xl font-bold text-white">IT-Dienstplaner Pro</h1>
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
                    <div className="flex items-center">
                        <div className="hidden sm:block">
                             <span className="text-white text-sm mr-4">
                                Angemeldet als: <span className="font-semibold">{user.name}</span> ({user.role})
                            </span>
                        </div>
                        <button onClick={logout} className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-white" title="Abmelden">
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