'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useServiceEquipment, useLinkServiceEquipment, useUnlinkServiceEquipment } from '@/lib/api/hooks/useServices'
import { useKits } from '@/lib/api/hooks/useKits'
import { Service } from '@/types'
import { Loader2, Plus, Trash2, Link as LinkIcon } from 'lucide-react'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'

interface ServiceEquipmentDialogProps {
    service: Service | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ServiceEquipmentDialog({ service, open, onOpenChange }: ServiceEquipmentDialogProps) {
    // We'll use a generic translation namespace or fallback for now since we haven't added specific keys
    // effectively hardcoding English/Portuguese fallbacks or using existing keys would be better, 
    // but I'll try to use descriptive keys that might validly exist or just hardcode text for this task implementation.
    // Given sticking to existing patterns, I'll use hardcoded text for now as I cannot easily edit locale files.

    // Attempting to reuse the page's translations context might be tricky if keys don't exist.
    // I will use hardcoded strings for this new feature to avoid missing translation keys errors.

    const { showError } = useErrorDialog()
    const [selectedKitId, setSelectedKitId] = useState<string>('')

    // Hooks
    const { data: linkedEquipment, isLoading: isLoadingLinked } = useServiceEquipment(service?.id)
    const { data: allKits } = useKits(service?.organization_id)

    // Mutations
    // Note: useLinkServiceEquipment expects serviceId as argument to the hook factory, 
    // but here we might have service as null initially.
    // We can skip the hook call if service is null, but rules of hooks prevent that.
    // We can pass an empty string or handle it.
    const linkEquipment = useLinkServiceEquipment(service?.id || '')
    const unlinkEquipment = useUnlinkServiceEquipment(service?.id || '')

    const handleLink = async () => {
        if (!selectedKitId || !service) return

        try {
            await linkEquipment.mutateAsync({
                kit_id: selectedKitId,
                is_primary: false, // Default
            })
            setSelectedKitId('')
        } catch (err: any) {
            showError(err, "Failed to link equipment")
        }
    }

    const handleUnlink = async (kitId: string) => {
        if (!service) return
        try {
            await unlinkEquipment.mutateAsync(kitId)
        } catch (err: any) {
            showError(err, "Failed to unlink equipment")
        }
    }

    // Filter available kits (exclude already linked)
    const linkedKitIds = new Set(linkedEquipment?.map(l => l.kit_id))
    const availableKits = allKits?.filter(k => !linkedKitIds.has(k.id)) || []

    if (!service) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Manage Equipment - {service.name}</DialogTitle>
                    <DialogDescription>
                        Link inventory kits to this service to track usage and maintenance.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Add New Link Section */}
                    <div className="flex items-end gap-4 p-4 border rounded-lg bg-muted/50">
                        <div className="flex-1 space-y-2">
                            <Label>Link Equipment Kit</Label>
                            <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a kit..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableKits.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            No available kits to link
                                        </div>
                                    ) : (
                                        availableKits.map((kit) => (
                                            <SelectItem key={kit.id} value={kit.id}>
                                                {kit.name} <span className="text-muted-foreground ml-2">({kit.category})</span>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={handleLink}
                            disabled={!selectedKitId || linkEquipment.isPending}
                        >
                            {linkEquipment.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Link
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Linked Equipment List */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Linked Equipment ({linkedEquipment?.length || 0})
                        </h4>

                        {isLoadingLinked ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : linkedEquipment && linkedEquipment.length > 0 ? (
                            <div className="grid gap-2">
                                {linkedEquipment.map((link) => (
                                    <div
                                        key={link.id}
                                        className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <LinkIcon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{link.kit_name}</div>
                                                {link.is_primary && (
                                                    <Badge variant="secondary" className="text-xs">Primary</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-destructive"
                                            onClick={() => handleUnlink(link.kit_id)}
                                            disabled={unlinkEquipment.isPending}
                                        >
                                            {unlinkEquipment.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                                No equipment linked to this service yet.
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
