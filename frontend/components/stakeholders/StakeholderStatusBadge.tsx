'use client'

import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import type { StakeholderStatus } from '@/types'

interface StakeholderStatusBadgeProps {
  status: StakeholderStatus
}

const statusColors: Record<StakeholderStatus, string> = {
  requested: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  working: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export function StakeholderStatusBadge({ status }: StakeholderStatusBadgeProps) {
  const t = useTranslations('stakeholders.status')

  return (
    <Badge className={statusColors[status]}>
      {t(status)}
    </Badge>
  )
}
