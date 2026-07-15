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
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');

  // jsPDF parameters: orientation, unit, format
  // A4: 210mm x 297mm
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgWidth = 210;
  const pageHeight = 297;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  // Add the first page
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  // Render subsequent pages if content spans across multiple A4 pages
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
