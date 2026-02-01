import { ICONS, MAX_GROUPS, MAX_GROUP_NAME, UNGROUPED_ID } from "./constants"
import { t } from "./i18n"
import { createId } from "./id"
import type { AnalysisService, ServiceGroup, UserConfig } from "./types"

const now = () => new Date().toISOString()

const createService = (name: string, urlTemplate: string): AnalysisService => ({
  id: createId(),
  name,
  urlTemplate,
  createdAt: now()
})

const createGroup = (name: string, icon: string, order: number): ServiceGroup => ({
  id: createId(),
  name,
  icon,
  order,
  serviceIds: []
})

export const createDefaultConfig = (): UserConfig => {
  const seoGroup = createGroup(t("sampleGroupSeo"), ICONS[0], 0)
  const techGroup = createGroup(t("sampleGroupTech"), ICONS[3], 1)
  const safetyGroup = createGroup(t("sampleGroupSecurity"), ICONS[2], 2)

  const services = [
    createService(
      t("sampleServiceAhrefs"),
      "https://ahrefs.com/backlink-checker/?input={domain}&mode=subdomains"
    ),
    createService(
      t("sampleServiceSimilarWeb"),
      "https://similarweb.com/website/{domain}"
    ),
    createService(
      t("sampleServiceBuiltWith"),
      "https://builtwith.com/{domain}"
    ),
    createService(
      t("sampleServiceSecurityHeaders"),
      "https://securityheaders.com/?q={domain}"
    ),
    createService(t("sampleServiceWhois"), "https://whois.domaintools.com/{domain}")
  ]

  seoGroup.serviceIds.push(services[0].id, services[1].id)
  techGroup.serviceIds.push(services[2].id, services[4].id)
  safetyGroup.serviceIds.push(services[3].id)

  const groups = [seoGroup, techGroup, safetyGroup]

  return {
    services,
    groups,
    groupOrder: [UNGROUPED_ID, ...groups.map((group) => group.id)]
  }
}

export const createInitialConfig = (): UserConfig => ({
  services: [],
  groups: [],
  groupOrder: [UNGROUPED_ID]
})

export const normalizeConfig = (config?: UserConfig | null): UserConfig => {
  if (!config) {
    return createInitialConfig()
  }

  const services = Array.isArray(config.services) ? config.services : []
  const groups = Array.isArray(config.groups) ? config.groups : []
  const groupOrder = Array.isArray(config.groupOrder) ? config.groupOrder : []

  const serviceIds = new Set(services.map((service) => service.id))
  const normalizedGroups = groups.slice(0, MAX_GROUPS).map((group, index) => ({
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
    services,
    groups: normalizedGroups,
    groupOrder: normalizedOrder
  }
}

export const buildServiceUrl = (template: string, domain: string) => {
  if (!template || !template.includes("{domain}")) {
    return null
  }

  return template.split("{domain}").join(domain)
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

export const clampGroupName = (name: string) => name.trim().slice(0, MAX_GROUP_NAME)
