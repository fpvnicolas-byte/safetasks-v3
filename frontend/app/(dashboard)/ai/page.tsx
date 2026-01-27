'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useAiAnalysis, useAiSuggestions, useAiRecommendations, useAnalyzeScript } from '@/lib/api/hooks/useAiFeatures'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  Brain, 
  FileText, 
  DollarSign, 
  Calendar, 
  AlertCircle,
  Loader2,
  CheckCircle
} from 'lucide-react'
import type { AiSuggestion, AiRecommendation, ScriptAnalysis } from '@/types'
import { toast } from 'sonner'

export default function AiFeaturesPage() {
  const router = useRouter()
  const { user, organizationId } = useAuth()

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [scriptText, setScriptText] = useState<string>('')
  const [analysisType, setAnalysisType] = useState<'script' | 'scene' | 'character' | 'budget' | 'schedule'>('script')

  // Queries
  const { data: analyses, isLoading: isLoadingAnalyses } = useAiAnalysis(organizationId)
  const { data: suggestions, isLoading: isLoadingSuggestions } = useAiSuggestions(selectedProjectId)
  const { data: recommendations, isLoading: isLoadingRecommendations } = useAiRecommendations(selectedProjectId)
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId)
  const { mutateAsync: analyzeScript, isPending: isAnalyzing } = useAnalyzeScript()

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
      await analyzeScript({
        project_id: selectedProjectId,
        analysis_type: analysisType,
        content: scriptText
      })
      toast.success('Script analysis started. Check notifications for results.')
      setScriptText('')
    } catch (error) {
      toast.error('Failed to start script analysis')
      console.error('Script analysis error:', error)
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Features</h1>
          <p className="text-muted-foreground">
            Leverage AI to enhance your production workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/projects')}
          >
            View Projects
          </Button>
          <Button
            onClick={() => router.push('/ai/script-analysis')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Analyze Script
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Get started with AI-powered production tools</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push('/ai/script-analysis')}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Script Analysis</CardTitle>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardDescription>
                    Analyze scripts to extract characters, scenes, and production requirements
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push('/ai/budget-estimation')}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Budget Estimation</CardTitle>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                  <CardDescription>
                    Get AI-powered budget estimates based on script analysis
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push('/ai/call-sheet-suggestions')}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Call Sheet Suggestions</CardTitle>
                    <Calendar className="h-8 w-8 text-purple-600" />
                  </div>
                  <CardDescription>
                    Generate optimized shooting schedules and call sheets
                  </CardDescription>
                </CardHeader>
              </Card>
            </CardContent>
          </Card>

          {/* Script Analysis Form */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Script Analysis</CardTitle>
              <CardDescription>Start a script analysis directly from the dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-select">Select Project</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger id="project-select">
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
                
                <div className="space-y-2">
                  <Label htmlFor="analysis-type">Analysis Type</Label>
                  <Select value={analysisType} onValueChange={(value) => setAnalysisType(value as 'script' | 'scene' | 'character' | 'budget' | 'schedule')}>
                    <SelectTrigger id="analysis-type">
                      <SelectValue placeholder="Select analysis type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="script">Full Script Analysis</SelectItem>
                      <SelectItem value="scene">Scene Analysis</SelectItem>
                      <SelectItem value="character">Character Analysis</SelectItem>
                      <SelectItem value="budget">Budget Analysis</SelectItem>
                      <SelectItem value="schedule">Schedule Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Actions</Label>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleScriptAnalysis}
                      disabled={isAnalyzing || !selectedProjectId || !scriptText.trim()}
                      className="flex-1"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        'Start Analysis'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push('/ai/script-analysis')}
                      className="flex-1"
                    >
                      Full Analysis
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="script-input">Script Text</Label>
                <Textarea
                  id="script-input"
                  placeholder="Paste your script text here..."
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  className="min-h-[120px]"
                  maxLength={5000}
                />
                <div className="text-sm text-muted-foreground">
                  {scriptText.length}/5000 characters
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Active Analyses</CardTitle>
                  <Brain className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold">{analyses?.length || 0}</div>
                <CardDescription>Scripts currently being analyzed</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Suggestions</CardTitle>
                  <Sparkles className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="text-2xl font-bold">{suggestions?.length || 0}</div>
                <CardDescription>AI-generated suggestions</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-2xl font-bold">{recommendations?.length || 0}</div>
                <CardDescription>High-priority recommendations</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-2xl font-bold">94%</div>
                <CardDescription>AI analysis success rate</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">AI Suggestions</h2>
            <div className="text-sm text-muted-foreground">
              {suggestions?.length || 0} suggestions available
            </div>
          </div>

          {isLoadingSuggestions ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions && suggestions.length > 0 ? (
            <div className="grid gap-6">
              {suggestions.map((suggestion: AiSuggestion) => (
                <Card key={suggestion.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{suggestion.suggestion_type}</Badge>
                        <Badge className={getPriorityColor(suggestion.priority)}>
                          {suggestion.priority}
                        </Badge>
                        <Badge className={getConfidenceColor(suggestion.confidence)}>
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(suggestion.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <CardTitle>{suggestion.suggestion_text}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {suggestion.related_scenes.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Related scenes: {suggestion.related_scenes.join(', ')}
                      </div>
                    )}
                    {suggestion.estimated_savings_cents && (
                      <div className="text-sm text-green-600 mt-2">
                        Estimated savings: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(suggestion.estimated_savings_cents / 100)}
                      </div>
                    )}
                    {suggestion.estimated_time_saved_minutes && (
                      <div className="text-sm text-blue-600 mt-1">
                        Time saved: {suggestion.estimated_time_saved_minutes} minutes
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No suggestions available. Analyze a script to get AI suggestions.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">AI Recommendations</h2>
            <div className="text-sm text-muted-foreground">
              {recommendations?.length || 0} recommendations available
            </div>
          </div>

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
                        <Badge variant="outline">{recommendation.recommendation_type}</Badge>
                        <Badge className={getPriorityColor(recommendation.priority)}>
                          {recommendation.priority}
                        </Badge>
                        <Badge className={getConfidenceColor(recommendation.confidence)}>
                          {Math.round(recommendation.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(recommendation.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <CardTitle>{recommendation.title}</CardTitle>
                    <CardDescription>{recommendation.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Action Items:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {recommendation.action_items.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                      
                      {recommendation.estimated_impact.time_saved_minutes && (
                        <div className="text-sm text-blue-600 mt-2">
                          Time saved: {recommendation.estimated_impact.time_saved_minutes} minutes
                        </div>
                      )}
                      {recommendation.estimated_impact.cost_saved_cents && (
                        <div className="text-sm text-green-600">
                          Cost saved: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(recommendation.estimated_impact.cost_saved_cents / 100)}
                        </div>
                      )}
                      {recommendation.estimated_impact.risk_reduction && (
                        <div className="text-sm text-orange-600">
                          Risk reduction: {recommendation.estimated_impact.risk_reduction}
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
                No recommendations available. Analyze a script to get AI recommendations.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Script Analysis</h2>
            <div className="text-sm text-muted-foreground">
              {analyses?.length || 0} analyses completed
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
                          {Math.round(analysis.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(analysis.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <CardTitle>Script Analysis Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Analysis Result</h4>
                        <p className="text-sm text-muted-foreground">{analysis.analysis_result}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Script Preview</h4>
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
                No script analyses available. Start a script analysis to see results.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}