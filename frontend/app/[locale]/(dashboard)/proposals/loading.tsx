import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProposalsLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Skeleton className="h-8 w-28 mb-2" />
                    <Skeleton className="h-4 w-52" />
                </div>
                <Skeleton className="h-10 w-36" />
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <Skeleton className="h-10 flex-1 max-w-sm" />
                <Skeleton className="h-10 w-28" />
            </div>

            {/* Table skeleton */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4 pb-4 border-b">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16 ml-auto" />
                    </div>
                    <div className="space-y-3 pt-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-2">
                                <Skeleton className="h-4 w-36" />
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-8 w-8 ml-auto" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
