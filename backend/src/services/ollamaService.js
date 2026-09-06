import 'dotenv/config'

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3'

// The frontend must NEVER call Ollama directly — only this service does,
// and only the backend imports this service. Callers are responsible for
// validating/labeling the output before it reaches the client (see
// ACCURACY / SAFETY REQUIREMENTS: generated analysis must be clearly
// separated from source facts, and raw AI output must not be logged).
export async function generateAnalysis(prompt) {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })

  if (!res.ok) {
    // Log safe metadata only — never the raw prompt/response.
    console.error('Ollama request failed', { status: res.status })
    throw new Error('Analysis generation failed')
  }

  const data = await res.json()
  return data.response
}
