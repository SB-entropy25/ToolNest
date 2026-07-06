"use client";

import React from "react";
import { ShieldCheck, Cpu, HardDrive, Globe } from "lucide-react";
import styles from "./About.module.css";

export default function About() {
  return (
    <div className={`${styles.container} glass-panel animate-fade-in`}>
      <header className={styles.header}>
        <div className={styles.shieldGlow}>
          <ShieldCheck size={48} className={styles.shieldIcon} />
        </div>
        <h2 className={`${styles.title} text-gradient`}>About ToolNest</h2>
        <p className={styles.subtitle}>Our Commitment to Local-First Privacy</p>
      </header>

      <section className={styles.gridSection}>
        <div className={styles.card}>
          <Cpu className={styles.cardIcon} size={24} />
          <h3>100% Client-Side Power</h3>
          <p>
            Every single byte of your data is processed directly inside your browser. By utilizing modern technologies like WebAssembly (WASM), Web Workers, and client-side rendering engines, we execute complex photo booth manipulation, background removal, and file conversion routines locally in your browser's memory.
          </p>
        </div>

        <div className={styles.card}>
          <HardDrive className={styles.cardIcon} size={24} />
          <h3>Zero Server-Side Footprint</h3>
          <p>
            Your files and photographs never leave your computer. We do not have upload servers, remote database buffers, or cloud processing layers. This guarantees that your sensitive documents, personal receipts, credentials, and passport photos are completely secure and visible only to you.
          </p>
        </div>
      </section>

      <div className={styles.tradeoffBox}>
        <div className={styles.tradeoffTitle}>
          <Globe size={18} className={styles.tradeoffIcon} />
          <h4>The Local-First Trade-Off</h4>
        </div>
        <p>
          Admittedly, processing operations server-side can often be much easier and, in some cases, yield slightly higher visual quality or support larger files (as servers can host heavy commercial layouts, AI optical character recognition (OCR) systems, and multi-core compilation pools). 
        </p>
        <p>
          However, server-side processing compromises the core ownership and privacy of your data. We believe that <strong>local-first privacy is worth the engineering challenge</strong>. To achieve this, we design custom clientside heuristics, tabular clustering layouts, and optimized presets to maximize fidelity right in your browser context.
        </p>
      </div>

      <footer className={styles.aboutFooter}>
        <p>Designed with absolute transparency for creators, students, and professionals.</p>
        <div className={styles.badge}>Security Auditable</div>
      </footer>
    </div>
  );
}
