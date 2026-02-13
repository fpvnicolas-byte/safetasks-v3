'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Film, Mail, Phone, Users, X } from 'lucide-react'

interface CrewAssignment {
  id: string
  profile_name?: string | null
  profile_email: string
  profile_phone?: string | null
  production_function: string
}

interface SceneItem {
  id: string
  scene_number: string | number
  internal_external: string
  day_night: string
  estimated_time_minutes: number
  heading: string
  description?: string | null
  shooting_day_id?: string | null
}

interface TeamMember {
  id: string
  full_name?: string | null
  email: string
}

interface MutationWithAsync<TPayload = unknown> {
  mutateAsync: (payload: TPayload) => Promise<unknown>
  isPending?: boolean
}

interface ShootingDayAssignmentsSectionProps {
  canManage: boolean
  locale: string
  projectId: string
  crewAssignments: CrewAssignment[]
  scenes: SceneItem[]
  allScenes?: SceneItem[]
  assignmentMessage: string
  setAssignmentMessage: (message: string) => void
  selectedScenes: string[]
  setSelectedScenes: (sceneIds: string[]) => void
  editingCrewId: string | null
  setEditingCrewId: (id: string | null) => void
  editingFunction: string
  setEditingFunction: (value: string) => void
  isAddCrewOpen: boolean
  setIsAddCrewOpen: (open: boolean) => void
  selectedProfileId: string
  setSelectedProfileId: (id: string) => void
  productionFunction: string
  setProductionFunction: (value: string) => void
  teamMembers?: TeamMember[]
  assignScenes: MutationWithAsync<string[]>
  unassignScenes: MutationWithAsync<string[]>
  addCrewMember: MutationWithAsync<{ profile_id: string; production_function: string }>
  removeCrewMember: MutationWithAsync<string>
  updateCrewMember: MutationWithAsync<{ assignmentId: string; production_function: string }>
}

export function ShootingDayAssignmentsSection({
  canManage,
  locale,
  projectId,
  crewAssignments,
  scenes,
  allScenes,
  assignmentMessage,
  setAssignmentMessage,
  selectedScenes,
  setSelectedScenes,
  editingCrewId,
  setEditingCrewId,
  editingFunction,
  setEditingFunction,
  isAddCrewOpen,
  setIsAddCrewOpen,
  selectedProfileId,
  setSelectedProfileId,
  productionFunction,
  setProductionFunction,
  teamMembers,
  assignScenes,
  unassignScenes,
  addCrewMember,
  removeCrewMember,
  updateCrewMember,
}: ShootingDayAssignmentsSectionProps) {
  const t = useTranslations('shootingDays.detail')
  const tCommon = useTranslations('common')
  const availableScenes = allScenes?.filter((scene) => !scene.shooting_day_id) ?? []

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                <Users className="inline mr-2 h-5 w-5" />
                {t('crew')}
              </CardTitle>
              <CardDescription>{t('crewDescription')}</CardDescription>
            </div>
            {canManage && (
              <Button onClick={() => setIsAddCrewOpen(true)} size="sm">
                {t('addCrew')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {crewAssignments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm font-medium">{t('name')}</th>
                    <th className="text-left py-2 px-2 text-sm font-medium">{t('function')}</th>
                    <th className="text-left py-2 px-2 text-sm font-medium">{t('phone')}</th>
                    <th className="text-left py-2 px-2 text-sm font-medium">{t('email')}</th>
                    {canManage && <th className="text-right py-2 px-2 text-sm font-medium">{t('actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {crewAssignments.map((crew) => (
                    <tr key={crew.id} className="border-b last:border-0">
                      <td className="py-3 px-2">{crew.profile_name || crew.profile_email}</td>
                      <td className="py-3 px-2">
                        {editingCrewId === crew.id ? (
                          <Input
                            value={editingFunction}
                            onChange={(e) => setEditingFunction(e.target.value)}
                            onBlur={async () => {
                              if (editingFunction.trim()) {
                                await updateCrewMember.mutateAsync({
                                  assignmentId: crew.id,
                                  production_function: editingFunction
                                })
                              }
                              setEditingCrewId(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              }
                            }}
                            autoFocus
                            className="h-8"
                          />
                        ) : (
                          <span
                            className={canManage ? "cursor-pointer hover:text-primary" : ""}
                            onClick={() => {
                              if (canManage) {
                                setEditingCrewId(crew.id)
                                setEditingFunction(crew.production_function)
                              }
                            }}
                          >
                            {crew.production_function}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {crew.profile_phone ? (
                          <a href={`tel:${crew.profile_phone}`} className="flex items-center gap-1 hover:text-primary">
                            <Phone className="h-3 w-3" />
                            {crew.profile_phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        <a href={`mailto:${crew.profile_email}`} className="flex items-center gap-1 hover:text-primary">
                          <Mail className="h-3 w-3" />
                          {crew.profile_email}
                        </a>
                      </td>
                      {canManage && (
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              await removeCrewMember.mutateAsync(crew.id)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noCrewAssigned')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sceneAssignment')}</CardTitle>
          <CardDescription>{t('sceneAssignmentDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {assignmentMessage && (
            <Alert>
              <AlertDescription>{assignmentMessage}</AlertDescription>
            </Alert>
          )}

          {allScenes && allScenes.length > 0 ? (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t('assignedScenes')}</h3>
                {scenes.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {scenes.map((scene) => (
                        <div key={scene.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {t('scene')} {scene.scene_number}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {scene.internal_external === 'internal' ? t('int') : t('ext')}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {scene.day_night === 'day' ? t('day') : scene.day_night === 'night' ? t('night') : scene.day_night}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {scene.estimated_time_minutes} {t('minutes')}
                              </span>
                            </div>
                            <div className="text-sm font-medium">{scene.heading}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{scene.description}</div>
                          </div>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                await unassignScenes.mutateAsync([scene.id])
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {t('totalEstimatedTime')}: {scenes.reduce((sum, scene) => sum + scene.estimated_time_minutes, 0)} {t('minutes')}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('noScenesAssigned')}</p>
                )}
              </div>

              {canManage && (
                <div className="space-y-3 pt-3 border-t">
                  <h3 className="text-sm font-semibold">{t('assignNewScenes')}</h3>
                  {availableScenes.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        {availableScenes.map((scene) => {
                          const isSelected = selectedScenes.includes(scene.id)

                          return (
                            <div key={scene.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                              <Checkbox
                                id={`scene-${scene.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked: boolean) => {
                                  if (checked) {
                                    setSelectedScenes([...selectedScenes, scene.id])
                                  } else {
                                    setSelectedScenes(selectedScenes.filter((id) => id !== scene.id))
                                  }
                                }}
                              />
                              <label htmlFor={`scene-${scene.id}`} className="flex-1 cursor-pointer">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {t('scene')} {scene.scene_number}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {scene.internal_external === 'internal' ? t('int') : t('ext')}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {scene.day_night === 'day' ? t('day') : scene.day_night === 'night' ? t('night') : scene.day_night}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {scene.estimated_time_minutes} {t('minutes')}
                                  </span>
                                </div>
                                <div className="text-sm font-medium">{scene.heading}</div>
                              </label>
                            </div>
                          )
                        })}
                      </div>

                      <Button
                        onClick={async () => {
                          try {
                            setAssignmentMessage('')
                            await assignScenes.mutateAsync(selectedScenes)
                            setAssignmentMessage(t('assignSuccess', { count: selectedScenes.length }))
                            setSelectedScenes([])
                          } catch (err: unknown) {
                            const error = err as Error
                            setAssignmentMessage(t('assignError', { message: error.message }))
                          }
                        }}
                        disabled={selectedScenes.length === 0 || assignScenes.isPending}
                      >
                        <Film className="mr-2 h-4 w-4" />
                        {assignScenes.isPending ? t('assigning') : t('assignScenes', { count: selectedScenes.length })}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('noUnassignedScenes')}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              {t('noScenes')}
              {canManage && (
                <>
                  {' '}
                  <Link href={`/${locale}/scenes/new?project=${projectId}`} className="text-primary hover:underline">
                    {t('createScene')}
                  </Link>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddCrewOpen} onOpenChange={setIsAddCrewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addCrew')}</DialogTitle>
            <DialogDescription>{t('addCrewDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="crew-member">{t('selectMember')}</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger id="crew-member">
                  <SelectValue placeholder={t('selectMemberPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers?.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="production-function">{t('productionFunction')}</Label>
              <Input
                id="production-function"
                value={productionFunction}
                onChange={(e) => setProductionFunction(e.target.value)}
                placeholder={t('productionFunctionPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddCrewOpen(false)
                setSelectedProfileId('')
                setProductionFunction('')
              }}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (selectedProfileId && productionFunction.trim()) {
                  await addCrewMember.mutateAsync({
                    profile_id: selectedProfileId,
                    production_function: productionFunction
                  })
                  setIsAddCrewOpen(false)
                  setSelectedProfileId('')
                  setProductionFunction('')
                }
              }}
              disabled={!selectedProfileId || !productionFunction.trim() || addCrewMember.isPending}
            >
              {addCrewMember.isPending ? t('adding') : t('add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
