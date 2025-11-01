import React, { createContext, useState, useContext, ReactNode } from 'react';
import { User } from '../types';
import { login as apiLogin } from '../services/auth';

interface AuthContextType {
    user: User | null;
    login: (username: string) => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    const login = async (username: string): Promise<boolean> => {
        try {
            const result = await apiLogin(username.trim());
            if (result && result.user) {
                setUser(result.user as User);
                return true;
            }
        } catch (_e) {
            // swallow error; caller can display message
        }
        return false;
    };

    const logout = () => {
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
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
