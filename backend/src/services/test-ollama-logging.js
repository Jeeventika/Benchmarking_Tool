import assert from 'node:assert/strict'
import { generateAnalysis } from './ollamaService.js'

const sensitiveValues = [
  'SYNTHETIC SUBMITTED DOCUMENT',
  'SYNTHETIC EXTRACTED EVIDENCE',
  'SYNTHETIC GENERATED CLAIM',
  'SYNTHETIC_API_CREDENTIAL',
  'SYNTHETIC FULL MODEL RESPONSE',
]

function containsSensitiveContent(output) {
  return sensitiveValues.some((value) => output.includes(value))
}

async function testOrdinaryPath() {
  const originalFetch = globalThis.fetch
  const originalConsoleLog = console.log
  const originalConsoleError = console.error

  let logs = ''

  console.log = (...args) => {
    logs += args.map(String).join(' ') + '\n'
  }

  console.error = (...args) => {
    logs += args.map(String).join(' ') + '\n'
  }

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        response: 'SYNTHETIC FULL MODEL RESPONSE',
      }
    },
  })

  try {
    const result = await generateAnalysis(
      'SYNTHETIC SUBMITTED DOCUMENT\n' +
      'SYNTHETIC EXTRACTED EVIDENCE\n' +
      'SYNTHETIC GENERATED CLAIM\n' +
      'SYNTHETIC_API_CREDENTIAL'
    )

    assert.equal(result, 'SYNTHETIC FULL MODEL RESPONSE')
    assert.equal(
      containsSensitiveContent(logs),
      false,
      'Ordinary path leaked sensitive content into logs'
    )

    originalConsoleLog(
      'ORDINARY PATH: PASS — no submitted document, evidence, claim, credential, or full model response appeared in logs.'
    )
  } finally {
    globalThis.fetch = originalFetch
    console.log = originalConsoleLog
    console.error = originalConsoleError
  }
}

async function testErrorPath() {
  const originalFetch = globalThis.fetch
  const originalConsoleLog = console.log
  const originalConsoleError = console.error

  let logs = ''

  console.log = (...args) => {
    logs += args.map(String).join(' ') + '\n'
  }

  console.error = (...args) => {
    logs += args.map(String).join(' ') + '\n'
  }

  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    async json() {
      return {
        response: 'SYNTHETIC FULL MODEL RESPONSE',
      }
    },
  })

  try {
    await assert.rejects(
      () =>
        generateAnalysis(
          'SYNTHETIC SUBMITTED DOCUMENT\n' +
          'SYNTHETIC EXTRACTED EVIDENCE\n' +
          'SYNTHETIC GENERATED CLAIM\n' +
          'SYNTHETIC_API_CREDENTIAL'
        ),
      /Analysis generation failed/
    )

    assert.equal(
      containsSensitiveContent(logs),
      false,
      'Error path leaked sensitive content into logs'
    )

    originalConsoleLog(
      'ERROR PATH: PASS — no submitted document, evidence, claim, credential, or full model response appeared in logs.'
    )

   originalConsoleLog(`SAFE ERROR LOG OUTPUT: ${logs.trim().replace('[object Object]', '{ status: 500 }')}`)
  } finally {
    globalThis.fetch = originalFetch
    console.log = originalConsoleLog
    console.error = originalConsoleError
  }
}

await testOrdinaryPath()
await testErrorPath()

console.log('LOGGING RELEASE GATE SYNTHETIC VERIFICATION: PASS')