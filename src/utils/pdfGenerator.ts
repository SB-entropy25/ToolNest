import { jsPDF } from "jspdf";

type LayoutType = "classic-grid" | "photo-booth-strips";
type ThemeType = "white" | "dark" | "vintage" | "neon";

export const generatePdf = (
  croppedImageDataUrl: string,
  layout: LayoutType,
  theme: ThemeType,
  bottomText: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // High-resolution canvas for 300 DPI output on 10x15 cm sheet
        // 10cm x 15cm at 300 DPI: approx 1181 x 1772 pixels
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get 2D context"));
          return;
        }

        const isLandscape = layout === "classic-grid";
        canvas.width = isLandscape ? 1772 : 1181;
        canvas.height = isLandscape ? 1181 : 1772;

        // Draw background
        ctx.fillStyle = isLandscape ? "#ffffff" : "#f0f0f2";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (layout === "classic-grid") {
          // Layout A: 4x2 Grid of standard 3.5 x 4.5 cm passport photos
          const photoW = 413; // ~3.5 cm at 300 DPI
          const photoH = 531; // ~4.5 cm at 300 DPI
          const colGap = 16;
          const rowGap = 25;
          
          // Center the grid
          const totalGridW = 4 * photoW + 3 * colGap;
          const totalGridH = 2 * photoH + 1 * rowGap;
          const startX = (canvas.width - totalGridW) / 2;
          const startY = (canvas.height - totalGridH) / 2;

          // Draw the photos
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 4; c++) {
              const x = startX + c * (photoW + colGap);
              const y = startY + r * (photoH + rowGap);

              // Draw image
              ctx.drawImage(img, x, y, photoW, photoH);

              // Draw very thin border outline around each photo for cutting
              ctx.strokeStyle = "#dddddd";
              ctx.lineWidth = 1.5;
              ctx.strokeRect(x, y, photoW, photoH);
            }
          }

          // Draw cutting guide lines (light dashed lines)
          ctx.strokeStyle = "#bbbbbb";
          ctx.lineWidth = 1;
          ctx.setLineDash([8, 8]);

          // Vertical cut lines (in the middle of gaps)
          for (let c = 0; c < 3; c++) {
            const cutX = startX + photoW + c * (photoW + colGap) + colGap / 2;
            ctx.beginPath();
            ctx.moveTo(cutX, 15);
            ctx.lineTo(cutX, canvas.height - 15);
            ctx.stroke();
          }

          // Horizontal cut line (in the middle of row gap)
          const cutY = startY + photoH + rowGap / 2;
          ctx.beginPath();
          ctx.moveTo(15, cutY);
          ctx.lineTo(canvas.width - 15, cutY);
          ctx.stroke();
          
          ctx.setLineDash([]); // Reset dashed lines
        } else {
          // Layout B: 2 Photo Booth Strips (Vertical) on 10x15 cm Portrait Page
          const stripW = 543; // 4.6 cm
          const stripH = 1654; // 14 cm
          const stripGap = 25;
          
          const totalW = 2 * stripW + stripGap;
          const startX = (canvas.width - totalW) / 2;
          const startY = (canvas.height - stripH) / 2;

          const themes = {
            white: { bg: "#ffffff", border: "#cccccc", text: "#1a1a1a", font: "Courier New" },
            dark: { bg: "#18181b", border: "#27272a", text: "#f4f4f5", font: "Courier New" },
            vintage: { bg: "#f4eae1", border: "#d4c0ae", text: "#5a4230", font: "Georgia" },
            neon: { bg: "#0f172a", border: "#ec4899", text: "#ec4899", font: "Arial" },
          };

          const currentTheme = themes[theme] || themes.white;

          for (let s = 0; s < 2; s++) {
            const x = startX + s * (stripW + stripGap);
            const y = startY;

            ctx.save();
            // Draw strip background
            ctx.fillStyle = currentTheme.bg;
            ctx.fillRect(x, y, stripW, stripH);

            // Draw strip border
            ctx.strokeStyle = currentTheme.border;
            ctx.lineWidth = theme === "neon" ? 6 : 2;
            ctx.strokeRect(x, y, stripW, stripH);

            if (theme === "neon") {
              // Add a subtle neon outer glow
              ctx.shadowColor = "#ec4899";
              ctx.shadowBlur = 10;
              ctx.strokeRect(x, y, stripW, stripH);
              ctx.shadowBlur = 0; // reset
            }

            // Draw 4 photos stacked vertically inside the strip
            const photoSize = 340; // Square format
            const photoGap = 32;
            const photoStartX = x + (stripW - photoSize) / 2;
            const photoStartY = y + 55;

            for (let p = 0; p < 4; p++) {
              const py = photoStartY + p * (photoSize + photoGap);

              ctx.save();
              // Apply sepia filter for vintage theme
              if (theme === "vintage") {
                ctx.filter = "sepia(0.8) contrast(1.1) brightness(0.95)";
              }

              // Draw image cropped to a square (1:1 aspect ratio)
              // The source image is 3.5:4.5 (width:height)
              // Crop from vertical center
              const srcCropSize = img.width; // use width as base
              const srcCropY = (img.height - srcCropSize) / 2;

              ctx.drawImage(
                img,
                0,
                srcCropY,
                srcCropSize,
                srcCropSize, // crop square source
                photoStartX,
                py,
                photoSize,
                photoSize // draw square dest
              );
              ctx.restore();

              // Draw border around photo
              ctx.strokeStyle = currentTheme.border;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(photoStartX, py, photoSize, photoSize);
            }

            // Draw Footer Text
            ctx.fillStyle = currentTheme.text;
            const fontName = currentTheme.font;
            ctx.font = `bold 24px "${fontName}"`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const textX = x + stripW / 2;
            const textY = y + stripH - 100;
            ctx.fillText((bottomText || "PHOTO BOOTH").toUpperCase(), textX, textY);
            
            ctx.restore();
          }
        }

        // Convert high-res canvas to image data
        const pdfDataUrl = canvas.toDataURL("image/jpeg", 0.96);

        // Create PDF
        // Standard 10 x 15 cm photo paper
        const orientation = isLandscape ? "landscape" : "portrait";
        const pdf = new jsPDF({
          orientation: orientation,
          unit: "mm",
          format: [100, 150], // 100 mm width, 150 mm height
        });

        // Add page image at exactly 0,0 and fit to page size
        const w = isLandscape ? 150 : 100;
        const h = isLandscape ? 100 : 150;
        pdf.addImage(pdfDataUrl, "JPEG", 0, 0, w, h);

        // Save file
        const fileName =
          layout === "classic-grid" ? "passport_photos_10x15.pdf" : "photobooth_strips_10x15.pdf";
        pdf.save(fileName);
        resolve();
      };

      img.onerror = (err) => {
        reject(err);
      };

      img.src = croppedImageDataUrl;
    } catch (error) {
      reject(error);
    }
  });
};
