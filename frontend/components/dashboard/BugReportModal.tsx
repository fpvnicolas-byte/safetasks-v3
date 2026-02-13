'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/api/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface BugReportModalProps {
    isOpen: boolean
    onClose: () => void
}

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
    const t = useTranslations('dashboard.bugReportModal')
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState<string>('')
    const [description, setDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!title || !category) {
            return
        }

        try {
            setIsSubmitting(true)
            await apiClient.post('/api/v1/bug-reports/', {
                title,
                category,
                description
            })
            toast.success(t('messages.submitSuccess'))
            setTitle('')
            setCategory('')
            setDescription('')
            onClose()
        } catch (error: unknown) {
            console.error('Bug report submission failed', error)
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('messages.submitError')
            toast.error(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>{t('fields.titleLabel')}</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('fields.titlePlaceholder')}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('fields.categoryLabel')}</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('fields.categoryPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bug">{t('fields.categoryOptions.bug')}</SelectItem>
                                <SelectItem value="feature_request">{t('fields.categoryOptions.featureRequest')}</SelectItem>
                                <SelectItem value="other">{t('fields.categoryOptions.other')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('fields.descriptionLabel')}</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('fields.descriptionPlaceholder')}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        {t('actions.cancel')}
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !title || !category}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('actions.submit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
