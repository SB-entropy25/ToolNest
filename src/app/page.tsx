"use client";

import React, { useState } from "react";
import { Boxes, Camera, FileUp, Settings, Scissors, FileDown, Info, Calendar, Layers } from "lucide-react";
import PhotoBooth from "@/components/tools/PhotoBooth";
import BgRemover from "@/components/tools/BgRemover";
import PdfCompressor from "@/components/tools/PdfCompressor";
import FileConverter from "@/components/tools/FileConverter";
import PdfMerger from "@/components/tools/PdfMerger";
import About from "@/components/tools/About";
import Upcoming from "@/components/tools/Upcoming";
import styles from "./page.module.css";

type ToolType = "photo-booth" | "bg-remover" | "pdf-compressor" | "converter" | "pdf-merger" | "about" | "upcoming";

interface ToolItem {
  id: ToolType;
  name: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

export default function Home() {
  const [activeTool, setActiveTool] = useState<ToolType>("photo-booth");

  const tools: ToolItem[] = [
    {
      id: "photo-booth",
      name: "Photo Booth",
      icon: <Camera size={18} />,
    },
    {
      id: "bg-remover",
      name: "BG Remover",
      icon: <Scissors size={18} />,
    },
    {
      id: "pdf-compressor",
      name: "PDF Compressor",
      icon: <FileDown size={18} />,
    },
    {
      id: "converter",
      name: "File Converter",
      icon: <FileUp size={18} />,
    },
    {
      id: "pdf-merger",
      name: "PDF Merger",
      icon: <Layers size={18} />,
    },
    {
      id: "about",
      name: "About Us",
      icon: <Info size={18} />,
    },
    {
      id: "upcoming",
      name: "Upcoming Features",
      icon: <Calendar size={18} />,
    },
  ];

  return (
    <div className={styles.nestContainer}>
      {/* ToolNest Hub Header */}
      <header className={styles.nestHeader}>
        <div className={styles.logoArea}>
          <Boxes size={32} className={styles.logoIcon} />
          <h1 className={`${styles.logoText} text-gradient`}>ToolNest</h1>
        </div>
        <p className={styles.subtitle}>Daily Hack Resolutions</p>
      </header>

      {/* Hub Grid */}
      <div className={styles.nestGrid}>
        {/* Navigation Sidebar */}
        <aside className={`${styles.sidebar} glass-panel`}>
          <span className={styles.navTitle}>Available Tools</span>
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`${styles.tabBtn} ${
                activeTool === tool.id ? styles.tabBtnActive : ""
              } ${tool.disabled ? styles.tabBtnDisabled : ""}`}
              onClick={() => {
                if (!tool.disabled) {
                  setActiveTool(tool.id);
                }
              }}
              disabled={tool.disabled}
            >
              {tool.icon}
              <span>{tool.name}</span>
              {tool.disabled && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.65rem",
                    background: "rgba(255, 255, 255, 0.05)",
                    padding: "0.15rem 0.4rem",
                    borderRadius: "4px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Soon
                </span>
              )}
            </button>
          ))}
          
          <div
            style={{
              marginTop: "auto",
              paddingTop: "1.5rem",
              borderTop: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              paddingLeft: "0.5rem",
            }}
          >
            <Settings size={14} />
            <span>Config V1.0.0</span>
          </div>
        </aside>

        {/* Dynamic Tool Workspace */}
        <div className={styles.toolWorkspace}>
          {activeTool === "photo-booth" && <PhotoBooth />}
          {activeTool === "bg-remover" && <BgRemover />}
          {activeTool === "pdf-compressor" && <PdfCompressor />}
          {activeTool === "converter" && <FileConverter />}
          {activeTool === "pdf-merger" && <PdfMerger />}
          {activeTool === "about" && <About />}
          {activeTool === "upcoming" && <Upcoming />}
        </div>
      </div>
    </div>
  );
}
