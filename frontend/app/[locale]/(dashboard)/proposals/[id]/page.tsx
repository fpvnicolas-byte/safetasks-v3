'use client'

import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useProposal, useDeleteProposal, useApproveProposal, useUpdateProposal } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useFiles } from '@/lib/api/hooks/useFiles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Pencil, Trash2, ArrowLeft, CheckCircle, FileText, ExternalLink, Paperclip, Download, Loader2, Mail, Phone, Building } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, ProposalStatus, FileUploadResponse } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { DetailPageSkeleton } from '@/components/LoadingSkeletons'

function AttachmentFallback() {
  return <DetailPageSkeleton />
}

const FileUploadZone = dynamic(
  () => import('@/components/storage').then((mod) => mod.FileUploadZone),
  { loading: AttachmentFallback }
)
const FileList = dynamic(
  () => import('@/components/storage').then((mod) => mod.FileList),
  { loading: AttachmentFallback }
)

interface ProposalLineItem {
  id?: string
  description?: string
  value_cents: number
}

export default function ProposalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('proposals')
  const tCommon = useTranslations('common')
  const proposalId = params.id as string

  const { data: proposal, isLoading, error } = useProposal(proposalId)
  const deleteProposal = useDeleteProposal()
  const approveProposal = useApproveProposal()
  const updateProposal = useUpdateProposal()
  const { errorDialog, showError, closeError } = useErrorDialog()

  // File persistence hook for proposal attachments
  const { data: proposalFiles = [] } = useFiles('proposals', organizationId || undefined, proposalId)

  const [approvalNotes, setApprovalNotes] = useState('')
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResponse[]>([])

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfVersion, setPdfVersion] = useState<number | null>(null)

  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete
  } = useConfirmDelete()

  // Initialize uploadedFiles with existing proposal files on component mount
  useEffect(() => {
    let newFiles: FileUploadResponse[] = []

    if (proposalFiles && proposalFiles.length > 0) {
      // Convert proposal files
      newFiles = proposalFiles.map(file => ({
        file_path: file.path,
        bucket: file.bucket,
        access_url: file.is_public ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path}` : null,
        is_public: file.is_public,
        size_bytes: file.size || 0,
        content_type: 'application/pdf', // Could be improved with actual content type
      }))
    }

    // Only update state if files have changed to prevent infinite loops
    setUploadedFiles(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newFiles)) {
        return prev
      }
      return newFiles
    })
  }, [proposalFiles])

  const handleUploadComplete = (result: FileUploadResponse) => {
    // Add the uploaded file to the list so it shows immediately
    setUploadedFiles((prev) => [...prev, result])
  }

  const handleFileDeleted = (filePath: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.file_path !== filePath))
  }

  // Check for existing PDF when proposal loads
  useEffect(() => {
    if (proposal?.proposal_metadata?.pdf) {
      const pdfInfo = proposal.proposal_metadata.pdf
      setPdfVersion(pdfInfo.version || null)
      // We'll fetch the signed URL when user clicks download
    }
  }, [proposal])

  // PDF Generation Handler
  const handleGeneratePdf = async (regenerate = false) => {
    setIsGeneratingPdf(true)
    try {
      // Get JWT token from Supabase (same pattern as useStorage hooks)
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session }, error: authError } = await supabase.auth.getSession()

      if (authError || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/proposals/${proposalId}/pdf?regenerate=${regenerate}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to generate PDF')
      }

      const data = await response.json()
      setPdfUrl(data.signed_url)
      setPdfVersion(data.version || null)

      if (data.status === 'exists' && !regenerate) {
        toast.success(t('pdf.exists'))
      } else {
        toast.success(t('pdf.generated'))
      }
    } catch (error) {
      console.error('PDF generation failed:', error)

      // Better error handling for different failure modes
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('Network error - Backend may not be running or CORS issue')
        toast.error('Cannot connect to server. Please check if backend is running.')
      } else if (error instanceof Error && error.message === 'Not authenticated') {
        toast.error('Please log in again to generate PDF.')
      } else {
        toast.error(error instanceof Error ? error.message : t('pdf.generateFailed'))
      }
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // Get PDF Download URL
  const handleDownloadPdf = async () => {
    try {
      // Get JWT token from Supabase
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session }, error: authError } = await supabase.auth.getSession()

      if (authError || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/proposals/${proposalId}/pdf?download=true`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to get PDF URL')
      }

      const data = await response.json()
      if (data.download_url) {
        window.open(data.download_url, '_blank')
      } else if (data.signed_url) {
        window.open(data.signed_url, '_blank')
      }
    } catch (error) {
      console.error('PDF download failed:', error)
      toast.error(t('pdf.downloadFailed'))
    }
  }

  if (isLoading) {
    return <DetailPageSkeleton />
  }

  if (error || !proposal) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('detail.notFound')}</AlertDescription>
      </Alert>
    )
  }

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

  // Status change handler
  const handleStatusChange = async (newStatus: ProposalStatus) => {
    // Don't allow changing from 'approved' status via dropdown
    if (proposal.status === 'approved') {
      toast.error(t('detail.statusLocked'))
      return
    }

    try {
      await updateProposal.mutateAsync({
        proposalId,
        data: { status: newStatus }
      })
      toast.success(t('detail.statusUpdated'))
    } catch (err) {
      console.error('Failed to update status:', err)
      showError(err, 'Failed to update status')
    }
  }

  // Get status variant for styling
  const getStatusStyles = (status: ProposalStatus) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-300'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300'
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'expired': return 'bg-orange-100 text-orange-800 border-orange-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/proposals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-display">{proposal.title}</h1>
            <p className="text-muted-foreground">
              {t('detail.created')} {new Date(proposal.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {proposal.client && (
                <>
                  {' • '}
                  <span className="font-medium text-foreground">{proposal.client.name}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Approve Button - Only enabled for 'sent' proposals */}
          {(proposal.status === 'draft' || proposal.status === 'sent') && (

            <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  disabled={proposal.status !== 'sent'}
                  title={proposal.status === 'draft' ? t('detail.approveDisabledDraft') : undefined}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t('detail.approveProposal')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('detail.approveDialog.title')}</DialogTitle>
                  <DialogDescription>
                    {t('detail.approveDialog.description')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">{t('detail.approveDialog.notesLabel')}</Label>
                    <Textarea
                      id="notes"
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder={t('detail.approveDialog.notesPlaceholder')}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>{t('detail.approveDialog.cancel')}</Button>
                  <Button onClick={handleApprove} disabled={approveProposal.isPending}>
                    {approveProposal.isPending ? t('detail.approveDialog.confirming') : t('detail.approveDialog.confirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Show hint when proposal is in draft */}
          {proposal.status === 'draft' && (
            <span className="text-xs text-muted-foreground ml-1">
              {t('detail.sendFirst') || 'Send proposal first to approve'}
            </span>
          )}


          <Button asChild variant="outline">
            <Link href={`/proposals/${proposalId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('detail.edit')}
            </Link>
          </Button>
          <Button variant="destructive" onClick={requestDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('detail.delete')}
          </Button>

          {/* PDF Generation Buttons */}
          <Button
            variant="outline"
            onClick={() => handleGeneratePdf(pdfVersion !== null)}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {pdfVersion ? t('pdf.regenerate') : t('pdf.generate')}
          </Button>

          {(pdfUrl || proposal.proposal_metadata?.pdf?.path) && (
            <Button variant="secondary" onClick={handleDownloadPdf}>
              <Download className="mr-2 h-4 w-4" />
              {t('pdf.download')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Status Dropdown - disabled for approved proposals */}
        <Select
          value={proposal.status}
          onValueChange={(value) => handleStatusChange(value as ProposalStatus)}
          disabled={proposal.status === 'approved' || updateProposal.isPending}
        >
          <SelectTrigger
            className={`w-auto min-w-[120px] text-base font-medium border-2 ${getStatusStyles(proposal.status)}`}
          >
            <SelectValue>
              {updateProposal.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('detail.saving')}
                </span>
              ) : (
                t(proposal.status)
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">{t('draft')}</SelectItem>
            <SelectItem value="sent">{t('sent')}</SelectItem>
            {proposal.status === 'approved' && (
              <SelectItem value="approved">{t('approved')}</SelectItem>
            )}
            <SelectItem value="rejected">{t('rejected')}</SelectItem>
            <SelectItem value="expired">{t('expired')}</SelectItem>
          </SelectContent>
        </Select>
        {proposal.valid_until && (
          <Badge variant="outline" className="text-base px-3 py-1">
            {t('detail.badges.validUntil')} {new Date(proposal.valid_until).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </Badge>
        )}
        {proposal.start_date && (
          <Badge variant="secondary" className="text-base px-3 py-1">
            {t('detail.badges.estStart')} {new Date(proposal.start_date).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Badge>
        )}
        {proposal.end_date && (
          <Badge variant="secondary" className="text-base px-3 py-1">
            {t('detail.badges.estEnd')} {new Date(proposal.end_date).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Badge>
        )}
      </div>

      {
        proposal.status === 'approved' && proposal.project_id && (
          <Alert className="border-success/30 bg-success/10 text-success">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertTitle>{t('detail.approvedAlert.title')}</AlertTitle>
            <AlertDescription className="mt-2">
              {t('detail.approvedAlert.description')}
              <Button asChild variant="link" className="p-0 h-auto ml-2 text-success font-semibold">
                <Link href={`/projects/${proposal.project_id}`}>
                  {t('detail.approvedAlert.viewProject')} <ExternalLink className="ml-1 h-3 w-3 inline" />
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )
      }

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('detail.descriptionCard.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Client Info */}
            {proposal.client && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase">{tCommon('name')}</div>
                    <div className="font-medium">{proposal.client.name}</div>
                  </div>
                </div>
                {proposal.client.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase">{tCommon('email')}</div>
                      <div className="font-medium">{proposal.client.email}</div>
                    </div>
                  </div>
                )}
                {proposal.client.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase">{tCommon('phone')}</div>
                      <div className="font-medium">{proposal.client.phone}</div>
                    </div>
                  </div>
                )}
                {proposal.client.document && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase">Documento</div>
                      <div className="font-medium">{proposal.client.document}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="font-semibold mb-3 text-lg">{t('detail.descriptionCard.title')}</h3>
              <div className="text-base whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {proposal.description || t('detail.descriptionCard.empty')}
              </div>
            </div>

            {/* Detailed Services Breakdown */}
            {((proposal.services && proposal.services.length > 0) || (proposal.proposal_metadata?.line_items && proposal.proposal_metadata.line_items.length > 0)) && (
              <div>
                <h3 className="font-semibold mb-3 text-lg">{t('detail.financials.services')}</h3>
                <div className="border rounded-lg divide-y bg-card">
                  {/* Services */}
                  {proposal.services?.map(service => (
                    <div key={service.id} className="p-4">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{service.name}</span>
                        <span className="font-mono text-muted-foreground">{formatCurrency(service.value_cents, proposal.currency)}</span>
                      </div>
                      {service.description && <p className="text-sm text-muted-foreground">{service.description}</p>}
                    </div>
                  ))}
                  {/* Line Items */}
                  {proposal.proposal_metadata?.line_items?.map((item: ProposalLineItem, i: number) => (
                    <div key={item.id || i} className="p-4">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{item.description || t('detail.financials.unnamedItem')}</span>
                        <span className="font-mono text-muted-foreground">{formatCurrency(item.value_cents, proposal.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Terms Conditions (Moved here) */}
            {proposal.terms_conditions && (
              <div>
                <h3 className="font-semibold mb-3 text-lg">{t('detail.termsConditions.title')}</h3>
                <div className="text-sm bg-muted/10 p-4 rounded-lg border whitespace-pre-wrap text-muted-foreground">
                  {proposal.terms_conditions}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.financials.title')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{t('detail.financials.totalInvestment')}</div>
                  <div className="text-3xl font-black text-primary tracking-tighter">
                    {proposal.total_amount_cents !== null ? formatCurrency(proposal.total_amount_cents, proposal.currency) : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="border-t border-muted/30">
                <div className="divide-y divide-muted/20">
                  {/* Base Fee / Manual Adjustment */}
                  {proposal.base_amount_cents ? (
                    <div className="px-4 py-3 flex justify-between items-center bg-muted/10">
                      <span className="text-xs font-semibold text-secondary-foreground italic">
                        {proposal.base_amount_cents < 0
                          ? t('detail.financials.discount')
                          : t('detail.financials.manualAdjustment')}
                      </span>
                      <span className="text-sm font-mono font-bold text-secondary-foreground">
                        {formatCurrency(proposal.base_amount_cents, proposal.currency)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="p-4 bg-primary/[0.03] flex justify-between items-center border-t border-primary/20">
                  <span className="text-sm font-bold text-primary">{t('detail.financials.finalTotal')}</span>
                  <span className="text-lg font-black text-primary font-mono tracking-tighter">
                    {proposal.total_amount_cents !== null ? formatCurrency(proposal.total_amount_cents, proposal.currency) : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="p-4 text-[10px] text-muted-foreground/60 border-t border-muted/20 bg-muted/5">
                {t('detail.financials.currencyNote')} <span className="font-bold text-muted-foreground/80">{proposal.currency}</span> • {t('detail.financials.validityNote')} {proposal.valid_until ? new Date(proposal.valid_until).toLocaleDateString(locale) : 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('detail.attachments.title')}</CardTitle>
          </div>
          <CardDescription>
            {t('detail.attachments.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadZone
            module="proposals"
            entityId={proposalId}
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
        title={t('delete.title')}
        description={t('delete.description')}
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
    </div >
  )
}
