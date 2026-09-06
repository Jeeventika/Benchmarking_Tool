const DOMAIN_CRITERIA = {
  research_paper: ['Research Objective', 'Methodology', 'Dataset & Sample Size', 'Results & Evaluation', 'Limitations'],
  idea: ['Scalability', 'Maintainability', 'Latency', 'Cost', 'Feasibility'],
  presentation: ['Clarity', 'Strategic Fit', 'Projected ROI', 'Risk Level'],
  transcript: ['Domain Expertise', 'Problem Solving', 'Communication'],
  ai_model: ['Accuracy & Benchmarks', 'Capabilities', 'Latency & Speed', 'Cost'],
  college: ['Tuition & Cost', 'Career Placement', 'Academic Reputation', 'Research Opportunities'],
  product: ['Camera', 'Battery Life', 'Performance', 'Price'],
  laptop: ['Battery Life', 'Portability', 'Performance', 'Display Quality', 'Price'],
  ev: ['Driving Range', 'Acceleration', 'Battery Capacity', 'Price'],
  policy: ['Data Coverage', 'Analytical Methodology', 'Policy Recommendations', 'Global Index Score'],
  software: ['Ease of Learning', 'Job Opportunities', 'Ecosystem & Libraries', 'Performance'],
  general: ['Key Features', 'Usability', 'Effectiveness', 'Value'],
}

function formatCriterionName(str) {
  if (!str) return ''
  return str
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function parseNaturalPrompt(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return null
  }

  const fullText = rawText.trim()
  const lowerAll = fullText.toLowerCase()

  // 1. Detect Context (e.g. "for a beginner", "for everyday use", "for a student", "for research")
  let userContext = ''
  const contextRegex = /\bfor\s+(?:a\s+)?(?:student|students|beginner|beginners|everyday\s+use|daily\s+use|research|coding|gaming|computer\s+science|undergraduate|masters|production|personal\s+use|work|travel|school|college)\b/i
  const contextMatch = fullText.match(contextRegex)
  if (contextMatch) {
    userContext = contextMatch[0].trim()
  }

  // 2. Separate Clauses (Sentence 1: items/question, Sentence 2: criteria or care-abouts)
  const sentences = fullText
    .split(/[.?!;]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  let itemsClause = ''
  let criteriaClause = ''

  if (sentences.length >= 2) {
    for (const s of sentences) {
      if (
        /(?:i care about|compare|evaluating|looking at|criteria|focus on)\s+(?:tuition|cost|price|battery|camera|photography|accuracy|performance|learning|job|outcome|research|methodology|dataset|sample|range|safety|value|gaming)/i.test(
          s
        )
      ) {
        criteriaClause = s
      } else if (
        /(?:choose between|choosing between|which is better|compare|between)\b/i.test(s) ||
        !itemsClause
      ) {
        itemsClause = s
      }
    }
  }

  if (!itemsClause) {
    itemsClause = sentences[0] || fullText
  }

  // If userContext was found, strip it from itemsClause before criteria detection
  if (userContext) {
    itemsClause = itemsClause
      .replace(new RegExp(`\\b${userContext.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i'), '')
      .replace(/^[,\s:]+|[,\s:]+$/g, '')
      .replace(/,\s*,/g, ',')
      .trim()
  }

  // Check if single sentence contains explicit criteria via " for <criteria>" or " based on <criteria>"
  if (!criteriaClause) {
    const splitCriteriaRegex = /\b(?:based on|in terms of|regarding|for)\s+([a-z0-9\s,\/&]+)$/i
    const m = itemsClause.match(splitCriteriaRegex)
    if (m && m[1]) {
      const candidate = m[1].trim()
      // ensure it's not merely a context phrase like "for a student"
      if (
        !/^(?:a\s+)?(?:student|students|beginner|beginners|everyday\s+use|daily\s+use|production|undergraduate|masters|research|work|travel)$/i.test(
          candidate
        )
      ) {
        criteriaClause = candidate
        itemsClause = itemsClause.slice(0, m.index).trim()
      }
    }
  }

  // 3. Extract Explicit Criteria
  let userExplicitCriteria = []
  if (criteriaClause) {
    let cleanCrit = criteriaClause
      .replace(
        /^(?:i care about|compare|evaluating|looking at|focusing on|with focus on|based on|in terms of|regarding|for)\s+/i,
        ''
      )
      .trim()

    const rawList = cleanCrit
      .split(/\s*(?:,|&|\band\b|\bor\b)\s*/i)
      .map((s) => s.trim().replace(/^(?:the|for|about|a|an)\s+/i, ''))
      .filter(
        (s) =>
          s.length >= 3 &&
          !/^(both|either|all|options|them|between|better|which|papers|devices|phones)$/i.test(s)
      )

    if (rawList.length >= 1) {
      userExplicitCriteria = rawList.map(formatCriterionName)
    }
  }

  // 4. Extract Items from itemsClause
  const leadRegex = /^(?:please\s+)?(?:compare|evaluate|choose between|contrast|analyze|should i (?:choose|pick|get|buy)|choosing between|i am choosing between|which\s+(?:paper|model|product|laptop|car|phone|system|option|one)?\s*(?:is|has|offers|provides)\s+(?:the\s+)?(?:better|stronger|higher|superior|more|preferable|best)(?:\s+[a-z]+(?:\s+[a-z]+)?)?|which\s+(?:is|are|one is|paper is)\s+(?:better|stronger|preferable|superior|best)(?:\s+for\s+[^,]+)?|which\s+is\s+better|what\s+(?:is|are)\s+(?:better|stronger|preferable|superior|best)(?:\s+for\s+[^,]+)?)\s*[:,\s]*(?:between\s+)?/i

  let cleanItems = itemsClause
    .replace(leadRegex, '')
    .replace(/\b(?:for|based on|in terms of|regarding)\s+.*$/i, '')
    .replace(/^[,\s:]+|[,\s:]+$/g, '')
    .trim()

  let rawItems = cleanItems
    .split(/\s+(?:vs\.?|versus|and|or)\s+|,\s*/i)
    .map((s) => s.trim().replace(/^['"]|['"]$/g, '').replace(/[?.!]+$/, ''))
    .filter((s) => s.length >= 2 && !/^(which|better|for|between|choose|these|the)$/i.test(s))

  if (rawItems.length < 2) {
    const secondary = cleanItems.split(/\s+(?:with|against|to)\s+/i).map((s) => s.trim()).filter(Boolean)
    if (secondary.length >= 2) {
      rawItems = secondary
    }
  }

  if (rawItems.length < 2) {
    rawItems = rawItems.length === 1 ? [rawItems[0], 'Alternative Option'] : ['Option A', 'Option B']
  }

  // Format Items
  const items = rawItems.map((i) => {
    if (/^iphone/i.test(i)) return 'iPhone' + (i.length > 6 ? ' ' + i.slice(6).trim() : '')
    if (/^ipad/i.test(i)) return 'iPad' + (i.length > 4 ? ' ' + i.slice(4).trim() : '')
    if (/^javascript/i.test(i)) return 'JavaScript'
    if (/^macbook/i.test(i)) return 'MacBook' + (i.length > 7 ? ' ' + i.slice(7).trim() : '')
    if (/^pixel/i.test(i)) return 'Pixel' + (i.length > 5 ? ' ' + i.slice(5).trim() : '')
    if (/^galaxy/i.test(i)) return 'Galaxy' + (i.length > 6 ? ' ' + i.slice(6).trim() : '')
    if (i.length <= 4) return i.toUpperCase() // MIT, BERT, GPT, BYD, OECD
    return i.charAt(0).toUpperCase() + i.slice(1)
  })

  // 5. Infer Domain
  let itemType = 'general'
  if (/claude|gpt|chatgpt|openai|anthropic|llm|llama|gemini|mistral|deepseek|ai\s*model/i.test(lowerAll)) {
    itemType = 'ai_model'
  } else if (/mit|stanford|harvard|berkeley|university|college|campus|tuition|undergraduate|degree/i.test(lowerAll)) {
    itemType = 'college'
  } else if (/macbook|dell\s*xps|thinkpad|laptop|notebook/i.test(lowerAll)) {
    itemType = 'laptop'
  } else if (/tesla|byd|ioniq|ev|electric vehicle|model 3|seal/i.test(lowerAll)) {
    itemType = 'ev'
  } else if (/iphone|samsung|galaxy|pixel|phone|smartphone|camera|battery/i.test(lowerAll)) {
    itemType = 'product'
  } else if (/paper|attention|bert|arxiv|neural|resnet|transformer|study|cancer\s*detection|methodology|publication/i.test(lowerAll)) {
    itemType = 'research_paper'
  } else if (/world\s*bank|oecd|imf|united\s*nations|policy|government/i.test(lowerAll)) {
    itemType = 'policy'
  } else if (/python|javascript|react|angular|vue|golang|rust|typescript|programming|framework|library/i.test(lowerAll)) {
    itemType = 'software'
  } else if (/microservice|monolith|serverless|architecture|backend|system\s*design/i.test(lowerAll)) {
    itemType = 'idea'
  }

  // 6. Criteria Determination (Never blindly use Cost/Performance/Quality/Reliability)
  let criteria = []
  let isInferred = true

  if (userExplicitCriteria.length >= 1) {
    criteria = userExplicitCriteria.slice(0, 5)
    isInferred = false
  } else if (itemType === 'research_paper' && /methodology|method|study design/i.test(lowerAll)) {
    criteria = ['Study Design', 'Methodology', 'Dataset & Sample Size', 'Evaluation Approach', 'Limitations']
    isInferred = true
  } else if (itemType === 'laptop' && /student/i.test(lowerAll)) {
    criteria = ['Battery Life', 'Portability', 'Performance', 'Display Quality', 'Price']
    isInferred = true
  } else if (itemType === 'college' && /research/i.test(lowerAll)) {
    criteria = ['Research Opportunities', 'Computer Science Program', 'Academic Reputation', 'Tuition & Cost']
    isInferred = true
  } else {
    criteria = DOMAIN_CRITERIA[itemType] || DOMAIN_CRITERIA.general
    isInferred = true
  }

  // 7. Goal
  let goal = ''
  if (userContext) {
    goal = `Compare ${items.join(' vs ')} (${userContext})`
  } else {
    goal = `Compare ${items.join(' vs ')}`
  }

  return {
    item_type: itemType,
    goal,
    items,
    criteria,
    is_inferred_criteria: isInferred,
    user_context: userContext || null,
  }
}
