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

export default function AiRecommendationsPage() {
  const router = useRouter()
  const { user, organizationId } = useAuth()

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [recommendationType, setRecommendationType] = useState<'call_sheet' | 'budget' | 'schedule' | 'equipment' | 'all'>('all')

  // Queries
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { data: recommendations, isLoading: isLoadingRecommendations } = useAiRecommendations(selectedProjectId)

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800'
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800'
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

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'call_sheet': return <Calendar className="h-4 w-4" />
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
    toast.success(`Applying ${recommendation.title}...`)
    // TODO: Implement recommendation application logic
    console.log('Applying recommendation:', recommendation)
  }

  const handleExportRecommendations = () => {
    if (!recommendations || recommendations.length === 0) {
      toast.error('No recommendations to export')
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

    toast.success('Recommendations exported successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Recommendations</h1>
          <p className="text-muted-foreground">
            High-priority AI recommendations to optimize your production workflow
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
            onClick={handleExportRecommendations}
            disabled={!recommendations || recommendations.length === 0}
          >
            Export Recommendations
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Filter Recommendations</CardTitle>
            <CardDescription>
              Filter and manage AI recommendations for your project
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

            {/* Recommendation Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="recommendation-type">Recommendation Type</Label>
              <Select value={recommendationType} onValueChange={(value) => setRecommendationType(value as 'call_sheet' | 'budget' | 'schedule' | 'equipment' | 'all')}>
                <SelectTrigger id="recommendation-type">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="call_sheet">Call Sheet</SelectItem>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
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
                  onClick={() => router.push('/ai/script-analysis')}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze Script for Recommendations
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/ai/suggestions')}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View AI Suggestions
                </Button>
              </div>
            </div>

            {/* Statistics */}
            {recommendations && (
              <div className="space-y-3">
                <h4 className="font-semibold">Statistics</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-100 p-2 rounded">
                    <span className="text-gray-600">Total</span>
                    <div className="font-bold">{recommendations.length}</div>
                  </div>
                  <div className="bg-red-100 p-2 rounded">
                    <span className="text-red-600">High Priority</span>
                    <div className="font-bold">
                      {recommendations.filter((r: AiRecommendation) => r.priority === 'high').length}
                    </div>
                  </div>
                  <div className="bg-yellow-100 p-2 rounded">
                    <span className="text-yellow-600">Medium Priority</span>
                    <div className="font-bold">
                      {recommendations.filter((r: AiRecommendation) => r.priority === 'medium').length}
                    </div>
                  </div>
                  <div className="bg-green-100 p-2 rounded">
                    <span className="text-green-600">Avg Confidence</span>
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
              <CardTitle>Recommendations</CardTitle>
              <div className="text-sm text-muted-foreground">
                {filteredRecommendations.length} recommendations
              </div>
            </div>
            <CardDescription>
              High-priority AI recommendations with actionable insights
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
                          <div className="p-2 bg-gray-100 rounded-full">
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
                            Apply
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => router.push(`/ai/recommendations/${recommendation.id}`)}
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Target className="h-4 w-4 text-green-600" />
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
                            <TrendingUp className="h-4 w-4 text-blue-600" />
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
                            <Clock className="h-4 w-4 text-purple-600" />
                            Created
                          </h4>
                          <div className="text-sm text-muted-foreground">
                            {new Date(recommendation.created_at).toLocaleDateString()}
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
                  <CheckCircle className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recommendations Available</h3>
                <p className="text-gray-600 mb-4">
                  {selectedProjectId
                    ? "No recommendations found for this project. Analyze your script to generate recommendations."
                    : "Please select a project to view recommendations."
                  }
                </p>
                {selectedProjectId && (
                  <Button
                    onClick={() => router.push('/ai/script-analysis')}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Recommendations
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
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <CardTitle className="text-sm font-medium">High Priority</CardTitle>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
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
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <CardTitle className="text-sm font-medium">Medium Priority</CardTitle>
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">
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
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <CardTitle className="text-sm font-medium">Low Priority</CardTitle>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
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
          <CardTitle>Implementation Guide</CardTitle>
          <CardDescription>
            How to implement AI recommendations effectively
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-semibold">Start with High Priority</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Focus on high-priority recommendations first for maximum impact
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="font-semibold">Follow Action Items</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Each recommendation includes specific action items to follow
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="font-semibold">Track Impact</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitor the estimated impact metrics to measure success
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}