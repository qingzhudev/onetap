export const getRootDomain = (rawUrl?: string | null): string | null => {
  if (!rawUrl) {
    return null
  }

  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    let hostname = parsed.hostname
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4)
    }

    return hostname || null
  } catch {
    return null
  }
}

export const queryActiveTabUrl = async (): Promise<string | null> => {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return null
  }

  const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (result) => {
      resolve(result)
    })
  })

  const url = tabs[0]?.url ?? null
  return url
}
