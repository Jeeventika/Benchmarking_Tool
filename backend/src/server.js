import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { testConnection } from './db/pool.js'
import comparisonsRouter from './routes/comparisons.js'
import evidenceRouter from './routes/evidence.js'
import comparabilityRouter from './routes/comparability.js'
import analysisRouter from './routes/analysis.js'
import recommendationsRouter from './routes/recommendations.js'
import decisionsRouter from './routes/decisions.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Safe request logging — no bodies, no AI output, metadata only.
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})

app.get('/api/health', async (req, res) => {
  try {
    await testConnection()
    res.json({ status: 'ok', db: 'connected' })
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'unreachable' })
  }
})

app.use('/api/comparisons', comparisonsRouter)
app.use('/api/comparisons', evidenceRouter)
app.use('/api/comparisons', comparabilityRouter)
app.use('/api/comparisons', analysisRouter)
app.use('/api/comparisons', recommendationsRouter)
app.use('/api/comparisons', decisionsRouter)

app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Uploaded document exceeds maximum allowed size (50MB).' })
  }
  if (err) {
    console.error('Unhandled server error', { message: err.message })
    return res.status(500).json({ error: 'Internal server error processing request.' })
  }
  next()
})

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})
