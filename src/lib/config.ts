import { MAX_GROUP_COUNT, MAX_GROUP_NAME_LENGTH, UNGROUPED_ID } from "./constants"
import type {
  AnalysisService,
  LastOperation,
  Preferences,
  ServiceGroup,
  UserConfig
} from "./types"

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
  groups: [],
  groupOrder: [UNGROUPED_ID],
  preferences: createDefaultPreferences(),
  lastOperations: createDefaultLastOperations()
})

export const normalizeConfig = (config?: UserConfig | null): UserConfig => {
  if (!config) {
    return createInitialConfig()
  }

  const services: Partial<AnalysisService>[] = Array.isArray(config.services)
    ? config.services
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
  const normalizedGroups = groups.slice(0, MAX_GROUP_COUNT).map((group, index) => ({
    ...group,
    order: index,
    serviceIds: (group.serviceIds || []).filter((id) => serviceIds.has(id))
  }))

  const groupIds = new Set(normalizedGroups.map((group) => group.id))
  const normalizedOrder = groupOrder.filter(
    (id) => id === UNGROUPED_ID || groupIds.has(id)
  )

  normalizedGroups.forEach((group) => {
    if (!normalizedOrder.includes(group.id)) {
      normalizedOrder.push(group.id)
    }
  })

  if (!normalizedOrder.includes(UNGROUPED_ID)) {
    normalizedOrder.unshift(UNGROUPED_ID)
  }

  return {
    services: normalizedServices,
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
  type: operation?.type === "service" || operation?.type === "group" ? operation.type : null,
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
