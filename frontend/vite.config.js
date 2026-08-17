import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Im Entwicklungsbetrieb laufen Frontend und Backend auf verschiedenen Ports.
    // Der Proxy lässt beide unter derselben Herkunft erscheinen, damit die
    // Session-Cookies des Backends ohne CORS-Sonderregeln funktionieren.
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:3000",
        changeOrigin: true,
      },
      "/auth": {
        target: process.env.VITE_API_TARGET || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
