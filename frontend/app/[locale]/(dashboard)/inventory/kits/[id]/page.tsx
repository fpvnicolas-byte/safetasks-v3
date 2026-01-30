'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useKit, useDeleteKit, useInventoryItems } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useFiles } from '@/lib/api/hooks/useFiles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pencil, Trash2, ArrowLeft, Package, CheckCircle, AlertCircle, Info, Eye, Box, Plus, ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { KitStatus, FileUploadResponse } from '@/types'
import { FileUploadZone, FileList } from '@/components/storage'

export default function KitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const kitId = params.id as string
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResponse[]>([])

  const { data: kit, isLoading, error } = useKit(kitId)
  const { data: items, isLoading: itemsLoading } = useInventoryItems(organizationId || '', kitId)
  const deleteKit = useDeleteKit()

  // File persistence hook for kit photos
  const { data: kitPhotos = [] } = useFiles('kits', organizationId || undefined)

  // Initialize uploadedFiles with existing kit photos on component mount
  useEffect(() => {
    if (kitPhotos.length > 0) {
      const existingFiles: FileUploadResponse[] = []
      
      // Convert kit photos
      kitPhotos.forEach(file => {
        existingFiles.push({
          file_path: file.path,
          bucket: file.bucket,
          access_url: file.is_public ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path}` : null,
          is_public: file.is_public,
          size_bytes: file.size || 0,
          content_type: 'image/*', // Could be improved with actual content type
        })
      })

      setUploadedFiles(existingFiles)
    }
  }, [kitPhotos])

  const handleUploadComplete = (result: FileUploadResponse) => {
    // Add the uploaded file to the list so it shows immediately
    setUploadedFiles((prev) => [...prev, result])
  }

  const handleFileDeleted = (filePath: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.file_path !== filePath))
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading kit details...</div>
  }

  if (error || !kit) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Equipment kit not found</AlertDescription>
        </Alert>
        <Button variant="ghost" onClick={() => router.push('/inventory/kits')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Kits
        </Button>
      </div>
    )
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this kit? Items inside will be preserved but marked as having no kit.')) return

    try {
      await deleteKit.mutateAsync(kitId)
      router.push('/inventory/kits')
    } catch (err) {
      console.error('Failed to delete kit:', err)
      alert('Failed to delete kit')
    }
  }

  const getStatusBadge = (status: KitStatus) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500 hover:bg-green-600 px-3 py-1 text-white border-none"><CheckCircle className="w-3 h-3 mr-1" /> Available</Badge>
      case 'in_use':
        return <Badge className="bg-blue-500 hover:bg-blue-600 px-3 py-1 text-white border-none"><Info className="w-3 h-3 mr-1" /> In Use</Badge>
      case 'maintenance':
        return <Badge variant="destructive" className="px-3 py-1"><AlertCircle className="w-3 h-3 mr-1" /> Maintenance</Badge>
      case 'retired':
        return <Badge variant="secondary" className="px-3 py-1">Retired</Badge>
      default:
        return <Badge variant="outline" className="px-3 py-1">{status}</Badge>
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/inventory/kits')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{kit.name}</h1>
            <p className="text-muted-foreground">{kit.category || 'Standard Kit'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/inventory/kits/${kitId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Kit
            </Link>
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {getStatusBadge(kit.status)}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base whitespace-pre-wrap">{kit.description || 'No description provided.'}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="contents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contents" className="gap-2">
            <Package className="h-4 w-4" />
            Contents
          </TabsTrigger>
          <TabsTrigger value="photos" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contents" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              Kit Contents
            </h2>
            <Button asChild size="sm">
              <Link href={`/inventory/items/new?kit_id=${kitId}`}>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Link>
            </Button>
          </div>

          {itemsLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading items...</div>
          ) : items && items.length > 0 ? (
            <div className="grid gap-4">
              {items.map((item) => (
                <Card key={item.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="bg-muted p-2 rounded-lg shrink-0">
                        <Box className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.category} • S/N: {item.serial_number || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className="hidden sm:inline-flex capitalize">
                        {item.health_status}
                      </Badge>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/inventory/items/${item.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-center">
              <Box className="h-10 w-10 text-muted-foreground opacity-20 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">This kit is empty.</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Start by adding existing items or creating new ones for this kit.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/inventory/items">
                  Pick Existing Items
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="photos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kit Photos</CardTitle>
              <CardDescription>
                Upload photos of this equipment kit (images only, max 10MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUploadZone
                module="kits"
                accept={{
                  'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
                }}
                maxSize={10}
                onUploadComplete={handleUploadComplete}
              />

              {uploadedFiles.length > 0 && (
                <div className="pt-4">
                  <FileList
                    files={uploadedFiles}
                    onFileDeleted={handleFileDeleted}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
