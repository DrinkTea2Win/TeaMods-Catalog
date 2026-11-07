import { useCallback, useEffect, useState } from 'react';
function getBasePath() {
    return import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
}
export function useAuth() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        fetch('/api/auth/user', { credentials: 'include' })
            .then((res) => {
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
            .then((data) => {
            if (!cancelled) {
                setUser(data.user ?? null);
                setIsLoading(false);
            }
        })
            .catch(() => {
            if (!cancelled) {
                setUser(null);
                setIsLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const login = useCallback(() => {
        const base = getBasePath();
        window.location.href = `/api/login?returnTo=${encodeURIComponent(base)}`;
    }, []);
    const logout = useCallback(() => {
        const base = getBasePath();
        window.location.href = `/api/logout?returnTo=${encodeURIComponent(base)}`;
    }, []);
    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
    };
}
