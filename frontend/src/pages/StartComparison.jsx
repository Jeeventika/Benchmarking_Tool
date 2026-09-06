import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createComparison } from '../api/comparisons'
import { parsePromptPreview } from '../utils/naturalPromptHelper'

const COMPARISON_TYPES = [
  { value: 'research_paper', label: 'Research Paper' },
  { value: 'idea', label: 'Idea / Architecture Concept' },
  { value: 'presentation', label: 'Presentation / Proposal' },
  { value: 'transcript', label: 'Transcript / Interview' },
  { value: 'ai_model', label: 'AI Model' },
  { value: 'college', label: 'College / University' },
  { value: 'product', label: 'Product / Hardware' },
  { value: 'other', label: 'Other / Custom Domain' },
]

const PRESET_CRITERIA = {
  research_paper: ['Methodology', 'Benchmark Score', 'Citations', 'Reproducibility'],
  idea: ['Scalability', 'Maintainability', 'Latency', 'Cost', 'Feasibility'],
  presentation: ['Clarity', 'Strategic Fit', 'Projected ROI', 'Risk Level'],
  transcript: ['Domain Expertise', 'Problem Solving', 'Communication', 'Culture Alignment'],
  ai_model: ['Accuracy', 'Performance', 'Speed', 'Cost'],
  college: ['Cost', 'Placement', 'Reputation'],
  product: ['Price', 'Battery', 'Camera', 'Performance'],
  other: ['Cost', 'Quality', 'Feasibility', 'Reliability'],
}

const ITEM_PLACEHOLDERS = {
  research_paper: ['Attention Is All You Need', 'BERT', 'DeepSeek-R1', 'ResNet'],
  idea: ['Microservices Architecture', 'Modular Monolith', 'Serverless (Event-Driven)'],
  presentation: ['Proposal Alpha', 'Proposal Beta', 'Proposal Gamma'],
  transcript: ['Candidate A (Staff Engineer)', 'Candidate B (Principal Architect)'],
  ai_model: ['Claude 3.5 Sonnet', 'ChatGPT (GPT-4o)', 'Llama 3.1 70B'],
  college: ['MIT', 'Stanford', 'Harvard', 'UC Berkeley'],
  product: ['iPhone 16 Pro', 'Samsung Galaxy S24 Ultra', 'Google Pixel 9 Pro'],
  other: ['Option A', 'Option B', 'Option C', 'Option D'],
}

const EXAMPLE_PROMPTS = [
  'compare claude vs chatgpt',
  'compare mit vs stanford',
  'compare iphone 16 vs galaxy s24',
  'compare attention is all you need vs bert',
  'compare microservices vs monolith',
]

export default function StartComparison() {
  const navigate = useNavigate()

  // 1-step natural prompt state
  const [promptText, setPromptText] = useState('')
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false)
  const [promptError, setPromptError] = useState(null)

  // Step-by-step custom configuration state
  const [itemType, setItemType] = useState('college')
  const [goal, setGoal] = useState('')
  const [items, setItems] = useState(['', ''])
  const [criteria, setCriteria] = useState(PRESET_CRITERIA.college)
  const [customCriterion, setCustomCriterion] = useState('')

  const [validationError, setValidationError] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [isSubmittingManual, setIsSubmittingManual] = useState(false)

  // Live detection for natural prompt
  const promptPreview = useMemo(() => parsePromptPreview(promptText), [promptText])

  async function handlePromptSubmit(e) {
    if (e) e.preventDefault()
    const trimmed = promptText.trim()
    if (!trimmed) {
      setPromptError('Please enter what you would like to compare (e.g. "compare claude vs chatgpt").')
      return
    }
    setIsSubmittingPrompt(true)
    setPromptError(null)

    try {
      const res = await createComparison({ prompt: trimmed })
      navigate(`/research/${res.id}`)
    } catch (err) {
      setIsSubmittingPrompt(false)
      setPromptError(
        err.response?.data?.error || 'Could not create comparison. Please check your connection and try again.'
      )
    }
  }

  function handleTypeChange(newType) {
    setItemType(newType)
    setCriteria(PRESET_CRITERIA[newType] || [])
    setValidationError(null)
  }

  function addItem() {
    setItems((prev) => [...prev, ''])
    setValidationError(null)
  }

  function removeItem(index) {
    if (items.length <= 2) return
    setItems((prev) => prev.filter((_, i) => i !== index))
    setValidationError(null)
  }

  function updateItem(index, value) {
    setItems((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    setValidationError(null)
  }

  function togglePresetCriterion(crit) {
    setCriteria((prev) =>
      prev.includes(crit) ? prev.filter((c) => c !== crit) : [...prev, crit]
    )
    setValidationError(null)
  }

  function addCustomCriterion(e) {
    if (e) e.preventDefault()
    const trimmed = customCriterion.trim()
    if (!trimmed) return
    if (!criteria.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setCriteria((prev) => [...prev, trimmed])
    }
    setCustomCriterion('')
    setValidationError(null)
  }

  function removeCriterion(crit) {
    setCriteria((prev) => prev.filter((c) => c !== crit))
    setValidationError(null)
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    setValidationError(null)
    setSubmitError(null)

    if (!itemType) {
      setValidationError('Please select a comparison type.')
      return
    }

    if (!goal.trim()) {
      setValidationError('Please enter a goal for your comparison.')
      return
    }

    const trimmedItems = items.map((i) => i.trim())
    if (trimmedItems.some((i) => !i)) {
      setValidationError('All option fields must be filled in. Please enter a name for every option.')
      return
    }

    if (trimmedItems.length < 2) {
      setValidationError('Please provide at least two options to compare.')
      return
    }

    const lowerItems = trimmedItems.map((i) => i.toLowerCase())
    const uniqueItems = new Set(lowerItems)
    if (uniqueItems.size !== trimmedItems.length) {
      setValidationError('Options must have unique names. Duplicate names are not allowed.')
      return
    }

    const trimmedCriteria = criteria.map((c) => c.trim()).filter(Boolean)
    if (trimmedCriteria.length === 0) {
      setValidationError('Please select or add at least one criterion.')
      return
    }

    setIsSubmittingManual(true)
    createComparison({
      item_type: itemType,
      goal: goal.trim(),
      items: trimmedItems,
      criteria: trimmedCriteria,
    })
      .then((res) => {
        navigate(`/research/${res.id}`)
      })
      .catch((err) => {
        setIsSubmittingManual(false)
        setSubmitError(
          err.response?.data?.error || 'Could not create comparison. Please check your connection and try again.'
        )
      })
  }

  const presets = PRESET_CRITERIA[itemType] || []

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800">Start a new comparison</h1>
      <p className="mt-1 text-slate-500">
        Compare options in plain English, or configure criteria step-by-step.
      </p>

      {/* 1-Step Natural Language Comparison Prompt Box */}
      <div className="mt-6 rounded-lg border-2 border-slate-800/15 bg-gradient-to-b from-slate-50 to-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-800 text-white text-xs font-bold">
            ✦
          </span>
          <h2 className="text-base font-semibold text-slate-800">
            Compare anything in one sentence
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          Type naturally like <span className="font-medium text-slate-700">&quot;compare claude vs chatgpt&quot;</span> or <span className="font-medium text-slate-700">&quot;mit vs stanford for undergraduate&quot;</span>. We will automatically identify the items, domain, and evaluation criteria.
        </p>

        <form onSubmit={handlePromptSubmit} className="mt-4 space-y-3">
          <div>
            <textarea
              rows={2}
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value)
                setPromptError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handlePromptSubmit()
                }
              }}
              placeholder="e.g. compare claude vs chatgpt"
              className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-800 focus:outline-none bg-white"
            />
          </div>

          {/* Real-time detection feedback */}
          {promptPreview.ready && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5 font-medium">
              <span>✓ Ready to compare:</span>
              <span className="font-semibold">{promptPreview.items.join(' vs ')}</span>
              {promptPreview.domain && (
                <span className="text-emerald-600 font-normal">· Category: {promptPreview.domain}</span>
              )}
            </div>
          )}

          {/* Quick example chips */}
          <div className="pt-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Quick examples:
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setPromptText(ex)
                    setPromptError(null)
                  }}
                  className="rounded-full bg-white border border-slate-200 hover:border-slate-400 text-slate-600 hover:text-slate-800 px-3 py-1 text-xs font-medium transition"
                >
                  ⚡ {ex}
                </button>
              ))}
            </div>
          </div>

          {promptError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
              {promptError}
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmittingPrompt || !promptText.trim()}
              className="rounded-full bg-slate-800 text-white text-sm font-medium px-6 py-2.5 hover:bg-slate-700 disabled:opacity-50 transition shadow-sm"
            >
              {isSubmittingPrompt ? 'Gathering facts & comparing…' : 'Compare Now →'}
            </button>
            <span className="text-xs text-slate-400">Gathers real facts & runs 6-factor scorecard</span>
          </div>
        </form>
      </div>

      {/* Visual divider */}
      <div className="my-10 flex items-center gap-4">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Or configure step-by-step
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Step-by-step manual form */}
      <form onSubmit={handleManualSubmit} className="space-y-6">
        {/* Comparison Type */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <label className="block text-sm font-semibold text-slate-800">1. Comparison category</label>
          <p className="text-xs text-slate-500 mt-0.5">What kind of options are you evaluating?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMPARISON_TYPES.map((t) => {
              const isSelected = itemType === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeChange(t.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium border transition ${
                    isSelected
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Comparison Goal */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <label htmlFor="goal-input" className="block text-sm font-semibold text-slate-800">
            2. Comparison goal
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            Describe what decision you are trying to make or what outcome you need.
          </p>
          <textarea
            id="goal-input"
            rows={2}
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value)
              setValidationError(null)
            }}
            placeholder={
              itemType === 'college'
                ? 'e.g. I want to choose the best college based on cost, placement and reputation.'
                : itemType === 'ai_model'
                ? 'e.g. I want to choose the most reliable coding assistant model for production use.'
                : itemType === 'product'
                ? 'e.g. I want to choose the best smartphone for photography and battery life.'
                : 'e.g. I want to compare options to make an informed choice.'
            }
            className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
          />
        </div>

        {/* Comparison Items / Options */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                3. Options to evaluate ({items.length})
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter two or more options you want to evaluate side by side.
              </p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="rounded-full border border-slate-300 text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50 transition"
            >
              + Add another option
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item, index) => {
              const placeholders = ITEM_PLACEHOLDERS[itemType] || ITEM_PLACEHOLDERS.other
              const placeholder = placeholders[index % placeholders.length]
              const label =
                index === 0
                  ? 'First option'
                  : index === 1
                  ? 'Second option'
                  : `Option ${index + 1}`

              return (
                <div key={index} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
                    {label}
                  </span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateItem(index, e.target.value)}
                    placeholder={`e.g. ${placeholder}`}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
                  />
                  {items.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition shrink-0"
                      title="Remove this option"
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Criteria */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <label className="block text-sm font-semibold text-slate-800">
            4. Criteria ({criteria.length} selected)
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            Select standard criteria or add custom criteria relevant to your comparison.
          </p>

          {/* Preset Criteria toggles */}
          {presets.length > 0 && (
            <div className="mt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Preset suggestions:
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {presets.map((crit) => {
                  const isChecked = criteria.includes(crit)
                  return (
                    <button
                      key={crit}
                      type="button"
                      onClick={() => togglePresetCriterion(crit)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition ${
                        isChecked
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isChecked ? '✓' : '+'} {crit}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Active criteria list */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Active criteria:
            </span>
            {criteria.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400 italic">No criteria selected yet.</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {criteria.map((crit) => (
                  <span
                    key={crit}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 px-3 py-1 text-xs font-medium"
                  >
                    <span>{crit}</span>
                    <button
                      type="button"
                      onClick={() => removeCriterion(crit)}
                      className="text-slate-400 hover:text-slate-700 focus:outline-none"
                      title={`Remove ${crit}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Add custom criterion */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Add custom criterion:
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="text"
                value={customCriterion}
                onChange={(e) => setCustomCriterion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomCriterion()
                  }
                }}
                placeholder="e.g. Battery life, Accreditation, Ease of use"
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addCustomCriterion}
                className="rounded-full border border-slate-300 text-slate-700 text-xs font-medium px-4 py-2 hover:bg-slate-50 transition shrink-0"
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {validationError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">
            {validationError}
          </div>
        )}

        {/* Backend Submit Errors */}
        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">
            {submitError}
          </div>
        )}

        {/* Submit action */}
        <div className="pt-2 flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmittingManual}
            className="rounded-full bg-slate-800 text-white text-sm font-medium px-6 py-2.5 hover:bg-slate-700 disabled:opacity-50 transition shadow-sm"
          >
            {isSubmittingManual ? 'Creating comparison…' : 'Create comparison →'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-full border border-slate-300 text-slate-700 text-sm font-medium px-5 py-2.5 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
