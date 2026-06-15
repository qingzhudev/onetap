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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Settings } from "lucide-react"

import {
  clampGroupName,
  createInitialConfig,
  getOrderedWorkflows,
  getOrderedGroups,
  getUngroupedServices,
  inferSupportedVariables
} from "~lib/config"
import {
  ICONS,
  MAX_GROUP_COUNT,
  MAX_GROUP_NAME_LENGTH,
  MAX_HISTORY_ITEMS,
  MAX_SERVICE_COUNT,
  MAX_WORKFLOW_COUNT,
  MAX_SERVICES_PER_GROUP_COUNT,
  DEFAULT_GROUP_ID
} from "~lib/constants"
import { createId } from "~lib/id"
import { t } from "~lib/i18n"
import { getConfig, saveConfig, exportConfig, importConfig, exportDomainHistory, exportKeywordHistory } from "~lib/storage"
import { useToast } from "~lib/toast"
import type {
  AnalysisService,
  ServiceGroup,
  UserConfig,
  Workflow,
  WorkflowMode,
  WorkflowOpenStrategy
} from "~lib/types"
import "~styles/options.css"

const GROUP_PREFIX = "group:"
const SERVICE_PREFIX = "service:"
const CONTAINER_PREFIX = "container:"
const WORKFLOW_STEP_PREFIX = "workflow-step:"
const NEW_GROUP_ID = "new-group"

const asGroupDragId = (id: string) => `${GROUP_PREFIX}${id}`
const asServiceDragId = (id: string) => `${SERVICE_PREFIX}${id}`
const asContainerId = (id: string) => `${CONTAINER_PREFIX}${id}`
const asWorkflowStepDragId = (id: string) => `${WORKFLOW_STEP_PREFIX}${id}`

const stripPrefix = (value: string, prefix: string) =>
  value.startsWith(prefix) ? value.slice(prefix.length) : value

const isGroupId = (value: string) => value.startsWith(GROUP_PREFIX)
const isServiceId = (value: string) => value.startsWith(SERVICE_PREFIX)
const isContainerId = (value: string) => value.startsWith(CONTAINER_PREFIX)
const isWorkflowStepId = (value: string) => value.startsWith(WORKFLOW_STEP_PREFIX)

const findGroupById = (config: UserConfig, id: string) =>
  config.groups.find((group) => group.id === id)

const findServiceById = (config: UserConfig, id: string) =>
  config.services.find((service) => service.id === id)

const findWorkflowById = (config: UserConfig, id: string) =>
  config.workflows.find((workflow) => workflow.id === id)

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
  groupId,
  services,
  onRemoveService,
  onDeleteService,
  onEditService,
  disabled,
  insertPosition
}: {
  groupId: string
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
  } = useSortable({ id: asGroupDragId(DEFAULT_GROUP_ID), disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={clsx("group-card", isDragging && "is-dragging")}>
      <header className="group-card__header group-card__header--no-actions">
        <button className="drag-handle" {...attributes} {...listeners}>
          ⠿
        </button>
        <div className="group-card__title">
          <span className="group-card__icon">📋</span>
          <span>{t("defaultGroupName")}</span>
          <span className="group-card__count">({services.length})</span>
        </div>
        <div className="group-card__spacer" />
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
                  insertPosition?.groupId === groupId &&
                  insertPosition?.beforeServiceId === service.id
                }
                insertAfter={
                  insertPosition?.groupId === groupId &&
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

const WorkflowCard = ({
  workflow,
  services,
  onEdit,
  onDelete,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: {
  workflow: Workflow
  services: AnalysisService[]
  onEdit: (workflowId: string) => void
  onDelete: (workflowId: string) => void
  onTogglePin: (workflowId: string) => void
  onMoveUp: (workflowId: string) => void
  onMoveDown: (workflowId: string) => void
  canMoveUp: boolean
  canMoveDown: boolean
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const previewServices = services.slice(0, 3)
  const displayedServices = isExpanded ? services : previewServices
  const remainingCount = Math.max(services.length - previewServices.length, 0)
  const modeLabel =
    workflow.mode === "domain"
      ? t("optionWorkflowModeDomain")
      : workflow.mode === "text"
        ? t("optionWorkflowModeText")
        : t("optionWorkflowModeBoth")
  const strategyLabel =
    workflow.openStrategy === "background-all"
      ? t("optionWorkflowOpenBackgroundAll")
      : t("optionWorkflowOpenForegroundFirst")

  return (
    <section className="workflow-card">
      <div className="workflow-card__header">
        <div className="workflow-card__title-wrap">
          <div className="workflow-card__title-row">
            <span className="workflow-card__title">{workflow.name}</span>
            <span className="workflow-card__meta-badge">{modeLabel}</span>
            {workflow.pinned ? (
              <span className="workflow-card__badge">{t("workflowPinned")}</span>
            ) : null}
          </div>
          <div className="workflow-card__meta">
            <span>{t("workflowCount", { count: workflow.serviceIds.length })}</span>
            <span>{t("workflowOpenStrategy")}: {strategyLabel}</span>
          </div>
        </div>
        <div className="group-card__actions">
          <button className="ghost-button" onClick={() => onTogglePin(workflow.id)}>
            {workflow.pinned ? t("workflowUnpin") : t("workflowPin")}
          </button>
          <button
            className="ghost-button"
            onClick={() => onMoveUp(workflow.id)}
            disabled={!canMoveUp}>
            {t("workflowMoveUp")}
          </button>
          <button
            className="ghost-button"
            onClick={() => onMoveDown(workflow.id)}
            disabled={!canMoveDown}>
            {t("workflowMoveDown")}
          </button>
          <button className="ghost-button" onClick={() => onEdit(workflow.id)}>
            {t("workflowEdit")}
          </button>
          <button className="ghost-button danger" onClick={() => onDelete(workflow.id)}>
            {t("workflowDelete")}
          </button>
        </div>
      </div>
      <ol className="workflow-card__steps">
        {displayedServices.map((service) => (
          <li key={service.id} className="workflow-card__step">
            <span className="workflow-card__step-index">
              {workflow.serviceIds.indexOf(service.id) + 1}
            </span>
            <span className="workflow-card__step-meta">
              <span className="workflow-card__step-name">{service.name}</span>
              <span
                className="workflow-card__step-template"
                title={service.urlTemplate}>
                {service.urlTemplate}
              </span>
            </span>
          </li>
        ))}
        {remainingCount > 0 ? (
          <li className="workflow-card__step workflow-card__step--more">
            <button
              className="workflow-card__step-toggle"
              type="button"
              onClick={() => setIsExpanded((current) => !current)}>
              {isExpanded
                ? t("workflowCollapseSteps")
                : t("workflowShowAllSteps")}
            </button>
          </li>
        ) : null}
      </ol>
    </section>
  )
}

const FieldLabel = ({
  label,
  help
}: {
  label: string
  help: string
}) => (
  <div className="modal__field-label">
    <span>{label}</span>
    <span className="help-tip" data-tooltip={help} aria-label={help}>
      ?
    </span>
  </div>
)

const SortableWorkflowStep = ({
  service,
  index,
  onRemove
}: {
  service: AnalysisService
  index: number
  onRemove: (serviceId: string) => void
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: asWorkflowStepDragId(service.id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx("workflow-step", isDragging && "is-dragging")}>
      <button className="drag-handle" {...attributes} {...listeners}>
        ⠿
      </button>
      <span className="workflow-step__index">{index + 1}</span>
      <div className="workflow-step__content">
        <div className="workflow-step__name">{service.name}</div>
        <div className="workflow-step__template" title={service.urlTemplate}>
          {service.urlTemplate}
        </div>
      </div>
      <button
        className="ghost-button"
        type="button"
        onClick={() => onRemove(service.id)}>
        {t("serviceRemove")}
      </button>
    </li>
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
  | {
      type: "create-workflow"
      title: string
      initialName: string
      initialMode: WorkflowMode
      initialPinned: boolean
      initialOpenStrategy: WorkflowOpenStrategy
      initialServiceIds: string[]
      onConfirm: (
        name: string,
        mode: WorkflowMode,
        pinned: boolean,
        openStrategy: WorkflowOpenStrategy,
        serviceIds: string[]
      ) => boolean
    }
  | {
      type: "edit-workflow"
      title: string
      workflowId: string
      initialName: string
      initialMode: WorkflowMode
      initialPinned: boolean
      initialOpenStrategy: WorkflowOpenStrategy
      initialServiceIds: string[]
      onConfirm: (
        name: string,
        mode: WorkflowMode,
        pinned: boolean,
        openStrategy: WorkflowOpenStrategy,
        serviceIds: string[]
      ) => boolean
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
  groupId: string
  beforeServiceId: string | null
  afterServiceId: string | null
}

type OptionsTab = "workflows" | "services"

const OptionsPage = () => {
  const [config, setConfig] = useState<UserConfig>(() => createInitialConfig())
  const [activeTab, setActiveTab] = useState<OptionsTab>("services")
  const [isReady, setIsReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [insertPosition, setInsertPosition] = useState<InsertPosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [groupIcon, setGroupIcon] = useState(ICONS[0])
  const [modal, setModal] = useState<ModalState | null>(null)
  const [pendingModal, setPendingModal] = useState<ModalState | null>(null)
  const [showConfigMenu, setShowConfigMenu] = useState(false)
  const configMenuRef = useRef<HTMLDivElement>(null)
  const { toasts, notify } = useToast()

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
      return
    }

    const handleMessage = (message: { type?: string; tab?: OptionsTab }) => {
      if (message.type === "SHOW_OPTIONS_TAB" && message.tab) {
        setActiveTab(message.tab)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (configMenuRef.current && !configMenuRef.current.contains(event.target as Node)) {
        setShowConfigMenu(false)
      }
    }

    if (showConfigMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showConfigMenu])

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
    if (!isReady || isDragging) {
      return
    }

    const timer = window.setTimeout(() => {
      saveConfig(config)
    }, 200)

    return () => window.clearTimeout(timer)
  }, [config, isReady, isDragging])

  useEffect(() => {
    if (!modal && pendingModal) {
      setModal(pendingModal)
      setPendingModal(null)
    }
  }, [modal, pendingModal])

  const ensureHasDefault = (order: string[]) =>
    order.includes(DEFAULT_GROUP_ID) ? order : [DEFAULT_GROUP_ID, ...order]

  const appendGroupId = (order: string[], groupId: string) =>
    ensureHasDefault([...order.filter((id) => id !== groupId), groupId])

  const appendWorkflowId = (order: string[], workflowId: string) => [
    ...order.filter((id) => id !== workflowId),
    workflowId
  ]

  const orderedWorkflows = useMemo(() => getOrderedWorkflows(config), [config])
  const orderedGroups = useMemo(() => getOrderedGroups(config), [config])
  const orderedGroupIds = useMemo(() => {
    const order = config.groupOrder.length
      ? config.groupOrder
      : [DEFAULT_GROUP_ID]
    return ensureHasDefault(
      order.includes(DEFAULT_GROUP_ID) ? order : [...order, DEFAULT_GROUP_ID]
    )
  }, [config.groupOrder])

  const stats = useMemo(
    () => ({
      services: config.services.length,
      groups: config.groups.length,
      workflows: config.workflows.length
    }),
    [config.services.length, config.groups.length, config.workflows.length]
  )

  const ungroupedServices = useMemo(
    () => getUngroupedServices(config.services, config.groups),
    [config]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 100
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const openCreateGroupModal = (
    afterCreate?: (newGroupId: string) => void
  ) => {
    if (config.groups.length >= MAX_GROUP_COUNT) {
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

        if (config.groups.length >= MAX_GROUP_COUNT) {
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
    initialGroupId: draft?.groupId ?? DEFAULT_GROUP_ID,
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

    const currentGroup = findServiceGroupId(config, serviceId) ?? DEFAULT_GROUP_ID
    setModal(
      buildEditServiceModal({
        serviceId,
        name: service.name,
        url: service.urlTemplate,
        groupId: currentGroup
      })
    )
  }

  const buildCreateWorkflowModal = (draft?: {
    name?: string
    mode?: WorkflowMode
    pinned?: boolean
    openStrategy?: WorkflowOpenStrategy
    serviceIds?: string[]
  }): ModalState => ({
    type: "create-workflow",
    title: t("modalTitleAddWorkflow"),
    initialName: draft?.name ?? "",
    initialMode: draft?.mode ?? "both",
    initialPinned: draft?.pinned ?? true,
    initialOpenStrategy: draft?.openStrategy ?? "foreground-first",
    initialServiceIds: draft?.serviceIds ?? [],
    onConfirm: (name, mode, pinned, openStrategy, serviceIds) =>
      addWorkflow(name, mode, pinned, openStrategy, serviceIds)
  })

  const openCreateWorkflowModal = () => {
    setModal(buildCreateWorkflowModal({ pinned: false }))
  }

  const openEditWorkflowModal = (workflowId: string) => {
    const workflow = findWorkflowById(config, workflowId)
    if (!workflow) {
      return
    }

    setModal({
      type: "edit-workflow",
      title: t("modalTitleEditWorkflow"),
      workflowId,
      initialName: workflow.name,
      initialMode: workflow.mode,
      initialPinned: workflow.pinned,
      initialOpenStrategy: workflow.openStrategy,
      initialServiceIds: workflow.serviceIds,
      onConfirm: (name, mode, pinned, openStrategy, serviceIds) =>
        updateWorkflow(workflowId, name, mode, pinned, openStrategy, serviceIds)
    })
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

  const addWorkflow = (
    name: string,
    mode: WorkflowMode,
    pinned: boolean,
    openStrategy: WorkflowOpenStrategy,
    serviceIds: string[]
  ) => {
    if (config.workflows.length >= MAX_WORKFLOW_COUNT) {
      notify(t("maxWorkflowsReached"))
      return false
    }

    const trimmedName = name.trim()
    const normalizedServiceIds = serviceIds.filter((serviceId) =>
      config.services.some((service) => service.id === serviceId)
    )

    if (!trimmedName || normalizedServiceIds.length === 0) {
      notify(t("workflowCreateFailed"))
      return false
    }

    const workflowId = createId()
    const workflow: Workflow = {
      id: workflowId,
      name: trimmedName,
      mode,
      pinned,
      openStrategy,
      serviceIds: normalizedServiceIds
    }

    setConfig((prev) => ({
      ...prev,
      workflows: [...prev.workflows, workflow],
      workflowOrder: appendWorkflowId(prev.workflowOrder, workflowId)
    }))

    return true
  }

  const updateWorkflow = (
    workflowId: string,
    name: string,
    mode: WorkflowMode,
    pinned: boolean,
    openStrategy: WorkflowOpenStrategy,
    serviceIds: string[]
  ) => {
    const trimmedName = name.trim()
    const normalizedServiceIds = serviceIds.filter((serviceId) =>
      config.services.some((service) => service.id === serviceId)
    )

    if (!trimmedName || normalizedServiceIds.length === 0) {
      notify(t("workflowCreateFailed"))
      return false
    }

    setConfig((prev) => ({
      ...prev,
      workflows: prev.workflows.map((workflow) =>
        workflow.id === workflowId
          ? {
              ...workflow,
              name: trimmedName,
              mode,
              pinned,
              openStrategy,
              serviceIds: normalizedServiceIds
            }
          : workflow
      )
    }))

    return true
  }

  const handleDeleteWorkflow = (workflowId: string) => {
    const workflow = findWorkflowById(config, workflowId)
    if (!workflow) {
      return
    }

    setModal({
      type: "confirm",
      title: t("modalTitleDeleteWorkflow"),
      message: t("confirmDeleteWorkflow", { name: workflow.name }),
      onConfirm: () => {
        setConfig((prev) => ({
          ...prev,
          workflows: prev.workflows.filter((item) => item.id !== workflowId),
          workflowOrder: prev.workflowOrder.filter((id) => id !== workflowId)
        }))

      }
    })
  }

  const toggleWorkflowPinned = (workflowId: string) => {
    const workflow = findWorkflowById(config, workflowId)
    if (!workflow) {
      return
    }

    setConfig((prev) => ({
      ...prev,
      workflows: prev.workflows.map((item) =>
        item.id === workflowId ? { ...item, pinned: !item.pinned } : item
      )
    }))

  }

  const moveWorkflow = (workflowId: string, direction: -1 | 1) => {
    const currentIndex = config.workflowOrder.indexOf(workflowId)
    const nextIndex = currentIndex + direction

    if (
      currentIndex === -1 ||
      nextIndex < 0 ||
      nextIndex >= config.workflowOrder.length
    ) {
      return
    }

    setConfig((prev) => ({
      ...prev,
      workflowOrder: arrayMove(prev.workflowOrder, currentIndex, nextIndex)
    }))
  }

  const handleRemoveServiceFromGroup = (serviceId: string) => {
    const groupId = findServiceGroupId(config, serviceId)
    if (groupId === null || groupId === DEFAULT_GROUP_ID) {
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
          workflows: prev.workflows.map((workflow) => ({
            ...workflow,
            serviceIds: workflow.serviceIds.filter((id) => id !== serviceId)
          })),
          groups: prev.groups.map((group) => ({
            ...group,
            serviceIds: group.serviceIds.filter((id) => id !== serviceId)
          }))
        }))

      }
    })
  }

  const addService = (name: string, url: string, groupId: string) => {
    if (config.services.length >= MAX_SERVICE_COUNT) {
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

      if (groupId !== DEFAULT_GROUP_ID) {
        const targetGroup = findGroupById(prev, groupId)
        if (targetGroup) {
          if (targetGroup.serviceIds.length >= MAX_SERVICES_PER_GROUP_COUNT) {
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

    const targetGroupId = groupId === DEFAULT_GROUP_ID ? null : groupId

    setConfig((prev) => {
      const sourceGroupId = findServiceGroupId(prev, serviceId)
      const targetGroup = targetGroupId
        ? findGroupById(prev, targetGroupId)
        : null
      const isSameGroup = sourceGroupId === targetGroupId

      if (
        targetGroup &&
        !isSameGroup &&
        targetGroup.serviceIds.length >= MAX_SERVICES_PER_GROUP_COUNT
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
      notify(`${t("exportSuccess")} · ${t("statsSummary", stats)}`)

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
        notify(
          `${t("importSuccess")} · ${t("statsSummary", {
            services: importedConfig.services.length,
            groups: importedConfig.groups.length,
            workflows: importedConfig.workflows.length
          })}`
        )

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
    setIsDragging(true)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const active = String(event.active.id)
    const over = event.over ? String(event.over.id) : null

    // Early return if not over anything
    if (!over) {
      setInsertPosition(null)
      return
    }

    // Handle group dragging - just return, let @dnd-kit handle it
    if (!isServiceId(active)) {
      return
    }

    let targetGroupId: string | null = null
    let beforeServiceId: string | null = null
    let afterServiceId: string | null = null

    if (isServiceId(over)) {
      const overServiceId = stripPrefix(over, SERVICE_PREFIX)
      targetGroupId = findServiceGroupId(config, overServiceId)
      // Keep DEFAULT_GROUP_ID as-is, don't convert to null
      if (targetGroupId === null) {
        targetGroupId = DEFAULT_GROUP_ID
      }
      beforeServiceId = overServiceId
    } else if (isContainerId(over)) {
      targetGroupId = stripPrefix(over, CONTAINER_PREFIX)
      const group = findGroupById(config, targetGroupId)
      if (group && group.serviceIds.length > 0) {
        afterServiceId = group.serviceIds[group.serviceIds.length - 1]
      }
    } else if (isGroupId(over)) {
      targetGroupId = stripPrefix(over, GROUP_PREFIX)
      const group = findGroupById(config, targetGroupId)
      if (group && group.serviceIds.length > 0) {
        afterServiceId = group.serviceIds[group.serviceIds.length - 1]
      }
    }

    // Only update if position actually changed
    setInsertPosition((prev) => {
      if (!prev) {
        return { groupId: targetGroupId, beforeServiceId, afterServiceId }
      }

      if (
        prev.groupId === targetGroupId &&
        prev.beforeServiceId === beforeServiceId &&
        prev.afterServiceId === afterServiceId
      ) {
        return prev // No change, avoid re-render
      }

      return { groupId: targetGroupId, beforeServiceId, afterServiceId }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const active = String(event.active.id)
    const over = event.over ? String(event.over.id) : null

    setActiveId(null)
    setInsertPosition(null)
    setIsDragging(false)

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
    const sourceGroupId = findServiceGroupId(config, activeServiceId) ?? DEFAULT_GROUP_ID
    let targetGroupId: string | null = null

    if (isServiceId(over)) {
      const overServiceId = stripPrefix(over, SERVICE_PREFIX)
      targetGroupId = findServiceGroupId(config, overServiceId) ?? DEFAULT_GROUP_ID
    } else if (isContainerId(over)) {
      targetGroupId = stripPrefix(over, CONTAINER_PREFIX)
    } else if (isGroupId(over)) {
      targetGroupId = stripPrefix(over, GROUP_PREFIX)
    }

    if (sourceGroupId === targetGroupId) {
      if (targetGroupId === DEFAULT_GROUP_ID) {
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
      const sourceGroup = sourceGroupId !== DEFAULT_GROUP_ID
        ? findGroupById(prev, sourceGroupId)
        : null
      const targetGroup = targetGroupId !== DEFAULT_GROUP_ID
        ? findGroupById(prev, targetGroupId)
        : null

      if (targetGroup && targetGroup.serviceIds.length >= MAX_SERVICES_PER_GROUP_COUNT) {
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
      if (groupId === DEFAULT_GROUP_ID) {
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
        <div className="options__header-top">
          <div className="options-tabs">
            <button
              className={clsx("options-tab", activeTab === "services" && "is-active")}
              onClick={() => setActiveTab("services")}>
              {t("optionsTabServices")}
            </button>
            <button
              className={clsx("options-tab", activeTab === "workflows" && "is-active")}
              onClick={() => setActiveTab("workflows")}>
              {t("optionsTabWorkflows")}
            </button>
          </div>
          <div className="options__actions">
            <div className="dropdown" ref={configMenuRef}>
              <button
                className="primary is-compact dropdown-toggle"
                onClick={() => setShowConfigMenu(!showConfigMenu)}
              >
                <Settings size={16} />
                {t("optionsSettings")}
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
            {activeTab === "workflows" ? (
              <button className="primary is-compact" onClick={openCreateWorkflowModal}>
                {t("buttonAddWorkflow")}
              </button>
            ) : (
              <>
                <button className="primary is-compact" onClick={() => openCreateGroupModal()}>
                  {t("buttonAddGroup")}
                </button>
                <button className="primary is-compact" onClick={openCreateServiceModal}>
                  {t("buttonAddService")}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="options__header-main">
          <p>
            {activeTab === "workflows"
              ? t("optionsWorkflowSubtitle")
              : t("optionsServicesGroupsSubtitle")}
          </p>
        </div>
      </header>

      {activeTab === "workflows" ? (
        <section className="workflow-section">
          <div className="workflow-list">
            {orderedWorkflows.length === 0 ? (
              <div className="workflow-list__empty">{t("optionsWorkflowEmpty")}</div>
            ) : (
              orderedWorkflows.map((workflow, index) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                services={workflow.serviceIds
                  .map((id) => findServiceById(config, id))
                  .filter((service): service is AnalysisService => Boolean(service))}
                onEdit={openEditWorkflowModal}
                onDelete={handleDeleteWorkflow}
                onTogglePin={toggleWorkflowPinned}
                onMoveUp={(workflowId) => moveWorkflow(workflowId, -1)}
                onMoveDown={(workflowId) => moveWorkflow(workflowId, 1)}
                canMoveUp={index > 0}
                  canMoveDown={index < orderedWorkflows.length - 1}
                />
              ))
            )}
          </div>
        </section>
      ) : (
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
                if (groupId === DEFAULT_GROUP_ID) {
                  if (ungroupedServices.length === 0) {
                    return null
                  }
                  return (
                    <DroppableContainer key={DEFAULT_GROUP_ID} id={DEFAULT_GROUP_ID}>
                      <SortableUngrouped
                        groupId={DEFAULT_GROUP_ID}
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
      )}

      <div className="options__stats">
        {t("statsSummary", {
          services: stats.services,
          groups: stats.groups,
          workflows: stats.workflows
        })}
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
          services={config.services}
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

      <footer className="options__footer">
        <div className="options__footer-help">
          <span>{t("helpMaxGroups")}: {MAX_GROUP_COUNT}</span>
          <span>{t("helpMaxWorkflows")}: {MAX_WORKFLOW_COUNT}</span>
          <span>{t("helpMaxServices")}: {MAX_SERVICE_COUNT}</span>
          <span>{t("helpMaxServicesPerGroup")}: {MAX_SERVICES_PER_GROUP_COUNT}</span>
          <span>{t("helpMaxHistoryItems")}: {MAX_HISTORY_ITEMS}</span>
        </div>
      </footer>
    </div>
  )
}

const Modal = ({
  modal,
  groups,
  services,
  onRequestCreateGroup,
  onClose,
  onConfirm
}: {
  modal: ModalState
  groups: ServiceGroup[]
  services: AnalysisService[]
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
        : modal.type === "create-workflow"
          ? modal.initialName
        : modal.type === "edit-workflow"
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
      : DEFAULT_GROUP_ID
  )
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(
    modal.type === "create-workflow" || modal.type === "edit-workflow"
      ? modal.initialMode
      : "both"
  )
  const [workflowPinned, setWorkflowPinned] = useState(
    modal.type === "create-workflow" || modal.type === "edit-workflow"
      ? modal.initialPinned
      : true
  )
  const [workflowOpenStrategy, setWorkflowOpenStrategy] =
    useState<WorkflowOpenStrategy>(
      modal.type === "create-workflow" || modal.type === "edit-workflow"
        ? modal.initialOpenStrategy
        : "foreground-first"
    )
  const [workflowServiceIds, setWorkflowServiceIds] = useState<string[]>(
    modal.type === "create-workflow" || modal.type === "edit-workflow"
      ? modal.initialServiceIds
      : []
  )
  const [workflowSearch, setWorkflowSearch] = useState("")
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
    if (modal.type === "create-workflow" || modal.type === "edit-workflow") {
      setValue(modal.initialName)
      setWorkflowMode(modal.initialMode)
      setWorkflowPinned(modal.initialPinned)
      setWorkflowOpenStrategy(modal.initialOpenStrategy)
      setWorkflowServiceIds(modal.initialServiceIds)
      setWorkflowSearch("")
    }
  }, [modal])

  const selectedWorkflowServices = useMemo(
    () =>
      workflowServiceIds
        .map((serviceId) => services.find((service) => service.id === serviceId))
        .filter((service): service is AnalysisService => Boolean(service)),
    [services, workflowServiceIds]
  )

  const filteredWorkflowServices = useMemo(() => {
    const keyword = workflowSearch.trim().toLowerCase()
    const selectedIds = new Set(workflowServiceIds)

    const availableServices = services.filter((service) => {
      if (selectedIds.has(service.id)) {
        return false
      }

      if (workflowMode === "domain") {
        return service.supportedVariables.domain
      }

      if (workflowMode === "text") {
        return service.supportedVariables.text
      }

      return service.supportedVariables.domain || service.supportedVariables.text
    })

    if (!keyword) {
      return availableServices
    }

    return availableServices.filter((service) =>
      `${service.name} ${service.urlTemplate}`.toLowerCase().includes(keyword)
    )
  }, [services, workflowMode, workflowSearch, workflowServiceIds])

  const workflowSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const toggleWorkflowService = (serviceId: string) => {
    setWorkflowServiceIds((current) => {
      if (current.includes(serviceId)) {
        return current.filter((id) => id !== serviceId)
      }

      return [...current, serviceId]
    })
  }

  const handleWorkflowStepDragEnd = (event: DragEndEvent) => {
    const active = String(event.active.id)
    const over = event.over ? String(event.over.id) : null

    if (!over || active === over || !isWorkflowStepId(active) || !isWorkflowStepId(over)) {
      return
    }

    const activeServiceId = stripPrefix(active, WORKFLOW_STEP_PREFIX)
    const overServiceId = stripPrefix(over, WORKFLOW_STEP_PREFIX)

    setWorkflowServiceIds((current) => {
      const oldIndex = current.indexOf(activeServiceId)
      const newIndex = current.indexOf(overServiceId)

      if (oldIndex === -1 || newIndex === -1) {
        return current
      }

      return arrayMove(current, oldIndex, newIndex)
    })
  }

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
            : modal.type === "create-workflow" || modal.type === "edit-workflow"
              ? modal.onConfirm(
                  value,
                  workflowMode,
                  workflowPinned,
                  workflowOpenStrategy,
                  workflowServiceIds
                )
          : modal.onConfirm(value)
    if (ok) {
      onConfirm()
    }
  }

  const isWorkflowModal =
    modal.type === "create-workflow" || modal.type === "edit-workflow"

  return (
    <div className="modal-backdrop">
      <div
        className={clsx(
          "modal",
          isWorkflowModal && ["modal--wide", "modal--workflow"]
        )}>
        <div className="modal__title">{modal.title}</div>
        <div className={clsx("modal__body", isWorkflowModal && "modal__body--workflow")}>
          {modal.type === "confirm" ? (
            <p>{modal.message}</p>
          ) : modal.type === "edit-service" || modal.type === "create-service" ? (
            <>
              <div className="modal__field">
                <FieldLabel
                  label={t("labelServiceName")}
                  help={t("helpServiceName")}
                />
                <input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={t("placeholderServiceName")}
                />
              </div>
              <div className="modal__field">
                <FieldLabel
                  label={t("labelServiceUrl")}
                  help={t("helpServiceUrl")}
                />
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={t("placeholderUrlTemplate")}
                />
              </div>
              <div className="modal__field">
                <FieldLabel
                  label={t("labelServiceGroup")}
                  help={t("helpServiceGroup")}
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
                  <option value={DEFAULT_GROUP_ID}>{t("optionDefaultGroup")}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.icon} {group.name}
                    </option>
                  ))}
                  <option value={NEW_GROUP_ID}>{t("optionNewGroup")}</option>
                </select>
              </div>
            </>
          ) : modal.type === "create-group" ? (
            <>
              <div className="modal__hint">
                {t("hintGroupServiceResponse")}
              </div>
              <div className="modal__field">
                <FieldLabel
                  label={t("labelGroupName")}
                  help={t("helpGroupName")}
                />
                <input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  maxLength={MAX_GROUP_NAME_LENGTH}
                  placeholder={t("placeholderGroupName")}
                />
              </div>
              <div className="modal__field">
                <FieldLabel
                  label={t("labelGroupIcon")}
                  help={t("helpGroupIcon")}
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
              </div>
            </>
          ) : modal.type === "create-workflow" || modal.type === "edit-workflow" ? (
            <>
              <div className="modal__hint">{t("hintWorkflowServices")}</div>
              <div className="modal__field-grid modal__field-grid--workflow">
                <div className="modal__field">
                  <FieldLabel
                    label={t("labelWorkflowName")}
                    help={t("helpWorkflowName")}
                  />
                  <input
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={t("placeholderWorkflowName")}
                  />
                </div>
                <div className="modal__field">
                  <FieldLabel
                    label={t("labelWorkflowMode")}
                    help={t("helpWorkflowMode")}
                  />
                  <select
                    className="modal__select"
                    value={workflowMode}
                    onChange={(event) => setWorkflowMode(event.target.value as WorkflowMode)}>
                    <option value="both">{t("optionWorkflowModeBoth")}</option>
                    <option value="domain">{t("optionWorkflowModeDomain")}</option>
                    <option value="text">{t("optionWorkflowModeText")}</option>
                  </select>
                </div>
                <div className="modal__field">
                  <FieldLabel
                    label={t("labelWorkflowOpenStrategy")}
                    help={t("helpWorkflowOpenStrategy")}
                  />
                  <select
                    className="modal__select"
                    value={workflowOpenStrategy}
                    onChange={(event) =>
                      setWorkflowOpenStrategy(event.target.value as WorkflowOpenStrategy)
                    }>
                    <option value="foreground-first">
                      {t("optionWorkflowOpenForegroundFirst")}
                    </option>
                    <option value="background-all">
                      {t("optionWorkflowOpenBackgroundAll")}
                    </option>
                  </select>
                </div>
              </div>
              <div className="modal__field workflow-editor__panel">
                <FieldLabel
                  label={t("workflowSelectedSteps")}
                  help={t("helpWorkflowSelectedSteps")}
                />
                <div className="workflow-editor__scroll">
                  {selectedWorkflowServices.length > 0 ? (
                    <DndContext
                      sensors={workflowSensors}
                      onDragEnd={handleWorkflowStepDragEnd}>
                      <SortableContext
                        items={selectedWorkflowServices.map((service) =>
                          asWorkflowStepDragId(service.id)
                        )}
                        strategy={verticalListSortingStrategy}>
                        <ol className="workflow-steps-editor">
                          {selectedWorkflowServices.map((service, index) => (
                            <SortableWorkflowStep
                              key={service.id}
                              service={service}
                              index={index}
                              onRemove={toggleWorkflowService}
                            />
                          ))}
                        </ol>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="workflow-steps-empty">{t("workflowNoSteps")}</div>
                  )}
                </div>
              </div>
              <div className="modal__field workflow-editor__panel">
                <FieldLabel
                  label={t("workflowAvailableServices")}
                  help={t("helpWorkflowAvailableServices")}
                />
                <input
                  value={workflowSearch}
                  onChange={(event) => setWorkflowSearch(event.target.value)}
                  placeholder={t("workflowSearchPlaceholder")}
                />
                <div className="workflow-service-library">
                  {filteredWorkflowServices.length > 0 ? (
                    filteredWorkflowServices.map((service) => {
                      return (
                        <div key={service.id} className="workflow-service-library__item">
                          <div className="workflow-service-library__content">
                            <div className="workflow-service-library__name">{service.name}</div>
                            <div
                              className="workflow-service-library__template"
                              title={service.urlTemplate}>
                              {service.urlTemplate}
                            </div>
                          </div>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => toggleWorkflowService(service.id)}>
                            {t("modalButtonAdd")}
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <div className="workflow-steps-empty">
                      {t("workflowNoAvailableServices")}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="modal__field">
              <FieldLabel
                label={t("labelGroupName")}
                help={t("helpGroupName")}
              />
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={MAX_GROUP_NAME_LENGTH}
                placeholder={t("placeholderGroupName")}
              />
            </div>
          )}
        </div>
        <div className="modal__actions">
          <button className="ghost-button" onClick={onClose}>
            {t("modalButtonCancel")}
          </button>
          <button className="primary" onClick={handlePrimary}>
            {modal.type === "confirm"
              ? t("modalButtonConfirm")
              : modal.type === "create-group" ||
                  modal.type === "create-service" ||
                  modal.type === "create-workflow"
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
