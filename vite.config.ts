import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// BoxLens dashboards app.
// - Built from app/index.html (Vite entry), output to app/dist.
// - base defaults to '/' so the dashboards app IS the single root application
//   (served at https://boxlens.vercel.app/ via vercel.json rewriting '/' to
//   /app/dist/index.html and /assets/* to /app/dist/assets/*). The legacy
//   single-file VGM tool moves to /classic.html. Override with VITE_BASE for
//   hosts that need a sub-path prefix — e.g. GitHub Pages serves the repo at
//   https://<user>.github.io/boxlens/, so the Pages build passes
//   VITE_BASE='/boxlens/'.
// - @boxlens/core is aliased to its TypeScript source so the dashboards app
//   imports the real, tree-shaken, type-checked core (no UMD global).
// - Internal navigation is hash-based (#/dashboards/executive, #/features), so
//   there are no server-side sub-paths — Vercel serves the single built
//   index.html plus its /assets/* chunks, and routing is client-side.
export default defineConfig({
  root: 'app',
  base: process.env.VITE_BASE ?? '/',
  resolve: {
    alias: {
      '@boxlens/core': resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
    // Routes are dynamic-imported, so Rollup auto-splits each dashboard into its
    // own chunk (lazy-loaded, Lighthouse-friendly). ECharts/Leaflet are added to
    // manualChunks once a route actually imports them (slice #1+).
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
});
