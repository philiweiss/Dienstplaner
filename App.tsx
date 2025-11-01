
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ScheduleProvider } from './hooks/useSchedule';
import { ThemeProvider } from './hooks/useTheme';
import Login from './components/Login';
import Header from './components/Header';
import ScheduleView from './components/ScheduleView';
import AdminPanel from './components/AdminPanel';
import Profile from './components/Profile';

type View = 'schedule' | 'admin' | 'profile';

const AppContent: React.FC = () => {
    const { user } = useAuth();
    const [view, setView] = useState<View>('schedule');

    if (!user) {
        return <Login />;
    }

    return (
        <ThemeProvider userId={user.id}>
            <ScheduleProvider>
                <div className="min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
                    <Header currentView={view} setView={setView} />
                    <main className="p-4 sm:p-6 lg:p-8">
                        {view === 'schedule' && <ScheduleView />}
                        {view === 'admin' && <AdminPanel />}
                        {view === 'profile' && <Profile />}
                    </main>
                </div>
            </ScheduleProvider>
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
