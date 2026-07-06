"use client";

import React from "react";
import { Grid, Sparkles, Download, Loader2 } from "lucide-react";
import styles from "./LayoutPreview.module.css";

type LayoutType = "classic-grid" | "photo-booth-strips";
type ThemeType = "white" | "dark" | "vintage" | "neon";

interface LayoutPreviewProps {
  croppedImage: string;
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  theme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  bottomText: string;
  onBottomTextChange: (text: string) => void;
  onDownload: () => void;
  isGeneratingPdf: boolean;
}

export default function LayoutPreview({
  croppedImage,
  layout,
  onLayoutChange,
  theme,
  onThemeChange,
  bottomText,
  onBottomTextChange,
  onDownload,
  isGeneratingPdf,
}: LayoutPreviewProps) {
  // Theme styling helpers
  const getThemeClass = (t: ThemeType) => {
    switch (t) {
      case "dark":
        return styles.themeDark;
      case "vintage":
        return styles.themeVintage;
      case "neon":
        return styles.themeNeon;
      case "white":
      default:
        return styles.themeWhite;
    }
  };

  return (
    <div className={styles.previewSection}>
      <div className={styles.optionsPanel}>
        <h3 className={styles.sectionTitle}>Select Output Layout</h3>
        
        {/* Layout Switcher */}
        <div className={styles.layoutTabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${layout === "classic-grid" ? styles.tabBtnActive : ""}`}
            onClick={() => onLayoutChange("classic-grid")}
          >
            <Grid size={16} />
            Classic Grid (8 Photos)
          </button>
          
          <button
            type="button"
            className={`${styles.tabBtn} ${layout === "photo-booth-strips" ? styles.tabBtnActive : ""}`}
            onClick={() => onLayoutChange("photo-booth-strips")}
          >
            <Sparkles size={16} />
            Photo Booth Strips
          </button>
        </div>

        {/* Customization controls for Photo Booth Layout */}
        {layout === "photo-booth-strips" && (
          <div className={styles.customizerGrid}>
            <div className={styles.textInputGroup}>
              <label>Strip Theme</label>
              <div className={styles.themeSelector}>
                {(["white", "dark", "vintage", "neon"] as ThemeType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.themeBtn} ${theme === t ? styles.themeBtnActive : ""}`}
                    onClick={() => onThemeChange(t)}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.textInputGroup}>
              <label htmlFor="bottom-text-input">Bottom Text (optional)</label>
              <input
                id="bottom-text-input"
                type="text"
                maxLength={25}
                placeholder="e.g. PHOTO BOOTH 2026"
                value={bottomText}
                onChange={(e) => onBottomTextChange(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Printable Sheet Preview (Scales down 10x15cm page visually) */}
      <div className={styles.paperContainer}>
        <div
          className={`${styles.paperSheet} ${
            layout === "classic-grid" ? styles.landscapeSheet : styles.portraitSheet
          }`}
        >
          {layout === "classic-grid" ? (
            /* Layout A: 4x2 Grid on a 15x10 Landscape Sheet */
            <div className={styles.grid4x2}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={styles.gridItem}>
                  {croppedImage ? (
                    <img src={croppedImage} alt={`Passport Grid Item ${i + 1}`} />
                  ) : (
                    <div style={{ fontSize: "10px", color: "#888" }}>Photo {i + 1}</div>
                  )}
                </div>
              ))}
              
              {/* Cutting guides (Dashed lines to represent cutting boundaries) */}
              <div className={styles.cutGuideV} style={{ left: "25%" }} />
              <div className={styles.cutGuideV} style={{ left: "50%" }} />
              <div className={styles.cutGuideV} style={{ left: "75%" }} />
              <div className={styles.cutGuideH} style={{ top: "50%" }} />
            </div>
          ) : (
            /* Layout B: 2 Photo Booth Strips (Vertical) on a 10x15 Portrait Sheet */
            <div className={styles.photoBoothLayout}>
              {Array.from({ length: 2 }).map((_, stripIdx) => (
                <div
                  key={stripIdx}
                  className={`${styles.stripFrame} ${getThemeClass(theme)}`}
                >
                  <div className={styles.stripPhotos}>
                    {Array.from({ length: 4 }).map((_, photoIdx) => (
                      <div key={photoIdx} className={styles.stripPhotoWrapper}>
                        {croppedImage ? (
                          <img
                            src={croppedImage}
                            alt={`Booth Photo ${photoIdx + 1}`}
                            className={theme === "vintage" ? styles.sepiaImage : ""}
                          />
                        ) : (
                          <div style={{ height: "100%", background: "#444" }} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={styles.stripFooter}>
                    {bottomText || "PHOTO BOOTH"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compile & Download PDF action */}
      <div className={styles.actionRow}>
        <button
          type="button"
          disabled={!croppedImage || isGeneratingPdf}
          onClick={onDownload}
          className={`${styles.downloadBtn} accent-gradient`}
        >
          {isGeneratingPdf ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Generating PDF...
            </>
          ) : (
            <>
              <Download size={20} />
              Download Print-Ready PDF
            </>
          )}
        </button>
        <p className={styles.infoNote}>
          This compiles a high-DPI PDF document measuring exactly <b>10 x 15 cm</b> (4 x 6 inches). 
          Set your photo printer scale to <b>100% (Actual Size)</b> and select borderless paper matching this size when printing.
        </p>
      </div>
    </div>
  );
}
