import React from "react";

function Sidebar({
    isMobile,
    isMenuOpen,
    setIsMenuOpen,
    cols,
    setCols,
    rows,
    setRows,
    color,
    setColor,
    colorHistory,
    mode,
    setMode,
    selection,
    rotateSelection,
    undo,
    redo,
    history,
    redoStack,
}) {
    return (
        <>
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
                                mode === "rectangle" ? "#e0e0e0" : undefined,
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
                            fontWeight: mode === "select" ? "bold" : undefined,
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
                            setMode(mode === "exclude" ? "draw" : "exclude");
                            if (isMobile) setIsMenuOpen(false);
                        }}
                        style={{
                            background:
                                mode === "exclude" ? "#e0e0e0" : undefined,
                            fontWeight: mode === "exclude" ? "bold" : undefined,
                        }}
                    >
                        {mode === "exclude" ? "Exclude: ON" : "Exclude Cells"}
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
                                history.length < 2 ? "not-allowed" : "pointer",
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
                    (Use Exclude mode to mark cells as unused/used. Shift+Draw
                    now draws straight lines.)
                </span>
            </div>
        </>
    );
}

export default Sidebar;
