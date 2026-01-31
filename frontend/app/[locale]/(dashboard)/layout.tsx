'use client'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { TrialBanner } from '@/components/billing/TrialBanner'
import { useState } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex">
        {/* Desktop Sidebar */}
        <Sidebar />
        
        {/* Mobile Navigation */}
        <MobileNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <div className="flex-1 min-h-screen">
          <TrialBanner />
          <Header onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
