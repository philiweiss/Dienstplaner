
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ScheduleProvider } from './hooks/useSchedule';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import ToastContainer from './components/ToastContainer';
import Login from './components/Login';
import Header from './components/Header';
import ScheduleView from './components/ScheduleView';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import { Role } from './types';

type View = 'schedule' | 'profile' | 'admin';

const AppContent: React.FC = () => {
    const { user } = useAuth();
    const [view, setView] = useState<View>('schedule');

    return (
        <ThemeProvider userId={user?.id}>
            <ToastProvider>
                {!user ? (
                    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100 animate-fade-in">
                        <Login />
                    </div>
                ) : (
                    <ScheduleProvider>
                        <div className="min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
                            <Header currentView={view} setView={setView} />
                            <main className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 sm:pb-8">
                                <div key={view} className="animate-slide-up">
                                    {view === 'schedule' && <ScheduleView />}
                                    {view === 'profile' && <Profile />}
                                    {view === 'admin' && (user?.role === Role.ADMIN ? <AdminPanel /> : <div className="text-sm text-red-600">Kein Zugriff</div>)}
                                </div>
                            </main>
                        </div>
                    </ScheduleProvider>
                )}
                <ToastContainer />
            </ToastProvider>
        </ThemeProvider>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
