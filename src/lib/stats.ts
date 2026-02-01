import { Storage } from "@plasmohq/storage"

type UsageStats = {
  services: Record<string, number>
  groups: Record<string, number>
}

const storage = new Storage({ area: "local" })
const STATS_KEY = "onetap:stats:v1"

const normalizeStats = (stats?: UsageStats | null): UsageStats => ({
  services: stats?.services ?? {},
  groups: stats?.groups ?? {}
})

const bump = (value: number | undefined) =>
  Number.isFinite(value) ? (value as number) + 1 : 1

export const getUsageStats = async (): Promise<UsageStats> => {
  const stored = await storage.get<UsageStats>(STATS_KEY)
  return normalizeStats(stored)
}

export const incrementUsageStats = async (params: {
  groupId?: string
  serviceIds?: string[]
}) => {
  const stats = await getUsageStats()

  if (params.groupId) {
    stats.groups[params.groupId] = bump(stats.groups[params.groupId])
  }

  if (params.serviceIds?.length) {
    params.serviceIds.forEach((id) => {
      stats.services[id] = bump(stats.services[id])
    })
  }

  await storage.set(STATS_KEY, stats)
}
