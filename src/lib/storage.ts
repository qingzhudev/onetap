import { Storage } from "@plasmohq/storage"

import { createInitialConfig, normalizeConfig } from "./config"
import type { UserConfig } from "./types"

const storage = new Storage({ area: "local" })
const CONFIG_KEY = "onetap:config:v1"

export const getConfig = async (): Promise<UserConfig> => {
  const stored = await storage.get<UserConfig>(CONFIG_KEY)
  if (stored) {
    return normalizeConfig(stored)
  }

  const initial = createInitialConfig()
  await storage.set(CONFIG_KEY, initial)
  return initial
}

export const saveConfig = async (config: UserConfig) => {
  await storage.set(CONFIG_KEY, config)
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
