import { useCallback } from "react";

const LOCAL_STORAGE_KEY = "knitting-pattern-state-v1";
const COLOR_HISTORY_KEY = "knitting-pattern-color-history-v1";

export default function useAppPersistence() {
    const saveAppState = useCallback((state) => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    }, []);

    const loadAppState = useCallback(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
    }, []);

    const saveColorHistory = useCallback((colorHistory) => {
        localStorage.setItem(COLOR_HISTORY_KEY, JSON.stringify(colorHistory));
    }, []);

    const loadColorHistory = useCallback(() => {
        const saved = localStorage.getItem(COLOR_HISTORY_KEY);
        return saved ? JSON.parse(saved) : null;
    }, []);

    return {
        saveAppState,
        loadAppState,
        saveColorHistory,
        loadColorHistory,
    };
}
