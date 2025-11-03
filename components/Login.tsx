import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { checkUser } from '../services/auth';
import { startPasskeyLogin, finishPasskeyLogin } from '../services/auth';

type Step = 'username' | 'password' | 'setPassword';

const Login: React.FC = () => {
    const [step, setStep] = useState<Step>('username');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginUsernameOnly, loginWithPassword, setInitialPasswordAndLogin } = useAuth();

    const handleUsernameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const info = await checkUser(username.trim());
            if (!info.exists) {
                setError('Benutzer existiert nicht. Bitte wende dich an einen Admin.');
                return;
            }
            if (info.needsPassword) {
                // Allow username-only login to start first-time flow (optional)
                const res = await loginUsernameOnly(username.trim());
                if (!res.ok) {
                    setError('Erster Login fehlgeschlagen.');
                    return;
                }
                setStep('setPassword');
                return;
            }
            // User has password -> ask for password
            setStep('password');
        } catch (e: any) {
            setError(e?.message || 'Fehler beim Prüfen des Benutzers.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const ok = await loginWithPassword(username.trim(), password);
            if (!ok) setError('Login fehlgeschlagen. Bitte prüfen Sie Benutzername und Passwort.');
        } finally { setLoading(false); }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password.length < 8) {
            setError('Passwort muss mindestens 8 Zeichen lang sein.');
            return;
        }
        if (password !== password2) {
            setError('Passwörter stimmen nicht überein.');
            return;
        }
        setLoading(true);
        try {
            const ok = await setInitialPasswordAndLogin(username.trim(), password);
            if (!ok) setError('Passwort konnte nicht gesetzt werden.');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
                        IT-Dienstplaner
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
                        {step === 'username' && 'Melden Sie sich an, um fortzufahren'}
                        {step === 'password' && 'Bitte Passwort eingeben'}
                        {step === 'setPassword' && 'Erster Login: Bitte Passwort festlegen'}
                    </p>
                </div>

                {step === 'username' && (
                    <form className="mt-8 space-y-6" onSubmit={handleUsernameSubmit}>
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <label htmlFor="username" className="sr-only">Voller Name</label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 placeholder-gray-500 dark:placeholder-slate-400 text-gray-900 dark:text-gray-100 rounded-t-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 focus:z-10 sm:text-sm transition-colors"
                                    placeholder="Benutzername (z.B. Noah Farras)"
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
                                {loading ? 'Prüfen…' : 'Weiter'}
                            </button>
                        </div>
                    </form>
                )}

                {step === 'password' && (
                    <>
                        <div className="mt-4 flex flex-col items-center space-y-2">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow text-white flex items-center justify-center text-2xl font-bold select-none">
                                {(() => {
                                    const n = username.trim();
                                    if (!n) return '??';
                                    const parts = n.split(/\s+/).filter(Boolean);
                                    if (parts.length === 1) {
                                        const w = parts[0];
                                        return w.slice(0, 2).toLocaleUpperCase('de-DE');
                                    }
                                    const first = parts[0][0] || '';
                                    const last = parts[parts.length - 1][0] || '';
                                    return (first + last).toLocaleUpperCase('de-DE');
                                })()}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                                {username}
                            </div>
                        </div>
                        <form className="mt-6 space-y-6" onSubmit={handlePasswordLogin}>
                            <div className="rounded-md shadow-sm -space-y-px">
                                <div>
                                    <label htmlFor="password" className="sr-only">Passwort</label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 placeholder-gray-500 dark:placeholder-slate-400 text-gray-900 dark:text-gray-100 rounded-t-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 focus:z-10 sm:text-sm transition-colors"
                                        placeholder="Passwort"
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                            {error && <p className="text-red-500 text-sm">{error}</p>}
                            <div className="flex justify-between text-sm">
                                <button type="button" className="text-slate-600 dark:text-slate-300 hover:underline" onClick={() => setStep('username')}>Zurück</button>
                            </div>
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
                    </>
                )}

                {step === 'setPassword' && (
                    <form className="mt-8 space-y-6" onSubmit={handleSetPassword}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Neues Passwort</label>
                                <input
                                    id="new-password"
                                    name="new-password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm transition-colors"
                                    placeholder="Mindestens 8 Zeichen"
                                    disabled={loading}
                                />
                            </div>
                            <div>
                                <label htmlFor="new-password2" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Passwort wiederholen</label>
                                <input
                                    id="new-password2"
                                    name="new-password2"
                                    type="password"
                                    required
                                    value={password2}
                                    onChange={(e) => setPassword2(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm transition-colors"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        <div className="flex justify-between text-sm">
                            <button type="button" className="text-slate-600 hover:underline" onClick={() => setStep('username')}>Abbrechen</button>
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${loading ? 'bg-slate-400' : 'bg-slate-700 hover:bg-slate-800'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500`}
                            >
                                {loading ? 'Speichern…' : 'Passwort setzen & anmelden'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">Tipp: Nach dem ersten Login können Sie unter Profil einen Passkey registrieren.</p>
                    </form>
                )}

                <div className="text-center text-xs text-gray-500 p-4 border-t mt-4">
                    <p className="font-semibold">Hinweis</p>
                    <p>Erster Login erfolgt über den Namen. Danach ist ein Passwort erforderlich. Passkeys folgen als Option.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;