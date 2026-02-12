import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000, // Инлайнить всё
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    // brotliSize удален в новых версиях, используем это:
    reportCompressedSize: false, 
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});