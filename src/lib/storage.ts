import { Storage } from "@plasmohq/storage"

import { createDefaultConfig, normalizeConfig, serializeConfigForExport } from "./config"
import { MAX_HISTORY_ITEMS } from "./constants"
import type { LastOperation, OperationMode, UserConfig } from "./types"

const storage = new Storage({ area: "local" })
const CONFIG_KEY = "onetap:config:v1"
const LAST_OP_DOMAIN_KEY = "onetap:last_op:domain"
const LAST_OP_TEXT_KEY = "onetap:last_op:text"
const RECENT_OP_DOMAIN_KEY = "onetap:recent_ops:domain"
const RECENT_OP_TEXT_KEY = "onetap:recent_ops:text"
const DOMAIN_HISTORY_KEY = "onetap:history:domains"
const KEYWORD_HISTORY_KEY = "onetap:history:keywords"
const LEGACY_ANALYTICS_KEY = "onetap:analytics:v1"

export const getConfig = async (): Promise<UserConfig> => {
  void clearLegacyAnalyticsData()

  const stored = await storage.get<UserConfig>(CONFIG_KEY)
  if (stored) {
    return normalizeConfig(stored)
  }

  // First time installation - create empty default config
  console.log("[OneTap Storage] No config found, creating default config")
  const defaultConfig = createDefaultConfig()
  await storage.set(CONFIG_KEY, defaultConfig)
  return defaultConfig
}

export const saveConfig = async (config: UserConfig) => {
  await storage.set(CONFIG_KEY, config)
}

export const resetToDefaultConfig = async (): Promise<UserConfig> => {
  console.log("[OneTap Storage] Resetting to default config")
  const defaultConfig = createDefaultConfig()
  await storage.set(CONFIG_KEY, defaultConfig)
  return defaultConfig
}

export const getLastOperation = async (
  mode: OperationMode
): Promise<LastOperation> => {
  const key = mode === "domain" ? LAST_OP_DOMAIN_KEY : LAST_OP_TEXT_KEY
  const stored = await storage.get<LastOperation>(key)

  if (stored) {
    return stored
  }

  return {
    type: null,
    id: null,
    name: null,
    timestamp: new Date().toISOString()
  }
}

export const saveLastOperation = async (
  mode: OperationMode,
  operation: LastOperation
): Promise<void> => {
  const key = mode === "domain" ? LAST_OP_DOMAIN_KEY : LAST_OP_TEXT_KEY
  await storage.set(key, operation)
}

export const getRecentOperations = async (
  mode: OperationMode
): Promise<LastOperation[]> => {
  const key = mode === "domain" ? RECENT_OP_DOMAIN_KEY : RECENT_OP_TEXT_KEY
  const stored = await storage.get<LastOperation[]>(key)

  if (Array.isArray(stored)) {
    return stored.filter(
      (operation): operation is LastOperation =>
      Boolean(operation) &&
      (operation.type === "service" ||
        operation.type === "group" ||
        operation.type === "workflow") &&
      typeof operation.id === "string" &&
      typeof operation.name === "string" &&
      typeof operation.timestamp === "string"
    )
  }

  return []
}

export const saveRecentOperation = async (
  mode: OperationMode,
  operation: LastOperation
): Promise<LastOperation[]> => {
  const key = mode === "domain" ? RECENT_OP_DOMAIN_KEY : RECENT_OP_TEXT_KEY
  const existing = await getRecentOperations(mode)
  const recent = [
    operation,
    ...existing.filter(
      (item) => !(item.type === operation.type && item.id === operation.id)
    )
  ].slice(0, MAX_HISTORY_ITEMS)

  await storage.set(key, recent)
  return recent
}

export const subscribeConfig = (listener: (config: UserConfig) => void) => {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return () => {}
  }

  const handler: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    areaName
  ) => {
    if (areaName !== "local") {
      return
    }

    const change = changes[CONFIG_KEY]
    if (change?.newValue) {
      listener(normalizeConfig(change.newValue as UserConfig))
    }
  }

  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}

export const exportConfig = async (): Promise<string> => {
  const config = await getConfig()
  return JSON.stringify(serializeConfigForExport(config), null, 2)
}

export const importConfig = async (jsonString: string): Promise<UserConfig> => {
  try {
    const parsed = JSON.parse(jsonString)
    const normalized = normalizeConfig(parsed)
    await saveConfig(normalized)
    return normalized
  } catch (error) {
    console.error("[OneTap Storage] Failed to import config:", error)
    throw new Error("Invalid config format")
  }
}

const addToHistory = async (
  key: string,
  value: string
): Promise<string[]> => {
  const existing = await storage.get<string[]>(key)
  let history = existing || []
  
  const filtered = history.filter((item) => item !== value)
  history = [value, ...filtered].slice(0, MAX_HISTORY_ITEMS)
  
  await storage.set(key, history)
  return history
}

export const addDomainToHistory = async (domain: string): Promise<string[]> => {
  if (!domain || domain.trim() === "") {
    return []
  }
  return addToHistory(DOMAIN_HISTORY_KEY, domain.trim().toLowerCase())
}

export const addKeywordToHistory = async (keyword: string): Promise<string[]> => {
  if (!keyword || keyword.trim() === "") {
    return []
  }
  return addToHistory(KEYWORD_HISTORY_KEY, keyword.trim())
}

export const getDomainHistory = async (): Promise<string[]> => {
  const history = await storage.get<string[]>(DOMAIN_HISTORY_KEY)
  return history || []
}

export const getKeywordHistory = async (): Promise<string[]> => {
  const history = await storage.get<string[]>(KEYWORD_HISTORY_KEY)
  return history || []
}

export const exportDomainHistory = async (): Promise<string> => {
  const history = await getDomainHistory()
  return history.join("\n")
}

export const exportKeywordHistory = async (): Promise<string> => {
  const history = await getKeywordHistory()
  return history.join("\n")
}

export const clearLegacyAnalyticsData = async (): Promise<void> => {
  if (typeof chrome !== "undefined" && chrome.storage?.local?.remove) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove(LEGACY_ANALYTICS_KEY, () => resolve())
    })
    return
  }

  await storage.set(LEGACY_ANALYTICS_KEY, [])
}
