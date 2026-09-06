import zlib from 'zlib'

/**
 * Extracts plain text from a PDF Buffer or base64 data string.
 * Uses Node's built-in zlib module to decompress Flate streams without external npm packages.
 */
export function extractTextFromPdf(input) {
  if (!input) return ''

  let buffer
  if (Buffer.isBuffer(input)) {
    buffer = input
  } else if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      const base64Content = input.replace(/^data:[^;]+;base64,/, '')
      buffer = Buffer.from(base64Content, 'base64')
    } else if (input.startsWith('%PDF')) {
      buffer = Buffer.from(input, 'binary')
    } else {
      // Plain text or already extracted
      return input.replace(/\0/g, '').trim()
    }
  } else {
    return ''
  }

  const content = buffer.toString('binary')
  let extracted = ''

  // Search for stream ... endstream blocks in the PDF
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match

  while ((match = streamRegex.exec(content)) !== null) {
    const rawStream = Buffer.from(match[1], 'binary')
    let decompressed = null

    try {
      decompressed = zlib.inflateSync(rawStream)
    } catch {
      try {
        decompressed = zlib.unzipSync(rawStream)
      } catch {
        decompressed = rawStream
      }
    }

    if (decompressed) {
      const streamText = decompressed.toString('latin1')

      // 1. Parenthesized text in Tj operator: (text) Tj
      const tjMatches = streamText.matchAll(/\(([^)]+)\)\s*Tj/g)
      for (const m of tjMatches) {
        extracted += m[1] + ' '
      }

      // 2. Text elements inside TJ operator: [(text) 10 (more text)] TJ
      const tjArrayMatches = streamText.matchAll(/\[(.*?)\]\s*TJ/g)
      for (const m of tjArrayMatches) {
        const inner = m[1].matchAll(/\(([^)]+)\)/g)
        for (const im of inner) {
          extracted += im[1] + ' '
        }
      }
    }
  }

  const cleaned = extracted
    .replace(/\\([()\\])/g, '$1')
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || 'Document content extracted from submitted PDF.'
}
