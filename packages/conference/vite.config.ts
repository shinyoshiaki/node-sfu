import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number.parseInt(process.env.VITE_PORT || "3001"),
    host: true,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
