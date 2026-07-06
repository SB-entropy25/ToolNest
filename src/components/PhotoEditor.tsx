"use client";

import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, RotateCw, Sun, Contrast, Eye, EyeOff, RotateCcw, Loader2, Info } from "lucide-react";
import styles from "./PhotoEditor.module.css";

interface PhotoEditorProps {
  imageSrc: string;
  onChange: (croppedDataUrl: string) => void;
}

type BgChoiceType = "original" | "white" | "black" | "blue";

export default function PhotoEditor({ imageSrc, onChange }: PhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Manipulations state
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [showGuides, setShowGuides] = useState<boolean>(true);

  // Background Options state
  const [bgChoice, setBgChoice] = useState<BgChoiceType>("original");
  const [isProcessingBg, setIsProcessingBg] = useState<boolean>(false);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<HTMLImageElement | null>(null);

  // Date & Name Overlay state
  const [showDate, setShowDate] = useState<boolean>(false);
  const [dateText, setDateText] = useState<string>("");
  const [dateColor, setDateColor] = useState<string>("#ffffff");
  const [dateSize, setDateSize] = useState<number>(32);
  const [dateLocation, setDateLocation] = useState<string>("lower-center");
  const [dateFont, setDateFont] = useState<string>("sans");
  const [nameText, setNameText] = useState<string>("");
  const [namePosition, setNamePosition] = useState<string>("above"); // "above" or "below" the date

  // Set default date client-side to avoid Next.js hydration mismatches
  useEffect(() => {
    setDateText(new Date().toISOString().split("T")[0]);
  }, []);

  // Dragging state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const startDragRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ x: 0, y: 0 });

  // Canvas size constants (High DPI: 700x900 matches 3.5x4.5 ratio)
  const canvasWidth = 700;
  const canvasHeight = 900;

  // Load original image
  useEffect(() => {
    if (!imageSrc) return;
    setProcessedImageSrc(null);
    setBgChoice("original");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      
      // Calculate initial zoom to fit the image container nicely
      // We want the image to at least cover the passport box
      const wRatio = canvasWidth / img.width;
      const hRatio = canvasHeight / img.height;
      const fitZoom = Math.max(wRatio, hRatio);
      
      setZoom(Math.round(fitZoom * 1.1 * 10) / 10); // slightly zoomed in
      setOffsetX(0);
      setOffsetY(0);
      setRotation(0);
      setBrightness(100);
      setContrast(100);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Track the active image source
  const activeSource = (bgChoice !== "original" && processedImageSrc) ? processedImageSrc : imageSrc;

  useEffect(() => {
    if (!activeSource) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setActiveImage(img);
    };
    img.src = activeSource;
  }, [activeSource]);

  // Redraw canvas whenever adjustments change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImage) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw background color if selected
    if (bgChoice === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else if (bgChoice === "black") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else if (bgChoice === "blue") {
      ctx.fillStyle = "#cfdae6"; // Standard passport light blue-grey
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Save context state
    ctx.save();

    // 1. Setup filters (brightness & contrast)
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

    // 2. Center and apply translation, rotation, scale
    // We translate to the center of the canvas, apply offsets relative to center, rotate, and scale.
    ctx.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // 3. Draw image centered
    ctx.drawImage(activeImage, -activeImage.width / 2, -activeImage.height / 2, activeImage.width, activeImage.height);

    // Restore context state
    ctx.restore();

    // 4. Draw Date & Name Text overlay if enabled
    const hasDate = showDate && dateText;
    const hasName = nameText.trim() !== "";

    if (hasDate || hasName) {
      ctx.save();
      ctx.fillStyle = dateColor;
      
      // Map chosen style to standard web-safe font-families
      let fontName = "sans-serif";
      if (dateFont === "serif") fontName = "Georgia, serif";
      else if (dateFont === "mono") fontName = "monospace";
      else if (dateFont === "impact") fontName = "Impact, sans-serif";
      else if (dateFont === "arial") fontName = "Arial, sans-serif";
      else if (dateFont === "times") fontName = "'Times New Roman', serif";
      else if (dateFont === "verdana") fontName = "Verdana, sans-serif";
      else if (dateFont === "comic") fontName = "'Comic Sans MS', cursive";
      else fontName = "sans-serif";

      ctx.font = `bold ${dateSize}px ${fontName}`;
      
      const isCenter = dateLocation.includes("center");
      const isLeft = dateLocation.includes("left");
      ctx.textAlign = isCenter ? "center" : isLeft ? "left" : "right";
      
      const isUpper = dateLocation.includes("upper");
      ctx.textBaseline = isUpper ? "top" : "bottom";

      const marginX = 40;
      const marginY = 40;
      const x = isLeft ? marginX : isCenter ? canvasWidth / 2 : canvasWidth - marginX;
      
      // Determine layout lines
      const lines: string[] = [];
      if (hasDate && hasName) {
        if (namePosition === "above") {
          lines.push(nameText.trim());
          lines.push(dateText);
        } else {
          lines.push(dateText);
          lines.push(nameText.trim());
        }
      } else if (hasName) {
        lines.push(nameText.trim());
      } else if (hasDate) {
        lines.push(dateText);
      }

      // Draw lines stacked
      const lineSpacing = dateSize * 1.25;
      
      lines.forEach((lineText, idx) => {
        let y = 0;
        if (isUpper) {
          y = marginY + idx * lineSpacing;
        } else {
          const offsetMultiplier = lines.length - 1 - idx;
          y = canvasHeight - marginY - offsetMultiplier * lineSpacing;
        }

        // Draw high-contrast text outline so text is legible on any subject
        ctx.strokeStyle = dateColor === "#000000" ? "#ffffff" : "#000000";
        ctx.lineWidth = Math.max(2, dateSize / 10);
        ctx.strokeText(lineText, x, y);
        ctx.fillText(lineText, x, y);
      });

      ctx.restore();
    }

    // Export edited image to parent
    const timer = setTimeout(() => {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      onChange(dataUrl);
    }, 50); // slight debounce to keep dragging ultra-smooth

    return () => clearTimeout(timer);
  }, [activeImage, bgChoice, zoom, rotation, brightness, contrast, offsetX, offsetY, onChange, showDate, dateText, dateColor, dateSize, dateLocation, dateFont, nameText, namePosition]);

  // Trigger background removal asynchronously
  const handleBgChoiceChange = async (choice: BgChoiceType) => {
    if (choice === "original") {
      setBgChoice("original");
      return;
    }

    if (processedImageSrc) {
      setBgChoice(choice);
      return;
    }

    setIsProcessingBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(imageSrc);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setProcessedImageSrc(dataUrl);
      setBgChoice(choice);
    } catch (error) {
      console.error("Background removal failed:", error);
      alert("Failed to remove background. Please try another photo.");
      setBgChoice("original");
    } finally {
      setIsProcessingBg(false);
    }
  };

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!imageRef.current) return;
    setIsDragging(true);
    startDragRef.current = { x: e.clientX, y: e.clientY };
    startOffsetRef.current = { x: offsetX, y: offsetY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !imageRef.current) return;
    
    // Scale movement based on display-to-canvas ratio
    // The visual container width is 315px, but canvas coordinate is 700px. Scale factor = 700 / 315 = 2.222
    const scaleFactor = canvasWidth / 315;
    const dx = (e.clientX - startDragRef.current.x) * scaleFactor;
    const dy = (e.clientY - startDragRef.current.y) * scaleFactor;

    setOffsetX(startOffsetRef.current.x + dx);
    setOffsetY(startOffsetRef.current.y + dy);
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Touch Drag Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!imageRef.current || e.touches.length === 0) return;
    setIsDragging(true);
    startDragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    startOffsetRef.current = { x: offsetX, y: offsetY };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || !imageRef.current || e.touches.length === 0) return;
    
    const scaleFactor = canvasWidth / 315;
    const dx = (e.touches[0].clientX - startDragRef.current.x) * scaleFactor;
    const dy = (e.touches[0].clientY - startDragRef.current.y) * scaleFactor;

    setOffsetX(startOffsetRef.current.x + dx);
    setOffsetY(startOffsetRef.current.y + dy);
  };

  // Reset all settings
  const handleReset = () => {
    if (!imageRef.current) return;
    const wRatio = canvasWidth / imageRef.current.width;
    const hRatio = canvasHeight / imageRef.current.height;
    const fitZoom = Math.max(wRatio, hRatio);

    setZoom(Math.round(fitZoom * 1.1 * 10) / 10);
    setOffsetX(0);
    setOffsetY(0);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
  };

  // Quick rotation by 90deg
  const rotate90 = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.canvasWrapper}>
        <div
          className={styles.canvasContainer}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUpOrLeave}
        >
          {/* Output Canvas */}
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className={styles.editorCanvas}
          />

          {/* SVG Face Guide Overlay */}
          <div className={`${styles.guidelineOverlay} ${!showGuides ? styles.hidden : ""}`}>
            <svg viewBox="0 0 350 450" className={styles.guideSvg}>
              {/* Vertical center line */}
              <line x1="175" y1="0" x2="175" y2="450" className={styles.guideLine} />
              
              {/* Horizontal eye-level guideline */}
              <line x1="0" y1="180" x2="350" y2="180" className={styles.eyeLine} />
              
              {/* Face Guide Silhouette */}
              {/* Head Oval */}
              <ellipse cx="175" cy="200" rx="75" ry="105" className={styles.faceOval} />
              
              {/* Inner details for eye guides */}
              <circle cx="145" cy="180" r="4" fill="none" stroke="var(--color-success)" strokeWidth="1" />
              <circle cx="205" cy="180" r="4" fill="none" stroke="var(--color-success)" strokeWidth="1" />
              
              {/* Chin guide line */}
              <line x1="120" y1="305" x2="230" y2="305" className={styles.guideLine} />
              
              {/* Bottom label overlay */}
              <text x="175" y="420" fill="white" textAnchor="middle" fontSize="12" fontWeight="500" letterSpacing="1" opacity="0.6">
                ALIGN FACE WITHIN OVAL
              </text>
            </svg>
          </div>

          {/* Background removal loading overlay */}
          {isProcessingBg && (
            <div className={styles.loadingOverlay}>
              <Loader2 className={styles.loadingSpinner} size={48} />
              <div className={styles.loadingText}>Removing background...</div>
              <div className={styles.loadingSubtext}>
                Running local model on your device. First run downloads the AI package (~30MB) and may take a few seconds.
              </div>
            </div>
          )}
        </div>
      </div>

      <p className={styles.helperText}>
        Drag photo to center, or use sliders below to adjust composition.
      </p>

      {/* Control Sliders & Actions */}
      <div className={styles.controlsGrid}>
        {/* Zoom Control */}
        <div className={styles.controlGroup}>
          <div className={styles.controlHeader}>
            <span className={styles.label}>
              <ZoomIn size={16} /> Zoom
            </span>
            <span className={styles.value}>{Math.round(zoom * 100)}%</span>
          </div>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min="0.2"
              max="5.0"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
          </div>
        </div>

        {/* Rotation Control */}
        <div className={styles.controlGroup}>
          <div className={styles.controlHeader}>
            <span className={styles.label}>
              <RotateCw size={16} /> Rotate
            </span>
            <span className={styles.value}>{rotation}°</span>
          </div>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value))}
            />
          </div>
        </div>

        {/* Brightness Control */}
        <div className={styles.controlGroup}>
          <div className={styles.controlHeader}>
            <span className={styles.label}>
              <Sun size={16} /> Brightness
            </span>
            <span className={styles.value}>{brightness}%</span>
          </div>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min="50"
              max="150"
              step="1"
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value))}
            />
          </div>
        </div>

        {/* Contrast Control */}
        <div className={styles.controlGroup}>
          <div className={styles.controlHeader}>
            <span className={styles.label}>
              <Contrast size={16} /> Contrast
            </span>
            <span className={styles.value}>{contrast}%</span>
          </div>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min="50"
              max="150"
              step="1"
              value={contrast}
              onChange={(e) => setContrast(parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Professional Background Selector */}
      <div className={styles.bgOptionsGroup}>
        <h3 className={styles.bgOptionsTitle}>
          Professional Background Options
          <span className={styles.infoTooltipWrapper}>
            <Info size={14} className={styles.infoIcon} />
            <span className={styles.tooltipText}>
              Note: Background removal runs entirely on your device and might not be perfect. Results vary based on lighting and subject contrast.
            </span>
          </span>
        </h3>
        <div className={styles.bgButtonsRow}>
          {(["original", "white", "black", "blue"] as BgChoiceType[]).map((choice) => (
            <button
              key={choice}
              type="button"
              className={`${styles.bgBtn} ${bgChoice === choice ? styles.bgBtnActive : ""}`}
              onClick={() => handleBgChoiceChange(choice)}
              disabled={isProcessingBg}
            >
              <div
                className={styles.colorPreview}
                style={{
                  background:
                    choice === "original"
                      ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                      : choice === "white"
                      ? "#ffffff"
                      : choice === "black"
                      ? "#000000"
                      : "#cfdae6",
                  backgroundSize: choice === "original" ? "8px 8px" : "auto",
                  backgroundColor: choice === "original" ? "#eee" : "auto",
                }}
              />
              {choice === "original"
                ? "Original"
                : choice.charAt(0).toUpperCase() + choice.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Date & Name Overlay Controls */}
      <div className={styles.dateOptionsGroup}>
        <h3 className={styles.dateOptionsTitle}>
          Text Overlay Options (Name & Date)
        </h3>
        
        {/* Optional Name Overlay Inputs */}
        <div className={styles.inputsGrid} style={{ marginBottom: "1rem" }}>
          <div className={styles.formField}>
            <label htmlFor="name-text-input">Display Name (optional)</label>
            <input
              id="name-text-input"
              type="text"
              placeholder="e.g. John Doe"
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
            />
          </div>

          <div className={styles.formField}>
            <label htmlFor="name-pos-select">Name Alignment</label>
            <select
              id="name-pos-select"
              value={namePosition}
              disabled={!nameText.trim()}
              onChange={(e) => setNamePosition(e.target.value)}
            >
              <option value="above">Name Above Date</option>
              <option value="below">Name Below Date</option>
            </select>
          </div>
        </div>
        
        <label className={styles.dateToggleRow} style={{ marginBottom: showDate ? "0.5rem" : "0" }}>
          <input
            type="checkbox"
            checked={showDate}
            onChange={(e) => setShowDate(e.target.checked)}
          />
          Enable Date Overlay
        </label>

        {(showDate || nameText.trim() !== "") && (
          <div className={styles.dateControls} style={{ borderTop: showDate ? "1px solid rgba(255, 255, 255, 0.05)" : "none", paddingTop: showDate ? "1rem" : "0" }}>
            {showDate && (
              <div className={styles.inputsGrid} style={{ marginBottom: "1rem" }}>
                <div className={styles.formField}>
                  <label htmlFor="date-picker-input">Select Date</label>
                  <input
                    id="date-picker-input"
                    type="date"
                    value={dateText.match(/^\d{4}-\d{2}-\d{2}$/) ? dateText : ""}
                    onChange={(e) => {
                      if (e.target.value) setDateText(e.target.value);
                    }}
                  />
                </div>

                <div className={styles.formField}>
                  <label htmlFor="date-text-input">Display Date / Text</label>
                  <input
                    id="date-text-input"
                    type="text"
                    placeholder="e.g. 2026-07-06"
                    value={dateText}
                    onChange={(e) => setDateText(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className={styles.inputsGrid} style={{ marginBottom: "1rem" }}>
              {/* Font Style Selection */}
              <div className={styles.formField}>
                <label htmlFor="date-font-select">Font Style</label>
                <select
                  id="date-font-select"
                  value={dateFont}
                  onChange={(e) => setDateFont(e.target.value)}
                >
                  <option value="sans">Modern Sans</option>
                  <option value="arial">Arial / Helvetica</option>
                  <option value="times">Times New Roman</option>
                  <option value="serif">Georgia Serif</option>
                  <option value="mono">Monospace Code</option>
                  <option value="verdana">Verdana Sans</option>
                  <option value="impact">Bold Impact</option>
                  <option value="comic">Comic Sans MS</option>
                </select>
              </div>

              {/* Font Size Slider */}
              <div className={styles.formField}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                  <label htmlFor="date-size-slider">Font Size</label>
                  <span style={{ color: "var(--color-accent-light)", fontWeight: "bold" }}>{dateSize}px</span>
                </div>
                <input
                  id="date-size-slider"
                  type="range"
                  min="16"
                  max="64"
                  step="1"
                  value={dateSize}
                  onChange={(e) => setDateSize(parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.inputsGrid}>
              {/* Text Color Option */}
              <div className={styles.formField}>
                <label>Text Color</label>
                <div className={styles.customPickerRow}>
                  {["#ffffff", "#000000", "#f59e0b"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDateColor(color)}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: color,
                        border: dateColor === color ? "2px solid var(--color-accent)" : "1px solid rgba(255, 255, 255, 0.2)",
                        cursor: "pointer",
                        boxShadow: dateColor === color ? "0 0 8px var(--color-accent-glow)" : "none",
                      }}
                      title={color === "#ffffff" ? "White" : color === "#000000" ? "Black" : "Yellow"}
                    />
                  ))}
                  <input
                    type="color"
                    value={dateColor.startsWith("#") ? dateColor : "#ffffff"}
                    onChange={(e) => setDateColor(e.target.value)}
                    className={styles.colorPickerBtn}
                    title="Custom Color"
                  />
                </div>
              </div>

              {/* Position Picker Grid */}
              <div className={styles.formField}>
                <label>Location Position</label>
                <div className={styles.positionSelectGrid}>
                  {[
                    { id: "upper-left", label: "Top L" },
                    { id: "upper-center", label: "Top C" },
                    { id: "upper-right", label: "Top R" },
                    { id: "lower-left", label: "Bot L" },
                    { id: "lower-center", label: "Bot C" },
                    { id: "lower-right", label: "Bot R" },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      className={`${styles.positionBtn} ${dateLocation === pos.id ? styles.positionBtnActive : ""}`}
                      onClick={() => setDateLocation(pos.id)}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Button Row */}
      <div className={styles.buttonRow}>
        <button
          type="button"
          onClick={() => setShowGuides(!showGuides)}
          className={`${styles.btn} ${styles.btnSecondary}`}
        >
          {showGuides ? (
            <>
              <EyeOff size={16} /> Hide Guides
            </>
          ) : (
            <>
              <Eye size={16} /> Show Guides
            </>
          )}
        </button>

        <button
          type="button"
          onClick={rotate90}
          className={`${styles.btn} ${styles.btnSecondary}`}
        >
          <RotateCw size={16} /> Rotate 90°
        </button>

        <button
          type="button"
          onClick={handleReset}
          className={`${styles.btn} ${styles.btnSecondary}`}
          style={{ marginLeft: "auto" }}
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>
    </div>
  );
}
