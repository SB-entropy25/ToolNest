"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  FileDown, 
  Upload, 
  AlertTriangle, 
  Loader2, 
  Trash2, 
  Sparkles, 
  Check, 
  Download,
  FileText,
  Info
} from "lucide-react";
import { track } from "@vercel/analytics";
import styles from "./PdfCompressor.module.css";

interface PresetItem {
  id: "low" | "recommended" | "high";
  name: string;
  desc: string;
  scale: number;
  quality: number;
}

export default function PdfCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressPage, setProgressPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  // Compression presets
  const presets: PresetItem[] = [
    {
      id: "low",
      name: "Low Compression (Max Text Quality)",
      desc: "Renders at 2.5x high-DPI resolution. Best for official files, vector text, and fine prints.",
      scale: 2.5,
      quality: 0.90,
    },
    {
      id: "recommended",
      name: "Recommended (Balanced Quality & Size)",
      desc: "Renders at 2.0x DPI. Retains sharp text and clear graphics with good size compression.",
      scale: 2.0,
      quality: 0.76,
    },
    {
      id: "high",
      name: "High Compression (Small Size)",
      desc: "Renders at 1.4x DPI. Maximum file size reduction, text remains readable but slightly softer.",
      scale: 1.4,
      quality: 0.60,
    },
  ];

  const [activePreset, setActivePreset] = useState<PresetItem>(presets[1]); // Recommended by default
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Target Size Limit Options
  const [targetSizePreset, setTargetSizePreset] = useState<string>("none"); // "none" | "1mb" | "2mb" | "5mb" | "custom"
  const [customTargetSize, setCustomTargetSize] = useState<number>(100);
  const [customTargetUnit, setCustomTargetUnit] = useState<string>("kb"); // "kb" | "mb"
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Format bytes to human-readable size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Helper: Estimate compressed size based on specific scale and quality
  const estimateCompressedSizeCustom = (origSize: number, pagesCount: number, scaleVal: number, qualityVal: number): number => {
    if (pagesCount <= 0) return 0;
    // Calibrated empirical formula for standard document JPEG page size in bytes
    const expectedSizePerPage = 55000 * (scaleVal * scaleVal) * (qualityVal * qualityVal);
    const estimated = Math.round(pagesCount * expectedSizePerPage);
    return estimated;
  };

  // Helper: Estimate compressed size based on page counts and preset
  const estimateCompressedSize = (origSize: number, pagesCount: number, presetId: string): number => {
    const preset = presetId === "low" ? presets[0] : presetId === "recommended" ? presets[1] : presets[2];
    return estimateCompressedSizeCustom(origSize, pagesCount, preset.scale, preset.quality);
  };

  // Calculate sizes for active presets
  const lowEst = file ? estimateCompressedSize(file.size, totalPages, "low") : 0;
  const recEst = file ? estimateCompressedSize(file.size, totalPages, "recommended") : 0;
  const highEst = file ? estimateCompressedSize(file.size, totalPages, "high") : 0;

  // Convert currently configured target size limit to bytes
  let targetSizeLimit = 0;
  if (targetSizePreset === "1mb") targetSizeLimit = 1 * 1024 * 1024;
  else if (targetSizePreset === "2mb") targetSizeLimit = 2 * 1024 * 1024;
  else if (targetSizePreset === "5mb") targetSizeLimit = 5 * 1024 * 1024;
  else if (targetSizePreset === "custom") {
    const multiplier = customTargetUnit === "mb" ? 1024 * 1024 : 1024;
    targetSizeLimit = customTargetSize * multiplier;
  }

  // Calculate dynamic target parameters
  let targetScale = 2.0;
  let targetQuality = 0.76;
  let hasTargetWarning = false;
  let hasTargetNotice = false;

  if (targetSizeLimit > 0 && file && totalPages > 0) {
    const targetSizePerPage = targetSizeLimit / totalPages;
    
    // We want to maximize resolution scale for text readability while solving for quality.
    // We sweep scale from 2.5 down to 1.2 to find the sharpest settings that fit the target.
    let bestScale = 1.4;
    let bestQuality = 0.60;
    let bestDiff = Infinity;
    
    for (let s = 2.5; s >= 1.2; s -= 0.1) {
      // expectedSizePerPage = 55000 * s * s * q * q
      // => q = Math.sqrt(expectedSizePerPage / (55000 * s * s))
      let q = Math.sqrt(targetSizePerPage / (55000 * s * s));
      
      // Keep quality within reasonable boundaries for document readability
      q = Math.max(0.50, Math.min(0.90, q));
      
      const expected = 55000 * s * s * q * q;
      const diff = Math.abs(expected - targetSizePerPage);
      
      if (diff < bestDiff) {
        bestDiff = diff;
        bestScale = parseFloat(s.toFixed(2));
        bestQuality = parseFloat(q.toFixed(2));
      }
    }
    
    targetScale = bestScale;
    targetQuality = bestQuality;

    // Check if the final output size exceeds the limit even at lowest settings
    const minPossibleSize = 55000 * (1.2 * 1.2) * (0.5 * 0.5) * totalPages;
    if (minPossibleSize > targetSizeLimit) {
      hasTargetWarning = true;
    }
  }

  // Determine actual S and Q settings to use based on targets and self-tuning constraints:
  let compScale = activePreset.scale;
  let compQuality = activePreset.quality;

  if (targetSizeLimit > 0 && file && totalPages > 0) {
    compScale = targetScale;
    compQuality = targetQuality;
  } else if (file && totalPages > 0) {
    // Self-tuning logic: target at least 20% size savings (max budget = 0.8 * file.size)
    const maxBudget = 0.8 * file.size;
    const budgetPerPage = maxBudget / totalPages;
    const expectedPerPage = 55000 * compScale * compScale * compQuality * compQuality;

    if (expectedPerPage > budgetPerPage) {
      let bestScale = 1.2;
      let bestQuality = 0.60;
      let bestDiff = Infinity;
      
      for (let s = activePreset.scale; s >= 1.0; s -= 0.1) {
        let q = Math.sqrt(budgetPerPage / (55000 * s * s));
        q = Math.max(0.45, Math.min(activePreset.quality, q));
        
        const expected = 55000 * s * s * q * q;
        if (expected <= budgetPerPage) {
          const diff = budgetPerPage - expected;
          if (diff < bestDiff) {
            bestDiff = diff;
            bestScale = parseFloat(s.toFixed(2));
            bestQuality = parseFloat(q.toFixed(2));
          }
        }
      }
      compScale = bestScale;
      compQuality = bestQuality;
    }
  }

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    setCompressedBlob(null);
    setCompressedSize(0);
    setTotalPages(0);

    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      setError("Please upload a valid PDF document.");
      return;
    }

    setFile(selectedFile);

    // Read pages count in the background asynchronously
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const pdfjs = await loadPdfJs();
        const arrayBuffer = reader.result as ArrayBuffer;
        const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        setTotalPages(pdfDoc.numPages);
      } catch (err) {
        console.error("Error reading pages count:", err);
        setError("Failed to count PDF pages. Please verify the document is not corrupted.");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Dynamic loader for PDFjs from CDN to avoid Next.js build problems
  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      const win = window as any;
      if (win.pdfjsLib) {
        resolve(win.pdfjsLib);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        const pdfjs = win.pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(pdfjs);
      };
      script.onerror = () => reject(new Error("Failed to load PDF processing components. Check internet connection."));
      document.head.appendChild(script);
    });
  };

  // PDF compression execution
  const handleCompress = async () => {
    if (!file) return;
    
    setIsLoading(true);
    setError(null);
    setProgressPage(0);

    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;
      setTotalPages(numPages);

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "px",
        compress: true // Enables FlateDecode compression for internal structures
      });

      // Sequential page rendering loops
      for (let i = 1; i <= numPages; i++) {
        setProgressPage(i);
        const page = await pdfDoc.getPage(i);
        
        // Render viewport at preset scale
        const viewport = page.getViewport({ scale: compScale });
        
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not initialize 2D canvas context.");

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        // Convert page canvas to binary JPEG Uint8Array bytes
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", compQuality));
        if (!blob) throw new Error("Failed to export page canvas to image blob.");
        const buffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        const pageOrientation = viewport.width > viewport.height ? "l" : "p";
        if (i > 1) {
          doc.addPage([viewport.width, viewport.height], pageOrientation);
        } else {
          // Delete default first page, replace with dynamic orientation/dimension page
          doc.deletePage(1);
          doc.addPage([viewport.width, viewport.height], pageOrientation);
        }

        doc.setPage(i);
        doc.addImage(uint8, "JPEG", 0, 0, viewport.width, viewport.height, undefined, "FAST");
      }

      // Output compressed Blob
      const resultBlob = doc.output("blob");
      setCompressedBlob(resultBlob);
      setCompressedSize(resultBlob.size);
    } catch (err: any) {
      console.error("PDF compression error:", err);
      setError(err?.message || "An unexpected error occurred during PDF compression. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!compressedBlob || !file) return;

    try {
      track("PDF Compressed", { preset: activePreset.id, targetLimit: targetSizePreset });
    } catch (e) {
      console.error("Tracking error:", e);
    }

    const link = document.createElement("a");
    link.href = URL.createObjectURL(compressedBlob);
    const originalName = file.name.substring(0, file.name.lastIndexOf("."));
    link.download = `${originalName}_compressed.pdf`;
    link.click();
  };

  const handleReset = () => {
    setFile(null);
    setCompressedBlob(null);
    setCompressedSize(0);
    setError(null);
    setProgressPage(0);
    setTotalPages(0);
    setTargetSizePreset("none");
  };

  // Calculations for savings
  const expectedOutputSize = file && totalPages > 0
    ? estimateCompressedSizeCustom(file.size, totalPages, compScale, compQuality)
    : 0;

  const sizeSavings = file && compressedSize > 0 
    ? Math.max(0, Math.round(((file.size - compressedSize) / file.size) * 100)) 
    : 0;

  const expectedSavings = file && expectedOutputSize > 0 
    ? Math.max(0, Math.round(((file.size - expectedOutputSize) / file.size) * 100))
    : 0;

  // Formatting target size limit for warnings
  const formattedLimitString = targetSizePreset === "custom" 
    ? `${customTargetSize} ${customTargetUnit.toUpperCase()}`
    : targetSizePreset === "1mb" ? "1 MB" : targetSizePreset === "2mb" ? "2 MB" : "5 MB";

  return (
    <div className={styles.container}>
      {/* Tool Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: "700", margin: 0 }}>PDF Compressor</h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem", margin: "0.25rem 0 0 0" }}>
            Reduce file sizes of scanned PDFs and slide decks client-side.
          </p>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className={styles.workspaceGrid}>
        
        {/* Left Side: Upload Zone / Processing Loader */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <FileDown size={18} className="text-indigo-400" />
              {file ? "Document Uploaded" : "Upload PDF File"}
            </h3>
            {file && !isLoading && (
              <button type="button" className={styles.secondaryBtn} onClick={handleReset} style={{ width: "auto", padding: "0.4rem 0.8rem" }}>
                Remove File
              </button>
            )}
          </div>

          <div className={`${styles.panelBody} glass-panel`}>
            {isLoading ? (
              /* Compression Progress Page */
              <div className={styles.progressPanel}>
                <Loader2 className={styles.progressSpinner} size={48} />
                <div className={styles.progressTitle}>Compressing PDF...</div>
                <div className={styles.progressSubtitle}>
                  Processing page {progressPage} of {totalPages}...
                </div>
                <div className={styles.progressBarTrack}>
                  <div 
                    className={styles.progressBarFill} 
                    style={{ width: `${totalPages > 0 ? (progressPage / totalPages) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ) : file ? (
              /* File Uploaded Layout */
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", justifyContent: "center", height: "100%" }}>
                <div className={styles.fileInfoCard}>
                  <div className={styles.fileIconWrapper}>
                    <FileText size={24} />
                  </div>
                  <div className={styles.fileDetails}>
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileMeta}>
                      {formatBytes(file.size)} {totalPages > 0 && `• ${totalPages} Pages`}
                    </span>
                  </div>
                </div>

                {/* Warning Alert Disclaimer */}
                <div className={styles.disclaimerBox} style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399" }}>
                  <Info className={styles.disclaimerIcon} size={18} style={{ color: "#34d399", marginTop: "2px" }} />
                  <div className={styles.disclaimerText}>
                    <strong style={{ color: "white", display: "block", marginBottom: "0.25rem" }}>🔒 Privacy-First Local Compression</strong>
                    To guarantee absolute privacy, your files are compressed entirely on your device and **never uploaded to any server**. 
                    To achieve this local security, pages are compiled as high-fidelity visual layouts, making selectable text flat. This is ideal for presentations, scanned documents, and receipts, but not recommended for official legal contracts requiring selectable text.
                  </div>
                </div>

                {compressedBlob && (
                  /* Stats details */
                  <div style={{ marginTop: "0.5rem" }}>
                    <div className={styles.statsGrid}>
                      <div className={styles.statCard}>
                        <span className={styles.statLabel}>Original Size</span>
                        <span className={styles.statValue}>{formatBytes(file.size)}</span>
                      </div>
                      <div className={styles.statCard}>
                        <span className={styles.statLabel}>Compressed Size</span>
                        <span className={styles.statValue}>{formatBytes(compressedSize)}</span>
                      </div>
                    </div>
                    {sizeSavings > 0 ? (
                      <div className={styles.savingsCard}>
                        <Sparkles size={16} />
                        <span>Successfully reduced file size by {sizeSavings}%!</span>
                      </div>
                    ) : (
                      <div className={styles.savingsCard} style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#f87171" }}>
                        <span>PDF is already fully optimized. Further compression did not reduce size.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Drag & Drop Upload Zone */
              <div 
                className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneActive : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerUploadClick}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept="application/pdf"
                  style={{ display: "none" }}
                />
                <Upload className={styles.uploadIcon} size={48} />
                <h4 className={styles.uploadTitle}>Drag & drop PDF here</h4>
                <p className={styles.uploadSubtitle}>or click to select file from device (Max 25MB)</p>
              </div>
            )}

            {error && <p className={styles.errorText}>{error}</p>}
          </div>
        </section>

        {/* Right Side: Compression Control Panel */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              Compression Settings
            </h3>
          </div>

          <div className={styles.panelBody} style={{ padding: 0 }}>
            {/* Target Size Limit */}
            <div className={styles.optionGroup}>
              <h4 className={styles.optionTitle}>
                Target File Size Limit
              </h4>
              
              <div className={styles.formField}>
                <select
                  value={targetSizePreset}
                  onChange={(e) => setTargetSizePreset(e.target.value)}
                  disabled={!file || isLoading}
                  style={{ opacity: !file ? 0.6 : 1 }}
                >
                  <option value="none">No Limit (Choose Profile Manually)</option>
                  <option value="1mb">Limit to under 1 MB</option>
                  <option value="2mb">Limit to under 2 MB</option>
                  <option value="5mb">Limit to under 5 MB</option>
                  <option value="custom">Custom target size limit...</option>
                </select>
              </div>

              {targetSizePreset === "custom" && (
                <div 
                  className={styles.formField} 
                  style={{ display: "flex", flexDirection: "row", gap: "0.5rem", marginTop: "0.5rem", animation: "fadeIn 0.2s ease forwards" }}
                >
                  <input
                    type="number"
                    min="10"
                    max="999"
                    value={customTargetSize}
                    onChange={(e) => setCustomTargetSize(parseInt(e.target.value) || 0)}
                    disabled={isLoading}
                    style={{ flex: 2 }}
                  />
                  <select
                    value={customTargetUnit}
                    onChange={(e) => setCustomTargetUnit(e.target.value)}
                    disabled={isLoading}
                    style={{ flex: 1 }}
                  >
                    <option value="kb">KB</option>
                    <option value="mb">MB</option>
                  </select>
                </div>
              )}

              {/* Target Limit Status Indication Alerts */}
              {targetSizeLimit > 0 && file && totalPages > 0 && (
                <>
                  {hasTargetWarning ? (
                    <div className={styles.alertDanger}>
                      <AlertTriangle size={14} style={{ marginTop: "2px", flexShrink: 0 }} />
                      <span>
                        <strong>Target Not Feasible:</strong> A limit of {formattedLimitString} is likely not possible for a {totalPages}-page PDF. Maximum compression is estimated to result in ~<strong>{formatBytes(highEst)}</strong>.
                      </span>
                    </div>
                  ) : hasTargetNotice ? (
                    <div className={styles.alertInfo}>
                      <Info size={14} style={{ marginTop: "2px", flexShrink: 0 }} />
                      <span>
                        <strong>No Compression Needed:</strong> The original file is already smaller ({formatBytes(file.size)}) than your target limit ({formattedLimitString}). High quality settings will be used.
                      </span>
                    </div>
                  ) : (
                    <div className={styles.alertInfo} style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399" }}>
                      <Check size={14} style={{ marginTop: "2px", flexShrink: 0 }} />
                      <span>
                        <strong>Limit Achievable:</strong> Setting active preset to fit under {formattedLimitString}.
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Profiles & Expected Size */}
            <div className={styles.optionGroup}>
              <h4 className={styles.optionTitle}>Select Compression Profile</h4>
              
              {file && expectedOutputSize > file.size && (
                <div style={{
                  background: "rgba(245, 158, 11, 0.08)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  color: "#fbbf24",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  lineHeight: "1.4",
                  marginBottom: "0.75rem"
                }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>This document contains vector text. Compressing it will flatten text to images, which may increase file size.</span>
                </div>
              )}
              
              {targetSizeLimit > 0 && file && totalPages > 0 ? (
                /* Target-Optimized Profile Card */
                <div 
                  className={`${styles.presetCard} ${styles.presetCardActive}`}
                  style={{ cursor: "default" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99, 102, 241, 0.15)", borderRadius: "50%", padding: "0.5rem", color: "var(--color-accent-light)", flexShrink: 0 }}>
                    <Sparkles size={18} />
                  </div>
                  <div className={styles.presetInfo}>
                    <span className={styles.presetName}>Target-Optimized Profile (Active)</span>
                    <span className={styles.presetDesc}>
                      Auto-tuned rendering resolution to <strong>{Math.round(targetScale * 100)}%</strong> and JPEG quality to <strong>{Math.round(targetQuality * 100)}%</strong> to fit under your {formattedLimitString} limit.
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-success)", fontWeight: "600", marginTop: "0.25rem" }}>
                      Expected Output Size: ~{formatBytes(estimateCompressedSizeCustom(file.size, totalPages, targetScale, targetQuality))} (Saves ~{Math.max(0, Math.round(((file.size - estimateCompressedSizeCustom(file.size, totalPages, targetScale, targetQuality)) / file.size) * 100))}% size)
                    </span>
                  </div>
                </div>
              ) : (
                /* Normal Preset Grid */
                <div className={styles.presetGrid}>
                  {presets.map((preset) => {
                    const estSize = estimateCompressedSizeCustom(file ? file.size : 0, totalPages, preset.scale, preset.quality);
                    const estSavings = file && estSize > 0 
                      ? Math.max(0, Math.round(((file.size - estSize) / file.size) * 100)) 
                      : 0;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`${styles.presetCard} ${activePreset.id === preset.id ? styles.presetCardActive : ""}`}
                        onClick={() => {
                          if (!isLoading) {
                            setActivePreset(preset);
                            setCompressedBlob(null);
                            setCompressedSize(0);
                          }
                        }}
                        disabled={isLoading}
                      >
                        <input 
                          type="radio" 
                          className={styles.presetRadio}
                          checked={activePreset.id === preset.id}
                          onChange={() => {}}
                          disabled={isLoading}
                        />
                        <div className={styles.presetInfo}>
                          <span className={styles.presetName}>
                            {preset.name}
                            {preset.id === "recommended" && " (Recommended)"}
                          </span>
                          <span className={styles.presetDesc}>{preset.desc}</span>
                          {file && totalPages > 0 && (
                            <span style={{ fontSize: "0.75rem", color: "var(--color-accent-light)", fontWeight: "600", marginTop: "0.25rem" }}>
                              Expected Output Size: ~{formatBytes(estSize)} ({estSavings > 0 ? `Saves ~${estSavings}%` : "No savings"})
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Display expected size overlay summary */}
              {file && totalPages > 0 && !compressedBlob && (
                <div style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.8rem",
                  color: "var(--color-text-secondary)",
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "0.5rem"
                }}>
                  <span>Profile: <strong>{targetSizeLimit > 0 ? "Target-Optimized" : activePreset.name.split(" ")[0]}</strong></span>
                  <span>Estimated: ~<strong>{formatBytes(targetSizeLimit > 0 ? estimateCompressedSizeCustom(file.size, totalPages, targetScale, targetQuality) : estimateCompressedSizeCustom(file.size, totalPages, activePreset.scale, activePreset.quality))}</strong> ({
                    Math.max(0, Math.round(((file.size - (targetSizeLimit > 0 ? estimateCompressedSizeCustom(file.size, totalPages, targetScale, targetQuality) : estimateCompressedSizeCustom(file.size, totalPages, activePreset.scale, activePreset.quality))) / file.size) * 100))
                  }%)</span>
                </div>
              )}
            </div>

            <div className={styles.actionBtnRow}>
              {compressedBlob ? (
                <button
                  type="button"
                  onClick={handleDownload}
                  className={`${styles.primaryBtn} accent-gradient`}
                >
                  <Download size={18} />
                  Download Compressed PDF
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCompress}
                  disabled={!file || isLoading}
                  className={`${styles.primaryBtn} accent-gradient`}
                  style={{ opacity: !file ? 0.5 : 1, cursor: !file ? "not-allowed" : "pointer" }}
                >
                  <Sparkles size={18} />
                  Compress PDF Document
                </button>
              )}
              {file && (
                <button
                  type="button"
                  onClick={handleReset}
                  className={styles.secondaryBtn}
                  disabled={isLoading}
                >
                  <Trash2 size={16} />
                  Clear & Choose Different Document
                </button>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
