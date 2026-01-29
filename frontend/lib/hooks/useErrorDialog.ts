import { useState } from 'react'

interface ValidationError {
    loc: (string | number)[]
    msg: string
    type: string
}

interface ErrorDialogState {
    open: boolean
    title: string
    message: string
    validationErrors?: ValidationError[]
    statusCode?: number
}

export function useErrorDialog() {
    const [errorDialog, setErrorDialog] = useState<ErrorDialogState>({
        open: false,
        title: '',
        message: '',
    })

    const showError = (error: any, defaultTitle = 'Error') => {
        setErrorDialog({
            open: true,
            title: error.statusCode === 422 ? 'Validation Error' : defaultTitle,
            message: error.message || 'An unexpected error occurred. Please try again.',
            validationErrors: error.details && Array.isArray(error.details) ? error.details : undefined,
            statusCode: error.statusCode,
        })
    }

    const closeError = () => {
        setErrorDialog({ ...errorDialog, open: false })
    }

    return {
        errorDialog,
        showError,
        closeError,
        setErrorDialog,
    }
}
