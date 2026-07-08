"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Trash2, 
  Download, 
  Loader2, 
  Scissors, 
  Lock, 
  Unlock, 
  RefreshCw, 
  ArrowRight,
  Palette,
  Maximize2,
  Undo,
  Brush,
  ShieldAlert
} from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { track } from "@vercel/analytics";
import styles from "./BgRemover.module.css";

type BgType = "transparent" | "color";

export default function BgRemover() {
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [transparentImage, setTransparentImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Background Fill Options
  const [bgType, setBgType] = useState<BgType>("transparent");
  const [bgColor, setBgColor] = useState<string>("#ffffff");

  // Resize Options
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [scale, setScale] = useState<number>(100);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  // Eraser Brush Options
  const [isEraserMode, setIsEraserMode] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(30);
  const [historyStack, setHistoryStack] = useState<ImageData[]>([]);
  const [canvasCursorPos, setCanvasCursorPos] = useState<{ x: number; y: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Predefined solid background color options (Premium Presets)
  const presetColors = [
    { value: "#ffffff", label: "White" },
    { value: "#000000", label: "Black" },
    { value: "#f4f4f5", label: "Off-White" },
    { value: "#bae6fd", label: "Sky Blue" },
    { value: "#fbcfe8", label: "Pastel Pink" },
    { value: "#a7f3d0", label: "Mint Green" },
  ];

  // Handle uploaded raw image
  const handleImageUploaded = (dataUrl: string) => {
    setRawImage(dataUrl);
    setTransparentImage(null);
    setError(null);
    setIsLoading(true);

    // Initialize dimensions
    const img = new Image();
    img.onload = () => {
      setOriginalWidth(img.width);
      setOriginalHeight(img.height);
      setWidth(img.width);
      setHeight(img.height);
      setAspectRatio(img.width / img.height);
      setScale(100);
      setLockAspectRatio(true);
      
      // Trigger background removal once image dimensions are cached
      processBackgroundRemoval(dataUrl);
    };
    img.onerror = () => {
      setIsLoading(false);
      setError("Failed to load image. Please try another image file.");
    };
    img.src = dataUrl;
  };

  // Perform client-side background removal
  const processBackgroundRemoval = async (imageSource: string) => {
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(imageSource);
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      setTransparentImage(dataUrl);
    } catch (err) {
      console.error("Local background removal failed:", err);
      setError("Background removal failed. Please make sure the photo contains a clear subject.");
    } finally {
      setIsLoading(false);
    }
  };

  // Sync transparent WASM output to editing Canvas
  useEffect(() => {
    if (!transparentImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Set canvas logic dimensions matching the high-resolution output exactly
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Initialize the history stack with the base ImageData state
      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistoryStack([initialData]);
    };
    img.src = transparentImage;
  }, [transparentImage]);

  // Pointer interaction coordinates mapping
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return null;
    
    const canvasRect = canvas.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    
    // Map client coordinates to logical high-resolution canvas coordinates
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    
    return {
      x: (e.clientX - canvasRect.left) * scaleX,
      y: (e.clientY - canvasRect.top) * scaleY,
      client: {
        x: e.clientX - wrapperRect.left,
        y: e.clientY - wrapperRect.top
      }
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEraserMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    
    const coords = getCanvasCoords(e);
    if (coords) {
      // Save current canvas state to history stack before stroke
      const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistoryStack(prev => [...prev.slice(-4), currentData]); // limit history to last 5 states

      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      // Map slider brushSize (which is in CSS pixels) to logical high-resolution pixels
      const rect = canvas.getBoundingClientRect();
      const logicalBrushSize = brushSize * (canvas.width / rect.width);
      ctx.lineWidth = logicalBrushSize;

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      lastPointRef.current = { x: coords.x, y: coords.y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (coords) {
      setCanvasCursorPos(coords.client);
    } else {
      setCanvasCursorPos(null);
    }

    if (!isDrawingRef.current || !isEraserMode) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !coords || !lastPointRef.current) return;

    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const rect = canvas.getBoundingClientRect();
    const logicalBrushSize = brushSize * (canvas.width / rect.width);
    ctx.lineWidth = logicalBrushSize;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = { x: coords.x, y: coords.y };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }
      isDrawingRef.current = false;
      lastPointRef.current = null;
    }
  };

  const handlePointerLeave = () => {
    setCanvasCursorPos(null);
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleUndo = () => {
    if (historyStack.length <= 1) return; // Keep the original state
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const prevStates = [...historyStack];
    prevStates.pop(); // Pop current state
    setHistoryStack(prevStates);

    const stateToRestore = prevStates[prevStates.length - 1];
    ctx.putImageData(stateToRestore, 0, 0);
  };

  const handleResetEraser = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || historyStack.length === 0) return;

    const originalData = historyStack[0];
    ctx.putImageData(originalData, 0, 0);
    setHistoryStack([originalData]);
  };

  // Dimension Handlers
  const handleWidthChange = (w: number) => {
    if (w <= 0) return;
    setWidth(w);
    setScale(Math.round((w / originalWidth) * 100));

    if (lockAspectRatio) {
      setHeight(Math.round(w / aspectRatio));
    }
  };

  const handleHeightChange = (h: number) => {
    if (h <= 0) return;
    setHeight(h);
    setScale(Math.round((h / originalHeight) * 100));

    if (lockAspectRatio) {
      setWidth(Math.round(h * aspectRatio));
    }
  };

  const handleScaleChange = (s: number) => {
    setScale(s);
    const newWidth = Math.round(originalWidth * (s / 100));
    const newHeight = Math.round(originalHeight * (s / 100));
    setWidth(newWidth);
    setHeight(newHeight);
  };

  const handleLockToggle = () => {
    setLockAspectRatio(!lockAspectRatio);
    if (!lockAspectRatio) {
      // Re-lock and enforce aspect ratio of current width
      setAspectRatio(width / height);
    }
  };

  const handleResetResize = () => {
    setWidth(originalWidth);
    setHeight(originalHeight);
    setScale(100);
    setAspectRatio(originalWidth / originalHeight);
    setLockAspectRatio(true);
  };

  // Compile output and download
  const handleDownload = () => {
    const srcImage = canvasRef.current ? canvasRef.current.toDataURL() : transparentImage || rawImage;
    if (!srcImage) return;

    try {
      track("Background Removed", { type: bgType, scale });
    } catch (e) {
      console.error("Tracking error:", e);
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Fill solid background if enabled
      if (bgType === "color" && transparentImage) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Draw processed transparent subject (stretched to custom dimensions)
      ctx.drawImage(img, 0, 0, width, height);

      // 3. Trigger local file download
      const link = document.createElement("a");
      const ext = bgType === "transparent" ? "png" : "jpeg";
      link.href = canvas.toDataURL(`image/${ext}`, 0.95);
      link.download = `toolnest_smart_bg_removed_${Date.now()}.${ext}`;
      link.click();
    };
    img.src = srcImage;
  };

  const handleReset = () => {
    setRawImage(null);
    setTransparentImage(null);
    setError(null);
  };

  return (
    <div className={styles.container}>
      {/* Tool Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: "700", margin: 0 }}>Professional BG Remover</h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem", margin: "0.25rem 0 0 0" }}>
            Remove backgrounds from photos and resize assets for pitch decks and slides.
          </p>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.15)",
          color: "var(--color-success)",
          padding: "0.4rem 0.8rem",
          borderRadius: "9999px",
          fontSize: "0.8rem",
          fontWeight: "500"
        }}>
          <ShieldAlert size={14} />
          <span>Processed 100% locally</span>
        </div>
      </div>

      {/* Main workspace */}
      {rawImage ? (
        <div className={styles.workspaceGrid}>
          {/* Comparison Panels */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>
                <Scissors size={18} className="text-indigo-400" />
                Original vs Transparent Result
              </h3>
            </div>
            
            <div className={`${styles.panelBody} glass-panel`}>
              <div className={styles.comparisonContainer}>
                {/* Left: Original Preview */}
                <div className={styles.compareBox}>
                  <span className={styles.compareLabel}>Before (Original)</span>
                  <div className={styles.imageViewport}>
                    <img src={rawImage} alt="Original uploaded asset" className={styles.previewImage} />
                  </div>
                </div>

                {/* Right: Transparent Result Preview */}
                <div className={styles.compareBox}>
                  <span className={styles.compareLabel}>After (Output)</span>
                  <div 
                    className={`${styles.imageViewport} ${bgType === "transparent" ? styles.checkerboard : ""}`}
                    style={{ backgroundColor: bgType === "color" ? bgColor : "transparent" }}
                  >
                    {transparentImage ? (
                      <div ref={wrapperRef} style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <canvas
                          ref={canvasRef}
                          className={styles.previewImage}
                          style={{
                            cursor: isEraserMode ? "none" : "default",
                            transform: `scale(${scale / 100})`,
                            transformOrigin: "center",
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            touchAction: "none"
                          }}
                          onPointerDown={handlePointerDown}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerLeave={handlePointerLeave}
                        />
                        {isEraserMode && canvasCursorPos && (
                          <div 
                            style={{
                              position: "absolute",
                              left: `${canvasCursorPos.x}px`,
                              top: `${canvasCursorPos.y}px`,
                              width: `${brushSize}px`,
                              height: `${brushSize}px`,
                              borderRadius: "50%",
                              border: "2px solid rgba(255, 255, 255, 0.85)",
                              boxShadow: "0 0 5px rgba(0, 0, 0, 0.6)",
                              pointerEvents: "none",
                              transform: "translate(-50%, -50%)",
                              zIndex: 10,
                              backgroundColor: "rgba(255, 255, 255, 0.15)"
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      !isLoading && !error && <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>Awaiting process...</div>
                    )}

                    {/* Local neural network loader overlay */}
                    {isLoading && (
                      <div className={styles.loadingOverlay}>
                        <Loader2 className={styles.loadingSpinner} size={44} />
                        <div className={styles.loadingText}>Removing background...</div>
                        <div className={styles.loadingSubtext}>
                          Neural network models are running locally in your browser. First use loads WASM modules (~30MB).
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className={styles.loadingOverlay} style={{ background: "rgba(9, 9, 11, 0.95)" }}>
                        <p className={styles.errorText}>{error}</p>
                        <button type="button" className={styles.secondaryBtn} onClick={handleReset} style={{ marginTop: "1rem" }}>
                          Try Another Image
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Controls Sidebar */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>
                Customize Output Asset
              </h3>
            </div>

            <div className={styles.panelBody} style={{ padding: 0 }}>
              {/* Option: Eraser Brush Tool (Touch up) */}
              {transparentImage && (
                <div className={styles.optionGroup}>
                  <h4 className={styles.optionTitle}>
                    <Brush size={16} className="text-indigo-400" />
                    Manual Background Touch-up
                  </h4>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className={`${styles.typeBtn} ${isEraserMode ? styles.typeBtnActive : ""}`}
                        onClick={() => setIsEraserMode(true)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", flex: 1 }}
                      >
                        <Brush size={14} />
                        Eraser Brush ON
                      </button>
                      <button
                        type="button"
                        className={`${styles.typeBtn} ${!isEraserMode ? styles.typeBtnActive : ""}`}
                        onClick={() => {
                          setIsEraserMode(false);
                          setCanvasCursorPos(null);
                        }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", flex: 1 }}
                      >
                        <span>Standard Cursor</span>
                      </button>
                    </div>

                    {isEraserMode && (
                      <div className={styles.customColorField} style={{ marginTop: "0.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <label style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: "500" }}>
                            Brush Size: <strong>{brushSize}px</strong>
                          </label>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="80"
                          value={brushSize}
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          style={{
                            width: "100%",
                            height: "6px",
                            background: "rgba(255, 255, 255, 0.15)",
                            borderRadius: "3px",
                            outline: "none",
                            appearance: "none",
                            cursor: "pointer",
                            marginTop: "0.5rem"
                          }}
                        />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={handleUndo}
                        disabled={historyStack.length <= 1}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", flex: 1, padding: "0.5rem", fontSize: "0.75rem" }}
                      >
                        <Undo size={12} />
                        Undo Stroke ({Math.max(0, historyStack.length - 1)})
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={handleResetEraser}
                        disabled={historyStack.length <= 1}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", flex: 1, padding: "0.5rem", fontSize: "0.75rem", borderColor: "rgba(239, 68, 68, 0.2)", color: "var(--color-danger)" }}
                      >
                        <RefreshCw size={12} />
                        Restore Original
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Option A: Background fills */}
              <div className={styles.optionGroup}>
                <h4 className={styles.optionTitle}>
                  <Palette size={16} className="text-indigo-400" />
                  Background Style
                </h4>
                
                <div className={styles.bgTypeSelectRow}>
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${bgType === "transparent" ? styles.typeBtnActive : ""}`}
                    onClick={() => setBgType("transparent")}
                    disabled={isLoading}
                  >
                    Transparent PNG
                  </button>
                  
                  <button
                    type="button"
                    className={`${styles.typeBtn} ${bgType === "color" ? styles.typeBtnActive : ""}`}
                    onClick={() => setBgType("color")}
                    disabled={isLoading}
                  >
                    Solid Background
                  </button>
                </div>

                {bgType === "color" && (
                  <div className={styles.customColorField}>
                    <label style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: "500" }}>
                      Select Color
                    </label>
                    <div className={styles.colorPickerRow}>
                      {presetColors.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={styles.presetColorBtn}
                          style={{
                            backgroundColor: color.value,
                            border: bgColor === color.value ? "2px solid var(--color-accent)" : "1px solid rgba(255,255,255,0.15)",
                            boxShadow: bgColor === color.value ? "0 0 8px var(--color-accent-glow)" : "none",
                          }}
                          onClick={() => setBgColor(color.value)}
                          title={color.label}
                        />
                      ))}
                      <input
                        type="color"
                        value={bgColor.startsWith("#") ? bgColor : "#ffffff"}
                        onChange={(e) => setBgColor(e.target.value)}
                        className={styles.colorInput}
                        title="Custom Palette Color"
                      />
                      <span className={styles.colorText}>{bgColor.toUpperCase()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Option B: Resizing */}
              <div className={styles.optionGroup}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 className={styles.optionTitle}>
                    <Maximize2 size={16} className="text-indigo-400" />
                    Resize Output Image
                  </h4>
                  {(width !== originalWidth || height !== originalHeight) && (
                    <button type="button" className={styles.resetBtn} onClick={handleResetResize}>
                      Reset Dimensions
                    </button>
                  )}
                </div>

                <div className={styles.resizerGrid}>
                  <div className={styles.dimensionRow}>
                    <div className={styles.inputField}>
                      <label htmlFor="resize-width-input">Width (px)</label>
                      <input
                        id="resize-width-input"
                        type="number"
                        min="1"
                        value={width || ""}
                        onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                        disabled={isLoading}
                      />
                    </div>

                    <button
                      type="button"
                      className={`${styles.lockBtn} ${lockAspectRatio ? styles.lockBtnActive : ""}`}
                      onClick={handleLockToggle}
                      title={lockAspectRatio ? "Unlock aspect ratio" : "Lock aspect ratio"}
                      disabled={isLoading}
                    >
                      {lockAspectRatio ? <Lock size={16} /> : <Unlock size={16} />}
                    </button>

                    <div className={styles.inputField}>
                      <label htmlFor="resize-height-input">Height (px)</label>
                      <input
                        id="resize-height-input"
                        type="number"
                        min="1"
                        value={height || ""}
                        onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* Percentage Scale Slider */}
                  <div className={styles.scaleSliderGroup}>
                    <div className={styles.scaleHeader}>
                      <label htmlFor="scale-slider">Scale Image</label>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-light)", fontWeight: "bold" }}>
                        {scale}%
                      </span>
                    </div>
                    <input
                      id="scale-slider"
                      type="range"
                      min="10"
                      max="200"
                      step="1"
                      value={scale}
                      onChange={(e) => handleScaleChange(parseInt(e.target.value))}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.actionBtnRow}>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isLoading || error !== null}
                  className={`${styles.primaryBtn} accent-gradient`}
                >
                  <Download size={18} />
                  Download Processed Image
                </button>
                
                <button
                  type="button"
                  onClick={handleReset}
                  className={styles.secondaryBtn}
                >
                  <Trash2 size={16} />
                  Upload Another Photo
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* Image Upload State */
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <ImageUpload onUpload={handleImageUploaded} />
        </div>
      )}
    </div>
  );
}
