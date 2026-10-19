/**
 * BearBox Chrome Extension Bundler
 *
 * Builds:
 * 1. Popup & Manager HTML apps (via standard Vite config)
 * 2. Background service worker (ES module -> dist/background.js)
 * 3. Content script (IIFE isolated bundle -> dist/content.js)
 */

import { build } from 'vite';
import { resolve } from 'path';

async function buildAll() {
  console.log('--- 1. Building Background Service Worker ---');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve('src/background/index.ts'),
        name: 'BearBoxBackground',
        formats: ['es'],
        fileName: () => 'background.js'
      }
    }
  });

  console.log('--- 2. Building Content Script (IIFE) ---');
  await build({
    configFile: false,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production')
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve('src/content/index.ts'),
        name: 'BearBoxContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      }
    }
  });

  console.log('--- 3. Syncing Root Icons Directory ---');
  const fs = await import('fs');
  if (fs.existsSync('public/icons')) {
    fs.cpSync('public/icons', 'icons', { recursive: true });
    console.log('Root icons directory synced.');
  }

  // Sync test forms and manifest to dist
  if (fs.existsSync('public/customer-form.html')) {
    fs.copyFileSync('public/customer-form.html', 'dist/customer-form.html');
  }
  if (fs.existsSync('manifest.json')) {
    fs.copyFileSync('manifest.json', 'dist/manifest.json');
  }

  console.log('--- BearBox Extension scripts built successfully! ---');
}

buildAll().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
