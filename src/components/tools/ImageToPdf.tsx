"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  FileImage, 
  Upload, 
  Trash2, 
  Download, 
  Loader2, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUp, 
  ArrowDown, 
  Grid, 
  Move, 
  HelpCircle, 
  RotateCw, 
  Info,
  Layers,
  Minimize2,
  Maximize2
} from "lucide-react";
import { jsPDF } from "jspdf";
import { track } from "@vercel/analytics";
import styles from "./ImageToPdf.module.css";

interface ImageItem {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  // Freeform canvas placement parameters (in mm)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  page: number; // 1-indexed page
  aspectRatio: number; // width / height
}

interface PresetItem {
  id: string;
  name: string;
  cols: number;
  rows: number;
  desc: string;
}

export default function ImageToPdf() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [activeMode, setActiveMode] = useState<"grid" | "freeform">("grid");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Grid layout configurations
  const gridPresets: PresetItem[] = [
    { id: "grid-1", name: "1 Image (Full Page)", cols: 1, rows: 1, desc: "One large image per page" },
    { id: "grid-2", name: "2 Images (Rows)", cols: 1, rows: 2, desc: "Two split rows per page" },
    { id: "grid-4", name: "4 Images (2x2 Grid)", cols: 2, rows: 2, desc: "Four quadrant layout per page" },
    { id: "grid-6", name: "6 Images (2x3 Grid)", cols: 2, rows: 3, desc: "Six grid layout per page" },
    { id: "grid-9", name: "9 Images (3x3 Grid)", cols: 3, rows: 3, desc: "Nine thumbnail grid per page" }
  ];
  
  const [activePreset, setActivePreset] = useState<PresetItem>(gridPresets[0]);
  const [gridMargin, setGridMargin] = useState<number>(10); // in mm
  const [gridGap, setGridGap] = useState<number>(5); // in mm
  const [gridFitting, setGridFitting] = useState<"fit" | "fill">("fit");
  const [gridActivePage, setGridActivePage] = useState<number>(1);

  // Freeform layout configurations
  const [freeformTotalPages, setFreeformTotalPages] = useState<number>(1);
  const [freeformActivePage, setFreeformActivePage] = useState<number>(1);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Pointer event tracking for canvas dragging/resizing
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [isResizingElement, setIsResizingElement] = useState(false);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, elemX: 0, elemY: 0, elemW: 0, elemH: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Constants
  const A4_PORTRAIT_W = 210; // mm
  const A4_PORTRAIT_H = 297; // mm
  const PAGE_W = orientation === "portrait" ? A4_PORTRAIT_W : A4_PORTRAIT_H;
  const PAGE_H = orientation === "portrait" ? A4_PORTRAIT_H : A4_PORTRAIT_W;

  const mmToPxScale = 2.0; // Scale factor for preview canvas (adjusts display quality/size in browser)

  // Derived Grid pagination parameters
  const imagesPerPage = activePreset.cols * activePreset.rows;
  const totalGridPages = Math.ceil(images.length / imagesPerPage) || 1;

  // Auto-fit grid active page when queue size changes
  useEffect(() => {
    if (gridActivePage > totalGridPages) {
      setGridActivePage(totalGridPages);
    }
  }, [images.length, totalGridPages, gridActivePage]);

  // Handle file selections
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Upload zones drag/drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Process files with validations
  const processFiles = (fileList: File[]) => {
    setError(null);
    const validImages = fileList.filter(file => 
      file.type.startsWith("image/") && 
      (file.name.toLowerCase().endsWith(".png") || 
       file.name.toLowerCase().endsWith(".jpg") || 
       file.name.toLowerCase().endsWith(".jpeg") || 
       file.name.toLowerCase().endsWith(".webp"))
    );

    if (validImages.length === 0) {
      setError("Please upload valid image files (PNG, JPG/JPEG, WebP).");
      return;
    }

    if (images.length + validImages.length > 15) {
      setError("You can compile a maximum of 15 photos in a PDF.");
      return;
    }

    let loadedCount = 0;
    const itemsToAdd: ImageItem[] = [];

    validImages.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        
        // Load image to extract natural aspect ratio
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          
          // Freeform sizing defaults (e.g. fit within 80mm width)
          const defaultWidth = PAGE_W * 0.4;
          const defaultHeight = defaultWidth / aspectRatio;

          itemsToAdd.push({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            size: file.size,
            dataUrl,
            // Freeform positioning parameters (centered on current page by default)
            x: (PAGE_W - defaultWidth) / 2,
            y: (PAGE_H - defaultHeight) / 2,
            width: defaultWidth,
            height: defaultHeight,
            rotation: 0,
            page: freeformActivePage,
            aspectRatio
          });

          loadedCount++;
          if (loadedCount === validImages.length) {
            setImages(prev => [...prev, ...itemsToAdd]);
            track("Image uploaded for PDF compiler", { count: validImages.length });
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  // Queue item deletions
  const deleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  // Move items in queue list (Grid Mode)
  const moveImage = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === images.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...images];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setImages(updated);
  };

  // Selected element options helper
  const getSelectedElement = () => {
    return images.find(img => img.id === selectedElementId) || null;
  };

  // Update properties of a freeform element
  const updateElementProperty = (id: string, properties: Partial<ImageItem>) => {
    setImages(prev => prev.map(img => {
      if (img.id === id) {
        return { ...img, ...properties };
      }
      return img;
    }));
  };

  // Z-Indexing positioning shifts
  const adjustZIndex = (id: string, action: "front" | "back") => {
    const element = images.find(img => img.id === id);
    if (!element) return;

    const filtered = images.filter(img => img.id !== id);
    if (action === "front") {
      setImages([...filtered, element]); // Add to end of array to draw on top
    } else {
      setImages([element, ...filtered]); // Add to beginning of array to draw below
    }
  };

  // Visual centering tools
  const alignElement = (id: string, type: "h-center" | "v-center" | "fit-w" | "fit-h") => {
    const elem = images.find(img => img.id === id);
    if (!elem) return;

    if (type === "h-center") {
      updateElementProperty(id, { x: (PAGE_W - elem.width) / 2 });
    } else if (type === "v-center") {
      updateElementProperty(id, { y: (PAGE_H - elem.height) / 2 });
    } else if (type === "fit-w") {
      const newW = PAGE_W * 0.9; // 90% of page width
      const newH = newW / elem.aspectRatio;
      updateElementProperty(id, { 
        width: newW, 
        height: newH, 
        x: (PAGE_W - newW) / 2 
      });
    } else if (type === "fit-h") {
      const newH = PAGE_H * 0.9; // 90% of page height
      const newW = newH * elem.aspectRatio;
      updateElementProperty(id, { 
        width: newW, 
        height: newH, 
        y: (PAGE_H - newH) / 2 
      });
    }
  };

  // Drag interaction handlers
  const handleElementPointerDown = (e: React.PointerEvent, id: string) => {
    if (isResizingElement) return;
    
    e.preventDefault();
    setSelectedElementId(id);
    setIsDraggingElement(true);
    
    const elem = images.find(img => img.id === id);
    if (!elem) return;

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      elemX: elem.x,
      elemY: elem.y,
      elemW: elem.width,
      elemH: elem.height
    };
    
    const element = e.currentTarget as HTMLElement;
    element.setPointerCapture(e.pointerId);
  };

  const handleElementPointerMove = (e: React.PointerEvent, id: string) => {
    if (!isDraggingElement) return;
    e.preventDefault();

    const elem = images.find(img => img.id === id);
    if (!elem) return;

    // Convert pixel dragging changes to mm
    const container = canvasAreaRef.current;
    if (!container) return;

    const displayScale = container.offsetWidth / PAGE_W;
    const deltaX_mm = (e.clientX - dragStartRef.current.pointerX) / displayScale;
    const deltaY_mm = (e.clientY - dragStartRef.current.pointerY) / displayScale;

    let newX = dragStartRef.current.elemX + deltaX_mm;
    let newY = dragStartRef.current.elemY + deltaY_mm;

    // Bounds clipping rules
    newX = Math.max(0, Math.min(PAGE_W - elem.width, newX));
    newY = Math.max(0, Math.min(PAGE_H - elem.height, newY));

    updateElementProperty(id, { x: newX, y: newY });
  };

  const handleElementPointerUp = (e: React.PointerEvent, id: string) => {
    setIsDraggingElement(false);
    try {
      const element = e.currentTarget as HTMLElement;
      element.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Corner resize pointer handlers
  const handleResizePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizingElement(true);

    const elem = images.find(img => img.id === id);
    if (!elem) return;

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      elemX: elem.x,
      elemY: elem.y,
      elemW: elem.width,
      elemH: elem.height
    };

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent, id: string) => {
    if (!isResizingElement) return;
    e.stopPropagation();
    e.preventDefault();

    const elem = images.find(img => img.id === id);
    if (!elem) return;

    const container = canvasAreaRef.current;
    if (!container) return;

    const displayScale = container.offsetWidth / PAGE_W;
    const deltaX_mm = (e.clientX - dragStartRef.current.pointerX) / displayScale;

    // Scale proportionally using the original aspect ratio
    let newWidth = dragStartRef.current.elemW + deltaX_mm;
    newWidth = Math.max(15, Math.min(PAGE_W - elem.x, newWidth)); // min 15mm width
    
    let newHeight = newWidth / elem.aspectRatio;
    
    // Constraint check vertical boundaries
    if (elem.y + newHeight > PAGE_H) {
      newHeight = PAGE_H - elem.y;
      newWidth = newHeight * elem.aspectRatio;
    }

    updateElementProperty(id, { width: newWidth, height: newHeight });
  };

  const handleResizePointerUp = (e: React.PointerEvent, id: string) => {
    setIsResizingElement(false);
    try {
      const target = e.currentTarget as HTMLElement;
      target.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Add a freeform page
  const addFreeformPage = () => {
    setFreeformTotalPages(prev => prev + 1);
    setFreeformActivePage(freeformTotalPages + 1);
  };

  // Delete a freeform page
  const deleteFreeformPage = () => {
    if (freeformTotalPages <= 1) return;

    // Remove elements on deleted page
    const filteredImages = images.filter(img => img.page !== freeformActivePage);
    
    // Shift page indexes down for subsequent pages
    const updatedImages = filteredImages.map(img => {
      if (img.page > freeformActivePage) {
        return { ...img, page: img.page - 1 };
      }
      return img;
    });

    setImages(updatedImages);
    setSelectedElementId(null);
    setFreeformTotalPages(prev => prev - 1);
    setFreeformActivePage(prev => Math.max(1, prev - 1));
  };

  // PDF Generator Compilation
  const compilePdf = async () => {
    if (images.length === 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const pdf = new jsPDF({
        orientation: orientation,
        unit: "mm",
        format: "a4"
      });

      // Load all raw images into HTMLImageElements first
      const imageLoaders = images.map(item => {
        return new Promise<{ id: string; img: HTMLImageElement }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ id: item.id, img });
          img.onerror = () => reject(new Error(`Failed to load image: ${item.name}`));
          img.src = item.dataUrl;
        });
      });

      const loadedImages = await Promise.all(imageLoaders);
      const imgMap = new Map<string, HTMLImageElement>();
      loadedImages.forEach(x => imgMap.set(x.id, x.img));

      if (activeMode === "grid") {
        // Grid compilation logic
        for (let pIndex = 0; pIndex < totalGridPages; pIndex++) {
          if (pIndex > 0) {
            pdf.addPage();
          }

          const innerWidth = PAGE_W - 2 * gridMargin;
          const innerHeight = PAGE_H - 2 * gridMargin;
          const cellWidth = (innerWidth - (activePreset.cols - 1) * gridGap) / activePreset.cols;
          const cellHeight = (innerHeight - (activePreset.rows - 1) * gridGap) / activePreset.rows;

          for (let cell = 0; cell < imagesPerPage; cell++) {
            const imgIdx = pIndex * imagesPerPage + cell;
            if (imgIdx >= images.length) break;

            const item = images[imgIdx];
            const img = imgMap.get(item.id);
            if (!img) continue;

            const col = cell % activePreset.cols;
            const row = Math.floor(cell / activePreset.cols);
            
            const cellX = gridMargin + col * (cellWidth + gridGap);
            const cellY = gridMargin + row * (cellHeight + gridGap);

            const cellRatio = cellWidth / cellHeight;
            const imgRatio = item.aspectRatio;

            if (gridFitting === "fit") {
              let w = cellWidth;
              let h = cellWidth / imgRatio;
              let x = cellX;
              let y = cellY + (cellHeight - h) / 2;

              if (imgRatio < cellRatio) {
                h = cellHeight;
                w = cellHeight * imgRatio;
                x = cellX + (cellWidth - w) / 2;
                y = cellY;
              }

              pdf.addImage(item.dataUrl, "JPEG", x, y, w, h);
            } else {
              // Fill layout crop via Canvas
              const cropCanvas = document.createElement("canvas");
              const targetFactor = 4; // High DPI output quality
              cropCanvas.width = cellWidth * targetFactor;
              cropCanvas.height = cellHeight * targetFactor;
              const ctx = cropCanvas.getContext("2d");

              if (ctx) {
                // Background fill
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

                let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
                const canvasRatio = cropCanvas.width / cropCanvas.height;

                if (imgRatio > canvasRatio) {
                  srcW = img.height * canvasRatio;
                  srcX = (img.width - srcW) / 2;
                } else {
                  srcH = img.width / canvasRatio;
                  srcY = (img.height - srcH) / 2;
                }

                ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, cropCanvas.width, cropCanvas.height);
                const finalJpg = cropCanvas.toDataURL("image/jpeg", 0.95);
                pdf.addImage(finalJpg, "JPEG", cellX, cellY, cellWidth, cellHeight);
              }
            }
          }
        }
      } else {
        // Freeform canvas drawing page-by-page
        const dpiScale = 11.811; // Print scale factor (2480px / 210mm = 11.811 px/mm)
        const printW = PAGE_W * dpiScale;
        const printH = PAGE_H * dpiScale;

        for (let pIndex = 1; pIndex <= freeformTotalPages; pIndex++) {
          if (pIndex > 1) {
            pdf.addPage();
          }

          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = printW;
          pageCanvas.height = printH;
          const ctx = pageCanvas.getContext("2d");

          if (ctx) {
            // White canvas base background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, printW, printH);

            const pageElements = images.filter(img => img.page === pIndex);
            pageElements.forEach(item => {
              const img = imgMap.get(item.id);
              if (!img) return;

              const x_px = item.x * dpiScale;
              const y_px = item.y * dpiScale;
              const w_px = item.width * dpiScale;
              const h_px = item.height * dpiScale;

              ctx.save();
              // Translate context to elements center for clean rotation
              ctx.translate(x_px + w_px / 2, y_px + h_px / 2);
              ctx.rotate((item.rotation * Math.PI) / 180);
              ctx.drawImage(img, -w_px / 2, -h_px / 2, w_px, h_px);
              ctx.restore();
            });

            const pageDataUrl = pageCanvas.toDataURL("image/jpeg", 0.96);
            pdf.addImage(pageDataUrl, "JPEG", 0, 0, PAGE_W, PAGE_H);
          }
        }
      }

      pdf.save("compiled_images.pdf");
      track("PDF compiled successfully", { mode: activeMode, count: images.length });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to compile photos to PDF. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setImages([]);
    setSelectedElementId(null);
    setFreeformActivePage(1);
    setFreeformTotalPages(1);
    setGridActivePage(1);
    setError(null);
  };

  // Convert bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const selectedElement = getSelectedElement();

  return (
    <div className={styles.container}>
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept=".png,.jpg,.jpeg,.webp" 
        multiple 
        style={{ display: "none" }} 
      />

      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: "700", margin: 0 }}>Image to PDF Compiler</h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem", margin: "0.25rem 0 0 0" }}>
            Compile photos into print-ready A4 PDFs locally inside your browser.
          </p>
        </div>
        
        {/* Processing badge */}
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
          <span>Processed 100% locally</span>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <Info size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Workspace Area */}
      <div className={styles.workspaceGrid}>
        
        {/* Left Options panel */}
        <aside className={`${styles.panel} glass-panel`}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Layout Configurations</span>
          </div>
          
          <div className={styles.panelBody}>
            {/* Mode selection buttons */}
            <div className={styles.modeSelector}>
              <button 
                type="button" 
                className={`${styles.modeBtn} ${activeMode === "grid" ? styles.modeBtnActive : ""}`}
                onClick={() => { setActiveMode("grid"); setSelectedElementId(null); }}
              >
                <Grid size={14} />
                <span>Grid Mode</span>
              </button>
              <button 
                type="button" 
                className={`${styles.modeBtn} ${activeMode === "freeform" ? styles.modeBtnActive : ""}`}
                onClick={() => setActiveMode("freeform")}
              >
                <Move size={14} />
                <span>Freeform Mode</span>
              </button>
            </div>

            {/* Page Orientation */}
            <div className={styles.optionGroup}>
              <span className={styles.optionLabel}>Page Orientation</span>
              <div className={styles.btnGrid}>
                <button 
                  type="button" 
                  className={`${styles.secondaryBtn} ${orientation === "portrait" ? styles.secondaryBtnActive : ""}`}
                  onClick={() => setOrientation("portrait")}
                >
                  Portrait (A4)
                </button>
                <button 
                  type="button" 
                  className={`${styles.secondaryBtn} ${orientation === "landscape" ? styles.secondaryBtnActive : ""}`}
                  onClick={() => setOrientation("landscape")}
                >
                  Landscape (A4)
                </button>
              </div>
            </div>

            {/* Mode Specific Controls */}
            {activeMode === "grid" ? (
              <>
                {/* Presets */}
                <div className={styles.optionGroup}>
                  <span className={styles.optionLabel}>Grid layout preset</span>
                  <select 
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      color: "#fff",
                      padding: "0.5rem",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.8rem",
                      outline: "none"
                    }}
                    value={activePreset.id}
                    onChange={(e) => {
                      const found = gridPresets.find(p => p.id === e.target.value);
                      if (found) setActivePreset(found);
                    }}
                  >
                    {gridPresets.map(preset => (
                      <option key={preset.id} value={preset.id} style={{ background: "#0a0e17" }}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Margin */}
                <div className={styles.optionGroup}>
                  <div className={styles.optionLabel}>
                    <span>Page Margin</span>
                    <span className={styles.optionValue}>{gridMargin} mm</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="30" 
                    className={styles.sliderInput} 
                    value={gridMargin} 
                    onChange={e => setGridMargin(parseInt(e.target.value))} 
                  />
                </div>

                {/* Gap */}
                <div className={styles.optionGroup}>
                  <div className={styles.optionLabel}>
                    <span>Cell Spacing (Gap)</span>
                    <span className={styles.optionValue}>{gridGap} mm</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="20" 
                    className={styles.sliderInput} 
                    value={gridGap} 
                    onChange={e => setGridGap(parseInt(e.target.value))} 
                  />
                </div>

                {/* Fitting */}
                <div className={styles.optionGroup}>
                  <span className={styles.optionLabel}>Image Fit mode</span>
                  <div className={styles.btnGrid}>
                    <button 
                      type="button" 
                      className={`${styles.secondaryBtn} ${gridFitting === "fit" ? styles.secondaryBtnActive : ""}`}
                      onClick={() => setGridFitting("fit")}
                    >
                      Fit (Keep Aspect)
                    </button>
                    <button 
                      type="button" 
                      className={`${styles.secondaryBtn} ${gridFitting === "fill" ? styles.secondaryBtnActive : ""}`}
                      onClick={() => setGridFitting("fill")}
                    >
                      Fill (Crop to Fit)
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Freeform selected item settings */}
                <div className={styles.optionGroup}>
                  <span className={styles.optionLabel}>Draggable Elements Settings</span>
                  {selectedElement ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "#fff", fontWeight: "600", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        Selected: {selectedElement.name}
                      </span>
                      
                      {/* Width & Height */}
                      <div className={styles.optionGroup}>
                        <div className={styles.optionLabel}>
                          <span>Element Width</span>
                          <span className={styles.optionValue}>{Math.round(selectedElement.width)} mm</span>
                        </div>
                        <input 
                          type="range" 
                          min="15" 
                          max={PAGE_W} 
                          className={styles.sliderInput}
                          value={selectedElement.width} 
                          onChange={e => {
                            const newW = parseInt(e.target.value);
                            const newH = newW / selectedElement.aspectRatio;
                            updateElementProperty(selectedElement.id, { width: newW, height: newH });
                          }} 
                        />
                      </div>

                      {/* Rotation Slider */}
                      <div className={styles.optionGroup}>
                        <div className={styles.optionLabel}>
                          <span>Rotation</span>
                          <span className={styles.optionValue}>{selectedElement.rotation}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="360" 
                          step="90"
                          className={styles.sliderInput}
                          value={selectedElement.rotation} 
                          onChange={e => updateElementProperty(selectedElement.id, { rotation: parseInt(e.target.value) })} 
                        />
                      </div>

                      {/* Centering actions */}
                      <div className={styles.optionGroup}>
                        <span className={styles.optionLabel}>Alignments</span>
                        <div className={styles.btnGrid}>
                          <button 
                            type="button" 
                            className={styles.secondaryBtn}
                            onClick={() => alignElement(selectedElement.id, "h-center")}
                          >
                            Center H
                          </button>
                          <button 
                            type="button" 
                            className={styles.secondaryBtn}
                            onClick={() => alignElement(selectedElement.id, "v-center")}
                          >
                            Center V
                          </button>
                          <button 
                            type="button" 
                            className={styles.secondaryBtn}
                            onClick={() => alignElement(selectedElement.id, "fit-w")}
                            style={{ fontSize: "0.75rem" }}
                          >
                            Fit Width
                          </button>
                          <button 
                            type="button" 
                            className={styles.secondaryBtn}
                            onClick={() => alignElement(selectedElement.id, "fit-h")}
                            style={{ fontSize: "0.75rem" }}
                          >
                            Fit Height
                          </button>
                        </div>
                      </div>

                      {/* Layers order depth */}
                      <div className={styles.optionGroup}>
                        <span className={styles.optionLabel}>Layering Order</span>
                        <div className={styles.btnGrid}>
                          <button 
                            type="button" 
                            className={styles.secondaryBtn}
                            onClick={() => adjustZIndex(selectedElement.id, "front")}
                          >
                            Bring to Front
                          </button>
                          <button 
                            type="button" 
                            className={styles.secondaryBtn}
                            onClick={() => adjustZIndex(selectedElement.id, "back")}
                          >
                            Send to Back
                          </button>
                        </div>
                      </div>

                      {/* Move to another page */}
                      <div className={styles.optionGroup}>
                        <span className={styles.optionLabel}>Assign to Page</span>
                        <select 
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            color: "#fff",
                            padding: "0.4rem",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.8rem",
                            outline: "none"
                          }}
                          value={selectedElement.page}
                          onChange={(e) => updateElementProperty(selectedElement.id, { page: parseInt(e.target.value) })}
                        >
                          {Array.from({ length: freeformTotalPages }).map((_, i) => (
                            <option key={i} value={i + 1} style={{ background: "#0a0e17" }}>
                              Page {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button 
                        type="button"
                        className={styles.secondaryBtn}
                        style={{ color: "var(--color-danger)", borderColor: "rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.03)" }}
                        onClick={() => deleteImage(selectedElement.id)}
                      >
                        <Trash2 size={14} />
                        Delete Element
                      </button>
                    </div>
                  ) : (
                    <div className={styles.emptySelection}>
                      Click on an image element on the canvas to configure it.
                    </div>
                  )}
                </div>

                <div className={styles.helpCard}>
                  <span className={styles.helpTitle}>
                    <HelpCircle size={14} />
                    Canvas Guides
                  </span>
                  <p className={styles.helpText}>
                    In Freeform Mode, drag images with your mouse/touch, use the resize handles, or input properties using the sliders above.
                  </p>
                </div>
              </>
            )}

            {/* Actions list */}
            {images.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button 
                  type="button" 
                  onClick={compilePdf} 
                  disabled={isLoading}
                  className={styles.primaryBtn}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Compiling PDF...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Compile & Download PDF
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  onClick={handleReset} 
                  disabled={isLoading}
                  className={styles.secondaryBtn}
                >
                  Clear Queue
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right workspace visual preview canvas */}
        <section className={styles.workspace}>
          {images.length > 0 ? (
            <>
              {/* Pagination bar */}
              <div className={styles.pageHeader}>
                <span className={styles.pageTitle}>
                  {activeMode === "grid" ? "Grid Paginated Preview" : "Freeform Interactive Canvas"}
                </span>

                <div className={styles.paginationControls}>
                  {activeMode === "grid" ? (
                    <>
                      <button 
                        type="button" 
                        className={styles.actionIconBtn} 
                        disabled={gridActivePage <= 1}
                        onClick={() => setGridActivePage(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className={styles.pageIndicator}>
                        Page {gridActivePage} / {totalGridPages}
                      </span>
                      <button 
                        type="button" 
                        className={styles.actionIconBtn} 
                        disabled={gridActivePage >= totalGridPages}
                        onClick={() => setGridActivePage(p => Math.min(totalGridPages, p + 1))}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        type="button" 
                        className={styles.actionIconBtn} 
                        disabled={freeformActivePage <= 1}
                        onClick={() => setFreeformActivePage(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className={styles.pageIndicator}>
                        Page {freeformActivePage} / {freeformTotalPages}
                      </span>
                      <button 
                        type="button" 
                        className={styles.actionIconBtn} 
                        disabled={freeformActivePage >= freeformTotalPages}
                        onClick={() => setFreeformActivePage(p => Math.min(freeformTotalPages, p + 1))}
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button 
                        type="button" 
                        className={styles.secondaryBtn}
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", width: "auto" }}
                        onClick={addFreeformPage}
                      >
                        <Plus size={12} />
                        Add Page
                      </button>
                      <button 
                        type="button" 
                        className={styles.secondaryBtn}
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", width: "auto", color: "var(--color-danger)", borderColor: "rgba(239, 68, 68, 0.15)" }}
                        disabled={freeformTotalPages <= 1}
                        onClick={deleteFreeformPage}
                      >
                        <Trash2 size={12} />
                        Delete Page
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* A4 Page View bounds */}
              <div className={styles.canvasWrapper}>
                <div 
                  ref={canvasAreaRef}
                  className={`${styles.a4Page} ${orientation === "portrait" ? styles.a4Portrait : styles.a4Landscape}`}
                  onClick={() => setSelectedElementId(null)}
                >
                  {activeMode === "grid" ? (
                    // GRID PREVIEW
                    <div 
                      className={styles.gridLayout}
                      style={{
                        padding: `${gridMargin * mmToPxScale}px`,
                        gap: `${gridGap * mmToPxScale}px`,
                        gridTemplateColumns: `repeat(${activePreset.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${activePreset.rows}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: imagesPerPage }).map((_, cellIdx) => {
                        const imgIdx = (gridActivePage - 1) * imagesPerPage + cellIdx;
                        const item = images[imgIdx];
                        if (!item) return <div key={cellIdx} className={styles.gridCell} style={{ border: "1px dashed rgba(0, 0, 0, 0.05)" }} />;

                        return (
                          <div key={cellIdx} className={styles.gridCell}>
                            <img 
                              src={item.dataUrl} 
                              alt={item.name} 
                              className={gridFitting === "fit" ? styles.gridImgFit : styles.gridImgFill} 
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // FREEFORM CANVAS PREVIEW
                    images
                      .filter(img => img.page === freeformActivePage)
                      .map(item => {
                        const isSelected = item.id === selectedElementId;
                        
                        // Convert mm units to visual pixels
                        const container = canvasAreaRef.current;
                        const displayScale = container ? container.offsetWidth / PAGE_W : mmToPxScale;
                        
                        const leftPx = item.x * displayScale;
                        const topPx = item.y * displayScale;
                        const widthPx = item.width * displayScale;
                        const heightPx = item.height * displayScale;

                        return (
                          <div
                            key={item.id}
                            className={styles.freeformElement}
                            style={{
                              left: `${leftPx}px`,
                              top: `${topPx}px`,
                              width: `${widthPx}px`,
                              height: `${heightPx}px`,
                              transform: `rotate(${item.rotation}deg)`,
                              zIndex: isSelected ? 50 : 10
                            }}
                            onPointerDown={(e) => handleElementPointerDown(e, item.id)}
                            onPointerMove={(e) => handleElementPointerMove(e, item.id)}
                            onPointerUp={(e) => handleElementPointerUp(e, item.id)}
                          >
                            <img 
                              src={item.dataUrl} 
                              alt={item.name} 
                              className={styles.freeformImg} 
                            />
                            
                            {/* Selection highlight border & controls overlays */}
                            {isSelected && (
                              <>
                                <div className={styles.elementOutline} />
                                <div 
                                  className={styles.resizeHandle}
                                  onPointerDown={(e) => handleResizePointerDown(e, item.id)}
                                  onPointerMove={(e) => handleResizePointerMove(e, item.id)}
                                  onPointerUp={(e) => handleResizePointerUp(e, item.id)}
                                />
                                <button 
                                  type="button" 
                                  className={styles.elementDeleteBtn}
                                  onClick={(e) => { e.stopPropagation(); deleteImage(item.id); }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Upload queue item list cards */}
              <div className={`${styles.panel} glass-panel`} style={{ width: "100%" }}>
                <div className={styles.panelHeader} style={{ margin: 0, padding: "1rem 1rem 0.5rem 1rem" }}>
                  <span className={styles.panelTitle} style={{ fontSize: "0.85rem" }}>
                    Image Queue ({images.length} / 15)
                  </span>
                  
                  {images.length < 15 && (
                    <button 
                      type="button" 
                      className={styles.secondaryBtn}
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", width: "auto" }}
                      onClick={triggerUploadClick}
                    >
                      <Plus size={12} />
                      Add More
                    </button>
                  )}
                </div>

                <div className={styles.panelBody} style={{ padding: "0.5rem 1rem 1rem 1rem" }}>
                  <div className={styles.queueList}>
                    {images.map((item, idx) => (
                      <div key={item.id} className={styles.queueItem} style={{ border: item.id === selectedElementId ? "1px solid var(--color-accent)" : "1px solid rgba(255, 255, 255, 0.04)" }}>
                        <img src={item.dataUrl} alt={item.name} className={styles.queueThumb} />
                        <div className={styles.queueDetails}>
                          <span className={styles.queueName}>{item.name}</span>
                          <span className={styles.queueSize}>{formatBytes(item.size)}</span>
                        </div>
                        
                        <div className={styles.queueActions}>
                          {activeMode === "grid" && (
                            <>
                              <button 
                                type="button" 
                                className={styles.actionIconBtn} 
                                disabled={idx === 0}
                                onClick={() => moveImage(idx, "up")}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button 
                                type="button" 
                                className={styles.actionIconBtn} 
                                disabled={idx === images.length - 1}
                                onClick={() => moveImage(idx, "down")}
                              >
                                <ArrowDown size={14} />
                              </button>
                            </>
                          )}
                          {activeMode === "freeform" && (
                            <button 
                              type="button" 
                              className={`${styles.actionIconBtn} ${item.id === selectedElementId ? styles.actionIconBtnActive : ""}`}
                              onClick={() => setSelectedElementId(item.id === selectedElementId ? null : item.id)}
                            >
                              <Info size={14} />
                            </button>
                          )}
                          <button 
                            type="button" 
                            className={styles.actionIconBtn} 
                            style={{ color: "var(--color-danger)" }}
                            onClick={() => deleteImage(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            // EMPTY STATE / UPLOAD ZONE
            <div className={`${styles.panel} glass-panel`} style={{ width: "100%", minHeight: "440px", justifyContent: "center" }}>
              <div className={styles.panelBody} style={{ padding: "2rem" }}>
                <div 
                  className={`${styles.uploadZone} ${isDraggingOver ? styles.uploadZoneActive : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerUploadClick}
                >
                  <Upload className={styles.uploadIcon} size={48} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <p className={styles.uploadTitle}>Upload Photos to Compile</p>
                    <p className={styles.uploadSubtitle}>
                      Drag & drop up to 15 images here, or click to browse
                    </p>
                    <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                      Supports PNG, JPG/JPEG, WebP • Max 15 files • Processed entirely locally
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
