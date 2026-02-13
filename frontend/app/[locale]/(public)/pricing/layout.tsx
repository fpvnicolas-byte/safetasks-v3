import { AuthProvider } from '@/contexts/AuthContext'

export default function PublicPricingLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
