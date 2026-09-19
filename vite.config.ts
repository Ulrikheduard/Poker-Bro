import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Пустая база делает пути относительными: одна и та же сборка работает
  // и на своём домене, и в подпапке вроде user.github.io/pokerbro.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-180.png', 'icon-512.png', 'icon-1024.png'],
      manifest: {
        name: 'Poker Bro',
        short_name: 'Poker Bro',
        description: 'Комбинации, шансы банка, эквити и префлоп-чарты. Считает на устройстве, без сети.',
        lang: 'ru',
        start_url: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0E13',
        theme_color: '#0B0E13',
        icons: [
          { src: 'icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Кладём в кеш всё: приложение целиком меньше мегабайта, и после
        // первого открытия сеть ему не нужна вовсе — это и есть цель.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  worker: { format: 'es' },
  build: { target: 'es2022' },
})
