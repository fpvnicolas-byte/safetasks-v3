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

export default function GoogleDriveSettingsPage() {
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
        setJsonError('Invalid service account JSON. Missing required fields.')
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
        setJsonError('Invalid JSON format. Please paste valid JSON.')
      } else {
        setJsonError(err instanceof Error ? err.message : 'Setup failed')
      }
    }
  }

  const handleToggle = async (field: string, value: boolean) => {
    await updateDrive.mutateAsync({
      [field]: value,
    })
  }

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove Google Drive integration? This will not delete your files from Drive.')) {
      return
    }

    await removeDrive.mutateAsync()
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Google Drive Integration</h1>
        <p className="text-muted-foreground">
          Connect your Google Drive to automatically sync production files
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>
                  {isConnected
                    ? 'Google Drive is connected'
                    : 'Not connected to Google Drive'}
                </CardDescription>
              </div>
            </div>
            {isConnected ? (
              <Badge className="gap-2 bg-green-500 hover:bg-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-2 text-muted-foreground">
                <XCircle className="h-4 w-4" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        {isConnected && credentials && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Project ID:</span>
                <p className="font-mono text-xs mt-1">
                  {credentials.service_account_key?.project_id || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Connected:</span>
                <p className="mt-1">
                  {credentials.connected_at
                    ? new Date(credentials.connected_at).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Sync:</span>
                <p className="mt-1">
                  {credentials.last_sync_at
                    ? new Date(credentials.last_sync_at).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Root Folder:</span>
                <p className="mt-1">
                  {credentials.root_folder_id ? (
                    <a
                      href={credentials.root_folder_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View in Drive
                    </a>
                  ) : (
                    'Not created yet'
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
            <CardTitle>Setup Google Drive</CardTitle>
            <CardDescription>
              Upload your Google Service Account JSON credentials to connect
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>How to get Service Account credentials</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Go to Google Cloud Console</li>
                  <li>Create or select a project</li>
                  <li>Enable Google Drive API</li>
                  <li>Create a Service Account</li>
                  <li>Create and download JSON key</li>
                  <li>Share your Drive folder with the service account email</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="service-account">Service Account JSON</Label>
              <Textarea
                id="service-account"
                placeholder="Paste your service account JSON here..."
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
                <>Setting up...</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Connect Google Drive
                </>
              )}
            </Button>

            {setupDrive.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Setup Failed</AlertTitle>
                <AlertDescription>
                  {setupDrive.error instanceof Error
                    ? setupDrive.error.message
                    : 'Failed to connect Google Drive'}
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
            <CardTitle>Sync Settings</CardTitle>
            <CardDescription>
              Configure when files should automatically sync to Google Drive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">Auto-sync enabled</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically sync files when uploaded
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
                <Label htmlFor="sync-proposals">Sync on proposal approval</Label>
                <p className="text-sm text-muted-foreground">
                  Sync proposal files when approved
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
                  Sync on call sheet finalized
                </Label>
                <p className="text-sm text-muted-foreground">
                  Sync call sheets when finalized
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
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for your Google Drive integration
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
                ? 'Removing...'
                : 'Remove Google Drive Integration'}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              This will disconnect Google Drive but will not delete your files from
              Drive.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
