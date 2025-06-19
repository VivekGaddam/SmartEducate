// import tailwindcss from '@tailwindcss/vite'

// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import { VitePWA } from 'vite-plugin-pwa';

// export default defineConfig({
//   plugins: [
//     react(),
//     tailwindcss(),
//     VitePWA({
//       registerType: 'autoUpdate',
//       includeAssets: ['favicon.svg'],
//       manifest: {
//         name: 'NGO Offline SPA',
//         short_name: 'NGOOffline',
//         start_url: '/',
//         display: 'standalone',
//         background_color: '#ffffff',
//         description: 'A single page React app for NGOs, available offline',
//         icons: [
//           {
//             src: 'pwa-192x192.png',
//             sizes: '192x192',
//             type: 'image/png',
//           },
//           {
//             src: 'pwa-512x512.png',
//             sizes: '512x512',
//             type: 'image/png',
//           },
//         ],
//       },
//     }),
//   ],
// });
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // ← new Tailwind Vite plugin
  ],
});
