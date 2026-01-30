import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { serviceApi } from '../services'
import { ServiceCreate, ServiceUpdate } from '@/types'

export function useServices(organizationId?: string) {
    const queryClient = useQueryClient()

    const { data, isLoading, error } = useQuery({
        queryKey: ['services', organizationId],
        queryFn: () => serviceApi.getAll(organizationId!),
        enabled: !!organizationId,
    })

    return {
        data,
        isLoading,
        error,
    }
}

export function useCreateService(organizationId?: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: ServiceCreate) => serviceApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services', organizationId] })
        },
    })
}

export function useUpdateService(organizationId?: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ServiceUpdate }) =>
            serviceApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services', organizationId] })
        },
    })
}

export function useDeleteService(organizationId?: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => serviceApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services', organizationId] })
        },
    })
}
