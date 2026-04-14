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
  };
});
