export function checkNarrativeConsistency(analysisText = '', evidenceRows = []) {
  const text = String(analysisText || '').toLowerCase()
  const conflicts = []

  for (const row of evidenceRows) {
    const itemName = String(row.item_name || '').toLowerCase()
    const criterion = String(row.criterion || '').toLowerCase()
    const sourceValue = String(row.result || '')

    const sourceNumbers = [
      ...sourceValue.matchAll(/\b\d+(?:\.\d+)?\b/g)
    ].map((match) => match[0])

    if (sourceNumbers.length === 0) continue

    const itemIndex = text.indexOf(itemName)
    if (itemIndex === -1) continue

    const nextItemIndex = text.indexOf('\n', itemIndex + itemName.length)
    const itemSection = text.slice(
      itemIndex,
      nextItemIndex === -1 ? text.length : nextItemIndex + 500
    )

    const criterionIndex = itemSection.indexOf(criterion)
    if (criterionIndex === -1) continue

    const criterionSection = itemSection.slice(
      criterionIndex,
      criterionIndex + 250
    )

    const hasConflict = sourceNumbers.some(
      (number) => !criterionSection.includes(number)
    )

    if (hasConflict) {
      conflicts.push({
        item_name: row.item_name,
        criterion: row.criterion,
        source_value: sourceValue
      })
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  }
}
