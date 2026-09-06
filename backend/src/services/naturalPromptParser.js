const DOMAIN_CRITERIA = {
  research_paper: ['Methodology', 'Benchmark Score', 'Citations', 'Reproducibility'],
  idea: ['Scalability', 'Maintainability', 'Latency', 'Cost'],
  presentation: ['Clarity', 'Strategic Fit', 'Projected ROI', 'Risk Level'],
  transcript: ['Domain Expertise', 'Problem Solving', 'Communication'],
  ai_model: ['Accuracy', 'Performance', 'Speed', 'Cost'],
  college: ['Cost', 'Placement', 'Reputation'],
  product: ['Price', 'Battery', 'Camera', 'Performance'],
  other: ['Cost', 'Quality', 'Performance', 'Reliability'],
}

export function parseNaturalPrompt(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return null
  }

  const text = rawText.trim()

  // 1. Remove introductory keywords
  let stripped = text.replace(/^(please\s+)?(compare|evaluate|choose\s+between|contrast|analyze|which\s+is\s+better\s*[:,-]?)\s*(between\s+)?/i, '')

  // 2. Separate items from context / goals (e.g. "for coding", "based on cost", "in 2024")
  let itemsPart = stripped
  let contextPart = ''

  const contextSplit = stripped.match(/\b(for|based\s+on|on|across|regarding|in\s+terms\s+of)\b\s+(.+)$/i)
  if (contextSplit) {
    itemsPart = stripped.slice(0, contextSplit.index).trim()
    contextPart = contextSplit[2].trim()
  }

  // 3. Split items by common separators: vs, vs., versus, and, or, comma
  let items = itemsPart
    .split(/\s+(?:vs\.?|versus|and|or)\s+|,\s*/i)
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

  if (items.length < 2) {
    // Fallback: try "with" or "to"
    const secondary = itemsPart.split(/\s+(?:with|against|to)\s+/i).map((s) => s.trim()).filter(Boolean)
    if (secondary.length >= 2) {
      items = secondary
    }
  }

  // If still less than 2 items, provide sensible defaults
  if (items.length < 2) {
    items = items.length === 1 ? [items[0], 'Alternative Option'] : ['Option A', 'Option B']
  }

  // Capitalize item names nicely
  items = items.map((i) => {
    if (i.length <= 4) return i.toUpperCase() // e.g. MIT, BERT, GPT
    return i.charAt(0).toUpperCase() + i.slice(1)
  })

  // 4. Infer domain / item_type
  const lowerAll = text.toLowerCase()
  let itemType = 'other'

  if (/claude|gpt|chatgpt|openai|anthropic|llm|llama|gemini|mistral|deepseek|ai\s*model/i.test(lowerAll)) {
    itemType = 'ai_model'
  } else if (/mit|stanford|harvard|berkeley|university|college|campus|tuition|undergraduate|degree/i.test(lowerAll)) {
    itemType = 'college'
  } else if (/iphone|samsung|galaxy|pixel|phone|smartphone|laptop|macbook|camera|battery/i.test(lowerAll)) {
    itemType = 'product'
  } else if (/paper|attention|bert|arxiv|neural|resnet|transformer|publication/i.test(lowerAll)) {
    itemType = 'research_paper'
  } else if (/microservice|monolith|serverless|architecture|backend|system\s*design|database|scalab/i.test(lowerAll)) {
    itemType = 'idea'
  }

  // 5. Goal
  let goal = ''
  if (contextPart) {
    goal = `Compare ${items.join(' vs ')} for ${contextPart}`
  } else if (text.length > 5 && !text.toLowerCase().startsWith('compare')) {
    goal = `Compare ${items.join(' vs ')} (${text})`
  } else {
    goal = `Compare ${items.join(' vs ')}`
  }

  // 6. Criteria
  let criteria = DOMAIN_CRITERIA[itemType] || DOMAIN_CRITERIA.other
  if (contextPart) {
    const customWords = contextPart
      .split(/\s*(?:,|and|\/)\s*/)
      .map((w) => w.trim().replace(/^for\s+/i, ''))
      .filter((w) => w.length > 2)

    if (customWords.length > 0) {
      const formattedCustom = customWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      criteria = [...new Set([...formattedCustom, ...criteria])].slice(0, 4)
    }
  }

  return {
    item_type: itemType,
    goal,
    items,
    criteria,
  }
}
