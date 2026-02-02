'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useServices, useCreateService, useUpdateService, useDeleteService } from '@/lib/api/hooks/useServices'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Plus, Pencil, Trash2, Loader2, Package, Link as LinkIcon } from 'lucide-react'
import { Service, ServiceCreate, ServiceUpdate, dollarsToCents, centsToDollars } from '@/types'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'
import { ServiceEquipmentDialog } from './ServiceEquipmentDialog'

export default function ServicesPage() {
    const { organizationId } = useAuth()
    const t = useTranslations('settings.servicesPage')
    const { errorDialog, showError, closeError } = useErrorDialog()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingService, setEditingService] = useState<Service | null>(null)
    const [equipmentDialogService, setEquipmentDialogService] = useState<Service | null>(null)

    const { data: services, isLoading } = useServices(organizationId || undefined)
    const createService = useCreateService(organizationId || undefined)
    const updateService = useUpdateService(organizationId || undefined)
    const deleteService = useDeleteService(organizationId || undefined)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const valueDollars = parseFloat(formData.get('value') as string || '0')

        try {
            if (editingService) {
                const data: ServiceUpdate = {
                    name: (formData.get('name') as string).trim(),
                    description: (formData.get('description') as string || '').trim() || undefined,
                    value_cents: dollarsToCents(valueDollars),
                }
                await updateService.mutateAsync({ id: editingService.id, data })
            } else {
                const data: ServiceCreate = {
                    name: (formData.get('name') as string).trim(),
                    description: (formData.get('description') as string || '').trim() || undefined,
                    value_cents: dollarsToCents(valueDollars),
                }
                await createService.mutateAsync(data)
            }
            setIsDialogOpen(false)
            setEditingService(null)
        } catch (err: any) {
            showError(err, editingService ? t('errors.updating') : t('errors.creating'))
        }
    }

    const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            await deleteService.mutateAsync(deleteTarget.id)
            setDeleteTarget(null)
        } catch (err: any) {
            showError(err, t('delete.error'))
        } finally {
            setIsDeleting(false)
        }
    }

    const openEditDialog = (service: Service) => {
        setEditingService(service)
        setIsDialogOpen(true)
    }

    const openCreateDialog = () => {
        setEditingService(null)
        setIsDialogOpen(true)
    }

    return (
        <div className="space-y-8">
            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                onConfirm={handleDelete}
                loading={isDeleting}
                title={t('delete.confirm')}
                description={deleteTarget?.name ? `${t('delete.confirm')} (${deleteTarget.name})` : t('delete.confirm')}
            />
            <div className="rounded-xl border bg-card/60 px-6 py-5">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Settings / Services
                </div>
                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h2>
                        <p className="text-muted-foreground">{t('description')}</p>
                    </div>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('addService')}
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('card.title')}</CardTitle>
                    <CardDescription>{t('card.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : services && services.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('table.name')}</TableHead>
                                    <TableHead>{t('table.description')}</TableHead>
                                    <TableHead>{t('table.value')}</TableHead>
                                    <TableHead className="w-[100px]">{t('table.actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {services.map((service) => (
                                    <TableRow key={service.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                {service.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{service.description || t('table.noDescription')}</TableCell>
                                        <TableCell>{formatCurrency(service.value_cents)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEquipmentDialogService(service)}
                                                    title={t('table.manageEquipment') || "Manage Equipment"}
                                                >
                                                    <LinkIcon className="h-4 w-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(service)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: service.id, name: service.name })}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            {t('empty')}
                        </div>
                    )
                    }
                </CardContent >
            </Card >

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingService ? t('dialog.editTitle') : t('dialog.addTitle')}</DialogTitle>
                            <DialogDescription>
                                {editingService ? t('dialog.editDescription') : t('dialog.addDescription')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">{t('dialog.nameLabel')}</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={editingService?.name}
                                    placeholder={t('dialog.namePlaceholder')}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="value">{t('dialog.valueLabel')}</Label>
                                <Input
                                    id="value"
                                    name="value"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={editingService ? centsToDollars(editingService.value_cents) : ''}
                                    placeholder={t('dialog.valuePlaceholder')}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">{t('dialog.descriptionLabel')}</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    defaultValue={editingService?.description || ''}
                                    placeholder={t('dialog.descriptionPlaceholder')}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                {t('dialog.cancel')}
                            </Button>
                            <Button type="submit" disabled={createService.isPending || updateService.isPending}>
                                {createService.isPending || updateService.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('dialog.saving')}
                                    </>
                                ) : (
                                    t('dialog.save')
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ErrorDialog
                open={errorDialog.open}
                onOpenChange={closeError}
                title={errorDialog.title}
                message={errorDialog.message}
                validationErrors={errorDialog.validationErrors}
                statusCode={errorDialog.statusCode}
            />

            <ServiceEquipmentDialog
                service={equipmentDialogService}
                open={!!equipmentDialogService}
                onOpenChange={(open) => !open && setEquipmentDialogService(null)}
            />
        </div >
    )
}
