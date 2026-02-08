'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { useAiRecommendations } from '@/lib/api/hooks/useAiFeatures'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Calendar,
  FileText,
  DollarSign,
  Loader2,
  Target,
  Clock
} from 'lucide-react'
import type { AiRecommendation } from '@/types'
import { useLocale, useTranslations } from 'next-intl'

export default function AiRecommendationsPage() {
  const router = useRouter()
  const locale = useLocale()
  const { user, organizationId } = useAuth()
  const tCommon = useTranslations('common.feedback')
  const t = useTranslations('ai')

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [recommendationType, setRecommendationType] = useState<'shooting_day' | 'budget' | 'schedule' | 'equipment' | 'all'>('all')

  // Queries
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { data: recommendations, isLoading: isLoadingRecommendations } = useAiRecommendations(selectedProjectId)

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-success/15 text-success'
    if (confidence >= 0.7) return 'bg-warning/20 text-warning-foreground'
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

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'shooting_day': return <Calendar className="h-4 w-4" />
      case 'budget': return <DollarSign className="h-4 w-4" />
      case 'schedule': return <Clock className="h-4 w-4" />
      case 'equipment': return <FileText className="h-4 w-4" />
      default: return <Sparkles className="h-4 w-4" />
    }
  }

  const filteredRecommendations = recommendations?.filter((r: AiRecommendation) =>
    recommendationType === 'all' || r.recommendation_type === recommendationType
  ) || []

  const handleApplyRecommendation = (recommendation: { title: string }) => {
    // This string is dynamic, might need better handling or just keep english for now as it's 'Applying X...'
    // Or use tFeedback('actionSuccess') type of key but for ongoing action.
    toast.success(`Applying ${recommendation.title}...`)
    // TODO: Implement recommendation application logic
    console.log('Applying recommendation:', recommendation)
  }

  const handleExportRecommendations = () => {
    if (!recommendations || recommendations.length === 0) {
      toast.error(tCommon('actionError', { message: 'No recommendations to export' }))
      return
    }

    const exportData = {
      project_id: selectedProjectId,
      generated_at: new Date().toISOString(),
      recommendations: recommendations.map((r: AiRecommendation) => ({
        title: r.title,
        description: r.description,
        type: r.recommendation_type,
        priority: r.priority,
        confidence: r.confidence,
        action_items: r.action_items,
        estimated_impact: r.estimated_impact,
        created_at: r.created_at
      }))
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-recommendations-${selectedProjectId}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(tCommon('actionSuccess'))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('recommendations.pageTitle')}</h1>
          <p className="text-muted-foreground">
            {t('recommendations.pageSubtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/ai')}
          >
            {t('actions.viewAiDashboard')}
          </Button>
          <Button
            onClick={handleExportRecommendations}
            disabled={!recommendations || recommendations.length === 0}
          >
            {t('actions.exportRecommendations')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('recommendations.filter.title')}</CardTitle>
            <CardDescription>
              {t('recommendations.filter.description')}
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

            {/* Recommendation Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="recommendation-type">{t('recommendations.filter.typeLabel')}</Label>
              <Select value={recommendationType} onValueChange={(value) => setRecommendationType(value as 'shooting_day' | 'budget' | 'schedule' | 'equipment' | 'all')}>
                <SelectTrigger id="recommendation-type">
                  <SelectValue placeholder={t('recommendations.filter.typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('recommendations.filter.types.all')}</SelectItem>
                  <SelectItem value="shooting_day">{t('recommendations.filter.types.shootingDay')}</SelectItem>
                  <SelectItem value="budget">{t('recommendations.filter.types.budget')}</SelectItem>
                  <SelectItem value="schedule">{t('recommendations.filter.types.schedule')}</SelectItem>
                  <SelectItem value="equipment">{t('recommendations.filter.types.equipment')}</SelectItem>
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
                  onClick={() => router.push('/ai/script-analysis')}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('actions.analyzeScriptRecommendations')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/ai/suggestions')}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {t('actions.viewAiSuggestions')}
                </Button>
              </div>
            </div>

            {/* Statistics */}
            {recommendations && (
              <div className="space-y-3">
                <h4 className="font-semibold">{t('recommendations.stats.title')}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/60 p-2 rounded">
                    <span className="text-muted-foreground">{t('recommendations.stats.total')}</span>
                    <div className="font-bold">{recommendations.length}</div>
                  </div>
                  <div className="bg-destructive/10 p-2 rounded">
                    <span className="text-destructive">{t('recommendations.stats.highPriority')}</span>
                    <div className="font-bold">
                      {recommendations.filter((r: AiRecommendation) => r.priority === 'high').length}
                    </div>
                  </div>
                  <div className="bg-warning/20 p-2 rounded">
                    <span className="text-warning-foreground">{t('recommendations.stats.mediumPriority')}</span>
                    <div className="font-bold">
                      {recommendations.filter((r: AiRecommendation) => r.priority === 'medium').length}
                    </div>
                  </div>
                  <div className="bg-success/15 p-2 rounded">
                    <span className="text-success">{t('recommendations.stats.avgConfidence')}</span>
                    <div className="font-bold">
                      {recommendations.length > 0
                        ? Math.round(recommendations.reduce((acc: number, r: AiRecommendation) => acc + r.confidence, 0) / recommendations.length * 100)
                        : 0}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendations List */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{t('recommendations.list.title')}</CardTitle>
              <div className="text-sm text-muted-foreground">
                {filteredRecommendations.length} {t('lists.recommendationsTitle')}
              </div>
            </div>
            <CardDescription>
              {t('recommendations.list.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRecommendations ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRecommendations.length > 0 ? (
              <div className="space-y-4">
                {filteredRecommendations.map((recommendation: AiRecommendation) => (
                  <Card key={recommendation.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-full">
                            {getRecommendationIcon(recommendation.recommendation_type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{recommendation.recommendation_type}</Badge>
                              <Badge className={getPriorityColor(recommendation.priority)}>
                                {recommendation.priority}
                              </Badge>
                              <Badge className={getConfidenceColor(recommendation.confidence)}>
                                {Math.round(recommendation.confidence * 100)}% confidence
                              </Badge>
                            </div>
                            <CardTitle className="text-lg mt-1">{recommendation.title}</CardTitle>
                            <CardDescription className="mt-1">{recommendation.description}</CardDescription>
                          </div>
                        </div>
	                        <div className="flex gap-2">
	                          <Button
	                            variant="outline"
	                            size="sm"
	                            onClick={() => handleApplyRecommendation(recommendation)}
	                          >
	                            {t('recommendations.list.apply')}
	                          </Button>
	                        </div>
	                      </div>
	                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Target className="h-4 w-4 text-destructive" />
                            Action Items
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {recommendation.action_items.map((item: string, index: number) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-info" />
                            Estimated Impact
                          </h4>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {recommendation.estimated_impact.time_saved_minutes && (
                              <div className="flex justify-between">
                                <span>Time Saved:</span>
                                <span className="font-medium">{recommendation.estimated_impact.time_saved_minutes} minutes</span>
                              </div>
                            )}
                            {recommendation.estimated_impact.cost_saved_cents && (
                              <div className="flex justify-between">
                                <span>Cost Saved:</span>
                                <span className="font-medium">
                                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(recommendation.estimated_impact.cost_saved_cents / 100)}
                                </span>
                              </div>
                            )}
                            {recommendation.estimated_impact.risk_reduction && (
                              <div className="flex justify-between">
                                <span>Risk Reduction:</span>
                                <span className="font-medium">{recommendation.estimated_impact.risk_reduction}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            Created
                          </h4>
                          <div className="text-sm text-muted-foreground">
                            {new Date(recommendation.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
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
                  <CheckCircle className="h-12 w-12 text-muted-foreground/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{t('recommendations.noRecommendations.title')}</h3>
                <p className="text-muted-foreground mb-4">
                  {selectedProjectId
                    ? t('recommendations.noRecommendations.description')
                    : t('recommendations.noRecommendations.selectProject')
                  }
                </p>
                {selectedProjectId && (
                  <Button
                    onClick={() => router.push('/ai/script-analysis')}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('actions.generateSuggestions')}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Priority Matrix */}
      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Priority Matrix</CardTitle>
            <CardDescription>
              View recommendations by priority and confidence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <CardTitle className="text-sm font-medium">High Priority</CardTitle>
                  </div>
                  <div className="text-2xl font-bold text-destructive">
                    {recommendations.filter((r: AiRecommendation) => r.priority === 'high').length}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Critical recommendations that should be addressed immediately
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning-foreground" />
                    <CardTitle className="text-sm font-medium">Medium Priority</CardTitle>
                  </div>
                  <div className="text-2xl font-bold text-warning-foreground">
                    {recommendations.filter((r: AiRecommendation) => r.priority === 'medium').length}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Important recommendations for medium-term implementation
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <CardTitle className="text-sm font-medium">Low Priority</CardTitle>
                  </div>
                  <div className="text-2xl font-bold text-success">
                    {recommendations.filter((r: AiRecommendation) => r.priority === 'low').length}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Nice-to-have recommendations for optimization
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Implementation Guide */}
      <Card>
        <CardHeader>
          <CardTitle>{t('recommendations.guide.title')}</CardTitle>
          <CardDescription>
            {t('recommendations.guide.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="font-semibold">{t('recommendations.guide.highPriority')}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('recommendations.guide.highPriorityDesc')}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-info" />
                <span className="font-semibold">{t('recommendations.guide.actionItems')}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('recommendations.guide.actionItemsDesc')}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="font-semibold">{t('recommendations.guide.trackImpact')}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('recommendations.guide.trackImpactDesc')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
