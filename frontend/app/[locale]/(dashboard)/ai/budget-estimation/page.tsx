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
  const tCommon = useTranslations('common.feedback')

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
      const errorMsg = error?.message || 'Failed to estimate budget'
      toast.error(tCommon('actionError', { message: errorMsg }))
      console.error('Budget estimation error:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">AI Budget Estimation</h1>
          <p className="text-muted-foreground">
            Get AI-powered budget estimates based on script analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/ai')}
          >
            Back to AI Dashboard
          </Button>
          <Button
            onClick={() => router.push('/ai/script-analysis')}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Analyze Script
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Estimation Settings</CardTitle>
            <CardDescription>
              Configure your budget estimation parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingProjects ? (
                    <div className="p-2 text-sm text-muted-foreground">Loading projects...</div>
                  ) : projects && projects.length > 0 ? (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">No projects available</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Estimation Type */}
            <div className="space-y-2">
              <Label htmlFor="estimation-type">Estimation Type</Label>
              <Select value={estimationType} onValueChange={(value) => setEstimationType(value as 'detailed' | 'quick')}>
                <SelectTrigger id="estimation-type">
                  <SelectValue placeholder="Select estimation type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick Estimate</SelectItem>
                  <SelectItem value="detailed">Detailed Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h4 className="font-semibold">Quick Actions</h4>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/ai')}
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  View AI Dashboard
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/financials')}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  View Financials
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Script Input */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Script Analysis</CardTitle>
            <CardDescription>
              Paste your script text below for AI analysis and budget estimation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="script-input">Script Text</Label>
              <Textarea
                id="script-input"
                placeholder="Paste your script text here... The AI will analyze characters, scenes, locations, and production requirements to generate an accurate budget estimate."
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
                onClick={handleBudgetEstimation}
                disabled={isEstimating || !selectedProjectId || !scriptText.trim()}
                className="flex-1"
              >
                {isEstimating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Estimating Budget...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Estimate Budget
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setScriptText('')}
                disabled={isEstimating}
              >
                Clear
              </Button>
            </div>

            {/* Estimation Tips */}
            <div className="bg-info/10 p-4 rounded-lg">
              <h4 className="font-semibold text-info mb-2">Estimation Tips</h4>
              <ul className="text-sm text-info-foreground space-y-1">
                <li>• Include character descriptions and dialogue</li>
                <li>• Mention locations and set requirements</li>
                <li>• Note any special effects or equipment needs</li>
                <li>• Quick estimates are faster but less detailed</li>
                <li>• Detailed analysis provides comprehensive breakdowns</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Preview */}
      {scriptText.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Preview</CardTitle>
            <CardDescription>
              AI will analyze this script for budget estimation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Characters</span>
                </div>
                <div className="text-2xl font-bold">{scriptText.match(/\b[A-Z][A-Z\s]+\b/g)?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Estimated characters</div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Complexity</span>
                </div>
                <div className="text-2xl font-bold">
                  {scriptText.length > 5000 ? 'High' : scriptText.length > 2000 ? 'Medium' : 'Low'}
                </div>
                <div className="text-xs text-muted-foreground">Script complexity level</div>
              </div>

              <div className="bg-muted/60 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Estimation Type</span>
                </div>
                <div className="text-2xl font-bold capitalize">{estimationType}</div>
                <div className="text-xs text-muted-foreground">Selected estimation type</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
