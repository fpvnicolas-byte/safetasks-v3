import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { serviceApi } from '../services'
import { ServiceCreate, ServiceUpdate, ServiceEquipmentCreate } from '@/types'

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

export function useServiceEquipment(serviceId?: string) {
    return useQuery({
        queryKey: ['service-equipment', serviceId],
        queryFn: () => serviceApi.getEquipment(serviceId!),
        enabled: !!serviceId,
    })
}

export function useLinkServiceEquipment(serviceId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: ServiceEquipmentCreate) => serviceApi.linkEquipment(serviceId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['service-equipment', serviceId] })
        },
    })
}

export function useUnlinkServiceEquipment(serviceId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (kitId: string) => serviceApi.unlinkEquipment(serviceId, kitId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['service-equipment', serviceId] })
        },
    })
}
