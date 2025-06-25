import { useEffect } from "react";

export default function useGlobalEventHandlers({
    onUndo,
    onRedo,
    onPrintModeChange,
}) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                onUndo && onUndo();
            } else if (
                (e.metaKey || e.ctrlKey) &&
                e.key.toLowerCase() === "y"
            ) {
                e.preventDefault();
                onRedo && onRedo();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onUndo, onRedo]);

    useEffect(() => {
        if (!onPrintModeChange) return;
        const mediaQuery = window.matchMedia("print");
        const handleChange = (e) => onPrintModeChange(e.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [onPrintModeChange]);
}
