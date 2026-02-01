export type Locale = "en" | "zh"

type MessageValue = string | ((params?: Record<string, string | number>) => string)

type Messages = Record<string, MessageValue>

type Dictionaries = Record<Locale, Messages>

const dictionaries: Dictionaries = {
  en: {
    defaultGroupName: "Default Group",
    defaultGroupEmpty: "No services in the default group",
    groupEmpty: "(Empty)",
    groupRename: "Rename",
    groupDelete: "Delete",
    serviceEdit: "Edit",
    serviceRemove: "Remove",
    serviceDelete: "Delete",
    maxGroupsReached: "Maximum groups reached",
    maxServicesReached: "Maximum services reached",
    groupNameRequired: "Group name is required",
    serviceNameRequired: "Service name is required",
    urlTemplateMissingDomain: "URL template must include {domain}",
    groupServiceLimitReached: "This group has reached the service limit",
    targetGroupServiceLimitReached: "Target group has reached the service limit",
    serviceAlreadyDefault: "This service is already in the default group",
    sampleExists: "Sample groups and services already exist",
    importedSamples: "Imported {groups} groups and {services} services",
    modalTitleAddGroup: "Add Group",
    modalTitleAddService: "Add Service",
    modalTitleEditService: "Edit Service",
    modalTitleRenameGroup: "Rename Group",
    modalTitleDeleteGroup: "Delete Group",
    modalTitleDeleteService: "Delete Service",
    confirmDeleteGroup: "Delete group \"{name}\"?",
    confirmDeleteService: "Delete service \"{name}\"?",
    headerTitle: "Group Manager",
    headerSubtitle: "Drag groups or services to reorder",
    buttonImportSamples: "Import Sample Groups & Services",
    buttonAddGroup: "Add Group",
    buttonAddService: "Add Service",
    statsSummary: "{services} services · {groups} groups",
    placeholderServiceName: "Service name",
    placeholderUrlTemplate: "URL template (must include {domain}; replaced with current domain)",
    optionDefaultGroup: "Default Group",
    optionNewGroup: "➕ New group",
    hintGroupServiceResponse: "Services in the same group can respond together.",
    placeholderGroupName: "Group name",
    modalButtonCancel: "Cancel",
    modalButtonConfirm: "Confirm",
    modalButtonAdd: "Add",
    modalButtonSave: "Save",
    dragOverlayDefaultGroup: "📦 Default Group",
    popupDomainUnavailable: "Unable to get domain",
    popupServiceUrlError: "Service URL error",
    popupGroupEmpty: "Group is empty",
    popupManageGroups: "⚙️ Manage services",
    sampleGroupSeo: "SEO Analysis",
    sampleGroupTech: "Tech Stack",
    sampleGroupSecurity: "Security Check",
    sampleServiceAhrefs: "Ahrefs Backlink Checker",
    sampleServiceSimilarWeb: "SimilarWeb Traffic",
    sampleServiceBuiltWith: "BuiltWith Tech Stack",
    sampleServiceSecurityHeaders: "SecurityHeaders Scan",
    sampleServiceWhois: "Whois Lookup"
  },
  zh: {
    defaultGroupName: "默认分组",
    defaultGroupEmpty: "暂无默认分组服务",
    groupEmpty: "（空）",
    groupRename: "重命名",
    groupDelete: "删除",
    serviceEdit: "编辑",
    serviceRemove: "移出",
    serviceDelete: "删除",
    maxGroupsReached: "已达到最大分组数量",
    maxServicesReached: "已达到最大服务数量",
    groupNameRequired: "请输入分组名称",
    serviceNameRequired: "请输入服务名称",
    urlTemplateMissingDomain: "URL模板必须包含 {domain}",
    groupServiceLimitReached: "该分组服务数量已达上限",
    targetGroupServiceLimitReached: "目标分组服务数量已达上限",
    serviceAlreadyDefault: "该服务已在默认分组",
    sampleExists: "示例分组和服务已存在",
    importedSamples: "已导入示例 {groups} 个分组、{services} 个服务",
    modalTitleAddGroup: "添加分组",
    modalTitleAddService: "添加服务",
    modalTitleEditService: "编辑服务",
    modalTitleRenameGroup: "重命名分组",
    modalTitleDeleteGroup: "删除分组",
    modalTitleDeleteService: "删除服务",
    confirmDeleteGroup: "确认删除分组 \"{name}\"？",
    confirmDeleteService: "确认删除服务 \"{name}\"？",
    headerTitle: "分组管理",
    headerSubtitle: "拖拽分组或服务可调整顺序",
    buttonImportSamples: "导入示例分组和服务",
    buttonAddGroup: "添加分组",
    buttonAddService: "添加服务",
    statsSummary: "共 {services} 个服务 · {groups} 个分组",
    placeholderServiceName: "服务名称",
    placeholderUrlTemplate: "URL模板（必须含 {domain}，会替换为当前域名）",
    optionDefaultGroup: "默认分组",
    optionNewGroup: "➕ 新增分组",
    hintGroupServiceResponse: "同一个分组内的服务可一键同时响应。",
    placeholderGroupName: "输入分组名称",
    modalButtonCancel: "取消",
    modalButtonConfirm: "确认",
    modalButtonAdd: "添加",
    modalButtonSave: "保存",
    dragOverlayDefaultGroup: "📦 默认分组",
    popupDomainUnavailable: "无法获取域名",
    popupServiceUrlError: "服务URL错误",
    popupGroupEmpty: "分组为空",
    popupManageGroups: "⚙️ 管理服务",
    sampleGroupSeo: "SEO分析",
    sampleGroupTech: "技术工具",
    sampleGroupSecurity: "安全检查",
    sampleServiceAhrefs: "Ahrefs外链分析",
    sampleServiceSimilarWeb: "SimilarWeb流量",
    sampleServiceBuiltWith: "BuiltWith技术栈",
    sampleServiceSecurityHeaders: "SecurityHeaders安全",
    sampleServiceWhois: "Whois信息查询"
  }
}

const FALLBACK_LOCALE: Locale = "en"

const resolveLocale = (): Locale => {
  const raw =
    (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : null) ||
    (typeof navigator !== "undefined" ? navigator.language : null) ||
    FALLBACK_LOCALE

  const normalized = raw.toLowerCase()
  if (normalized.startsWith("zh")) {
    return "zh"
  }
  return "en"
}

const format = (template: string, params?: Record<string, string | number>) => {
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key])
    }
    return match
  })
}

type MessageKey = keyof typeof dictionaries.en

export const t = (key: MessageKey, params?: Record<string, string | number>) => {
  const locale = resolveLocale()
  const message = dictionaries[locale][key] ?? dictionaries[FALLBACK_LOCALE][key]

  if (!message) {
    return key
  }

  if (typeof message === "function") {
    return message(params)
  }

  return format(message, params)
}
