import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      {
        name: 'copy-static-files',
        closeBundle() {
          // Copy database schema
          mkdirSync('dist/database', { recursive: true })
          copyFileSync('src/database/schema.sql', 'dist/database/schema.sql')

          // Copy prompt templates
          mkdirSync('dist/prompts', { recursive: true })
          const promptFiles = readdirSync('src/prompts')
          for (const file of promptFiles) {
            if (file.endsWith('.txt')) {
              copyFileSync(`src/prompts/${file}`, `dist/prompts/${file}`)
            }
          }

          // Copy branding assets (Phase 4)
          mkdirSync('dist/assets/branding/logos', { recursive: true })
          try {
            copyFileSync('assets/branding/logos/aileron-logo.png', 'dist/assets/branding/logos/aileron-logo.png')
          } catch (err) {
            console.log('Branding assets not found, skipping copy')
          }
        }
      }
    ],
    build: {
      outDir: 'dist/main'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload'
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer')
      }
    }
  }
})
