// Utility functions for grid operations

const LOCAL_STORAGE_KEY = "knitting-pattern-state-v1";

export function createEmptyGrid(cols, rows, prevGrid = null) {
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

export function rotateMatrix90(matrix) {
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

export function deepCloneGrid(grid) {
    return grid.map((row) => row.map((cell) => ({ ...cell })));
}

// Helper to load state from localStorage synchronously
export function loadInitialState() {
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
