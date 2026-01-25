'use client'

import { useState } from 'react'
import { FileUploadZone, FileList } from '@/components/storage'
import { FileUploadResponse } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function StoragePage() {
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResponse[]>([])

  const handleUploadComplete = (filePath: string, fileName: string) => {
    console.log('Upload complete:', filePath, fileName)
    // In a real app, you'd refetch the file list here
    // For now, we'll just log it
  }

  const handleFileDeleted = (filePath: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.file_path !== filePath))
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">File Storage</h1>
        <p className="text-muted-foreground">
          Upload and manage files for your projects
        </p>
      </div>

      <Tabs defaultValue="kits" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="kits">Kits</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="call-sheets">Call Sheets</TabsTrigger>
        </TabsList>

        <TabsContent value="kits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Kit Photos</CardTitle>
              <CardDescription>
                Upload photos of your equipment kits (images only)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                module="kits"
                accept={{
                  'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
                }}
                maxSize={10}
                onUploadComplete={handleUploadComplete}
              />
            </CardContent>
          </Card>

          {uploadedFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Files</CardTitle>
              </CardHeader>
              <CardContent>
                <FileList
                  files={uploadedFiles}
                  onFileDeleted={handleFileDeleted}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="proposals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Proposal Documents</CardTitle>
              <CardDescription>
                Upload PDFs and documents for proposals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                module="proposals"
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                }}
                maxSize={25}
                onUploadComplete={handleUploadComplete}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scripts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Script Files</CardTitle>
              <CardDescription>
                Upload scripts and related documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                module="scripts"
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                  'text/plain': ['.txt'],
                }}
                maxSize={25}
                onUploadComplete={handleUploadComplete}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="call-sheets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Call Sheet Documents</CardTitle>
              <CardDescription>
                Upload call sheets and related files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                module="call-sheets"
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                }}
                maxSize={25}
                onUploadComplete={handleUploadComplete}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
