import {
  MAX_GROUP_COUNT,
  MAX_GROUP_NAME_LENGTH,
  DEFAULT_GROUP_ID
} from "./constants"
import type {
  AnalysisService,
  LastOperation,
  Preferences,
  ServiceGroup,
  UserConfig
} from "./types"
import type { Workflow, WorkflowMode, WorkflowOpenStrategy } from "./types"

const now = () => new Date().toISOString()

export const inferSupportedVariables = (template: string) => ({
  domain: template.includes("{domain}"),
  text: template.includes("{text}")
})

export const createDefaultConfig = (): UserConfig => {
  return createInitialConfig()
}

export const createInitialConfig = (): UserConfig => ({
  services: [],
  workflows: [],
  workflowOrder: [],
  groups: [],
  groupOrder: [DEFAULT_GROUP_ID],
  preferences: createDefaultPreferences(),
  lastOperations: createDefaultLastOperations()
})

export const serializeConfigForExport = (config: UserConfig): UserConfig => ({
  services: config.services,
  workflows: config.workflows,
  workflowOrder: config.workflowOrder,
  groups: config.groups,
  groupOrder: config.groupOrder,
  preferences: config.preferences,
  lastOperations: config.lastOperations
})

export const normalizeConfig = (config?: UserConfig | null): UserConfig => {
  if (!config) {
    return createInitialConfig()
  }

  const services: Partial<AnalysisService>[] = Array.isArray(config.services)
    ? config.services
    : []
  const workflows: Partial<Workflow>[] = Array.isArray(config.workflows)
    ? config.workflows
    : []
  const workflowOrder: string[] = Array.isArray(config.workflowOrder)
    ? config.workflowOrder
    : []
  const groups: ServiceGroup[] = Array.isArray(config.groups) ? config.groups : []
  const groupOrder: string[] = Array.isArray(config.groupOrder)
    ? config.groupOrder
    : []
  const preferences = normalizePreferences(config.preferences)
  const lastOperations = normalizeLastOperations(config.lastOperations)

  const normalizedServices: AnalysisService[] = services.map((service) => {
    const urlTemplate =
      typeof service.urlTemplate === "string" ? service.urlTemplate : ""
    const supportedVariables = hasSupportedVariables(service)
      ? service.supportedVariables
      : inferSupportedVariables(urlTemplate)
    return {
      ...service,
      urlTemplate,
      supportedVariables
    } as AnalysisService
  })

  const serviceIds = new Set(normalizedServices.map((service) => service.id))
  const normalizedWorkflows: Workflow[] = workflows.map((workflow) => ({
    id: typeof workflow.id === "string" ? workflow.id : "",
    name: typeof workflow.name === "string" ? workflow.name : "",
    serviceIds: Array.isArray(workflow.serviceIds)
      ? workflow.serviceIds.filter((id): id is string => typeof id === "string" && serviceIds.has(id))
      : [],
    mode: normalizeWorkflowMode(workflow.mode),
    pinned: typeof workflow.pinned === "boolean" ? workflow.pinned : false,
    openStrategy: normalizeWorkflowOpenStrategy(workflow.openStrategy)
  }))
  const workflowIds = new Set(
    normalizedWorkflows.filter((workflow) => workflow.id).map((workflow) => workflow.id)
  )
  const normalizedWorkflowOrder = workflowOrder.filter((id) => workflowIds.has(id))

  normalizedWorkflows.forEach((workflow) => {
    if (workflow.id && !normalizedWorkflowOrder.includes(workflow.id)) {
      normalizedWorkflowOrder.push(workflow.id)
    }
  })

  const normalizedGroups = groups.slice(0, MAX_GROUP_COUNT).map((group, index) => ({
    ...group,
    order: index,
    serviceIds: (group.serviceIds || []).filter((id) => serviceIds.has(id))
  }))

  const groupIds = new Set(normalizedGroups.map((group) => group.id))
  const normalizedOrder = groupOrder.filter(
    (id) => id === DEFAULT_GROUP_ID || groupIds.has(id)
  )

  normalizedGroups.forEach((group) => {
    if (!normalizedOrder.includes(group.id)) {
      normalizedOrder.push(group.id)
    }
  })

  if (!normalizedOrder.includes(DEFAULT_GROUP_ID)) {
    normalizedOrder.unshift(DEFAULT_GROUP_ID)
  }

  return {
    services: normalizedServices,
    workflows: normalizedWorkflows.filter((workflow) => workflow.id),
    workflowOrder: normalizedWorkflowOrder,
    groups: normalizedGroups,
    groupOrder: normalizedOrder,
    preferences,
    lastOperations
  }
}

export const buildServiceUrl = (
  template: string,
  params: { domain?: string | null; text?: string | null }
) => {
  if (!template) {
    return null
  }

  const hasDomain = template.includes("{domain}")
  const hasText = template.includes("{text}")

  if (!hasDomain && !hasText) {
    return null
  }

  let result = template

  if (hasDomain) {
    if (!params.domain) {
      return null
    }
    result = result.split("{domain}").join(params.domain)
  }

  if (hasText) {
    if (!params.text) {
      return null
    }
    result = result
      .split("{text}")
      .join(encodeURIComponent(params.text))
  }

  return result
}

export const getGroupedServiceIds = (groups: ServiceGroup[]) => {
  const ids = new Set<string>()
  groups.forEach((group) => {
    group.serviceIds.forEach((id) => ids.add(id))
  })
  return ids
}

export const getUngroupedServices = (
  services: AnalysisService[],
  groups: ServiceGroup[]
) => {
  const groupedIds = getGroupedServiceIds(groups)
  return services.filter((service) => !groupedIds.has(service.id))
}

export const getOrderedGroups = (config: UserConfig) => {
  const groupMap = new Map(config.groups.map((group) => [group.id, group]))
  return config.groupOrder
    .map((id) => groupMap.get(id))
    .filter((group): group is ServiceGroup => Boolean(group))
}

export const getOrderedWorkflows = (config: UserConfig) => {
  const workflowMap = new Map(config.workflows.map((workflow) => [workflow.id, workflow]))
  return config.workflowOrder
    .map((id) => workflowMap.get(id))
    .filter((workflow): workflow is Workflow => Boolean(workflow))
}

export const clampGroupName = (name: string) => name.trim().slice(0, MAX_GROUP_NAME_LENGTH)

const createDefaultPreferences = (): Preferences => ({
  closeSidePanelAfterOpen: "batch-only"
})

const createDefaultLastOperation = (): LastOperation => ({
  type: null,
  id: null,
  name: null,
  timestamp: now()
})

const createDefaultLastOperations = (): UserConfig["lastOperations"] => ({
  domainMode: createDefaultLastOperation(),
  textMode: createDefaultLastOperation()
})

const normalizePreferences = (preferences?: Preferences | null): Preferences => {
  const value = preferences?.closeSidePanelAfterOpen
  if (value === "always" || value === "never" || value === "batch-only") {
    return { closeSidePanelAfterOpen: value }
  }
  return createDefaultPreferences()
}

const normalizeLastOperation = (
  operation?: Partial<LastOperation> | null
): LastOperation => ({
  type:
    operation?.type === "service" ||
    operation?.type === "group" ||
    operation?.type === "workflow"
      ? operation.type
      : null,
  id: typeof operation?.id === "string" ? operation.id : null,
  name: typeof operation?.name === "string" ? operation.name : null,
  timestamp: typeof operation?.timestamp === "string" ? operation.timestamp : now()
})

const normalizeLastOperations = (
  lastOperations?: UserConfig["lastOperations"] | null
): UserConfig["lastOperations"] => ({
  domainMode: normalizeLastOperation(lastOperations?.domainMode),
  textMode: normalizeLastOperation(lastOperations?.textMode)
})

const hasSupportedVariables = (
  service: Partial<AnalysisService>
): service is Partial<AnalysisService> & {
  supportedVariables: { domain: boolean; text: boolean }
} =>
  Boolean(
    service.supportedVariables &&
      typeof service.supportedVariables.domain === "boolean" &&
      typeof service.supportedVariables.text === "boolean"
  )

const normalizeWorkflowMode = (mode?: WorkflowMode | null): WorkflowMode => {
  if (mode === "domain" || mode === "text" || mode === "both") {
    return mode
  }

  return "both"
}

const normalizeWorkflowOpenStrategy = (
  value?: WorkflowOpenStrategy | null
): WorkflowOpenStrategy => {
  if (value === "foreground-first" || value === "background-all") {
    return value
  }

  return "foreground-first"
}
