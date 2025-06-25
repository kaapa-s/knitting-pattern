import React, { useRef, useEffect, useState } from "react";

function getCellAtMouse(e, canvas, cellSize, cols, rows) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
    return { x, y };
}

const MM_TO_PX = 3.7795275591; // 1mm ≈ 3.78px at 96dpi
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PRINT_MARGIN_MM = 10;

const PatternCanvas = ({
    grid,
    rows,
    cols,
    cellSize = 24,
    mode = "draw", // 'draw' | 'rectangle' | 'select'
    onRectangleComplete,
    onSelectionComplete,
    onCellDraw,
    isPrintMode = false,
    highlightArea,
}) => {
    const canvasRef = useRef(null);
    const mouseDownRef = useRef(false);
    const [dragStart, setDragStart] = useState(null); // {x, y}
    const [dragCurrent, setDragCurrent] = useState(null); // {x, y}

    // Calculate print size if print mode
    let printWidthPx = null;
    let printHeightPx = null;
    if (isPrintMode) {
        printWidthPx = (A4_WIDTH_MM - 2 * PRINT_MARGIN_MM) * MM_TO_PX;
        printHeightPx = (A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM) * MM_TO_PX;
        // Fit grid to page
        cellSize = Math.min(
            Math.floor(printWidthPx / cols),
            Math.floor(printHeightPx / rows)
        );
    }

    // Draw the grid and highlight
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw cells
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (!grid[y] || !grid[y][x]) continue;
                const cell = grid[y][x];
                const px = x * cellSize;
                const py = y * cellSize;
                // Cell background
                ctx.fillStyle = cell.used && cell.color ? cell.color : "#fff";
                ctx.globalAlpha = cell.used ? 1 : 0.1;
                ctx.fillRect(px, py, cellSize, cellSize);
                ctx.globalAlpha = 1;
                // Cell border
                if (cell.used) {
                    ctx.strokeStyle = "#888";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(px, py, cellSize, cellSize);
                }
                // Unused cell X (not in print mode)
                if (!cell.used && !isPrintMode) {
                    ctx.save();
                    ctx.strokeStyle = "#c00";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(px + 4, py + 4);
                    ctx.lineTo(px + cellSize - 4, py + cellSize - 4);
                    ctx.moveTo(px + cellSize - 4, py + 4);
                    ctx.lineTo(px + 4, py + cellSize - 4);
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
            const left = x1 * cellSize;
            const top = y1 * cellSize;
            const width = (x2 - x1 + 1) * cellSize;
            const height = (y2 - y1 + 1) * cellSize;
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
            const left = Math.min(x1, x2) * cellSize;
            const top = Math.min(y1, y2) * cellSize;
            const width = (Math.abs(x2 - x1) + 1) * cellSize;
            const height = (Math.abs(y2 - y1) + 1) * cellSize;
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
    }, [
        grid,
        rows,
        cols,
        cellSize,
        dragStart,
        dragCurrent,
        mode,
        isPrintMode,
        highlightArea,
    ]);

    // Mouse event handlers (pointer events for robustness)
    useEffect(() => {
        if (isPrintMode) return; // No interaction in print mode
        const canvas = canvasRef.current;
        if (!canvas) return;
        function handlePointerDown(e) {
            const cell = getCellAtMouse(e, canvas, cellSize, cols, rows);
            if (!cell) return;
            mouseDownRef.current = true;
            setDragStart(cell);
            setDragCurrent(cell);
            if (mode === "draw") {
                onCellDraw && onCellDraw(cell.x, cell.y, e);
            }
        }
        function handlePointerMove(e) {
            if (!mouseDownRef.current) return;
            const cell = getCellAtMouse(e, canvas, cellSize, cols, rows);
            if (!cell) return;
            setDragCurrent(cell);
            if (mode === "draw") {
                onCellDraw && onCellDraw(cell.x, cell.y, e);
            }
        }
        function handlePointerUp(e) {
            if (!mouseDownRef.current) return;
            mouseDownRef.current = false;
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
        onRectangleComplete,
        onSelectionComplete,
        cellSize,
        cols,
        rows,
        isPrintMode,
        dragStart,
        dragCurrent,
    ]);

    return (
        <canvas
            ref={canvasRef}
            width={cols * cellSize}
            height={rows * cellSize}
            style={{
                display: "block",
                background: "#fff",
                boxShadow: isPrintMode ? undefined : "0 1px 4px #0002",
                userSelect: "none",
                cursor:
                    isPrintMode || mode === "rectangle" || mode === "select"
                        ? "crosshair"
                        : "pointer",
                maxWidth: isPrintMode ? `${printWidthPx}px` : "100%",
                maxHeight: isPrintMode ? `${printHeightPx}px` : undefined,
                margin: isPrintMode ? "0 auto" : undefined,
            }}
            tabIndex={0}
        />
    );
};

export default PatternCanvas;
