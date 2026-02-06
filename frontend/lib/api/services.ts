import { apiClient } from './client'
import { Service, ServiceCreate, ServiceUpdate, ServiceEquipmentCreate, ServiceEquipmentResponse } from '@/types'

const BASE_PATH = '/api/v1/services/'

export const serviceApi = {
    getAll: async (organizationId: string) => {
        return apiClient.get<Service[]>(BASE_PATH)
    },

    getById: async (id: string, organizationId: string) => {
        return apiClient.get<Service>(`${BASE_PATH}${id}`)
    },

    create: async (data: ServiceCreate) => {
        return apiClient.post<Service>(BASE_PATH, data)
    },

    update: async (id: string, data: ServiceUpdate) => {
        return apiClient.put<Service>(`${BASE_PATH}${id}`, data)
    },

    delete: async (id: string) => {
        return apiClient.delete<Service>(`${BASE_PATH}${id}`)
    },

    getEquipment: async (serviceId: string) => {
        return apiClient.get<ServiceEquipmentResponse[]>(`${BASE_PATH}${serviceId}/equipment`)
    },

    linkEquipment: async (serviceId: string, data: ServiceEquipmentCreate) => {
        return apiClient.post<ServiceEquipmentResponse>(`${BASE_PATH}${serviceId}/equipment`, data)
    },

    unlinkEquipment: async (serviceId: string, kitId: string) => {
        return apiClient.delete(`${BASE_PATH}${serviceId}/equipment/${kitId}`)
    },
}
