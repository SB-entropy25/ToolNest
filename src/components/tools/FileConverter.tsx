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
import { track } from "@vercel/analytics";
import styles from "./FileConverter.module.css";

type ConversionMode = "pdf-to-docx" | "docx-to-pdf" | "md-to-pdf";

interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  color: string | null;
  underline: boolean;
  url: string | null;
  font: string;
  fontSize: number;
  strikethrough?: boolean;
}

interface ExtractStyles {
  bold?: boolean;
  italic?: boolean;
  color?: string | null;
  underline?: boolean;
  url?: string | null;
  font?: string;
  fontSize?: number;
  strikethrough?: boolean;
}

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
  const [isVisualConversion, setIsVisualConversion] = useState<boolean>(false);
  const [includeFileNameHeader, setIncludeFileNameHeader] = useState<boolean>(true);

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
    } else if (mode === "docx-to-pdf") {
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
    } else {
      // md-to-pdf
      const isMd = name.endsWith(".md") || selectedFile.type === "text/markdown" || selectedFile.type === "text/plain";
      if (!isMd) {
        setError("Please upload a valid Markdown document (.md).");
        return;
      }
      
      if (selectedFile.size > 1 * 1024 * 1024) {
        setError("Markdown document is too large. Please upload a file smaller than 1 MB.");
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

      // Helper to fetch pdf.js page objects asynchronously with callback/timeout safety
      const getPdfObject = (key: string, page: any): Promise<any> => {
        return new Promise((resolve) => {
          let resolved = false;
          
          const done = (obj: any) => {
            if (!resolved) {
              resolved = true;
              resolve(obj);
            }
          };
          
          // Try page.objs cache with callback
          try {
            page.objs.get(key, (obj: any) => {
              if (obj) done(obj);
            });
          } catch (e) {}
          
          // Try commonObjs cache with callback
          try {
            page.commonObjs.get(key, (obj: any) => {
              if (obj) done(obj);
            });
          } catch (e) {}
          
          // Fallback timeout to prevent hanging
          setTimeout(() => {
            if (!resolved) {
              try {
                const syncObj = page.objs.get(key) || page.commonObjs.get(key);
                done(syncObj || null);
              } catch (e) {
                done(null);
              }
            }
          }, 1500);
        });
      };

      // Helper to check if an object is drawable by canvas 2D context drawImage
      const isDrawable = (obj: any) => {
        if (!obj) return false;
        return (
          obj instanceof HTMLImageElement ||
          obj instanceof HTMLCanvasElement ||
          obj instanceof ImageBitmap ||
          (typeof window !== "undefined" && (window as any).OffscreenCanvas && obj instanceof (window as any).OffscreenCanvas)
        );
      };

      // Add a header/title indicating conversion source
      if (includeFileNameHeader) {
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
      }

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
        let lastRowY = 0;

        for (let j = 0; j < ops.fnArray.length; j++) {
          const fn = ops.fnArray[j];
          const args = ops.argsArray[j];
          
          if (fn === pdfjs.OPS.transform) {
            ctm = args;
          } else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
            const imgKey = args[0];
            try {
              const imgObj = await getPdfObject(imgKey, page);
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
                  } else if (isDrawable(imgObj)) {
                    ctx.drawImage(imgObj, 0, 0);
                  } else {
                    console.warn("Skipping non-drawable PDF image object type:", imgObj);
                    continue;
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

        // Preprocess text items to split any single text runs containing tab-like spaces (3 or more spaces)
        const splitTextItems: any[] = [];
        textItems.forEach((item) => {
          const str = item.str || "";
          const parts = str.split(/\s{3,}/);
          if (parts.length > 1) {
            let currentOffset = 0;
            const totalChars = str.length;
            const totalWidth = item.width || 0;
            
            parts.forEach((part: string) => {
              if (!part.trim()) return;
              
              const partIndex = str.indexOf(part, currentOffset);
              const pct = partIndex / totalChars;
              const partX = item.transform[4] + pct * totalWidth;
              const partWidth = (part.length / totalChars) * totalWidth;
              
              splitTextItems.push({
                ...item,
                str: part,
                width: partWidth,
                transform: [
                  item.transform[0],
                  item.transform[1],
                  item.transform[2],
                  item.transform[3],
                  partX,
                  item.transform[5]
                ]
              });
              
              currentOffset = partIndex + part.length;
            });
          } else {
            splitTextItems.push(item);
          }
        });

        // Group text items by line Y-coordinate
        const lineMap: { [key: number]: any[] } = {};
        splitTextItems.forEach((item) => {
          const y = Math.round(item.transform[5]);
          const closeY = Object.keys(lineMap).find((k) => Math.abs(parseInt(k) - y) < 8);
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
            
            const cells: { textRuns: any[], text: string, startX: number }[] = [];
            let currentCellRuns: any[] = [];
            let currentCellText = "";
            let lastItemX = 0;
            let lastItemWidth = 0;
            let currentCellStartX = startX;
            
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
                  text: currentCellText,
                  startX: currentCellStartX
                });
                currentCellRuns = [];
                currentCellText = "";
                currentCellStartX = x;
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
                text: currentCellText,
                startX: currentCellStartX
              });
            }

            const lineFullText = cells.map(c => c.text).join("");
            if (lineFullText.trim()) {
              totalCharactersExtracted += lineFullText.length;
              
              // Force a new row if the line starts with a new index (e.g. "1.", "2.")
              const startsWithIndex = /^\s*\d+\b/.test(lineFullText);
              
              if (cells.length >= 2) {
                if (currentTableRows.length > 0 && Math.abs(lastRowY - yVal) < 18 && !startsWithIndex) {
                  // Merge cell runs into the existing last row columns
                  const lastRow = currentTableRows[currentTableRows.length - 1];
                  cells.forEach((newCell) => {
                    let closestColIdx = -1;
                    let minDiff = 99999;
                    for (let col = 0; col < lastRow.length; col++) {
                      const diff = Math.abs(lastRow[col].startX - newCell.startX);
                      if (diff < minDiff) {
                        minDiff = diff;
                        closestColIdx = col;
                      }
                    }
                    if (minDiff < 45 && closestColIdx !== -1) {
                      // Append text run to existing cell with a line break
                      lastRow[closestColIdx].textRuns.push(
                        new TextRun({ text: "\n", font: "Arial" }),
                        ...newCell.textRuns
                      );
                      lastRow[closestColIdx].text += " " + newCell.text;
                    }
                  });
                } else {
                  currentTableRows.push(cells);
                  lastRowY = yVal;
                }
              } else if (currentTableRows.length > 0) {
                // Single cell aligned with active table columns
                const firstRow = currentTableRows[0];
                const cellStartX = cells[0].startX;
                
                let closestColIdx = -1;
                let minDiff = 99999;
                for (let col = 0; col < firstRow.length; col++) {
                  const diff = Math.abs(firstRow[col].startX - cellStartX);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestColIdx = col;
                  }
                }
                
                let overlapsNextColumn = false;
                if (closestColIdx !== -1 && closestColIdx < firstRow.length - 1) {
                  const nextColStartX = firstRow[closestColIdx + 1].startX;
                  const rightX = Math.max(...lineItems.map((item: any) => item.transform[4] + (item.width || 0)));
                  if (rightX > nextColStartX - 15) {
                    overlapsNextColumn = true;
                  }
                }
                
                if (minDiff < 45 && closestColIdx !== -1 && !overlapsNextColumn) {
                  const lastRow = currentTableRows[currentTableRows.length - 1];
                  if (Math.abs(lastRowY - yVal) < 18 && !startsWithIndex) {
                    lastRow[closestColIdx].textRuns.push(
                      new TextRun({ text: "\n", font: "Arial" }),
                      ...cells[0].textRuns
                    );
                    lastRow[closestColIdx].text += " " + cells[0].text;
                  } else {
                    const paddedRow = Array.from({ length: firstRow.length }, (_, col) => {
                      if (col === closestColIdx) {
                        return cells[0];
                      } else {
                        return {
                          textRuns: [],
                          text: "",
                          startX: firstRow[col].startX
                        };
                      }
                    });
                    currentTableRows.push(paddedRow);
                    lastRowY = yVal;
                  }
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
              } else {
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
        setIsVisualConversion(true);
        setProgress("No selectable text layer found. Rendering high-fidelity page snapshots...");
        
        docParagraphs.length = 0; // Clear text nodes
        
        for (let i = 1; i <= numPages; i++) {
          setProgress(`Rendering page ${i} of ${numPages} visually...`);
          const page = await pdfDoc.getPage(i);
          
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for premium sharpness
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          if (ctx) {
            await page.render({
              canvasContext: ctx,
              viewport: viewport
            }).promise;
            
            const dataUrl = canvas.toDataURL("image/png");
            
            docParagraphs.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: dataURLToArrayBuffer(dataUrl),
                    transformation: {
                      width: 500, // fits standard page printable area nicely
                      height: Math.round(500 * (viewport.height / viewport.width)),
                    },
                    type: "png",
                  })
                ],
                alignment: "center",
                spacing: { after: 120 }
              })
            );
            
            if (i < numPages) {
              docParagraphs.push(
                new Paragraph({
                  children: [new PageBreak()]
                })
              );
            }
          }
        }
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
      if (includeFileNameHeader) {
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.text(file.name.replace(".docx", ""), margin, y + 18);
        y += 40;
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



      const extractSegments = (node: Node, currentStyles: ExtractStyles = {}): TextSegment[] => {
        const styles = {
          bold: currentStyles.bold || false,
          italic: currentStyles.italic || false,
          color: currentStyles.color || null,
          underline: currentStyles.underline || false,
          url: currentStyles.url || null,
          font: currentStyles.font || "Helvetica",
          fontSize: currentStyles.fontSize || 10.5,
          strikethrough: currentStyles.strikethrough || false
        };
        
        let segments: TextSegment[] = [];
        
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent) {
            segments.push({
              text: node.textContent,
              ...styles
            });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          
          let newStyles = { ...styles };
          if (tag === "strong" || tag === "b") newStyles.bold = true;
          if (tag === "em" || tag === "i") newStyles.italic = true;
          if (tag === "u" || tag === "ins") newStyles.underline = true;
          if (tag === "del" || tag === "s" || tag === "strike") newStyles.strikethrough = true;
          if (tag === "a") {
            const href = el.getAttribute("href");
            if (href) {
              newStyles.url = href;
              newStyles.color = "#4f46e5"; // default link color
              newStyles.underline = true;
            }
          }
          
          // Parse custom font family style
          const styleFont = el.style.fontFamily || el.getAttribute("face");
          if (styleFont) {
            const fontLower = styleFont.toLowerCase();
            if (fontLower.includes("times") || fontLower.includes("serif") || fontLower.includes("georgia") || fontLower.includes("roman") || fontLower.includes("algerian") || fontLower.includes("cambria") || fontLower.includes("garamond")) {
              newStyles.font = "Times";
            } else if (fontLower.includes("courier") || fontLower.includes("mono") || fontLower.includes("consolas") || fontLower.includes("code")) {
              newStyles.font = "Courier";
            } else {
              newStyles.font = "Helvetica";
            }
          }

          // Parse custom font size style
          const styleFontSize = el.style.fontSize;
          if (styleFontSize) {
            const sizeVal = parseFloat(styleFontSize);
            if (!isNaN(sizeVal) && sizeVal > 0) {
              if (styleFontSize.endsWith("pt")) {
                newStyles.fontSize = sizeVal;
              } else if (styleFontSize.endsWith("px")) {
                newStyles.fontSize = sizeVal * 0.75; // px to pt approximation
              } else if (styleFontSize.endsWith("em")) {
                newStyles.fontSize = (currentStyles.fontSize || 10.5) * sizeVal;
              }
            }
          }

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

      const renderElement = async (el: HTMLElement) => {
        const tag = el.tagName.toLowerCase();
        
        const ensurePageSpace = (neededHeight: number) => {
          if (y + neededHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
            pagesCount++;
            
            if (pagesCount > 25) {
              throw new Error("The compiled PDF exceeds the 25-page limit constraint. Please shorten your Word file.");
            }
          }
        };

        if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "p" || tag === "blockquote") {
          let baseFontSize = 10.5;
          let baseSpacing = 8;
          let elementBold = false;
          let elementItalic = false;
          let leftOffset = margin;
          
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
          } else if (tag === "blockquote") {
            baseFontSize = 10;
            elementItalic = true;
            leftOffset = margin + 20;
          }
          
          const segments = extractSegments(el, { 
            bold: elementBold, 
            italic: elementItalic, 
            color: null, 
            underline: false,
            font: "Helvetica",
            fontSize: baseFontSize
          });
          if (segments.length === 0) return;
          
          interface RenderLine {
            x: number;
            yOffset: number;
            runs: TextSegment[];
          }
          
          const lines: RenderLine[] = [];
          let currentLineRuns: TextSegment[] = [];
          let currentX = leftOffset;
          
          segments.forEach((seg) => {
            const fontStyle = seg.bold && seg.italic ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
            doc.setFont(seg.font, fontStyle);
            doc.setFontSize(seg.fontSize);
            
            const words = seg.text.split(/(\s+)/);
            words.forEach((word) => {
              if (!word) return;
              const wordWidth = doc.getTextWidth(word);
              
              if (currentX + wordWidth > pageWidth - margin) {
                const maxLineFontSize = Math.max(...currentLineRuns.map(r => r.fontSize), baseFontSize);
                lines.push({ x: leftOffset, yOffset: maxLineFontSize * 1.25, runs: currentLineRuns });
                currentLineRuns = [];
                currentX = leftOffset;
              }
              
              currentLineRuns.push({
                text: word,
                bold: seg.bold,
                italic: seg.italic,
                color: seg.color,
                underline: seg.underline,
                url: seg.url,
                font: seg.font,
                fontSize: seg.fontSize
              });
              currentX += wordWidth;
            });
          });
          
          if (currentLineRuns.length > 0) {
            const maxLineFontSize = Math.max(...currentLineRuns.map(r => r.fontSize), baseFontSize);
            lines.push({ x: leftOffset, yOffset: maxLineFontSize * 1.25, runs: currentLineRuns });
          }
          
          lines.forEach((line) => {
            ensurePageSpace(line.yOffset + 4);
            
            let drawX = line.x;
            if (tag === "blockquote" && drawX === leftOffset) {
              doc.setDrawColor(203, 213, 225);
              doc.setLineWidth(2);
              doc.line(margin + 5, y, margin + 5, y + line.yOffset);
            }
            
            line.runs.forEach((run) => {
              const fontStyle = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
              doc.setFont(run.font, fontStyle);
              doc.setFontSize(run.fontSize);
              
              if (run.color) {
                const parsed = parseColorString(run.color);
                if (parsed) doc.setTextColor(parsed.r, parsed.g, parsed.b);
                else doc.setTextColor(30, 41, 59);
              } else {
                doc.setTextColor(30, 41, 59);
              }
              
              doc.text(run.text, drawX, y + run.fontSize);
              
              const w = doc.getTextWidth(run.text);
              if (run.url) {
                doc.link(drawX, y, w, run.fontSize * 1.2, { url: run.url });
              }
              
              if (run.underline) {
                doc.setDrawColor(run.url ? 79 : 30, run.url ? 70 : 41, run.url ? 229 : 59);
                doc.setLineWidth(0.5);
                doc.line(drawX, y + run.fontSize + 1.5, drawX + w, y + run.fontSize + 1.5);
              }
              
              if (run.strikethrough) {
                if (run.color) {
                  const parsed = parseColorString(run.color);
                  if (parsed) doc.setDrawColor(parsed.r, parsed.g, parsed.b);
                  else doc.setDrawColor(30, 41, 59);
                } else {
                  doc.setDrawColor(30, 41, 59);
                }
                doc.setLineWidth(0.5);
                doc.line(drawX, y + run.fontSize * 0.65, drawX + w, y + run.fontSize * 0.65);
              }
              
              drawX += w;
            });
            
            y += line.yOffset;
          });
          
          y += baseSpacing;
        } else if (tag === "ul" || tag === "ol") {
          const listItems = Array.from(el.children) as HTMLElement[];
          for (let idx = 0; idx < listItems.length; idx++) {
            const li = listItems[idx];
            if (li.tagName.toLowerCase() !== "li") continue;
            
            const baseFontSize = 10.5;
            const segments = extractSegments(li, { 
              bold: false, 
              italic: false, 
              color: null, 
              underline: false,
              font: "Helvetica",
              fontSize: baseFontSize
            });
            
            interface RenderLine {
              runs: TextSegment[];
              yOffset: number;
            }
            const lines: RenderLine[] = [];
            let currentLineRuns: TextSegment[] = [];
            const leftOffset = margin + 24;
            let currentX = leftOffset;
            
            segments.forEach((seg) => {
              const fontStyle = seg.bold && seg.italic ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
              doc.setFont(seg.font, fontStyle);
              doc.setFontSize(seg.fontSize);
              
              const words = seg.text.split(/(\s+)/);
              words.forEach((word) => {
                if (!word) return;
                const wordWidth = doc.getTextWidth(word);
                
                if (currentX + wordWidth > pageWidth - margin) {
                  const maxLineFontSize = Math.max(...currentLineRuns.map(r => r.fontSize), baseFontSize);
                  lines.push({ runs: currentLineRuns, yOffset: maxLineFontSize * 1.25 });
                  currentLineRuns = [];
                  currentX = leftOffset;
                }
                
                currentLineRuns.push({
                  text: word,
                  bold: seg.bold,
                  italic: seg.italic,
                  color: seg.color,
                  underline: seg.underline,
                  url: seg.url,
                  font: seg.font,
                  fontSize: seg.fontSize
                });
                currentX += wordWidth;
              });
            });
            
            if (currentLineRuns.length > 0) {
              const maxLineFontSize = Math.max(...currentLineRuns.map(r => r.fontSize), baseFontSize);
              lines.push({ runs: currentLineRuns, yOffset: maxLineFontSize * 1.25 });
            }
            
            lines.forEach((line, lineIdx) => {
              ensurePageSpace(line.yOffset + 4);
              
              if (lineIdx === 0) {
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(baseFontSize);
                doc.setTextColor(79, 70, 229);
                
                if (tag === "ul") {
                  doc.circle(margin + 12, y + baseFontSize / 2 + 1, 2, "F");
                } else {
                  doc.text(`${idx + 1}.`, margin + 8, y + baseFontSize);
                }
              }
              
              let drawX = leftOffset;
              line.runs.forEach((run) => {
                const fontStyle = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
                doc.setFont(run.font, fontStyle);
                doc.setFontSize(run.fontSize);
                
                if (run.color) {
                  const parsed = parseColorString(run.color);
                  if (parsed) doc.setTextColor(parsed.r, parsed.g, parsed.b);
                  else doc.setTextColor(30, 41, 59);
                } else {
                  doc.setTextColor(30, 41, 59);
                }
                
                doc.text(run.text, drawX, y + run.fontSize);
                
                const w = doc.getTextWidth(run.text);
                if (run.underline || run.url) {
                  doc.setDrawColor(run.url ? 79 : 30, run.url ? 70 : 41, run.url ? 229 : 59);
                  doc.setLineWidth(0.5);
                  doc.line(drawX, y + run.fontSize + 1.5, drawX + w, y + run.fontSize + 1.5);
                }
                
                if (run.strikethrough) {
                  if (run.color) {
                    const parsed = parseColorString(run.color);
                    if (parsed) doc.setDrawColor(parsed.r, parsed.g, parsed.b);
                    else doc.setDrawColor(30, 41, 59);
                  } else {
                    doc.setDrawColor(30, 41, 59);
                  }
                  doc.setLineWidth(0.5);
                  doc.line(drawX, y + run.fontSize * 0.65, drawX + w, y + run.fontSize * 0.65);
                }
                
                drawX += w;
              });
              
              y += line.yOffset;
            });
            
            y += 4;
          }
          y += 6;
        } else if (tag === "table") {
          const rows = Array.from(el.querySelectorAll("tr")) as HTMLElement[];
          if (rows.length === 0) return;
          
          let maxCols = 0;
          rows.forEach((row) => {
            const cellsCount = row.querySelectorAll("td, th").length;
            if (cellsCount > maxCols) maxCols = cellsCount;
          });
          
          if (maxCols === 0) return;
          
          const colWidth = maxWidth / maxCols;
          const cellPadding = 6;
          const baseFontSize = 9.5;
          
          for (let rIdx = 0; rIdx < rows.length; rIdx++) {
            const row = rows[rIdx];
            const cells = Array.from(row.querySelectorAll("td, th")) as HTMLElement[];
            
            const cellContents = cells.map((cell) => {
              const segments = extractSegments(cell, { 
                bold: rIdx === 0, 
                italic: false, 
                color: null, 
                underline: false,
                font: "Helvetica",
                fontSize: baseFontSize
              });
              
              const lines: TextSegment[][] = [];
              let currentLineRuns: TextSegment[] = [];
              let currentX = cellPadding;
              const cellTextWidth = colWidth - cellPadding * 2;
              
              segments.forEach((seg) => {
                const fontStyle = seg.bold && seg.italic ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
                doc.setFont(seg.font, fontStyle);
                doc.setFontSize(seg.fontSize);
                
                const words = seg.text.split(/(\s+)/);
                words.forEach((word) => {
                  if (!word) return;
                  const wordWidth = doc.getTextWidth(word);
                  
                  if (currentX + wordWidth > cellTextWidth + cellPadding) {
                    lines.push(currentLineRuns);
                    currentLineRuns = [];
                    currentX = cellPadding;
                  }
                  currentLineRuns.push({
                    text: word,
                    bold: seg.bold,
                    italic: seg.italic,
                    color: seg.color,
                    underline: seg.underline,
                    url: seg.url,
                    font: seg.font,
                    fontSize: seg.fontSize
                  });
                  currentX += wordWidth;
                });
              });
              if (currentLineRuns.length > 0) {
                lines.push(currentLineRuns);
              }
              
              return lines;
            });
            
            const maxLinesInCell = Math.max(...cellContents.map((lines) => lines.length), 1);
            const rowHeight = maxLinesInCell * baseFontSize * 1.35 + cellPadding * 2;
            
            ensurePageSpace(rowHeight);
            
            for (let cIdx = 0; cIdx < maxCols; cIdx++) {
              const cellX = margin + cIdx * colWidth;
              
              if (rIdx === 0) {
                doc.setFillColor(241, 245, 249);
                doc.rect(cellX, y, colWidth, rowHeight, "F");
              } else if (rIdx % 2 === 1) {
                doc.setFillColor(250, 250, 250);
                doc.rect(cellX, y, colWidth, rowHeight, "F");
              }
              
              doc.setDrawColor(226, 232, 240);
              doc.setLineWidth(1);
              doc.rect(cellX, y, colWidth, rowHeight, "S");
              
              if (cIdx < cellContents.length) {
                const cellLines = cellContents[cIdx];
                let textY = y + cellPadding;
                
                cellLines.forEach((line) => {
                  let drawX = cellX + cellPadding;
                  
                  line.forEach((run) => {
                    const fontStyle = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
                    doc.setFont(run.font, fontStyle);
                    doc.setFontSize(run.fontSize);
                    
                    if (run.color) {
                      const parsed = parseColorString(run.color);
                      if (parsed) doc.setTextColor(parsed.r, parsed.g, parsed.b);
                      else doc.setTextColor(30, 41, 59);
                    } else {
                      doc.setTextColor(30, 41, 59);
                    }
                    
                    doc.text(run.text, drawX, textY + run.fontSize);
                    
                    const w = doc.getTextWidth(run.text);
                    if (run.url) {
                      doc.link(drawX, textY, w, run.fontSize * 1.2, { url: run.url });
                      doc.setDrawColor(79, 70, 229);
                      doc.setLineWidth(0.5);
                      doc.line(drawX, textY + run.fontSize + 1.5, drawX + w, textY + run.fontSize + 1.5);
                    }
                    
                    drawX += w;
                  });
                  textY += baseFontSize * 1.35;
                });
              }
            }
            
            y += rowHeight;
          }
          y += 12;
        }
      };

      for (const el of elements) {
        await renderElement(el as HTMLElement);
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

  // Markdown to PDF Conversion Logic
  const handleMdToPdf = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setProgress("Reading Markdown file...");

    try {
      const text = await file.text();
      setProgress("Generating PDF document page layouts...");

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const margin = 54;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;

      let y = margin;
      let pagesCount = 1;

      // Draw document title
      if (includeFileNameHeader) {
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.text(file.name.replace(".md", ""), margin, y + 18);
        y += 40;
      }

      const ensurePageSpace = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
          pagesCount++;
          if (pagesCount > 25) {
            throw new Error("The compiled PDF exceeds the 25-page limit constraint.");
          }
        }
      };

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
        return null;
      };

      // Inline markdown parser (bold, italic, links, code, strikethrough, naked urls)
      const parseMarkdownInline = (rawText: string, defaultBold = false, defaultItalic = false): TextSegment[] => {
        // Clean special Unicode characters to compatible ASCII representations
        rawText = rawText
          .replace(/[\u2192\u27f6]/g, "->")
          .replace(/[\u2190\u27f5]/g, "<-")
          .replace(/[\u2705\u2714\u2713]/g, "[Working]") // checkmarks ✅ ✔ ✓
          .replace(/[\u274c\u274e]/g, "[X]"); // cross marks ❌

        const segments: TextSegment[] = [];
        const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\))|((https?:\/\/[a-zA-Z0-9-._~:\/?#\[\]@!$&'()*+,;=%]+))|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(~~([^~]+)~~)|(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)/g;
        
        let match;
        let lastIndex = 0;
        
        while ((match = tokenRegex.exec(rawText)) !== null) {
          if (match.index > lastIndex) {
            segments.push({
              text: rawText.substring(lastIndex, match.index),
              bold: defaultBold,
              italic: defaultItalic,
              color: null,
              underline: false,
              strikethrough: false,
              url: null,
              font: "Helvetica",
              fontSize: 10.5
            });
          }
          
          const matchedStr = match[0];
          
          if (matchedStr.startsWith("[")) {
            // Markdown Link: [label](url)
            segments.push({
              text: match[2],
              bold: defaultBold,
              italic: defaultItalic,
              color: "#4f46e5",
              underline: true,
              strikethrough: false,
              url: match[3],
              font: "Helvetica",
              fontSize: 10.5
            });
          } else if (matchedStr.startsWith("http://") || matchedStr.startsWith("https://")) {
            // Naked URL
            segments.push({
              text: matchedStr,
              bold: defaultBold,
              italic: defaultItalic,
              color: "#4f46e5",
              underline: true,
              strikethrough: false,
              url: matchedStr,
              font: "Helvetica",
              fontSize: 10.5
            });
          } else if (matchedStr.startsWith("***")) {
            // Bold-Italic
            segments.push({
              text: match[7],
              bold: true,
              italic: true,
              color: null,
              underline: false,
              strikethrough: false,
              url: null,
              font: "Helvetica",
              fontSize: 10.5
            });
          } else if (matchedStr.startsWith("**") || matchedStr.startsWith("__")) {
            // Bold
            segments.push({
              text: match[9] || match[11],
              bold: true,
              italic: defaultItalic,
              color: null,
              underline: false,
              strikethrough: false,
              url: null,
              font: "Helvetica",
              fontSize: 10.5
            });
          } else if (matchedStr.startsWith("~~")) {
            // Strikethrough
            segments.push({
              text: match[13],
              bold: defaultBold,
              italic: defaultItalic,
              color: null,
              underline: false,
              strikethrough: true,
              url: null,
              font: "Helvetica",
              fontSize: 10.5
            });
          } else if (matchedStr.startsWith("*") || matchedStr.startsWith("_")) {
            // Italic
            segments.push({
              text: match[15] || match[17],
              bold: defaultBold,
              italic: true,
              color: null,
              underline: false,
              strikethrough: false,
              url: null,
              font: "Helvetica",
              fontSize: 10.5
            });
          } else if (matchedStr.startsWith("`")) {
            // Inline Code
            segments.push({
              text: match[19],
              bold: defaultBold,
              italic: defaultItalic,
              color: "#0f172a",
              underline: false,
              strikethrough: false,
              url: null,
              font: "Courier",
              fontSize: 9.5
            });
          }
          
          lastIndex = tokenRegex.lastIndex;
        }
        
        if (lastIndex < rawText.length) {
          segments.push({
            text: rawText.substring(lastIndex),
            bold: defaultBold,
            italic: defaultItalic,
            color: null,
            underline: false,
            strikethrough: false,
            url: null,
            font: "Helvetica",
            fontSize: 10.5
          });
        }
        
        return segments;
      };

      const renderSegments = (segments: TextSegment[], baseFontSize: number, baseSpacing: number, leftOffset = margin, isBlockquote = false) => {
        if (segments.length === 0) return;
        
        interface RenderLine {
          x: number;
          yOffset: number;
          runs: TextSegment[];
        }
        
        const lines: RenderLine[] = [];
        let currentLineRuns: TextSegment[] = [];
        let currentX = leftOffset;
        
        segments.forEach((seg) => {
          const fontStyle = seg.bold && seg.italic ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
          doc.setFont(seg.font, fontStyle);
          doc.setFontSize(seg.fontSize);
          
          const words = seg.text.split(/(\s+)/);
          words.forEach((word) => {
            if (!word) return;
            const wordWidth = doc.getTextWidth(word);
            
            if (currentX + wordWidth > pageWidth - margin) {
              const maxLineFontSize = Math.max(...currentLineRuns.map(r => r.fontSize), baseFontSize);
              lines.push({ x: leftOffset, yOffset: maxLineFontSize * 1.25, runs: currentLineRuns });
              currentLineRuns = [];
              currentX = leftOffset;
            }
            
            currentLineRuns.push({
              ...seg,
              text: word
            });
            currentX += wordWidth;
          });
        });
        
        if (currentLineRuns.length > 0) {
          const maxLineFontSize = Math.max(...currentLineRuns.map(r => r.fontSize), baseFontSize);
          lines.push({ x: leftOffset, yOffset: maxLineFontSize * 1.25, runs: currentLineRuns });
        }
        
        lines.forEach((line) => {
          ensurePageSpace(line.yOffset + 4);
          
          let drawX = line.x;
          if (isBlockquote && drawX === leftOffset) {
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(2);
            doc.line(margin + 5, y, margin + 5, y + line.yOffset);
          }
          
          line.runs.forEach((run) => {
            const fontStyle = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
            doc.setFont(run.font, fontStyle);
            doc.setFontSize(run.fontSize);
            
            if (run.color) {
              const parsed = parseColorString(run.color);
              if (parsed) doc.setTextColor(parsed.r, parsed.g, parsed.b);
              else doc.setTextColor(30, 41, 59);
            } else {
              doc.setTextColor(30, 41, 59);
            }
            
            doc.text(run.text, drawX, y + run.fontSize);
            
            const w = doc.getTextWidth(run.text);
            if (run.url) {
              doc.link(drawX, y, w, run.fontSize * 1.2, { url: run.url });
            }
            
            if (run.underline) {
              doc.setDrawColor(run.url ? 79 : 30, run.url ? 70 : 41, run.url ? 229 : 59);
              doc.setLineWidth(0.5);
              doc.line(drawX, y + run.fontSize + 1.5, drawX + w, y + run.fontSize + 1.5);
            }
            
            if (run.strikethrough) {
              if (run.color) {
                const parsed = parseColorString(run.color);
                if (parsed) doc.setDrawColor(parsed.r, parsed.g, parsed.b);
                else doc.setDrawColor(30, 41, 59);
              } else {
                doc.setDrawColor(30, 41, 59);
              }
              doc.setLineWidth(0.5);
              doc.line(drawX, y + run.fontSize * 0.65, drawX + w, y + run.fontSize * 0.65);
            }
            
            drawX += w;
          });
          
          y += line.yOffset;
        });
        
        y += baseSpacing;
      };

      const linesText = text.split(/\r?\n/);
      let inCodeBlock = false;

      let lineIdx = 0;
      while (lineIdx < linesText.length) {
        const line = linesText[lineIdx];
        const trimmed = line.trim();

        // Toggle code block
        if (trimmed.startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          lineIdx++;
          continue;
        }

        if (inCodeBlock) {
          ensurePageSpace(14);
          doc.setFillColor(248, 250, 252); // slate-50 background
          doc.rect(margin, y, maxWidth, 14, "F");
          doc.setFont("Courier", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42);
          doc.text(line, margin + 8, y + 9.5);
          y += 14;
          lineIdx++;
          continue;
        }

        // Empty line
        if (!trimmed) {
          y += 6;
          lineIdx++;
          continue;
        }

        // Horizontal Rule (3 or more dashes, asterisks, underscores)
        const hrRegex = /^[-*_]{3,}$/;
        if (hrRegex.test(trimmed)) {
          ensurePageSpace(15);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(1);
          doc.line(margin, y + 5, pageWidth - margin, y + 5);
          y += 15;
          lineIdx++;
          continue;
        }

        // Checklist Items
        const checklistRegex = /^([-*+])\s+\[([ xX])\]\s+(.*)/;
        const checklistMatch = trimmed.match(checklistRegex);
        if (checklistMatch) {
          const isChecked = checklistMatch[2].toLowerCase() === "x";
          const content = checklistMatch[3];
          const segments = parseMarkdownInline(content);
          ensurePageSpace(14);
          
          // Draw checkbox container
          doc.setDrawColor(79, 70, 229); // indigo checkbox border
          doc.setLineWidth(1);
          doc.rect(margin + 12, y + 2, 9, 9, "S");
          
          if (isChecked) {
            // Draw vector checkmark tick
            doc.setLineWidth(1.2);
            doc.line(margin + 14, y + 6, margin + 16, y + 8);
            doc.line(margin + 16, y + 8, margin + 19.5, y + 4);
          }
          
          renderSegments(segments, 10.5, 4, margin + 28);
          lineIdx++;
          continue;
        }

        // Image Placeholders
        const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/;
        const imgMatch = trimmed.match(imgRegex);
        if (imgMatch) {
          const altText = imgMatch[1] || "Image";
          ensurePageSpace(80);
          
          doc.setDrawColor(203, 213, 225); // slate-300
          doc.setLineWidth(1);
          doc.setFillColor(248, 250, 252); // slate-50 background
          doc.rect(margin, y, maxWidth, 60, "FD");
          
          doc.setFont("Helvetica", "italic");
          doc.setFontSize(9.5);
          doc.setTextColor(100, 116, 139); // slate-500
          const label = `[Image: ${altText}]`;
          const labelW = doc.getTextWidth(label);
          doc.text(label, margin + (maxWidth - labelW) / 2, y + 35);
          
          y += 70;
          lineIdx++;
          continue;
        }

        // Table Block Detection & Parsing
        const nextLine = lineIdx + 1 < linesText.length ? linesText[lineIdx + 1].trim() : "";
        const isSeparatorLine = (s: string) => /^[|\s:\-]+$/.test(s) && s.includes("-") && s.replace(/[|\s:\-]/g, "").length === 0;
        
        if (isSeparatorLine(nextLine)) {
          const headerRow = trimmed;
          const tableRows: string[] = [];
          
          let tempIdx = lineIdx + 2;
          while (tempIdx < linesText.length) {
            const rLine = linesText[tempIdx].trim();
            if (!rLine || rLine.startsWith("#") || rLine.startsWith(">") || rLine.startsWith("```")) {
              break;
            }
            tableRows.push(linesText[tempIdx]);
            tempIdx++;
          }
          
          const parseTableRowCols = (rowStr: string) => {
            let cols: string[] = [];
            if (rowStr.includes("|")) {
              cols = rowStr.split("|").map(s => s.trim());
              if (rowStr.trim().startsWith("|")) cols.shift();
              if (rowStr.trim().endsWith("|")) cols.pop();
            } else {
              cols = rowStr.trim().split(/\s{2,}/).map(s => s.trim());
            }
            return cols;
          };
          
          const headers = parseTableRowCols(headerRow);
          const bodyRows = tableRows.map(parseTableRowCols);
          const maxCols = Math.max(headers.length, ...bodyRows.map(r => r.length));
          
          if (maxCols > 0) {
            const colWidth = maxWidth / maxCols;
            const cellPadding = 6;
            const tableFontSize = 9.5;
            
            // Header Row wrap & render
            const headerCellContents = headers.map((cell) => {
              const cleanCell = cell.replace(/[\u2705\u2714\u2713]/g, "[Working]").replace(/[\u274c\u274e]/g, "[X]");
              const segments = parseMarkdownInline(cleanCell, true);
              const lines: TextSegment[][] = [];
              let currentLineRuns: TextSegment[] = [];
              let currentX = cellPadding;
              const cellTextWidth = colWidth - cellPadding * 2;
              
              segments.forEach((seg) => {
                const fontStyle = seg.bold && seg.italic ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
                doc.setFont(seg.font, fontStyle);
                doc.setFontSize(tableFontSize);
                
                const words = seg.text.split(/(\s+)/);
                words.forEach((word) => {
                  if (!word) return;
                  const wordWidth = doc.getTextWidth(word);
                  if (currentX + wordWidth > cellTextWidth + cellPadding) {
                    lines.push(currentLineRuns);
                    currentLineRuns = [];
                    currentX = cellPadding;
                  }
                  currentLineRuns.push({ ...seg, text: word });
                  currentX += wordWidth;
                });
              });
              if (currentLineRuns.length > 0) lines.push(currentLineRuns);
              return lines;
            });
            
            const maxHeaderLines = Math.max(...headerCellContents.map(l => l.length), 1);
            const headerHeight = maxHeaderLines * tableFontSize * 1.35 + cellPadding * 2;
            
            ensurePageSpace(headerHeight);
            
            for (let cIdx = 0; cIdx < maxCols; cIdx++) {
              const cellX = margin + cIdx * colWidth;
              doc.setFillColor(241, 245, 249);
              doc.rect(cellX, y, colWidth, headerHeight, "F");
              doc.setDrawColor(226, 232, 240);
              doc.setLineWidth(1);
              doc.rect(cellX, y, colWidth, headerHeight, "S");
              
              if (cIdx < headerCellContents.length) {
                const cellLines = headerCellContents[cIdx];
                let textY = y + cellPadding;
                cellLines.forEach((line) => {
                  let drawX = cellX + cellPadding;
                  line.forEach((run) => {
                    const fontStyle = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
                    doc.setFont(run.font, fontStyle);
                    doc.setFontSize(tableFontSize);
                    doc.setTextColor(30, 41, 59);
                    doc.text(run.text, drawX, textY + tableFontSize);
                    drawX += doc.getTextWidth(run.text);
                  });
                  textY += tableFontSize * 1.35;
                });
              }
            }
            y += headerHeight;
            
            // Body Rows wrap & render
            for (let rIdx = 0; rIdx < bodyRows.length; rIdx++) {
              const rowCols = bodyRows[rIdx];
              const cellContents = rowCols.map((cell) => {
                const cleanCell = cell.replace(/[\u2705\u2714\u2713]/g, "[Working]").replace(/[\u274c\u274e]/g, "[X]");
                const segments = parseMarkdownInline(cleanCell);
                const lines: TextSegment[][] = [];
                let currentLineRuns: TextSegment[] = [];
                let currentX = cellPadding;
                const cellTextWidth = colWidth - cellPadding * 2;
                
                segments.forEach((seg) => {
                  const fontStyle = seg.bold && seg.italic ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
                  doc.setFont(seg.font, fontStyle);
                  doc.setFontSize(tableFontSize);
                  
                  const words = seg.text.split(/(\s+)/);
                  words.forEach((word) => {
                    if (!word) return;
                    const wordWidth = doc.getTextWidth(word);
                    if (currentX + wordWidth > cellTextWidth + cellPadding) {
                      lines.push(currentLineRuns);
                      currentLineRuns = [];
                      currentX = cellPadding;
                    }
                    currentLineRuns.push({ ...seg, text: word });
                    currentX += wordWidth;
                  });
                });
                if (currentLineRuns.length > 0) lines.push(currentLineRuns);
                return lines;
              });
              
              const maxBodyLines = Math.max(...cellContents.map(l => l.length), 1);
              const rowHeight = maxBodyLines * tableFontSize * 1.35 + cellPadding * 2;
              
              ensurePageSpace(rowHeight);
              
              for (let cIdx = 0; cIdx < maxCols; cIdx++) {
                const cellX = margin + cIdx * colWidth;
                if (rIdx % 2 === 0) {
                  doc.setFillColor(250, 250, 250);
                  doc.rect(cellX, y, colWidth, rowHeight, "F");
                }
                
                doc.setDrawColor(226, 232, 240);
                doc.setLineWidth(1);
                doc.rect(cellX, y, colWidth, rowHeight, "S");
                
                if (cIdx < cellContents.length) {
                  const cellLines = cellContents[cIdx];
                  let textY = y + cellPadding;
                  cellLines.forEach((line) => {
                    let drawX = cellX + cellPadding;
                    line.forEach((run) => {
                      const fontStyle = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
                      doc.setFont(run.font, fontStyle);
                      doc.setFontSize(run.fontSize);
                      
                      if (run.color) {
                        const parsed = parseColorString(run.color);
                        if (parsed) doc.setTextColor(parsed.r, parsed.g, parsed.b);
                        else doc.setTextColor(30, 41, 59);
                      } else {
                        doc.setTextColor(30, 41, 59);
                      }
                      
                      doc.text(run.text, drawX, textY + tableFontSize);
                      
                      const w = doc.getTextWidth(run.text);
                      if (run.url) {
                        doc.link(drawX, textY, w, tableFontSize * 1.2, { url: run.url });
                      }
                      if (run.underline) {
                        doc.setDrawColor(run.url ? 79 : 30, run.url ? 70 : 41, run.url ? 229 : 59);
                        doc.setLineWidth(0.5);
                        doc.line(drawX, textY + tableFontSize + 1.5, drawX + w, textY + tableFontSize + 1.5);
                      }
                      if (run.strikethrough) {
                        doc.setDrawColor(30, 41, 59);
                        doc.setLineWidth(0.5);
                        doc.line(drawX, textY + tableFontSize * 0.65, drawX + w, textY + tableFontSize * 0.65);
                      }
                      
                      drawX += w;
                    });
                    textY += tableFontSize * 1.35;
                  });
                }
              }
              y += rowHeight;
            }
            y += 12;
          }
          lineIdx = tempIdx;
          continue;
        }

        // Headings
        if (line.startsWith("# ")) {
          const content = line.substring(2);
          const segments = parseMarkdownInline(content, true);
          segments.forEach(s => { s.fontSize = 18; s.bold = true; });
          renderSegments(segments, 18, 16);
          lineIdx++;
          continue;
        }
        if (line.startsWith("## ")) {
          const content = line.substring(3);
          const segments = parseMarkdownInline(content, true);
          segments.forEach(s => { s.fontSize = 14; s.bold = true; });
          renderSegments(segments, 14, 12);
          lineIdx++;
          continue;
        }
        if (line.startsWith("### ")) {
          const content = line.substring(4);
          const segments = parseMarkdownInline(content, true);
          segments.forEach(s => { s.fontSize = 12; s.bold = true; });
          renderSegments(segments, 12, 10);
          lineIdx++;
          continue;
        }

        // Blockquotes
        if (line.startsWith("> ")) {
          const content = line.substring(2);
          const segments = parseMarkdownInline(content, false, true);
          segments.forEach(s => { s.italic = true; s.fontSize = 10; });
          renderSegments(segments, 10, 8, margin + 20, true);
          lineIdx++;
          continue;
        }

        // Unordered List Items
        if (line.startsWith("* ") || line.startsWith("- ") || line.startsWith("+ ")) {
          const content = line.substring(2);
          const segments = parseMarkdownInline(content);
          ensurePageSpace(14);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(79, 70, 229);
          doc.circle(margin + 12, y + 10.5 / 2 + 1, 2, "F");
          renderSegments(segments, 10.5, 4, margin + 24);
          lineIdx++;
          continue;
        }

        // Ordered List Items
        const olMatch = line.match(/^(\d+)\.\s(.*)/);
        if (olMatch) {
          const num = olMatch[1];
          const content = olMatch[2];
          const segments = parseMarkdownInline(content);
          ensurePageSpace(14);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(79, 70, 229);
          doc.text(`${num}.`, margin + 8, y + 10.5);
          renderSegments(segments, 10.5, 4, margin + 24);
          lineIdx++;
          continue;
        }

        // Normal paragraph
        const segments = parseMarkdownInline(line);
        renderSegments(segments, 10.5, 8);
        lineIdx++;
      }

      setProgress("Generating PDF document...");
      const resultBlob = doc.output("blob");
      setConvertedBlob(resultBlob);
      setConvertedSize(resultBlob.size);
      setTotalPages(pagesCount);
    } catch (err: any) {
      console.error("Markdown to PDF Conversion Error:", err);
      setError(err?.message || "Failed to convert Markdown document to PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvert = () => {
    if (mode === "pdf-to-docx") {
      handlePdfToDocx();
    } else if (mode === "docx-to-pdf") {
      handleDocxToPdf();
    } else {
      handleMdToPdf();
    }
  };

  const handleDownload = () => {
    if (!convertedBlob || !file) return;

    try {
      track("File Converted", { mode });
    } catch (e) {
      console.error("Tracking error:", e);
    }

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
    setIsVisualConversion(false);
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
        <button
          type="button"
          className={`${styles.directionBtn} ${mode === "md-to-pdf" ? styles.directionBtnActive : ""}`}
          onClick={() => handleModeChange("md-to-pdf")}
          disabled={isLoading}
        >
          <RefreshCw size={14} />
          Markdown (.md) to PDF
        </button>
      </div>

      <div className={styles.workspaceGrid}>
        {/* Converter Workspace Panel */}
        <section className={`${styles.panel} glass-panel`}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <FileUp size={20} />
              {mode === "pdf-to-docx" ? "PDF to Microsoft Word" : mode === "docx-to-pdf" ? "Word to PDF Document" : "Markdown to PDF Document"}
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

                {isVisualConversion && (
                  <div className={styles.disclaimerBox} style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", color: "#fbbf24", margin: "1rem 0 0 0", width: "100%" }}>
                    <Info className={styles.disclaimerIcon} size={18} style={{ color: "#fbbf24", marginTop: "2px" }} />
                    <div className={styles.disclaimerText} style={{ fontSize: "0.8rem", textAlign: "left" }}>
                      <strong style={{ color: "white", display: "block", marginBottom: "0.25rem" }}>ℹ️ Visual Conversion Fallback Activated</strong>
                      This PDF does not contain a selectable text layer. To preserve the original formatting, tables, logos, and checked boxes, the converter has created high-fidelity page captures.
                    </div>
                  </div>
                )}
                
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
              <>
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
                    accept={mode === "pdf-to-docx" ? ".pdf" : mode === "docx-to-pdf" ? ".docx" : ".md"}
                    style={{ display: "none" }}
                  />
                  <FileUp className={styles.uploadIcon} size={48} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <p className={styles.uploadTitle}>
                      {mode === "pdf-to-docx" ? "Upload PDF Document" : mode === "docx-to-pdf" ? "Upload Word Document (.docx)" : "Upload Markdown Document (.md)"}
                    </p>
                    <p className={styles.uploadSubtitle}>
                      Drag and drop file here, or click to browse
                    </p>
                    <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                      🔒 Strictly local conversion. Files never leave your device. {mode === "pdf-to-docx" || mode === "docx-to-pdf" ? "(Max 25 pages)" : ""}
                    </p>
                  </div>
                </div>
                
                {/* Quick Feature Instruction Guide */}
                <div style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "1.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <strong style={{ fontSize: "0.8rem", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6" }}></span>
                      PDF to Word (.docx)
                    </strong>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", lineHeight: "1.4", textAlign: "left" }}>
                      Extracts selectable texts, visual tables, and embedded images into a fully editable Microsoft Word file.
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <strong style={{ fontSize: "0.8rem", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }}></span>
                      Word to PDF (.pdf)
                    </strong>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", lineHeight: "1.4", textAlign: "left" }}>
                      Compiles paragraph margins, headers, lists, grid tables, and clickable link annotations into a vector PDF.
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <strong style={{ fontSize: "0.8rem", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#a855f7" }}></span>
                      Markdown to PDF (.pdf)
                    </strong>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", lineHeight: "1.4", textAlign: "left" }}>
                      Parses headers, blockquotes, lists, horizontal lines, and code blocks into clean vector printable layouts.
                    </span>
                  </div>
                </div>
              </>
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
              <h4 className={styles.optionTitle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <span>Conversion Settings</span>
                <span className={styles.tooltipContainer}>
                  <Info size={16} style={{ color: "var(--color-accent-light)", cursor: "help" }} />
                  <span className={styles.tooltipBox}>
                    <span className={styles.tooltipTitle}>⚠️ Client-Side Font Mapping</span>
                    Because the browser cannot access local system files (like C:\Windows\Fonts) for privacy and sandbox reasons, custom fonts are mapped to the closest standard printable typeface class:
                    <ul style={{ margin: "0.5rem 0 0 1rem", padding: 0, listStyle: "disc", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <li><strong>Serif (Algerian, Georgia)</strong> maps to Times.</li>
                      <li><strong>Sans-Serif (Calibri, Arial)</strong> maps to Helvetica.</li>
                      <li><strong>Monospace (Consolas)</strong> maps to Courier.</li>
                    </ul>
                  </span>
                </span>
              </h4>
              <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", margin: 0, lineHeight: "1.5" }}>
                {mode === "pdf-to-docx" 
                  ? "Extracts formatting structures, lines, and spacings, generating a structured Word file with standard typography."
                  : mode === "docx-to-pdf"
                    ? "Transforms Word formatting nodes (paragraphs, bullet points, headers) into clean vector PDF elements."
                    : "Parses headers, blockquotes, code-blocks, lists, and inline styles into printable vector PDF documents."
                }
              </p>

              {/* Filename Header Toggle Option */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "0.65rem 0.85rem", borderRadius: "var(--radius-sm)", border: "1px solid rgba(255,255,255,0.05)", marginTop: "0.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", textAlign: "left" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-primary)" }}>Add Filename Header</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>Include filename at top of first page</span>
                </div>
                <label style={{ position: "relative", display: "inline-block", width: "40px", height: "20px" }}>
                  <input 
                    type="checkbox" 
                    checked={includeFileNameHeader}
                    onChange={(e) => setIncludeFileNameHeader(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }} 
                  />
                  <span style={{
                    position: "absolute",
                    cursor: "pointer",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: includeFileNameHeader ? "var(--color-accent-light)" : "rgba(255,255,255,0.1)",
                    transition: "0.3s",
                    borderRadius: "20px",
                    border: "1px solid rgba(255,255,255,0.05)"
                  }}>
                    <span style={{
                      position: "absolute",
                      height: "12px",
                      width: "12px",
                      left: "4px",
                      bottom: "3px",
                      backgroundColor: "white",
                      transition: "0.3s",
                      borderRadius: "50%",
                      transform: includeFileNameHeader ? "translateX(18px)" : "none",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                    }} />
                  </span>
                </label>
              </div>

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
