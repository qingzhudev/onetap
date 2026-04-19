import { Storage } from "@plasmohq/storage"

export type EventType =
  // Side panel events
  | "sidepanel_open"
  | "service_click_foreground"
  | "service_click_background"
  | "workflow_click_foreground"
  | "workflow_click_background"
  | "group_click_foreground"
  | "group_click_background"
  | "mode_switch"
  | "use_selection"
  | "open_settings"

  // Options page events
  | "options_open"
  | "group_create"
  | "group_delete"
  | "workflow_create"
  | "workflow_edit"
  | "workflow_delete"
  | "service_create"
  | "service_edit"
  | "service_delete"
  | "config_export"
  | "config_import"

export type EventCategory = "page" | "action" | "config"

export interface AnalyticsEvent {
  id: string
  eventType: EventType
  eventCategory: EventCategory
  timestamp: string
  data: Record<string, unknown>
}

export type SubscribeCallback = (events: AnalyticsEvent[]) => void

const storage = new Storage({ area: "local" })
const ANALYTICS_KEY = "onetap:analytics:v1"

const normalizeEvents = (
  events?: AnalyticsEvent[] | null
): AnalyticsEvent[] => events ?? []

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export const trackEvent = async (
  eventType: EventType,
  data: Record<string, unknown> = {}
): Promise<void> => {
  const category: EventCategory =
    eventType.startsWith("options") || eventType === "config_export" || eventType === "config_import"
      ? "config"
      : eventType === "sidepanel_open" || eventType === "options_open"
        ? "page"
        : "action"

  const event: AnalyticsEvent = {
    id: generateId(),
    eventType,
    eventCategory: category,
    timestamp: new Date().toISOString(),
    data
  }

  const events = await getEvents()
  events.push(event)

  // Keep only the last 10000 events to prevent storage overflow
  const trimmedEvents = events.slice(-10000)

  await storage.set(ANALYTICS_KEY, trimmedEvents)
}

export const getEvents = async (): Promise<AnalyticsEvent[]> => {
  const stored = await storage.get<AnalyticsEvent[]>(ANALYTICS_KEY)
  return normalizeEvents(stored)
}

export const exportEvents = async (): Promise<string> => {
  const events = await getEvents()
  return JSON.stringify(events, null, 2)
}

export const exportEventsAsCsv = async (): Promise<string> => {
  const events = await getEvents()

  if (events.length === 0) {
    return ""
  }

  const headers = ["id", "eventType", "eventCategory", "timestamp"]
  const dataKeys = new Set<string>()

  events.forEach((event) => {
    Object.keys(event.data).forEach((key) => dataKeys.add(key))
  })

  const allHeaders = [...headers, ...Array.from(dataKeys)]

  const rows = events.map((event) => {
    const row: string[] = [
      event.id,
      event.eventType,
      event.eventCategory,
      event.timestamp
    ]

    dataKeys.forEach((key) => {
      const value = event.data[key]
      if (value === undefined || value === null) {
        row.push("")
      } else if (typeof value === "string") {
        row.push(`"${value.replace(/"/g, '""')}"`)
      } else {
        row.push(`"${JSON.stringify(value).replace(/"/g, '""')}"`)
      }
    })

    return row.join(",")
  })

  return [allHeaders.join(","), ...rows].join("\n")
}

export const clearEvents = async (): Promise<void> => {
  await storage.set(ANALYTICS_KEY, [])
}

const subscribers: Set<SubscribeCallback> = new Set()

export const subscribeEvents = (callback: SubscribeCallback): (() => void) => {
  subscribers.add(callback)

  // Immediately call with current events
  getEvents().then((events) => callback(events))

  return () => {
    subscribers.delete(callback)
  }
}

// Notify subscribers when events change
const notifySubscribers = async (): Promise<void> => {
  const events = await getEvents()
  subscribers.forEach((callback) => callback(events))
}

// Wrapper to track and notify
export const trackEventWithNotify = async (
  eventType: EventType,
  data: Record<string, unknown> = {}
): Promise<void> => {
  await trackEvent(eventType, data)
  await notifySubscribers()
}
