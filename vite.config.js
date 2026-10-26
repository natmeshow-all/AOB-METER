import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { executeRealSajCloudSync, executeSajHistoricalBatch } from './api/saj-sync.js'

const sajLocalApiPlugin = () => ({
  name: 'saj-local-api-middleware',
  configureServer(server) {
    server.middlewares.use('/api/saj-sync', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }))
        return
      }
      let rawBody = ''
      req.on('data', (chunk) => {
        rawBody += chunk
      })
      req.on('end', async () => {
        try {
          const parsed = rawBody ? JSON.parse(rawBody) : {}
          let result
          if (parsed.mode === 'backfill_batch') {
            result = await executeSajHistoricalBatch({
              sessionTicket: parsed.sessionTicket,
              dates: parsed.dates
            })
          } else {
            result = await executeRealSajCloudSync({
              username: parsed.username,
              password: parsed.password,
              preferredRegion: parsed.region || 'auto'
            })
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, message: err.message }))
        }
      })
    })
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    sajLocalApiPlugin()
  ],
})
