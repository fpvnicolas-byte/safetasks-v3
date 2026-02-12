import type { AiSuggestion, ScriptAnalysis } from '@/types'

export interface SuggestionGroup {
  key: string
  analysis: ScriptAnalysis | null
  suggestions: AiSuggestion[]
}

function toTimestamp(value: string): number {
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : 0
}

export function groupSuggestionsByAnalysis(params: {
  suggestions: AiSuggestion[]
  analyses?: ScriptAnalysis[]
  projectId?: string
}): SuggestionGroup[] {
  const { suggestions, analyses = [], projectId } = params

  if (!suggestions.length) return []

  const projectAnalyses = analyses
    .filter((analysis) => !projectId || analysis.project_id === projectId)
    .slice()
    .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))

  const sortedSuggestions = suggestions
    .slice()
    .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))

  const grouped = new Map<string, SuggestionGroup>()

  for (const suggestion of sortedSuggestions) {
    const suggestionTs = toTimestamp(suggestion.created_at)
    const matchedAnalysis =
      projectAnalyses.find((analysis) => toTimestamp(analysis.created_at) <= suggestionTs) || null
    const key = matchedAnalysis?.id || 'ungrouped'

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        analysis: matchedAnalysis,
        suggestions: [],
      })
    }
    grouped.get(key)!.suggestions.push(suggestion)
  }

  const orderedGroups: SuggestionGroup[] = []
  for (const analysis of projectAnalyses) {
    const group = grouped.get(analysis.id)
    if (group) orderedGroups.push(group)
  }

  const ungrouped = grouped.get('ungrouped')
  if (ungrouped) orderedGroups.push(ungrouped)

  return orderedGroups
}
