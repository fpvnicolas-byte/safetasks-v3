'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { UpgradeModal } from '@/components/billing/UpgradeModal'

interface BillingContextType {
  showUpgradeModal: (message?: string) => void
  hideUpgradeModal: () => void
}

const BillingContext = createContext<BillingContextType | undefined>(undefined)

export function BillingProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMessage, setModalMessage] = useState<string | undefined>()

  const showUpgradeModal = useCallback((message?: string) => {
    setModalMessage(message)
    setIsModalOpen(true)
  }, [])

  const hideUpgradeModal = useCallback(() => {
    setIsModalOpen(false)
    setModalMessage(undefined)
  }, [])

  return (
    <BillingContext.Provider value={{ showUpgradeModal, hideUpgradeModal }}>
      {children}
      <UpgradeModal
        isOpen={isModalOpen}
        onClose={hideUpgradeModal}
        message={modalMessage}
      />
    </BillingContext.Provider>
  )
}

export function useBilling() {
  const context = useContext(BillingContext)
  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider')
  }
  return context
}
