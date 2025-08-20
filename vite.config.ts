import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@/lib/supabase", replacement: path.resolve(__dirname, "./lib/supabase") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
