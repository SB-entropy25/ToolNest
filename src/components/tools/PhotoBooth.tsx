"use client";

import React, { useState } from "react";
import { ShieldAlert, Image as ImageIcon, Sparkles, Sliders } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import PhotoEditor from "@/components/PhotoEditor";
import LayoutPreview from "@/components/LayoutPreview";
import { generatePdf } from "@/utils/pdfGenerator";
import { track } from "@vercel/analytics";
import styles from "./PhotoBooth.module.css";

type LayoutType = "classic-grid" | "photo-booth-strips";
type ThemeType = "white" | "dark" | "vintage" | "neon";

export default function PhotoBooth() {
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutType>("classic-grid");
  const [theme, setTheme] = useState<ThemeType>("white");
  const [bottomText, setBottomText] = useState<string>("PHOTO BOOTH");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleImageUploaded = (dataUrl: string) => {
    setRawImage(dataUrl);
    setCroppedImage(null); // Reset cropped image until editor outputs it
  };

  const handleCroppedImageChange = (dataUrl: string) => {
    setCroppedImage(dataUrl);
  };

  const handleDownloadPdf = async () => {
    if (!croppedImage) return;
    
    setIsGeneratingPdf(true);
    setPdfError(null);
    
    try {
      track("Photo Strip Compiled", { layout, theme });
    } catch (e) {
      console.error("Tracking error:", e);
    }

    try {
      await generatePdf(croppedImage, layout, theme, bottomText);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setPdfError("Failed to generate PDF. Please try a different image or refresh the browser.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleResetImage = () => {
    setRawImage(null);
    setCroppedImage(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Tool Header Info */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: "700", margin: 0 }}>Passport & Photo Booth Prints</h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem", margin: "0.25rem 0 0 0" }}>
            Align portrait to guidelines and generate printable 10x15 cm sheets.
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

      {/* Main Grid */}
      <div className={styles.mainGrid}>
        {/* Left Side: Photo Editor Workspace */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <Sliders size={18} className="text-indigo-400" />
              {rawImage ? "Adjust & Align Photograph" : "Upload Portrait"}
            </h3>
            {rawImage && (
              <button
                type="button"
                className={styles.changeImageBtn}
                onClick={handleResetImage}
              >
                Change Image
              </button>
            )}
          </div>

          <div className={`${styles.panelBody} glass-panel`}>
            {rawImage ? (
              <PhotoEditor imageSrc={rawImage} onChange={handleCroppedImageChange} />
            ) : (
              <ImageUpload onUpload={handleImageUploaded} />
            )}
          </div>
        </section>

        {/* Right Side: Print Layout Preview */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <Sparkles size={18} className="text-indigo-400" />
              Preview Sheet & Download
            </h3>
          </div>

          <div className={`${styles.panelBody} glass-panel`}>
            {croppedImage ? (
              <LayoutPreview
                croppedImage={croppedImage}
                layout={layout}
                onLayoutChange={setLayout}
                theme={theme}
                onThemeChange={setTheme}
                bottomText={bottomText}
                onBottomTextChange={setBottomText}
                onDownload={handleDownloadPdf}
                isGeneratingPdf={isGeneratingPdf}
              />
            ) : (
              <div className={styles.emptyPreview}>
                <ImageIcon size={48} className={styles.emptyIcon} />
                <h4 className={styles.panelTitle} style={{ margin: "1rem 0 0.5rem 0", justifyContent: "center" }}>
                  Awaiting Photograph
                </h4>
                <p className={styles.emptyText}>
                  Please upload and align your photograph to view layouts and print options.
                </p>
              </div>
            )}
            {pdfError && (
              <p
                style={{
                  color: "var(--color-danger)",
                  fontSize: "0.875rem",
                  marginTop: "1rem",
                  textAlign: "center",
                  fontWeight: "500",
                }}
              >
                {pdfError}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
