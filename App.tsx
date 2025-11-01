
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ScheduleProvider } from './hooks/useSchedule';
import Login from './components/Login';
import Header from './components/Header';
import ScheduleView from './components/ScheduleView';
import AdminPanel from './components/AdminPanel';

type View = 'schedule' | 'admin';

const AppContent: React.FC = () => {
    const { user } = useAuth();
    const [view, setView] = useState<View>('schedule');

    if (!user) {
        return <Login />;
    }

    return (
        <ScheduleProvider>
            <div className="min-h-screen bg-gray-50 text-gray-800">
                <Header currentView={view} setView={setView} />
                <main className="p-4 sm:p-6 lg:p-8">
                    {view === 'schedule' && <ScheduleView />}
                    {view === 'admin' && <AdminPanel />}
                </main>
            </div>
        </ScheduleProvider>
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
