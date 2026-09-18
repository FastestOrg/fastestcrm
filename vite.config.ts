import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import Sitemap from "vite-plugin-sitemap";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const routes = fs.existsSync("./sitemap-routes.json")
    ? JSON.parse(fs.readFileSync("./sitemap-routes.json", "utf-8"))
    : ["/"];

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        // Proxy all Supabase API calls through the dev server to avoid
        // direct outbound connection blocks (ISP/firewall blocking Supabase IP).
        // The client uses VITE_SUPABASE_URL directly in production (no proxy needed).
        "/supabase-proxy": {
          target: "https://api.fastestcrm.com",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/supabase-proxy/, ""),
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      Sitemap({
        hostname: "https://www.fastestcrm.com",
        dynamicRoutes: routes,
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'fastestcrmlogo.png'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000, // 5MB limit for large production bundles
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          navigateFallbackDenylist: [/^\/assets\//, /^\/api\//, /^\/rest\//, /^\/auth\//, /^\/functions\//],
        },
        manifest: {
          name: 'Fastest CRM',
          short_name: 'FastestCRM',
          description: "India's #1 AI-powered CRM built for the fastest sales teams.",
          theme_color: '#0d9488',
          icons: [
            {
              src: 'fastestcrmlogo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'fastestcrmlogo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: "esnext",
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('/node_modules/')) {
              if (normalizedId.includes('/three/')) {
                return 'vendor-three';
              }
              if (normalizedId.includes('/html2canvas/') || normalizedId.includes('/jspdf/')) {
                return 'vendor-pdf';
              }
              if (normalizedId.includes('/reactflow/') || normalizedId.includes('/@reactflow/')) {
                return 'vendor-flow';
              }
              if (
                normalizedId.includes('/recharts/') ||
                normalizedId.includes('/d3-') ||
                normalizedId.includes('/victory-vendor/')
              ) {
                return 'vendor-charts';
              }
              if (normalizedId.includes('/framer-motion/')) {
                return 'vendor-motion';
              }
              if (normalizedId.includes('/@supabase/')) {
                return 'vendor-supabase';
              }
              if (normalizedId.includes('/@tanstack/')) {
                return 'vendor-query';
              }
              if (normalizedId.includes('/@dnd-kit/')) {
                return 'vendor-dnd';
              }
              if (normalizedId.includes('/papaparse/')) {
                return 'vendor-papaparse';
              }
              if (normalizedId.includes('/@radix-ui/')) {
                return 'vendor-radix';
              }
              if (normalizedId.includes('/lucide-react/')) {
                return 'vendor-lucide';
              }
              if (
                normalizedId.includes('/react/') ||
                normalizedId.includes('/react-dom/') ||
                normalizedId.includes('/react-router-dom/') ||
                normalizedId.includes('/react-router/')
              ) {
                return 'vendor-react';
              }
            }
          },
        },
      },
    },
  };
});
