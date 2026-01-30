'use client'

import { useParams, useRouter } from 'next/navigation'
import { useProposal, useDeleteProposal, useApproveProposal } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useFiles } from '@/lib/api/hooks/useFiles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Pencil, Trash2, ArrowLeft, CheckCircle, FileText, Calendar, DollarSign, ExternalLink, Paperclip } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, ProposalStatus, FileUploadResponse } from '@/types'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FileUploadZone, FileList } from '@/components/storage'
import { useLocale } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'

export default function ProposalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const locale = useLocale()
  const proposalId = params.id as string

  const { data: proposal, isLoading, error } = useProposal(proposalId)
  const deleteProposal = useDeleteProposal()
  const approveProposal = useApproveProposal()
  const { errorDialog, showError, closeError } = useErrorDialog()

  // File persistence hook for proposal attachments
  const { data: proposalFiles = [] } = useFiles('proposals', organizationId || undefined)

  const [approvalNotes, setApprovalNotes] = useState('')
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResponse[]>([])

  // Initialize uploadedFiles with existing proposal files on component mount
  useEffect(() => {
    if (proposalFiles.length > 0) {
      const existingFiles: FileUploadResponse[] = []

      // Convert proposal files
      proposalFiles.forEach(file => {
        existingFiles.push({
          file_path: file.path,
          bucket: file.bucket,
          access_url: file.is_public ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path}` : null,
          is_public: file.is_public,
          size_bytes: file.size || 0,
          content_type: 'application/pdf', // Could be improved with actual content type
        })
      })

      setUploadedFiles(existingFiles)
    }
  }, [proposalFiles])

  const handleUploadComplete = (result: FileUploadResponse) => {
    // Add the uploaded file to the list so it shows immediately
    setUploadedFiles((prev) => [...prev, result])
  }

  const handleFileDeleted = (filePath: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.file_path !== filePath))
  }

  if (isLoading) {
    return <div>Loading proposal...</div>
  }

  if (error || !proposal) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Proposal not found</AlertDescription>
      </Alert>
    )
  }

  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete
  } = useConfirmDelete()

  const handleDelete = async () => {
    try {
      await deleteProposal.mutateAsync(proposalId)
      router.push('/proposals')
    } catch (err) {
      console.error('Failed to delete proposal:', err)
      cancelDelete()
    }
  }

  const requestDelete = () => {
    confirmDelete(proposalId)
  }

  const handleApprove = async () => {
    try {
      await approveProposal.mutateAsync({
        proposalId,
        data: { notes: approvalNotes }
      })
      setIsApproveDialogOpen(false)
      // The proposal data will be invalidated and refreshed
    } catch (err) {
      console.error('Failed to approve proposal:', err)
      showError(err, 'Failed to approve proposal')
    }
  }

  const getStatusVariant = (status: ProposalStatus) => {
    switch (status) {
      case 'approved': return 'default' // Greenish
      case 'rejected': return 'destructive'
      case 'sent': return 'secondary' // Blueish
      case 'draft': return 'outline'
      case 'expired': return 'destructive'
      default: return 'outline'
    }
  }

  const showApproveButton = proposal.status === 'draft' || proposal.status === 'sent'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{proposal.title}</h1>
            <p className="text-muted-foreground">
              Created {new Date(proposal.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {showApproveButton && (
            <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Proposal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve Proposal</DialogTitle>
                  <DialogDescription>
                    This will mark the proposal as approved and automatically create a new project.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Approval Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Any notes about the approval..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApprove} disabled={approveProposal.isPending}>
                    {approveProposal.isPending ? 'Approving...' : 'Confirm Approval'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Button asChild variant="outline">
            <Link href={`/proposals/${proposalId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={requestDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={getStatusVariant(proposal.status)} className="text-base px-3 py-1">
          {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
        </Badge>
        {proposal.valid_until && (
          <Badge variant="outline" className="text-base px-3 py-1">
            Valid until: {new Date(proposal.valid_until).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </Badge>
        )}
      </div>

      {proposal.status === 'approved' && proposal.project_id && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Proposal Approved</AlertTitle>
          <AlertDescription className="mt-2">
            This proposal has been approved and converted into a project.
            <Button asChild variant="link" className="p-0 h-auto ml-2 text-green-700 font-semibold">
              <Link href={`/projects/${proposal.project_id}`}>
                View Project <ExternalLink className="ml-1 h-3 w-3 inline" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base whitespace-pre-wrap">
              {proposal.description || 'No description provided.'}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Total Amount</div>
                <div className="text-2xl font-bold mt-1">
                  {proposal.total_amount_cents !== null ? formatCurrency(proposal.total_amount_cents, proposal.currency) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Currency</div>
                <div className="text-base mt-1">{proposal.currency}</div>
              </div>
            </CardContent>
          </Card>

          {proposal.terms_conditions && (
            <Card>
              <CardHeader>
                <CardTitle>Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {proposal.terms_conditions}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Attachments</CardTitle>
          </div>
          <CardDescription>
            Upload documents, contracts, or other files related to this proposal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadZone
            module="proposals"
            accept={{
              'application/pdf': ['.pdf'],
              'application/msword': ['.doc'],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              'text/plain': ['.txt'],
            }}
            maxSize={25}
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

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Proposal?"
        description="Are you sure you want to delete this proposal? This action cannot be undone."
        loading={deleteProposal.isPending}
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={closeError}
        title={errorDialog.title}
        message={errorDialog.message}
        validationErrors={errorDialog.validationErrors}
        statusCode={errorDialog.statusCode}
      />
    </div>
  )
}
