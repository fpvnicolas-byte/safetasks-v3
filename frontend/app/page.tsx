import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Film, Calendar, DollarSign, Users } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold tracking-tight mb-4">
            SafeTasks V3
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Professional Film Production Management
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/auth/register">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-16">
          <Card>
            <CardHeader>
              <Film className="h-10 w-10 mb-2 text-blue-500 dark:text-blue-400" />
              <CardTitle>Project Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Organize multiple film projects with detailed tracking and status updates
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Calendar className="h-10 w-10 mb-2 text-green-500 dark:text-green-400" />
              <CardTitle>Call Sheets</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Create professional call sheets with crew times, locations, and contact info
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <DollarSign className="h-10 w-10 mb-2 text-yellow-500 dark:text-yellow-400" />
              <CardTitle>Financial Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Track budgets, invoices, and expenses with precision down to the cent
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 mb-2 text-purple-500 dark:text-purple-400" />
              <CardTitle>Team Collaboration</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manage clients, crew, and talent with centralized contact information
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="bg-muted/50 border-muted">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Ready to get started?</CardTitle>
            <CardDescription className="text-lg">
              Join professional filmmakers using SafeTasks V3
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button size="lg" asChild>
              <Link href="/auth/register">Create Free Account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 SafeTasks V3. Built for film production professionals.</p>
        </div>
      </footer>
    </div>
  )
}
