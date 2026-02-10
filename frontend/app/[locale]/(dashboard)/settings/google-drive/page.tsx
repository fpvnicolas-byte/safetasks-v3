"use client"

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2, Cloud, ExternalLink, Loader2, Trash2 } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  useGoogleDriveStatus,
  useConnectGoogleDrive,
  useDisconnectGoogleDrive,
  useCallbackGoogleDrive,
} from '@/lib/api/hooks/useGoogleDrive'

export default function GoogleDriveSettingsPage() {
  const t = useTranslations('settings.googleDrivePage')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isProcessing, setIsProcessing] = useState(false)

  // Hooks
  const { data: status, isLoading: isLoadingStatus, refetch: refetchStatus } = useGoogleDriveStatus()
  const connectMutation = useConnectGoogleDrive()
  const disconnectMutation = useDisconnectGoogleDrive()
  const callbackMutation = useCallbackGoogleDrive()

  // Handle OAuth callback (code & state in URL)
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (code && state && !isProcessing) {
      setIsProcessing(true)
      handleCallback(code, state)
    }
  }, [searchParams])

  const handleCallback = async (code: string, state: string) => {
    try {
      await callbackMutation.mutateAsync({ code, state: state })
      toast.success(t('success'))
      // Clear URL params
      router.replace('/settings/google-drive')
    } catch (error) {
      toast.error(t('error'), {
        description: (error as Error).message,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConnect = async () => {
    try {
      setIsProcessing(true)
      const response = await connectMutation.mutateAsync()
      if (response && response.authorization_url) {
        window.location.href = response.authorization_url
      }
    } catch (error) {
      toast.error(t('error'), {
        description: (error as Error).message,
      })
      setIsProcessing(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setIsProcessing(true)
      await disconnectMutation.mutateAsync()
      toast.success(t('disconnect.title'), {
        description: t('disconnect.description'),
      })
      await refetchStatus()
    } catch (error) {
      toast.error(t('error'), {
        description: (error as Error).message,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoadingStatus && !status) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isConnected = status?.connected

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className={`h-6 w-6 ${isConnected ? 'text-blue-500' : 'text-gray-400'}`} />
              <CardTitle>{t('status.title') || 'Connection Status'}</CardTitle>
            </div>
            <Badge variant={isConnected ? 'success' : 'secondary'}>
              {isConnected ? t('status.connected') : t('status.notConnected')}
            </Badge>
          </div>
          <CardDescription>
            {isConnected
              ? t('status.connectedAs') + ' ' + (status?.connected_email || '')
              : t('connect.description')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isConnected ? (
            <div className="rounded-md border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{t('status.connected')}</span>
              </div>
              {status?.root_folder_url && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <a
                    href={status.root_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:underline"
                  >
                    {t('status.rootFolder')} <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('connect.title')}</AlertTitle>
              <AlertDescription>{t('connect.description')}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          {isConnected ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('disconnect.button')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('disconnect.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('disconnect.confirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('settings.cancel') || 'Cancel'}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {t('disconnect.button')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button onClick={handleConnect} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('connect.button')}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
