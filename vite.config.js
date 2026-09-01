import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'auth/login.html'),
        customer: resolve(__dirname, 'customer/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        delivery: resolve(__dirname, 'delivery/index.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/leaflet')) {
            return 'vendor-leaflet';
          }
        }
      }
    }
  }
});
