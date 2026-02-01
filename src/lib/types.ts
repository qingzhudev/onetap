export interface AnalysisService {
  id: string
  name: string
  urlTemplate: string
  createdAt: string
}

export interface ServiceGroup {
  id: string
  name: string
  icon: string
  order: number
  serviceIds: string[]
}

export interface UserConfig {
  services: AnalysisService[]
  groups: ServiceGroup[]
  groupOrder: string[]
}
