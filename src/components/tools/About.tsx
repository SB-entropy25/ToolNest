"use client";

import React from "react";
import { ShieldCheck, Cpu, HardDrive, Globe, MessageSquare, ExternalLink, ArrowDown } from "lucide-react";
import styles from "./About.module.css";

export default function About() {
  return (
    <div className={`${styles.container} glass-panel animate-fade-in`} style={{ position: "relative" }}>
      {/* Scroll to Feedback Hint */}
      <button 
        type="button"
        onClick={() => {
          const feedbackEl = document.getElementById("feedback-section");
          if (feedbackEl) {
            feedbackEl.scrollIntoView({ behavior: "smooth" });
          }
        }}
        style={{
          position: "absolute",
          top: "1.5rem",
          right: "1.5rem",
          fontSize: "0.68rem",
          color: "#fbbf24",
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          padding: "0.3rem 0.65rem",
          borderRadius: "9999px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          outline: "none"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(245, 158, 11, 0.15)";
          e.currentTarget.style.borderColor = "rgba(245, 158, 11, 0.55)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(245, 158, 11, 0.08)";
          e.currentTarget.style.borderColor = "rgba(245, 158, 11, 0.3)";
        }}
      >
        <ArrowDown size={10} style={{ animation: "bounce 2s infinite" }} />
        <span>Scroll to provide feedback</span>
      </button>

      <header className={styles.header}>
        <div className={styles.shieldGlow}>
          <ShieldCheck size={48} className={styles.shieldIcon} />
        </div>
        <h2 className={`${styles.title} text-gradient`}>About ToolNest Smart</h2>
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
            Your files and photographs never leave your computer. We do not have upload servers, remote database buffers, or cloud processing layers. Privacy is our MVP. The only telemetry tracked is completely anonymous feature usage statistics via Vercel Web Analytics nothing else. Your sensitive documents, personal receipts, and passport photos are completely secure and visible only to you.
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

      {/* Feedback Section */}
      <div 
        id="feedback-section"
        style={{
          background: "rgba(99, 102, 241, 0.04)",
          border: "1px solid rgba(99, 102, 241, 0.15)",
          borderRadius: "var(--radius-md)",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          alignItems: "center",
          textAlign: "center"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-accent-light)" }}>
          <MessageSquare size={20} />
          <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>Share Your Feedback</h4>
        </div>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary)", lineHeight: "1.5", maxWidth: "600px" }}>
          Help us improve ToolNest Smart! If you have feature requests, suggestions, or encountered any issues, please share them with us through our quick feedback form.
        </p>
        <a 
          href="https://docs.google.com/forms/d/e/1FAIpQLSc_gMYuZHXqk8DFwatMWwN4vm5Y-mP4GJZ_7qBt9eaeKnf-cg/viewform?usp=publish-editor"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--color-accent)",
            color: "white",
            padding: "0.6rem 1.2rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            fontWeight: "600",
            transition: "all 0.2s ease",
            textDecoration: "none",
            boxShadow: "0 4px 12px var(--color-accent-glow)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.background = "var(--color-accent-light)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.background = "var(--color-accent)";
          }}
        >
          <span>Open Feedback Form</span>
          <ExternalLink size={14} />
        </a>
      </div>

      <footer className={styles.aboutFooter}>
        <p>Designed with absolute transparency for students and basic daily purpose use.</p>
      </footer>
    </div>
  );
}
