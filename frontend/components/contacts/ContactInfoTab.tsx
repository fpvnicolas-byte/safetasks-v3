'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, MapPin, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ContactDetail } from '@/types'

interface ContactInfoTabProps {
  contact: ContactDetail
}

export function ContactInfoTab({ contact }: ContactInfoTabProps) {
  const t = useTranslations('contacts.detail')

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('contactInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contact.email && (
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t('email')}</div>
                <div className="text-base">{contact.email}</div>
              </div>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t('phone')}</div>
                <div className="text-base">{contact.phone}</div>
              </div>
            </div>
          )}
          {contact.address && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t('address')}</div>
                <div className="text-base whitespace-pre-line">{contact.address}</div>
              </div>
            </div>
          )}
          {contact.document_id && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t('documentId')}</div>
                <div className="text-base">{contact.document_id}</div>
              </div>
            </div>
          )}
          {!contact.email && !contact.phone && !contact.address && !contact.document_id && (
            <p className="text-muted-foreground text-sm">{t('noContactInfo')}</p>
          )}
        </CardContent>
      </Card>

      {contact.specialties && contact.specialties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('specialties')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {contact.specialties.map((s, i) => (
                <Badge key={i} variant="secondary">{s}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {contact.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{t('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base whitespace-pre-wrap">{contact.notes}</div>
          </CardContent>
        </Card>
      )}

      {contact.bank_info && Object.keys(contact.bank_info).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('bankInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              {Object.entries(contact.bank_info).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
