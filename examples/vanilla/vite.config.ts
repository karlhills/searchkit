import { defineConfig } from "vite";

export default defineConfig({
  root: "dist",
  server: {
    host: true,
    port: 4173
  }
});
