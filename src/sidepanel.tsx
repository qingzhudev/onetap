import { useEffect, useMemo, useRef, useState } from "react"
import {
  FileText,
  Globe,
  RotateCcw,
  Settings,
  TrendingUp
} from "lucide-react"

import {
  buildServiceUrl,
  getOrderedWorkflows,
  getOrderedGroups,
  getUngroupedServices
} from "~lib/config"
import { DEFAULT_GROUP_ID } from "~lib/constants"
import {
  extractDomainFromText,
  getRootDomain,
  queryActiveTab,
  queryActiveTabUrl
} from "~lib/domain"
import { t } from "~lib/i18n"
import { openTab, openTabsInOrder } from "~lib/open"
import {
  addDomainToHistory,
  addKeywordToHistory,
  getConfig,
  getLastOperation,
  getRecentOperations,
  saveLastOperation,
  saveRecentOperation,
  subscribeConfig
} from "~lib/storage"
import { getUsageStats, incrementUsageStats } from "~lib/stats"
import { useToast } from "~lib/toast"
import type { UsageStats } from "~lib/stats"
import type {
  AnalysisService,
  LastOperation,
  OperationMode,
  ServiceGroup,
  Workflow,
  UserConfig
} from "~lib/types"
import "~styles/popup.css"

const EMPTY_LAST_OPERATION: LastOperation = {
  type: null,
  id: null,
  name: null,
  timestamp: ""
}

const EMPTY_USAGE_STATS: UsageStats = {
  services: {},
  groups: {}
}

type ShortcutItem = {
  key: string
  dedupeKey: string
  name: string
  countLabel?: string
  disabled?: boolean
  onMouseDown: (event: React.MouseEvent) => void
}

const SidePanel = () => {
  const [config, setConfig] = useState<UserConfig | null>(null)
  const [domain, setDomain] = useState<string | null>(null)
  const [mode, setMode] = useState<OperationMode>("domain")
  const [textInput, setTextInput] = useState("")
  const [isSelecting, setIsSelecting] = useState(false)
  const [usageStats, setUsageStats] = useState<UsageStats>(EMPTY_USAGE_STATS)
  const [lastOperations, setLastOperations] = useState<Record<OperationMode, LastOperation>>({
    domain: EMPTY_LAST_OPERATION,
    text: EMPTY_LAST_OPERATION
  })
  const [recentOperations, setRecentOperations] = useState<
    Record<OperationMode, LastOperation[]>
  >({
    domain: [],
    text: []
  })
  const { toasts, notify } = useToast()

  const lastSelectionRef = useRef<string | null>(null)
  const textValue = textInput.trim()

  const fetchSelectedText = async (): Promise<string | null> => {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) {
      return null
    }

    const tab = await queryActiveTab()
    if (!tab?.id) {
      return null
    }

    return new Promise((resolve) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => window.getSelection?.().toString() || ""
        },
        (results) => {
          if (chrome.runtime.lastError) {
            resolve(null)
            return
          }

          const value = results?.[0]?.result
          resolve(typeof value === "string" ? value : null)
        }
      )
    })
  }

  const detectSelectionAndSetMode = async () => {
    const selection = await fetchSelectedText()
    const trimmedSelection = selection?.trim() || null

    if (!trimmedSelection) {
      setMode("domain")
      setTextInput("")
      lastSelectionRef.current = null
      return
    }

    lastSelectionRef.current = trimmedSelection

    const extractedDomain = extractDomainFromText(trimmedSelection)
    if (extractedDomain) {
      setDomain(extractedDomain)
      setMode("domain")
      setTextInput(extractedDomain)
      return
    }

    setMode("text")
    setTextInput(trimmedSelection)
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let isMounted = true

    const load = async () => {
      const [
        configData,
        tabUrl,
        nextUsageStats,
        domainLastOperation,
        textLastOperation,
        domainRecentOperations,
        textRecentOperations
      ] = await Promise.all([
        getConfig(),
        queryActiveTabUrl(),
        getUsageStats(),
        getLastOperation("domain"),
        getLastOperation("text"),
        getRecentOperations("domain"),
        getRecentOperations("text")
      ])

      if (!isMounted) {
        return
      }

      setConfig(configData)
      setUsageStats(nextUsageStats)
      setLastOperations({
        domain: domainLastOperation,
        text: textLastOperation
      })
      setRecentOperations({
        domain: domainRecentOperations,
        text: textRecentOperations
      })
      setDomain(getRootDomain(tabUrl))

      await detectSelectionAndSetMode()
    }

    void load()

    const unsubscribe = subscribeConfig((next) => {
      setConfig(next)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
      return
    }

    const handler: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (
      message
    ) => {
      if (message?.type === "TAB_UPDATED" || message?.type === "TAB_ACTIVATED") {
        void handleTabChange()
      }
    }

    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  useEffect(() => {
    if (typeof chrome === "undefined") {
      return
    }

    const checkSelection = async () => {
      const currentSelection = await fetchSelectedText()
      const trimmedSelection = currentSelection?.trim() || null

      if (trimmedSelection !== lastSelectionRef.current) {
        await detectSelectionAndSetMode()
      }
    }

    const intervalId = setInterval(checkSelection, 500)

    return () => {
      clearInterval(intervalId)
    }
  }, [mode])

  const orderedGroups = useMemo(() => {
    if (!config) {
      return []
    }

    return getOrderedGroups(config)
  }, [config])

  const orderedWorkflows = useMemo(() => {
    if (!config) {
      return []
    }

    return getOrderedWorkflows(config)
  }, [config])

  const orderedGroupIds = useMemo(() => {
    if (!config) {
      return []
    }

    const order = config.groupOrder.length ? config.groupOrder : [DEFAULT_GROUP_ID]
    return order.includes(DEFAULT_GROUP_ID) ? order : [...order, DEFAULT_GROUP_ID]
  }, [config])

  const visibleServices = useMemo(() => {
    if (!config) {
      return []
    }

    return config.services.filter((service) => {
      if (mode === "domain") {
        return service.supportedVariables.domain
      }

      return service.supportedVariables.text
    })
  }, [config, mode])

  const ungroupedServices = useMemo(() => {
    if (!config) {
      return []
    }

    return getUngroupedServices(visibleServices, config.groups)
  }, [config, visibleServices])

  const groupedServices = useMemo(() => {
    if (!config) {
      return new Map<string, AnalysisService[]>()
    }

    const map = new Map<string, AnalysisService[]>()

    orderedGroups.forEach((group) => {
      const services = group.serviceIds
        .map((id) => visibleServices.find((service) => service.id === id))
        .filter((service): service is AnalysisService => Boolean(service))

      if (services.length > 0) {
        map.set(group.id, services)
      }
    })

    return map
  }, [config, orderedGroups, visibleServices])

  const visibleWorkflows = useMemo(() => {
    return orderedWorkflows.filter((workflow) => {
      if (workflow.mode !== "both" && workflow.mode !== mode) {
        return false
      }

      return workflow.serviceIds.some((serviceId) =>
        config?.services.some((service) => service.id === serviceId)
      )
    })
  }, [config?.services, mode, orderedWorkflows])

  const setError = (message: string) => {
    notify(message)
  }

  const handleTabChange = async () => {
    const tabUrl = await queryActiveTabUrl()
    setDomain(getRootDomain(tabUrl))
    await detectSelectionAndSetMode()
  }

  const persistOperation = (operation: LastOperation) => {
    void saveLastOperation(mode, operation)
    void saveRecentOperation(mode, operation)
  }

  const getGroupById = (groupId: string): ServiceGroup | null => {
    if (groupId === DEFAULT_GROUP_ID) {
      return {
        id: DEFAULT_GROUP_ID,
        name: t("optionDefaultGroup"),
        icon: "📋",
        order: -1,
        serviceIds: ungroupedServices.map((service) => service.id)
      }
    }

    return config?.groups.find((item) => item.id === groupId) ?? null
  }

  const getWorkflowById = (workflowId: string): Workflow | null =>
    config?.workflows.find((item) => item.id === workflowId) ?? null

  const getRunnableServiceCount = (group: ServiceGroup) =>
    group.serviceIds.filter((serviceId) => {
      const service = config?.services.find((item) => item.id === serviceId)
      return Boolean(
        service &&
          buildServiceUrl(service.urlTemplate, {
            domain,
            text: textValue
          })
      )
    }).length

  const getRunnableWorkflowServices = (workflow: Workflow) =>
    workflow.serviceIds
      .map((serviceId) => config?.services.find((item) => item.id === serviceId))
      .filter((service): service is AnalysisService => Boolean(service))
      .filter((service) =>
        Boolean(
          buildServiceUrl(service.urlTemplate, {
            domain,
            text: textValue
          })
        )
      )

  const handleOpenService = async (service: AnalysisService, active = true) => {
    if (mode === "domain" && !domain) {
      return
    }

    if (mode === "text" && !textValue) {
      setError(t("popupNoSelection"))
      return
    }

    const url = buildServiceUrl(service.urlTemplate, {
      domain,
      text: textValue
    })

    if (!url) {
      setError(t("popupServiceUrlError"))
      return
    }

    const operation: LastOperation = {
      type: "service",
      id: service.id,
      name: service.name,
      timestamp: new Date().toISOString()
    }

    persistOperation(operation)
    void incrementUsageStats({ serviceIds: [service.id] })

    if (mode === "domain" && domain) {
      void addDomainToHistory(domain)
    } else if (mode === "text" && textValue) {
      void addKeywordToHistory(textValue)
    }

    const currentTab = await queryActiveTab()
    const windowId = currentTab?.windowId ?? null

    await openTab(url, active)

    if (active && windowId) {
      chrome.runtime
        .sendMessage({
          type: "CLOSE_SIDEPANEL",
          windowId
        })
        .catch(() => {
          // Ignore errors if sidepanel already closed
        })
    }
  }

  const handleServiceClick =
    (service: AnalysisService) => (event: React.MouseEvent) => {
      const active = event.button === 0

      void handleOpenService(service, active)
    }

  const handleOpenGroup = async (group: ServiceGroup, active = true) => {
    if (mode === "domain" && !domain) {
      return
    }

    if (mode === "text" && !textValue) {
      setError(t("popupNoSelection"))
      return
    }

    if (!group.serviceIds.length) {
      setError(t("popupGroupEmpty"))
      return
    }

    const services = group.serviceIds
      .map((id) => config?.services.find((service) => service.id === id))
      .filter((service): service is AnalysisService => Boolean(service))

    const urls = services
      .map((service) =>
        buildServiceUrl(service.urlTemplate, {
          domain,
          text: textValue
        })
      )
      .filter((url): url is string => Boolean(url))

    if (urls.length !== services.length) {
      setError(t("popupServiceUrlError"))
    }

    if (!urls.length) {
      return
    }

    const operation: LastOperation = {
      type: "group",
      id: group.id,
      name: group.name,
      timestamp: new Date().toISOString()
    }

    persistOperation(operation)
    void incrementUsageStats({
      groupId: group.id,
      serviceIds: services.map((service) => service.id)
    })

    if (mode === "domain" && domain) {
      void addDomainToHistory(domain)
    } else if (mode === "text" && textValue) {
      void addKeywordToHistory(textValue)
    }

    const activeIndex = active ? 0 : null
    const currentTab = await queryActiveTab()
    const windowId = currentTab?.windowId ?? null

    await openTabsInOrder(urls, activeIndex)

    if (active && windowId) {
      chrome.runtime
        .sendMessage({
          type: "CLOSE_SIDEPANEL",
          windowId
        })
        .catch(() => {
          // Ignore errors if sidepanel already closed
        })
    }
  }

  const handleGroupClick =
    (group: ServiceGroup) => (event: React.MouseEvent) => {
      const active = event.button === 0

      void handleOpenGroup(group, active)
    }

  const handleOpenWorkflow = async (workflow: Workflow, active = true) => {
    if (mode === "domain" && !domain) {
      return
    }

    if (mode === "text" && !textValue) {
      setError(t("popupNoSelection"))
      return
    }

    const services = getRunnableWorkflowServices(workflow)
    if (!services.length) {
      setError(t("popupWorkflowEmpty"))
      return
    }

    const urls = services
      .map((service) =>
        buildServiceUrl(service.urlTemplate, {
          domain,
          text: textValue
        })
      )
      .filter((url): url is string => Boolean(url))

    if (!urls.length) {
      setError(t("popupServiceUrlError"))
      return
    }

    const operation: LastOperation = {
      type: "workflow",
      id: workflow.id,
      name: workflow.name,
      timestamp: new Date().toISOString()
    }

    persistOperation(operation)
    void incrementUsageStats({
      serviceIds: services.map((service) => service.id)
    })

    if (mode === "domain" && domain) {
      void addDomainToHistory(domain)
    } else if (mode === "text" && textValue) {
      void addKeywordToHistory(textValue)
    }

    const activeIndex =
      active && workflow.openStrategy === "foreground-first" ? 0 : null
    const currentTab = await queryActiveTab()
    const windowId = currentTab?.windowId ?? null

    await openTabsInOrder(urls, activeIndex)

    if (active && windowId) {
      chrome.runtime
        .sendMessage({
          type: "CLOSE_SIDEPANEL",
          windowId
        })
        .catch(() => {
          // Ignore errors if sidepanel already closed
        })
    }
  }

  const handleWorkflowClick =
    (workflow: Workflow) => (event: React.MouseEvent) => {
      const active = event.button === 0

      void handleOpenWorkflow(workflow, active)
    }

  const handleOpenOptions = async () => {
    const currentTab = await queryActiveTab()
    const windowId = currentTab?.windowId ?? null

    if (chrome?.runtime?.openOptionsPage) {
      await chrome.runtime.openOptionsPage()
    }

    if (windowId) {
      chrome.runtime
        .sendMessage({
          type: "CLOSE_SIDEPANEL",
          windowId
        })
        .catch(() => {
          // Ignore sidepanel close failures
        })
    }
  }

  const handleUseSelection = async () => {
    setIsSelecting(true)
    await detectSelectionAndSetMode()
    setIsSelecting(false)
  }

  const replayShortcut = useMemo<ShortcutItem | null>(() => {
    const operation = lastOperations[mode]

    if (!operation.id || !operation.type) {
      return null
    }

    if (operation.type === "service") {
      const service = visibleServices.find((item) => item.id === operation.id)
      if (!service) {
        return null
      }

      return {
        key: `replay-service-${service.id}`,
        dedupeKey: `service:${service.id}`,
        name: service.name,
        onMouseDown: handleServiceClick(service)
      }
    }

    if (operation.type === "workflow") {
      const workflow = getWorkflowById(operation.id)
      const runnableCount = workflow ? getRunnableWorkflowServices(workflow).length : 0

      if (!workflow || runnableCount === 0) {
        return null
      }

      return {
        key: `replay-workflow-${workflow.id}`,
        dedupeKey: `workflow:${workflow.id}`,
        name: workflow.name,
        countLabel: `${runnableCount}`,
        onMouseDown: handleWorkflowClick(workflow)
      }
    }

    const group = getGroupById(operation.id)
    const runnableCount = group ? getRunnableServiceCount(group) : 0

    if (!group || runnableCount === 0) {
      return null
    }

    return {
      key: `replay-group-${group.id}`,
      dedupeKey: `group:${group.id}`,
      name: group.name,
      countLabel: `${runnableCount}`,
      onMouseDown: handleGroupClick(group)
    }
  }, [getRunnableServiceCount, handleGroupClick, handleServiceClick, lastOperations, mode, visibleServices])

  const recentShortcuts = useMemo<ShortcutItem[]>(() => {
    const lastOperation = lastOperations[mode]

    return recentOperations[mode]
      .filter((operation) => {
        if (!lastOperation.id || !lastOperation.type) {
          return true
        }

        return !(
          operation.type === lastOperation.type && operation.id === lastOperation.id
        )
      })
      .map<ShortcutItem | null>((operation) => {
        if (!operation.id || !operation.type) {
          return null
        }

        if (operation.type === "service") {
          const service = visibleServices.find((item) => item.id === operation.id)
          if (!service) {
            return null
          }

          return {
            key: `recent-service-${service.id}`,
            dedupeKey: `service:${service.id}`,
            name: service.name,
            countLabel: usageStats.services[service.id]
              ? `${usageStats.services[service.id]}x`
              : undefined,
            onMouseDown: handleServiceClick(service)
          }
        }

        if (operation.type === "workflow") {
          const workflow = getWorkflowById(operation.id)
          const runnableCount = workflow ? getRunnableWorkflowServices(workflow).length : 0

          if (!workflow || runnableCount === 0) {
            return null
          }

          return {
            key: `recent-workflow-${workflow.id}`,
            dedupeKey: `workflow:${workflow.id}`,
            name: workflow.name,
            countLabel: `${runnableCount}`,
            onMouseDown: handleWorkflowClick(workflow)
          }
        }

        const group = getGroupById(operation.id)
        const runnableCount = group ? getRunnableServiceCount(group) : 0

        if (!group || runnableCount === 0) {
          return null
        }

        return {
          key: `recent-group-${group.id}`,
          dedupeKey: `group:${group.id}`,
          name: group.name,
          countLabel: `${runnableCount}`,
          onMouseDown: handleGroupClick(group)
        }
      })
      .filter((item): item is ShortcutItem => item !== null)
      .slice(0, 4)
  }, [
    getRunnableServiceCount,
    getRunnableWorkflowServices,
    handleGroupClick,
    handleServiceClick,
    handleWorkflowClick,
    getWorkflowById,
    lastOperations,
    mode,
    recentOperations,
    usageStats.services,
    visibleServices
  ])

  const visiblePinnedWorkflows = useMemo(() => {
    const pinned = visibleWorkflows.filter((workflow) => workflow.pinned)
    return (pinned.length > 0 ? pinned : visibleWorkflows)
      .slice(0, 4)
      .map((workflow) => {
        const runnableCount = getRunnableWorkflowServices(workflow).length

        return {
          key: `workflow-${workflow.id}`,
          dedupeKey: `workflow:${workflow.id}`,
          name: workflow.name,
          countLabel: `${runnableCount}`,
          disabled: runnableCount === 0,
          onMouseDown: handleWorkflowClick(workflow)
        }
      })
  }, [getRunnableWorkflowServices, handleWorkflowClick, visibleWorkflows])

  const topUsedShortcuts = useMemo<ShortcutItem[]>(() => {
    return visibleServices
      .filter((service) => (usageStats.services[service.id] || 0) > 0)
      .sort((left, right) => {
        const diff =
          (usageStats.services[right.id] || 0) - (usageStats.services[left.id] || 0)

        if (diff !== 0) {
          return diff
        }

        return left.name.localeCompare(right.name)
      })
      .slice(0, 4)
      .map((service) => ({
        key: `top-service-${service.id}`,
        dedupeKey: `service:${service.id}`,
        name: service.name,
        countLabel: `${usageStats.services[service.id]}x`,
        onMouseDown: handleServiceClick(service)
      }))
  }, [handleServiceClick, usageStats.services, visibleServices])

  const suggestionShortcuts = useMemo<ShortcutItem[]>(() => {
    const seen = new Set<string>()
    const merged = [...recentShortcuts, ...topUsedShortcuts].filter(
      (item) => !item.dedupeKey.startsWith("workflow:")
    )

    return merged.filter((item) => {
      if (seen.has(item.dedupeKey)) {
        return false
      }

      seen.add(item.dedupeKey)
      return true
    }).slice(0, 3)
  }, [recentShortcuts, topUsedShortcuts])

  const renderServiceItem = (service: AnalysisService) => (
    <li key={service.id}>
      <button
        className="service-list__item"
        disabled={
          !buildServiceUrl(service.urlTemplate, {
            domain,
            text: textValue
          })
        }
        onMouseDown={handleServiceClick(service)}>
        {service.name}
      </button>
    </li>
  )

  const renderShortcutItem = (item: ShortcutItem) => (
    <li key={item.key}>
      <button
        className="shortcut-list__item"
        disabled={item.disabled}
        onMouseDown={item.onMouseDown}>
        <span className="shortcut-list__name">{item.name}</span>
        {item.countLabel ? (
          <span className="shortcut-list__meta">{item.countLabel}</span>
        ) : null}
      </button>
    </li>
  )

  return (
    <div className="popup">
      <header className="popup__header">
        <div className="popup__domain-line">
          <div className="popup__domain">{domain ?? t("popupDomainUnavailable")}</div>
          <div className="popup__mode-tabs">
            <button
              className={`popup__mode-tab ${mode === "domain" ? "is-active" : ""}`}
              title={t("popupModeDomainTooltip")}
              onClick={() => {
                setMode("domain")
              }}>
              <Globe size={17} />
              <span>{t("popupModeDomain")}</span>
            </button>
            <button
              className={`popup__mode-tab ${mode === "text" ? "is-active" : ""}`}
              title={t("popupModeTextTooltip")}
              onClick={() => {
                setMode("text")
              }}>
              <FileText size={17} />
              <span>{t("popupModeText")}</span>
            </button>
          </div>
        </div>
      </header>

      <main className={`popup__body ${mode === "domain" && !domain ? "is-disabled" : ""}`}>
        {mode === "text" ? (
          <section className="popup__text">
            <input
              className="popup__text-input"
              type="text"
              value={textInput}
              placeholder={t("popupTextPlaceholder")}
              onChange={(event) => setTextInput(event.target.value)}
            />
            <div className="popup__text-actions">
              <button
                className="popup__text-button"
                onClick={handleUseSelection}
                disabled={isSelecting}>
                {t("popupUseSelection")}
              </button>
              <button
                className="popup__text-button is-ghost"
                onClick={() => setTextInput("")}
                disabled={!textValue}>
                {t("popupClearText")}
              </button>
            </div>
          </section>
        ) : null}

        {replayShortcut ? (
          <section className="quick-card">
            <div className="quick-card__header">
              <div className="quick-card__title">
                <RotateCcw size={14} />
                <span>{t("popupReplay")}</span>
              </div>
            </div>
            <button
              className="quick-card__action"
              onMouseDown={replayShortcut.onMouseDown}>
              <span className="quick-card__name">{replayShortcut.name}</span>
              {replayShortcut.countLabel ? (
                <span className="quick-card__meta">{replayShortcut.countLabel}</span>
              ) : null}
            </button>
          </section>
        ) : null}

        {suggestionShortcuts.length > 0 ? (
          <section className="group group--shortcut">
            <div className="shortcut-section__header">
              <div className="shortcut-section__title">
                <TrendingUp size={14} />
                <span>{t("popupSuggestions")}</span>
              </div>
            </div>
            <ul className="shortcut-list">{suggestionShortcuts.map(renderShortcutItem)}</ul>
          </section>
        ) : null}

        {visiblePinnedWorkflows.length > 0 ? (
          <section className="group group--shortcut">
            <div className="shortcut-section__header">
              <div className="shortcut-section__title">
                <span>{t("popupWorkflows")}</span>
              </div>
            </div>
            <ul className="shortcut-list">{visiblePinnedWorkflows.map(renderShortcutItem)}</ul>
          </section>
        ) : null}

        {(ungroupedServices.length > 0 || groupedServices.size > 0) ? (
          <section className="popup-section">
            <div className="popup-section__title">{t("popupBrowseServices")}</div>
          </section>
        ) : null}

        {orderedGroupIds.map((groupId) => {
          const isUngrouped = groupId === DEFAULT_GROUP_ID
          const group = getGroupById(groupId)
          const services = isUngrouped
            ? ungroupedServices
            : group
              ? groupedServices.get(group.id)
              : null

          if (!group || !services?.length) {
            return null
          }

          return (
            <section className="group" key={group.id}>
              <div className="group__header">
                <button
                  className="group__icon"
                  disabled={
                    !services.some((service) =>
                      buildServiceUrl(service.urlTemplate, {
                        domain,
                        text: textValue
                      })
                    )
                  }
                  onMouseDown={handleGroupClick(group)}>
                  <span>{group.icon}</span>
                </button>
                <div className="group__title">
                  <span>{group.name}</span>
                  <span className="group__count">({services.length})</span>
                </div>
              </div>
              <ul className="service-list">{services.map(renderServiceItem)}</ul>
            </section>
          )
        })}
      </main>

      <footer className="popup__footer">
        <button className="popup__manage" onClick={handleOpenOptions}>
          <Settings size={16} />
          {t("popupManageGroups")}
        </button>
      </footer>

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SidePanel
