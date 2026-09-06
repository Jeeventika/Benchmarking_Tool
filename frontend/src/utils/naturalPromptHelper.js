export function parsePromptPreview(promptText) {
  if (!promptText || !promptText.trim()) {
    return { items: [], domain: null, ready: false }
  }

  let text = promptText.trim()
  let cleaned = text.replace(/^(compare|evaluate|contrast|analyze|review|choose between)\s+/i, '')
  cleaned = cleaned.replace(/[?.!]+$/, '')

  const domainKeywords = [
    { type: 'ai_model', label: 'AI Model', terms: ['model', 'llm', 'gpt', 'claude', 'gemini', 'llama', 'deepseek', 'chatgpt', 'mistral', 'qwen', 'copilot'] },
    { type: 'college', label: 'College / University', terms: ['college', 'university', 'undergraduate', 'masters', 'phd', 'campus', 'mit', 'stanford', 'harvard', 'berkeley', 'oxford', 'cambridge', 'iit'] },
    { type: 'research_paper', label: 'Research Paper', terms: ['paper', 'arxiv', 'neurips', 'icml', 'attention is all you need', 'bert', 'resnet', 'transformer', 'deepseek-r1'] },
    { type: 'idea', label: 'Architecture / Concept', terms: ['architecture', 'microservice', 'monolith', 'serverless', 'event-driven', 'sql', 'nosql', 'graphql', 'rest'] },
    { type: 'product', label: 'Product / Hardware', terms: ['iphone', 'galaxy', 'samsung', 'pixel', 'macbook', 'laptop', 'phone', 'battery', 'camera'] },
  ]

  let detectedDomain = null
  const lower = text.toLowerCase()
  for (const entry of domainKeywords) {
    if (entry.terms.some((t) => lower.includes(t))) {
      detectedDomain = entry.label
      break
    }
  }

  let separatorMatch = cleaned.match(/\s+(?:vs\.?|versus|against|and|or)\s+/i)
  if (separatorMatch) {
    const parts = cleaned.split(separatorMatch[0]).map((s) => s.trim().replace(/^for\s+.*/i, '')).filter(Boolean)
    if (parts.length >= 2) {
      return {
        items: parts.slice(0, 4),
        domain: detectedDomain,
        ready: true,
      }
    }
  }

  return { items: [], domain: detectedDomain, ready: false }
}
