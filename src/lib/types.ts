export interface AnalysisService {
  id: string
  name: string
  urlTemplate: string
  createdAt: string
  supportedVariables: {
    domain: boolean
    text: boolean
  }
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
  preferences: Preferences
  lastOperations: {
    domainMode: LastOperation
    textMode: LastOperation
  }
}

export type CloseSidePanelAfterOpen = "always" | "never" | "batch-only"

export interface Preferences {
  closeSidePanelAfterOpen: CloseSidePanelAfterOpen
}

export interface LastOperation {
  type: "service" | "group" | null
  id: string | null
  name: string | null
  timestamp: string
}

export type OperationMode = "domain" | "text"

export interface SelectionChangeMessage {
  type: "SELECTION_CHANGED"
  text: string
  source?: "current" | "cached" | "none"
  ageMs?: number
}
