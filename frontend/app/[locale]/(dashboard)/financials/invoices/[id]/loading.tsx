import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function InvoiceDetailLoading() {
    return (
        <div className="space-y-6">
            {/* Back button + Header */}
            <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-8" />
                <div>
                    <Skeleton className="h-8 w-48 mb-1" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <div className="ml-auto flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>

            {/* Invoice status bar */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-6 w-20 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-8 w-28" />
                    </div>
                </CardContent>
            </Card>

            {/* Invoice details */}
            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Line items table header */}
                        <div className="flex items-center gap-4 border-b pb-2">
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                        {/* Line items */}
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-2">
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        ))}
                        {/* Totals */}
                        <div className="border-t pt-4 space-y-2">
                            <div className="flex justify-end gap-8">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <div className="flex justify-end gap-8">
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <div className="flex justify-end gap-8">
                                <Skeleton className="h-6 w-16" />
                                <Skeleton className="h-6 w-28" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sidebar info */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-28" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="space-y-1">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-5 w-full" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
