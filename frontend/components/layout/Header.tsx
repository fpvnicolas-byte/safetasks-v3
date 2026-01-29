'use client'

import { useAuth } from '@/contexts/AuthContext'
import { signOut } from '@/app/auth/actions'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationsBell } from '@/components/NotificationsBell'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, Settings, LogOut, Menu } from 'lucide-react'
import Link from 'next/link'


interface HeaderProps {
  onSidebarToggle: () => void
}

export function Header({ onSidebarToggle }: HeaderProps) {
  const { user } = useAuth()

  return (
    <header className="border-b">
      <div className="flex h-16 items-center px-4 gap-4">
        <Link href="/dashboard" className="font-bold text-xl">
          SafeTasks V3
        </Link>

        <nav className="flex gap-6 ml-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Dashboard
          </Link>
          <Link
            href="/projects"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Projects
          </Link>
          <Link
            href="/call-sheets"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Call Sheets
          </Link>
          <Link
            href="/financials"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Financials
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Mobile Navigation Toggle */}
          <button
            onClick={onSidebarToggle}
            className="lg:hidden p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Menu className="h-6 w-6" />
          </button>

          {user && <NotificationsBell />}
          <ThemeToggle />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
