import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";
import React from "react";
import PatternCanvas from "./PatternCanvas";
import Sidebar from "./Sidebar";
import { createEmptyGrid, loadInitialState } from "./utils/gridUtils";
import useHistoryManager from "./hooks/useHistoryManager";
import useDrawingManager from "./hooks/useDrawingManager";
import useGlobalEventHandlers from "./hooks/useGlobalEventHandlers";
import useAppPersistence from "./hooks/useAppPersistence";

const DEFAULT_COLS = 20;
const DEFAULT_ROWS = 20;
const DEFAULT_COLOR = "#000000";
const MAX_COLOR_HISTORY = 10;

const initialState = loadInitialState();

function App() {
    // App-level state
    const [cols, setCols] = useState(initialState.cols || DEFAULT_COLS);
    const [rows, setRows] = useState(initialState.rows || DEFAULT_ROWS);
    const [color, setColor] = useState(initialState.color || DEFAULT_COLOR);
    const [mode, setMode] = useState("draw"); // 'draw' | 'rectangle' | 'select' | 'exclude'
    const [colorHistory, setColorHistory] = useState(
        Array.isArray(initialState.colorHistory)
            ? initialState.colorHistory
            : [DEFAULT_COLOR]
    );
    const [isPrintMode, setIsPrintMode] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const batchingDrawRef = useRef(false);
    const gridBeforeDrawRef = useRef(null);

    // Helper to detect mobile
    const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(max-width: 700px)").matches;

    // Persistence hook
    const { saveAppState, loadAppState, saveColorHistory, loadColorHistory } =
        useAppPersistence();

    // Add color to history only if used in grid
    const addColorToHistory = useCallback(
        (color, gridSnapshot) => {
            if (
                !gridSnapshot.some((row) =>
                    row.some((cell) => cell.color === color)
                )
            )
                return;
            setColorHistory((prev) => {
                if (prev.includes(color)) return prev;
                const newHistory = [...prev, color].slice(-MAX_COLOR_HISTORY);
                saveColorHistory(newHistory);
                return newHistory;
            });
        },
        [saveColorHistory]
    );

    // Drawing manager hook
    const {
        grid,
        setGrid,
        selection,
        setSelection,
        fillRectangle,
        handleCellDraw,
        rotateSelection,
        handleSelectionComplete,
        handleCellExclude,
    } = useDrawingManager({
        initialGrid:
            initialState.grid ||
            createEmptyGrid(
                initialState.cols || DEFAULT_COLS,
                initialState.rows || DEFAULT_ROWS
            ),
        color,
        addColorToHistory,
        cols,
        rows,
    });

    // History manager hook
    const {
        history,
        redoStack,
        setHistory,
        setRedoStack,
        undo,
        redo,
        pushHistory,
    } = useHistoryManager(grid);

    // Save/load app state (grid, color, etc.)
    // Load from local storage on mount
    useEffect(() => {
        const state = loadAppState();
        if (state) {
            setCols(state.cols);
            setRows(state.rows);
            setColor(state.color);
            setGrid(state.grid);
            if (Array.isArray(state.colorHistory))
                setColorHistory(state.colorHistory);
            if (state.selection) setSelection(state.selection);
        }
        const loadedColorHistory = loadColorHistory();
        if (loadedColorHistory) setColorHistory(loadedColorHistory);
    }, [loadAppState, loadColorHistory, setGrid, setSelection]);

    // Save to local storage on relevant state change
    useEffect(() => {
        saveAppState({
            cols,
            rows,
            color,
            grid,
            colorHistory,
            selection,
        });
    }, [cols, rows, color, grid, colorHistory, selection, saveAppState]);

    // Handle grid resize
    useEffect(() => {
        setGrid((prev) => createEmptyGrid(cols, rows, prev));
    }, [cols, rows, setGrid]);

    // Push to history on grid change (except when batching draw)
    useEffect(() => {
        if (batchingDrawRef.current) return;
        pushHistory(grid);
    }, [grid, pushHistory]);

    // Global event handlers (undo/redo, print mode)
    useGlobalEventHandlers({
        onUndo: () => undo(setGrid),
        onRedo: () => redo(setGrid),
        onPrintModeChange: setIsPrintMode,
    });

    // Rectangle fill callback
    const handleRectangleComplete = useCallback(
        ({ x1, y1, x2, y2 }) => {
            if (x1 == null || y1 == null || x2 == null || y2 == null) return;
            fillRectangle({ x1, y1, x2, y2 });
        },
        [fillRectangle]
    );

    // NEW: handle draw start/end for batching history
    const handleDrawStart = useCallback(() => {
        batchingDrawRef.current = true;
        gridBeforeDrawRef.current = JSON.parse(JSON.stringify(grid));
    }, [grid]);
    const handleDrawEnd = useCallback(() => {
        batchingDrawRef.current = false;
        pushHistory(grid);
    }, [grid, pushHistory]);

    // Compute highlight area for rectangle or selection
    let highlightArea = null;
    if (mode === "rectangle") {
        highlightArea = null;
    } else if (
        mode === "select" &&
        selection &&
        selection.start &&
        selection.end
    ) {
        highlightArea = {
            x1: selection.start.x,
            y1: selection.start.y,
            x2: selection.end.x,
            y2: selection.end.y,
            color: "#1976d2",
            shadow: true,
        };
    }

    // Clear selection when leaving select mode
    useEffect(() => {
        if (mode !== "select" && selection) {
            setSelection(null);
        }
    }, [mode, selection, setSelection]);

    return (
        <div className="pattern-app-layout">
            {isMobile && !isMenuOpen && (
                <button
                    className="mobile-menu-btn"
                    aria-label="Open menu"
                    onClick={() => setIsMenuOpen(true)}
                    style={{
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <span
                        style={{
                            display: "block",
                            fontSize: "1rem",
                            color: "#222",
                            background: "rgba(255,255,255,0.92)",
                            borderRadius: "8px",
                            padding: "8px 18px 10px 18px",
                            fontWeight: 500,
                            letterSpacing: "0.01em",
                            lineHeight: 1.1,
                        }}
                    >
                        Open menu
                    </span>
                </button>
            )}
            <aside
                className={
                    isMobile
                        ? `pattern-sidebar${isMenuOpen ? " menu-open" : ""}`
                        : "pattern-sidebar"
                }
                style={
                    isMobile && !isMenuOpen ? { display: "none" } : undefined
                }
            >
                <Sidebar
                    isMobile={isMobile}
                    isMenuOpen={isMenuOpen}
                    setIsMenuOpen={setIsMenuOpen}
                    cols={cols}
                    setCols={setCols}
                    rows={rows}
                    setRows={setRows}
                    color={color}
                    setColor={setColor}
                    colorHistory={colorHistory}
                    mode={mode}
                    setMode={setMode}
                    selection={selection}
                    rotateSelection={rotateSelection}
                    undo={() => undo(setGrid)}
                    redo={() => redo(setGrid)}
                    history={history}
                    redoStack={redoStack}
                />
            </aside>
            <main className="pattern-main">
                <div className="pattern-grid-wrapper">
                    <PatternCanvas
                        grid={grid}
                        rows={rows}
                        cols={cols}
                        cellSize={24}
                        mode={mode}
                        onRectangleComplete={handleRectangleComplete}
                        onSelectionComplete={handleSelectionComplete}
                        onCellDraw={handleCellDraw}
                        onCellExclude={
                            mode === "exclude" ? handleCellExclude : null
                        }
                        isPrintMode={isPrintMode}
                        highlightArea={highlightArea}
                        onDrawStart={handleDrawStart}
                        onDrawEnd={handleDrawEnd}
                    />
                </div>
                <div className="print-hint">
                    To print, use your browser's print function. Unused cells
                    will not be printed.
                </div>
            </main>
        </div>
    );
}

export default App;
