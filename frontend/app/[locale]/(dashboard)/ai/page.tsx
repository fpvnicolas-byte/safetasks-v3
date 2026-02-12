'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useAiAnalysis, useAiSuggestions, useAiRecommendations, useAnalyzeScript, useDeleteAiAnalysis } from '@/lib/api/hooks/useAiFeatures'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { apiClient } from '@/lib/api/client'
import { groupSuggestionsByAnalysis } from '@/lib/ai/suggestion-groups'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Sparkles,
  Brain,
  FileText,
  DollarSign,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle,
  Trash2
} from 'lucide-react'
import type { AiSuggestion, AiRecommendation, ScriptAnalysis } from '@/types'
import { toast } from 'sonner'
import { useTranslations, useLocale } from 'next-intl'

export default function AiFeaturesPage() {
  const t = useTranslations('ai')
  const tFeedback = useTranslations('common.feedback')
  const tCommonLabels = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const { organizationId } = useAuth()

  const [analysisProjectId, setAnalysisProjectId] = useState<string>('')
  const [suggestionsProjectId, setSuggestionsProjectId] = useState<string>('')
  const [recommendationsProjectId, setRecommendationsProjectId] = useState<string>('')
  const [scriptText, setScriptText] = useState<string>('')
  const [analysisType, setAnalysisType] = useState<string>('full')
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null)
  const [analysisToDelete, setAnalysisToDelete] = useState<ScriptAnalysis | null>(null)

  // Queries
  const { data: analyses, isLoading: isLoadingAnalyses } = useAiAnalysis(organizationId!)
  const { data: suggestions, isLoading: isLoadingSuggestions } = useAiSuggestions(suggestionsProjectId)
  const { data: recommendations, isLoading: isLoadingRecommendations } = useAiRecommendations(recommendationsProjectId)
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { mutateAsync: analyzeScript, isPending: isAnalyzing } = useAnalyzeScript()
  const { mutateAsync: deleteAnalysis } = useDeleteAiAnalysis()
  const [usageData, setUsageData] = useState<{
    usage: { ai_credits: number }
    limits: { ai_credits: number | null }
  } | null>(null)
  const [isUsageLoading, setIsUsageLoading] = useState(false)

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && 'message' in error) {
      const maybeMessage = (error as { message?: unknown }).message
      if (typeof maybeMessage === 'string') return maybeMessage
    }
    return ''
  }

  const handleScriptAnalysis = async () => {
    if (!analysisProjectId) {
      toast.error(tFeedback('selectProject'))
      return
    }

    if (!scriptText.trim()) {
      toast.error(tFeedback('enterText'))
      return
    }

    try {
      await analyzeScript({
        project_id: analysisProjectId,
        analysis_type: analysisType as 'full' | 'characters' | 'scenes' | 'locations',
        script_content: scriptText
      })
      toast.success(tFeedback('actionSuccess'))
      setScriptText('')
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      toast.error(tFeedback('actionError', { message: message || 'Failed to start script analysis' }))
      console.error('Script analysis error:', error)
    }
  }

  const handleDeleteAnalysis = async () => {
    if (!analysisToDelete) return

    try {
      setDeletingAnalysisId(analysisToDelete.id)
      await deleteAnalysis({ analysis_id: analysisToDelete.id, project_id: analysisToDelete.project_id })
      toast.success(tFeedback('actionSuccess'))
      setAnalysisToDelete(null)
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      toast.error(tFeedback('actionError', { message: message || 'Failed to delete analysis' }))
      console.error('Delete analysis error:', error)
    } finally {
      setDeletingAnalysisId(null)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-success/15 text-success'
    if (confidence >= 0.6) return 'bg-warning/20 text-warning-foreground'
    return 'bg-destructive/15 text-destructive'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive/15 text-destructive'
      case 'medium': return 'bg-warning/20 text-warning-foreground'
      case 'low': return 'bg-success/15 text-success'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return t('recommendations.priorityMatrix.high')
      case 'medium': return t('recommendations.priorityMatrix.medium')
      case 'low': return t('recommendations.priorityMatrix.low')
      default: return priority
    }
  }

  const getSuggestionTypeLabel = (suggestionType: AiSuggestion['suggestion_type']) => {
    switch (suggestionType) {
      case 'budget': return t('suggestions.filter.types.budget')
      case 'schedule': return t('suggestions.filter.types.schedule')
      case 'casting': return t('suggestions.filter.types.casting')
      case 'logistics': return t('suggestions.filter.types.logistics')
      case 'equipment': return t('suggestions.filter.types.equipment')
      case 'other': return t('suggestions.filter.types.other')
      default: return suggestionType
    }
  }

  const getRecommendationTypeLabel = (recommendationType: AiRecommendation['recommendation_type']) => {
    switch (recommendationType) {
      case 'shooting_day': return t('recommendations.filter.types.shootingDay')
      case 'budget': return t('recommendations.filter.types.budget')
      case 'schedule': return t('recommendations.filter.types.schedule')
      case 'equipment': return t('recommendations.filter.types.equipment')
      default: return recommendationType
    }
  }

  const groupedSuggestions = groupSuggestionsByAnalysis({
    suggestions: suggestions || [],
    analyses: analyses || [],
    projectId: suggestionsProjectId,
  })

  const calculatePercentage = (current: number, limit: number | null): number => {
    if (limit === null) return 0
    if (limit === 0) return 100
    return Math.min((current / limit) * 100, 100)
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-destructive'
    if (percentage >= 75) return 'bg-warning'
    return 'bg-primary'
  }

  const loadUsage = async () => {
    try {
      setIsUsageLoading(true)
      const data = await apiClient.get<{
        usage?: { ai_credits?: number }
        limits?: { ai_credits?: number | null }
      }>('/api/v1/billing/usage')
      setUsageData({
        usage: { ai_credits: data.usage?.ai_credits ?? 0 },
        limits: { ai_credits: data.limits?.ai_credits ?? null },
      })
    } catch (error) {
      console.error('Failed to load AI usage:', error)
    } finally {
      setIsUsageLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) {
      loadUsage()
    }
  }, [organizationId])

  return (
    <div className="space-y-6">
      <ConfirmDeleteDialog
        open={!!analysisToDelete}
        onOpenChange={(open) => {
          if (!open) setAnalysisToDelete(null)
        }}
        onConfirm={handleDeleteAnalysis}
        loading={deletingAnalysisId === analysisToDelete?.id}
        title="Delete analysis?"
        description="Delete this analysis and its generated suggestions/recommendations? This cannot be undone."
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/projects')}
          >
            {t('viewProjects')}
          </Button>
          <Button
            onClick={() => router.push('/ai/script-analysis')}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {t('analyzeScript')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="suggestions">{t('tabs.suggestions')}</TabsTrigger>
          <TabsTrigger value="recommendations">{t('tabs.recommendations')}</TabsTrigger>
          <TabsTrigger value="analysis">{t('tabs.analysis')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* AI Usage */}
          <Card>
            <CardHeader>
              <CardTitle>{t('usage.title')}</CardTitle>
              <CardDescription>{t('usage.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isUsageLoading ? (
                <div className="text-sm text-muted-foreground">{t('usage.loading')}</div>
              ) : usageData ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('usage.label')}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usageData.usage.ai_credits} / {usageData.limits.ai_credits ?? t('usage.unlimited')}
                    </span>
                  </div>
                  {usageData.limits.ai_credits !== null && (
                    <Progress
                      value={calculatePercentage(usageData.usage.ai_credits, usageData.limits.ai_credits)}
                      className={getProgressColor(calculatePercentage(usageData.usage.ai_credits, usageData.limits.ai_credits))}
                    />
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">{t('usage.unavailable')}</div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>{t('quickActions.title')}</CardTitle>
              <CardDescription>{t('quickActions.desc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push('/ai/script-analysis')}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{t('quickActions.scriptAnalysis.title')}</CardTitle>
                    <FileText className="h-8 w-8 text-info" />
                  </div>
                  <CardDescription>
                    {t('quickActions.scriptAnalysis.desc')}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push('/ai/budget-estimation')}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{t('quickActions.budgetEstimation.title')}</CardTitle>
                    <DollarSign className="h-8 w-8 text-success" />
                  </div>
                  <CardDescription>
                    {t('quickActions.budgetEstimation.desc')}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push('/ai/shooting-day-suggestions')}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{t('quickActions.shootingDay.title')}</CardTitle>
                    <Calendar className="h-8 w-8 text-warning-foreground" />
                  </div>
                  <CardDescription>
                    {t('quickActions.shootingDay.desc')}
                  </CardDescription>
                </CardHeader>
              </Card>
            </CardContent>
          </Card>

          {/* Script Analysis Form */}
          <Card>
            <CardHeader>
              <CardTitle>{t('analysisForm.title')}</CardTitle>
              <CardDescription>{t('analysisForm.desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-select">{t('analysisForm.selectProject')}</Label>
                  <Select value={analysisProjectId} onValueChange={setAnalysisProjectId}>
                    <SelectTrigger id="project-select">
                      <SelectValue placeholder={t('analysisForm.selectProjectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingProjects ? (
                        <div className="p-2 text-sm text-muted-foreground">{t('empty.projects')}</div>
                      ) : projects && projects.length > 0 ? (
                        projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.title}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">{t('empty.projects')}</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="analysis-type">{t('analysisForm.analysisType')}</Label>
                  <Select value={analysisType} onValueChange={setAnalysisType}>
                    <SelectTrigger id="analysis-type">
                      <SelectValue placeholder={t('analysisForm.selectTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">{t('analysisForm.types.full')}</SelectItem>
                      <SelectItem value="scenes">{t('analysisForm.types.scenes')}</SelectItem>
                      <SelectItem value="characters">{t('analysisForm.types.characters')}</SelectItem>
                      <SelectItem value="locations">{t('analysisForm.types.locations')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('quickActions.title')}</Label>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleScriptAnalysis}
                      disabled={isAnalyzing || !analysisProjectId || !scriptText.trim()}
                      className="flex-1"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('analysisForm.analyzing')}
                        </>
                      ) : (
                        t('analysisForm.startAnalysis')
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push('/ai/script-analysis')}
                      className="flex-1"
                    >
                      {t('analysisForm.fullAnalysis')}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="script-input">{t('analysisForm.scriptText')}</Label>
                <Textarea
                  id="script-input"
                  placeholder={t('analysisForm.scriptPlaceholder')}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  className="min-h-[120px]"
                  maxLength={5000}
                />
                <div className="text-sm text-muted-foreground">
                  {scriptText.length}/5000 chars
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{t('insights.activeAnalyses.title')}</CardTitle>
                  <Brain className="h-4 w-4 text-info" />
                </div>
                <div className="text-2xl font-bold">{analyses?.length || 0}</div>
                <CardDescription>{t('insights.activeAnalyses.desc')}</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{t('insights.suggestions.title')}</CardTitle>
                  <Sparkles className="h-4 w-4 text-warning-foreground" />
                </div>
                <div className="text-2xl font-bold">{suggestions?.length || 0}</div>
                <CardDescription>{t('insights.suggestions.desc')}</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{t('insights.recommendations.title')}</CardTitle>
                  <CheckCircle className="h-4 w-4 text-success" />
                </div>
                <div className="text-2xl font-bold">{recommendations?.length || 0}</div>
                <CardDescription>{t('insights.recommendations.desc')}</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{t('insights.successRate.title')}</CardTitle>
                  <AlertCircle className="h-4 w-4 text-warning-foreground" />
                </div>
                <div className="text-2xl font-bold">94%</div>
                <CardDescription>{t('insights.successRate.desc')}</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>

	        <TabsContent value="suggestions" className="space-y-6">
	          <div className="flex justify-between items-center">
	            <h2 className="text-2xl font-bold">{t('lists.suggestionsTitle')}</h2>
	            <div className="text-sm text-muted-foreground">
	              {suggestions?.length || 0} {t('lists.available')}
	            </div>
	          </div>

	          <Card>
	            <CardContent className="py-4">
	              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
	                <div className="space-y-2">
                  <Label htmlFor="project-select-suggestions">{t('analysisForm.selectProject')}</Label>
                  <Select value={suggestionsProjectId} onValueChange={setSuggestionsProjectId}>
                    <SelectTrigger id="project-select-suggestions">
                      <SelectValue placeholder={t('analysisForm.selectProjectPlaceholder')} />
                    </SelectTrigger>
	                    <SelectContent>
	                      {isLoadingProjects ? (
	                        <div className="p-2 text-sm text-muted-foreground">{tCommonLabels('loading')}</div>
	                      ) : projects && projects.length > 0 ? (
	                        projects.map((project) => (
	                          <SelectItem key={project.id} value={project.id}>
	                            {project.title}
	                          </SelectItem>
	                        ))
	                      ) : (
	                        <div className="p-2 text-sm text-muted-foreground">{t('empty.projects')}</div>
	                      )}
	                    </SelectContent>
	                  </Select>
	                </div>
	                <div className="flex gap-2">
	                  <Button
	                    variant="outline"
	                    onClick={() => router.push('/ai/script-analysis')}
	                  >
	                    <Sparkles className="mr-2 h-4 w-4" />
	                    {t('actions.generateSuggestions')}
	                  </Button>
	                </div>
	              </div>
	            </CardContent>
	          </Card>

	          {isLoadingSuggestions ? (
	            <div className="flex justify-center items-center py-8">
	              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
	            </div>
		          ) : groupedSuggestions.length > 0 ? (
	            <div className="space-y-6">
	              {groupedSuggestions.map((group) => (
	                <div key={group.key} className="space-y-3">
	                  <div className="rounded-md border bg-muted/30 px-3 py-2">
	                    <div className="flex items-center justify-between gap-2">
	                      <div className="text-sm font-semibold">
	                        {group.analysis
	                          ? `${t('lists.analysisTitle')} - ${new Date(group.analysis.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`
	                          : t('lists.suggestionsTitle')}
	                      </div>
	                      <div className="text-xs text-muted-foreground">
	                        {group.suggestions.length} {t('tabs.suggestions')}
	                      </div>
	                    </div>
	                    {group.analysis && (
	                      <div className="mt-1 text-xs text-muted-foreground">
	                        {group.analysis.script_text.substring(0, 140)}
	                        {group.analysis.script_text.length > 140 ? '...' : ''}
	                      </div>
	                    )}
	                  </div>

	                  <div className="grid gap-6">
	                    {group.suggestions.map((suggestion: AiSuggestion) => (
	                      <Card key={suggestion.id}>
	                        <CardHeader>
	                          <div className="flex items-center justify-between">
	                            <div className="flex items-center gap-2">
	                              <Badge variant="secondary">{getSuggestionTypeLabel(suggestion.suggestion_type)}</Badge>
	                              <Badge className={getPriorityColor(suggestion.priority)}>
	                                {getPriorityLabel(suggestion.priority)}
	                              </Badge>
	                              <Badge className={getConfidenceColor(suggestion.confidence)}>
	                                {Math.round(suggestion.confidence * 100)}%
	                              </Badge>
	                            </div>
	                            <div className="text-sm text-muted-foreground">
	                              {new Date(suggestion.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
	                            </div>
	                          </div>
	                          <CardTitle>{suggestion.suggestion_text}</CardTitle>
	                        </CardHeader>
	                        <CardContent>
	                          {suggestion.related_scenes.length > 0 && (
	                            <div className="text-sm text-muted-foreground">
	                              {t('lists.relatedScenes')}: {suggestion.related_scenes.join(', ')}
	                            </div>
	                          )}
	                          {suggestion.estimated_savings_cents && (
	                            <div className="text-sm text-success mt-2">
	                              {t('lists.estimatedSavings')}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(suggestion.estimated_savings_cents / 100)}
	                            </div>
	                          )}
	                          {suggestion.estimated_time_saved_minutes && (
	                            <div className="text-sm text-info mt-1">
	                              {t('lists.timeSaved')}: {suggestion.estimated_time_saved_minutes} minutes
	                            </div>
	                          )}
	                        </CardContent>
	                      </Card>
	                    ))}
	                  </div>
	                </div>
	              ))}
	            </div>
		          ) : (
			            <Card>
			              <CardContent className="py-8 text-center text-muted-foreground">
		                {suggestionsProjectId ? t('empty.suggestions') : tFeedback('selectProject')}
		              </CardContent>
		            </Card>
		          )}
	        </TabsContent>

	        <TabsContent value="recommendations" className="space-y-6">
	          <div className="flex justify-between items-center">
	            <h2 className="text-2xl font-bold">{t('lists.recommendationsTitle')}</h2>
	            <div className="text-sm text-muted-foreground">
	              {recommendations?.length || 0} {t('lists.available')}
	            </div>
	          </div>

	          <Card>
	            <CardContent className="py-4">
	              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
	                <div className="space-y-2">
		                  <Label htmlFor="project-select-recommendations">{t('analysisForm.selectProject')}</Label>
		                  <Select value={recommendationsProjectId} onValueChange={setRecommendationsProjectId}>
		                    <SelectTrigger id="project-select-recommendations">
		                      <SelectValue placeholder={t('analysisForm.selectProjectPlaceholder')} />
		                    </SelectTrigger>
	                    <SelectContent>
	                      {isLoadingProjects ? (
	                        <div className="p-2 text-sm text-muted-foreground">{tCommonLabels('loading')}</div>
	                      ) : projects && projects.length > 0 ? (
	                        projects.map((project) => (
	                          <SelectItem key={project.id} value={project.id}>
	                            {project.title}
	                          </SelectItem>
	                        ))
	                      ) : (
	                        <div className="p-2 text-sm text-muted-foreground">{t('empty.projects')}</div>
	                      )}
	                    </SelectContent>
	                  </Select>
	                </div>
	                <div className="flex gap-2">
	                  <Button
	                    variant="outline"
	                    onClick={() => router.push('/ai/script-analysis')}
	                  >
	                    <Sparkles className="mr-2 h-4 w-4" />
	                    {t('actions.generateSuggestions')}
	                  </Button>
	                </div>
	              </div>
	            </CardContent>
	          </Card>

	          {isLoadingRecommendations ? (
	            <div className="flex justify-center items-center py-8">
	              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
	            </div>
	          ) : recommendations && recommendations.length > 0 ? (
            <div className="grid gap-6">
              {recommendations.map((recommendation: AiRecommendation) => (
                <Card key={recommendation.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{getRecommendationTypeLabel(recommendation.recommendation_type)}</Badge>
                        <Badge className={getPriorityColor(recommendation.priority)}>
                          {getPriorityLabel(recommendation.priority)}
                        </Badge>
                        <Badge className={getConfidenceColor(recommendation.confidence)}>
                          {Math.round(recommendation.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(recommendation.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <CardTitle>{recommendation.title}</CardTitle>
                    <CardDescription>{recommendation.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <h4 className="font-semibold">{t('lists.actionItems')}</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {recommendation.action_items.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>

                      {recommendation.estimated_impact.time_saved_minutes && (
                      <div className="text-sm text-info mt-2">
                        {t('lists.timeSaved')}: {recommendation.estimated_impact.time_saved_minutes} minutes
                      </div>
                    )}
                    {recommendation.estimated_impact.cost_saved_cents && (
                      <div className="text-sm text-success">
                        {t('lists.costSaved')}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(recommendation.estimated_impact.cost_saved_cents / 100)}
                      </div>
                    )}
                    {recommendation.estimated_impact.risk_reduction && (
                      <div className="text-sm text-warning-foreground">
                        {t('lists.riskReduction')}: {recommendation.estimated_impact.risk_reduction}
                      </div>
                    )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
	          ) : (
		            <Card>
		              <CardContent className="py-8 text-center text-muted-foreground">
		                {recommendationsProjectId ? t('empty.recommendations') : tFeedback('selectProject')}
		              </CardContent>
		            </Card>
		          )}
	        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{t('lists.analysisTitle')}</h2>
            <div className="text-sm text-muted-foreground">
              {analyses?.length || 0} {t('lists.completed')}
            </div>
          </div>

          {isLoadingAnalyses ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analyses && analyses.length > 0 ? (
            <div className="grid gap-6">
              {analyses.map((analysis: ScriptAnalysis) => (
                <Card key={analysis.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{analysis.analysis_type}</Badge>
                        <Badge className={getConfidenceColor(analysis.confidence)}>
                          {Math.round(analysis.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground">
                          {new Date(analysis.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAnalysisToDelete(analysis)}
                          disabled={deletingAnalysisId === analysis.id}
                        >
                          {deletingAnalysisId === analysis.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          {tCommonLabels('delete')}
                        </Button>
                      </div>
                    </div>
                    <CardTitle>{t('lists.analysisTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">{t('lists.summary')}</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {analysis.analysis_result?.scenes && (
                            <p>{t('suggestions.list.scenes')}: {analysis.analysis_result.scenes.length}</p>
                          )}
                          {analysis.analysis_result?.characters && (
                            <p>{t('suggestions.list.characters')}: {analysis.analysis_result.characters.length}</p>
                          )}
                          {analysis.analysis_result?.locations && (
                            <p>{t('suggestions.list.locations')}: {analysis.analysis_result.locations.length}</p>
                          )}
                          {analysis.analysis_result?.suggested_equipment && (
                            <p>{t('suggestions.list.equipment')}: {analysis.analysis_result.suggested_equipment.length}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">{t('lists.preview')}</h4>
                        <p className="text-sm text-muted-foreground">
                          {analysis.script_text.substring(0, 200)}...
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t('empty.analyses')}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
