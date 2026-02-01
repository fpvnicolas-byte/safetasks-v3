import { apiClient } from './client'
import { Service, ServiceCreate, ServiceUpdate } from '@/types'

const BASE_PATH = '/api/v1/services'

export const serviceApi = {
    getAll: async (organizationId: string) => {
        return apiClient.get<Service[]>(BASE_PATH)
    },

    getById: async (id: string, organizationId: string) => {
        return apiClient.get<Service>(`${BASE_PATH}/${id}`)
    },

    create: async (data: ServiceCreate) => {
        return apiClient.post<Service>(BASE_PATH, data)
    },

    update: async (id: string, data: ServiceUpdate) => {
        return apiClient.put<Service>(`${BASE_PATH}/${id}`, data)
    },

    delete: async (id: string) => {
        return apiClient.delete<Service>(`${BASE_PATH}/${id}`)
    },
}
