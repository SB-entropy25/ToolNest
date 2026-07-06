"use client";

import React, { useState, useRef } from "react";
import { 
  FileUp, 
  FileText, 
  Loader2, 
  Sparkles, 
  Trash2, 
  Download, 
  Check, 
  AlertTriangle, 
  Info,
  RefreshCw
} from "lucide-react";
import styles from "./FileConverter.module.css";

type ConversionMode = "pdf-to-docx" | "docx-to-pdf";

export default function FileConverter() {
  const [mode, setMode] = useState<ConversionMode>("pdf-to-docx");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>("");
  const [totalPages, setTotalPages] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [convertedSize, setConvertedSize] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Format bytes to human-readable size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Switch Conversion Mode
  const handleModeChange = (newMode: ConversionMode) => {
    if (isLoading) return;
    setMode(newMode);
    handleReset();
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
    setConvertedBlob(null);
    setConvertedSize(0);
    setTotalPages(0);

    const name = selectedFile.name.toLowerCase();

    if (mode === "pdf-to-docx") {
      if (selectedFile.type !== "application/pdf" && !name.endsWith(".pdf")) {
        setError("Please upload a valid PDF document.");
        return;
      }
      setFile(selectedFile);
      
      // Read PDF pages in the background
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const pdfjs = await loadPdfJs();
          const arrayBuffer = reader.result as ArrayBuffer;
          const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          setTotalPages(pdfDoc.numPages);
          
          if (pdfDoc.numPages > 25) {
            setError(`The uploaded PDF has ${pdfDoc.numPages} pages. The tool has a limit of max 25 pages to ensure smooth client-side processing.`);
          }
        } catch (err) {
          console.error("Error reading pages count:", err);
          setError("Failed to count PDF pages. Please verify the document is not corrupted.");
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      // docx-to-pdf
      const isDocx = name.endsWith(".docx") || 
                     selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      if (!isDocx) {
        setError("Please upload a valid Word document (.docx).");
        return;
      }
      
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("Word document is too large. Please upload a file smaller than 5 MB (approx. 25 pages).");
        return;
      }
      
      setFile(selectedFile);
    }
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
        win.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(win.pdfjsLib);
      };
      script.onerror = () => reject(new Error("Failed to load PDF parser library."));
      document.body.appendChild(script);
    });
  };

  // PDF to Word Conversion Logic
  const handlePdfToDocx = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setProgress("Initializing conversion...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjs = await loadPdfJs();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;
      setTotalPages(numPages);

      if (numPages > 25) {
        throw new Error(`The uploaded PDF has ${numPages} pages. The tool has a limit of max 25 pages.`);
      }

      const { 
        Document, 
        Paragraph, 
        Packer, 
        TextRun, 
        PageBreak, 
        Table, 
        TableRow, 
        TableCell, 
        WidthType, 
        BorderStyle,
        ImageRun
      } = await import("docx");

      const docParagraphs: any[] = [];
      let currentTableRows: any[][] = [];
      let totalCharactersExtracted = 0;

      // Helper to convert data URL to ArrayBuffer for docx ImageRun compatibility
      const dataURLToArrayBuffer = (dataURL: string): ArrayBuffer => {
        const base64 = dataURL.split(",")[1];
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        return bytes.buffer;
      };

      // Local helper to flush accumulated table rows
      const flushTable = () => {
        if (currentTableRows.length === 0) return;
        
        const maxCols = Math.max(...currentTableRows.map(row => row.length));
        
        const docRows = currentTableRows.map((rowCells) => {
          const docCells = rowCells.map((cellData) => {
            return new TableCell({
              children: [
                new Paragraph({
                  children: cellData.textRuns,
                  spacing: { before: 80, after: 80 },
                })
              ],
              width: {
                size: Math.round(100 / maxCols),
                type: WidthType.PERCENTAGE,
              },
            });
          });
          
          while (docCells.length < maxCols) {
            docCells.push(new TableCell({
              children: [new Paragraph("")],
              width: {
                size: Math.round(100 / maxCols),
                type: WidthType.PERCENTAGE,
              }
            }));
          }
          
          return new TableRow({
            children: docCells,
          });
        });
        
        docParagraphs.push(
          new Table({
            rows: docRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "F1F5F9" },
              insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "F1F5F9" },
            }
          })
        );
        
        docParagraphs.push(
          new Paragraph({
            spacing: { after: 120 }
          })
        );
      };

      // Add a header/title indicating conversion source
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Converted Document: ${file.name.replace(".pdf", "")}`,
              bold: true,
              size: 32, // 16pt
            }),
          ],
          spacing: { after: 240 }, // 12pt
        })
      );

      for (let i = 1; i <= numPages; i++) {
        setProgress(`Reading page ${i} of ${numPages}...`);
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        
        const items = textContent.items as any[];
        // Filter out marked content or items without valid text/transform
        const textItems = items.filter((item) => item.str !== undefined && item.transform !== undefined);
        
        // Extract operator list to find embedded images
        const ops = await page.getOperatorList();
        const images: { y: number, x: number, width: number, height: number, dataUrl: string }[] = [];
        let ctm = [1, 0, 0, 1, 0, 0];

        for (let j = 0; j < ops.fnArray.length; j++) {
          const fn = ops.fnArray[j];
          const args = ops.argsArray[j];
          
          if (fn === pdfjs.OPS.transform) {
            ctm = args;
          } else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
            const imgKey = args[0];
            try {
              let imgObj = null;
              // Check page-specific objects
              try {
                imgObj = page.objs.get(imgKey);
              } catch (e) {}
              
              // If not found, check shared document common resource objects (for repeated logos)
              if (!imgObj) {
                try {
                  imgObj = page.commonObjs.get(imgKey);
                } catch (e) {}
              }

              if (imgObj) {
                const width = Math.abs(ctm[0]);
                const height = Math.abs(ctm[3]);
                const x = ctm[4];
                const y = ctm[5];
                
                const canvas = document.createElement("canvas");
                canvas.width = imgObj.width || imgObj.naturalWidth || 100;
                canvas.height = imgObj.height || imgObj.naturalHeight || 100;
                const ctx = canvas.getContext("2d");
                
                if (ctx) {
                  if (imgObj.data) {
                    const imgData = ctx.createImageData(canvas.width, canvas.height);
                    if (imgObj.data.length === canvas.width * canvas.height * 3) {
                      let srcIdx = 0;
                      let dstIdx = 0;
                      for (let p = 0; p < canvas.width * canvas.height; p++) {
                        imgData.data[dstIdx] = imgObj.data[srcIdx];
                        imgData.data[dstIdx+1] = imgObj.data[srcIdx+1];
                        imgData.data[dstIdx+2] = imgObj.data[srcIdx+2];
                        imgData.data[dstIdx+3] = 255;
                        srcIdx += 3;
                        dstIdx += 4;
                      }
                    } else {
                      imgData.data.set(imgObj.data);
                    }
                    ctx.putImageData(imgData, 0, 0);
                  } else {
                    ctx.drawImage(imgObj, 0, 0);
                  }
                  
                  const dataUrl = canvas.toDataURL("image/png");
                  images.push({ y, x, width, height, dataUrl });
                }
              }
            } catch (e) {
              console.error("Error extracting PDF page image:", e);
            }
          }
        }

        // If page has absolutely no text items and no images, continue
        if (textItems.length === 0 && images.length === 0) continue;

        // Group text items by line Y-coordinate
        const lineMap: { [key: number]: any[] } = {};
        textItems.forEach((item) => {
          const y = Math.round(item.transform[5]);
          const closeY = Object.keys(lineMap).find((k) => Math.abs(parseInt(k) - y) < 6);
          if (closeY) {
            lineMap[parseInt(closeY)].push(item);
          } else {
            lineMap[y] = [item];
          }
        });

        interface PageElement {
          type: "text" | "image";
          y: number;
          data: any;
        }

        const pageElements: PageElement[] = [];

        // Insert text elements
        Object.keys(lineMap).forEach((yStr) => {
          const yVal = parseInt(yStr);
          pageElements.push({
            type: "text",
            y: yVal,
            data: {
              yVal,
              lineItems: lineMap[yVal]
            }
          });
        });

        // Insert image elements
        images.forEach((img) => {
          pageElements.push({
            type: "image",
            y: img.y,
            data: img
          });
        });

        // Sort all elements vertically top-to-bottom (Y descending)
        pageElements.sort((a, b) => b.y - a.y);

        pageElements.forEach((element) => {
          if (element.type === "image") {
            // Flush any active tables before rendering image
            flushTable();
            currentTableRows = [];

            // Add image to paragraphs
            docParagraphs.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: dataURLToArrayBuffer(element.data.dataUrl),
                    transformation: {
                      width: Math.min(450, element.data.width * 0.75),
                      height: Math.min(600, element.data.height * 0.75),
                    },
                    type: "png",
                  }),
                ],
                alignment: "center",
                spacing: { after: 120 },
              })
            );
          } else {
            // Text element
            const { yVal, lineItems } = element.data;
            const firstItem = lineItems[0];
            const startX = firstItem.transform[4];
            const leftIndent = startX > 60 ? Math.round((startX - 54) * 20) : 0;
            
            const cells: { textRuns: any[], text: string }[] = [];
            let currentCellRuns: any[] = [];
            let currentCellText = "";
            let lastItemX = 0;
            let lastItemWidth = 0;
            
            lineItems.forEach((item: any) => {
              const textVal = item.str;
              if (!textVal) return;
              
              const x = item.transform[4];
              const fontSizePoints = item.height || item.transform[3] || 11;
              const fontSizeHalfPoints = Math.round(fontSizePoints * 2);
              
              const fontNameLower = (item.fontName || "").toLowerCase();
              const isBold = fontNameLower.includes("bold") || fontNameLower.includes("black") || fontNameLower.includes("heavy");
              const isItalic = fontNameLower.includes("italic") || fontNameLower.includes("oblique");
              
              if (currentCellText !== "" && x > lastItemX + lastItemWidth + 35) {
                cells.push({
                  textRuns: currentCellRuns,
                  text: currentCellText
                });
                currentCellRuns = [];
                currentCellText = "";
              }
              
              const prefix = (currentCellText !== "" && x > lastItemX + lastItemWidth + 3) ? " " : "";
              const currentText = prefix + textVal;
              
              currentCellText += currentText;
              
              currentCellRuns.push(
                new TextRun({
                  text: currentText,
                  font: "Arial",
                  size: fontSizeHalfPoints,
                  bold: isBold,
                  italics: isItalic,
                })
              );
              
              lastItemX = x;
              lastItemWidth = item.width || 0;
            });

            if (currentCellText !== "") {
              cells.push({
                textRuns: currentCellRuns,
                text: currentCellText
              });
            }

            const lineFullText = cells.map(c => c.text).join("");
            if (lineFullText.trim()) {
              totalCharactersExtracted += lineFullText.length;
              
              if (cells.length >= 2) {
                currentTableRows.push(cells);
              } else {
                flushTable();
                currentTableRows = [];
                
                docParagraphs.push(
                  new Paragraph({
                    children: cells[0].textRuns,
                    indent: leftIndent > 0 ? { left: leftIndent } : undefined,
                    spacing: { after: 120 },
                  })
                );
              }
            }
          }
        });

        // Flush any remaining tables on the page before page breaks
        flushTable();
        currentTableRows = [];

        // Add page break after each page except the last
        if (i < numPages) {
          docParagraphs.push(
            new Paragraph({
              children: [
                new PageBreak(),
              ],
            })
          );
        }
      }

      if (totalCharactersExtracted < 15) {
        throw new Error("No selectable text could be extracted from this PDF. It appears to be a scanned document or consists of images only. Pure browser-based local converters require a PDF with selectable text layers to run offline.");
      }

      setProgress("Compiling Microsoft Word file...");
      const doc = new Document({
        sections: [{
          children: docParagraphs,
        }],
      });

      const blob = await Packer.toBlob(doc);
      setConvertedBlob(blob);
      setConvertedSize(blob.size);
    } catch (err: any) {
      console.error("PDF to Docx Conversion Error:", err);
      setError(err?.message || "Failed to convert PDF to Word. Make sure the PDF contains selectable text layers.");
    } finally {
      setIsLoading(false);
    }
  };

  // Word to PDF Conversion Logic
  const handleDocxToPdf = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setProgress("Initializing Word document parser...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      setProgress("Extracting Word content...");
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      if (result.messages.length > 0) {
        console.log("Mammoth warnings:", result.messages);
      }

      setProgress("Building PDF document page layouts...");
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(html, "text/html");
      const elements = Array.from(htmlDoc.body.children);

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const margin = 54; // 0.75 in margins
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;

      let y = margin;
      let pagesCount = 1;

      // Draw document title at top of first page
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(18);
      doc.text(file.name.replace(".docx", ""), margin, y + 18);
      y += 40;

      interface TextSegment {
        text: string;
        bold: boolean;
        italic: boolean;
        color: string | null;
        underline: boolean;
      }

      const parseColorString = (colorStr: string): { r: number, g: number, b: number } | null => {
        colorStr = colorStr.trim().toLowerCase();
        if (colorStr.startsWith("#")) {
          const hex = colorStr.substring(1);
          if (hex.length === 3) {
            return {
              r: parseInt(hex[0] + hex[0], 16),
              g: parseInt(hex[1] + hex[1], 16),
              b: parseInt(hex[2] + hex[2], 16)
            };
          } else if (hex.length === 6) {
            return {
              r: parseInt(hex.substring(0, 2), 16),
              g: parseInt(hex.substring(2, 4), 16),
              b: parseInt(hex.substring(4, 6), 16)
            };
          }
        }
        if (colorStr.startsWith("rgb")) {
          const matches = colorStr.match(/\d+/g);
          if (matches && matches.length >= 3) {
            return {
              r: parseInt(matches[0]),
              g: parseInt(matches[1]),
              b: parseInt(matches[2])
            };
          }
        }
        return null;
      };

      const extractSegments = (node: Node, currentStyles = { bold: false, italic: false, color: null as string | null, underline: false }): TextSegment[] => {
        let segments: TextSegment[] = [];
        
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent) {
            segments.push({
              text: node.textContent,
              ...currentStyles
            });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          
          let newStyles = { ...currentStyles };
          if (tag === "strong" || tag === "b") newStyles.bold = true;
          if (tag === "em" || tag === "i") newStyles.italic = true;
          if (tag === "u" || tag === "ins") newStyles.underline = true;
          
          const styleColor = el.style.color;
          if (styleColor) {
            newStyles.color = styleColor;
          }
          
          Array.from(el.childNodes).forEach((child) => {
            segments = segments.concat(extractSegments(child, newStyles));
          });
        }
        
        return segments;
      };

      for (const el of elements) {
        const tag = el.tagName.toLowerCase();
        const text = el.textContent || "";
        if (!text.trim()) continue;

        let baseFontSize = 10.5;
        let baseSpacing = 8;
        let elementBold = false;

        if (tag === "h1") {
          baseFontSize = 18;
          elementBold = true;
          baseSpacing = 16;
        } else if (tag === "h2") {
          baseFontSize = 14;
          elementBold = true;
          baseSpacing = 12;
        } else if (tag === "h3") {
          baseFontSize = 12;
          elementBold = true;
          baseSpacing = 10;
        } else if (tag === "pre" || tag === "code") {
          baseFontSize = 9.5;
          baseSpacing = 8;
        }

        // Extract styled child runs recursively
        const segments = extractSegments(el, { bold: elementBold, italic: false, color: null, underline: false });
        if (segments.length === 0) continue;

        let currentX = margin;
        let lineMaxFontSize = baseFontSize;

        segments.forEach((seg) => {
          const fontStyle = seg.bold && seg.italic ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
          
          doc.setFont("Helvetica", fontStyle);
          doc.setFontSize(baseFontSize);
          
          // Apply custom text color if parsed
          if (seg.color) {
            const parsed = parseColorString(seg.color);
            if (parsed) {
              doc.setTextColor(parsed.r, parsed.g, parsed.b);
            } else {
              doc.setTextColor(30, 41, 59); // default dark color matching theme text
            }
          } else {
            doc.setTextColor(30, 41, 59);
          }

          // Split segments into words and whitespace
          const words = seg.text.split(/(\s+)/);
          
          words.forEach((word) => {
            if (!word) return;
            const wordWidth = doc.getTextWidth(word);
            
            // Wrap line if it overflows the page width
            if (currentX + wordWidth > pageWidth - margin) {
              currentX = margin;
              y += lineMaxFontSize * 1.25;
              lineMaxFontSize = baseFontSize;
              
              // Add a new page if page overflows
              if (y + lineMaxFontSize * 1.25 > pageHeight - margin) {
                doc.addPage();
                y = margin;
                pagesCount++;
                
                if (pagesCount > 25) {
                  throw new Error("The compiled PDF exceeds the 25-page limit constraint. Please shorten your Word file.");
                }
              }
            }

            if (word.trim()) {
              doc.text(word, currentX, y + baseFontSize);
            }
            currentX += wordWidth;
          });
        });

        // Add spacing after paragraph block
        y += lineMaxFontSize * 1.25 + baseSpacing;
      }

      setProgress("Generating PDF document...");
      const resultBlob = doc.output("blob");
      setConvertedBlob(resultBlob);
      setConvertedSize(resultBlob.size);
      setTotalPages(pagesCount);
    } catch (err: any) {
      console.error("Docx to PDF Conversion Error:", err);
      setError(err?.message || "Failed to convert Word document to PDF. Verify the file is not password-protected.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvert = () => {
    if (mode === "pdf-to-docx") {
      handlePdfToDocx();
    } else {
      handleDocxToPdf();
    }
  };

  const handleDownload = () => {
    if (!convertedBlob || !file) return;

    const extension = mode === "pdf-to-docx" ? ".docx" : ".pdf";
    const newName = file.name.substring(0, file.name.lastIndexOf(".")) + "_converted" + extension;

    const url = URL.createObjectURL(convertedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = newName;
    document.body.appendChild(a);
    a.click();
    
    // Clean up url
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleReset = () => {
    setFile(null);
    setConvertedBlob(null);
    setConvertedSize(0);
    setTotalPages(0);
    setError(null);
    setProgress("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={styles.container}>
      {/* Direction Toggle Tab Headers */}
      <div className={styles.directionTabs}>
        <button
          type="button"
          className={`${styles.directionBtn} ${mode === "pdf-to-docx" ? styles.directionBtnActive : ""}`}
          onClick={() => handleModeChange("pdf-to-docx")}
          disabled={isLoading}
        >
          <RefreshCw size={14} />
          PDF to Word (.docx)
        </button>
        <button
          type="button"
          className={`${styles.directionBtn} ${mode === "docx-to-pdf" ? styles.directionBtnActive : ""}`}
          onClick={() => handleModeChange("docx-to-pdf")}
          disabled={isLoading}
        >
          <RefreshCw size={14} />
          Word (.docx) to PDF
        </button>
      </div>

      <div className={styles.workspaceGrid}>
        {/* Converter Workspace Panel */}
        <section className={`${styles.panel} glass-panel`}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <FileUp size={20} />
              {mode === "pdf-to-docx" ? "PDF to Microsoft Word" : "Word to PDF Document"}
            </h3>
          </div>

          <div className={styles.panelBody}>
            {isLoading ? (
              /* Loading Progress Frame */
              <div className={styles.progressPanel}>
                <Loader2 className={styles.progressSpinner} size={48} />
                <div className={styles.progressTitle}>Converting Document...</div>
                <div className={styles.progressSubtitle}>{progress}</div>
                {totalPages > 0 && mode === "pdf-to-docx" && (
                  <div className={styles.progressBarTrack}>
                    <div 
                      className={styles.progressBarFill} 
                      style={{ 
                        width: `${progress.includes("page") ? (parseInt(progress.match(/\d+/)?.[0] || "0") / totalPages) * 100 : 0}%` 
                      }}
                    />
                  </div>
                )}
              </div>
            ) : convertedBlob ? (
              /* Success Download Card */
              <div className={styles.successCard}>
                <div className={styles.successIconWrapper}>
                  <Check size={28} />
                </div>
                <span className={styles.successTitle}>Conversion Successful!</span>
                <span className={styles.successSubtitle}>
                  Your file is ready for download. It was generated entirely locally to protect your data.
                </span>
                
                <div style={{ marginTop: "1rem", width: "100%" }}>
                  <div className={styles.fileInfoCard}>
                    <div className={`${styles.fileIconWrapper} ${mode === "pdf-to-docx" ? styles.fileIconWord : ""}`}>
                      <FileText size={24} />
                    </div>
                    <div className={styles.fileDetails}>
                      <span className={styles.fileName}>
                        {file?.name.substring(0, file.name.lastIndexOf(".")) + "_converted" + (mode === "pdf-to-docx" ? ".docx" : ".pdf")}
                      </span>
                      <span className={styles.fileMeta}>
                        {formatBytes(convertedSize)} {totalPages > 0 && `• ${totalPages} Pages`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : file ? (
              /* File Loaded Details Frame */
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", justifyContent: "center", height: "100%" }}>
                <div className={styles.fileInfoCard}>
                  <div className={`${styles.fileIconWrapper} ${mode === "docx-to-pdf" ? styles.fileIconWord : ""}`}>
                    <FileText size={24} />
                  </div>
                  <div className={styles.fileDetails}>
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileMeta}>
                      {formatBytes(file.size)} {totalPages > 0 && `• ${totalPages} Pages`}
                    </span>
                  </div>
                </div>

                {/* Privacy Local Processing Banner */}
                <div className={styles.disclaimerBox} style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399" }}>
                  <Info className={styles.disclaimerIcon} size={18} style={{ color: "#34d399", marginTop: "2px" }} />
                  <div className={styles.disclaimerText}>
                    <strong style={{ color: "white", display: "block", marginBottom: "0.25rem" }}>🔒 100% Client-Side Conversion</strong>
                    For absolute privacy, all document text-extraction and layout compilations run right inside your browser. No files are uploaded to any server.
                  </div>
                </div>

                {error && (
                  <div className={styles.alertDanger}>
                    <AlertTriangle size={14} className={styles.disclaimerIcon} />
                    <span>{error}</span>
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
                  accept={mode === "pdf-to-docx" ? ".pdf" : ".docx"}
                  style={{ display: "none" }}
                />
                <FileUp className={styles.uploadIcon} size={48} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <p className={styles.uploadTitle}>
                    {mode === "pdf-to-docx" ? "Upload PDF Document" : "Upload Word Document (.docx)"}
                  </p>
                  <p className={styles.uploadSubtitle}>
                    Drag and drop file here, or click to browse
                  </p>
                  <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                    🔒 Strictly local conversion. Files never leave your device. (Max 25 pages)
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Side Panel Actions & Controls */}
        <section className={`${styles.panel} glass-panel`}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <Sparkles size={20} />
              Controls & Actions
            </h3>
          </div>

          <div className={styles.panelBody} style={{ minHeight: "auto", gap: "1.25rem" }}>
            <div className={styles.optionGroup}>
              <h4 className={styles.optionTitle}>Conversion Settings</h4>
              <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", margin: 0, lineHeight: "1.5" }}>
                {mode === "pdf-to-docx" 
                  ? "Extracts formatting structures, lines, and spacings, generating a structured Word file with standard typography."
                  : "Transforms Word formatting nodes (paragraphs, bullet points, headers) into clean vector PDF elements."
                }
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--color-text-muted)", background: "rgba(255,255,255,0.02)", padding: "0.5rem", borderRadius: "4px" }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>Limit restriction: Max 25 pages document size.</span>
              </div>
            </div>

            <div className={styles.actionBtnRow}>
              {convertedBlob ? (
                <>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className={`${styles.primaryBtn} accent-gradient`}
                  >
                    <Download size={18} />
                    Download Converted File
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className={styles.secondaryBtn}
                  >
                    <RefreshCw size={16} />
                    Convert Another File
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={!file || !!error || isLoading}
                  className={`${styles.primaryBtn} accent-gradient`}
                  style={{ opacity: (!file || !!error) ? 0.5 : 1, cursor: (!file || !!error) ? "not-allowed" : "pointer" }}
                >
                  <Sparkles size={18} />
                  Convert Document Now
                </button>
              )}
              {file && !convertedBlob && (
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
