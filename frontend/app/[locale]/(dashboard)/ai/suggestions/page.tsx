'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { useAiSuggestions, useAiBudgetEstimation, useAiShootingDaySuggestions } from '@/lib/api/hooks/useAiFeatures'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Sparkles,
  DollarSign,
  Calendar,
  Users,
  Settings,
  FileText,
  Loader2,
  TrendingUp,
  Clock,
  Target
} from 'lucide-react'
import type { AiSuggestion } from '@/types'
import { useLocale, useTranslations } from 'next-intl'

export default function AiSuggestionsPage() {
  const router = useRouter()
  const locale = useLocale()
  const { organizationId } = useAuth()
  const tCommon = useTranslations('common.feedback')
  const t = useTranslations('ai')

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [suggestionType, setSuggestionType] = useState<'all' | 'budget' | 'schedule' | 'casting' | 'logistics' | 'equipment' | 'other'>('all')

  // Queries
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { data: suggestions, isLoading: isLoadingSuggestions } = useAiSuggestions(selectedProjectId)
  const { mutateAsync: generateBudgetEstimation, isPending: isGeneratingBudget } = useAiBudgetEstimation()
  const { mutateAsync: generateShootingDay, isPending: isGeneratingShootingDay } = useAiShootingDaySuggestions()

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    return ''
  }

  const handleGenerateBudget = async () => {
    if (!selectedProjectId) {
      toast.error(tCommon('selectProject'))
      return
    }

    try {
      const result = await generateBudgetEstimation({
        project_id: selectedProjectId,
        estimation_type: 'detailed',
        script_content: 'Generated from suggestions page'
      })
      toast.success(tCommon('actionSuccess'))
      console.log('Budget estimation:', result)
    } catch (error: unknown) {
      toast.error(tCommon('actionError', { message: getErrorMessage(error) || 'Failed to generate budget estimation' }))
      console.error('Budget estimation error:', error)
    }
  }

  const handleGenerateShootingDay = async () => {
    if (!selectedProjectId) {
      toast.error(tCommon('selectProject'))
      return
    }

    try {
      const result = await generateShootingDay({
        project_id: selectedProjectId,
        suggestion_type: 'optimized',
        script_content: 'Generated from suggestions page'
      })
      toast.success(tCommon('actionSuccess'))
      console.log('Shooting day suggestions:', result)
    } catch (error: unknown) {
      toast.error(tCommon('actionError', { message: getErrorMessage(error) || 'Failed to generate shooting day suggestions' }))
      console.error('Shooting day generation error:', error)
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

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'budget': return <DollarSign className="h-4 w-4" />
      case 'schedule': return <Calendar className="h-4 w-4" />
      case 'casting': return <Users className="h-4 w-4" />
      case 'logistics': return <Settings className="h-4 w-4" />
      case 'equipment': return <FileText className="h-4 w-4" />
      case 'other': return <Sparkles className="h-4 w-4" />
      default: return <Sparkles className="h-4 w-4" />
    }
  }

  const filteredSuggestions = suggestions?.filter((s: AiSuggestion) =>
    suggestionType === 'all' || s.suggestion_type === suggestionType
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('suggestions.pageTitle')}</h1>
          <p className="text-muted-foreground">
            {t('suggestions.pageSubtitle')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/ai')}
        >
          {t('actions.viewAiDashboard')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('suggestions.generate.title')}</CardTitle>
            <CardDescription>
              {t('suggestions.generate.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project">{t('shootingDaySuggestions.settings.projectLabel')}</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder={t('shootingDaySuggestions.settings.selectProjectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingProjects ? (
                    <div className="p-2 text-sm text-muted-foreground">{t('common.loading')}</div>
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

            {/* Suggestion Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="suggestion-type">{t('suggestions.filter.typeLabel')}</Label>
              <Select value={suggestionType} onValueChange={(value) => setSuggestionType(value as 'budget' | 'schedule' | 'casting' | 'logistics' | 'equipment' | 'other' | 'all')}>
                <SelectTrigger id="suggestion-type">
                  <SelectValue placeholder={t('suggestions.filter.typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('suggestions.filter.types.all')}</SelectItem>
                  <SelectItem value="budget">{t('suggestions.filter.types.budget')}</SelectItem>
                  <SelectItem value="schedule">{t('suggestions.filter.types.schedule')}</SelectItem>
                  <SelectItem value="casting">{t('suggestions.filter.types.casting')}</SelectItem>
                  <SelectItem value="logistics">{t('suggestions.filter.types.logistics')}</SelectItem>
                  <SelectItem value="equipment">{t('suggestions.filter.types.equipment')}</SelectItem>
                  <SelectItem value="other">{t('suggestions.filter.types.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h4 className="font-semibold">{t('quickActions.title')}</h4>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleGenerateBudget}
                  disabled={isGeneratingBudget || !selectedProjectId}
                >
                  {isGeneratingBudget ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('actions.generating')}
                    </>
                  ) : (
                    <>
                      <DollarSign className="mr-2 h-4 w-4" />
                      {t('actions.generateBudgetSuggestions')}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleGenerateShootingDay}
                  disabled={isGeneratingShootingDay || !selectedProjectId}
                >
                  {isGeneratingShootingDay ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('actions.generating')}
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      {t('actions.generateScheduleSuggestions')}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Statistics */}
            {suggestions && (
              <div className="space-y-3">
                <h4 className="font-semibold">{t('suggestions.stats.title') || 'Statistics'}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/60 p-2 rounded">
                    <span className="text-muted-foreground">{t('suggestions.stats.total')}</span>
                    <div className="font-bold">{suggestions.length}</div>
                  </div>
                  <div className="bg-destructive/10 p-2 rounded">
                    <span className="text-destructive">{t('suggestions.stats.highPriority')}</span>
                    <div className="font-bold">
                      {suggestions.filter((s: AiSuggestion) => s.priority === 'high').length}
                    </div>
                  </div>
                  <div className="bg-warning/20 p-2 rounded">
                    <span className="text-warning-foreground">{t('suggestions.stats.mediumPriority')}</span>
                    <div className="font-bold">
                      {suggestions.filter((s: AiSuggestion) => s.priority === 'medium').length}
                    </div>
                  </div>
                  <div className="bg-info/15 p-2 rounded">
                    <span className="text-info-foreground">{t('suggestions.stats.avgConfidence')}</span>
                    <div className="font-bold">
                      {suggestions.length > 0
                        ? Math.round(suggestions.reduce((acc: number, s: AiSuggestion) => acc + s.confidence, 0) / suggestions.length * 100)
                        : 0}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suggestions List */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{t('suggestions.list.title')}</CardTitle>
              <div className="text-sm text-muted-foreground">
                {filteredSuggestions.length} {t('lists.suggestionsTitle') || 'suggestions'}
              </div>
            </div>
            <CardDescription>
              {t('suggestions.list.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSuggestions ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSuggestions.length > 0 ? (
              <div className="space-y-4">
                {filteredSuggestions.map((suggestion: AiSuggestion) => (
                  <Card key={suggestion.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-full">
                            {getSuggestionIcon(suggestion.suggestion_type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{getSuggestionTypeLabel(suggestion.suggestion_type)}</Badge>
                              <Badge className={getPriorityColor(suggestion.priority)}>
                                {getPriorityLabel(suggestion.priority)}
                              </Badge>
                              <Badge className={getConfidenceColor(suggestion.confidence)}>
                                {Math.round(suggestion.confidence * 100)}%
                              </Badge>
                            </div>
                            <CardTitle className="text-lg mt-1">{suggestion.suggestion_text}</CardTitle>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(suggestion.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">{t('suggestions.list.details')}</h4>
                          {suggestion.related_scenes.length > 0 && (
                            <div className="text-sm text-muted-foreground mb-2">
                              <span className="font-medium">{t('suggestions.list.relatedScenes')}</span> {suggestion.related_scenes.join(', ')}
                            </div>
                          )}
                          {suggestion.estimated_savings_cents && (
                            <div className="text-sm text-success mb-1">
                              <span className="font-medium">{t('suggestions.list.estimatedSavings')}</span> {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(suggestion.estimated_savings_cents / 100)}
                            </div>
                          )}
                          {suggestion.estimated_time_saved_minutes && (
                            <div className="text-sm text-info">
                              <span className="font-medium">{t('suggestions.list.timeSaved')}</span> {suggestion.estimated_time_saved_minutes} minutes
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">{t('suggestions.list.impact')}</h4>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex justify-between">
                              <span>{t('suggestions.list.costEfficiency')}</span>
                              <span className="font-medium">High</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t('suggestions.list.timeSavings')}</span>
                              <span className="font-medium">Medium</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t('suggestions.list.riskReduction')}</span>
                              <span className="font-medium">Low</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                  <Sparkles className="h-12 w-12 text-muted-foreground/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{t('suggestions.noSuggestions.title')}</h3>
                <p className="text-muted-foreground mb-4">
                  {selectedProjectId
                    ? t('suggestions.noSuggestions.description')
                    : t('suggestions.noSuggestions.selectProject')
                  }
                </p>
                {selectedProjectId && (
                  <div className="space-y-2">
                    <Button
                      onClick={handleGenerateBudget}
                      disabled={isGeneratingBudget}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      {t('actions.generateBudgetSuggestions')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleGenerateShootingDay}
                      disabled={isGeneratingShootingDay}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {t('actions.generateScheduleSuggestions')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      {suggestions && suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('suggestions.insights.title')}</CardTitle>
            <CardDescription>
              {t('suggestions.insights.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-destructive" />
                    <CardTitle className="text-sm font-medium">{t('suggestions.insights.topPriority')}</CardTitle>
                  </div>
                  <div className="text-2xl font-bold">
                    {suggestions.find((s: AiSuggestion) => s.priority === 'high')?.suggestion_text || 'No high priority suggestions'}
                  </div>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-info" />
                    <CardTitle className="text-sm font-medium">{t('suggestions.insights.timeSavings')}</CardTitle>
                  </div>
                  <div className="text-2xl font-bold">
                    {suggestions.reduce((acc: number, s: AiSuggestion) => acc + (s.estimated_time_saved_minutes || 0), 0)} minutes
                  </div>
                  <CardDescription>
                    {t('suggestions.insights.timeSavingsDesc')}
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-success" />
                    <CardTitle className="text-sm font-medium">{t('suggestions.insights.costSavings')}</CardTitle>
                  </div>
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      suggestions.reduce((acc: number, s: AiSuggestion) => acc + (s.estimated_savings_cents || 0), 0) / 100
                    )}
                  </div>
                  <CardDescription>
                    {t('suggestions.insights.costSavingsDesc')}
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
