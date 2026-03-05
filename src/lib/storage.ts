import { Storage } from "@plasmohq/storage"

import { createDefaultConfig, normalizeConfig } from "./config"
import { MAX_HISTORY_ITEMS } from "./constants"
import type { LastOperation, OperationMode, UserConfig } from "./types"

const storage = new Storage({ area: "local" })
const CONFIG_KEY = "onetap:config:v1"
const LAST_OP_DOMAIN_KEY = "onetap:last_op:domain"
const LAST_OP_TEXT_KEY = "onetap:last_op:text"
const DOMAIN_HISTORY_KEY = "onetap:history:domains"
const KEYWORD_HISTORY_KEY = "onetap:history:keywords"

export const getConfig = async (): Promise<UserConfig> => {
  const stored = await storage.get<UserConfig>(CONFIG_KEY)
  if (stored) {
    return normalizeConfig(stored)
  }

  // First time installation - create default config with sample services
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

  return (
    stored || {
      type: null,
      id: null,
      name: null,
      timestamp: new Date().toISOString()
    }
  )
}

export const saveLastOperation = async (
  mode: OperationMode,
  operation: LastOperation
): Promise<void> => {
  const key = mode === "domain" ? LAST_OP_DOMAIN_KEY : LAST_OP_TEXT_KEY
  await storage.set(key, operation)
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
  return JSON.stringify(config, null, 2)
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
