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
import { Plus, Pencil, Trash2, Loader2, Package } from 'lucide-react'
import { Service, ServiceCreate, ServiceUpdate } from '@/types'
import { useTranslations } from 'next-intl'

export default function ServicesPage() {
    const { organizationId } = useAuth()
    const t = useTranslations('settings.servicesPage')
    const { errorDialog, showError, closeError } = useErrorDialog()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingService, setEditingService] = useState<Service | null>(null)

    const { data: services, isLoading } = useServices(organizationId || undefined)
    const createService = useCreateService(organizationId || undefined)
    const updateService = useUpdateService(organizationId || undefined)
    const deleteService = useDeleteService(organizationId || undefined)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        try {
            if (editingService) {
                const data: ServiceUpdate = {
                    name: (formData.get('name') as string).trim(),
                    description: (formData.get('description') as string || '').trim() || undefined,
                }
                await updateService.mutateAsync({ id: editingService.id, data })
            } else {
                const data: ServiceCreate = {
                    name: (formData.get('name') as string).trim(),
                    description: (formData.get('description') as string || '').trim() || undefined,
                }
                await createService.mutateAsync(data)
            }
            setIsDialogOpen(false)
            setEditingService(null)
        } catch (err: any) {
            showError(err, editingService ? t('errors.updating') : t('errors.creating'))
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t('delete.confirm'))) return
        try {
            await deleteService.mutateAsync(id)
        } catch (err: any) {
            showError(err, t('delete.error'))
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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
                    <p className="text-muted-foreground">{t('description')}</p>
                </div>
                <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('addService')}
                </Button>
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
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(service)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)}>
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
                    )}
                </CardContent>
            </Card>

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
        </div>
    )
}
