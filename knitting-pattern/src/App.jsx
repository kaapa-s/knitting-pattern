import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import React from "react";
import PatternCanvas from "./PatternCanvas";

const DEFAULT_COLS = 20;
const DEFAULT_ROWS = 20;
const DEFAULT_COLOR = "#000000";
const LOCAL_STORAGE_KEY = "knitting-pattern-state-v1";
const COLOR_HISTORY_KEY = "knitting-pattern-color-history-v1";
const HISTORY_KEY = "knitting-pattern-history-v1";
const MAX_COLOR_HISTORY = 10;
const MAX_HISTORY = 50;

function createEmptyGrid(cols, rows, prevGrid = null) {
    const grid = [];
    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            if (prevGrid && prevGrid[y] && prevGrid[y][x]) {
                row.push({ ...prevGrid[y][x] });
            } else {
                row.push({ color: null, used: true });
            }
        }
        grid.push(row);
    }
    return grid;
}

function rotateMatrix90(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rotated = [];
    for (let x = 0; x < cols; x++) {
        const newRow = [];
        for (let y = rows - 1; y >= 0; y--) {
            newRow.push(matrix[y][x]);
        }
        rotated.push(newRow);
    }
    return rotated;
}

function deepCloneGrid(grid) {
    return grid.map((row) => row.map((cell) => ({ ...cell })));
}

// Helper to load state from localStorage synchronously
function loadInitialState() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch {
            return {};
        }
    }
    return {};
}

const initialState = loadInitialState();

function App() {
    const [cols, setCols] = useState(initialState.cols || DEFAULT_COLS);
    const [rows, setRows] = useState(initialState.rows || DEFAULT_ROWS);
    const [color, setColor] = useState(initialState.color || DEFAULT_COLOR);
    const [grid, setGrid] = useState(
        initialState.grid
            ? initialState.grid
            : createEmptyGrid(
                  initialState.cols || DEFAULT_COLS,
                  initialState.rows || DEFAULT_ROWS
              )
    );
    const [mode, setMode] = useState("draw"); // 'draw' | 'rectangle' | 'select'
    const [selection, setSelection] = useState(initialState.selection || null);
    const [colorHistory, setColorHistory] = useState(
        Array.isArray(initialState.colorHistory)
            ? initialState.colorHistory
            : [DEFAULT_COLOR]
    );
    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem(HISTORY_KEY);
        return saved ? JSON.parse(saved) : [];
    });
    const appRef = useRef(null);
    const ignoreNextHistory = useRef(false); // To avoid double-push on undo
    const [isPrintMode, setIsPrintMode] = useState(false);

    // Add color to history only if used in grid
    const addColorToHistory = useCallback((color, gridSnapshot) => {
        if (
            !gridSnapshot.some((row) =>
                row.some((cell) => cell.color === color)
            )
        )
            return;
        setColorHistory((prev) => {
            if (prev.includes(color)) return prev;
            return [...prev, color].slice(-MAX_COLOR_HISTORY);
        });
    }, []);

    // Load from local storage
    useEffect(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
            const state = JSON.parse(saved);
            setCols(state.cols);
            setRows(state.rows);
            setColor(state.color);
            setGrid(state.grid);
            if (Array.isArray(state.colorHistory))
                setColorHistory(state.colorHistory);
            if (state.selection) setSelection(state.selection);
        }
    }, []);

    // Save to local storage
    useEffect(() => {
        localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify({
                cols,
                rows,
                color,
                grid,
                colorHistory,
                selection,
            })
        );
    }, [cols, rows, color, grid, colorHistory, selection]);

    // Save color history
    useEffect(() => {
        localStorage.setItem(COLOR_HISTORY_KEY, JSON.stringify(colorHistory));
    }, [colorHistory]);

    // Save command history
    useEffect(() => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }, [history]);

    // Handle grid resize
    useEffect(() => {
        setGrid((prev) => createEmptyGrid(cols, rows, prev));
    }, [cols, rows]);

    // Compute highlight area for rectangle or selection
    let highlightArea = null;
    if (mode === "rectangle") {
        highlightArea = {
            x1: 0,
            y1: 0,
            x2: cols - 1,
            y2: rows - 1,
            color: "#1976d2",
            shadow: true,
        };
    } else if (mode === "select") {
        highlightArea = {
            x1: selection.start.x,
            y1: selection.start.y,
            x2: selection.end.x,
            y2: selection.end.y,
            color: "#1976d2",
            shadow: true,
        };
    }

    // Undo (command+z or ctrl+z)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                undo();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    // Push to history on grid change (except when undoing)
    useEffect(() => {
        if (ignoreNextHistory.current) {
            ignoreNextHistory.current = false;
            return;
        }
        setHistory((prev) => {
            const newHist = [...prev, deepCloneGrid(grid)];
            if (newHist.length > MAX_HISTORY) newHist.shift();
            return newHist;
        });
        // eslint-disable-next-line
    }, [grid]);

    // Undo function
    const undo = () => {
        setHistory((prev) => {
            if (prev.length < 2) return prev;
            const newHist = prev.slice(0, -1);
            ignoreNextHistory.current = true;
            setGrid(deepCloneGrid(newHist[newHist.length - 1]));
            return newHist;
        });
    };

    // Rectangle fill callback
    const handleRectangleComplete = useCallback(
        ({ x1, y1, x2, y2 }) => {
            if (x1 == null || y1 == null || x2 == null || y2 == null) return;
            fillRectangle({ x1, y1, x2, y2 });
        },
        [color, addColorToHistory]
    );

    // Selection callback
    const handleSelectionComplete = useCallback(({ x1, y1, x2, y2 }) => {
        setSelection({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
    }, []);

    // Cell draw callback
    const handleCellDraw = useCallback(
        (x, y, e) => {
            // Use the same logic as before for coloring/unused
            setGrid((prev) => {
                const row = prev[y];
                const cell = row[x];
                let usedColor = false;
                let updatedCell = { ...cell };
                if (e && e.shiftKey) {
                    updatedCell.used = !updatedCell.used;
                    if (!updatedCell.used) updatedCell.color = null;
                } else if (updatedCell.used) {
                    updatedCell.color = color;
                    usedColor = true;
                }
                if (usedColor) addColorToHistory(color, prev);
                if (
                    updatedCell.used !== cell.used ||
                    updatedCell.color !== cell.color
                ) {
                    const newRow = [...row];
                    newRow[x] = updatedCell;
                    const newGridArr = [...prev];
                    newGridArr[y] = newRow;
                    return newGridArr;
                }
                return prev;
            });
        },
        [color, addColorToHistory]
    );

    // Rectangle fill logic (robust, only color selected area)
    function fillRectangle({ x1, y1, x2, y2 }) {
        setGrid((prev) => {
            const newGrid = prev.map((row) => row.map((cell) => ({ ...cell })));
            const minY = Math.max(0, Math.min(y1, y2));
            const maxY = Math.min(prev.length - 1, Math.max(y1, y2));
            const minX = Math.max(0, Math.min(x1, x2));
            const maxX = Math.min(prev[0].length - 1, Math.max(x1, x2));
            let usedColor = false;
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    if (newGrid[y][x].used) {
                        newGrid[y][x].color = color;
                        usedColor = true;
                    }
                }
            }
            if (usedColor) addColorToHistory(color, newGrid);
            return newGrid;
        });
    }

    // Rotate selected area by 90 degrees clockwise
    const rotateSelection = () => {
        if (!selection || !selection.start || !selection.end) return;
        const { start, end } = selection;
        const x1 = Math.min(start.x, end.x);
        const x2 = Math.max(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const y2 = Math.max(start.y, end.y);
        const selWidth = x2 - x1 + 1;
        const selHeight = y2 - y1 + 1;
        if (x1 + selHeight - 1 >= cols || y1 + selWidth - 1 >= rows) return;
        const area = [];
        for (let y = y1; y <= y2; y++) {
            const row = [];
            for (let x = x1; x <= x2; x++) {
                row.push({ ...grid[y][x] });
            }
            area.push(row);
        }
        const rotated = rotateMatrix90(area);
        setGrid((prev) => {
            const newGrid = prev.map((row) => row.map((cell) => ({ ...cell })));
            for (let y = 0; y < rotated.length; y++) {
                for (let x = 0; x < rotated[0].length; x++) {
                    newGrid[y1 + y][x1 + x] = { ...rotated[y][x] };
                }
            }
            return newGrid;
        });
    };

    // Render grid
    const displayGrid = grid;

    // Listen for print mode
    useEffect(() => {
        const mediaQuery = window.matchMedia("print");
        const handleChange = (e) => setIsPrintMode(e.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    return (
        <div className="pattern-app-layout">
            <aside className="pattern-sidebar">
                <div className="controls">
                    <div className="menu-section">
                        <div className="menu-label">Canvas Size</div>
                        <label>
                            Columns (X):
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={cols}
                                onChange={(e) => {
                                    setCols(Number(e.target.value));
                                }}
                            />
                        </label>
                        <label>
                            Rows (Y):
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={rows}
                                onChange={(e) => {
                                    setRows(Number(e.target.value));
                                }}
                            />
                        </label>
                    </div>
                    <div className="menu-section">
                        <div className="menu-label">Color</div>
                        <label>
                            Color:
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                            />
                        </label>
                        <div className="color-history color-history-wrap">
                            {colorHistory.map((c) => (
                                <button
                                    key={c}
                                    className="color-history-btn"
                                    style={{
                                        background: c,
                                        border:
                                            c === color
                                                ? "2px solid #333"
                                                : "1px solid #aaa",
                                        width: 24,
                                        height: 24,
                                        marginRight: 4,
                                        marginBottom: 4,
                                        cursor: "pointer",
                                    }}
                                    title={c}
                                    onClick={() => setColor(c)}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="menu-section">
                        <div className="menu-label">Tools</div>
                        <button
                            onClick={() =>
                                setMode(
                                    mode === "rectangle" ? "draw" : "rectangle"
                                )
                            }
                            style={{
                                background:
                                    mode === "rectangle"
                                        ? "#e0e0e0"
                                        : undefined,
                                fontWeight:
                                    mode === "rectangle" ? "bold" : undefined,
                            }}
                        >
                            {mode === "rectangle"
                                ? "Rectangle: ON"
                                : "Draw Rectangle"}
                        </button>
                        <button
                            onClick={() =>
                                setMode(mode === "select" ? "draw" : "select")
                            }
                            style={{
                                background:
                                    mode === "select" ? "#e0e0e0" : undefined,
                                fontWeight:
                                    mode === "select" ? "bold" : undefined,
                            }}
                        >
                            {mode === "select" ? "Select: ON" : "Select Area"}
                        </button>
                        <button
                            onClick={rotateSelection}
                            disabled={!selection || mode !== "select"}
                            style={{
                                background:
                                    selection && mode === "select"
                                        ? "#e0e0e0"
                                        : undefined,
                                fontWeight:
                                    selection && mode === "select"
                                        ? "bold"
                                        : undefined,
                                opacity:
                                    selection && mode === "select" ? 1 : 0.5,
                                cursor:
                                    selection && mode === "select"
                                        ? "pointer"
                                        : "not-allowed",
                            }}
                        >
                            Rotate Selection 90°
                        </button>
                        <button
                            onClick={undo}
                            disabled={history.length < 2}
                            style={{
                                opacity: history.length < 2 ? 0.5 : 1,
                                cursor:
                                    history.length < 2
                                        ? "not-allowed"
                                        : "pointer",
                            }}
                            title="Undo (Cmd/Ctrl+Z)"
                        >
                            Undo
                        </button>
                    </div>
                    <span style={{ marginTop: 8, fontSize: 12 }}>
                        (Shift+Click or Shift+Drag to mark as unused/used)
                    </span>
                </div>
            </aside>
            <main className="pattern-main">
                <div className="pattern-grid-wrapper">
                    <PatternCanvas
                        grid={displayGrid}
                        rows={rows}
                        cols={cols}
                        cellSize={24}
                        mode={mode}
                        onRectangleComplete={handleRectangleComplete}
                        onSelectionComplete={handleSelectionComplete}
                        onCellDraw={handleCellDraw}
                        isPrintMode={isPrintMode}
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
