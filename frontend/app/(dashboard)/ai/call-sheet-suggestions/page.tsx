'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { useAiCallSheetSuggestions } from '@/lib/api/hooks/useAiFeatures'
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
import type { AiCallSheetSuggestion } from '@/types'

export default function AiCallSheetSuggestionsPage() {
  const router = useRouter()
  const { user, organizationId } = useAuth()

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [scriptText, setScriptText] = useState<string>('')
  const [suggestionType, setSuggestionType] = useState<'optimized' | 'weather' | 'cast' | 'location'>('optimized')

  // Queries
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId)
  const { mutateAsync: generateCallSheetSuggestions, isPending: isGenerating } = useAiCallSheetSuggestions()

  const handleGenerateSuggestions = async () => {
    if (!selectedProjectId) {
      toast.error('Please select a project first')
      return
    }

    if (!scriptText.trim()) {
      toast.error('Please enter script text to analyze')
      return
    }

    try {
      const result = await generateCallSheetSuggestions({
        project_id: selectedProjectId,
        suggestion_type: suggestionType,
        script_content: scriptText
      })
      
      toast.success('Call sheet suggestions generated!')
      console.log('Call sheet suggestions result:', result)
    } catch (error) {
      toast.error('Failed to generate call sheet suggestions')
      console.error('Call sheet suggestions error:', error)
    }
  }

  const getSuggestionDescription = (type: string) => {
    switch (type) {
      case 'optimized': return 'Optimized shooting schedule based on scene analysis and location efficiency'
      case 'weather': return 'Weather-aware scheduling with contingency plans for outdoor shoots'
      case 'cast': return 'Cast availability and fatigue management for optimal performance'
      case 'location': return 'Location-based scheduling to minimize travel and setup time'
      default: return 'Optimized call sheet suggestions'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Call Sheet Suggestions</h1>
          <p className="text-muted-foreground">
            Generate optimized shooting schedules and call sheets
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
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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
            <CardTitle>Suggestion Settings</CardTitle>
            <CardDescription>
              Configure your call sheet suggestion parameters
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

            {/* Suggestion Type */}
            <div className="space-y-2">
              <Label htmlFor="suggestion-type">Suggestion Type</Label>
              <Select value={suggestionType} onValueChange={(value) => setSuggestionType(value as 'optimized' | 'weather' | 'cast' | 'location')}>
                <SelectTrigger id="suggestion-type">
                  <SelectValue placeholder="Select suggestion type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="optimized">Optimized Schedule</SelectItem>
                  <SelectItem value="weather">Weather-Aware</SelectItem>
                  <SelectItem value="cast">Cast Management</SelectItem>
                  <SelectItem value="location">Location Efficiency</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getSuggestionDescription(suggestionType)}
              </p>
            </div>

            {/* Suggestion Features */}
            <div className="space-y-3">
              <h4 className="font-semibold">Suggestion Features</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Optimal shooting day sequencing</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Time-efficient call times and wrap times</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Cast and crew availability optimization</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Location-based scheduling for efficiency</span>
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
                  onClick={() => router.push('/shooting-days')}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  View Shooting Days
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
              Paste your script text below for AI analysis and call sheet optimization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="script-input">Script Text</Label>
              <Textarea
                id="script-input"
                placeholder="Paste your script text here... The AI will analyze scenes, locations, cast requirements, and generate optimized call sheet suggestions."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="min-h-[200px]"
                maxLength={12000}
              />
              <div className="text-sm text-muted-foreground">
                {scriptText.length}/12000 characters
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
                    Generating Suggestions...
                  </>
                ) : (
                  <>
                    <Target className="mr-2 h-4 w-4" />
                    Generate Suggestions
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setScriptText('')}
                disabled={isGenerating}
              >
                Clear
              </Button>
            </div>

            {/* Suggestion Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Suggestion Tips</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Include location details for accurate scheduling</li>
                <li>• Mention cast requirements and special needs</li>
                <li>• Note any weather-sensitive scenes</li>
                <li>• Optimized schedules minimize travel time</li>
                <li>• Weather-aware suggestions include contingencies</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Preview */}
      {scriptText.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Preview</CardTitle>
            <CardDescription>
              AI will analyze this script for call sheet optimization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Scenes</span>
                </div>
                <div className="text-2xl font-bold">{scriptText.match(/INT\.|EXT\./g)?.length || 0}</div>
                <div className="text-xs text-gray-500">Estimated scenes</div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Characters</span>
                </div>
                <div className="text-2xl font-bold">{scriptText.match(/\b[A-Z][A-Z\s]+\b/g)?.length || 0}</div>
                <div className="text-xs text-gray-500">Estimated characters</div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Locations</span>
                </div>
                <div className="text-2xl font-bold">{scriptText.match(/INT\. [A-Z]|EXT\. [A-Z]/g)?.length || 0}</div>
                <div className="text-xs text-gray-500">Estimated locations</div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Suggestion Type</span>
                </div>
                <div className="text-2xl font-bold capitalize">{suggestionType}</div>
                <div className="text-xs text-gray-500">Selected suggestion type</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}