"use client";

import React, { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud } from "lucide-react";
import styles from "./ImageUpload.module.css";

interface ImageUploadProps {
  onUpload: (dataUrl: string) => void;
}

export default function ImageUpload({ onUpload }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    // Validate it's an image
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, JPEG, WEBP).");
      return;
    }

    // Limit file size to 15MB to prevent memory issues in browser
    if (file.size > 15 * 1024 * 1024) {
      setError("Image is too large. Please upload an image under 15MB.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === "string") {
        onUpload(e.target.result);
      } else {
        setError("Error reading file. Please try another image.");
      }
    };
    reader.onerror = () => {
      setError("Error reading file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`${styles.uploadContainer} ${isDragging ? styles.dragging : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          triggerFileInput();
        }
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        className={styles.fileInput}
        accept="image/*"
        onChange={handleFileChange}
      />
      <div className={styles.iconWrapper}>
        <UploadCloud size={32} />
      </div>
      <div className={styles.textGroup}>
        <h3 className={styles.title}>Upload your portrait photograph</h3>
        <p className={styles.subtitle}>
          Drag & drop your image here, or click to browse files
        </p>
        <button type="button" className={styles.browseButton}>
          Select Image
        </button>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    </div>
  );
}
