import fs from 'node:fs';
import path from 'node:path';

const blogsPath = path.resolve('src/data/blogs.ts');
const blogsContent = fs.readFileSync(blogsPath, 'utf-8');

const slugRegex = /slug:\s*['"]([^'"]+)['"]/g;
const slugs = [];
let match;

while ((match = slugRegex.exec(blogsContent)) !== null) {
  slugs.push(`/blog/${match[1]}`);
}

const routes = [
  '/',
  '/auth',
  '/terms',
  '/privacy',
  '/register-company',
  '/reset-password',
  '/blog',
  '/documentation',
  '/crm-for-real-estate',
  '/crm-for-edtech',
  '/crm-for-saas',
  ...slugs
];

fs.writeFileSync('sitemap-routes.json', JSON.stringify(routes, null, 2));
console.log(`Generated ${routes.length} routes for sitemap.`);
