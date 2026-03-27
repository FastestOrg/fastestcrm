import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import Sitemap from "vite-plugin-sitemap";
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
        hostname: "https://fastestcrm.com",
        dynamicRoutes: routes,
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
