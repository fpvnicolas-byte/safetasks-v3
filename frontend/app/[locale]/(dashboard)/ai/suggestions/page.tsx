'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { useAiSuggestions, useAiBudgetEstimation, useAiCallSheetSuggestions } from '@/lib/api/hooks/useAiFeatures'
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
  const { user, organizationId } = useAuth()
  const tCommon = useTranslations('common.feedback')
  const t = useTranslations('ai')

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [suggestionType, setSuggestionType] = useState<'all' | 'budget' | 'schedule' | 'casting' | 'logistics' | 'equipment' | 'other'>('all')

  // Queries
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { data: suggestions, isLoading: isLoadingSuggestions } = useAiSuggestions(selectedProjectId)
  const { mutateAsync: generateBudgetEstimation, isPending: isGeneratingBudget } = useAiBudgetEstimation()
  const { mutateAsync: generateCallSheet, isPending: isGeneratingCallSheet } = useAiCallSheetSuggestions()

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
    } catch (error: any) {
      toast.error(tCommon('actionError', { message: 'Failed to generate budget estimation' }))
      console.error('Budget estimation error:', error)
    }
  }

  const handleGenerateCallSheet = async () => {
    if (!selectedProjectId) {
      toast.error(tCommon('selectProject'))
      return
    }

    try {
      const result = await generateCallSheet({
        project_id: selectedProjectId,
        suggestion_type: 'optimized',
        script_content: 'Generated from suggestions page'
      })
      toast.success(tCommon('actionSuccess'))
      console.log('Call sheet suggestions:', result)
    } catch (error: any) {
      toast.error(tCommon('actionError', { message: 'Failed to generate call sheet suggestions' }))
      console.error('Call sheet generation error:', error)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800'
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
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
          <h1 className="text-3xl font-bold tracking-tight">{t('suggestions.pageTitle')}</h1>
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
              <Label htmlFor="project">{t('callSheetSuggestions.settings.projectLabel')}</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder={t('callSheetSuggestions.settings.selectProjectPlaceholder')} />
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
                  onClick={handleGenerateCallSheet}
                  disabled={isGeneratingCallSheet || !selectedProjectId}
                >
                  {isGeneratingCallSheet ? (
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
                  <div className="bg-gray-100 p-2 rounded">
                    <span className="text-gray-600">{t('suggestions.stats.total')}</span>
                    <div className="font-bold">{suggestions.length}</div>
                  </div>
                  <div className="bg-green-100 p-2 rounded">
                    <span className="text-green-600">{t('suggestions.stats.highPriority')}</span>
                    <div className="font-bold">
                      {suggestions.filter((s: AiSuggestion) => s.priority === 'high').length}
                    </div>
                  </div>
                  <div className="bg-yellow-100 p-2 rounded">
                    <span className="text-yellow-600">{t('suggestions.stats.mediumPriority')}</span>
                    <div className="font-bold">
                      {suggestions.filter((s: AiSuggestion) => s.priority === 'medium').length}
                    </div>
                  </div>
                  <div className="bg-blue-100 p-2 rounded">
                    <span className="text-blue-600">{t('suggestions.stats.avgConfidence')}</span>
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
                          <div className="p-2 bg-gray-100 rounded-full">
                            {getSuggestionIcon(suggestion.suggestion_type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{suggestion.suggestion_type}</Badge>
                              <Badge className={getPriorityColor(suggestion.priority)}>
                                {suggestion.priority}
                              </Badge>
                              <Badge className={getConfidenceColor(suggestion.confidence)}>
                                {Math.round(suggestion.confidence * 100)}% confidence
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
                            <div className="text-sm text-green-600 mb-1">
                              <span className="font-medium">{t('suggestions.list.estimatedSavings')}</span> {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(suggestion.estimated_savings_cents / 100)}
                            </div>
                          )}
                          {suggestion.estimated_time_saved_minutes && (
                            <div className="text-sm text-blue-600">
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
                  <Sparkles className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('suggestions.noSuggestions.title')}</h3>
                <p className="text-gray-600 mb-4">
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
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      {t('actions.generateBudgetSuggestions')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleGenerateCallSheet}
                      disabled={isGeneratingCallSheet}
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
                    <Target className="h-4 w-4 text-green-600" />
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
                    <Clock className="h-4 w-4 text-blue-600" />
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
                    <DollarSign className="h-4 w-4 text-green-600" />
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