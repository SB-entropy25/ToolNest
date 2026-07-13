"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { 
  Boxes, 
  Camera, 
  Scissors, 
  FileDown, 
  RefreshCw, 
  Layers, 
  Info, 
  Calendar,
  FileImage 
} from "lucide-react";
import styles from "@/app/page.module.css";

interface ToolItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Active Tool state derived from URL path
  const activeTool = pathname.split("/")[1] || "bg-remover";

  const tools: ToolItem[] = [
    {
      id: "bg-remover",
      name: "BG Remover",
      icon: <Scissors size={18} />,
    },
    {
      id: "photo-booth",
      name: "Photo Booth",
      icon: <Camera size={18} />,
    },
    {
      id: "file-converter",
      name: "File Converter",
      icon: <RefreshCw size={18} />,
    },
    {
      id: "pdf-merger",
      name: "PDF Merger",
      icon: <Layers size={18} />,
    },
    {
      id: "pdf-compressor",
      name: "PDF Compressor",
      icon: <FileDown size={18} />,
    },
    {
      id: "image-to-pdf",
      name: "Image to PDF",
      icon: <FileImage size={18} />,
    },
    {
      id: "about",
      name: "About & Feedback",
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
      {/* ToolNest Smart Hub Header */}
      <header className={styles.nestHeader}>
        <div className={styles.logoArea}>
          <Boxes size={32} className={styles.logoIcon} />
          <h1 className={`${styles.logoText} text-gradient`}>ToolNest Smart</h1>
        </div>
        <p className={styles.subtitle}>Daily Productivity Tools</p>
      </header>

      {/* Hub Grid */}
      <div className={styles.nestGrid}>
        {/* Navigation Sidebar */}
        <aside className={`${styles.sidebar} glass-panel`}>
          <span className={styles.navTitle}>Available Tools</span>
          {tools.map((tool) => {
            const isMostUsed = tool.id === "photo-booth" || tool.id === "bg-remover";
            const isActive = activeTool === tool.id;
            
            let btnClass = styles.tabBtn;
            if (tool.disabled) {
              btnClass += ` ${styles.tabBtnDisabled}`;
            } else if (isActive) {
              btnClass += ` ${isMostUsed ? styles.mostUsedTabActive : styles.tabBtnActive}`;
            } else if (isMostUsed) {
              btnClass += ` ${styles.mostUsedTab}`;
            }

            return (
              <button
                key={tool.id}
                type="button"
                className={btnClass}
                onClick={() => {
                  if (!tool.disabled) {
                    router.push(`/${tool.id}`);
                  }
                }}
                disabled={tool.disabled}
              >
                {tool.icon}
                <span>{tool.name}</span>
                {isMostUsed && (
                  <span 
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.6rem",
                      background: "rgba(212, 175, 55, 0.12)",
                      color: "#f3e5ab",
                      padding: "0.15rem 0.35rem",
                      borderRadius: "4px",
                      border: "1px solid rgba(212, 175, 55, 0.25)",
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Most Used
                  </span>
                )}
              </button>
            );
          })}
          
          <div
            style={{
              marginTop: "auto",
              padding: "1rem",
              borderRadius: "var(--radius-sm)",
              background: "rgba(255, 255, 255, 0.01)",
              border: "1px solid rgba(255, 255, 255, 0.03)",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--color-text-muted)",
                display: "block",
                fontWeight: "500",
                marginBottom: "0.25rem",
              }}
            >
              🔒 100% Local Processing
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                color: "rgba(255, 255, 255, 0.35)",
                display: "block",
                fontWeight: "400",
              }}
            >
              Made by Srijan Bhushan
            </span>
          </div>
        </aside>

        {/* Workspace Display Area */}
        <main className={styles.mainContent}>
          <div className={styles.toolWorkspace}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
