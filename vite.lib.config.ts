import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/richtext/index.ts'),
      name: 'LeaferXRichText',
      fileName: 'index',
      formats: ['es']
    },
    outDir: 'dist',
    rollupOptions: {
      external: [
        'leafer-ui',
        '@leafer-ui/core',
        '@leafer-ui/interface',
        '@leafer-in/editor',
        '@leafer-in/text-editor'
      ]
    }
  },
  plugins: [
    dts({
      entryRoot: 'src/richtext',
      outDir: 'dist',
      include: ['src/richtext/**/*.ts'],
      exclude: ['node_modules']
    })
  ]
})
