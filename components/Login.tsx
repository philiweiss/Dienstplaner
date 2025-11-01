import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { UsersIcon } from './icons';

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const ok = await login(username);
            if (!ok) {
                setError('Login fehlgeschlagen. Benutzer existiert nicht oder Serverfehler.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        IT-Dienstplaner Pro
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Melden Sie sich an, um fortzufahren
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="username" className="sr-only">Benutzername</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-slate-500 focus:border-slate-500 focus:z-10 sm:text-sm"
                                placeholder="Benutzername (z.B. Alice Admin)"
                                disabled={loading}
                            />
                        </div>
                    </div>

                     {error && <p className="text-red-500 text-sm">{error}</p>}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${loading ? 'bg-slate-400' : 'bg-slate-700 hover:bg-slate-800'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500`}
                        >
                            {loading ? 'Anmelden…' : 'Anmelden'}
                        </button>
                    </div>
                </form>
                <div className="text-center text-xs text-gray-500 p-4 border-t mt-4">
                    <p className="font-semibold">Hinweis zur Demo</p>
                    <p>In einer Produktionsumgebung würde hier eine Anbindung an ein LDAP / Active Directory erfolgen, um eine sichere Authentifizierung zu gewährleisten.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;