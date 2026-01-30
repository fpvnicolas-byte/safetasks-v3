import { useState } from 'react'

export function useConfirmDelete() {
    const [open, setOpen] = useState(false)
    const [targetId, setTargetId] = useState<string | null>(null)
    const [additionalData, setAdditionalData] = useState<unknown>(null)

    const askConfirmation = (id: string, data?: unknown) => {
        setTargetId(id)
        if (data) setAdditionalData(data)
        setOpen(true)
    }

    const closeConfirmation = () => {
        setOpen(false)
        // Delay clearing data slightly to avoid UI flicker during exit animation if needed
        // or clear immediately if acceptable.
        setTimeout(() => {
            setTargetId(null)
            setAdditionalData(null)
        }, 300)
    }

    return {
        open,
        onOpenChange: setOpen,
        askConfirmation,
        closeConfirmation,
        targetId,
        additionalData,
    }
}
