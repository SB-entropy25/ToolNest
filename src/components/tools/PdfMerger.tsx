"use client";

import React, { useState, useRef } from "react";
import { 
  Upload, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  Check, 
  Download, 
  Loader2, 
  AlertTriangle, 
  Info,
  Sparkles,
  Plus
} from "lucide-react";
import { track } from "@vercel/analytics";
import styles from "./PdfMerger.module.css";

export default function PdfMerger() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>("");
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Format bytes to human-readable size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Dynamic loader for PDF-lib from CDN to avoid Next.js build problems
  const loadPdfLib = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      const win = window as any;
      if (win.PDFLib) {
        resolve(win.PDFLib);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
      script.onload = () => {
        if (win.PDFLib) {
          resolve(win.PDFLib);
        } else {
          reject(new Error("PDF-lib loaded but global object not found."));
        }
      };
      script.onerror = () => {
        reject(new Error("Failed to load PDF merger engine. Please check your internet connection."));
      };
      document.head.appendChild(script);
    });
  };

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
    
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Add files with validations (max 10, max 40MB each, PDF only)
  const addFiles = (newFiles: File[]) => {
    setError(null);
    setMergedBlob(null);

    const pdfFiles = newFiles.filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length < newFiles.length) {
      setError("Only PDF documents (.pdf) are supported.");
    }

    if (pdfFiles.length === 0) return;

    // Check size limit: max 40MB per file
    const sizeLimit = 40 * 1024 * 1024;
    const oversized = pdfFiles.filter(f => f.size > sizeLimit);
    if (oversized.length > 0) {
      setError("One or more files exceed the 40 MB size limit.");
      return;
    }

    // Check total files count (max 10)
    const combinedFiles = [...files, ...pdfFiles];
    if (combinedFiles.length > 10) {
      setError("You can merge a maximum of 10 PDF files at a time.");
      setFiles(combinedFiles.slice(0, 10));
    } else {
      setFiles(combinedFiles);
    }
  };

  // Reordering lists functions
  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...files];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setFiles(updated);
    setMergedBlob(null);
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    const updated = [...files];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setFiles(updated);
    setMergedBlob(null);
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, idx) => idx !== index);
    setFiles(updated);
    setMergedBlob(null);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      setError("Please add at least 2 PDF documents to merge.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress("Loading merger engine...");

    try {
      const PDFLibObj = await loadPdfLib();
      setProgress("Processing PDF files locally...");
      
      const mergedPdf = await PDFLibObj.PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Importing page structures from file ${i + 1} of ${files.length}...`);
        const fileBytes = await file.arrayBuffer();
        const srcPdf = await PDFLibObj.PDFDocument.load(fileBytes);
        const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        copiedPages.forEach((page: any) => mergedPdf.addPage(page));
      }

      setProgress("Compiling merged PDF bytes...");
      const mergedPdfBytes = await mergedPdf.save();
      const outputBlob = new Blob([mergedPdfBytes], { type: "application/pdf" });
      
      setMergedBlob(outputBlob);
      setProgress("");
    } catch (err: any) {
      console.error("PDF Merging Error:", err);
      setError(err?.message || "Failed to merge PDF files. Verify that the files are not encrypted or corrupted.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!mergedBlob) return;

    try {
      track("PDF Merged", { count: files.length });
    } catch (e) {
      console.error("Tracking error:", e);
    }

    const url = URL.createObjectURL(mergedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "merged_document.pdf";
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleReset = () => {
    setFiles([]);
    setMergedBlob(null);
    setError(null);
    setProgress("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className={styles.container}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf"
        multiple
        style={{ display: "none" }}
      />
      <div className={styles.workspaceGrid}>
        {/* Workspace Panel */}
        <section className={`${styles.panel} glass-panel`}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <FileText size={20} />
              PDF Documents Queue
            </h3>
            {files.length > 0 && !isLoading && !mergedBlob && (
              <button 
                type="button"
                className={styles.secondaryBtn} 
                onClick={triggerUploadClick}
                style={{ width: "auto", padding: "0.4rem 0.8rem", display: "flex", gap: "0.25rem", fontSize: "0.75rem" }}
              >
                <Plus size={14} />
                Add More
              </button>
            )}
          </div>

          <div className={styles.panelBody}>
            {isLoading ? (
              <div className={styles.progressPanel}>
                <Loader2 className={styles.progressSpinner} size={48} />
                <div className={styles.progressTitle}>Merging PDF Files...</div>
                <div className={styles.progressSubtitle}>{progress}</div>
              </div>
            ) : mergedBlob ? (
              <div className={styles.successCard}>
                <div className={styles.successIconWrapper}>
                  <Check size={28} />
                </div>
                <span className={styles.successTitle}>Merge Successful!</span>
                <span className={styles.successSubtitle}>
                  Your combined PDF has been compiled locally in browser RAM.
                </span>
                
                <div style={{ marginTop: "1rem", width: "100%" }}>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className={`${styles.primaryBtn} accent-gradient`}
                  >
                    <Download size={18} />
                    Download Combined PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className={styles.secondaryBtn}
                    style={{ marginTop: "0.5rem" }}
                  >
                    Merge New Documents
                  </button>
                </div>
              </div>
            ) : files.length === 0 ? (
              <div
                className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneActive : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerUploadClick}
              >
                <Upload className={styles.uploadIcon} size={48} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <p className={styles.uploadTitle}>Upload PDF Files</p>
                  <p className={styles.uploadSubtitle}>
                    Drag & drop up to 10 PDFs here, or click to browse
                  </p>
                  <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                    Max 10 files • Max 40 MB each file • Processed entirely locally
                  </p>
                </div>
              </div>
            ) : (
              <div className={styles.fileList}>
                {files.map((fileItem, idx) => (
                  <div key={`${fileItem.name}-${idx}`} className={styles.fileItemCard}>
                    <div className={styles.fileIndexBadge}>{idx + 1}</div>
                    <div className={styles.fileDetails}>
                      <span className={styles.fileName}>{fileItem.name}</span>
                      <span className={styles.fileSize}>{formatBytes(fileItem.size)}</span>
                    </div>
                    <div className={styles.actionButtons}>
                      <button
                        type="button"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className={styles.iconBtn}
                        title="Move Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(idx)}
                        disabled={idx === files.length - 1}
                        className={styles.iconBtn}
                        title="Move Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className={`${styles.iconBtn} styles.removeBtn`}
                        title="Remove"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Side Panel Controls & Actions */}
        <section className={`${styles.panel} glass-panel`}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <Sparkles size={20} />
              Controls & Info
            </h3>
          </div>

          <div className={styles.panelBody} style={{ minHeight: "auto", gap: "1.25rem" }}>
            <div className={styles.optionGroup}>
              <h4 className={styles.optionTitle}>Merge Parameters</h4>
              <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", margin: 0, lineHeight: "1.5" }}>
                Select documents in order. Use arrow triggers to rearrange vertical precedence before compiling.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.5rem" }}>
                <div>Total Files: <strong>{files.length} / 10</strong></div>
                <div>Queue Size: <strong>{formatBytes(totalSize)}</strong></div>
              </div>
            </div>

            {error && (
              <div className={styles.alertDanger}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Privacy Shield Box */}
            <div className={styles.disclaimerBox} style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399", marginTop: 0 }}>
              <Info className={styles.disclaimerIcon} size={18} style={{ color: "#34d399" }} />
              <div className={styles.disclaimerText}>
                <strong style={{ color: "white", display: "block" }}>🔒 100% In-Browser Merging</strong>
              </div>
            </div>

            {!mergedBlob && (
              <div className={styles.actionBtnRow}>
                <button
                  type="button"
                  onClick={handleMerge}
                  disabled={files.length < 2 || isLoading}
                  className={`${styles.primaryBtn} accent-gradient`}
                  style={{ opacity: files.length < 2 ? 0.5 : 1, cursor: files.length < 2 ? "not-allowed" : "pointer" }}
                >
                  <Sparkles size={18} />
                  Combine & Merge PDFs
                </button>
                {files.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className={styles.secondaryBtn}
                  >
                    Clear All
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
