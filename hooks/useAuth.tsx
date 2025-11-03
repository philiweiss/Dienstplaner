import React, { createContext, useState, useContext, ReactNode } from 'react';
import { User } from '../types';
import { login as apiLogin, loginPassword as apiLoginPassword, setPassword as apiSetPassword } from '../services/auth';
import { setAuthToken, getAuthToken } from '../services/api';

interface AuthContextType {
    user: User | null;
    // First step: username-only login allowed only if user has no password yet. Returns { ok, needsPassword }
    loginUsernameOnly: (username: string) => Promise<{ ok: boolean; needsPassword?: boolean; user?: User }>;
    // Normal password login
    loginWithPassword: (username: string, password: string) => Promise<boolean>;
    // Complete initial setup: set password and log the user in
    setInitialPasswordAndLogin: (username: string, password: string) => Promise<boolean>;
    // Complete login using externally obtained token (e.g., Passkey)
    loginWithToken: (user: User, token: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    const loginUsernameOnly = async (username: string): Promise<{ ok: boolean; needsPassword?: boolean; user?: User }> => {
        try {
            const result = await apiLogin(username.trim());
            if (result && result.user) {
                // Do not set user here if needsPassword is true; require password setup first
                if (result.needsPassword) {
                    return { ok: true, needsPassword: true, user: result.user as User };
                }
                setUser(result.user as User);
                return { ok: true, user: result.user as User };
            }
        } catch (_e) {
            // caller will handle error messages
        }
        return { ok: false };
    };

    const loginWithPassword = async (username: string, password: string): Promise<boolean> => {
        try {
            const result = await apiLoginPassword(username.trim(), password);
            if (result && result.user) {
                setUser(result.user as User);
                setAuthToken(result.token);
                return true;
            }
        } catch (_e) {}
        return false;
    };

    const setInitialPasswordAndLogin = async (username: string, password: string): Promise<boolean> => {
        try {
            const result = await apiSetPassword(username.trim(), password);
            if (result && result.user) {
                setUser(result.user as User);
                setAuthToken(result.token);
                return true;
            }
        } catch (_e) {}
        return false;
    };

    const loginWithToken = (u: User, token: string) => {
        setUser(u);
        setAuthToken(token);
    };

    const logout = () => {
        setUser(null);
        setAuthToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, loginUsernameOnly, loginWithPassword, setInitialPasswordAndLogin, loginWithToken, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
