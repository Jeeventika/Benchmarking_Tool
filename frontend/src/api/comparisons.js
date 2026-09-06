import client from './client'

export const getComparisons = () => client.get('/comparisons').then((r) => r.data)

export const getComparison = (id) => client.get(`/comparisons/${id}`).then((r) => r.data)

export const getEvidence = (id) => client.get(`/comparisons/${id}/evidence`).then((r) => r.data)

export const getComparability = (id) =>
  client.get(`/comparisons/${id}/comparability`).then((r) => r.data)

export const getAnalysis = (id) => client.get(`/comparisons/${id}/analysis`).then((r) => r.data)

export const getRecommendation = (id) =>
  client.get(`/comparisons/${id}/recommendation`).then((r) => r.data)

export const getDecision = (id) => client.get(`/comparisons/${id}/decision`).then((r) => r.data)

export const submitDecision = (id, payload) =>
  client.post(`/comparisons/${id}/decision`, payload).then((r) => r.data)
