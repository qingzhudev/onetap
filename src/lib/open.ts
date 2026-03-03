export const openTab = async (url: string, active = true) => {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    chrome.tabs.create({ url, active }, () => {
      resolve()
    })
  })
}

export const openTabsInOrder = async (
  urls: string[],
  activeIndex: number | null = null
) => {
  for (const [index, url] of urls.entries()) {
    const isActive = activeIndex !== null && index === activeIndex
    await openTab(url, isActive)
  }
}

export const openTabsInSameWindow = async (urls: string[]) => {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    if (urls.length === 0) {
      resolve()
      return
    }

    // Open all tabs in background
    for (let i = 0; i < urls.length; i++) {
      chrome.tabs.create({ url: urls[i], active: false })
    }
    resolve()
  })
}
