"use client";

import React from "react";
import { Compass, RefreshCw, Layers, TableProperties, Sparkles, QrCode, Lock } from "lucide-react";
import styles from "./Upcoming.module.css";

interface RoadmapItem {
  title: string;
  icon: React.ReactNode;
  description: string;
  status: "In Development" | "Design Stage" | "In Research" | "Planned";
  statusColor: string;
}

export default function Upcoming() {
  const items: RoadmapItem[] = [
    {
      title: "Local OCR Text Extractor",
      icon: <Sparkles size={22} className={styles.iconBlue} />,
      description: "Extract text from scanned PDFs and images locally, compiling them into editable Word (.docx) files.",
      status: "In Research",
      statusColor: "statusYellow",
    },
    {
      title: "Batch PDF Compressor",
      icon: <Layers size={22} className={styles.iconIndigo} />,
      description: "Allow concurrent loading and visual compression of multiple PDFs at once. Multi-threading via Web Workers will ensure that your browser tab remains fluid and responsive during large batch executions.",
      status: "In Development",
      statusColor: "statusBlue",
    },
    {
      title: "Excel to PDF Grid Compiler",
      icon: <TableProperties size={22} className={styles.iconPurple} />,
      description: "Compile Excel sheets (.xlsx) directly into styled PDF vector matrices, maintaining grid borders, headers, and column widths locally without cloud server formatting helper scripts.",
      status: "Design Stage",
      statusColor: "statusPurple",
    },
    {
      title: "Local QR Code Generator",
      icon: <QrCode size={22} className={styles.iconGray} />,
      description: "Generate high-fidelity, customizable QR codes offline in your browser. Specify content links, customize foreground/background colors, configure error correction levels, and export them as clean PNG/SVG assets locally.",
      status: "Planned",
      statusColor: "statusGray",
    },
  ];

  return (
    <div className={`${styles.container} glass-panel animate-fade-in`}>
      <header className={styles.header}>
        <div className={styles.compassGlow}>
          <Compass size={40} className={styles.compassIcon} />
        </div>
        <h2 className={`${styles.title} text-gradient`}>Upcoming Features</h2>
        <p className={styles.subtitle}>Our Transparent Development Roadmap</p>
      </header>

      <div className={styles.roadmapGrid}>
        {items.map((item, index) => {
          const isLocked = index > 0;
          return (
            <div key={index} className={`${styles.card} ${isLocked ? styles.cardLocked : ""}`}>
              <div className={isLocked ? styles.blurContainer : ""}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconFrame}>{item.icon}</div>
                  <span className={`${styles.statusBadge} ${styles[item.statusColor]}`}>
                    {item.status}
                  </span>
                </div>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDesc}>{item.description}</p>
              </div>
              {isLocked && (
                <div className={styles.lockOverlay}>
                  <span className={styles.lockText}>
                    <Lock size={12} />
                    Coming Soon
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.infoFooter}>
        <RefreshCw size={14} className={styles.spinIcon} />
        <span>Roadmap updated weekly based on suggestions.</span>
      </div>
    </div>
  );
}
