import axios from 'axios'

// The frontend only ever talks to our own backend. It never calls
// Ollama or Postgres directly — that happens on the server side.
const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export default client
