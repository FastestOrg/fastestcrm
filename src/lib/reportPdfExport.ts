import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  elementId: string;
  filename: string;
  reportTitle?: string;
  companyName?: string;
  generatedBy?: string;
  dateRangeText?: string;
  activeFiltersText?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Downloads a DOM element as a high-quality multi-page or single-page PDF.
 */
export async function exportReportToPDF(options: PDFExportOptions): Promise<void> {
  const {
    elementId,
    filename,
    orientation = 'landscape',
  } = options;

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Report element with ID "${elementId}" not found.`);
  }

  // Ensure all images, fonts, and SVGs are loaded before capturing
  const canvas = await html2canvas(element, {
    scale: 2, // 2x DPI for crisp text & sharp charts
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#0b1329', // Matching premium theme or transparent
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (clonedDoc) => {
      // Ensure cloned elements are visible and expanded
      const clonedEl = clonedDoc.getElementById(elementId);
      if (clonedEl) {
        clonedEl.style.display = 'block';
        clonedEl.style.visibility = 'visible';
        clonedEl.style.width = '100%';
        clonedEl.style.maxWidth = '1200px';
      }
    }
  });

  const imgData = canvas.toDataURL('image/png', 1.0);

  // Standard A4 dimensions in points (pt)
  const isLandscape = orientation === 'landscape';
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;

  const margin = 20; // pt margin
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;

  // Calculate scaled height based on printable width
  const imgWidth = printableWidth;
  const imgHeight = (canvas.height * printableWidth) / canvas.width;

  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: 'a4',
  });

  // If content fits on one page (with slight tolerance)
  if (imgHeight <= printableHeight) {
    pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
  } else {
    // Multi-page slicing
    let heightLeft = imgHeight;
    let position = margin;
    let pageNum = 1;

    // First page
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= printableHeight;

    // Additional pages
    while (heightLeft > 0) {
      position = margin - pageNum * printableHeight;
      pdf.addPage('a4', orientation);
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= printableHeight;
      pageNum++;
    }
  }

  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  pdf.save(cleanFilename);
}
