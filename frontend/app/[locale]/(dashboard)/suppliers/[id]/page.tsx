'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSupplier, useDeleteSupplier, useSupplierStatement } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, ArrowLeft, Briefcase, Mail, Phone, MapPin, FileText, DollarSign, UserPlus, Copy, Check, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { getSupplierCategoryDisplayName, formatCurrency } from '@/types'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useCreateInvite } from '@/lib/api/hooks'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, profile } = useAuth()
  const supplierId = params.id as string
  const t = useTranslations('suppliers')
  const effectiveRole = profile?.effective_role || ''

  // Get dates from URL parameters
  const urlDateFrom = searchParams.get('date_from') || ''
  const urlDateTo = searchParams.get('date_to') || ''

  // State for form inputs (synced with URL)
  const [dateFrom, setDateFrom] = useState<string>(urlDateFrom)
  const [dateTo, setDateTo] = useState<string>(urlDateTo)

  // Only show statement when explicitly generated (not from URL)
  const [showStatement, setShowStatement] = useState<boolean>(false)

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Invite freelancer state
  const createInvite = useCreateInvite()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)

  const { data: supplier, isLoading, error } = useSupplier(supplierId, organizationId || undefined)
  const deleteSupplier = useDeleteSupplier()

  // Only fetch statement when explicitly requested
  const { data: statement, isLoading: isLoadingStatement } = useSupplierStatement(
    supplierId,
    organizationId || '',
    showStatement ? (dateFrom || undefined) : undefined,
    showStatement ? (dateTo || undefined) : undefined,
    showStatement
  )

  // Update URL only when statement is generated (not on date input)
  useEffect(() => {
    if (showStatement && dateFrom && dateTo) {
      const params = new URLSearchParams(searchParams.toString())

      params.set('date_from', dateFrom)
      params.set('date_to', dateTo)

      // Update URL without triggering a page reload
      router.replace(`${window.location.pathname}?${params.toString()}`)
    }
  }, [showStatement, dateFrom, dateTo, router, searchParams])

  // Sync local state with URL when URL changes (only on initial load or URL change)
  useEffect(() => {
    const newUrlDateFrom = searchParams.get('date_from') || ''
    const newUrlDateTo = searchParams.get('date_to') || ''

    // Only update state if URL dates are different and we're not in the middle of user input
    if (newUrlDateFrom !== dateFrom && newUrlDateFrom !== '') {
      setDateFrom(newUrlDateFrom)
    }
    if (newUrlDateTo !== dateTo && newUrlDateTo !== '') {
      setDateTo(newUrlDateTo)
    }

    // Auto-show statement if both dates are in URL (only on initial load)
    if (newUrlDateFrom && newUrlDateTo && !showStatement) {
      setShowStatement(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]) // Only depend on searchParams, not dateFrom/dateTo


  if (isLoading) {
    return <div>Loading supplier...</div>
  }

  if (error || !supplier) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Supplier not found</AlertDescription>
      </Alert>
    )
  }

  const handleDelete = async () => {
    try {
      await deleteSupplier.mutateAsync(supplierId)
      router.push('/suppliers')
    } catch (err) {
      console.error('Failed to delete supplier:', err)
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  const canInviteFreelancer =
    supplier?.category === 'freelancer' &&
    supplier?.profile_id === null &&
    ['owner', 'admin', 'producer'].includes(effectiveRole)

  const handleInviteFreelancer = async () => {
    if (!supplier?.email) {
      toast.error('This supplier has no email. Add an email before inviting.')
      return
    }
    try {
      const result = await createInvite.mutateAsync({
        email: supplier.email,
        role_v2: 'freelancer',
        supplier_id: supplier.id,
      })
      setInviteLink(result.invite_link)
      setInviteDialogOpen(true)
      if (result.seat_warning) {
        toast.warning(result.seat_warning)
      }
    } catch (err: any) {
      const status = err?.statusCode
      if (status === 409) {
        toast.error('An invite is already pending for this email')
      } else if (status === 402) {
        toast.error('Seat limit reached — upgrade your plan')
      } else {
        toast.error(err?.message || 'Failed to create invite')
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={deleteSupplier.isPending}
        title={t('delete.confirmTitle')}
        description={t('delete.confirm', { name: supplier.name })}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{supplier.name}</h1>
            <p className="text-muted-foreground">{getSupplierCategoryDisplayName(supplier.category)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canInviteFreelancer && (
            <Button variant="outline" onClick={handleInviteFreelancer} disabled={createInvite.isPending}>
              {createInvite.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Invite to Platform
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/suppliers/${supplierId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled={deleteSupplier.isPending}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
          {supplier.is_active ? 'Active' : 'Inactive'}
        </Badge>
        <Badge variant="outline">
          {getSupplierCategoryDisplayName(supplier.category)}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {supplier.email && (
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Email</div>
                <div className="text-base">{supplier.email}</div>
              </div>
            </div>
          )}

          {supplier.phone && (
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Phone</div>
                <div className="text-base">{supplier.phone}</div>
              </div>
            </div>
          )}

          {supplier.address && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Address</div>
                <div className="text-base whitespace-pre-line">{supplier.address}</div>
              </div>
            </div>
          )}

          {supplier.document_id && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Tax ID / Document</div>
                <div className="text-base">{supplier.document_id}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {supplier.specialties && supplier.specialties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Specialties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {supplier.specialties.map((specialty, index) => (
                <Badge key={index} variant="secondary">
                  {specialty}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {supplier.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base whitespace-pre-wrap">{supplier.notes}</div>
          </CardContent>
        </Card>
      )}

      {/* Financial Statement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Statement
          </CardTitle>
          <CardDescription>
            View transaction history and financial breakdown for this supplier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date_from">From Date</Label>
              <Input
                id="date_from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_to">To Date</Label>
              <Input
                id="date_to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => setShowStatement(true)}
                className="w-full"
                disabled={!dateFrom || !dateTo}
              >
                Generate Statement
              </Button>
            </div>
          </div>

          {showStatement && isLoadingStatement && (
            <div className="text-sm text-muted-foreground">Loading statement...</div>
          )}

          {showStatement && statement && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Total Transactions</div>
                  <div className="text-2xl font-bold">{statement.total_transactions}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Total Amount</div>
                  <div className="text-2xl font-bold">{formatCurrency(statement.total_amount_cents, statement.currency)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Period</div>
                  <div className="text-sm">
                    {statement.statement_period.from || 'All time'} - {statement.statement_period.to || 'Present'}
                  </div>
                </div>
              </div>

              {statement.project_breakdown && statement.project_breakdown.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">By Project</h4>
                  <div className="space-y-2">
                    {statement.project_breakdown.map((project, index) => {
                      const projectRecord = project as Record<string, unknown>
                      const projectName = (projectRecord.project_name as string) || 'Unknown Project'
                      const totalCents = (projectRecord.total_cents as number) || 0
                      return (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{projectName}</span>
                          <span className="font-medium">{formatCurrency(totalCents, statement.currency)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Freelancer Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setInviteDialogOpen(false)
          setInviteLink('')
          setInviteCopied(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Link Created</DialogTitle>
            <DialogDescription>
              Share this link with {supplier?.name} to invite them to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={inviteLink} readOnly className="flex-1 text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteLink)
                setInviteCopied(true)
                setTimeout(() => setInviteCopied(false), 2000)
              }}
            >
              {inviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => { setInviteDialogOpen(false); setInviteLink(''); setInviteCopied(false) }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
