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

export type WorkflowMode = OperationMode | "both"
export type WorkflowOpenStrategy = "foreground-first" | "background-all"

export interface Workflow {
  id: string
  name: string
  serviceIds: string[]
  mode: WorkflowMode
  pinned: boolean
  openStrategy: WorkflowOpenStrategy
}

export interface UserConfig {
  services: AnalysisService[]
  workflows: Workflow[]
  workflowOrder: string[]
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
  type: "service" | "group" | "workflow" | null
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
