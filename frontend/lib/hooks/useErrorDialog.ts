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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const showError = (error: any, defaultTitle = 'Error') => {
        let title = defaultTitle
        if (error.statusCode === 422) {
            title = 'Validation Error'
        } else if (error.statusCode === 400) {
            title = 'Configuration Required'
        }

        setErrorDialog({
            open: true,
            title,
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
