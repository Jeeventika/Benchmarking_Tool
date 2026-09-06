import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createComparison } from '../api/comparisons'

const SUGGESTED_PROMPTS = [
  'Compare iPhone 17 and Galaxy S26 for camera, battery life and price.',
  'Which is better for a student, MacBook Air or Dell XPS?',
  'Compare iPhone 17, Galaxy S26 and Pixel 11 for photography and battery life.',
  'Compare MIT and Stanford for computer science and tell me which is better for research.',
  'Compare Tesla Model 3, BYD Seal and Hyundai Ioniq 6 for range, safety and value.',
  'Which is better for a beginner, Python or JavaScript? I care about learning difficulty, job opportunities, ecosystem and performance.',
]

export default function Home() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Document upload state (for comparing research papers/documents)
  const [mode, setMode] = useState('text') // 'text' | 'document'
  const [docPrompt, setDocPrompt] = useState(
    'Compare these research papers and tell me which has stronger methodology and evidence.'
  )
  const [documents, setDocuments] = useState([
    { id: 1, name: '', text: '', fileName: '' },
    { id: 2, name: '', text: '', fileName: '' },
  ])
  const fileInputRefs = useRef({})

  async function handleTextSubmit(e) {
    if (e) e.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError('Please type what you would like to compare.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await createComparison({ prompt: trimmed })
      navigate(`/research/${res.id}`)
    } catch (err) {
      setIsSubmitting(false)
      setError(
        err.response?.data?.error ||
          'Could not start comparison. Please ensure the backend server is running.'
      )
    }
  }

  function handleFileRead(file, docIndex) {
    if (!file) return
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setDocuments((prev) => {
        const next = [...prev]
        next[docIndex] = {
          ...next[docIndex],
          name: file.name.replace(/\.[^/.]+$/, ''),
          fileName: file.name,
          text: e.target.result || '',
          isPdf,
        }
        return next
      })
      setError(null)
    }
    reader.onerror = () => {
      setError(`Failed to read file ${file.name}`)
    }
    if (isPdf) {
      reader.readAsDataURL(file)
    } else {
      reader.readAsText(file)
    }
  }

  function addDocumentSlot() {
    setDocuments((prev) => [
      ...prev,
      { id: Date.now(), name: '', text: '', fileName: '' },
    ])
    setError(null)
  }

  function removeDocumentSlot(index) {
    if (documents.length <= 2) return
    setDocuments((prev) => prev.filter((_, i) => i !== index))
    setError(null)
  }

  function updateDocumentName(index, newName) {
    setDocuments((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], name: newName }
      return next
    })
  }

  async function handleDocumentSubmit(e) {
    if (e) e.preventDefault()
    const validDocs = documents.filter((d) => d.name.trim() && d.text.trim())
    if (validDocs.length < 2) {
      setError('Please provide text or upload at least two research documents to compare.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await createComparison({
        item_type: 'research_paper',
        prompt: docPrompt.trim(),
        goal: docPrompt.trim() || `Compare research papers: ${validDocs.map((d) => d.name).join(' vs ')}`,
        documents: validDocs.map((d) => ({ name: d.name.trim(), text: d.text, fileName: d.fileName })),
      })
      navigate(`/research/${res.id}`)
    } catch (err) {
      setIsSubmitting(false)
      const errorMsg =
        err.response?.data?.error ||
        (err.response?.status === 413
          ? 'Uploaded document exceeds maximum allowed size.'
          : 'Failed to compare documents. Please try again.')
      setError(errorMsg)
    }
  }

  function loadSampleResearchDocuments() {
    setDocPrompt('Compare these research papers and determine which provides stronger evidence.')
    setDocuments([
      {
        id: 1,
        name: 'Attention Is All You Need (Vaswani et al., 2017)',
        fileName: 'Attention_Is_All_You_Need.pdf',
        text: 'Section 1: Introduction. We propose the Transformer, a model architecture eschewing recurrence and relying entirely on attention mechanisms to draw global dependencies between input and output. Section 3: Model Architecture. Scaled Dot-Product Attention with multi-head self-attention. Section 5: Dataset. WMT 2014 English-German (4.5M pairs) and English-French (36M pairs). Section 6: Results. 28.4 BLEU on En-De and 41.8 BLEU on En-Fr. Section 4: Limitations. Computational and memory complexity scales quadratically O(n^2) with sequence length.',
      },
      {
        id: 2,
        name: 'BERT: Pre-training of Deep Bidirectional Transformers (Devlin et al., 2019)',
        fileName: 'BERT_Pretraining.pdf',
        text: 'Section 1: Introduction. BERT introduces bidirectional representation learning by pre-training on unlabeled text. Section 3: Methodology. Masked Language Model (MLM) and Next Sentence Prediction (NSP). Section 3.1: Dataset. BooksCorpus (800M words) and English Wikipedia (2,500M words). Section 4: Results. 80.5% average score across GLUE benchmark and 86.7% F1 on SQuAD 1.1. Section 3.1: Limitations. Mismatch between pre-training with [MASK] tokens and fine-tuning where [MASK] does not appear; high compute requirement of 64 TPUs for 4 days.',
      },
    ])
    setError(null)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* Simple ChatGPT-style Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">
            Compare anything
          </h1>
          <p className="text-sm text-slate-500">
            Ask to compare any products, universities, AI models, software, or upload research papers.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('text')
                setError(null)
              }}
              className={`rounded-full px-4 py-1.5 transition ${
                mode === 'text'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Natural Prompt
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('document')
                setError(null)
              }}
              className={`rounded-full px-4 py-1.5 transition ${
                mode === 'document'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Compare research documents
            </button>
          </div>
        </div>

        {/* Central Composer Box */}
        {mode === 'text' ? (
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <div className="rounded-2xl border border-slate-300 bg-white p-3 shadow-sm focus-within:border-slate-800 focus-within:ring-1 focus-within:ring-slate-800 transition">
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleTextSubmit()
                  }
                }}
                placeholder="Ask me to compare two or more options... (e.g. Compare iPhone 17 and Galaxy S26 for camera, battery life and price)"
                className="w-full resize-none border-0 p-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0"
              />
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[10px]">Enter ↵</kbd> to compare
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !prompt.trim()}
                  className="rounded-full bg-slate-800 text-white text-xs font-medium px-4 py-2 hover:bg-slate-700 disabled:opacity-40 transition shadow-xs"
                >
                  {isSubmitting ? 'Comparing…' : 'Compare →'}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium text-center">
                {error}
              </div>
            )}

            {/* Quick Suggestions */}
            <div className="space-y-2 pt-2">
              <span className="block text-center text-xs text-slate-400 font-medium">
                Try one of these examples:
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPrompt(p)
                      setError(null)
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-800 transition shadow-2xs"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </form>
        ) : (
          /* Dynamic Document Upload Composer for Research Papers (2 or more) */
          <form onSubmit={handleDocumentSubmit} className="space-y-4">
            <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm space-y-4">
              {/* Question / Prompt for the papers */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your research comparison question:
                </label>
                <input
                  type="text"
                  value={docPrompt}
                  onChange={(e) => setDocPrompt(e.target.value)}
                  placeholder="e.g. Which paper has the stronger methodology and experimental evidence?"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-slate-800">
                  Attached Research Documents ({documents.length})
                </span>
                <button
                  type="button"
                  onClick={loadSampleResearchDocuments}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                >
                  Load sample real research papers (Attention vs. BERT)
                </button>
              </div>

              {/* Dynamic Document List */}
              <div className="space-y-3">
                {documents.map((doc, index) => (
                  <div
                    key={doc.id || index}
                    className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={doc.name}
                        onChange={(e) => updateDocumentName(index, e.target.value)}
                        placeholder={`Document ${index + 1} Title`}
                        className="w-full font-medium text-xs text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-slate-800 focus:outline-none"
                      />
                      {doc.fileName && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate">
                          Attached file: {doc.fileName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="file"
                        ref={(el) => (fileInputRefs.current[index] = el)}
                        accept=".txt,.pdf,.md,.json"
                        onChange={(e) => handleFileRead(e.target.files?.[0], index)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[index]?.click()}
                        className="text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-300 rounded-full px-3 py-1 bg-white hover:bg-slate-50 transition"
                      >
                        {doc.text ? 'Change file' : 'Attach file'}
                      </button>

                      {documents.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeDocumentSlot(index)}
                          className="text-xs text-red-600 hover:text-red-800 p-1"
                          title="Remove document"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={addDocumentSlot}
                  className="rounded-full border border-slate-300 text-slate-700 text-xs font-medium px-3.5 py-1.5 hover:bg-slate-50 transition"
                >
                  + Add another document
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || documents.filter((d) => d.name.trim() && d.text.trim()).length < 2}
                  className="rounded-full bg-slate-800 text-white text-xs font-medium px-5 py-2 hover:bg-slate-700 disabled:opacity-40 transition shadow-xs"
                >
                  {isSubmitting ? 'Extracting document facts…' : 'Compare Documents →'}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium text-center">
                {error}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
