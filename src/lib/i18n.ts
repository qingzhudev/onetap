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
    urlTemplateMissingDomain: "URL template must include {domain} or {text}",
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
    buttonExport: "Export",
    buttonImport: "Import",
    exportSuccess: "Config exported successfully",
    exportFailed: "Failed to export config",
    importSuccess: "Config imported successfully",
    importFailed: "Failed to import config",
    buttonImportSamples: "Import Sample Groups & Services",
    buttonAddGroup: "Add Group",
    buttonAddService: "Add Service",
    statsSummary: "{services} services · {groups} groups",
    placeholderServiceName: "Service name",
    placeholderUrlTemplate:
      "URL template (must include {domain} or {text}; replaced with current value)",
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
    popupNoSelection: "No text selected",
    popupModeDomain: "Domain",
    popupModeText: "Text",
    popupModeUnavailable: "{mode} mode is not available",
    popupModeDomainTooltip: "Domain mode",
    popupModeTextTooltip: "Text selection mode",
    popupTextPlaceholder: "Paste text or use selection",
    popupUseSelection: "Use selection",
    popupClearText: "Clear",
    popupLastOperation: "Last used",
    popupReplay: "Replay",
    popupManageGroups: "Manage services",
    sampleGroupSeo: "SEO Analysis",
    sampleGroupTech: "Tech Stack",
    sampleGroupSecurity: "Security Check",
    sampleServiceAhrefs: "Ahrefs Backlink Checker",
    sampleServiceSimilarWeb: "SimilarWeb Traffic",
    sampleServiceBuiltWith: "BuiltWith Tech Stack",
    sampleServiceSecurityHeaders: "SecurityHeaders Scan",
    sampleServiceWhois: "Whois Lookup",
    optionsSettings: "Settings",
    optionsExportDomains: "Export domains (max 1000)",
    optionsExportKeywords: "Export keywords (max 1000)",
    exportDomainsSuccess: "Domains exported successfully",
    exportKeywordsSuccess: "Keywords exported successfully",
    exportDomainsFailed: "Failed to export domains",
    exportKeywordsFailed: "Failed to export keywords",
    exportDomainsEmpty: "No domain history",
    exportKeywordsEmpty: "No keyword history",
    optionsExportJson: "Export JSON",
    optionsImportJson: "Import JSON",
    optionsExportCode: "Export config code",
    optionsImportCode: "Import config code",
    modalImportJsonTitle: "Import JSON config",
    modalImportJsonDesc: "Choose a previously exported JSON config file.",
    modalImportPreview: "Config preview:",
    modalImportTotalServices: "Imported services",
    modalImportTotalGroups: "Imported groups",
    modalImportNewServices: "New services",
    modalImportSkippedServices: "Skipped services",
    modalImportNewGroups: "New groups",
    modalImportSkippedGroups: "Skipped groups",
    modalImportConfirm: "Importing will merge into existing config. Continue?",
    modalExportJsonTitle: "Export config as JSON",
    modalExportJsonDesc: "Your configuration will be exported as a JSON file for backup or sharing.",
    modalExportCodeTitle: "Export config code",
    modalExportCodeDesc: "Your config code:",
    modalExportCodeHint: "Tip: Share this code with teammates or import it on another device.",
    modalImportCodeTitle: "Import config code",
    modalImportCodeDesc: "Paste config code:",
    modalButtonParse: "Parse",
    optionsSamples: "Samples",
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
    urlTemplateMissingDomain: "URL模板必须包含 {domain} 或 {text}",
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
    buttonExport: "导出",
    buttonImport: "导入",
    exportSuccess: "配置导出成功",
    exportFailed: "导出配置失败",
    importSuccess: "配置导入成功",
    importFailed: "导入配置失败",
    buttonImportSamples: "导入示例分组和服务",
    buttonAddGroup: "添加分组",
    buttonAddService: "添加服务",
    statsSummary: "共 {services} 个服务 · {groups} 个分组",
    placeholderServiceName: "服务名称",
    placeholderUrlTemplate: "URL模板（必须含 {domain} 或 {text}，会替换为当前值）",
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
    popupNoSelection: "未选择文本",
    popupModeDomain: "域名",
    popupModeText: "文本",
    popupModeUnavailable: "{mode}模式不可用",
    popupModeDomainTooltip: "域名模式",
    popupModeTextTooltip: "文本选择模式",
    popupTextPlaceholder: "粘贴文本或使用选中内容",
    popupUseSelection: "使用选中",
    popupClearText: "清空",
    popupLastOperation: "上次使用",
    popupReplay: "重放",
    popupManageGroups: "管理服务",
    sampleGroupSeo: "SEO分析",
    sampleGroupTech: "技术工具",
    sampleGroupSecurity: "安全检查",
    sampleServiceAhrefs: "Ahrefs外链分析",
    sampleServiceSimilarWeb: "SimilarWeb流量",
    sampleServiceBuiltWith: "BuiltWith技术栈",
    sampleServiceSecurityHeaders: "SecurityHeaders安全",
    sampleServiceWhois: "Whois信息查询",
    optionsSettings: "设置",
    optionsExportDomains: "导出域名（最多1000条）",
    optionsExportKeywords: "导出关键词（最多1000条）",
    exportDomainsSuccess: "域名导出成功",
    exportKeywordsSuccess: "关键词导出成功",
    exportDomainsFailed: "导出域名失败",
    exportKeywordsFailed: "导出关键词失败",
    exportDomainsEmpty: "暂无域名历史",
    exportKeywordsEmpty: "暂无关键词历史",
    modalImportJsonTitle: "导入 JSON 配置",
    modalImportJsonDesc: "选择之前导出的 JSON 配置文件。",
    modalImportPreview: "配置预览：",
    modalImportTotalServices: "导入服务数量",
    modalImportTotalGroups: "导入分组数量",
    modalImportNewServices: "新增服务数量",
    modalImportSkippedServices: "跳过服务数量",
    modalImportNewGroups: "新增分组数量",
    modalImportSkippedGroups: "跳过分组数量",
    modalImportConfirm: "导入将合并到现有配置，确定要继续吗？",
    modalExportJsonTitle: "导出配置为 JSON",
    modalExportJsonDesc: "您的配置将导出为 JSON 文件，可用于备份或共享。",
    modalExportCodeTitle: "导出配置码",
    modalExportCodeDesc: "您的配置码：",
    modalExportCodeHint: "提示：您可以分享此配置码给团队成员或在其他设备上导入。",
    modalImportCodeTitle: "导入配置码",
    modalImportCodeDesc: "粘贴配置码：",
    modalButtonParse: "解析",
    optionsExportJson: "导出为 JSON",
    optionsImportJson: "导入 JSON",
    optionsExportCode: "导出配置码",
    optionsImportCode: "导入配置码"
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
