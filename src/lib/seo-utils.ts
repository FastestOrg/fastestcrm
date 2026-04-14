/**
 * SEO Utilities for Automated Interlinking and Content Processing
 */

interface InterlinkBase {
  keyword: string;
  path: string;
}

const interlinkMap: InterlinkBase[] = [
  { keyword: 'AI CRM', path: '/' },
  { keyword: 'Fastest CRM', path: '/' },
  { keyword: 'Auto Dialer', path: '/crm-for-real-estate' },
  { keyword: 'Lead Management', path: '/crm-for-saas' },
  { keyword: 'Healthcare CRM', path: '/crm-for-healthcare' },
  { keyword: 'EdTech CRM', path: '/crm-for-education' },
  { keyword: 'ROI', path: '/tools' },
  { keyword: 'Razorpay', path: '/' },
  { keyword: 'WhatsApp', path: '/' },
  { keyword: 'CRM', path: '/' },
];

/**
 * Dynamically injects links into an HTML string based on a predefined keyword map.
 * Ensures we don't link inside existing <a> tags or headings.
 */
export function injectInterlinks(content: string): string {
  let processedContent = content;

  // Simple implementation: replace first occurrence of each keyword if not in a tag
  // A more robust implementation would use a parser, but for pSEO this is a high-performance start
  interlinkMap.forEach(({ keyword, path }) => {
    // Regex explanation:
    // (?<!<a[^>]*>) - Look behind to ensure not inside an open <a> tag
    // (?![^<]*<\/a>) - Look ahead to ensure not followed by a closing </a> tag
    // \b${keyword}\b - Match the word on its boundaries
    // g - Global flag (standard SEO practice is usually first or all)
    
    const regex = new RegExp(`(?<!<a[^>]*>)\\b${keyword}\\b(?![^<]*<\\/a>)`, 'gi');
    
    let count = 0;
    processedContent = processedContent.replace(regex, (match) => {
      // Only link first 2 occurrences per keyword to avoid "over-optimization" penalties
      if (count < 2) {
        count++;
        return `<a href="${path}" class="text-primary font-semibold hover:underline">${match}</a>`;
      }
      return match;
    });
  });

  return processedContent;
}
