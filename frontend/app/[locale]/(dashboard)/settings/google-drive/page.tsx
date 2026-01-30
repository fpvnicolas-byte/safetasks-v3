'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  useGoogleDriveAuth,
  useSetupGoogleDrive,
  useUpdateGoogleDrive,
  useRemoveGoogleDrive,
} from '@/lib/api/hooks'
import {
  Cloud,
  CheckCircle2,
  XCircle,
  Upload,
  Trash2,
  AlertCircle,
  Info,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

export default function GoogleDriveSettingsPage() {
  const locale = useLocale()
  const t = useTranslations('settings.googleDrivePage')
  const { data: credentials, isLoading, error } = useGoogleDriveAuth()
  const setupDrive = useSetupGoogleDrive()
  const updateDrive = useUpdateGoogleDrive()
  const removeDrive = useRemoveGoogleDrive()

  const [serviceAccountJson, setServiceAccountJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const isConnected = !!credentials && !!credentials.service_account_key

  const handleSetup = async () => {
    setJsonError(null)

    try {
      const parsedJson = JSON.parse(serviceAccountJson)

      // Validate it has required fields
      if (!parsedJson.type || !parsedJson.project_id || !parsedJson.private_key) {
        setJsonError(t('setup.invalidFields'))
        return
      }

      await setupDrive.mutateAsync({
        service_account_key: parsedJson,
        auto_sync_enabled: true,
        sync_on_proposal_approval: true,
        sync_on_call_sheet_finalized: true,
      })

      setServiceAccountJson('')
    } catch (err) {
      if (err instanceof SyntaxError) {
        setJsonError(t('setup.invalidJson'))
      } else {
        setJsonError(err instanceof Error ? err.message : t('setup.setupFailed'))
      }
    }
  }

  const handleToggle = async (field: string, value: boolean) => {
    await updateDrive.mutateAsync({
      [field]: value,
    })
  }

  const handleRemove = async () => {
    if (!confirm(t('dangerZone.removeConfirm'))) {
      return
    }

    await removeDrive.mutateAsync()
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="text-center text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Settings / Integrations
        </div>
        <div className="mt-2">
          <h1 className="text-3xl font-bold tracking-tight font-display">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle>{t('status.title')}</CardTitle>
                <CardDescription>
                  {isConnected
                    ? t('status.connected')
                    : t('status.notConnected')}
                </CardDescription>
              </div>
            </div>
            {isConnected ? (
              <Badge variant="success" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t('status.connectedBadge')}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-2 text-muted-foreground">
                <XCircle className="h-4 w-4" />
                {t('status.notConnectedBadge')}
              </Badge>
            )}
          </div>
        </CardHeader>
        {isConnected && credentials && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('status.projectId')}</span>
                <p className="font-mono text-xs mt-1">
                  {credentials.service_account_key && typeof credentials.service_account_key === 'object' && 'project_id' in credentials.service_account_key
                    ? (credentials.service_account_key as { project_id?: string }).project_id || 'N/A'
                    : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('status.connectedAt')}</span>
                <p className="mt-1">
                  {credentials.connected_at
                    ? new Date(credentials.connected_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('status.lastSync')}</span>
                <p className="mt-1">
                  {credentials.last_sync_at
                    ? new Date(credentials.last_sync_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : t('status.never')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('status.rootFolder')}</span>
                <p className="mt-1">
                  {credentials.root_folder_id ? (
                    <a
                      href={credentials.root_folder_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {t('status.viewInDrive')}
                    </a>
                  ) : (
                    t('status.notCreatedYet')
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Setup Section */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>{t('setup.title')}</CardTitle>
            <CardDescription>
              {t('setup.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{t('setup.howTo.title')}</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>{t('setup.howTo.step1')}</li>
                  <li>{t('setup.howTo.step2')}</li>
                  <li>{t('setup.howTo.step3')}</li>
                  <li>{t('setup.howTo.step4')}</li>
                  <li>{t('setup.howTo.step5')}</li>
                  <li>{t('setup.howTo.step6')}</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="service-account">{t('setup.serviceAccountLabel')}</Label>
              <Textarea
                id="service-account"
                placeholder={t('setup.serviceAccountPlaceholder')}
                value={serviceAccountJson}
                onChange={(e) => {
                  setServiceAccountJson(e.target.value)
                  setJsonError(null)
                }}
                rows={10}
                className="font-mono text-xs"
              />
              {jsonError && (
                <p className="text-sm text-destructive">{jsonError}</p>
              )}
            </div>

            <Button
              onClick={handleSetup}
              disabled={!serviceAccountJson || setupDrive.isPending}
              className="w-full"
            >
              {setupDrive.isPending ? (
                <>{t('setup.settingUp')}</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('setup.connectButton')}
                </>
              )}
            </Button>

            {setupDrive.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('setup.setupError')}</AlertTitle>
                <AlertDescription>
                  {setupDrive.error instanceof Error
                    ? setupDrive.error.message
                    : t('setup.setupErrorMessage')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings Section */}
      {isConnected && credentials && (
        <Card>
          <CardHeader>
            <CardTitle>{t('syncSettings.title')}</CardTitle>
            <CardDescription>
              {t('syncSettings.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">{t('syncSettings.autoSync.label')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('syncSettings.autoSync.description')}
                </p>
              </div>
              <Switch
                id="auto-sync"
                checked={credentials.auto_sync_enabled}
                onCheckedChange={(checked) =>
                  handleToggle('auto_sync_enabled', checked)
                }
                disabled={updateDrive.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sync-proposals">{t('syncSettings.proposalSync.label')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('syncSettings.proposalSync.description')}
                </p>
              </div>
              <Switch
                id="sync-proposals"
                checked={credentials.sync_on_proposal_approval}
                onCheckedChange={(checked) =>
                  handleToggle('sync_on_proposal_approval', checked)
                }
                disabled={updateDrive.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sync-callsheets">
                  {t('syncSettings.callSheetSync.label')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('syncSettings.callSheetSync.description')}
                </p>
              </div>
              <Switch
                id="sync-callsheets"
                checked={credentials.sync_on_call_sheet_finalized}
                onCheckedChange={(checked) =>
                  handleToggle('sync_on_call_sheet_finalized', checked)
                }
                disabled={updateDrive.isPending}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      {isConnected && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">{t('dangerZone.title')}</CardTitle>
            <CardDescription>
              {t('dangerZone.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeDrive.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {removeDrive.isPending
                ? t('dangerZone.removing')
                : t('dangerZone.removeButton')}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              {t('dangerZone.removeNote')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
