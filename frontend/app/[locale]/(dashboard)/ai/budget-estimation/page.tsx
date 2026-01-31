'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { useAiBudgetEstimation } from '@/lib/api/hooks/useAiFeatures'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  DollarSign,
  FileText,
  Calculator,
  Loader2,
  Sparkles
} from 'lucide-react'
import type { AiBudgetEstimation } from '@/types'

export default function AiBudgetEstimationPage() {
  const router = useRouter()
  const { user, organizationId } = useAuth()
  const t = useTranslations('ai.budgetEstimation')
  const tAi = useTranslations('ai')
  const tCommon = useTranslations('common.feedback')
  const tCommonLabels = useTranslations('common')

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [scriptText, setScriptText] = useState<string>('')
  const [estimationType, setEstimationType] = useState<'detailed' | 'quick'>('detailed')

  // Queries
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { mutateAsync: estimateBudget, isPending: isEstimating } = useAiBudgetEstimation()

  const handleBudgetEstimation = async () => {
    if (!selectedProjectId) {
      toast.error(tCommon('selectProject'))
      return
    }

    if (!scriptText.trim()) {
      toast.error(tCommon('enterText'))
      return
    }

    try {
      const result = await estimateBudget({
        project_id: selectedProjectId,
        estimation_type: estimationType,
        script_content: scriptText
      })

      toast.success(tCommon('actionSuccess'))
      console.log('Budget estimation result:', result)
    } catch (error: any) {
      const errorMsg = error?.message || t('errors.estimateFailed')
      toast.error(tCommon('actionError', { message: errorMsg }))
      console.error('Budget estimation error:', error)
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
            onClick={() => router.push('/ai/script-analysis')}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {tAi('actions.analyzeScript')}
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

            {/* Estimation Type */}
            <div className="space-y-2">
              <Label htmlFor="estimation-type">{t('estimationType.label')}</Label>
              <Select value={estimationType} onValueChange={(value) => setEstimationType(value as 'detailed' | 'quick')}>
                <SelectTrigger id="estimation-type">
                  <SelectValue placeholder={t('estimationType.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">{t('estimationType.types.quick')}</SelectItem>
                  <SelectItem value="detailed">{t('estimationType.types.detailed')}</SelectItem>
                </SelectContent>
              </Select>
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
                  <Calculator className="mr-2 h-4 w-4" />
                  {tAi('actions.viewAiDashboard')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/financials')}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  {t('actions.viewFinancials')}
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
                className="min-h-[200px]"
                maxLength={10000}
              />
              <div className="text-sm text-muted-foreground">
                {t('scriptInput.charCount', { current: scriptText.length, max: 10000 })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleBudgetEstimation}
                disabled={isEstimating || !selectedProjectId || !scriptText.trim()}
                className="flex-1"
              >
                {isEstimating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('actions.estimating')}
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    {t('actions.estimate')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setScriptText('')}
                disabled={isEstimating}
              >
                {tAi('actions.clear')}
              </Button>
            </div>

            {/* Estimation Tips */}
            <div className="bg-info/10 p-4 rounded-lg">
              <h4 className="font-semibold text-info mb-2">{t('tips.title')}</h4>
              <ul className="text-sm text-info-foreground space-y-1">
                <li>• {t('tips.items.characters')}</li>
                <li>• {t('tips.items.locations')}</li>
                <li>• {t('tips.items.effects')}</li>
                <li>• {t('tips.items.quick')}</li>
                <li>• {t('tips.items.detailed')}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Preview */}
      {scriptText.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('preview.title')}</CardTitle>
            <CardDescription>
              {t('preview.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('preview.cards.characters')}</span>
                </div>
                <div className="text-2xl font-bold">{scriptText.match(/\b[A-Z][A-Z\s]+\b/g)?.length || 0}</div>
                <div className="text-xs text-muted-foreground">{t('preview.labels.estimatedCharacters')}</div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('preview.cards.complexity')}</span>
                </div>
                <div className="text-2xl font-bold">
                  {scriptText.length > 5000
                    ? t('preview.complexity.high')
                    : scriptText.length > 2000
                      ? t('preview.complexity.medium')
                      : t('preview.complexity.low')}
                </div>
                <div className="text-xs text-muted-foreground">{t('preview.labels.complexity')}</div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('preview.cards.estimationType')}</span>
                </div>
                <div className="text-2xl font-bold capitalize">{t(`estimationType.types.${estimationType}`)}</div>
                <div className="text-xs text-muted-foreground">{t('preview.labels.selectedType')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
