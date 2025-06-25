import React, { useRef, useEffect, useState } from "react";

function getCellAtMouse(
    e,
    canvas,
    cellSize,
    cols,
    rows,
    offsetX = 0,
    offsetY = 0
) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left - offsetX) / cellSize);
    const y = Math.floor((e.clientY - rect.top - offsetY) / cellSize);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
    return { x, y };
}

const MM_TO_PX = 3.7795275591; // 1mm ≈ 3.78px at 96dpi
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PRINT_MARGIN_MM = 10;
const NUMBER_FONT = "14px system-ui, sans-serif";
const NUMBER_MARGIN = 6; // px
const NUMBER_HEIGHT = 18; // px
const NUMBER_WIDTH = 24; // px
const NUMBER_BOTTOM_PADDING = 10; // px extra below bottom numbers
const NUMBER_RIGHT_PADDING = 10; // px extra right of right numbers

const PatternCanvas = ({
    grid,
    rows,
    cols,
    cellSize = 24,
    mode = "draw", // 'draw' | 'rectangle' | 'select' | 'exclude'
    onRectangleComplete,
    onSelectionComplete,
    onCellDraw,
    onCellExclude,
    isPrintMode = false,
    highlightArea,
    onDrawStart,
    onDrawEnd,
}) => {
    const canvasRef = useRef(null);
    const mouseDownRef = useRef(false);
    const [dragStart, setDragStart] = useState(null); // {x, y}
    const [dragCurrent, setDragCurrent] = useState(null); // {x, y}
    const excludedCellsRef = useRef(new Set());

    // Calculate print size if print mode
    let printWidthPx = null;
    let printHeightPx = null;
    let effectiveCellSize = cellSize;
    if (isPrintMode) {
        printWidthPx = (A4_WIDTH_MM - 2 * PRINT_MARGIN_MM) * MM_TO_PX;
        printHeightPx = (A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM) * MM_TO_PX;
        // Fit grid to page (including space for numbers)
        effectiveCellSize = Math.min(
            Math.floor((printWidthPx - NUMBER_WIDTH) / cols),
            Math.floor((printHeightPx - NUMBER_HEIGHT) / rows)
        );
    }
    // Add space for numbers
    const offsetX = 0;
    const offsetY = 0;
    const gridWidth = cols * effectiveCellSize;
    const gridHeight = rows * effectiveCellSize;
    const canvasWidth = gridWidth + NUMBER_WIDTH + NUMBER_RIGHT_PADDING;
    const canvasHeight = gridHeight + NUMBER_HEIGHT + NUMBER_BOTTOM_PADDING;

    // Draw the grid, highlight, and numbers
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw cells
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (!grid[y] || !grid[y][x]) continue;
                const cell = grid[y][x];
                const px = x * effectiveCellSize;
                const py = y * effectiveCellSize;
                // Cell background
                ctx.fillStyle = cell.used && cell.color ? cell.color : "#fff";
                ctx.globalAlpha = cell.used ? 1 : 0.1;
                ctx.fillRect(px, py, effectiveCellSize, effectiveCellSize);
                ctx.globalAlpha = 1;
                // Cell border
                if (cell.used) {
                    ctx.strokeStyle = "#888";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        px,
                        py,
                        effectiveCellSize,
                        effectiveCellSize
                    );
                }
                // Unused cell X (not in print mode)
                if (!cell.used && !isPrintMode) {
                    ctx.save();
                    ctx.strokeStyle = "#c00";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(px + 4, py + 4);
                    ctx.lineTo(
                        px + effectiveCellSize - 4,
                        py + effectiveCellSize - 4
                    );
                    ctx.moveTo(px + effectiveCellSize - 4, py + 4);
                    ctx.lineTo(px + 4, py + effectiveCellSize - 4);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
        // Draw highlight rectangle if dragging
        if (
            dragStart &&
            dragCurrent &&
            (mode === "rectangle" || mode === "select")
        ) {
            const x1 = Math.min(dragStart.x, dragCurrent.x);
            const x2 = Math.max(dragStart.x, dragCurrent.x);
            const y1 = Math.min(dragStart.y, dragCurrent.y);
            const y2 = Math.max(dragStart.y, dragCurrent.y);
            const left = x1 * effectiveCellSize;
            const top = y1 * effectiveCellSize;
            const width = (x2 - x1 + 1) * effectiveCellSize;
            const height = (y2 - y1 + 1) * effectiveCellSize;
            ctx.save();
            ctx.strokeStyle = "#1976d2";
            ctx.lineWidth = 2;
            ctx.shadowColor = "#1976d2";
            ctx.shadowBlur = 4;
            ctx.strokeRect(left + 1, top + 1, width - 2, height - 2);
            ctx.restore();
        }
        // Draw highlightArea if provided (for selection mode)
        if (highlightArea) {
            const {
                x1,
                y1,
                x2,
                y2,
                color = "#1976d2",
                shadow = true,
            } = highlightArea;
            const left = Math.min(x1, x2) * effectiveCellSize;
            const top = Math.min(y1, y2) * effectiveCellSize;
            const width = (Math.abs(x2 - x1) + 1) * effectiveCellSize;
            const height = (Math.abs(y2 - y1) + 1) * effectiveCellSize;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            if (shadow) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 4;
            }
            ctx.strokeRect(left + 1, top + 1, width - 2, height - 2);
            ctx.restore();
        }
        // Draw column numbers (bottom, origin at right)
        ctx.save();
        ctx.font = NUMBER_FONT;
        ctx.fillStyle = "#222";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (let x = 0; x < cols; x++) {
            const colNum = cols - x;
            const px = x * effectiveCellSize + effectiveCellSize / 2;
            ctx.fillText(colNum.toString(), px, gridHeight + NUMBER_MARGIN);
        }
        // Draw row numbers (right, origin at bottom)
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (let y = 0; y < rows; y++) {
            const rowNum = rows - y;
            const py = y * effectiveCellSize + effectiveCellSize / 2;
            ctx.fillText(rowNum.toString(), gridWidth + NUMBER_MARGIN, py);
        }
        ctx.restore();
    }, [
        grid,
        rows,
        cols,
        effectiveCellSize,
        dragStart,
        dragCurrent,
        mode,
        isPrintMode,
        highlightArea,
        gridWidth,
        gridHeight,
    ]);

    // Mouse event handlers (pointer events for robustness)
    useEffect(() => {
        if (isPrintMode) return; // No interaction in print mode
        const canvas = canvasRef.current;
        if (!canvas) return;
        function cellKey(x, y) {
            return `${x},${y}`;
        }
        function handlePointerDown(e) {
            const cell = getCellAtMouse(
                e,
                canvas,
                effectiveCellSize,
                cols,
                rows
            );
            if (!cell) return;
            mouseDownRef.current = true;
            setDragStart(cell);
            setDragCurrent(cell);
            if (mode === "draw") {
                if (onDrawStart) onDrawStart();
                if (e.shiftKey) {
                    // Start straight line
                    onCellDraw && onCellDraw(cell.x, cell.y, e, true); // true = isLine
                } else {
                    onCellDraw && onCellDraw(cell.x, cell.y, e);
                }
            } else if (mode === "exclude") {
                excludedCellsRef.current = new Set();
                const key = cellKey(cell.x, cell.y);
                excludedCellsRef.current.add(key);
                onCellExclude && onCellExclude(cell.x, cell.y, e);
            }
        }
        function handlePointerMove(e) {
            if (!mouseDownRef.current) return;
            const cell = getCellAtMouse(
                e,
                canvas,
                effectiveCellSize,
                cols,
                rows
            );
            if (!cell) return;
            setDragCurrent(cell);
            if (mode === "draw") {
                if (e.shiftKey && dragStart) {
                    // Draw straight line from dragStart to cell
                    onCellDraw &&
                        onCellDraw(dragStart.x, dragStart.y, e, true, cell);
                } else {
                    onCellDraw && onCellDraw(cell.x, cell.y, e);
                }
            } else if (mode === "exclude") {
                const key = cellKey(cell.x, cell.y);
                if (!excludedCellsRef.current.has(key)) {
                    excludedCellsRef.current.add(key);
                    onCellExclude && onCellExclude(cell.x, cell.y, e);
                }
            }
        }
        function handlePointerUp(e) {
            if (!mouseDownRef.current) return;
            mouseDownRef.current = false;
            excludedCellsRef.current = new Set();
            if (mode === "draw") {
                if (onDrawEnd) onDrawEnd();
            }
            if (dragStart && dragCurrent) {
                if (mode === "rectangle" && onRectangleComplete) {
                    onRectangleComplete({
                        x1: dragStart.x,
                        y1: dragStart.y,
                        x2: dragCurrent.x,
                        y2: dragCurrent.y,
                    });
                } else if (mode === "select" && onSelectionComplete) {
                    onSelectionComplete({
                        x1: dragStart.x,
                        y1: dragStart.y,
                        x2: dragCurrent.x,
                        y2: dragCurrent.y,
                    });
                }
            }
            setDragStart(null);
            setDragCurrent(null);
        }
        canvas.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            canvas.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [
        mode,
        onCellDraw,
        onCellExclude,
        onRectangleComplete,
        onSelectionComplete,
        effectiveCellSize,
        cols,
        rows,
        isPrintMode,
        dragStart,
        dragCurrent,
        onDrawStart,
        onDrawEnd,
    ]);

    return (
        <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{
                display: "block",
                background: "#fff",
                boxShadow: isPrintMode ? undefined : "0 1px 4px #0002",
                userSelect: "none",
                cursor:
                    isPrintMode || mode === "rectangle" || mode === "select"
                        ? "crosshair"
                        : "pointer",
                maxWidth: isPrintMode ? `${canvasWidth}px` : "100%",
                maxHeight: isPrintMode ? `${canvasHeight}px` : undefined,
                margin: isPrintMode ? "0 auto" : undefined,
            }}
            tabIndex={0}
        />
    );
};

export default PatternCanvas;
