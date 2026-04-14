import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mocking the blog data since we can't easily import TS from MJS without a bundler/ts-node
// In a real repo, we'd use a shared JSON or a small script to extract this
// For this 100,000X SEO setup, I'll extract the core info from the blogs.ts file content directly
// or just use a placeholder-style generator that reads the file as text.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOGS_FILE = path.join(__dirname, '../src/data/blogs.ts');
const PUBLIC_DIR = path.join(__dirname, '../public');
const DOMAIN = 'https://www.fastestcrm.com';

async function generateRSS() {
  try {
    const content = fs.readFileSync(BLOGS_FILE, 'utf-8');
    
    // Simple regex to extract slug, title, excerpt, and date
    // This is a bit fragile but works for this specific structure
    const blogMatch = content.matchAll(/slug:\s*'([^']+)',\s*title:\s*'([^']+)',\s*excerpt:\s*'([^']+)',[^]*?date:\s*'([^']+)'/g);
    const blogs = Array.from(blogMatch).map(m => ({
      slug: m[1],
      title: m[2],
      excerpt: m[3],
      date: m[4]
    }));

    const rssItems = blogs.map(blog => `
    <item>
      <title><![CDATA[${blog.title}]]></title>
      <link>${DOMAIN}/blog/${blog.slug}</link>
      <guid isPermaLink="true">${DOMAIN}/blog/${blog.slug}</guid>
      <pubDate>${new Date(blog.date).toUTCString()}</pubDate>
      <description><![CDATA[${blog.excerpt}]]></description>
    </item>`).join('');

    const rssTemplate = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Fastest CRM Blog | AI Sales Insights</title>
  <link>${DOMAIN}/blog</link>
  <description>The latest news, tips, and strategies for AI-powered sales and CRM automation.</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${DOMAIN}/rss.xml" rel="self" type="application/rss+xml" />
  ${rssItems}
</channel>
</rss>`;

    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    fs.writeFileSync(path.join(PUBLIC_DIR, 'rss.xml'), rssTemplate);
    console.log('✅ RSS Feed generated successfully at /public/rss.xml');
  } catch (error) {
    console.error('❌ Error generating RSS Feed:', error);
  }
}

generateRSS();
