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

export const queryActiveTab = async (): Promise<chrome.tabs.Tab | null> => {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return null
  }

  const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (result) => {
      resolve(result)
    })
  })

  return tabs[0] ?? null
}

export const queryActiveTabUrl = async (): Promise<string | null> => {
  const tab = await queryActiveTab()
  if (!tab) {
    return null
  }
  return tab.url || tab.pendingUrl || null
}

/**
 * Check if a text string looks like a domain name or URL
 * Supports formats like:
 * - example.com
 * - www.example.com
 * - https://example.com
 * - http://example.com/path
 */
export const isDomainLike = (text: string): boolean => {
  if (!text || typeof text !== "string") {
    return false
  }

  const trimmed = text.trim()

  // Try parsing as URL first
  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    // Not a valid URL, check if it's a domain-like string
  }

  // Check for domain pattern: example.com, www.example.com, sub.example.com
  // Pattern: alphanumeric (includes hyphen) parts separated by dots, with at least one dot
  // and ending with a valid TLD (2-6 letters)
  const domainPattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/

  return domainPattern.test(trimmed)
}

/**
 * Extract domain from a URL or domain-like text
 * Returns the root domain (without www.) or null if not a valid domain
 */
export const extractDomainFromText = (text: string): string | null => {
  if (!text || typeof text !== "string") {
    return null
  }

  const trimmed = text.trim()

  // Try parsing as URL first
  try {
    const url = new URL(trimmed)
    if (url.protocol === "http:" || url.protocol === "https:") {
      let hostname = url.hostname
      if (hostname.startsWith("www.")) {
        hostname = hostname.slice(4)
      }
      return hostname
    }
  } catch {
    // Not a valid URL, continue
  }

  // Check if it's a domain-like string and extract it
  if (isDomainLike(trimmed)) {
    let domain = trimmed
    if (domain.startsWith("www.")) {
      domain = domain.slice(4)
    }
    return domain
  }

  return null
}
