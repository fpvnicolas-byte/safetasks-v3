'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { useAiScriptAnalysis } from '@/lib/api/hooks/useAiFeatures'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  FileText,
  Users,
  Calendar,
  Target,
  Loader2,
  Sparkles,
  Clock,
  DollarSign
} from 'lucide-react'


export default function AiScriptAnalysisPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const t = useTranslations('ai.scriptAnalysis')
  const tAi = useTranslations('ai')
  const tCommon = useTranslations('common.feedback')
  const tCommonLabels = useTranslations('common')

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [scriptText, setScriptText] = useState<string>('')
  const [analysisType, setAnalysisType] = useState<'full' | 'characters' | 'scenes' | 'locations'>('full')
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    result?: {
      characters?: unknown[]
      scenes?: unknown[]
      locations?: unknown[]
    }
    error?: string
  } | null>(null)

  // Queries
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || '')
  const { mutateAsync: analyzeScript, isPending: isAnalyzing } = useAiScriptAnalysis()

  const handleScriptAnalysis = async () => {
    if (!selectedProjectId) {
      toast.error(tCommon('selectProject'))
      return
    }

    if (!scriptText.trim()) {
      toast.error(tCommon('enterText'))
      return
    }

    try {
      const result = await analyzeScript({
        project_id: selectedProjectId,
        analysis_type: analysisType,
        script_content: scriptText
      })

      // Handle backend error response
      if (result.error) {
        toast.error(`${tCommon('error')}: ${result.error}`)
        return
      }

      // Store AI analysis result for preview
      setAiAnalysisResult(result)

      toast.success(tCommon('actionSuccess'))
      console.log('Script analysis result:', result)
    } catch (error) {
      // Enhanced error logging
      console.error('Script analysis error (full):', error)

      // Check if it's an ApiError with details
      if (error && typeof error === 'object') {
        const apiError = error as { message?: string; detail?: string; statusCode?: number; status?: number }
        const errorMsg = apiError.message || apiError.detail || t('errors.unknown')
        toast.error(tCommon('actionError', { message: errorMsg }))
      } else {
        toast.error(tCommon('actionError', { message: t('errors.unknown') }))
      }
    }
  }

  const getAnalysisDescription = (type: string) => {
    switch (type) {
      case 'full': return t('analysisType.descriptions.full')
      case 'characters': return t('analysisType.descriptions.characters')
      case 'scenes': return t('analysisType.descriptions.scenes')
      case 'locations': return t('analysisType.descriptions.locations')
      default: return t('analysisType.descriptions.full')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('pageTitle')}</h1>
          <p className="text-muted-foreground">
            {t('pageSubtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/ai')}
          >
            {tAi('actions.backToDashboard')}
          </Button>
          <Button
            onClick={() => router.push('/ai/budget-estimation')}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            {tAi('quickActions.budgetEstimation.title')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('settings.title')}</CardTitle>
            <CardDescription>
              {t('settings.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project">{t('settings.projectLabel')}</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder={t('settings.projectPlaceholder')} />
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
                    <div className="p-2 text-sm text-muted-foreground">{tAi('empty.projects')}</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Analysis Type */}
            <div className="space-y-2">
              <Label htmlFor="analysis-type">{t('analysisType.label')}</Label>
              <Select value={analysisType} onValueChange={(value) => setAnalysisType(value as 'full' | 'characters' | 'scenes' | 'locations')}>
                <SelectTrigger id="analysis-type">
                  <SelectValue placeholder={t('analysisType.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{t('analysisType.types.full')}</SelectItem>
                  <SelectItem value="characters">{t('analysisType.types.characters')}</SelectItem>
                  <SelectItem value="scenes">{t('analysisType.types.scenes')}</SelectItem>
                  <SelectItem value="locations">{t('analysisType.types.locations')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getAnalysisDescription(analysisType)}
              </p>
            </div>

            {/* Analysis Features */}
            <div className="space-y-3">
              <h4 className="font-semibold">{t('features.title')}</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{t('features.characters')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{t('features.scenes')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span>{t('features.production')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{t('features.schedule')}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h4 className="font-semibold">{tAi('quickActions.title')}</h4>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/ai')}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {tAi('actions.viewAiDashboard')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/production')}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {t('actions.viewProduction')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Script Input */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('scriptInput.title')}</CardTitle>
            <CardDescription>
              {t('scriptInput.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="script-input">{t('scriptInput.label')}</Label>
              <Textarea
                id="script-input"
                placeholder={t('scriptInput.placeholder')}
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="min-h-[250px]"
                maxLength={15000}
              />
              <div className="text-sm text-muted-foreground">
                {t('scriptInput.charCount', { current: scriptText.length, max: 15000 })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleScriptAnalysis}
                disabled={isAnalyzing || !selectedProjectId || !scriptText.trim()}
                className="flex-1"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('actions.analyzing')}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {tAi('actions.analyzeScript')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setScriptText('')}
                disabled={isAnalyzing}
              >
                {tAi('actions.clear')}
              </Button>
            </div>

            {/* Analysis Tips */}
            <div className="bg-success/10 p-4 rounded-lg">
              <h4 className="font-semibold text-success mb-2">{t('tips.title')}</h4>
              <ul className="text-sm text-success/80 space-y-1">
                <li>• {t('tips.items.characters')}</li>
                <li>• {t('tips.items.scenes')}</li>
                <li>• {t('tips.items.production')}</li>
                <li>• {t('tips.items.full')}</li>
                <li>• {t('tips.items.casting')}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Preview */}
      {scriptText.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('preview.title')}</CardTitle>
            <CardDescription>
              {t('preview.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('preview.cards.characters')}</span>
                </div>
                {/* AI-Assisted Detection (Option 5) */}
                <div className="text-2xl font-bold">
                  {aiAnalysisResult?.result?.characters?.length ||
                    scriptText.match(/\b[A-Z][A-Z\s]+\b/g)?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  {aiAnalysisResult?.result?.characters?.length
                    ? t('preview.labels.aiCharacters')
                    : t('preview.labels.estimatedCharacters')}
                </div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('preview.cards.scenes')}</span>
                </div>
                <div className="text-2xl font-bold">
                  {aiAnalysisResult?.result?.scenes?.length ||
                    scriptText.match(/INT\.|EXT\./g)?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  {aiAnalysisResult?.result?.scenes?.length
                    ? t('preview.labels.aiScenes')
                    : t('preview.labels.estimatedScenes')}
                </div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('preview.cards.analysisType')}</span>
                </div>
                <div className="text-2xl font-bold capitalize">{t(`analysisType.types.${analysisType}`)}</div>
                <div className="text-xs text-muted-foreground">{t('preview.labels.selectedType')}</div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('preview.cards.complexity')}</span>
                </div>
                <div className="text-2xl font-bold">
                  {scriptText.length > 8000
                    ? t('preview.complexity.high')
                    : scriptText.length > 4000
                      ? t('preview.complexity.medium')
                      : t('preview.complexity.low')}
                </div>
                <div className="text-xs text-muted-foreground">{t('preview.labels.complexity')}</div>
              </div>
            </div>

            {/* AI Analysis Status */}
            {aiAnalysisResult && (
              <div className="mt-4 p-4 bg-info/10 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-info" />
                  <span className="font-semibold text-info">{t('analysisStatus.title')}</span>
                </div>
                <div className="text-sm text-info-foreground">
                  {t('analysisStatus.summary', {
                    characters: aiAnalysisResult.result?.characters?.length || 0,
                    scenes: aiAnalysisResult.result?.scenes?.length || 0,
                    locations: aiAnalysisResult.result?.locations?.length || 0
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
