import React from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertCircle, XCircle } from 'lucide-react'

interface ValidationError {
    loc: (string | number)[]
    msg: string
    type: string
}

interface ErrorDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: string
    message: string
    validationErrors?: ValidationError[]
    statusCode?: number
}

export function ErrorDialog({
    open,
    onOpenChange,
    title = 'Error',
    message,
    validationErrors,
    statusCode,
}: ErrorDialogProps) {
    const isValidationError = statusCode === 422 && validationErrors && validationErrors.length > 0

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3">
                        {isValidationError ? (
                            <AlertCircle className="h-6 w-6 text-amber-500" />
                        ) : (
                            <XCircle className="h-6 w-6 text-destructive" />
                        )}
                        <AlertDialogTitle>{title}</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription asChild>
                        <div className="text-left space-y-3 pt-2 text-muted-foreground text-sm">
                            <div className="text-base">{message}</div>

                            {isValidationError && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3 space-y-2">
                                    <p className="font-semibold text-sm text-amber-900 dark:text-amber-100">
                                        Validation Issues:
                                    </p>
                                    <ul className="space-y-1.5 text-sm">
                                        {validationErrors.map((error, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                                                <span className="text-amber-900 dark:text-amber-100">
                                                    <span className="font-medium">
                                                        {error.loc.slice(1).join(' → ')}:
                                                    </span>{' '}
                                                    {error.msg}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {statusCode && !isValidationError && (
                                <p className="text-sm text-muted-foreground">
                                    Error code: {statusCode}
                                </p>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => onOpenChange(false)}>
                        OK
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
