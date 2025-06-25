import { useState, useCallback, useEffect, useRef } from "react";

const HISTORY_KEY = "knitting-pattern-history-v1";
const REDO_KEY = "knitting-pattern-redo-v1";
const MAX_HISTORY = 50;

function deepCloneGrid(grid) {
    return JSON.parse(JSON.stringify(grid));
}

export default function useHistoryManager(initialGrid) {
    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem(HISTORY_KEY);
        return saved ? JSON.parse(saved) : [initialGrid];
    });
    const [redoStack, setRedoStack] = useState(() => {
        const saved = localStorage.getItem(REDO_KEY);
        return saved ? JSON.parse(saved) : [];
    });
    const ignoreNextHistory = useRef(false);

    // Save history to localStorage
    useEffect(() => {
        const timeout = setTimeout(() => {
            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(history.map(deepCloneGrid))
            );
        }, 0);
        return () => clearTimeout(timeout);
    }, [history]);

    // Save redoStack to localStorage
    useEffect(() => {
        const timeout = setTimeout(() => {
            localStorage.setItem(
                REDO_KEY,
                JSON.stringify(redoStack.map(deepCloneGrid))
            );
        }, 0);
        return () => clearTimeout(timeout);
    }, [redoStack]);

    const undo = useCallback((setGrid) => {
        setHistory((prev) => {
            if (prev.length < 2) return prev;
            const newHist = prev.slice(0, -1);
            ignoreNextHistory.current = true;
            setRedoStack((redoPrev) => [prev[prev.length - 1], ...redoPrev]);
            setGrid(newHist[newHist.length - 1]);
            return newHist;
        });
    }, []);

    const redo = useCallback((setGrid) => {
        setRedoStack((redoPrev) => {
            if (redoPrev.length === 0) return redoPrev;
            const [next, ...rest] = redoPrev;
            setHistory((prev) => {
                ignoreNextHistory.current = true;
                setGrid(next);
                return [...prev, next];
            });
            return rest;
        });
    }, []);

    const pushHistory = useCallback((grid) => {
        if (ignoreNextHistory.current) {
            ignoreNextHistory.current = false;
            return;
        }
        setHistory((prev) => {
            const newHist = [...prev, grid];
            if (newHist.length > MAX_HISTORY) newHist.shift();
            return newHist;
        });
        setRedoStack([]);
    }, []);

    return {
        history,
        redoStack,
        setHistory,
        setRedoStack,
        undo,
        redo,
        pushHistory,
    };
}
