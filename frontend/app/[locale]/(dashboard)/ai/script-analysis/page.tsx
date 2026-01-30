'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
      toast.error('Please select a project first')
      return
    }

    if (!scriptText.trim()) {
      toast.error('Please enter script text to analyze')
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
        toast.error(`AI Analysis Error: ${result.error}`)
        return
      }

      // Store AI analysis result for preview
      setAiAnalysisResult(result)

      toast.success('Script analysis completed!')
      console.log('Script analysis result:', result)
    } catch (error) {
      // Enhanced error logging
      console.error('Script analysis error (full):', error)
      console.error('Error type:', typeof error)
      console.error('Error keys:', error ? Object.keys(error) : 'null')
      console.error('Error stringified:', JSON.stringify(error, null, 2))

      // Check if it's an ApiError with details
      if (error && typeof error === 'object') {
        const apiError = error as { message?: string; detail?: string; statusCode?: number; status?: number }
        const errorMsg = apiError.message || apiError.detail || 'Unknown error'
        const statusCode = apiError.statusCode || apiError.status || 'unknown'
        toast.error(`Failed to analyze script (${statusCode}): ${errorMsg}`)
        console.error('API Error Details:', {
          message: apiError.message,
          statusCode: apiError.statusCode,
          detail: apiError.detail,
          status: apiError.status
        })
      } else {
        toast.error('Failed to analyze script')
      }
    }
  }

  const getAnalysisDescription = (type: string) => {
    switch (type) {
      case 'full': return 'Complete analysis including characters, scenes, locations, and production requirements'
      case 'characters': return 'Focus on character analysis, dialogue patterns, and casting requirements'
      case 'scenes': return 'Scene breakdown, shot planning, and sequence analysis'
      case 'locations': return 'Location requirements, set design, and shooting logistics'
      default: return 'Full script analysis'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Script Analysis</h1>
          <p className="text-muted-foreground">
            Analyze scripts to extract characters, scenes, locations, and production requirements
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
            onClick={() => router.push('/ai/budget-estimation')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Budget Estimation
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Analysis Settings</CardTitle>
            <CardDescription>
              Configure your script analysis parameters
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

            {/* Analysis Type */}
            <div className="space-y-2">
              <Label htmlFor="analysis-type">Analysis Type</Label>
              <Select value={analysisType} onValueChange={(value) => setAnalysisType(value as 'full' | 'characters' | 'scenes' | 'locations')}>
                <SelectTrigger id="analysis-type">
                  <SelectValue placeholder="Select analysis type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Analysis</SelectItem>
                  <SelectItem value="characters">Character Analysis</SelectItem>
                  <SelectItem value="scenes">Scene Analysis</SelectItem>
                  <SelectItem value="locations">Location Analysis</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getAnalysisDescription(analysisType)}
              </p>
            </div>

            {/* Analysis Features */}
            <div className="space-y-3">
              <h4 className="font-semibold">Analysis Features</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Character identification and dialogue analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Scene breakdown and sequence planning</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span>Production requirement identification</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Shooting schedule optimization</span>
                </div>
              </div>
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
                  <Sparkles className="mr-2 h-4 w-4" />
                  View AI Dashboard
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/production')}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Production
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Script Input */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Script Input</CardTitle>
            <CardDescription>
              Paste your script text below for AI analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="script-input">Script Text</Label>
              <Textarea
                id="script-input"
                placeholder="Paste your script text here... Include character names, dialogue, scene descriptions, and any production notes for the most accurate analysis."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="min-h-[250px]"
                maxLength={15000}
              />
              <div className="text-sm text-muted-foreground">
                {scriptText.length}/15000 characters
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
                    Analyzing Script...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze Script
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setScriptText('')}
                disabled={isAnalyzing}
              >
                Clear
              </Button>
            </div>

            {/* Analysis Tips */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Analysis Tips</h4>
              <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                <li>• Use proper character names (all caps) for accurate identification</li>
                <li>• Include scene headings (INT./EXT. locations)</li>
                <li>• Add production notes in parentheses for special requirements</li>
                <li>• Full analysis provides the most comprehensive results</li>
                <li>• Character analysis is great for casting planning</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Preview */}
      {scriptText.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Script Preview</CardTitle>
            <CardDescription>
              AI will analyze this script based on your selected parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Characters</span>
                </div>
                {/* AI-Assisted Detection (Option 5) */}
                <div className="text-2xl font-bold">
                  {aiAnalysisResult?.result?.characters?.length ||
                    scriptText.match(/\b[A-Z][A-Z\s]+\b/g)?.length || 0}
                </div>
                <div className="text-xs text-gray-500">
                  {aiAnalysisResult?.result?.characters?.length
                    ? 'AI-analyzed characters'
                    : 'Estimated characters (regex-based)'}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Scenes</span>
                </div>
                <div className="text-2xl font-bold">
                  {aiAnalysisResult?.result?.scenes?.length ||
                    scriptText.match(/INT\.|EXT\./g)?.length || 0}
                </div>
                <div className="text-xs text-gray-500">
                  {aiAnalysisResult?.result?.scenes?.length
                    ? 'AI-analyzed scenes'
                    : 'Estimated scenes'}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Analysis Type</span>
                </div>
                <div className="text-2xl font-bold capitalize">{analysisType}</div>
                <div className="text-xs text-gray-500">Selected analysis type</div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Complexity</span>
                </div>
                <div className="text-2xl font-bold">
                  {scriptText.length > 8000 ? 'High' : scriptText.length > 4000 ? 'Medium' : 'Low'}
                </div>
                <div className="text-xs text-gray-500">Analysis complexity</div>
              </div>
            </div>

            {/* AI Analysis Status */}
            {aiAnalysisResult && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-blue-900 dark:text-blue-100">AI Analysis Complete</span>
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  {aiAnalysisResult.result?.characters?.length || 0} characters,
                  {aiAnalysisResult.result?.scenes?.length || 0} scenes,
                  {aiAnalysisResult.result?.locations?.length || 0} locations identified
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}