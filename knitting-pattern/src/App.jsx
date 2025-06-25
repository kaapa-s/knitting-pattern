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
    const [redoStack, setRedoStack] = useState(() => {
        const saved = localStorage.getItem("knitting-pattern-redo-v1");
        return saved ? JSON.parse(saved) : [];
    });
    const appRef = useRef(null);
    const ignoreNextHistory = useRef(false); // To avoid double-push on undo
    const [isPrintMode, setIsPrintMode] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Helper to detect mobile
    const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(max-width: 700px)").matches;

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

    // Save command history (async, only when history changes)
    useEffect(() => {
        // Save a deep clone to localStorage, but do it asynchronously
        const timeout = setTimeout(() => {
            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(history.map(deepCloneGrid))
            );
        }, 0);
        return () => clearTimeout(timeout);
    }, [history]);

    // Save redo stack (async, only when redoStack changes)
    useEffect(() => {
        const timeout = setTimeout(() => {
            localStorage.setItem(
                "knitting-pattern-redo-v1",
                JSON.stringify(redoStack.map(deepCloneGrid))
            );
        }, 0);
        return () => clearTimeout(timeout);
    }, [redoStack]);

    // Handle grid resize
    useEffect(() => {
        setGrid((prev) => createEmptyGrid(cols, rows, prev));
    }, [cols, rows]);

    // Undo (command+z or ctrl+z) and Redo (command+y or ctrl+y)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                undo();
            } else if (
                (e.metaKey || e.ctrlKey) &&
                e.key.toLowerCase() === "y"
            ) {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    // Push to history on grid change (except when undoing/redoing)
    useEffect(() => {
        if (ignoreNextHistory.current) {
            ignoreNextHistory.current = false;
            return;
        }
        setHistory((prev) => {
            const newHist = [...prev, grid]; // store by reference
            if (newHist.length > MAX_HISTORY) newHist.shift();
            return newHist;
        });
        setRedoStack([]); // Clear redo stack on new action
        // eslint-disable-next-line
    }, [grid]);

    // Undo function
    const undo = () => {
        setHistory((prev) => {
            if (prev.length < 2) return prev;
            const newHist = prev.slice(0, -1);
            ignoreNextHistory.current = true;
            setRedoStack((redoPrev) => [prev[prev.length - 1], ...redoPrev]);
            setGrid(newHist[newHist.length - 1]); // set by reference, no deep clone
            return newHist;
        });
    };

    // Redo function
    const redo = () => {
        setRedoStack((redoPrev) => {
            if (redoPrev.length === 0) return redoPrev;
            const [next, ...rest] = redoPrev;
            setHistory((prev) => {
                ignoreNextHistory.current = true;
                setGrid(next); // set by reference, no deep clone
                return [...prev, next];
            });
            return rest;
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

    // Rotate selected area by 90 degrees clockwise around its center
    const rotateSelection = () => {
        if (!selection || !selection.start || !selection.end) return;
        const { start, end } = selection;
        const x1 = Math.min(start.x, end.x);
        const x2 = Math.max(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const y2 = Math.max(start.y, end.y);
        const selWidth = x2 - x1 + 1;
        const selHeight = y2 - y1 + 1;
        // Check bounds for rotated area
        if (x1 + selHeight - 1 >= cols || y1 + selWidth - 1 >= rows) return;
        // Extract the area (including all cells, used or not)
        const area = Array.from({ length: selHeight }, (_, y) =>
            Array.from({ length: selWidth }, (_, x) => grid[y1 + y][x1 + x])
        );
        // Rotate the area (matrix) 90deg clockwise: (x, y) -> (y, width-1-x)
        const rotated = Array.from({ length: selWidth }, (_, y) =>
            Array.from(
                { length: selHeight },
                (_, x) => area[selHeight - 1 - x][y]
            )
        );
        // Place rotated area back into the grid, preserving the bounding box
        setGrid((prev) => {
            const newGrid = prev.map((row) => row.map((cell) => ({ ...cell })));
            for (let y = 0; y < selWidth; y++) {
                for (let x = 0; x < selHeight; x++) {
                    if (
                        y1 + y < newGrid.length &&
                        x1 + x < newGrid[0].length &&
                        rotated[y] &&
                        rotated[y][x]
                    ) {
                        newGrid[y1 + y][x1 + x] = { ...rotated[y][x] };
                    }
                }
            }
            return newGrid;
        });
        // Update selection highlight to match new rotated area
        setSelection({
            start: { x: x1, y: y1 },
            end: { x: x1 + selHeight - 1, y: y1 + selWidth - 1 },
        });
    };

    // Render grid
    const displayGrid = grid;

    // Compute highlight area for rectangle or selection
    let highlightArea = null;
    if (mode === "rectangle") {
        // Rectangle drag highlight is handled internally by PatternCanvas
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

    // Listen for print mode
    useEffect(() => {
        const mediaQuery = window.matchMedia("print");
        const handleChange = (e) => setIsPrintMode(e.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    // Clear selection when leaving select mode
    useEffect(() => {
        if (mode !== "select" && selection) {
            setSelection(null);
        }
    }, [mode]);

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
                {isMobile && (
                    <button
                        style={{
                            position: "absolute",
                            top: 12,
                            right: 16,
                            zIndex: 201,
                            background: "none",
                            border: "none",
                            fontSize: 32,
                            color: "#333",
                            cursor: "pointer",
                        }}
                        aria-label="Close menu"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        ×
                    </button>
                )}
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
                                    if (isMobile) setIsMenuOpen(false);
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
                                    if (isMobile) setIsMenuOpen(false);
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
                                onChange={(e) => {
                                    setColor(e.target.value);
                                    if (isMobile) setIsMenuOpen(false);
                                }}
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
                                    onClick={() => {
                                        setColor(c);
                                        if (isMobile) setIsMenuOpen(false);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="menu-section">
                        <div className="menu-label">Tools</div>
                        <button
                            onClick={() => {
                                setMode(
                                    mode === "rectangle" ? "draw" : "rectangle"
                                );
                                if (isMobile) setIsMenuOpen(false);
                            }}
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
                            onClick={() => {
                                setMode(mode === "select" ? "draw" : "select");
                                if (isMobile) setIsMenuOpen(false);
                            }}
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
                            onClick={() => {
                                rotateSelection();
                                if (isMobile) setIsMenuOpen(false);
                            }}
                            disabled={
                                !selection ||
                                !selection.start ||
                                !selection.end ||
                                mode !== "select"
                            }
                            style={{
                                background:
                                    selection &&
                                    selection.start &&
                                    selection.end &&
                                    mode === "select"
                                        ? "#e0e0e0"
                                        : undefined,
                                fontWeight:
                                    selection &&
                                    selection.start &&
                                    selection.end &&
                                    mode === "select"
                                        ? "bold"
                                        : undefined,
                                opacity:
                                    selection &&
                                    selection.start &&
                                    selection.end &&
                                    mode === "select"
                                        ? 1
                                        : 0.5,
                                cursor:
                                    selection &&
                                    selection.start &&
                                    selection.end &&
                                    mode === "select"
                                        ? "pointer"
                                        : "not-allowed",
                            }}
                        >
                            Rotate Selection 90°
                        </button>
                        <button
                            onClick={() => {
                                undo();
                                if (isMobile) setIsMenuOpen(false);
                            }}
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
                        <button
                            onClick={() => {
                                redo();
                                if (isMobile) setIsMenuOpen(false);
                            }}
                            disabled={redoStack.length === 0}
                            style={{
                                opacity: redoStack.length === 0 ? 0.5 : 1,
                                cursor:
                                    redoStack.length === 0
                                        ? "not-allowed"
                                        : "pointer",
                            }}
                            title="Redo (Cmd/Ctrl+Y)"
                        >
                            Redo
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
                        highlightArea={highlightArea}
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
