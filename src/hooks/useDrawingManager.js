import { useState, useCallback } from "react";
import { createEmptyGrid, deepCloneGrid } from "../utils/gridUtils";

export default function useDrawingManager({
    initialGrid,
    color,
    addColorToHistory,
    cols,
    rows,
}) {
    const [grid, setGrid] = useState(initialGrid);
    const [selection, setSelection] = useState(null);

    // Rectangle fill logic
    const fillRectangle = useCallback(
        ({ x1, y1, x2, y2 }) => {
            setGrid((prev) => {
                const newGrid = prev.map((row) =>
                    row.map((cell) => ({ ...cell }))
                );
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
        },
        [color, addColorToHistory]
    );

    // Cell draw logic
    const handleCellDraw = useCallback(
        (x, y, e) => {
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

    // Rotate selection logic
    const rotateSelection = useCallback(() => {
        if (!selection || !selection.start || !selection.end) return;
        const { start, end } = selection;
        const x1 = Math.min(start.x, end.x);
        const x2 = Math.max(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const y2 = Math.max(start.y, end.y);
        const selWidth = x2 - x1 + 1;
        const selHeight = y2 - y1 + 1;
        if (x1 + selHeight - 1 >= cols || y1 + selWidth - 1 >= rows) return;
        const area = Array.from({ length: selHeight }, (_, y) =>
            Array.from({ length: selWidth }, (_, x) => grid[y1 + y][x1 + x])
        );
        const rotated = Array.from({ length: selWidth }, (_, y) =>
            Array.from(
                { length: selHeight },
                (_, x) => area[selHeight - 1 - x][y]
            )
        );
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
        setSelection({
            start: { x: x1, y: y1 },
            end: { x: x1 + selHeight - 1, y: y1 + selWidth - 1 },
        });
    }, [selection, grid, cols, rows]);

    // Selection complete logic
    const handleSelectionComplete = useCallback(({ x1, y1, x2, y2 }) => {
        setSelection({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
    }, []);

    return {
        grid,
        setGrid,
        selection,
        setSelection,
        fillRectangle,
        handleCellDraw,
        rotateSelection,
        handleSelectionComplete,
    };
}
