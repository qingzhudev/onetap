export const openTab = (url: string, active = true) => {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    chrome.tabs.create({ url, active }, () => resolve())
  })
}

export const openTabsInOrder = async (urls: string[]) => {
  for (const url of urls) {
    await openTab(url, false)
  }
}
