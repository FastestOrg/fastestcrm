import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Downloads a DOM element as a high-quality PDF.
 * @param elementId The HTML element ID to print.
 * @param filename The name of the downloaded PDF file.
 */
export async function downloadDocumentAsPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found.`);
  }

  // Preserve styles and load fonts/images via CORS
  const canvas = await html2canvas(element, {
    scale: 2, // Double scale for higher DPI/resolution
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');

  // Generate a single-page PDF matching the exact dimensions of the element in points (pt).
  // We divide the canvas dimensions by the scale factor to match the element's actual layout size.
  const pdfWidth = canvas.width / 2;
  const pdfHeight = canvas.height / 2;

  const pdf = new jsPDF({
    orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pdfWidth, pdfHeight]
  });

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
