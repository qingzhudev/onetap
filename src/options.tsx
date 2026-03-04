import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDroppable,
  useSensor,
  useSensors,
  type ClientRect
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import clsx from "clsx"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import {
  clampGroupName,
  createDefaultConfig,
  createInitialConfig,
  getOrderedGroups,
  getUngroupedServices,
  inferSupportedVariables
} from "~lib/config"
import {
  ICONS,
  MAX_GROUPS,
  MAX_GROUP_NAME,
  MAX_SERVICES,
  MAX_SERVICES_PER_GROUP,
  UNGROUPED_ID
} from "~lib/constants"
import { createId } from "~lib/id"
import { t } from "~lib/i18n"
import { getConfig, saveConfig, exportConfig, importConfig, exportDomainHistory, exportKeywordHistory } from "~lib/storage"
import { useToast } from "~lib/toast"
import type { AnalysisService, ServiceGroup, UserConfig } from "~lib/types"
import "~styles/options.css"

const GROUP_PREFIX = "group:"
const SERVICE_PREFIX = "service:"
const CONTAINER_PREFIX = "container:"
const NEW_GROUP_ID = "new-group"

const asGroupDragId = (id: string) => `${GROUP_PREFIX}${id}`
const asServiceDragId = (id: string) => `${SERVICE_PREFIX}${id}`
const asContainerId = (id: string) => `${CONTAINER_PREFIX}${id}`

const stripPrefix = (value: string, prefix: string) =>
  value.startsWith(prefix) ? value.slice(prefix.length) : value

const isGroupId = (value: string) => value.startsWith(GROUP_PREFIX)
const isServiceId = (value: string) => value.startsWith(SERVICE_PREFIX)
const isContainerId = (value: string) => value.startsWith(CONTAINER_PREFIX)

const findGroupById = (config: UserConfig, id: string) =>
  config.groups.find((group) => group.id === id)

const findServiceById = (config: UserConfig, id: string) =>
  config.services.find((service) => service.id === id)

const findServiceGroupId = (config: UserConfig, serviceId: string) => {
  const group = config.groups.find((item) => item.serviceIds.includes(serviceId))
  return group?.id ?? null
}

const SortableGroup = ({
  group,
  services,
  onRename,
  onDelete,
  onRemoveService,
  onDeleteService,
  onEditService,
  disabled,
  insertPosition
}: {
  group: ServiceGroup
  services: AnalysisService[]
  onRename: (groupId: string) => void
  onDelete: (groupId: string) => void
  onRemoveService: (serviceId: string) => void
  onDeleteService: (serviceId: string) => void
  onEditService: (serviceId: string) => void
  disabled: boolean
  insertPosition: InsertPosition | null
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: asGroupDragId(group.id), disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={clsx("group-card", isDragging && "is-dragging")}>
      <header className="group-card__header">
        <button className="drag-handle" {...attributes} {...listeners}>
          ⠿
        </button>
        <div className="group-card__title">
          <span className="group-card__icon">{group.icon}</span>
          <span>{group.name}</span>
          <span className="group-card__count">({services.length})</span>
        </div>
        <div className="group-card__actions">
          <button
            className="ghost-button"
            onClick={() => onRename(group.id)}>
            {t("groupRename")}
          </button>
          <button
            className="ghost-button danger"
            onClick={() => onDelete(group.id)}>
            {t("groupDelete")}
          </button>
        </div>
      </header>

      <SortableContext
        items={services.map((service) => asServiceDragId(service.id))}
        strategy={verticalListSortingStrategy}>
        <ul className="service-list">
          {services.length === 0 ? (
            <li className="service-list__empty">{t("groupEmpty")}</li>
          ) : (
            services.map((service) => (
              <SortableService
                key={service.id}
                service={service}
                onRemove={onRemoveService}
                onDelete={onDeleteService}
                onEdit={onEditService}
                showRemove
                insertBefore={
                  insertPosition?.groupId === group.id &&
                  insertPosition?.beforeServiceId === service.id
                }
                insertAfter={
                  insertPosition?.groupId === group.id &&
                  insertPosition?.afterServiceId === service.id
                }
              />
            ))
          )}
        </ul>
      </SortableContext>
    </section>
  )
}

const SortableUngrouped = ({
  services,
  onRemoveService,
  onDeleteService,
  onEditService,
  disabled,
  insertPosition
}: {
  services: AnalysisService[]
  onRemoveService: (serviceId: string) => void
  onDeleteService: (serviceId: string) => void
  onEditService: (serviceId: string) => void
  disabled: boolean
  insertPosition: InsertPosition | null
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: asGroupDragId(UNGROUPED_ID), disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={clsx("group-card ungrouped", isDragging && "is-dragging")}>
      <header className="group-card__header">
        <button className="drag-handle" {...attributes} {...listeners}>
          ⠿
        </button>
        <div className="group-card__title">
          <span className="group-card__icon">📦</span>
          <span>{t("defaultGroupName")}</span>
          <span className="group-card__count">({services.length})</span>
        </div>
        <div className="group-card__actions" />
      </header>

      <SortableContext
        items={services.map((service) => asServiceDragId(service.id))}
        strategy={verticalListSortingStrategy}>
        <ul className="service-list">
          {services.length === 0 ? (
            <li className="service-list__empty">{t("defaultGroupEmpty")}</li>
          ) : (
            services.map((service) => (
              <SortableService
                key={service.id}
                service={service}
                onRemove={onRemoveService}
                onDelete={onDeleteService}
                onEdit={onEditService}
                showRemove={false}
                insertBefore={
                  insertPosition?.groupId === null &&
                  insertPosition?.beforeServiceId === service.id
                }
                insertAfter={
                  insertPosition?.groupId === null &&
                  insertPosition?.afterServiceId === service.id
                }
              />
            ))
          )}
        </ul>
      </SortableContext>
    </section>
  )
}

type ModalState =
  | {
      type: "confirm"
      title: string
      message: string
      onConfirm: () => void
    }
  | {
      type: "rename"
      title: string
      initialValue: string
      onConfirm: (value: string) => boolean
    }
  | {
      type: "create-group"
      title: string
      initialName: string
      initialIcon: string
      onConfirm: (name: string, icon: string) => boolean
    }
  | {
      type: "edit-service"
      title: string
      serviceId: string
      initialName: string
      initialUrl: string
      initialGroupId: string
      onConfirm: (name: string, url: string, groupId: string) => boolean
    }
  | {
      type: "create-service"
      title: string
      initialName: string
      initialUrl: string
      initialGroupId: string
      onConfirm: (name: string, url: string, groupId: string) => boolean
    }

const SortableService = ({
  service,
  onRemove,
  onDelete,
  onEdit,
  showRemove,
  insertBefore,
  insertAfter
}: {
  service: AnalysisService
  onRemove: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  showRemove: boolean
  insertBefore?: boolean
  insertAfter?: boolean
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: asServiceDragId(service.id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx("service-item", isDragging && "is-dragging")}
      {...attributes}>
      {insertBefore && (
        <div className="insert-indicator insert-indicator--before" />
      )}
      <button className="drag-handle" {...listeners}>
        ⠿
      </button>
      <div className="service-item__info">
        <span className="service-item__name">{service.name}</span>
        <span className="service-item__template" title={service.urlTemplate}>
          {service.urlTemplate}
        </span>
      </div>
      <div className="service-item__actions">
        <button className="ghost-button" onClick={() => onEdit(service.id)}>
          {t("serviceEdit")}
        </button>
        {showRemove ? (
          <button className="ghost-button" onClick={() => onRemove(service.id)}>
            {t("serviceRemove")}
          </button>
        ) : null}
        <button className="ghost-button danger" onClick={() => onDelete(service.id)}>
          {t("serviceDelete")}
        </button>
      </div>
      {insertAfter && (
        <div className="insert-indicator insert-indicator--after" />
      )}
    </li>
  )
}

type InsertPosition = {
  groupId: string | null
  beforeServiceId: string | null
  afterServiceId: string | null
}

const OptionsPage = () => {
  const [config, setConfig] = useState<UserConfig>(() => createInitialConfig())
  const [isReady, setIsReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [insertPosition, setInsertPosition] = useState<InsertPosition | null>(null)
  const [groupIcon, setGroupIcon] = useState(ICONS[0])
  const [modal, setModal] = useState<ModalState | null>(null)
  const [pendingModal, setPendingModal] = useState<ModalState | null>(null)
  const [showConfigMenu, setShowConfigMenu] = useState(false)
  const { toasts, notify } = useToast()

  useEffect(() => {
    let isMounted = true

    getConfig().then((stored) => {
      if (!isMounted) {
        return
      }
      setConfig(stored)
      setIsReady(true)
    })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isReady) {
      return
    }

    const timer = window.setTimeout(() => {
      saveConfig(config)
    }, 200)

    return () => window.clearTimeout(timer)
  }, [config, isReady])

  useEffect(() => {
    if (!modal && pendingModal) {
      setModal(pendingModal)
      setPendingModal(null)
    }
  }, [modal, pendingModal])

  const ensureHasDefault = (order: string[]) =>
    order.includes(UNGROUPED_ID) ? order : [UNGROUPED_ID, ...order]

  const appendGroupId = (order: string[], groupId: string) =>
    ensureHasDefault([...order.filter((id) => id !== groupId), groupId])

  const orderedGroups = useMemo(() => getOrderedGroups(config), [config])
  const orderedGroupIds = useMemo(() => {
    const order = config.groupOrder.length
      ? config.groupOrder
      : [UNGROUPED_ID]
    return ensureHasDefault(
      order.includes(UNGROUPED_ID) ? order : [...order, UNGROUPED_ID]
    )
  }, [config.groupOrder])

  const stats = useMemo(
    () => ({
      services: config.services.length,
      groups: config.groups.length
    }),
    [config.services.length, config.groups.length]
  )

  const ungroupedServices = useMemo(
    () => getUngroupedServices(config.services, config.groups),
    [config]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const openCreateGroupModal = (
    afterCreate?: (newGroupId: string) => void
  ) => {
    if (config.groups.length >= MAX_GROUPS) {
      notify(t("maxGroupsReached"))
      return false
    }

    setModal({
      type: "create-group",
      title: t("modalTitleAddGroup"),
      initialName: "",
      initialIcon: groupIcon,
      onConfirm: (name, icon) => {
        const trimmed = clampGroupName(name)
        if (!trimmed) {
          notify(t("groupNameRequired"))
          return false
        }

        if (config.groups.length >= MAX_GROUPS) {
          notify(t("maxGroupsReached"))
          return false
        }

        const newGroupId = createId()
        const newGroup: ServiceGroup = {
          id: newGroupId,
          name: trimmed,
          icon,
          order: config.groups.length,
          serviceIds: []
        }

        setConfig((prev) => ({
          ...prev,
          groups: [...prev.groups, newGroup],
          groupOrder: appendGroupId(prev.groupOrder, newGroup.id)
        }))

        setGroupIcon(icon)
        if (afterCreate) {
          afterCreate(newGroupId)
        }
        return true
      }
    })

    return true
  }

  const buildCreateServiceModal = (draft?: {
    name?: string
    url?: string
    groupId?: string
  }): ModalState => ({
    type: "create-service",
    title: t("modalTitleAddService"),
    initialName: draft?.name ?? "",
    initialUrl: draft?.url ?? "",
    initialGroupId: draft?.groupId ?? UNGROUPED_ID,
    onConfirm: (name, url, groupId) => addService(name, url, groupId)
  })

  const buildEditServiceModal = (draft: {
    serviceId: string
    name: string
    url: string
    groupId: string
  }): ModalState => ({
    type: "edit-service",
    title: t("modalTitleEditService"),
    serviceId: draft.serviceId,
    initialName: draft.name,
    initialUrl: draft.url,
    initialGroupId: draft.groupId,
    onConfirm: (name, url, groupId) =>
      updateService(draft.serviceId, name, url, groupId)
  })

  const openCreateServiceModal = () => {
    setModal(buildCreateServiceModal())
  }

  const openEditServiceModal = (serviceId: string) => {
    const service = findServiceById(config, serviceId)
    if (!service) {
      return
    }

    const currentGroup = findServiceGroupId(config, serviceId) ?? UNGROUPED_ID
    setModal(
      buildEditServiceModal({
        serviceId,
        name: service.name,
        url: service.urlTemplate,
        groupId: currentGroup
      })
    )
  }

  const handleRenameGroup = (groupId: string) => {
    const group = findGroupById(config, groupId)
    if (!group) {
      return
    }

    setModal({
      type: "rename",
      title: t("modalTitleRenameGroup"),
      initialValue: group.name,
      onConfirm: (value) => {
        const trimmed = clampGroupName(value)
        if (!trimmed) {
          notify(t("groupNameRequired"))
          return false
        }

        setConfig((prev) => ({
          ...prev,
          groups: prev.groups.map((item) =>
            item.id === groupId ? { ...item, name: trimmed } : item
          )
        }))

        return true
      }
    })
  }

  const handleDeleteGroup = (groupId: string) => {
    const group = findGroupById(config, groupId)
    if (!group) {
      return
    }

    setModal({
      type: "confirm",
      title: t("modalTitleDeleteGroup"),
      message: t("confirmDeleteGroup", { name: group.name }),
      onConfirm: () => {
        setConfig((prev) => ({
          ...prev,
          groups: prev.groups.filter((item) => item.id !== groupId),
          groupOrder: prev.groupOrder.filter((id) => id !== groupId)
        }))
      }
    })
  }

  const handleRemoveServiceFromGroup = (serviceId: string) => {
    const groupId = findServiceGroupId(config, serviceId)
    if (!groupId) {
      notify(t("serviceAlreadyDefault"))
      return
    }

    setConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              serviceIds: group.serviceIds.filter((id) => id !== serviceId)
            }
          : group
      )
    }))
  }

  const handleDeleteService = (serviceId: string) => {
    const service = findServiceById(config, serviceId)
    if (!service) {
      return
    }

    setModal({
      type: "confirm",
      title: t("modalTitleDeleteService"),
      message: t("confirmDeleteService", { name: service.name }),
      onConfirm: () => {
        setConfig((prev) => ({
          ...prev,
          services: prev.services.filter((item) => item.id !== serviceId),
          groups: prev.groups.map((group) => ({
            ...group,
            serviceIds: group.serviceIds.filter((id) => id !== serviceId)
          }))
        }))
      }
    })
  }

  const addService = (name: string, url: string, groupId: string) => {
    if (config.services.length >= MAX_SERVICES) {
      notify(t("maxServicesReached"))
      return false
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      notify(t("serviceNameRequired"))
      return false
    }

    const trimmedUrl = url.trim()
    const supportedVariables = inferSupportedVariables(trimmedUrl)

    if (!supportedVariables.domain && !supportedVariables.text) {
      notify(t("urlTemplateMissingDomain"))
      return false
    }

    const newService: AnalysisService = {
      id: createId(),
      name: trimmedName,
      urlTemplate: trimmedUrl,
      createdAt: new Date().toISOString(),
      supportedVariables
    }

    setConfig((prev) => {
      const updated = {
        ...prev,
        services: [...prev.services, newService]
      }

      if (groupId !== UNGROUPED_ID) {
        const targetGroup = findGroupById(prev, groupId)
        if (targetGroup) {
          if (targetGroup.serviceIds.length >= MAX_SERVICES_PER_GROUP) {
            notify(t("groupServiceLimitReached"))
            return prev
          }

          updated.groups = prev.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  serviceIds: [...group.serviceIds, newService.id]
                }
              : group
          )
        }
      }

      return updated
    })

    return true
  }

  const updateService = (
    serviceId: string,
    name: string,
    url: string,
    groupId: string
  ) => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      notify(t("serviceNameRequired"))
      return false
    }

    const trimmedUrl = url.trim()
    const supportedVariables = inferSupportedVariables(trimmedUrl)

    if (!supportedVariables.domain && !supportedVariables.text) {
      notify(t("urlTemplateMissingDomain"))
      return false
    }

    const targetGroupId = groupId === UNGROUPED_ID ? null : groupId

    setConfig((prev) => {
      const sourceGroupId = findServiceGroupId(prev, serviceId)
      const targetGroup = targetGroupId
        ? findGroupById(prev, targetGroupId)
        : null
      const isSameGroup = sourceGroupId === targetGroupId

      if (
        targetGroup &&
        !isSameGroup &&
        targetGroup.serviceIds.length >= MAX_SERVICES_PER_GROUP
      ) {
        notify(t("groupServiceLimitReached"))
        return prev
      }

      const updatedGroups = isSameGroup
        ? prev.groups
        : prev.groups.map((group) => {
            if (group.id === sourceGroupId) {
              return {
                ...group,
                serviceIds: group.serviceIds.filter((id) => id !== serviceId)
              }
            }

            if (group.id === targetGroupId && targetGroup) {
              const nextIds = group.serviceIds.filter((id) => id !== serviceId)
              nextIds.push(serviceId)
              return {
                ...group,
                serviceIds: nextIds
              }
            }

            return group
          })

      return {
        ...prev,
        services: prev.services.map((item) =>
          item.id === serviceId
            ? {
                ...item,
                name: trimmedName,
                urlTemplate: trimmedUrl,
                supportedVariables
              }
            : item
        ),
        groups: updatedGroups
      }
    })

    return true
  }

  const handleImportDefaults = () => {
    const defaults = createDefaultConfig()
    const defaultServiceMap = new Map(
      defaults.services.map((service) => [service.id, service])
    )
    const nextGroups = config.groups.map((group) => ({
      ...group,
      serviceIds: [...group.serviceIds]
    }))
    const nextGroupOrder = [...config.groupOrder]
    const nextServices = [...config.services]
    const groupByName = new Map(
      nextGroups.map((group) => [group.name.trim(), group])
    )
    const serviceByTemplate = new Map(
      nextServices.map((service) => [service.urlTemplate.trim().toLowerCase(), service])
    )
    const serviceByName = new Map(
      nextServices.map((service) => [service.name.trim(), service])
    )

    let addedGroups = 0
    let addedServices = 0

    defaults.groups.forEach((defaultGroup) => {
      const groupKey = defaultGroup.name.trim()
      let targetGroup = groupByName.get(groupKey)

      if (!targetGroup) {
        if (nextGroups.length >= MAX_GROUPS) {
          return
        }

        targetGroup = {
          id: createId(),
          name: defaultGroup.name,
          icon: defaultGroup.icon,
          order: nextGroups.length,
          serviceIds: []
        }

        nextGroups.push(targetGroup)
        if (!nextGroupOrder.includes(targetGroup.id)) {
          const nextOrder = appendGroupId(nextGroupOrder, targetGroup.id)
          nextGroupOrder.splice(0, nextGroupOrder.length, ...nextOrder)
        }
        groupByName.set(groupKey, targetGroup)
        addedGroups += 1
      }

      defaultGroup.serviceIds.forEach((serviceId) => {
        const defaultService = defaultServiceMap.get(serviceId)
        if (!defaultService) {
          return
        }

        const templateKey = defaultService.urlTemplate.trim().toLowerCase()
        const nameKey = defaultService.name.trim()
        if (serviceByTemplate.has(templateKey) || serviceByName.has(nameKey)) {
          return
        }

        if (nextServices.length >= MAX_SERVICES) {
          return
        }

        const newService: AnalysisService = {
          id: createId(),
          name: defaultService.name,
          urlTemplate: defaultService.urlTemplate,
          createdAt: new Date().toISOString(),
          supportedVariables:
            defaultService.supportedVariables ||
            inferSupportedVariables(defaultService.urlTemplate)
        }

        nextServices.push(newService)
        serviceByTemplate.set(templateKey, newService)
        serviceByName.set(nameKey, newService)
        addedServices += 1

        if (
          targetGroup &&
          targetGroup.serviceIds.length < MAX_SERVICES_PER_GROUP
        ) {
          targetGroup.serviceIds.push(newService.id)
        }
      })
    })

    if (addedGroups === 0 && addedServices === 0) {
      notify(t("sampleExists"))
      return
    }

    setConfig({
      ...config,
      groups: nextGroups,
      groupOrder: nextGroupOrder,
      services: nextServices
    })

    notify(t("importedSamples", { groups: addedGroups, services: addedServices }))
  }

  const handleExport = async () => {
    try {
      const configJson = await exportConfig()
      const blob = new Blob([configJson], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `onetap-config-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notify(t("exportSuccess"))
    } catch (error) {
      console.error("Export failed:", error)
      notify(t("exportFailed"))
    }
  }

  const handleExportDomains = async () => {
    try {
      const domains = await exportDomainHistory()
      if (!domains) {
        notify(t("exportDomainsEmpty"))
        return
      }
      const csvContent = `domain\n${domains.split("\n").map(d => `"${d}"`).join("\n")}`
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `onetap-domains-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notify(t("exportDomainsSuccess"))
    } catch (error) {
      console.error("Export domains failed:", error)
      notify(t("exportDomainsFailed"))
    }
  }

  const handleExportKeywords = async () => {
    try {
      const keywords = await exportKeywordHistory()
      if (!keywords) {
        notify(t("exportKeywordsEmpty"))
        return
      }
      const csvContent = `keyword\n${keywords.split("\n").map(k => `"${k.replace(/"/g, '""')}"`).join("\n")}`
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `onetap-keywords-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notify(t("exportKeywordsSuccess"))
    } catch (error) {
      console.error("Export keywords failed:", error)
      notify(t("exportKeywordsFailed"))
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const importedConfig = await importConfig(content)
        setConfig(importedConfig)
        notify(t("importSuccess"))
      } catch (error) {
        console.error("Import failed:", error)
        notify(t("importFailed"))
      }
    }
    reader.readAsText(file)
    // Reset input to allow re-importing the same file
    event.target.value = ""
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    setInsertPosition(null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const active = String(event.active.id)
    const over = event.over ? String(event.over.id) : null

    if (!isServiceId(active)) {
      setInsertPosition(null)
      return
    }

    const activeServiceId = stripPrefix(active, SERVICE_PREFIX)
    let targetGroupId: string | null = null
    let beforeServiceId: string | null = null
    let afterServiceId: string | null = null

    if (isServiceId(over)) {
      const overServiceId = stripPrefix(over, SERVICE_PREFIX)
      targetGroupId = findServiceGroupId(config, overServiceId)
      if (targetGroupId === UNGROUPED_ID) {
        targetGroupId = null
      }

      beforeServiceId = overServiceId
    } else if (isContainerId(over)) {
      targetGroupId = stripPrefix(over, CONTAINER_PREFIX)
      if (targetGroupId === UNGROUPED_ID) {
        targetGroupId = null
      }
      const group = targetGroupId ? findGroupById(config, targetGroupId) : null
      if (group && group.serviceIds.length > 0) {
        afterServiceId = group.serviceIds[group.serviceIds.length - 1]
      }
    } else if (isGroupId(over)) {
      targetGroupId = stripPrefix(over, GROUP_PREFIX)
      if (targetGroupId === UNGROUPED_ID) {
        targetGroupId = null
      }
      const group = targetGroupId ? findGroupById(config, targetGroupId) : null
      if (group && group.serviceIds.length > 0) {
        afterServiceId = group.serviceIds[group.serviceIds.length - 1]
      }
    }

    setInsertPosition({ groupId: targetGroupId, beforeServiceId, afterServiceId })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const active = String(event.active.id)
    const over = event.over ? String(event.over.id) : null

    setActiveId(null)
    setInsertPosition(null)

    if (!over || active === over) {
      return
    }

    if (isGroupId(active) && isGroupId(over)) {
      const activeGroupId = stripPrefix(active, GROUP_PREFIX)
      const overGroupId = stripPrefix(over, GROUP_PREFIX)
      const oldIndex = config.groupOrder.indexOf(activeGroupId)
      const newIndex = config.groupOrder.indexOf(overGroupId)

      if (oldIndex !== -1 && newIndex !== -1) {
        setConfig((prev) => ({
          ...prev,
          groupOrder: ensureHasDefault(arrayMove(prev.groupOrder, oldIndex, newIndex))
        }))
      }
      return
    }

    if (!isServiceId(active)) {
      return
    }

    const activeServiceId = stripPrefix(active, SERVICE_PREFIX)
    const sourceGroupId = findServiceGroupId(config, activeServiceId)
    let targetGroupId: string | null = null

    if (isServiceId(over)) {
      const overServiceId = stripPrefix(over, SERVICE_PREFIX)
      targetGroupId = findServiceGroupId(config, overServiceId)
    } else if (isContainerId(over)) {
      targetGroupId = stripPrefix(over, CONTAINER_PREFIX)
    } else if (isGroupId(over)) {
      targetGroupId = stripPrefix(over, GROUP_PREFIX)
    }

    if (targetGroupId === UNGROUPED_ID) {
      targetGroupId = null
    }

    if (sourceGroupId === targetGroupId) {
      if (!targetGroupId) {
        const overServiceId = isServiceId(over)
          ? stripPrefix(over, SERVICE_PREFIX)
          : null

        setConfig((prev) => {
          const services = prev.services.slice()
          const oldIndex = services.findIndex((service) => service.id === activeServiceId)
          if (oldIndex === -1) {
            return prev
          }

          let newIndex = -1

          if (overServiceId) {
            newIndex = services.findIndex((service) => service.id === overServiceId)
          } else if (isContainerId(over) || isGroupId(over)) {
            const ungrouped = getUngroupedServices(prev.services, prev.groups)
            const lastUngrouped = ungrouped[ungrouped.length - 1]
            if (lastUngrouped) {
              newIndex = services.findIndex(
                (service) => service.id === lastUngrouped.id
              )
            }
          }

          if (newIndex === -1 || newIndex === oldIndex) {
            return prev
          }

          return {
            ...prev,
            services: arrayMove(services, oldIndex, newIndex)
          }
        })

        return
      }

      const group = findGroupById(config, targetGroupId)
      if (!group) {
        return
      }

      const overServiceId = isServiceId(over)
        ? stripPrefix(over, SERVICE_PREFIX)
        : null

      if (!overServiceId) {
        return
      }

      const oldIndex = group.serviceIds.indexOf(activeServiceId)
      const newIndex = group.serviceIds.indexOf(overServiceId)

      if (oldIndex !== -1 && newIndex !== -1) {
        setConfig((prev) => ({
          ...prev,
          groups: prev.groups.map((item) =>
            item.id === group.id
              ? {
                  ...item,
                  serviceIds: arrayMove(item.serviceIds, oldIndex, newIndex)
                }
              : item
          )
        }))
      }

      return
    }

    setConfig((prev) => {
      const sourceGroup = sourceGroupId
        ? findGroupById(prev, sourceGroupId)
        : null
      const targetGroup = targetGroupId
        ? findGroupById(prev, targetGroupId)
        : null

      if (targetGroup && targetGroup.serviceIds.length >= MAX_SERVICES_PER_GROUP) {
        notify(t("targetGroupServiceLimitReached"))
        return prev
      }

      const updatedGroups = prev.groups.map((group) => {
        if (group.id === sourceGroup?.id) {
          return {
            ...group,
            serviceIds: group.serviceIds.filter((id) => id !== activeServiceId)
          }
        }

        if (group.id === targetGroup?.id) {
          const nextIds = group.serviceIds.filter((id) => id !== activeServiceId)
          let insertIndex = nextIds.length

          if (insertPosition) {
            if (insertPosition.beforeServiceId) {
              const beforeIndex = nextIds.indexOf(insertPosition.beforeServiceId)
              if (beforeIndex !== -1) {
                insertIndex = beforeIndex
              }
            } else if (insertPosition.afterServiceId) {
              const afterIndex = nextIds.indexOf(insertPosition.afterServiceId)
              if (afterIndex !== -1) {
                insertIndex = afterIndex + 1
              }
            }
          }

          nextIds.splice(insertIndex, 0, activeServiceId)

          return {
            ...group,
            serviceIds: nextIds
          }
        }

        return group
      })

      return {
        ...prev,
        groups: updatedGroups
      }
    })
  }

  const dragOverlayLabel = useMemo(() => {
    if (!activeId) {
      return null
    }

    if (isGroupId(activeId)) {
      const groupId = stripPrefix(activeId, GROUP_PREFIX)
      if (groupId === UNGROUPED_ID) {
        return t("dragOverlayDefaultGroup")
      }

      const group = findGroupById(config, groupId)
      return group ? `${group.icon} ${group.name}` : ""
    }

    if (isServiceId(activeId)) {
      const service = findServiceById(config, stripPrefix(activeId, SERVICE_PREFIX))
      return service?.name ?? ""
    }

    return null
  }, [activeId, config])

  return (
    <div className="options">
      <header className="options__header">
        <div>
          <h1>⚙️ {t("headerTitle")}</h1>
          <p>{t("headerSubtitle")}</p>
        </div>
        <div className="options__actions">
          <div className="dropdown">
            <button 
              className="primary is-compact dropdown-toggle"
              onClick={() => setShowConfigMenu(!showConfigMenu)}
            >
              ⚙️ {t("optionsSettings")}
            </button>
            {showConfigMenu && (
              <div className="dropdown-menu">
                <button 
                  className="dropdown-item"
                  onClick={() => {
                    handleExport()
                    setShowConfigMenu(false)
                  }}
                >
                  {t("buttonExport")} Config
                </button>
                <label className="dropdown-item button-file">
                  {t("buttonImport")} Config
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      handleImport(e)
                      setShowConfigMenu(false)
                    }}
                    style={{ display: "none" }}
                  />
                </label>
                <button 
                  className="dropdown-item"
                  onClick={() => {
                    handleImportDefaults()
                    setShowConfigMenu(false)
                  }}
                >
                  Import Sample Configs
                </button>
                <div className="dropdown-divider" />
                <button 
                  className="dropdown-item"
                  onClick={() => {
                    handleExportDomains()
                    setShowConfigMenu(false)
                  }}
                >
                  {t("optionsExportDomains")}
                </button>
                <button 
                  className="dropdown-item"
                  onClick={() => {
                    handleExportKeywords()
                    setShowConfigMenu(false)
                  }}
                >
                  {t("optionsExportKeywords")}
                </button>
              </div>
            )}
          </div>
          <button className="primary is-compact" onClick={() => openCreateGroupModal()}>
            {t("buttonAddGroup")}
          </button>
          <button className="primary is-compact" onClick={openCreateServiceModal}>
            {t("buttonAddService")}
          </button>
        </div>
      </header>


      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}>
        <SortableContext
          items={orderedGroupIds.map((groupId) => asGroupDragId(groupId))}
          strategy={verticalListSortingStrategy}>
          <div className="group-list">
            {orderedGroupIds.map((groupId) => {
              if (groupId === UNGROUPED_ID) {
                if (ungroupedServices.length === 0) {
                  return null
                }
                return (
                  <DroppableContainer key={UNGROUPED_ID} id={UNGROUPED_ID}>
                    <SortableUngrouped
                      services={ungroupedServices}
                      onRemoveService={handleRemoveServiceFromGroup}
                      onDeleteService={handleDeleteService}
                      onEditService={openEditServiceModal}
                      disabled={!isReady}
                      insertPosition={insertPosition}
                    />
                  </DroppableContainer>
                )
              }

              const group = findGroupById(config, groupId)
              if (!group) {
                return null
              }

              const services = group.serviceIds
                .map((id) => findServiceById(config, id))
                .filter((service): service is AnalysisService => Boolean(service))

              return (
                <DroppableContainer key={group.id} id={group.id}>
                  <SortableGroup
                    group={group}
                    services={services}
                    onRename={handleRenameGroup}
                    onDelete={handleDeleteGroup}
                    onRemoveService={handleRemoveServiceFromGroup}
                    onDeleteService={handleDeleteService}
                    onEditService={openEditServiceModal}
                    disabled={!isReady}
                    insertPosition={insertPosition}
                  />
                </DroppableContainer>
              )
            })}
          </div>
        </SortableContext>

        <DragOverlay>
          {dragOverlayLabel ? (
            <div className="drag-overlay">{dragOverlayLabel}</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="options__stats">
        {t("statsSummary", { services: stats.services, groups: stats.groups })}
      </div>

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.message}
          </div>
        ))}
      </div>

      {modal ? (
        <Modal
          modal={modal}
          groups={orderedGroups}
          onRequestCreateGroup={(draft) => {
            const fallbackModal =
              draft.mode === "edit"
                ? buildEditServiceModal({
                    serviceId: draft.serviceId!,
                    name: draft.name,
                    url: draft.url,
                    groupId: draft.groupId
                  })
                : buildCreateServiceModal({
                    name: draft.name,
                    url: draft.url,
                    groupId: draft.groupId
                  })
            const opened = openCreateGroupModal((newGroupId) => {
              const nextDraft = { ...draft, groupId: newGroupId }
              const nextModal =
                draft.mode === "edit"
                  ? buildEditServiceModal({
                      serviceId: nextDraft.serviceId!,
                      name: nextDraft.name,
                      url: nextDraft.url,
                      groupId: nextDraft.groupId
                    })
                  : buildCreateServiceModal({
                      name: nextDraft.name,
                      url: nextDraft.url,
                      groupId: nextDraft.groupId
                    })
              setPendingModal(nextModal)
            })
            if (opened) {
              setPendingModal(fallbackModal)
            }
          }}
          onClose={() => setModal(null)}
          onConfirm={() => setModal(null)}
        />
      ) : null}
    </div>
  )
}

const Modal = ({
  modal,
  groups,
  onRequestCreateGroup,
  onClose,
  onConfirm
}: {
  modal: ModalState
  groups: ServiceGroup[]
  onRequestCreateGroup?: (draft: {
    mode: "create" | "edit"
    serviceId?: string
    name: string
    url: string
    groupId: string
  }) => void
  onClose: () => void
  onConfirm: () => void
}) => {
  const [value, setValue] = useState(
    modal.type === "rename"
      ? modal.initialValue
      : modal.type === "create-group"
        ? modal.initialName
        : modal.type === "create-service"
          ? modal.initialName
        : modal.type === "edit-service"
          ? modal.initialName
        : ""
  )
  const [url, setUrl] = useState(
    modal.type === "edit-service" || modal.type === "create-service"
      ? modal.initialUrl
      : ""
  )
  const [groupId, setGroupId] = useState(
    modal.type === "edit-service" || modal.type === "create-service"
      ? modal.initialGroupId
      : UNGROUPED_ID
  )
  const [icon, setIcon] = useState(
    modal.type === "create-group" ? modal.initialIcon : ICONS[0]
  )

  useEffect(() => {
    if (modal.type === "rename") {
      setValue(modal.initialValue)
    }
    if (modal.type === "create-group") {
      setValue(modal.initialName)
      setIcon(modal.initialIcon)
    }
    if (modal.type === "edit-service") {
      setValue(modal.initialName)
      setUrl(modal.initialUrl)
      setGroupId(modal.initialGroupId)
    }
    if (modal.type === "create-service") {
      setValue(modal.initialName)
      setUrl(modal.initialUrl)
      setGroupId(modal.initialGroupId)
    }
  }, [modal])

  const handlePrimary = () => {
    if (modal.type === "confirm") {
      modal.onConfirm()
      onConfirm()
      return
    }

    const ok =
      modal.type === "create-group"
        ? modal.onConfirm(value, icon)
        : modal.type === "edit-service"
          ? modal.onConfirm(value, url, groupId)
          : modal.type === "create-service"
            ? modal.onConfirm(value, url, groupId)
          : modal.onConfirm(value)
    if (ok) {
      onConfirm()
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal__title">{modal.title}</div>
        <div className="modal__body">
          {modal.type === "confirm" ? (
            <p>{modal.message}</p>
          ) : modal.type === "edit-service" || modal.type === "create-service" ? (
            <>
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={t("placeholderServiceName")}
              />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={t("placeholderUrlTemplate")}
              />
              <select
                className="modal__select"
                value={groupId}
                onChange={(event) => {
                  const nextValue = event.target.value
                  if (nextValue === NEW_GROUP_ID) {
                    onRequestCreateGroup?.({
                      mode: modal.type === "edit-service" ? "edit" : "create",
                      serviceId:
                        modal.type === "edit-service" ? modal.serviceId : undefined,
                      name: value,
                      url,
                      groupId
                    })
                    return
                  }
                  setGroupId(nextValue)
                }}>
                <option value={UNGROUPED_ID}>{t("optionDefaultGroup")}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.icon} {group.name}
                  </option>
                ))}
                <option value={NEW_GROUP_ID}>{t("optionNewGroup")}</option>
              </select>
            </>
          ) : modal.type === "create-group" ? (
            <>
              <div className="modal__hint">
                {t("hintGroupServiceResponse")}
              </div>
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={MAX_GROUP_NAME}
                placeholder={t("placeholderGroupName")}
              />
              <select
                className="modal__select"
                value={icon}
                onChange={(event) => setIcon(event.target.value)}>
                {ICONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={MAX_GROUP_NAME}
                placeholder={t("placeholderGroupName")}
              />
            </>
          )}
        </div>
        <div className="modal__actions">
          <button className="ghost-button" onClick={onClose}>
            {t("modalButtonCancel")}
          </button>
          <button className="primary" onClick={handlePrimary}>
            {modal.type === "confirm"
              ? t("modalButtonConfirm")
              : modal.type === "create-group" || modal.type === "create-service"
                ? t("modalButtonAdd")
                : t("modalButtonSave")}
          </button>
        </div>
      </div>
    </div>
  )
}

const DroppableContainer = ({
  id,
  children,
  className
}: {
  id: string
  children: ReactNode
  className?: string
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: asContainerId(id) })

  return (
    <div
      ref={setNodeRef}
      className={clsx("droppable", className, isOver && "is-over")}>
      {children}
    </div>
  )
}

export default OptionsPage
