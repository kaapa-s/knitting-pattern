import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import React from "react";

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

// Memoized cell component
const PatternCell = React.memo(function PatternCell({
    cell,
    x,
    y,
    isInRectangle,
    onMouseDown,
    onMouseEnter,
}) {
    return (
        <td
            className={cell.used ? "used" : "unused"}
            style={{
                width: 24,
                height: 24,
                background: cell.used && cell.color ? cell.color : "#fff",
                border: cell.used ? "1px solid #888" : "none",
                cursor: cell.used
                    ? isInRectangle
                        ? "crosshair"
                        : "pointer"
                    : "not-allowed",
                opacity: cell.used ? 1 : 0.1,
                position: "relative",
                textAlign: "center",
                verticalAlign: "middle",
                padding: 0,
                boxShadow: isInRectangle
                    ? `inset 0 0 0 2px #1976d2, 0 0 8px 2px #1976d255`
                    : undefined,
            }}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
        >
            {!cell.used && (
                <span
                    style={{
                        color: "#c00",
                        fontWeight: "bold",
                        fontSize: 18,
                        pointerEvents: "none",
                        userSelect: "none",
                    }}
                >
                    ×
                </span>
            )}
        </td>
    );
});

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
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [dragMode, setDragMode] = useState(null); // 'color' or 'unused' or 'rectangle' or 'select'
    const [rectangleStart, setRectangleStart] = useState(null); // {x, y}
    const [rectangleEnd, setRectangleEnd] = useState(null); // {x, y}
    const [rectangleMode, setRectangleMode] = useState(
        typeof initialState.rectangleMode === "boolean"
            ? initialState.rectangleMode
            : false
    );
    const [selectMode, setSelectMode] = useState(
        typeof initialState.selectMode === "boolean"
            ? initialState.selectMode
            : false
    );
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
            if (typeof state.rectangleMode === "boolean")
                setRectangleMode(state.rectangleMode);
            if (typeof state.selectMode === "boolean")
                setSelectMode(state.selectMode);
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
                rectangleMode,
                selectMode,
            })
        );
    }, [
        cols,
        rows,
        color,
        grid,
        colorHistory,
        selection,
        rectangleMode,
        selectMode,
    ]);

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

    // Mouse up handler for whole app
    useEffect(() => {
        const handleUp = () => {
            if (rectangleMode && rectangleStart && rectangleEnd) {
                fillRectangle(rectangleStart, rectangleEnd);
            }
            if (selectMode && rectangleStart && rectangleEnd) {
                setSelection({ start: rectangleStart, end: rectangleEnd });
            }
            setIsMouseDown(false);
            setDragMode(null);
            setRectangleStart(null);
            setRectangleEnd(null);
        };
        window.addEventListener("mouseup", handleUp);
        window.addEventListener("mouseleave", handleUp);
        return () => {
            window.removeEventListener("mouseup", handleUp);
            window.removeEventListener("mouseleave", handleUp);
        };
    }, [rectangleMode, selectMode, rectangleStart, rectangleEnd]);

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

    // Fill rectangle with color
    const fillRectangle = (start, end) => {
        setGrid((prev) => {
            const newGrid = prev.map((row) => row.map((cell) => ({ ...cell })));
            const x1 = Math.min(start.x, end.x);
            const x2 = Math.max(start.x, end.x);
            const y1 = Math.min(start.y, end.y);
            const y2 = Math.max(start.y, end.y);
            let usedColor = false;
            for (let y = y1; y <= y2; y++) {
                for (let x = x1; x <= x2; x++) {
                    if (newGrid[y][x].used) {
                        newGrid[y][x].color = color;
                        usedColor = true;
                    }
                }
            }
            if (usedColor) addColorToHistory(color, newGrid);
            return newGrid;
        });
    };

    // Rotate selected area by 90 degrees clockwise
    const rotateSelection = () => {
        if (!selection) return;
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

    // Add color to history only if used in grid
    const addColorToHistory = (color, gridSnapshot) => {
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
    };

    // --- Optimize cell update: only update changed cell ---
    const handleCellAction = useCallback(
        (x, y, e, isDrag = false) => {
            setGrid((prev) => {
                const row = prev[y];
                const cell = row[x];
                let usedColor = false;
                let updatedCell = { ...cell };

                if ((e && e.shiftKey) || dragMode === "unused") {
                    if (!isDrag) {
                        updatedCell.used = !updatedCell.used;
                        if (!updatedCell.used) updatedCell.color = null;
                    } else {
                        updatedCell.used = true;
                    }
                } else if (
                    updatedCell.used &&
                    (dragMode === "color" || !isDrag)
                ) {
                    updatedCell.color = color;
                    usedColor = true;
                }
                if (usedColor) addColorToHistory(color, prev);

                // Only update if changed
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
        [color, dragMode, addColorToHistory]
    );

    const handleCellMouseDown = useCallback(
        (x, y, e) => {
            setIsMouseDown(true);
            if (rectangleMode) {
                setRectangleStart({ x, y });
                setRectangleEnd({ x, y });
                setDragMode("rectangle");
            } else if (selectMode) {
                setRectangleStart({ x, y });
                setRectangleEnd({ x, y });
                setDragMode("select");
            } else if (e.shiftKey) {
                setDragMode("unused");
            } else {
                setDragMode("color");
            }
            handleCellAction(x, y, e, false);
        },
        [rectangleMode, selectMode, handleCellAction]
    );

    const handleCellMouseEnter = useCallback(
        (x, y, e) => {
            if (isMouseDown) {
                handleCellAction(x, y, e, true);
            }
        },
        [isMouseDown, handleCellAction]
    );

    // Rectangle/selection highlight
    const isInRectangle = (x, y) => {
        if (rectangleMode && rectangleStart && rectangleEnd) {
            const x1 = Math.min(rectangleStart.x, rectangleEnd.x);
            const x2 = Math.max(rectangleStart.x, rectangleEnd.x);
            const y1 = Math.min(rectangleStart.y, rectangleEnd.y);
            const y2 = Math.max(rectangleStart.y, rectangleEnd.y);
            return x >= x1 && x <= x2 && y >= y1 && y <= y2;
        }
        if (selectMode && rectangleStart && rectangleEnd) {
            const x1 = Math.min(rectangleStart.x, rectangleEnd.x);
            const x2 = Math.max(rectangleStart.x, rectangleEnd.x);
            const y1 = Math.min(rectangleStart.y, rectangleEnd.y);
            const y2 = Math.max(rectangleStart.y, rectangleEnd.y);
            return x >= x1 && x <= x2 && y >= y1 && y <= y2;
        }
        if (selection) {
            const { start, end } = selection;
            const x1 = Math.min(start.x, end.x);
            const x2 = Math.max(start.x, end.x);
            const y1 = Math.min(start.y, end.y);
            const y2 = Math.max(start.y, end.y);
            return x >= x1 && x <= x2 && y >= y1 && y <= y2;
        }
        return false;
    };

    // Render grid
    const displayGrid = grid;

    // Deselecting selection tool clears selection indicator
    const handleSelectModeToggle = () => {
        setSelectMode((m) => {
            if (m) setSelection(null); // If turning off, clear selection
            return !m;
        });
        setRectangleMode(false);
    };

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
                            onClick={() => {
                                setRectangleMode((m) => !m);
                                setSelectMode(false);
                                setSelection(null);
                            }}
                            style={{
                                background: rectangleMode
                                    ? "#e0e0e0"
                                    : undefined,
                                fontWeight: rectangleMode ? "bold" : undefined,
                            }}
                        >
                            {rectangleMode ? "Rectangle: ON" : "Draw Rectangle"}
                        </button>
                        <button
                            onClick={handleSelectModeToggle}
                            style={{
                                background: selectMode ? "#e0e0e0" : undefined,
                                fontWeight: selectMode ? "bold" : undefined,
                            }}
                        >
                            {selectMode ? "Select: ON" : "Select Area"}
                        </button>
                        <button
                            onClick={rotateSelection}
                            disabled={!selection || !selectMode}
                            style={{
                                background:
                                    selection && selectMode
                                        ? "#e0e0e0"
                                        : undefined,
                                fontWeight:
                                    selection && selectMode
                                        ? "bold"
                                        : undefined,
                                opacity: selection && selectMode ? 1 : 0.5,
                                cursor:
                                    selection && selectMode
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
                    <table
                        className="pattern-grid"
                        style={{ borderCollapse: "collapse" }}
                    >
                        <tbody>
                            {displayGrid.slice(0, rows).map((row, y) => (
                                <tr key={y}>
                                    {row.slice(0, cols).map((cell, x) => (
                                        <PatternCell
                                            key={x}
                                            cell={cell}
                                            x={x}
                                            y={y}
                                            isInRectangle={isInRectangle(x, y)}
                                            onMouseDown={(e) =>
                                                handleCellMouseDown(x, y, e)
                                            }
                                            onMouseEnter={(e) =>
                                                handleCellMouseEnter(x, y, e)
                                            }
                                        />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
