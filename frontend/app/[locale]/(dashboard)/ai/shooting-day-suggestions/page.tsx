'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { useAiShootingDaySuggestions } from '@/lib/api/hooks/useAiFeatures'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Calendar,
  FileText,
  Clock,
  Users,
  MapPin,
  Loader2,
  Sparkles,
  Target
} from 'lucide-react'
import type { AiShootingDaySuggestion } from '@/types'

export default function AiShootingDaySuggestionsPage() {
  const router = useRouter()
  const { user, organizationId } = useAuth()
  const tCommon = useTranslations('common.feedback')
  const t = useTranslations('ai')

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [scriptText, setScriptText] = useState<string>('')
  const [suggestionType, setSuggestionType] = useState<'optimized' | 'weather' | 'cast' | 'location'>('optimized')

  // Queries
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { mutateAsync: generateCallSheetSuggestions, isPending: isGenerating } = useAiShootingDaySuggestions()

  const handleGenerateSuggestions = async () => {
    if (!selectedProjectId) {
      toast.error(tCommon('selectProject'))
      return
    }

    if (!scriptText.trim()) {
      toast.error(tCommon('enterText'))
      return
    }

    try {
      const result = await generateCallSheetSuggestions({
        project_id: selectedProjectId,
        suggestion_type: suggestionType,
        script_content: scriptText
      })

      toast.success(tCommon('actionSuccess'))
      console.log('Call sheet suggestions result:', result)
    } catch (error: any) {
      toast.error(tCommon('actionError', { message: error?.message || 'Failed to generate call sheet suggestions' }))
      console.error('Call sheet suggestions error:', error)
    }
  }

  const getSuggestionDescription = (type: string) => {
    switch (type) {
      case 'optimized': return t('callSheetSuggestions.settings.descriptions.optimized')
      case 'weather': return t('callSheetSuggestions.settings.descriptions.weather')
      case 'cast': return t('callSheetSuggestions.settings.descriptions.cast')
      case 'location': return t('callSheetSuggestions.settings.descriptions.location')
      default: return t('callSheetSuggestions.settings.descriptions.optimized')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('callSheetSuggestions.pageTitle')}</h1>
          <p className="text-muted-foreground">
            {t('callSheetSuggestions.pageSubtitle')}
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
            onClick={() => router.push('/ai/script-analysis')}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {t('actions.analyzeScript')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('callSheetSuggestions.settings.title')}</CardTitle>
            <CardDescription>
              {t('callSheetSuggestions.settings.description')}
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

            {/* Suggestion Type */}
            <div className="space-y-2">
              <Label htmlFor="suggestion-type">{t('callSheetSuggestions.settings.suggestionTypeLabel')}</Label>
              <Select value={suggestionType} onValueChange={(value) => setSuggestionType(value as 'optimized' | 'weather' | 'cast' | 'location')}>
                <SelectTrigger id="suggestion-type">
                  <SelectValue placeholder={t('callSheetSuggestions.settings.selectTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="optimized">{t('callSheetSuggestions.settings.types.optimized')}</SelectItem>
                  <SelectItem value="weather">{t('callSheetSuggestions.settings.types.weather')}</SelectItem>
                  <SelectItem value="cast">{t('callSheetSuggestions.settings.types.cast')}</SelectItem>
                  <SelectItem value="location">{t('callSheetSuggestions.settings.types.location')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getSuggestionDescription(suggestionType)}
              </p>
            </div>

            {/* Suggestion Features */}
            <div className="space-y-3">
              <h4 className="font-semibold">{t('callSheetSuggestions.features.title')}</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{t('callSheetSuggestions.features.sequencing')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{t('callSheetSuggestions.features.timeEfficient')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{t('callSheetSuggestions.features.castCrew')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{t('callSheetSuggestions.features.locationBased')}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h4 className="font-semibold">{t('quickActions.title')}</h4>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/ai')}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('actions.viewAiDashboard')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/shooting-days')}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {t('actions.viewShootingDays')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Script Input */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('callSheetSuggestions.scriptAnalysis.title')}</CardTitle>
            <CardDescription>
              {t('callSheetSuggestions.scriptAnalysis.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="script-input">{t('callSheetSuggestions.scriptAnalysis.label')}</Label>
              <Textarea
                id="script-input"
                placeholder={t('callSheetSuggestions.scriptAnalysis.placeholder')}
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="min-h-[200px]"
                maxLength={10000}
              />
              <div className="text-sm text-muted-foreground">
                {scriptText.length}/10000 characters
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGenerateSuggestions}
                disabled={isGenerating || !selectedProjectId || !scriptText.trim()}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('actions.generating')}
                  </>
                ) : (
                  <>
                    <Target className="mr-2 h-4 w-4" />
                    {t('actions.generateSuggestions')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setScriptText('')}
                disabled={isGenerating}
              >
                {t('actions.clear')}
              </Button>
            </div>

            {/* Suggestion Tips */}
            <div className="bg-info/10 p-4 rounded-lg">
              <h4 className="font-semibold text-info mb-2">{t('callSheetSuggestions.tips.title')}</h4>
              <ul className="text-sm text-info-foreground space-y-1">
                <li>• {t('callSheetSuggestions.tips.location')}</li>
                <li>• {t('callSheetSuggestions.tips.cast')}</li>
                <li>• {t('callSheetSuggestions.tips.weather')}</li>
                <li>• {t('callSheetSuggestions.tips.optimized')}</li>
                <li>• {t('callSheetSuggestions.tips.weatherAware')}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Preview */}
      {scriptText.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('callSheetSuggestions.analysisPreview.title')}</CardTitle>
            <CardDescription>
              {t('callSheetSuggestions.analysisPreview.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Scenes</span>
                </div>
                <div className="text-2xl font-bold">{scriptText.match(/INT\.|EXT\./g)?.length || 0}</div>
                <div className="text-xs text-muted-foreground">{t('callSheetSuggestions.analysisPreview.estimatedScenes')}</div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Characters</span>
                </div>
                <div className="text-2xl font-bold">{scriptText.match(/\b[A-Z][A-Z\s]+\b/g)?.length || 0}</div>
                <div className="text-xs text-muted-foreground">{t('callSheetSuggestions.analysisPreview.estimatedCharacters')}</div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Locations</span>
                </div>
                <div className="text-2xl font-bold">{scriptText.match(/INT\. [A-Z]|EXT\. [A-Z]/g)?.length || 0}</div>
                <div className="text-xs text-muted-foreground">{t('callSheetSuggestions.analysisPreview.estimatedLocations')}</div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('callSheetSuggestions.settings.suggestionTypeLabel')}</span>
                </div>
                <div className="text-2xl font-bold capitalize">{suggestionType}</div>
                <div className="text-xs text-muted-foreground">{t('callSheetSuggestions.analysisPreview.selectedType')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
