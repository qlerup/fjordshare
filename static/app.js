(function () {
  "use strict";

  document.body.classList.add("app-mode");

  const boot = document.getElementById("bootstrap");
  const DEFAULT_SLICE_NOZZLE_DIAMETER = "";
  const DEFAULT_SLICE_NOZZLE_FLOW = "";
  const SLICE_ACTIONS_DISABLED = String((boot && boot.dataset.slicingDisabled) || "0").trim() === "1";
  const SLICE_DISABLED_TITLE = "Slicing er midlertidigt slået fra";
  const SMS_ONBOARDING_LOGIN_PROMPT_ENABLED = false;
  const APP_ONBOARDING_FALLBACK_STEP_MS = 5000;
  const APP_ONBOARDING_STEP_BUFFER_MS = 450;
  const UNSEEN_UPLOADS_OVERLAY_EXPANDED_STORAGE_KEY = "fjordshare.unseenUploadsOverlayExpanded.v1";

  function readPersistedUnseenUploadsOverlayExpanded() {
    try {
      return window.localStorage.getItem(UNSEEN_UPLOADS_OVERLAY_EXPANDED_STORAGE_KEY) === "1";
    } catch (_err) {
      return false;
    }
  }

  function persistUnseenUploadsOverlayExpanded(expanded) {
    try {
      window.localStorage.setItem(UNSEEN_UPLOADS_OVERLAY_EXPANDED_STORAGE_KEY, expanded ? "1" : "0");
    } catch (_err) {
      // Ignore storage access errors (e.g. privacy mode restrictions).
    }
  }

  const state = {
    username: (boot && boot.dataset.username) || "",
    role: ((boot && boot.dataset.role) || "user").toLowerCase(),
    homeFolder: (boot && boot.dataset.homeFolder) || "",
    dailyFolder: (boot && boot.dataset.dailyFolder) || "",
    currentFolder: "",
    folders: [],
    files: [],
    zipJobs: [],
    shares: [],
    printReadyProjects: [],
    finishedProjects: [],
    rejectedFileTypes: [],
    tracking: [],
    users: [],
    signupRequests: [],
    signupLinks: [],
    adminLogs: [],
    editingUserId: 0,
    pendingMetadata: [],
    metadataIndex: 0,
    metadataMode: "upload",
    metadataProjectId: 0,
    metadataContinueProject: null,
    threeModules: null,
    three: null,
    thumbPollTimer: null,
    currentTab: "files",
    currentSettingsTab: "shares",
    currentInfoFileId: 0,
    currentFileAttachments: [],
    currentSliceFileId: 0,
    sliceProfiles: null,
    slicerSettings: null,
    sliceActiveTool: "view",
    sliceRotation: { x: 0, y: 0, z: 0 },
    sliceProcessSettingsBase: {},
    sliceProcessSettingsBaseApi: {},
    sliceProcessSettingsProfileKey: "",
    sliceProcessSettingsActiveTab: "quality",
    sliceProcessSettingsOptions: {},
    sliceProcessSettingsOverrides: {},
    sliceProcessSettingsLoadToken: 0,
    sliceNozzlePickResolver: null,
    currentSlicerUploadKind: "",
    currentSlicerUploadFiles: [],
    slicerBedMapHiddenNames: new Set(),
    currentSlicerBedMapEditName: "",
    lastSliceSelection: {
      printer_profile: "",
      print_profile: "",
      filament_profile: "",
      support_mode: "auto",
      support_type: "",
      support_style: "",
      nozzle_left_diameter: DEFAULT_SLICE_NOZZLE_DIAMETER,
      nozzle_right_diameter: DEFAULT_SLICE_NOZZLE_DIAMETER,
      nozzle_left_flow: DEFAULT_SLICE_NOZZLE_FLOW,
      nozzle_right_flow: DEFAULT_SLICE_NOZZLE_FLOW,
      print_nozzle: "",
      rotation_x_degrees: 0,
      rotation_y_degrees: 0,
      rotation_z_degrees: 0,
      lift_z_mm: 0,
      process_overrides: {},
    },
    sliceStatusWasPending: false,
    sliceStatusHoldUntil: 0,
    sliceStatusHideTimer: null,
    sliceStatusFadePulse: 0,
    topStatusFadeTimer: null,
    thumbTopStatusCancelling: false,
    slicePreview: null,
    slicePreviewLoadToken: 0,
    slicePlateAssets: null,
    slicePlateLoadToken: 0,
    infoDrawerHideTimer: null,
    selectMode: false,
    selectPurpose: "",
    selectedFolderPaths: new Set(),
    selectedFileIds: new Set(),
    excludedFolderPaths: new Set(),
    excludedFileIds: new Set(),
    folderPreviewCache: Object.create(null),
    folderPreviewLoading: new Set(),
    folderPreviewRequestToken: 0,
    folderUnseenCounts: Object.create(null),
    fileSeenInFlight: new Set(),
    unseenUploadsTotal: 0,
    unseenUploads: [],
    unseenUploadsExpanded: readPersistedUnseenUploadsOverlayExpanded(),
    unseenUploadsRequestToken: 0,
    newUploadsDwellTimer: null,
    modelPreviewLoadToken: 0,
    modelModalCloseGuardUntil: 0,
    currentPrintReadyProjectId: 0,
    currentPrintReadyProject: null,
    printReadyNameResolver: null,
    smsConfirmResolver: null,
    smsConfirmContext: "",
    smsConfirmTargetUsername: "",
    smsOnboardingCountdownTimer: null,
    smsOnboardingExpiresAt: 0,
    smsGatewayTokenConfigured: false,
    smsGatewayTokenPreview: "",
    smsGatewayTokenPreviewActive: false,
    makerworldEncryptionActive: false,
    makerworldPasswordConfigured: false,
    makerworldPasswordPreview: "",
    makerworldPasswordPreviewActive: false,
    makerworldLoginFlowUrl: "",
    appOnboardingSeenPersisted: false,
    appOnboardingEnabled: true,
    appOnboardingPanelKey: "navigation",
    appOnboardingMode: "normal",
    appOnboardingBusy: false,
    appOnboardingStepComplete: false,
    appOnboardingStepTimer: null,
    appOnboardingStepCountdownTimer: null,
    appOnboardingStepEndsAt: 0,
    appOnboardingStepDurationMs: 0,
    appOnboardingCountdownLastSeconds: null,
    appOnboardingButtonCountdownSeconds: null,
    appOnboardingStepToken: 0,
    appOnboardingDurationCache: Object.create(null),
    importLinkPreview: null,
    importLinkSelectedProfileId: "",
    importLinkSelectedProfileIds: [],
    importLinkSelectedImageUrl: "",
    trackingExpandedIds: new Set(),
    trackingAssignTrackingId: 0,
  };

  const els = {
    contentHeader: document.getElementById("contentHeader"),
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    statFiles: document.getElementById("statFiles"),
    statFolders: document.getElementById("statFolders"),
    statShares: document.getElementById("statShares"),
    sidebarNav: document.getElementById("sidebarNav"),
    printReadyNavBadge: document.getElementById("printReadyNavBadge"),
    profileFooterBtn: document.getElementById("profileFooterBtn"),
    sidebarUsername: document.querySelector(".sidebar-user strong"),
    mobileBottomNav: document.getElementById("mobileBottomNav"),
    mobileSidebarBackdrop: document.getElementById("mobileSidebarBackdrop"),
    tabFiles: document.getElementById("tab-files"),
    tabPrintReady: document.getElementById("tab-print-ready"),
    tabFinishedProjects: document.getElementById("tab-finished-projects"),
    tabRejectedFileTypes: document.getElementById("tab-rejected-file-types"),
    tabSettings: document.getElementById("tab-settings"),
    tabTracking: document.getElementById("tab-tracking"),
    profileModal: document.getElementById("profileModal"),
    profilePasswordForm: document.getElementById("profilePasswordForm"),
    profileModalCancelBtn: document.getElementById("profileModalCancelBtn"),
    profileSmsEnabledChk: document.getElementById("profileSmsEnabledChk"),
    profileSmsCountrySelect: document.getElementById("profileSmsCountrySelect"),
    profileSmsPhoneInput: document.getElementById("profileSmsPhoneInput"),
    profileSmsE164Preview: document.getElementById("profileSmsE164Preview"),
    profileSmsSaveBtn: document.getElementById("profileSmsSaveBtn"),
    profileSmsStatus: document.getElementById("profileSmsStatus"),
    profileCurrentPwdInput: document.getElementById("profileCurrentPwdInput"),
    profileNewPwdInput: document.getElementById("profileNewPwdInput"),
    profileSaveBtn: document.getElementById("profileSaveBtn"),
    profilePwdStatus: document.getElementById("profilePwdStatus"),
    profileGuideEnabledChk: document.getElementById("profileGuideEnabledChk"),
    profileShowGuideBtn: document.getElementById("profileShowGuideBtn"),
    profileGuideStatus: document.getElementById("profileGuideStatus"),
    settingsTabs: document.getElementById("settingsTabs"),
    settingsTabSelect: document.getElementById("settingsTabSelect"),
    settingsPanelShares: document.getElementById("settings-panel-shares"),
    settingsPanelDns: document.getElementById("settings-panel-dns"),
    settingsPanelUsers: document.getElementById("settings-panel-users"),
    settingsPanelMakerworld: document.getElementById("settings-panel-makerworld"),
    settingsPanelSms: document.getElementById("settings-panel-sms"),
    settingsPanelLogs: document.getElementById("settings-panel-logs"),
    settingsPanelSlicer: document.getElementById("settings-panel-slicer"),
    adminOnly: Array.from(document.querySelectorAll(".admin-only")),
    folderSelect: document.getElementById("folderSelect"),
    refreshFilesBtn: document.getElementById("refreshFilesBtn"),
    uploadBtn: document.getElementById("uploadBtn"),
    mapperImportLinkBtn: document.getElementById("mapperImportLinkBtn"),
    mapperDesktopUploadBtn: document.getElementById("mapperDesktopUploadBtn"),
    fileInput: document.getElementById("fileInput"),
    newFolderInput: document.getElementById("newFolderInput"),
    createFolderBtn: document.getElementById("createFolderBtn"),
    uploadStatus: document.getElementById("uploadStatus"),
    uploadOverlay: document.getElementById("uploadOverlay"),
    uploadProgressBar: document.getElementById("uploadProgressBar"),
    uploadProgressText: document.getElementById("uploadProgressText"),
    uploadMonitor: document.getElementById("uploadMonitor"),
    uploadMonitorToggle: document.getElementById("uploadMonitorToggle"),
    uploadMonitorStop: document.getElementById("uploadMonitorStop"),
    uploadMonitorBar: document.getElementById("uploadMonitorBar"),
    uploadMonitorSummary: document.getElementById("uploadMonitorSummary"),
    uploadMonitorCurrent: document.getElementById("uploadMonitorCurrent"),
    uploadMonitorList: document.getElementById("uploadMonitorList"),
    newUploadsOverlay: document.getElementById("newUploadsOverlay"),
    newUploadsOverlayToggle: document.getElementById("newUploadsOverlayToggle"),
    newUploadsOverlayCount: document.getElementById("newUploadsOverlayCount"),
    newUploadsOverlayLabel: document.getElementById("newUploadsOverlayLabel"),
    newUploadsOverlayChevron: document.getElementById("newUploadsOverlayChevron"),
    newUploadsOverlayBody: document.getElementById("newUploadsOverlayBody"),
    newUploadsOverlayMeta: document.getElementById("newUploadsOverlayMeta"),
    newUploadsOverlayList: document.getElementById("newUploadsOverlayList"),
    folderList: document.getElementById("folderList"),
    fileGrid: document.getElementById("fileGrid"),
    folderUpBtn: document.getElementById("folderUpBtn"),
    mapperDropZone: document.getElementById("mapperDropZone"),
    thumbTopStatus: document.getElementById("thumbTopStatus"),
    thumbTopStatusLabel: document.getElementById("thumbTopStatusLabel"),
    thumbTopStatusBar: document.getElementById("thumbTopStatusBar"),
    thumbTopStatusCancelBtn: document.getElementById("thumbTopStatusCancelBtn"),
    mapperSearchBtn: document.getElementById("mapperSearchBtn"),
    mapperMenuBtn: document.getElementById("mapperMenuBtn"),
    mapperMenu: document.getElementById("mapperMenu"),
    mapperShell: document.getElementById("mapperShell"),
    mapperMenuSelect: document.getElementById("mapperMenuSelect"),
    mapperMenuShare: document.getElementById("mapperMenuShare"),
    mapperMenuUpload: document.getElementById("mapperMenuUpload"),
    mapperMenuCreateFolder: document.getElementById("mapperMenuCreateFolder"),
    mapperMenuRenameFolder: document.getElementById("mapperMenuRenameFolder"),
    mapperSelectSummary: document.getElementById("mapperSelectSummary"),
    mapperSelectPrintReadyBtn: document.getElementById("mapperSelectPrintReadyBtn"),
    mapperSelectClearBtn: document.getElementById("mapperSelectClearBtn"),
    mapperSelectDeleteBtn: document.getElementById("mapperSelectDeleteBtn"),
    mapperSelectPrintedBtn: document.getElementById("mapperSelectPrintedBtn"),
    mapperSelectExitBtn: document.getElementById("mapperSelectExitBtn"),
    fileInfoBackdrop: document.getElementById("fileInfoBackdrop"),
    fileInfoDrawer: document.getElementById("fileInfoDrawer"),
    closeFileInfoBtn: document.getElementById("closeFileInfoBtn"),
    fileInfoPreview: document.getElementById("fileInfoPreview"),
    fileInfoName: document.getElementById("fileInfoName"),
    fileInfoMeta: document.getElementById("fileInfoMeta"),
    fileInfoFolder: document.getElementById("fileInfoFolder"),
    fileInfoExt: document.getElementById("fileInfoExt"),
    fileInfoSize: document.getElementById("fileInfoSize"),
    fileInfoUploadedAt: document.getElementById("fileInfoUploadedAt"),
    fileInfoUploadedBy: document.getElementById("fileInfoUploadedBy"),
    fileInfoRowPrintTimeTotal: document.getElementById("fileInfoRowPrintTimeTotal"),
    fileInfoPrintTimeTotal: document.getElementById("fileInfoPrintTimeTotal"),
    fileInfoRowFilamentGrams: document.getElementById("fileInfoRowFilamentGrams"),
    fileInfoFilamentGrams: document.getElementById("fileInfoFilamentGrams"),
    fileInfoRowFilamentCost: document.getElementById("fileInfoRowFilamentCost"),
    fileInfoFilamentCost: document.getElementById("fileInfoFilamentCost"),
    fileInfoNote: document.getElementById("fileInfoNote"),
    fileInfoAttachUploadBtn: document.getElementById("fileInfoAttachUploadBtn"),
    fileInfoAttachInput: document.getElementById("fileInfoAttachInput"),
    fileInfoAttachDropZone: document.getElementById("fileInfoAttachDropZone"),
    fileInfoAttachStatus: document.getElementById("fileInfoAttachStatus"),
    fileInfoAttachList: document.getElementById("fileInfoAttachList"),
    fileInfoSaveBtn: document.getElementById("fileInfoSaveBtn"),
    fileInfoDownloadLink: document.getElementById("fileInfoDownloadLink"),
    fileInfoSliceDownloadLink: document.getElementById("fileInfoSliceDownloadLink"),
    fileInfoSliceBtn: document.getElementById("fileInfoSliceBtn"),
    fileInfoFastSliceBtn: document.getElementById("fileInfoFastSliceBtn"),
    fileInfoOpen3DBtn: document.getElementById("fileInfoOpen3DBtn"),
    sliceModal: document.getElementById("sliceModal"),
    sliceModalCloseBtn: document.getElementById("sliceModalCloseBtn"),
    sliceModalCancelBtn: document.getElementById("sliceModalCancelBtn"),
    sliceModalStartBtn: document.getElementById("sliceModalStartBtn"),
    sliceNozzlePickModal: document.getElementById("sliceNozzlePickModal"),
    sliceNozzlePickCloseBtn: document.getElementById("sliceNozzlePickCloseBtn"),
    sliceNozzlePickCancelBtn: document.getElementById("sliceNozzlePickCancelBtn"),
    sliceNozzlePickLeftBtn: document.getElementById("sliceNozzlePickLeftBtn"),
    sliceNozzlePickRightBtn: document.getElementById("sliceNozzlePickRightBtn"),
    sliceModalFileName: document.getElementById("sliceModalFileName"),
    sliceModalStatus: document.getElementById("sliceModalStatus"),
    slicePrinterSelect: document.getElementById("slicePrinterSelect"),
    sliceKnownPrinterSelect: document.getElementById("sliceKnownPrinterSelect"),
    sliceBedWidthInput: document.getElementById("sliceBedWidthInput"),
    sliceBedDepthInput: document.getElementById("sliceBedDepthInput"),
    slicePrintProfileSelect: document.getElementById("slicePrintProfileSelect"),
    sliceFilamentProfileSelect: document.getElementById("sliceFilamentProfileSelect"),
    slicePreviewCanvas: document.getElementById("slicePreviewCanvas"),
    slicePreviewBed: document.getElementById("slicePreviewBed"),
    slicePreviewFootprint: document.getElementById("slicePreviewFootprint"),
    slicePreviewHeight: document.getElementById("slicePreviewHeight"),
    sliceToolViewBtn: document.getElementById("sliceToolViewBtn"),
    sliceToolRotateBtn: document.getElementById("sliceToolRotateBtn"),
    sliceRotateQuickPanel: document.getElementById("sliceRotateQuickPanel"),
    sliceStageToolHint: document.getElementById("sliceStageToolHint"),
    sliceToolResetRotationBtn: document.getElementById("sliceToolResetRotationBtn"),
    sliceRotateXInput: document.getElementById("sliceRotateXInput"),
    sliceRotateXValue: document.getElementById("sliceRotateXValue"),
    sliceRotateYInput: document.getElementById("sliceRotateYInput"),
    sliceRotateYValue: document.getElementById("sliceRotateYValue"),
    sliceRotateZInput: document.getElementById("sliceRotateZInput"),
    sliceRotateZValue: document.getElementById("sliceRotateZValue"),
    sliceLiftZRange: document.getElementById("sliceLiftZRange"),
    sliceLiftZValue: document.getElementById("sliceLiftZValue"),
    sliceLiftZMinusBtn: document.getElementById("sliceLiftZMinusBtn"),
    sliceLiftZPlusBtn: document.getElementById("sliceLiftZPlusBtn"),
    sliceSupportModeSelect: document.getElementById("sliceSupportModeSelect"),
    sliceSupportTypeSelect: document.getElementById("sliceSupportTypeSelect"),
    sliceSupportStyleSelect: document.getElementById("sliceSupportStyleSelect"),
    sliceNozzleLeftDiameterSelect: document.getElementById("sliceNozzleLeftDiameterSelect"),
    sliceNozzleRightDiameterSelect: document.getElementById("sliceNozzleRightDiameterSelect"),
    sliceNozzleLeftFlowSelect: document.getElementById("sliceNozzleLeftFlowSelect"),
    sliceNozzleRightFlowSelect: document.getElementById("sliceNozzleRightFlowSelect"),
    sliceProcessProfileSelect: document.getElementById("sliceProcessProfileSelect"),
    sliceProcessTabBar: document.getElementById("sliceProcessTabBar"),
    sliceProcessSupportQuickPanel: document.getElementById("sliceProcessSupportQuickPanel"),
    sliceProcessSettingsSearchInput: document.getElementById("sliceProcessSettingsSearchInput"),
    sliceProcessSettingsResetBtn: document.getElementById("sliceProcessSettingsResetBtn"),
    sliceProcessSettingsMeta: document.getElementById("sliceProcessSettingsMeta"),
    sliceProcessSettingsList: document.getElementById("sliceProcessSettingsList"),
    sliceProcessSettingsStatus: document.getElementById("sliceProcessSettingsStatus"),
    metadataModal: document.getElementById("metadataModal"),
    metadataModalTitle: document.getElementById("metadataModalTitle"),
    metadataModalHint: document.getElementById("metadataModalHint"),
    metadataStepCounter: document.getElementById("metadataStepCounter"),
    metadataCurrentFileName: document.getElementById("metadataCurrentFileName"),
    metadataNoteInput: document.getElementById("metadataNoteInput"),
    metadataQtyInput: document.getElementById("metadataQtyInput"),
    metadataScaleUpEnabled: document.getElementById("metadataScaleUpEnabled"),
    metadataScaleUpControls: document.getElementById("metadataScaleUpControls"),
    metadataScaleUpValue: document.getElementById("metadataScaleUpValue"),
    metadataScaleUpUnit: document.getElementById("metadataScaleUpUnit"),
    metadataAttachUploadBtn: document.getElementById("metadataAttachUploadBtn"),
    metadataAttachInput: document.getElementById("metadataAttachInput"),
    metadataAttachDropZone: document.getElementById("metadataAttachDropZone"),
    metadataAttachStatus: document.getElementById("metadataAttachStatus"),
    metadataAttachList: document.getElementById("metadataAttachList"),
    metadataCancelBtn: document.getElementById("metadataCancelBtn"),
    metadataPrevBtn: document.getElementById("metadataPrevBtn"),
    metadataNextBtn: document.getElementById("metadataNextBtn"),
    metadataSaveBtn: document.getElementById("metadataSaveBtn"),
    imagePreviewModal: document.getElementById("imagePreviewModal"),
    imagePreviewTitle: document.getElementById("imagePreviewTitle"),
    imagePreviewImg: document.getElementById("imagePreviewImg"),
    closeImagePreviewBtn: document.getElementById("closeImagePreviewBtn"),
    modelModal: document.getElementById("modelModal"),
    modelTitle: document.getElementById("modelTitle"),
    closeModelModalBtn: document.getElementById("closeModelModalBtn"),
    modelViewerPane: document.getElementById("modelViewerPane"),
    modelViewer: document.getElementById("modelViewer"),
    threePane: document.getElementById("threePane"),
    threeCanvas: document.getElementById("threeCanvas"),
    modelInfoBar: document.getElementById("modelInfoBar"),
    modelControlHint: document.getElementById("modelControlHint"),
    modelHeightHint: document.getElementById("modelHeightHint"),
    modelScaleHint: document.getElementById("modelScaleHint"),
    modelHint: document.getElementById("modelHint"),
    shareModal: document.getElementById("shareModal"),
    shareModalCloseBtn: document.getElementById("shareModalCloseBtn"),
    shareModalCancelBtn: document.getElementById("shareModalCancelBtn"),
    shareModalSelected: document.getElementById("shareModalSelected"),
    shareNameInput: document.getElementById("shareNameInput"),
    shareFoldersSelect: document.getElementById("shareFoldersSelect"),
    sharePermissionSelect: document.getElementById("sharePermissionSelect"),
    shareExpireValue: document.getElementById("shareExpireValue"),
    shareExpireUnit: document.getElementById("shareExpireUnit"),
    shareUseExternalChk: document.getElementById("shareUseExternalChk"),
    shareRequireVisitorChk: document.getElementById("shareRequireVisitorChk"),
    shareUsePasswordChk: document.getElementById("shareUsePasswordChk"),
    sharePasswordWrap: document.getElementById("sharePasswordWrap"),
    sharePasswordInput: document.getElementById("sharePasswordInput"),
    createShareBtn: document.getElementById("createShareBtn"),
    shareCreateStatus: document.getElementById("shareCreateStatus"),
    shareResultWrap: document.getElementById("shareResultWrap"),
    shareResultLink: document.getElementById("shareResultLink"),
    copyShareLinkBtn: document.getElementById("copyShareLinkBtn"),
    printReadyModal: document.getElementById("printReadyModal"),
    printReadyModalCloseBtn: document.getElementById("printReadyModalCloseBtn"),
    printReadyModalSummary: document.getElementById("printReadyModalSummary"),
    printReadyModalFiles: document.getElementById("printReadyModalFiles"),
    printReadySendBtn: document.getElementById("printReadySendBtn"),
    printReadyZipLink: document.getElementById("printReadyZipLink"),
    printReadyPdfLink: document.getElementById("printReadyPdfLink"),
    printReadyModalStatus: document.getElementById("printReadyModalStatus"),
    printReadyNameModal: document.getElementById("printReadyNameModal"),
    printReadyNameInput: document.getElementById("printReadyNameInput"),
    printReadyNameStatus: document.getElementById("printReadyNameStatus"),
    printReadyNameCancelBtn: document.getElementById("printReadyNameCancelBtn"),
    printReadyNameSendBtn: document.getElementById("printReadyNameSendBtn"),
    smsConfirmModal: document.getElementById("smsConfirmModal"),
    smsConfirmCloseBtn: document.getElementById("smsConfirmCloseBtn"),
    smsConfirmNoBtn: document.getElementById("smsConfirmNoBtn"),
    smsConfirmYesBtn: document.getElementById("smsConfirmYesBtn"),
    smsConfirmSummary: document.getElementById("smsConfirmSummary"),
    smsConfirmDetails: document.getElementById("smsConfirmDetails"),
    smsConfirmStatus: document.getElementById("smsConfirmStatus"),
    smsConfirmTrackingInput: document.getElementById("smsConfirmTrackingInput"),
    smsConfirmAddTrackingBtn: document.getElementById("smsConfirmAddTrackingBtn"),
    smsConfirmLabelPdfInput: document.getElementById("smsConfirmLabelPdfInput"),
    smsConfirmExtractBtn: document.getElementById("smsConfirmExtractBtn"),
    smsConfirmExtracted: document.getElementById("smsConfirmExtracted"),
    smsOnboardingModal: document.getElementById("smsOnboardingModal"),
    smsOnboardingSkipTopBtn: document.getElementById("smsOnboardingSkipTopBtn"),
    smsOnboardingCountrySelect: document.getElementById("smsOnboardingCountrySelect"),
    smsOnboardingPhoneInput: document.getElementById("smsOnboardingPhoneInput"),
    smsOnboardingPreview: document.getElementById("smsOnboardingPreview"),
    smsOnboardingCodeWrap: document.getElementById("smsOnboardingCodeWrap"),
    smsOnboardingCodeInput: document.getElementById("smsOnboardingCodeInput"),
    smsOnboardingTimer: document.getElementById("smsOnboardingTimer"),
    smsOnboardingStatus: document.getElementById("smsOnboardingStatus"),
    smsOnboardingSkipBtn: document.getElementById("smsOnboardingSkipBtn"),
    smsOnboardingSendCodeBtn: document.getElementById("smsOnboardingSendCodeBtn"),
    smsOnboardingVerifyBtn: document.getElementById("smsOnboardingVerifyBtn"),
    appOnboardingModal: document.getElementById("appOnboardingModal"),
    appOnboardingNavItems: Array.from(document.querySelectorAll(".app-onboarding-nav-item[data-guide-panel]")),
    appOnboardingContent: document.querySelector(".app-onboarding-content"),
    appOnboardingPanels: Array.from(document.querySelectorAll(".app-onboarding-panel[data-guide-panel]")),
    appOnboardingGuideGifs: Array.from(document.querySelectorAll(".app-onboarding-guide-gif")),
    appOnboardingEnabledChk: document.getElementById("appOnboardingEnabledChk"),
    appOnboardingDoneBtn: document.getElementById("appOnboardingDoneBtn"),
    appOnboardingStatus: document.getElementById("appOnboardingStatus"),
    appOnboardingCountdown: document.getElementById("appOnboardingCountdown"),
    printReadyRefreshBtn: document.getElementById("printReadyRefreshBtn"),
    printReadyStatus: document.getElementById("printReadyStatus"),
    printReadyAdminList: document.getElementById("printReadyAdminList"),
    finishedProjectsRefreshBtn: document.getElementById("finishedProjectsRefreshBtn"),
    finishedProjectsStatus: document.getElementById("finishedProjectsStatus"),
    finishedProjectsList: document.getElementById("finishedProjectsList"),
    rejectedFileTypesRefreshBtn: document.getElementById("rejectedFileTypesRefreshBtn"),
    rejectedFileTypesClearBtn: document.getElementById("rejectedFileTypesClearBtn"),
    rejectedFileTypesStatus: document.getElementById("rejectedFileTypesStatus"),
    rejectedFileTypesTableBody: document.getElementById("rejectedFileTypesTableBody"),
    sharesListStatus: document.getElementById("sharesListStatus"),
    sharesTableBody: document.getElementById("sharesTableBody"),
    dnsExternalBaseUrlInput: document.getElementById("dnsExternalBaseUrlInput"),
    dnsSaveBtn: document.getElementById("dnsSaveBtn"),
    dnsStatus: document.getElementById("dnsStatus"),
    smsGatewayEnabledChk: document.getElementById("smsGatewayEnabledChk"),
    smsGatewaySenderInput: document.getElementById("smsGatewaySenderInput"),
    smsGatewaySenderCount: document.getElementById("smsGatewaySenderCount"),
    smsGatewayTokenInput: document.getElementById("smsGatewayTokenInput"),
    smsTestRecipientInput: document.getElementById("smsTestRecipientInput"),
    smsTestBtn: document.getElementById("smsTestBtn"),
    smsResetTokenBtn: document.getElementById("smsResetTokenBtn"),
    smsSaveBtn: document.getElementById("smsSaveBtn"),
    smsStatus: document.getElementById("smsStatus"),
    makerworldUsernameInput: document.getElementById("makerworldUsernameInput"),
    makerworldPasswordInput: document.getElementById("makerworldPasswordInput"),
    makerworldResetPasswordBtn: document.getElementById("makerworldResetPasswordBtn"),
    makerworldSaveBtn: document.getElementById("makerworldSaveBtn"),
    makerworldLoginBrowserWrap: document.getElementById("makerworldLoginBrowserWrap"),
    makerworldLoginBrowserFrame: document.getElementById("makerworldLoginBrowserFrame"),
    makerworldLoginOpenLink: document.getElementById("makerworldLoginOpenLink"),
    makerworldLoginLiveStatus: document.getElementById("makerworldLoginLiveStatus"),
    makerworldStatus: document.getElementById("makerworldStatus"),
    openCreateUserModalBtn: document.getElementById("openCreateUserModalBtn"),
    createUserModal: document.getElementById("createUserModal"),
    createUserForm: document.getElementById("createUserForm"),
    createUserModalCancelBtn: document.getElementById("createUserModalCancelBtn"),
    createUserFirstName: document.getElementById("createUserFirstName"),
    createUserLastName: document.getElementById("createUserLastName"),
    createUserUsername: document.getElementById("createUserUsername"),
    createUserPassword: document.getElementById("createUserPassword"),
    createUserPassword2: document.getElementById("createUserPassword2"),
    createUserRole: document.getElementById("createUserRole"),
    createUserBtn: document.getElementById("createUserBtn"),
    createUserModalStatus: document.getElementById("createUserModalStatus"),
    editUserModal: document.getElementById("editUserModal"),
    editUserForm: document.getElementById("editUserForm"),
    editUserModalCancelBtn: document.getElementById("editUserModalCancelBtn"),
    editUserFirstName: document.getElementById("editUserFirstName"),
    editUserLastName: document.getElementById("editUserLastName"),
    editUserUsername: document.getElementById("editUserUsername"),
    editUserRole: document.getElementById("editUserRole"),
    editUserHomeFolderHint: document.getElementById("editUserHomeFolderHint"),
    editUserSaveBtn: document.getElementById("editUserSaveBtn"),
    editUserModalStatus: document.getElementById("editUserModalStatus"),
    nonUserFolderModal: document.getElementById("nonUserFolderModal"),
    nonUserFolderForm: document.getElementById("nonUserFolderForm"),
    nonUserFolderFirstName: document.getElementById("nonUserFolderFirstName"),
    nonUserFolderLastName: document.getElementById("nonUserFolderLastName"),
    nonUserFolderPreview: document.getElementById("nonUserFolderPreview"),
    nonUserFolderStatus: document.getElementById("nonUserFolderStatus"),
    nonUserFolderCancelBtn: document.getElementById("nonUserFolderCancelBtn"),
    nonUserFolderCreateBtn: document.getElementById("nonUserFolderCreateBtn"),
    importLinkModal: document.getElementById("importLinkModal"),
    importLinkCloseBtn: document.getElementById("importLinkCloseBtn"),
    importLinkCancelBtn: document.getElementById("importLinkCancelBtn"),
    importLinkNextBtn: document.getElementById("importLinkNextBtn"),
    importLinkInput: document.getElementById("importLinkInput"),
    importLinkStatus: document.getElementById("importLinkStatus"),
    importPreviewModal: document.getElementById("importPreviewModal"),
    importPreviewCloseBtn: document.getElementById("importPreviewCloseBtn"),
    importPreviewBackBtn: document.getElementById("importPreviewBackBtn"),
    importPreviewUseBtn: document.getElementById("importPreviewUseBtn"),
    importPreviewTitle: document.getElementById("importPreviewTitle"),
    importPreviewSubtitle: document.getElementById("importPreviewSubtitle"),
    importPreviewBody: document.getElementById("importPreviewBody"),
    importPreviewStatus: document.getElementById("importPreviewStatus"),
    userStatus: document.getElementById("userStatus"),
    usersTableBody: document.getElementById("usersTableBody"),
    signupRequestsStatus: document.getElementById("signupRequestsStatus"),
    signupRequestsTableBody: document.getElementById("signupRequestsTableBody"),
    createSignupLinkBtn: document.getElementById("createSignupLinkBtn"),
    signupLinksStatus: document.getElementById("signupLinksStatus"),
    signupLinksTableBody: document.getElementById("signupLinksTableBody"),
    trackingNumberInput: document.getElementById("trackingNumberInput"),
    trackingAddBtn: document.getElementById("trackingAddBtn"),
    trackingStatus: document.getElementById("trackingStatus"),
    trackingTableBody: document.getElementById("trackingTableBody"),
    trackingAssignModal: document.getElementById("trackingAssignModal"),
    trackingAssignModalCloseBtn: document.getElementById("trackingAssignModalCloseBtn"),
    trackingAssignNumberHint: document.getElementById("trackingAssignNumberHint"),
    trackingAssignUserSelect: document.getElementById("trackingAssignUserSelect"),
    trackingAssignCancelBtn: document.getElementById("trackingAssignCancelBtn"),
    trackingAssignSaveBtn: document.getElementById("trackingAssignSaveBtn"),
    trackingAssignStatus: document.getElementById("trackingAssignStatus"),
    trackingShareModal: document.getElementById("trackingShareModal"),
    trackingShareModalCloseBtn: document.getElementById("trackingShareModalCloseBtn"),
    trackingShareLinkInput: document.getElementById("trackingShareLinkInput"),
    trackingShareCopyBtn: document.getElementById("trackingShareCopyBtn"),
    trackingShareStatus: document.getElementById("trackingShareStatus"),
    logsRefreshBtn: document.getElementById("logsRefreshBtn"),
    logsClearBtn: document.getElementById("logsClearBtn"),
    logsStatus: document.getElementById("logsStatus"),
    logsTableBody: document.getElementById("logsTableBody"),
    slicerRefreshBtn: document.getElementById("slicerRefreshBtn"),
    slicerSettingsStatus: document.getElementById("slicerSettingsStatus"),
    slicerEffectiveInfo: document.getElementById("slicerEffectiveInfo"),
    slicerBedMapTableBody: document.getElementById("slicerBedMapTableBody"),
    slicerBedMapAddBtn: document.getElementById("slicerBedMapAddBtn"),
    slicerBedMapSaveBtn: document.getElementById("slicerBedMapSaveBtn"),
    slicerBedMapResetBtn: document.getElementById("slicerBedMapResetBtn"),
    slicerBedMapEditModal: document.getElementById("slicerBedMapEditModal"),
    slicerBedMapEditName: document.getElementById("slicerBedMapEditName"),
    slicerBedMapEditWidthInput: document.getElementById("slicerBedMapEditWidthInput"),
    slicerBedMapEditDepthInput: document.getElementById("slicerBedMapEditDepthInput"),
    slicerBedMapEditSaveBtn: document.getElementById("slicerBedMapEditSaveBtn"),
    slicerBedMapEditCloseBtn: document.getElementById("slicerBedMapEditCloseBtn"),
    slicerBedMapEditCancelBtn: document.getElementById("slicerBedMapEditCancelBtn"),
    slicerMachineOpenUploadBtn: document.getElementById("slicerMachineOpenUploadBtn"),
    slicerMachineSummary: document.getElementById("slicerMachineSummary"),
    slicerMachineTableBody: document.getElementById("slicerMachineTableBody"),
    slicerProcessOpenUploadBtn: document.getElementById("slicerProcessOpenUploadBtn"),
    slicerProcessSummary: document.getElementById("slicerProcessSummary"),
    slicerProcessTableBody: document.getElementById("slicerProcessTableBody"),
    slicerFilamentOpenUploadBtn: document.getElementById("slicerFilamentOpenUploadBtn"),
    slicerFilamentSummary: document.getElementById("slicerFilamentSummary"),
    slicerFilamentTableBody: document.getElementById("slicerFilamentTableBody"),
    slicerConfigOpenUploadBtn: document.getElementById("slicerConfigOpenUploadBtn"),
    slicerConfigSummary: document.getElementById("slicerConfigSummary"),
    slicerConfigTableBody: document.getElementById("slicerConfigTableBody"),
    slicerUploadModal: document.getElementById("slicerUploadModal"),
    slicerUploadModalTitle: document.getElementById("slicerUploadModalTitle"),
    slicerUploadModalHint: document.getElementById("slicerUploadModalHint"),
    slicerUploadDropZone: document.getElementById("slicerUploadDropZone"),
    slicerUploadInput: document.getElementById("slicerUploadInput"),
    slicerUploadPickBtn: document.getElementById("slicerUploadPickBtn"),
    slicerUploadConfirmBtn: document.getElementById("slicerUploadConfirmBtn"),
    slicerUploadCloseBtn: document.getElementById("slicerUploadCloseBtn"),
    slicerUploadCancelBtn: document.getElementById("slicerUploadCancelBtn"),
    slicerUploadSelectedFiles: document.getElementById("slicerUploadSelectedFiles"),
    slicerUploadModalStatus: document.getElementById("slicerUploadModalStatus"),
    slicerProfileCards: Array.from(document.querySelectorAll(".slicer-profile-card[data-slicer-upload-kind]")),
  };

  const TABS = {
    files: {
      title: "Mapper",
      subtitle: "Mapper, upload og metadata",
    },
    profile: {
      title: "Profil",
      subtitle: "Din brugerprofil og SMS-indstillinger",
    },
    settings: {
      title: "Indstillinger",
      subtitle: "Delinger, DNS, brugere, SMS og slicer-profiler",
    },
    tracking: {
      title: "Tracking",
      subtitle: "Bring pakker og manuelle tracking-opdateringer",
    },
    "print-ready": {
      title: "Projekter klar til print",
      subtitle: "Projekter markeret klar til produktion",
    },
    "finished-projects": {
      title: "Færdige projekter",
      subtitle: "Afsluttede projekter og genprint",
    },
    "rejected-file-types": {
      title: "Afviste filtyper",
      subtitle: "Filtyper der er forsøgt uploadet, men afvist",
    },
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function showStatus(el, message, kind = "ok") {
    if (!el) return;
    if (!message) {
      el.classList.add("hidden");
      el.classList.remove("ok", "error");
      el.textContent = "";
      return;
    }
    el.classList.remove("hidden");
    el.classList.remove("ok", "error");
    el.classList.add(kind === "ok" ? "ok" : "error");
    el.textContent = message;
  }

  function canUseHoverMarquee() {
    return !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1001px)").matches);
  }

  function isTouchOrNarrowViewport() {
    try {
      return !!(window.matchMedia && window.matchMedia("(pointer: coarse), (max-width: 760px)").matches);
    } catch (_err) {
      return false;
    }
  }

  function triggerHiddenDownload(url) {
    const safeUrl = String(url || "").trim();
    if (!safeUrl || safeUrl === "#") return false;

    const iframe = document.createElement("iframe");
    iframe.src = safeUrl;
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      iframe.remove();
    }, 60000);
    return true;
  }

  function bindHoverMarqueeCards(rootEl, cardSelector, lineSelector) {
    if (!rootEl) return;
    const cards = Array.from(rootEl.querySelectorAll(cardSelector));
    for (const card of cards) {
      const lineEl = card.querySelector(lineSelector);
      const inner = lineEl ? lineEl.querySelector(".hover-scroll-text") : null;
      if (!lineEl || !inner) continue;

      let rafId = 0;

      const cancelMarquee = () => {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
        lineEl.classList.remove("marquee");
        inner.style.transform = "";
      };

      const startMarquee = () => {
        if (!canUseHoverMarquee()) {
          cancelMarquee();
          return;
        }

        const prevDisplay = inner.style.display;
        inner.style.display = "inline-block";
        const delta = Math.max(0, inner.scrollWidth - lineEl.clientWidth);
        inner.style.display = prevDisplay;

        if (delta <= 4) {
          cancelMarquee();
          return;
        }

        cancelMarquee();
        lineEl.classList.add("marquee");

        let x = 0;
        let lastTs = 0;
        const speed = 58;

        const step = (ts) => {
          if (!lineEl.classList.contains("marquee") || !lineEl.isConnected) {
            cancelMarquee();
            return;
          }
          if (!lastTs) lastTs = ts;
          const dt = Math.max(0, (ts - lastTs) / 1000);
          lastTs = ts;
          x -= speed * dt;
          if (-x >= delta) x = 0;
          inner.style.transform = `translateX(${x}px)`;
          rafId = window.requestAnimationFrame(step);
        };

        rafId = window.requestAnimationFrame(step);
      };

      lineEl.addEventListener("mouseenter", startMarquee);
      lineEl.addEventListener("mouseleave", cancelMarquee);
    }
  }

  const PRIMARY_UPLOAD_ALLOWED_EXTS = new Set([".stl", ".step", ".zip", ".3mf", ".obj", ".lys", ".pwscene"]);
  const PRIMARY_UPLOAD_ALLOWED_LABEL = ".stl, .step, .zip, .3mf, .obj, .lys og .pwscene";
  const PRINT_READY_PROJECT_FILE_ALLOWED_EXTS = new Set([".3mf", ".stl", ".lys", ".pwscene"]);
  const PRINT_READY_PROJECT_FILE_ALLOWED_LABEL = ".3mf, .stl, .lys og .pwscene";

  function fileExt(filename) {
    const name = String(filename || "").trim().toLowerCase();
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx) : "";
  }

  function isSupportedPrimaryUpload(file) {
    return !!file && PRIMARY_UPLOAD_ALLOWED_EXTS.has(fileExt(file.name));
  }

  function isSupportedPrintReadyProjectFile(file) {
    return !!file && PRINT_READY_PROJECT_FILE_ALLOWED_EXTS.has(fileExt(file.name));
  }

  function unsupportedPrimaryUploadMessage(files) {
    const list = Array.from(files || []).filter(Boolean);
    const names = list.slice(0, 3).map((file) => String(file && file.name ? file.name : "Fil")).join(", ");
    const extra = list.length > 3 ? ` +${list.length - 3} flere` : "";
    const subject = list.length === 1 ? names : `${list.length} filer${names ? ` (${names}${extra})` : ""}`;
    return `${subject} understøttes ikke. Upload kun ${PRIMARY_UPLOAD_ALLOWED_LABEL} filer.`;
  }

  function logRejectedFileTypes(files, context = "upload", reason = "", folderPath = "") {
    const list = Array.from(files || []).filter((file) => file && file.name);
    if (!list.length) return;
    api("/api/rejected-file-types", {
      method: "POST",
      body: {
        items: list.slice(0, 50).map((file) => ({
          filename: String(file.name || "Fil"),
          context,
          reason: reason || `Ikke understøttet. Upload kun ${PRIMARY_UPLOAD_ALLOWED_LABEL} filer.`,
          folder_path: folderPath,
        })),
      },
    }).catch(() => {
      // Best effort only; upload validation should not depend on logging.
    });
  }

  const SMS_COUNTRY_OPTIONS = [
    { code: "+45", label: "Danmark (+45)" },
    { code: "+47", label: "Norge (+47)" },
    { code: "+46", label: "Sverige (+46)" },
    { code: "+49", label: "Tyskland (+49)" },
    { code: "+31", label: "Holland (+31)" },
    { code: "+44", label: "Storbritannien (+44)" },
    { code: "+33", label: "Frankrig (+33)" },
    { code: "+34", label: "Spanien (+34)" },
    { code: "+39", label: "Italien (+39)" },
    { code: "+48", label: "Polen (+48)" },
    { code: "+351", label: "Portugal (+351)" },
    { code: "+43", label: "Østrig (+43)" },
    { code: "+41", label: "Schweiz (+41)" },
    { code: "+1", label: "USA/Canada (+1)" },
  ];
  const SMS_DEFAULT_COUNTRY_CODE = "+45";
  const SMS_SENDER_MAX_LENGTH = 11;

  function normalizeSmsCountryCodeClient(value, fallback = SMS_DEFAULT_COUNTRY_CODE) {
    let raw = String(value || "").trim();
    if (!raw) raw = String(fallback || SMS_DEFAULT_COUNTRY_CODE);
    if (raw.startsWith("+")) raw = raw.slice(1);
    const digits = raw.replace(/\D/g, "");
    if (!digits) return SMS_DEFAULT_COUNTRY_CODE;
    return `+${digits.slice(0, 4)}`;
  }

  function normalizeSmsPhoneNumberClient(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function smsE164Client(countryCode, phoneNumber) {
    const cc = normalizeSmsCountryCodeClient(countryCode);
    const number = normalizeSmsPhoneNumberClient(phoneNumber);
    if (!cc || !number) return "";
    const noLeadingZero = number.replace(/^0+/, "") || number;
    const ccDigits = cc.replace(/\D/g, "");
    if (ccDigits && noLeadingZero.startsWith(ccDigits) && noLeadingZero.length > ccDigits.length) {
      return `+${noLeadingZero}`;
    }
    return `${cc}${noLeadingZero}`;
  }

  function ensureSmsCountryOption(selectEl, code) {
    if (!selectEl) return;
    const normalized = normalizeSmsCountryCodeClient(code);
    const exists = Array.from(selectEl.options || []).some(
      (option) => String(option.value || "") === normalized,
    );
    if (exists) return;
    const option = document.createElement("option");
    option.value = normalized;
    option.textContent = `${normalized}`;
    selectEl.appendChild(option);
  }

  function renderSmsCountryOptions(selectEl) {
    if (!selectEl) return;
    const current = normalizeSmsCountryCodeClient(selectEl.value || SMS_DEFAULT_COUNTRY_CODE);
    selectEl.innerHTML = SMS_COUNTRY_OPTIONS
      .map((entry) => `<option value="${esc(entry.code)}">${esc(entry.label)}</option>`)
      .join("");
    ensureSmsCountryOption(selectEl, current);
    selectEl.value = current;
  }

  function renderProfileSmsCountryOptions() {
    renderSmsCountryOptions(els.profileSmsCountrySelect);
  }

  function updateProfileSmsPreview() {
    if (!els.profileSmsE164Preview) return;
    const countryCode = normalizeSmsCountryCodeClient(
      (els.profileSmsCountrySelect && els.profileSmsCountrySelect.value) || SMS_DEFAULT_COUNTRY_CODE,
    );
    const phone = normalizeSmsPhoneNumberClient((els.profileSmsPhoneInput && els.profileSmsPhoneInput.value) || "");
    const e164 = smsE164Client(countryCode, phone);
    els.profileSmsE164Preview.value = e164 || "";
  }

  function setProfileSmsFormState(options = {}) {
    const busy = !!(options && options.busy);
    const enabled = !!(els.profileSmsEnabledChk && els.profileSmsEnabledChk.checked);

    if (els.profileSmsEnabledChk) {
      els.profileSmsEnabledChk.disabled = busy;
    }
    if (els.profileSmsCountrySelect) {
      els.profileSmsCountrySelect.disabled = busy || !enabled;
    }
    if (els.profileSmsPhoneInput) {
      els.profileSmsPhoneInput.disabled = busy || !enabled;
    }
    if (els.profileSmsSaveBtn) {
      els.profileSmsSaveBtn.disabled = busy;
      els.profileSmsSaveBtn.textContent = busy ? "Gemmer..." : "Gem profil";
    }
    updateProfileSmsPreview();
  }

  function applyMyProfile(profile) {
    const smsEnabled = !!(profile && profile.sms_enabled);
    const countryCode = normalizeSmsCountryCodeClient(
      (profile && profile.sms_phone_country_code) || SMS_DEFAULT_COUNTRY_CODE,
    );
    const phone = normalizeSmsPhoneNumberClient((profile && profile.sms_phone_number) || "");

    renderProfileSmsCountryOptions();
    ensureSmsCountryOption(els.profileSmsCountrySelect, countryCode);
    if (els.profileSmsEnabledChk) els.profileSmsEnabledChk.checked = smsEnabled;
    if (els.profileSmsCountrySelect) els.profileSmsCountrySelect.value = countryCode;
    if (els.profileSmsPhoneInput) els.profileSmsPhoneInput.value = phone;
    setProfileSmsFormState({ busy: false });
  }

  async function loadMyProfile() {
    if (!els.profileSmsEnabledChk && !els.profileSmsCountrySelect && !els.profileSmsPhoneInput) return;
    try {
      setProfileSmsFormState({ busy: true });
      const data = await api("/api/me/profile");
      applyMyProfile(data.profile || {});
      showStatus(els.profileSmsStatus, "");
    } catch (err) {
      setProfileSmsFormState({ busy: false });
      showStatus(els.profileSmsStatus, err.message || "Kunne ikke hente profil", "error");
    }
  }

  async function changeMyPassword() {
    const currentPwd = (els.profileCurrentPwdInput && els.profileCurrentPwdInput.value) || "";
    const newPwd = (els.profileNewPwdInput && els.profileNewPwdInput.value) || "";
    if (!currentPwd || !newPwd) {
      showStatus(els.profilePwdStatus, "Udfyld nuværende og ny kode.", "error");
      return;
    }
    showStatus(els.profilePwdStatus, "Skifter adgangskode...", "");
    try {
      await api("/api/me/change-password", { method: "POST", body: { current_password: currentPwd, new_password: newPwd } });
      if (els.profileCurrentPwdInput) els.profileCurrentPwdInput.value = "";
      if (els.profileNewPwdInput) els.profileNewPwdInput.value = "";
      showStatus(els.profilePwdStatus, "Adgangskoden er opdateret.", "ok");
    } catch (err) {
      showStatus(els.profilePwdStatus, err.message || "Kunne ikke skifte adgangskode", "error");
    }
  }

  function resetProfilePasswordForm(clearPasswords = true) {
    if (clearPasswords) {
      if (els.profileCurrentPwdInput) els.profileCurrentPwdInput.value = "";
      if (els.profileNewPwdInput) els.profileNewPwdInput.value = "";
    }
    showStatus(els.profilePwdStatus, "");
  }

  function setProfileGuideFormState(options = {}) {
    const busy = !!(options && options.busy);
    const enabled = !!(els.profileGuideEnabledChk && els.profileGuideEnabledChk.checked);
    if (els.profileGuideEnabledChk) {
      els.profileGuideEnabledChk.disabled = busy;
    }
    if (els.profileSaveBtn) {
      els.profileSaveBtn.disabled = busy;
      els.profileSaveBtn.textContent = busy ? "Gemmer..." : "Gem";
    }
    if (els.profileShowGuideBtn) {
      els.profileShowGuideBtn.classList.toggle("hidden", !enabled);
      els.profileShowGuideBtn.disabled = busy || !enabled;
    }
  }

  function applyAppOnboardingPreference(payload = {}) {
    state.appOnboardingSeenPersisted = !!(payload && payload.app_onboarding_seen_v1);
    state.appOnboardingEnabled = !(payload && payload.app_onboarding_enabled === false);
    if (els.profileGuideEnabledChk) {
      els.profileGuideEnabledChk.checked = !!state.appOnboardingEnabled;
    }
    if (els.appOnboardingEnabledChk) {
      els.appOnboardingEnabledChk.checked = !!state.appOnboardingEnabled;
    }
    setProfileGuideFormState({ busy: false });
  }

  async function loadAppOnboardingPreference() {
    if (!els.profileGuideEnabledChk && !els.profileShowGuideBtn) return;
    setProfileGuideFormState({ busy: true });
    try {
      const data = await api("/api/me");
      const user = (data && data.user) || {};
      applyAppOnboardingPreference(user);
      showStatus(els.profileGuideStatus, "");
    } catch (err) {
      setProfileGuideFormState({ busy: false });
      showStatus(els.profileGuideStatus, err.message || "Kunne ikke hente guide-indstillinger", "error");
    }
  }

  async function saveProfileGuidePreference() {
    const enabled = !!(els.profileGuideEnabledChk && els.profileGuideEnabledChk.checked);
    setProfileGuideFormState({ busy: true });
    try {
      const data = await api("/api/me/onboarding/preferences", {
        method: "POST",
        body: { enabled },
      });
      applyAppOnboardingPreference((data && data.onboarding) || { app_onboarding_enabled: enabled });
      if (enabled) {
        showStatus(els.profileGuideStatus, 'Guiden er slået til. Klik "Vis guide" for at starte den igen.', "ok");
      } else {
        dismissAppOnboarding();
        showStatus(els.profileGuideStatus, "Guiden er slået fra. Den vises ikke automatisk ved login.", "ok");
      }
    } catch (err) {
      setProfileGuideFormState({ busy: false });
      showStatus(els.profileGuideStatus, err.message || "Kunne ikke gemme guide-indstillinger", "error");
    }
  }

  async function saveProfileChanges() {
    const currentPwd = (els.profileCurrentPwdInput && els.profileCurrentPwdInput.value) || "";
    const newPwd = (els.profileNewPwdInput && els.profileNewPwdInput.value) || "";
    const hasPasswordInput = !!currentPwd || !!newPwd;
    const passwordReady = !!currentPwd && !!newPwd;
    const enabled = !!(els.profileGuideEnabledChk && els.profileGuideEnabledChk.checked);
    const guideChanged = enabled !== !!state.appOnboardingEnabled;

    showStatus(els.profilePwdStatus, "");
    showStatus(els.profileGuideStatus, "");

    if (!guideChanged && hasPasswordInput && !passwordReady) {
      showStatus(els.profilePwdStatus, "Udfyld nuværende og ny kode for at gemme adgangskode.", "error");
      return;
    }
    if (!guideChanged && !hasPasswordInput) {
      showStatus(els.profilePwdStatus, "Ingen ændringer at gemme.", "");
      return;
    }

    setProfileGuideFormState({ busy: true });
    try {
      if (guideChanged) {
        await saveProfileGuidePreference();
      }
      if (hasPasswordInput) {
        if (!passwordReady) {
          showStatus(els.profilePwdStatus, "Guideindstillinger gemt. Udfyld begge kodefelter for at gemme adgangskode.", "error");
          return;
        }
        await changeMyPassword();
      }
    } finally {
      setProfileGuideFormState({ busy: false });
    }
  }

  function isRequiredAppOnboarding() {
    return state.appOnboardingMode === "required";
  }

  function appOnboardingPanelKeys() {
    return (Array.isArray(els.appOnboardingPanels) ? els.appOnboardingPanels : [])
      .map((panel) => String((panel.dataset && panel.dataset.guidePanel) || "").trim().toLowerCase())
      .filter(Boolean);
  }

  function appOnboardingPanelIndex() {
    const keys = appOnboardingPanelKeys();
    const key = String(state.appOnboardingPanelKey || "").trim().toLowerCase();
    const index = keys.indexOf(key);
    return index >= 0 ? index : 0;
  }

  function activeAppOnboardingPanel() {
    const key = String(state.appOnboardingPanelKey || "").trim().toLowerCase();
    return (Array.isArray(els.appOnboardingPanels) ? els.appOnboardingPanels : []).find(
      (panel) => String((panel.dataset && panel.dataset.guidePanel) || "").trim().toLowerCase() === key,
    ) || null;
  }

  function hideAppOnboardingCountdown() {
    if (!els.appOnboardingCountdown) return;
    els.appOnboardingCountdown.classList.add("hidden");
    els.appOnboardingCountdown.textContent = "";
    els.appOnboardingCountdown.removeAttribute("aria-label");
  }

  function clearAppOnboardingCountdownTimer() {
    if (state.appOnboardingStepCountdownTimer) {
      window.clearInterval(state.appOnboardingStepCountdownTimer);
      state.appOnboardingStepCountdownTimer = null;
    }
    state.appOnboardingStepEndsAt = 0;
    state.appOnboardingStepDurationMs = 0;
    state.appOnboardingCountdownLastSeconds = null;
    state.appOnboardingButtonCountdownSeconds = null;
    hideAppOnboardingCountdown();
  }

  function clearAppOnboardingStepTimer() {
    if (state.appOnboardingStepTimer) {
      window.clearTimeout(state.appOnboardingStepTimer);
      state.appOnboardingStepTimer = null;
    }
    clearAppOnboardingCountdownTimer();
  }

  function ensureAppOnboardingGuideMedia(gif) {
    if (!gif || !gif.parentElement) return null;
    if (gif.parentElement.classList && gif.parentElement.classList.contains("app-onboarding-guide-media")) {
      return gif.parentElement;
    }
    const frame = document.createElement("div");
    frame.className = "app-onboarding-guide-media";
    gif.parentElement.insertBefore(frame, gif);
    frame.appendChild(gif);
    return frame;
  }

  function appOnboardingSecondsLabel(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    return value === 1 ? "1 sekund" : `${value} sekunder`;
  }

  function appOnboardingCountdownText(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    return value === 1 ? "1 sek" : `${value} sek`;
  }

  function appOnboardingRequiredButtonLabel(isLast) {
    const base = isLast ? "Færdig" : "Næste";
    const seconds = Number(state.appOnboardingButtonCountdownSeconds);
    if (!state.appOnboardingStepComplete && Number.isFinite(seconds) && seconds > 0) {
      return `${base} (${seconds})`;
    }
    return base;
  }

  function rememberAppOnboardingGifSrc(gif) {
    if (!gif) return "";
    if (!gif.dataset.originalSrc) {
      gif.dataset.originalSrc = gif.getAttribute("src") || gif.currentSrc || gif.src || "";
    }
    return String(gif.dataset.originalSrc || gif.getAttribute("src") || gif.currentSrc || gif.src || "");
  }

  function appOnboardingReplaySrc(src, token) {
    const raw = String(src || "").trim();
    if (!raw) return raw;
    try {
      const url = new URL(raw, window.location.href);
      url.searchParams.set("_guide_play", String(token || Date.now()));
      return url.href;
    } catch (_err) {
      const separator = raw.includes("?") ? "&" : "?";
      return `${raw}${separator}_guide_play=${encodeURIComponent(String(token || Date.now()))}`;
    }
  }

  function restartAppOnboardingGif(gif) {
    if (!gif) return;
    const src = rememberAppOnboardingGifSrc(gif);
    if (!src) return;
    gif.src = appOnboardingReplaySrc(src, state.appOnboardingStepToken);
  }

  function completeRequiredAppOnboardingStep(token, index, total) {
    if (state.appOnboardingStepToken !== token || !isRequiredAppOnboarding() || state.appOnboardingStepComplete) return;
    if (state.appOnboardingStepTimer) {
      window.clearTimeout(state.appOnboardingStepTimer);
      state.appOnboardingStepTimer = null;
    }
    state.appOnboardingStepComplete = true;
    state.appOnboardingButtonCountdownSeconds = null;
    renderAppOnboardingControls();
    showStatus(
      els.appOnboardingStatus,
      index >= total - 1 ? "Sidste guide er færdig. Tryk Færdig for at fortsætte." : "Guiden er færdig. Tryk Næste for at fortsætte.",
      "ok",
    );
  }

  function updateAppOnboardingCountdown(token, index, total, gif) {
    if (state.appOnboardingStepToken !== token || !isRequiredAppOnboarding()) return;
    const duration = Math.max(1000, Number(state.appOnboardingStepDurationMs || 0));
    const endsAt = Number(state.appOnboardingStepEndsAt || 0);
    if (!duration || !endsAt) return;

    const now = Date.now();
    if (!state.appOnboardingStepComplete && now >= endsAt) {
      completeRequiredAppOnboardingStep(token, index, total);
    }

    const startedAt = Math.max(0, endsAt - duration);
    const elapsed = Math.max(0, now - startedAt);
    const cycleElapsed = duration ? (elapsed % duration) : 0;
    const loopRemainingMs = cycleElapsed <= 0 ? duration : duration - cycleElapsed;
    const seconds = Math.max(1, Math.ceil(loopRemainingMs / 1000));
    if (seconds === state.appOnboardingCountdownLastSeconds) return;
    state.appOnboardingCountdownLastSeconds = seconds;

    const frame = ensureAppOnboardingGuideMedia(gif);
    if (frame && els.appOnboardingCountdown && els.appOnboardingCountdown.parentElement !== frame) {
      frame.appendChild(els.appOnboardingCountdown);
    }
    if (els.appOnboardingCountdown) {
      const countdownText = appOnboardingCountdownText(seconds);
      els.appOnboardingCountdown.textContent = countdownText;
      els.appOnboardingCountdown.setAttribute("aria-label", `${appOnboardingSecondsLabel(seconds)} tilbage af guiden`);
      els.appOnboardingCountdown.classList.remove("hidden");
    }

    if (!state.appOnboardingStepComplete) {
      const unlockSeconds = Math.max(0, Math.ceil(Math.max(0, endsAt - now) / 1000));
      if (unlockSeconds !== state.appOnboardingButtonCountdownSeconds) {
        state.appOnboardingButtonCountdownSeconds = unlockSeconds;
        renderAppOnboardingControls();
      }
      showStatus(
        els.appOnboardingStatus,
        `Guide ${index + 1} af ${total} afspilles. ${appOnboardingSecondsLabel(unlockSeconds)} tilbage, før knappen åbner.`,
        "ok",
      );
    }
  }

  function skipGifSubBlocks(bytes, pos) {
    let next = Number(pos || 0);
    while (next < bytes.length) {
      const size = Number(bytes[next] || 0);
      next += 1;
      if (!size) break;
      next += size;
    }
    return next;
  }

  function parseGifDurationMs(buffer) {
    const bytes = new Uint8Array(buffer || []);
    if (bytes.length < 13) return 0;
    const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
    if (signature !== "GIF") return 0;

    let pos = 6;
    pos += 4;
    const packed = bytes[pos] || 0;
    pos += 3;
    if (packed & 0x80) {
      pos += 3 * (1 << ((packed & 0x07) + 1));
    }

    let duration = 0;
    let frames = 0;
    while (pos < bytes.length) {
      const blockType = bytes[pos];
      pos += 1;
      if (blockType === 0x3b) break;

      if (blockType === 0x21) {
        const label = bytes[pos];
        pos += 1;
        if (label === 0xf9) {
          const blockSize = bytes[pos] || 0;
          pos += 1;
          if (blockSize >= 4 && pos + blockSize <= bytes.length) {
            const delayCs = (bytes[pos + 1] || 0) | ((bytes[pos + 2] || 0) << 8);
            duration += Math.max(2, delayCs || 10) * 10;
            frames += 1;
          }
          pos += blockSize;
          if (pos < bytes.length && bytes[pos] === 0) pos += 1;
          continue;
        }
        pos = skipGifSubBlocks(bytes, pos);
        continue;
      }

      if (blockType === 0x2c) {
        if (pos + 9 > bytes.length) break;
        const imagePacked = bytes[pos + 8] || 0;
        pos += 9;
        if (imagePacked & 0x80) {
          pos += 3 * (1 << ((imagePacked & 0x07) + 1));
        }
        pos += 1;
        pos = skipGifSubBlocks(bytes, pos);
        continue;
      }

      break;
    }

    return frames ? duration : 0;
  }

  async function appOnboardingGifDurationMs(gif) {
    const src = rememberAppOnboardingGifSrc(gif);
    if (!src) return APP_ONBOARDING_FALLBACK_STEP_MS;
    let cacheKey = src;
    try {
      cacheKey = new URL(src, window.location.href).href;
    } catch (_err) {}
    if (state.appOnboardingDurationCache[cacheKey]) {
      return state.appOnboardingDurationCache[cacheKey];
    }
    try {
      const resp = await fetch(cacheKey, { cache: "force-cache" });
      if (!resp.ok) throw new Error("Kunne ikke hente guide-gif");
      const duration = parseGifDurationMs(await resp.arrayBuffer());
      const safeDuration = Math.max(1200, Math.min(180000, (duration || APP_ONBOARDING_FALLBACK_STEP_MS) + APP_ONBOARDING_STEP_BUFFER_MS));
      state.appOnboardingDurationCache[cacheKey] = safeDuration;
      return safeDuration;
    } catch (_err) {
      state.appOnboardingDurationCache[cacheKey] = APP_ONBOARDING_FALLBACK_STEP_MS;
      return APP_ONBOARDING_FALLBACK_STEP_MS;
    }
  }

  function renderAppOnboardingControls() {
    const required = isRequiredAppOnboarding();
    const busy = !!state.appOnboardingBusy;
    const keys = appOnboardingPanelKeys();
    const index = appOnboardingPanelIndex();
    const isLast = index >= keys.length - 1;

    if (els.appOnboardingModal) {
      els.appOnboardingModal.classList.toggle("app-onboarding-required", required);
    }
    if (els.appOnboardingEnabledChk) {
      els.appOnboardingEnabledChk.disabled = busy;
    }
    if (els.appOnboardingNavItems && els.appOnboardingNavItems.length) {
      els.appOnboardingNavItems.forEach((item) => {
        item.disabled = required;
        item.setAttribute("aria-disabled", required ? "true" : "false");
      });
    }
    if (els.appOnboardingDoneBtn) {
      if (required) {
        els.appOnboardingDoneBtn.textContent = busy ? "Gemmer..." : appOnboardingRequiredButtonLabel(isLast);
        els.appOnboardingDoneBtn.disabled = busy || !state.appOnboardingStepComplete;
      } else {
        els.appOnboardingDoneBtn.textContent = busy ? "Gemmer..." : "Færdig";
        els.appOnboardingDoneBtn.disabled = busy;
      }
    }
  }

  function setAppOnboardingBusy(busy) {
    state.appOnboardingBusy = !!busy;
    renderAppOnboardingControls();
  }

  function beginRequiredAppOnboardingStep() {
    clearAppOnboardingStepTimer();
    if (!isRequiredAppOnboarding()) {
      state.appOnboardingStepComplete = true;
      renderAppOnboardingControls();
      return;
    }

    const token = state.appOnboardingStepToken + 1;
    state.appOnboardingStepToken = token;
    state.appOnboardingStepComplete = false;
    renderAppOnboardingControls();

    const keys = appOnboardingPanelKeys();
    const index = appOnboardingPanelIndex();
    const panel = activeAppOnboardingPanel();
    const gif = panel ? panel.querySelector(".app-onboarding-guide-gif") : null;
    restartAppOnboardingGif(gif);
    showStatus(els.appOnboardingStatus, `Guide ${index + 1} af ${keys.length} afspilles. Knappen åbner, når videoen er færdig.`, "ok");

    appOnboardingGifDurationMs(gif).then((duration) => {
      if (state.appOnboardingStepToken !== token || !isRequiredAppOnboarding()) return;
      state.appOnboardingStepDurationMs = duration;
      state.appOnboardingStepEndsAt = Date.now() + duration;
      state.appOnboardingCountdownLastSeconds = null;
      state.appOnboardingButtonCountdownSeconds = null;
      updateAppOnboardingCountdown(token, index, keys.length, gif);
      state.appOnboardingStepCountdownTimer = window.setInterval(() => {
        updateAppOnboardingCountdown(token, index, keys.length, gif);
      }, 250);
      state.appOnboardingStepTimer = window.setTimeout(() => {
        if (state.appOnboardingStepToken !== token || !isRequiredAppOnboarding()) return;
        completeRequiredAppOnboardingStep(token, index, keys.length);
      }, duration);
    });
  }

  async function markAppOnboardingSeen() {
    if (state.appOnboardingSeenPersisted) return;
    await api("/api/me/onboarding/seen", { method: "POST" });
    state.appOnboardingSeenPersisted = true;
  }

  function setAppOnboardingPanel(panelKey = "", options = {}) {
    const panels = Array.isArray(els.appOnboardingPanels) ? els.appOnboardingPanels : [];
    const navItems = Array.isArray(els.appOnboardingNavItems) ? els.appOnboardingNavItems : [];
    if (!panels.length) return;
    if (isRequiredAppOnboarding() && !(options && options.force)) {
      return;
    }

    const requested = String(panelKey || state.appOnboardingPanelKey || "").trim().toLowerCase();
    const firstKey = String((panels[0] && panels[0].dataset && panels[0].dataset.guidePanel) || "navigation").trim().toLowerCase();
    const exists = (key) => panels.some(
      (panel) => String((panel.dataset && panel.dataset.guidePanel) || "").trim().toLowerCase() === key,
    );

    const next = requested && exists(requested) ? requested : firstKey;
    state.appOnboardingPanelKey = next;

    panels.forEach((panel) => {
      const key = String((panel.dataset && panel.dataset.guidePanel) || "").trim().toLowerCase();
      panel.classList.toggle("hidden", key !== next);
    });

    navItems.forEach((item) => {
      const key = String((item.dataset && item.dataset.guidePanel) || "").trim().toLowerCase();
      const active = key === next;
      item.classList.toggle("active", active);
      item.setAttribute("aria-current", active ? "true" : "false");
    });

    if (els.appOnboardingContent) {
      els.appOnboardingContent.scrollTop = 0;
    }
    const activeNav = navItems.find((item) => String((item.dataset && item.dataset.guidePanel) || "").trim().toLowerCase() === next);
    if (activeNav && typeof activeNav.scrollIntoView === "function") {
      activeNav.scrollIntoView({ block: "nearest" });
    }

    if (isRequiredAppOnboarding()) {
      beginRequiredAppOnboardingStep();
    } else {
      state.appOnboardingStepComplete = true;
      renderAppOnboardingControls();
    }
  }

  function openAppOnboarding(options = {}) {
    if (!els.appOnboardingModal) return;
    const force = !!(options && options.force);
    const closeProfile = !!(options && options.closeProfile);
    const required = !!(options && options.required);
    if (!force && !state.appOnboardingEnabled) return;
    if (closeProfile) {
      closeProfileModal();
    }
    clearAppOnboardingStepTimer();
    state.appOnboardingMode = required ? "required" : "normal";
    state.appOnboardingStepComplete = !required;
    state.appOnboardingBusy = false;
    if (els.appOnboardingEnabledChk) {
      els.appOnboardingEnabledChk.checked = !!state.appOnboardingEnabled;
    }
    showStatus(els.appOnboardingStatus, "");
    els.appOnboardingModal.classList.remove("hidden");
    setAppOnboardingPanel("navigation", { force: true });
    renderAppOnboardingControls();
  }

  function openProfileModal() {
    if (!els.profileModal) return;
    resetProfilePasswordForm(true);
    setProfileGuideFormState({ busy: false });
    showStatus(els.profileGuideStatus, "");
    els.profileModal.classList.remove("hidden");
    setMobileNavActive("profile");
    loadAppOnboardingPreference().catch(() => {
      // Keep profile usable even if onboarding preference cannot be loaded.
    });
    if (els.profileFooterBtn) els.profileFooterBtn.classList.add("active");
    window.setTimeout(() => {
      if (els.profileCurrentPwdInput) els.profileCurrentPwdInput.focus();
    }, 0);
  }

  function closeProfileModal() {
    if (els.profileModal) els.profileModal.classList.add("hidden");
    if (els.profileFooterBtn) els.profileFooterBtn.classList.remove("active");
    resetProfilePasswordForm(true);
    showStatus(els.profileGuideStatus, "");
    if (!document.body.classList.contains("mobile-drawer-open")) {
      setMobileNavActive(mobileActionForTab(state.currentTab));
    }
  }

  async function maybeShowAppOnboarding() {
    try {
      const data = await api("/api/me");
      const user = (data && data.user) || {};
      applyAppOnboardingPreference(user);
      if (state.appOnboardingEnabled) {
        openAppOnboarding({
          force: true,
          required: !state.appOnboardingSeenPersisted,
        });
      }
    } catch (err) {
      // Ignore onboarding on error to not block UI
    }
  }

  function dismissAppOnboarding() {
    clearAppOnboardingStepTimer();
    state.appOnboardingMode = "normal";
    state.appOnboardingStepComplete = true;
    if (els.appOnboardingModal) els.appOnboardingModal.classList.add("hidden");
    showStatus(els.appOnboardingStatus, "");
    setAppOnboardingBusy(false);
  }

  async function completeAppOnboardingFromModal() {
    const enabled = !!(els.appOnboardingEnabledChk && els.appOnboardingEnabledChk.checked);
    if (isRequiredAppOnboarding()) {
      if (!state.appOnboardingStepComplete) return;
      const keys = appOnboardingPanelKeys();
      const index = appOnboardingPanelIndex();
      if (index < keys.length - 1) {
        setAppOnboardingPanel(keys[index + 1], { force: true });
        return;
      }

      setAppOnboardingBusy(true);
      showStatus(els.appOnboardingStatus, "");
      try {
        if (enabled !== !!state.appOnboardingEnabled) {
          const data = await api("/api/me/onboarding/preferences", {
            method: "POST",
            body: { enabled },
          });
          applyAppOnboardingPreference((data && data.onboarding) || { app_onboarding_enabled: enabled });
        }
        await markAppOnboardingSeen();
        dismissAppOnboarding();
      } catch (err) {
        setAppOnboardingBusy(false);
        showStatus(els.appOnboardingStatus, err.message || "Kunne ikke gemme guidevalg", "error");
      }
      return;
    }

    if (enabled === !!state.appOnboardingEnabled && state.appOnboardingSeenPersisted) {
      dismissAppOnboarding();
      return;
    }
    setAppOnboardingBusy(true);
    showStatus(els.appOnboardingStatus, "");
    try {
      if (enabled !== !!state.appOnboardingEnabled) {
        const data = await api("/api/me/onboarding/preferences", {
          method: "POST",
          body: { enabled },
        });
        applyAppOnboardingPreference((data && data.onboarding) || { app_onboarding_enabled: enabled });
      }
      await markAppOnboardingSeen();
      dismissAppOnboarding();
      if (enabled) {
        showStatus(els.profileGuideStatus, 'Guiden er slået til. Klik "Vis guide" for at starte den igen.', "ok");
      } else {
        showStatus(els.profileGuideStatus, "Guiden er slået fra. Den vises ikke automatisk ved login.", "ok");
      }
    } catch (err) {
      setAppOnboardingBusy(false);
      showStatus(els.appOnboardingStatus, err.message || "Kunne ikke gemme guidevalg", "error");
    }
  }

  async function saveMyProfile() {
    const smsEnabled = !!(els.profileSmsEnabledChk && els.profileSmsEnabledChk.checked);
    const countryCode = normalizeSmsCountryCodeClient(
      (els.profileSmsCountrySelect && els.profileSmsCountrySelect.value) || SMS_DEFAULT_COUNTRY_CODE,
    );
    const phoneNumber = normalizeSmsPhoneNumberClient((els.profileSmsPhoneInput && els.profileSmsPhoneInput.value) || "");

    setProfileSmsFormState({ busy: true });
    try {
      const data = await api("/api/me/profile", {
        method: "POST",
        body: {
          sms_enabled: smsEnabled,
          sms_phone_country_code: countryCode,
          sms_phone_number: phoneNumber,
        },
      });
      applyMyProfile(data.profile || {});
      if (!smsEnabled) {
        showStatus(els.profileSmsStatus, "SMS er slået fra for din profil.", "ok");
      } else {
        showStatus(els.profileSmsStatus, "SMS-indstillinger gemt.", "ok");
      }
    } catch (err) {
      setProfileSmsFormState({ busy: false });
      showStatus(els.profileSmsStatus, err.message || "Kunne ikke gemme profil", "error");
    }
  }

  function updateSmsOnboardingPreview() {
    if (!els.smsOnboardingPreview) return;
    const countryCode = normalizeSmsCountryCodeClient(
      (els.smsOnboardingCountrySelect && els.smsOnboardingCountrySelect.value) || SMS_DEFAULT_COUNTRY_CODE,
    );
    const phone = normalizeSmsPhoneNumberClient((els.smsOnboardingPhoneInput && els.smsOnboardingPhoneInput.value) || "");
    els.smsOnboardingPreview.value = smsE164Client(countryCode, phone) || "";
  }

  function stopSmsOnboardingTimer() {
    if (state.smsOnboardingCountdownTimer) {
      clearInterval(state.smsOnboardingCountdownTimer);
      state.smsOnboardingCountdownTimer = null;
    }
    state.smsOnboardingExpiresAt = 0;
  }

  function setSmsOnboardingCodeMode(active) {
    const on = !!active;
    if (els.smsOnboardingCodeWrap) els.smsOnboardingCodeWrap.classList.toggle("hidden", !on);
    if (els.smsOnboardingVerifyBtn) els.smsOnboardingVerifyBtn.classList.toggle("hidden", !on);
    if (els.smsOnboardingSendCodeBtn) els.smsOnboardingSendCodeBtn.textContent = on ? "Send ny kode" : "Send kode";
  }

  function setSmsOnboardingBusy(busy, action = "") {
    const isBusy = !!busy;
    [
      els.smsOnboardingCountrySelect,
      els.smsOnboardingPhoneInput,
      els.smsOnboardingCodeInput,
      els.smsOnboardingSkipBtn,
      els.smsOnboardingSkipTopBtn,
      els.smsOnboardingSendCodeBtn,
      els.smsOnboardingVerifyBtn,
    ].forEach((el) => {
      if (el) el.disabled = isBusy;
    });
    if (els.smsOnboardingSendCodeBtn) {
      els.smsOnboardingSendCodeBtn.textContent = isBusy && action === "send" ? "Sender..." : (state.smsOnboardingExpiresAt ? "Send ny kode" : "Send kode");
    }
    if (els.smsOnboardingVerifyBtn) {
      els.smsOnboardingVerifyBtn.textContent = isBusy && action === "verify" ? "Tjekker..." : "Aktivér SMS";
    }
  }

  function updateSmsOnboardingTimer() {
    if (!els.smsOnboardingTimer) return;
    const remaining = Math.max(0, Math.ceil((state.smsOnboardingExpiresAt - Date.now()) / 1000));
    els.smsOnboardingTimer.textContent = remaining > 0
      ? `Koden udløber om ${remaining} sekunder.`
      : "Koden er udløbet. Send en ny kode.";
    if (remaining <= 0) {
      if (els.smsOnboardingVerifyBtn) els.smsOnboardingVerifyBtn.disabled = true;
      stopSmsOnboardingTimer();
    }
  }

  function startSmsOnboardingTimer(seconds) {
    stopSmsOnboardingTimer();
    state.smsOnboardingExpiresAt = Date.now() + Math.max(1, Number(seconds || 60)) * 1000;
    updateSmsOnboardingTimer();
    state.smsOnboardingCountdownTimer = window.setInterval(updateSmsOnboardingTimer, 1000);
  }

  function openSmsOnboardingModal(profile = {}) {
    if (!els.smsOnboardingModal) return;
    renderSmsCountryOptions(els.smsOnboardingCountrySelect);
    const countryCode = normalizeSmsCountryCodeClient(profile.sms_phone_country_code || SMS_DEFAULT_COUNTRY_CODE);
    ensureSmsCountryOption(els.smsOnboardingCountrySelect, countryCode);
    if (els.smsOnboardingCountrySelect) els.smsOnboardingCountrySelect.value = countryCode;
    if (els.smsOnboardingPhoneInput) els.smsOnboardingPhoneInput.value = normalizeSmsPhoneNumberClient(profile.sms_phone_number || "");
    if (els.smsOnboardingCodeInput) els.smsOnboardingCodeInput.value = "";
    updateSmsOnboardingPreview();
    setSmsOnboardingCodeMode(false);
    stopSmsOnboardingTimer();
    showStatus(els.smsOnboardingStatus, "");
    setSmsOnboardingBusy(false);
    els.smsOnboardingModal.classList.remove("hidden");
  }

  function closeSmsOnboardingModal() {
    stopSmsOnboardingTimer();
    if (els.smsOnboardingModal) els.smsOnboardingModal.classList.add("hidden");
    showStatus(els.smsOnboardingStatus, "");
  }

  async function maybeShowSmsOnboarding() {
    if (!SMS_ONBOARDING_LOGIN_PROMPT_ENABLED) return;
    if (state.role === "admin" || !els.smsOnboardingModal) return;
    try {
      const data = await api("/api/me/profile");
      const profile = data && data.profile ? data.profile : {};
      if (profile.sms_onboarding_required) {
        openSmsOnboardingModal(profile);
      }
    } catch (err) {
      // Keep login flow quiet if profile fetch fails; the Profile tab can still surface the error.
    }
  }

  async function skipSmsOnboarding() {
    try {
      setSmsOnboardingBusy(true, "skip");
      await api("/api/me/sms-onboarding/skip", { method: "POST" });
      closeSmsOnboardingModal();
    } catch (err) {
      showStatus(els.smsOnboardingStatus, err.message || "Kunne ikke gemme SMS-valg", "error");
    } finally {
      setSmsOnboardingBusy(false);
    }
  }

  async function sendSmsOnboardingCode() {
    const countryCode = normalizeSmsCountryCodeClient(
      (els.smsOnboardingCountrySelect && els.smsOnboardingCountrySelect.value) || SMS_DEFAULT_COUNTRY_CODE,
    );
    const phoneNumber = normalizeSmsPhoneNumberClient((els.smsOnboardingPhoneInput && els.smsOnboardingPhoneInput.value) || "");
    if (!phoneNumber) {
      showStatus(els.smsOnboardingStatus, "Indtast telefonnummer først.", "error");
      if (els.smsOnboardingPhoneInput) els.smsOnboardingPhoneInput.focus();
      return;
    }
    try {
      setSmsOnboardingBusy(true, "send");
      const data = await api("/api/me/sms-onboarding/send-code", {
        method: "POST",
        body: {
          sms_phone_country_code: countryCode,
          sms_phone_number: phoneNumber,
        },
      });
      setSmsOnboardingCodeMode(true);
      if (els.smsOnboardingCodeInput) {
        els.smsOnboardingCodeInput.value = "";
        els.smsOnboardingCodeInput.focus();
      }
      startSmsOnboardingTimer(Number(data && data.expires_in ? data.expires_in : 60));
      showStatus(els.smsOnboardingStatus, "Kode sendt. Indtast den inden den udløber.", "ok");
    } catch (err) {
      showStatus(els.smsOnboardingStatus, err.message || "Kunne ikke sende SMS-kode", "error");
    } finally {
      setSmsOnboardingBusy(false);
    }
  }

  async function verifySmsOnboardingCode() {
    const code = String((els.smsOnboardingCodeInput && els.smsOnboardingCodeInput.value) || "").replace(/\D/g, "");
    if (code.length !== 6) {
      showStatus(els.smsOnboardingStatus, "Indtast den 6-cifrede kode.", "error");
      if (els.smsOnboardingCodeInput) els.smsOnboardingCodeInput.focus();
      return;
    }
    try {
      setSmsOnboardingBusy(true, "verify");
      const data = await api("/api/me/sms-onboarding/verify", {
        method: "POST",
        body: { code },
      });
      applyMyProfile((data && data.profile) || {});
      showStatus(els.smsOnboardingStatus, "SMS opdateringer er aktiveret.", "ok");
      window.setTimeout(closeSmsOnboardingModal, 700);
    } catch (err) {
      showStatus(els.smsOnboardingStatus, err.message || "Kunne ikke verificere koden", "error");
    } finally {
      setSmsOnboardingBusy(false);
    }
  }

  const uploadUiState = {
    totalFiles: 0,
    totalBytes: 0,
    processedFiles: 0,
    processedBytes: 0,
    failedFiles: 0,
    currentFileName: "",
    currentPhaseLabel: "",
    currentLoaded: 0,
    currentTotal: 0,
    collapsed: false,
  };

  const uploadMonitorItemsByKey = new Map();
  let uploadTransferActive = false;
  let uploadStopRequested = false;
  let uploadWasStopped = false;
  let activeTusUpload = null;
  let uploadMonitorHideTimer = null;
  let uploadMonitorDomEventsBound = false;
  let globalDropDepth = 0;
  let internalImageDrag = false;

  function ensureUploadMonitorRefs() {
    if (!els.uploadMonitor) els.uploadMonitor = document.getElementById("uploadMonitor");
    if (!els.uploadMonitorToggle) els.uploadMonitorToggle = document.getElementById("uploadMonitorToggle");
    if (!els.uploadMonitorStop) els.uploadMonitorStop = document.getElementById("uploadMonitorStop");
    if (!els.uploadMonitorBar) els.uploadMonitorBar = document.getElementById("uploadMonitorBar");
    if (!els.uploadMonitorSummary) els.uploadMonitorSummary = document.getElementById("uploadMonitorSummary");
    if (!els.uploadMonitorCurrent) els.uploadMonitorCurrent = document.getElementById("uploadMonitorCurrent");
    if (!els.uploadMonitorList) els.uploadMonitorList = document.getElementById("uploadMonitorList");
  }

  function ensureUploadOverlayRefs() {
    if (!els.uploadOverlay) els.uploadOverlay = document.getElementById("uploadOverlay");
    if (!els.uploadProgressBar) els.uploadProgressBar = document.getElementById("uploadProgressBar");
    if (!els.uploadProgressText) els.uploadProgressText = document.getElementById("uploadProgressText");
  }

  function canUploadFromCurrentView() {
    const filesVisible = !!(els.tabFiles && !els.tabFiles.classList.contains("hidden"));
    const folder = currentFolder() || state.homeFolder || "";
    return filesVisible && !state.selectMode && folderAllowsUserWrites(folder);
  }

  function showGlobalDropOverlay() {
    ensureUploadOverlayRefs();
    if (!els.uploadOverlay) return;
    const canUploadHere = canUploadFromCurrentView();
    const targetFolder = String(currentFolder() || state.homeFolder || "").trim();
    const filesVisible = !!(els.tabFiles && !els.tabFiles.classList.contains("hidden"));
    const writeAllowed = folderAllowsUserWrites(targetFolder);
    const titleEl = els.uploadOverlay.querySelector(".upload-title");
    if (titleEl) {
      titleEl.textContent = canUploadHere
        ? "Slip filer eller mapper for at uploade"
        : (filesVisible && !writeAllowed ? "Åbn en datomappe for at uploade" : "Upload er ikke aktiv her");
    }
    if (els.uploadProgressText) {
      els.uploadProgressText.textContent = canUploadHere
        ? `Upload destination: ${targetFolder || "(ingen mappe valgt)"}`
        : (filesVisible && !writeAllowed ? "Upload er kun aktiv inde i datomapper." : "Gå til Mapper for at uploade");
    }
    if (els.uploadProgressBar) {
      els.uploadProgressBar.style.width = canUploadHere ? "100%" : "0%";
    }
    els.uploadOverlay.classList.toggle("upload-ready", canUploadHere);
    els.uploadOverlay.classList.toggle("upload-blocked", !canUploadHere);
    els.uploadOverlay.classList.remove("hidden");
    els.uploadOverlay.classList.add("active");
  }

  function hideGlobalDropOverlay() {
    ensureUploadOverlayRefs();
    if (!els.uploadOverlay) return;
    els.uploadOverlay.classList.remove("active", "upload-ready", "upload-blocked");
    els.uploadOverlay.classList.add("hidden");
  }

  function isUploadRunning() {
    return !!uploadTransferActive;
  }

  function resetUploadUiState() {
    uploadUiState.totalFiles = 0;
    uploadUiState.totalBytes = 0;
    uploadUiState.processedFiles = 0;
    uploadUiState.processedBytes = 0;
    uploadUiState.failedFiles = 0;
    uploadUiState.currentFileName = "";
    uploadUiState.currentPhaseLabel = "";
    uploadUiState.currentLoaded = 0;
    uploadUiState.currentTotal = 0;
    uploadMonitorItemsByKey.clear();
    if (els.uploadMonitorList) els.uploadMonitorList.innerHTML = "";
  }

  function setUploadStopButtonState() {
    ensureUploadMonitorRefs();
    if (!els.uploadMonitorStop) return;
    const running = isUploadRunning();
    els.uploadMonitorStop.disabled = !running || uploadStopRequested;
    els.uploadMonitorStop.textContent = uploadStopRequested ? "Stopper..." : "Stop upload";
  }

  function _uploadItemKey(name, index = null) {
    const safeName = String(name || "").trim() || "(ukendt fil)";
    return index === null || index === undefined
      ? safeName
      : `${safeName}::${String(index)}`;
  }

  function _setUploadMonitorItemProgress(key, pct) {
    const ref = uploadMonitorItemsByKey.get(String(key || ""));
    if (!ref || !ref.progressBar) return;
    const value = Math.max(0, Math.min(100, Number(pct || 0)));
    ref.progressBar.style.width = `${value}%`;
  }

  function updateUploadMonitorItem(key, ok, detail = "", progressPct = null) {
    const ref = uploadMonitorItemsByKey.get(String(key || ""));
    if (!ref || !ref.statusEl) return;
    ref.statusEl.classList.remove("ok", "error", "work");
    ref.statusEl.classList.add(ok === null ? "work" : (ok ? "ok" : "error"));
    ref.statusEl.textContent = String(detail || (ok === null ? "Arbejder..." : (ok ? "OK" : "Fejl")));
    if (progressPct !== null && progressPct !== undefined) {
      _setUploadMonitorItemProgress(key, progressPct);
    }
  }

  function isUploadAbortError(error) {
    const msg = String((error && error.message) || error || "").toLowerCase();
    return msg.includes("abort") || msg.includes("aborted") || msg.includes("cancel");
  }

  function requestStopUpload() {
    if (!isUploadRunning() || uploadStopRequested) return;
    uploadStopRequested = true;
    uploadWasStopped = true;
    uploadUiState.currentFileName = "Stopper upload...";
    try {
      if (activeTusUpload && typeof activeTusUpload.abort === "function") {
        activeTusUpload.abort();
      }
    } catch (_err) {
      // ignore
    }
    setUploadStopButtonState();
    renderUploadMonitor();
  }

  function renderUploadMonitor() {
    ensureUploadMonitorRefs();

    const transferLoaded = uploadTransferActive ? uploadUiState.currentLoaded : 0;
    const processedVisualBytes = Math.min(uploadUiState.totalBytes, uploadUiState.processedBytes + transferLoaded);
    const overallPct = uploadUiState.totalBytes > 0
      ? Math.max(0, Math.min(100, Math.round((processedVisualBytes / uploadUiState.totalBytes) * 100)))
      : 0;

    if (!els.uploadMonitor) return;
    setUploadStopButtonState();

    if (els.uploadMonitorBar) {
      els.uploadMonitorBar.style.width = `${overallPct}%`;
    }

    if (els.uploadMonitorSummary) {
      const failedTxt = uploadUiState.failedFiles ? ` · fejl: ${uploadUiState.failedFiles}` : "";
      els.uploadMonitorSummary.textContent = `${uploadUiState.processedFiles}/${uploadUiState.totalFiles} filer · ${formatSize(processedVisualBytes)}/${formatSize(uploadUiState.totalBytes)} · ${overallPct}%${failedTxt}`;
    }

    if (els.uploadMonitorCurrent) {
      if (uploadUiState.currentFileName) {
        const filePct = uploadUiState.currentTotal > 0
          ? Math.max(0, Math.min(100, Math.round((uploadUiState.currentLoaded / uploadUiState.currentTotal) * 100)))
          : 0;
        const phasePrefix = String(uploadUiState.currentPhaseLabel || "").trim() || "Uploader";
        els.uploadMonitorCurrent.textContent = `${phasePrefix}: ${uploadUiState.currentFileName} (${filePct}%)`;
      } else {
        els.uploadMonitorCurrent.textContent = uploadUiState.totalFiles
          ? "Upload fuldført"
          : "Ingen aktiv upload";
      }
    }

    try {
      const transferDone = !isUploadRunning() && uploadUiState.totalFiles > 0;
      if (transferDone) {
        if (!uploadMonitorHideTimer) {
          uploadMonitorHideTimer = window.setTimeout(() => {
            if (!els.uploadMonitor) {
              uploadMonitorHideTimer = null;
              return;
            }
            try {
              els.uploadMonitor.style.transition = "opacity .35s ease";
              els.uploadMonitor.style.opacity = "0";
              window.setTimeout(() => {
                try {
                  els.uploadMonitor.classList.add("hidden");
                  els.uploadMonitor.style.opacity = "";
                  els.uploadMonitor.style.transition = "";
                } catch (_err) {
                  // ignore
                }
              }, 380);
            } catch (_err) {
              // ignore
            }
            uploadMonitorHideTimer = null;
          }, 1800);
        }
      } else if (uploadMonitorHideTimer) {
        window.clearTimeout(uploadMonitorHideTimer);
        uploadMonitorHideTimer = null;
      }
    } catch (_err) {
      // ignore
    }
  }

  function showUploadMonitor() {
    ensureUploadMonitorRefs();
    bindUploadMonitorDomEvents();
    if (els.uploadMonitor) {
      els.uploadMonitor.classList.remove("hidden");
      try {
        els.uploadMonitor.style.opacity = "1";
        els.uploadMonitor.style.transition = "";
      } catch (_err) {
        // ignore
      }
    }
    if (uploadMonitorHideTimer) {
      window.clearTimeout(uploadMonitorHideTimer);
      uploadMonitorHideTimer = null;
    }
    const collapsed = !!uploadUiState.collapsed;
    if (els.uploadMonitor) els.uploadMonitor.classList.toggle("collapsed", collapsed);
    if (els.uploadMonitorToggle) {
      els.uploadMonitorToggle.textContent = collapsed ? "Vis detaljer" : "Minimer";
    }
    setUploadStopButtonState();
  }

  function addUploadMonitorItem(name, ok, detail = "", key = null, progressPct = null) {
    ensureUploadMonitorRefs();
    if (!els.uploadMonitorList) return;

    const li = document.createElement("li");
    li.className = "upload-monitor-item";
    const safeName = String(name || "").trim() || "(ukendt fil)";
    const itemKey = String(key || _uploadItemKey(safeName));
    const statusClass = ok === null ? "work" : (ok ? "ok" : "error");
    const statusText = ok === null ? "Arbejder..." : (ok ? "OK" : "Fejl");

    li.innerHTML = `
      <div class="upload-monitor-item-top">
        <span class="upload-monitor-item-name" title="${esc(safeName)}">${esc(safeName)}</span>
        <span class="upload-monitor-item-status ${statusClass}">${esc(detail || statusText)}</span>
      </div>
      <div class="upload-monitor-item-progress"><span class="upload-monitor-item-progress-bar" style="width:${Math.max(0, Math.min(100, Number(progressPct || 0)))}%"></span></div>
    `;

    els.uploadMonitorList.insertBefore(li, els.uploadMonitorList.firstChild || null);
    uploadMonitorItemsByKey.set(itemKey, {
      el: li,
      statusEl: li.querySelector(".upload-monitor-item-status"),
      progressBar: li.querySelector(".upload-monitor-item-progress-bar"),
    });

    while (els.uploadMonitorList.children.length > 8) {
      const last = els.uploadMonitorList.lastChild;
      if (!last) break;
      uploadMonitorItemsByKey.forEach((value, k) => {
        if (value && value.el === last) uploadMonitorItemsByKey.delete(k);
      });
      els.uploadMonitorList.removeChild(last);
    }
  }

  function bindUploadMonitorDomEvents() {
    if (uploadMonitorDomEventsBound) return;
    document.addEventListener("click", (event) => {
      const toggleBtn = event && event.target && event.target.closest
        ? event.target.closest("#uploadMonitorToggle")
        : null;
      if (toggleBtn) {
        uploadUiState.collapsed = !uploadUiState.collapsed;
        showUploadMonitor();
        return;
      }

      const stopBtn = event && event.target && event.target.closest
        ? event.target.closest("#uploadMonitorStop")
        : null;
      if (stopBtn) {
        if (stopBtn.disabled) return;
        requestStopUpload();
      }
    });
    uploadMonitorDomEventsBound = true;
  }

  async function api(path, options = {}) {
    const init = Object.assign({ credentials: "same-origin" }, options);
    if (init.body && typeof init.body === "object" && !(init.body instanceof FormData)) {
      init.headers = Object.assign({}, init.headers, { "Content-Type": "application/json" });
      init.body = JSON.stringify(init.body);
    }
    const res = await fetch(path, init);
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { ok: false, error: text || "Ugyldigt svar fra server" };
    }
    if (!res.ok || data.ok === false) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function formatSize(bytes) {
    const n = Number(bytes || 0);
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    const val = n / Math.pow(1024, idx);
    return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  }

  function formatDateDa(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("da-DK");
  }

  const SCALE_UP_UNITS = new Set(["%", "mm", "cm", "m"]);

  function scaleUpUnit(value) {
    const unit = String(value || "%").trim();
    return SCALE_UP_UNITS.has(unit) ? unit : "%";
  }

  function normalizeScaleUpValue(value) {
    const raw = String(value || "").trim().replace(",", ".");
    if (!raw) return "";
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error("Angiv hvor meget større filen skal printes.");
    }
    return String(num);
  }

  function scaleUpLabel(item) {
    if (!item || !item.scale_up_enabled) return "";
    const value = String(item.scale_up_value || "").trim();
    if (!value) return "";
    return `${value} ${scaleUpUnit(item.scale_up_unit)}`;
  }

  function setScaleUpControls(enabledEl, controlsEl, valueEl, unitEl, enabled) {
    const isEnabled = !!enabled;
    if (enabledEl) enabledEl.checked = isEnabled;
    if (controlsEl) controlsEl.classList.toggle("is-disabled", !isEnabled);
    if (valueEl) valueEl.disabled = !isEnabled;
    if (unitEl) unitEl.disabled = !isEnabled;
  }

  const SCALE_CAN_HEIGHT_MM = 122;
  const SCALE_CAN_DIAMETER_MM = 66;
  const PRESENTATION_TABLE_SIZE_MM = 600;
  const DEFAULT_SLICE_BED_SIZE_MM = Object.freeze({ width_mm: 256, depth_mm: 256 });
  const BED_MAP_CUSTOM_MODEL_KEY = "custom";
  const BED_MAP_MANUFACTURERS = Object.freeze([
    { key: "bambu-lab", name: "Bambu Lab" },
  ]);
  const BAMBU_BED_MODEL_PRESETS = Object.freeze([
    // Official product specs as of 2026-04-13.
    { key: "bambu-h2d", name: "H2D / H2D Laser (350×320)", width_mm: 350, depth_mm: 320 },
    { key: "bambu-h2d-pro", name: "H2D Pro (350×320)", width_mm: 350, depth_mm: 320 },
    { key: "bambu-a1-mini", name: "A1 mini (180×180)", width_mm: 180, depth_mm: 180 },
    { key: "bambu-a1", name: "A1 (256×256)", width_mm: 256, depth_mm: 256 },
    { key: "bambu-p1s", name: "P1S (256×256)", width_mm: 256, depth_mm: 256 },
    { key: "bambu-p1p", name: "P1P (256×256)", width_mm: 256, depth_mm: 256 },
    { key: "bambu-x1-carbon", name: "X1 Carbon (256×256)", width_mm: 256, depth_mm: 256 },
    { key: "bambu-x1e", name: "X1E (256×256)", width_mm: 256, depth_mm: 256 },
    { key: "bambu-x1", name: "X1 (256×256)", width_mm: 256, depth_mm: 256 },
  ]);
  const BED_MAP_MODEL_PRESETS = Object.freeze({
    "bambu-lab": BAMBU_BED_MODEL_PRESETS,
  });
  const BED_MAP_MODEL_LOOKUP = new Map(
    Object.values(BED_MAP_MODEL_PRESETS)
      .flat()
      .map((entry) => [String(entry.key || ""), entry])
  );
  const SLICER_PLATE_MODEL_ALIASES = Object.freeze({
    "bambu-a1-mini": ["a1m", "a1-mini", "a1mini"],
    "bambu-a1": ["a1"],
    "bambu-p1s": ["p1s", "p1", "o1s"],
    "bambu-p1p": ["p1p", "p1", "o1s"],
    "bambu-x1": ["x1"],
    "bambu-x1-carbon": ["x1c", "x1-carbon", "x1"],
    "bambu-x1e": ["x1e", "x1"],
    "bambu-h2d": ["h2d", "h2c"],
    "bambu-h2d-pro": ["h2dpro", "h2d-pro", "h2d", "h2c"],
  });
  const KNOWN_PRINTER_MODELS = Object.freeze([
    { key: "", name: "Auto / fra profil", width_mm: 0, depth_mm: 0 },
    { key: "bambu-h2d", name: "Bambu Lab H2D (350×320)", width_mm: 350, depth_mm: 320 },
    { key: "bambu-a1-mini", name: "Bambu Lab A1 mini (180×180)", width_mm: 180, depth_mm: 180 },
    { key: "bambu-a1", name: "Bambu Lab A1 (256×256)", width_mm: 256, depth_mm: 256 },
    { key: "bambu-p1", name: "Bambu Lab P1P/P1S (256×256)", width_mm: 256, depth_mm: 256 },
    { key: "bambu-x1", name: "Bambu Lab X1/X1C/X1E (256×256)", width_mm: 256, depth_mm: 256 },
    { key: "generic-220", name: "Generic 220×220", width_mm: 220, depth_mm: 220 },
    { key: "generic-235", name: "Generic 235×235", width_mm: 235, depth_mm: 235 },
    { key: "generic-300", name: "Generic 300×300", width_mm: 300, depth_mm: 300 },
  ]);
  const SLICE_LIFT_RANGE_MM = Object.freeze({ min: 0, max: 80, step: 0.5 });
  const SLICE_SUPPORT_MODE_VALUES = new Set(["auto", "on", "off"]);
  const SLICE_SUPPORT_TYPE_VALUES = new Set(["", "tree(auto)", "normal(auto)"]);
  const SLICE_SUPPORT_STYLE_TREE_VALUES = Object.freeze(["default", "tree_slim", "tree_strong", "tree_hybrid", "tree_organic"]);
  const SLICE_SUPPORT_STYLE_NORMAL_VALUES = Object.freeze(["default", "grid", "snug"]);
  const SLICE_SUPPORT_STYLE_ALL_VALUES = Object.freeze(
    Array.from(new Set([...SLICE_SUPPORT_STYLE_TREE_VALUES, ...SLICE_SUPPORT_STYLE_NORMAL_VALUES]))
  );
  const SLICE_SUPPORT_STYLE_VALUES = new Set(["", ...SLICE_SUPPORT_STYLE_ALL_VALUES]);
  const SLICE_NOZZLE_DIAMETER_VALUES = new Set(["", "0.2", "0.4", "0.6", "0.8", "1.0"]);
  const SLICE_NOZZLE_FLOW_VALUES = new Set(["", "standard", "high_flow"]);
  const GLTF_UNIT_CONTEXT = Object.freeze({
    unitKey: "m",
    unitLabel: "m",
    mmPerUnit: 1000,
    confidence: "high",
    source: "gltf-standard",
    canHeightUnits: SCALE_CAN_HEIGHT_MM / 1000,
    canDiameterUnits: SCALE_CAN_DIAMETER_MM / 1000,
    alternatives: [],
  });

  function modelControlsText(mode = "orbit") {
    if (mode === "fly") {
      return "Venstre træk: kig rundt. Højre træk: roter omkring objekt. Scroll: zoom. W/A/S/D + piletaster + R/F bevæger. Shift = hurtigere.";
    }
    return "Mobil: 1 finger roter, 2 fingre zoom.";
  }

  function formatNumberCompact(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0";
    const abs = Math.abs(n);
    let decimals = 2;
    if (abs >= 100) decimals = 0;
    else if (abs >= 10) decimals = 1;
    else if (abs >= 1) decimals = 2;
    else decimals = 3;
    return n.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  }

  function formatGrams(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return `${formatNumberCompact(n)} g`;
  }

  function formatKr(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return `${n.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`;
  }

  function extractUnitHintFromFilename(filename = "") {
    const name = String(filename || "").toLowerCase();
    if (!name) return "";
    const token = "(?:^|[ _\\-.])";
    const tail = "(?:$|[ _\\-.])";
    if (new RegExp(`${token}(mm|millimeter|millimeters|millimetre|millimetres)${tail}`).test(name)) return "mm";
    if (new RegExp(`${token}(cm|centimeter|centimeters|centimetre|centimetres)${tail}`).test(name)) return "cm";
    if (new RegExp(`${token}(in|inch|inches)${tail}`).test(name)) return "in";
    if (new RegExp(`${token}(m|meter|meters|metre|metres)${tail}`).test(name)) return "m";
    return "";
  }

  function buildModelUnitContext(rawHeightUnits = 0, filename = "") {
    const raw = Number(rawHeightUnits || 0);
    const candidates = [
      { unitKey: "mm", unitLabel: "mm", mmPerUnit: 1, priorPenalty: 0 },
      { unitKey: "cm", unitLabel: "cm", mmPerUnit: 10, priorPenalty: 0.45 },
      { unitKey: "in", unitLabel: "inch", mmPerUnit: 25.4, priorPenalty: 0.7 },
      { unitKey: "m", unitLabel: "m", mmPerUnit: 1000, priorPenalty: 1.2 },
    ];
    const defaultContext = {
      unitKey: "mm",
      unitLabel: "mm",
      mmPerUnit: 1,
      confidence: "low",
      source: "fallback",
      canHeightUnits: SCALE_CAN_HEIGHT_MM,
      canDiameterUnits: SCALE_CAN_DIAMETER_MM,
      alternatives: [],
    };
    if (!Number.isFinite(raw) || raw <= 0) return defaultContext;

    const hint = extractUnitHintFromFilename(filename);

    // Most STL/OBJ exports from slicer workflows are already in mm.
    // Keep a conservative default in common model size ranges unless filename explicitly hints another unit.
    if (!hint) {
      const assumedMmHeight = raw;
      if (assumedMmHeight >= 8 && assumedMmHeight <= 1200) {
        return {
          unitKey: "mm",
          unitLabel: "mm",
          suggestedUnitKey: "mm",
          suggestedUnitLabel: "mm",
          mmPerUnit: 1,
          confidence: "medium",
          source: "default-mm-range",
          canHeightUnits: SCALE_CAN_HEIGHT_MM,
          canDiameterUnits: SCALE_CAN_DIAMETER_MM,
          alternatives: candidates.slice(0, 4).map((candidate) => ({
            unitKey: candidate.unitKey,
            unitLabel: candidate.unitLabel,
            heightMm: raw * candidate.mmPerUnit,
          })),
        };
      }
    }

    const scoreHeightMm = (heightMm, priorPenalty = 0) => {
      const h = Number(heightMm || 0);
      if (!Number.isFinite(h) || h <= 0) return 999;
      const center = 220;
      let score = Math.abs(Math.log(h / center)) + priorPenalty;
      if (h < 20 || h > 5000) score += 1.25;
      if (h < 5 || h > 20000) score += 2.4;
      return score;
    };

    const scored = candidates
      .map((candidate) => {
        const heightMm = raw * candidate.mmPerUnit;
        let score = scoreHeightMm(heightMm, candidate.priorPenalty);
        if (hint && hint === candidate.unitKey) score -= 2.2;
        return {
          candidate,
          heightMm,
          score,
        };
      })
      .sort((a, b) => a.score - b.score);

    const best = scored[0];
    const second = scored[1];
    const margin = second ? (second.score - best.score) : 1;
    const confidence = hint
      ? "high"
      : (margin >= 1.1 ? "high" : (margin >= 0.5 ? "medium" : "low"));

    const mmCandidate = candidates[0];
    const guessed = best.candidate;
    const useConservativeMm = !hint && guessed.unitKey !== "mm" && confidence !== "high";
    const selected = useConservativeMm ? mmCandidate : guessed;
    const resolvedConfidence = useConservativeMm ? "low" : confidence;
    const resolvedSource = hint
      ? "filename"
      : (useConservativeMm ? "auto-mm-fallback" : "auto");

    const mmPerUnit = Number(selected.mmPerUnit || 1);
    const canHeightUnits = SCALE_CAN_HEIGHT_MM / mmPerUnit;
    const canDiameterUnits = SCALE_CAN_DIAMETER_MM / mmPerUnit;

    return {
      unitKey: selected.unitKey,
      unitLabel: selected.unitLabel,
      suggestedUnitKey: guessed.unitKey,
      suggestedUnitLabel: guessed.unitLabel,
      mmPerUnit,
      confidence: resolvedConfidence,
      source: resolvedSource,
      canHeightUnits,
      canDiameterUnits,
      alternatives: scored.slice(0, 4).map((entry) => ({
        unitKey: entry.candidate.unitKey,
        unitLabel: entry.candidate.unitLabel,
        heightMm: entry.heightMm,
      })),
    };
  }

  function formatModelHeight(value, unitContext = null) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return "";
    return `Højde: ${formatHeightDisplayValue(n, unitContext)}`;
  }

  function formatHeightDisplayValue(value, unitContext = null) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return "Ukendt";
    if (unitContext && Number.isFinite(Number(unitContext.mmPerUnit)) && Number(unitContext.mmPerUnit) > 0) {
      const mmPerUnit = Number(unitContext.mmPerUnit);
      const label = String(unitContext.unitLabel || "mm");
      const confidence = String(unitContext.confidence || "low");
      const mmValue = n * mmPerUnit;
      const prettyMm = formatNumberCompact(mmValue);
      if (label === "mm") {
        if (confidence === "low") return `${prettyMm} mm (auto-usikker)`;
        if (confidence === "medium") return `${prettyMm} mm (auto: mm)`;
        return `${prettyMm} mm`;
      }
      const rawPretty = formatNumberCompact(n);
      if (confidence === "low") return `${prettyMm} mm (auto-usikker: ${rawPretty} ${label}?)`;
      if (confidence === "medium") return `${prettyMm} mm (auto: ${rawPretty} ${label})`;
      return `${prettyMm} mm (fra ${rawPretty} ${label})`;
    }
    const pretty = n >= 100 ? n.toFixed(0) : n.toFixed(1);
    return `${pretty} mm (forudsat mm-eksport)`;
  }

  function buildUnitHintText(unitContext = null) {
    if (!unitContext) return "Enheder: forudsat mm.";
    const label = String(unitContext.unitLabel || "mm");
    const suggestedLabel = String(unitContext.suggestedUnitLabel || label);
    const source = String(unitContext.source || "auto");
    const confidence = String(unitContext.confidence || "low");

    if (source === "gltf-standard") {
      return "Enheder: glTF bruger meter, vises konverteret til mm.";
    }
    if (source === "filename") {
      return `Enheder: læst som ${label} fra filnavn, konverteret til mm.`;
    }
    if (source === "default-mm-range") {
      return "Enheder: standard STL/OBJ antaget som mm (konservativt default).";
    }
    if (source === "auto-mm-fallback") {
      return `Enheder: auto-gæt var ${suggestedLabel}, men vises konservativt som mm.`;
    }
    if (confidence === "high") {
      return `Enheder: auto-gættet som ${label}, konverteret til mm.`;
    }
    if (confidence === "medium") {
      return `Enheder: auto-gæt ${label}, konverteret til mm.`;
    }

    if (Array.isArray(unitContext.alternatives) && unitContext.alternatives.length > 1) {
      const alt = unitContext.alternatives
        .slice(0, 3)
        .map((item) => `${formatNumberCompact(item.heightMm)} mm (${item.unitLabel})`)
        .join(" / ");
      return `Enheder usikre. Mulige højder: ${alt}.`;
    }
    return `Enheder usikre (auto-gæt: ${label}).`;
  }

  function setModelHintMessage(message = "") {
    if (!els.modelHint) return;
    const text = String(message || "").trim();
    els.modelHint.textContent = text;
    els.modelHint.classList.toggle("hidden", !text);
  }

  function setModelPreviewLoading(loading = false, pane = "") {
    const isLoading = !!loading;
    const targetPane = String(pane || "").toLowerCase();
    const viewerLoading = isLoading && targetPane === "viewer";
    const threeLoading = isLoading && targetPane === "three";

    if (els.modelViewerPane) {
      els.modelViewerPane.classList.toggle("loading", viewerLoading);
      els.modelViewerPane.setAttribute("aria-busy", viewerLoading ? "true" : "false");
    }
    if (els.threePane) {
      els.threePane.classList.toggle("loading", threeLoading);
      els.threePane.setAttribute("aria-busy", threeLoading ? "true" : "false");
    }
  }

  function updateModelInfoBar({ controls = "", height = "", scale = "" } = {}) {
    if (els.modelControlHint) {
      els.modelControlHint.textContent = String(controls || modelControlsText());
    }
    if (els.modelHeightHint) {
      els.modelHeightHint.textContent = String(height || "-");
    }
    if (els.modelScaleHint) {
      els.modelScaleHint.textContent = String(scale || `Dåse ${SCALE_CAN_HEIGHT_MM}x${SCALE_CAN_DIAMETER_MM} mm`);
    }
  }

  function buildModelHint(heightValue = 0, extras = [], controlsText = modelControlsText("orbit"), unitContext = null) {
    const controls = String(controlsText || modelControlsText("orbit"));
    const heightText = formatModelHeight(heightValue, unitContext);
    const parts = [controls];
    if (heightText) parts.push(heightText);
    if (Array.isArray(extras) && extras.length) {
      extras.forEach((part) => {
        const text = String(part || "").trim();
        if (text) parts.push(text);
      });
    }
    return parts.join(" ");
  }

  function mobileActionForTab(tab) {
    const key = String(tab || "").toLowerCase();
    if (key === "files") return "files";
    if (key === "settings" && state.role === "admin") return "settings";
    return "";
  }

  function setMobileNavActive(action = "") {
    if (!els.mobileBottomNav) return;
    const active = String(action || "").trim().toLowerCase();
    const buttons = Array.from(els.mobileBottomNav.querySelectorAll(".mobile-nav-item"));
    buttons.forEach((btn) => {
      const btnAction = String(btn.dataset.mobileAction || "").trim().toLowerCase();
      btn.classList.toggle("active", !!active && btnAction === active);
    });
  }

  function openMobileDrawer() {
    document.body.classList.add("mobile-drawer-open");
    if (els.mobileSidebarBackdrop) {
      els.mobileSidebarBackdrop.classList.remove("hidden");
    }
    setMobileNavActive("navigate");
  }

  function closeMobileDrawer() {
    document.body.classList.remove("mobile-drawer-open");
    if (els.mobileSidebarBackdrop) {
      els.mobileSidebarBackdrop.classList.add("hidden");
    }
    if (els.profileModal && !els.profileModal.classList.contains("hidden")) {
      setMobileNavActive("profile");
      return;
    }
    setMobileNavActive(mobileActionForTab(state.currentTab));
  }

  function setTab(tab) {
    const target = String(tab || "files");
    state.currentTab = target;
    const map = {
      files: els.tabFiles,
      "print-ready": els.tabPrintReady,
      "finished-projects": els.tabFinishedProjects,
      "rejected-file-types": els.tabRejectedFileTypes,
      settings: els.tabSettings,
      tracking: els.tabTracking,
    };
    Object.entries(map).forEach(([key, section]) => {
      if (!section) return;
      section.classList.toggle("hidden", key !== target);
    });
    const navButtons = Array.from((els.sidebarNav && els.sidebarNav.querySelectorAll(".nav-item")) || []);
    navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === target));
    if (els.profileFooterBtn && target !== "profile") els.profileFooterBtn.classList.remove("active");
    if (els.contentHeader) {
      els.contentHeader.classList.toggle("hidden", target === "files");
    }
    const tabMeta = TABS[target] || { title: "Fjord3D", subtitle: "" };
    if (els.pageTitle) els.pageTitle.textContent = tabMeta.title || "Fjord3D";
    if (els.pageSubtitle) els.pageSubtitle.textContent = tabMeta.subtitle || "";

    if (target === "settings" && state.role === "admin") {
      setSettingsTab(state.currentSettingsTab || "shares");
    }
    if (target !== "files" && state.selectMode) {
      toggleSelectMode(false);
    }
    if (target !== "files" && state.currentInfoFileId) {
      closeFileInfoDrawer();
    }
    if (els.thumbTopStatus) {
      if (target !== "files") setThumbTopStatusVisible(false, false);
      else updateThumbTopStatus();
    }
    if (target !== "files") {
      clearNewUploadsDwellTimer();
    } else {
      scheduleNewUploadsDwellSeen();
    }
    if (!document.body.classList.contains("mobile-drawer-open")
      && !(els.profileModal && !els.profileModal.classList.contains("hidden"))) {
      setMobileNavActive(mobileActionForTab(target));
    }
  }

  function updateStats() {
    if (els.statFiles) els.statFiles.textContent = String(Array.isArray(state.files) ? state.files.length : 0);
    if (els.statFolders) els.statFolders.textContent = String(Array.isArray(state.folders) ? state.folders.length : 0);
    if (els.statShares) {
      const value = state.role === "admin" ? (Array.isArray(state.shares) ? state.shares.length : 0) : 0;
      els.statShares.textContent = String(value);
    }
  }

  function normalizePrintReadyProjectStatus(statusValue) {
    const status = String(statusValue || "ready").trim().toLowerCase();
    return status || "ready";
  }

  function isFinalPrintReadyProjectStatus(statusValue) {
    const status = normalizePrintReadyProjectStatus(statusValue);
    return status === "completed" || status === "cancelled";
  }

  function countActivePrintReadyProjects(projects) {
    return Array.from(projects || []).reduce((count, project) => {
      if (!project || isFinalPrintReadyProjectStatus(project.status)) return count;
      return count + 1;
    }, 0);
  }

  function updatePrintReadyNavBadge() {
    if (!els.printReadyNavBadge) return;
    if (state.role !== "admin") {
      els.printReadyNavBadge.textContent = "0";
      els.printReadyNavBadge.classList.add("hidden");
      return;
    }

    const count = countActivePrintReadyProjects(state.printReadyProjects);
    if (count <= 0) {
      els.printReadyNavBadge.textContent = "0";
      els.printReadyNavBadge.classList.add("hidden");
      return;
    }

    els.printReadyNavBadge.textContent = count > 99 ? "99+" : String(count);
    els.printReadyNavBadge.classList.remove("hidden");
  }

  function setSettingsTab(tab) {
    const target = String(tab || "shares");
    state.currentSettingsTab = target;

    const panelMap = {
      shares: els.settingsPanelShares,
      dns: els.settingsPanelDns,
      users: els.settingsPanelUsers,
      makerworld: els.settingsPanelMakerworld,
      sms: els.settingsPanelSms,
      logs: els.settingsPanelLogs,
      slicer: els.settingsPanelSlicer,
    };
    Object.entries(panelMap).forEach(([key, panel]) => {
      if (!panel) return;
      panel.classList.toggle("hidden", key !== target);
    });

    const buttons = Array.from((els.settingsTabs && els.settingsTabs.querySelectorAll(".tab-btn[data-settings-tab]")) || []);
    buttons.forEach((btn) => btn.classList.toggle("active", btn.dataset.settingsTab === target));

    if (els.settingsTabSelect) {
      els.settingsTabSelect.value = target;
    }
  }

  function applyRoleVisibility() {
    const isAdmin = state.role === "admin";
    els.adminOnly.forEach((node) => {
      if (!node) return;
      if (isAdmin) node.classList.remove("hidden");
      else node.classList.add("hidden");
    });
    if (!isAdmin) {
      setTab("files");
      clearNewUploadsDwellTimer();
      state.unseenUploadsTotal = 0;
      state.unseenUploads = [];
    }
    renderUnseenUploadsOverlay();
    updatePrintReadyNavBadge();
    updateStats();
  }

  function parentFolder(path) {
    const value = String(path || "").trim();
    if (!value || !value.includes("/")) return "";
    const parts = value.split("/").filter(Boolean);
    if (parts.length <= 1) return "";
    parts.pop();
    return parts.join("/");
  }

  function currentFolder() {
    return String((els.folderSelect && els.folderSelect.value) || state.currentFolder || "");
  }

  function normalizeFolderPath(value) {
    return String(value || "")
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .join("/");
  }

  function pathMatchesPrefix(path, prefix) {
    const value = String(path || "").trim();
    const base = String(prefix || "").trim();
    return !!base && (value === base || value.startsWith(`${base}/`));
  }

  function isDateFolderSegment(value) {
    const segment = String(value || "").trim();
    return /^\d{2}-\d{2}-\d{4}$/.test(segment) || /^\d{4}-\d{2}-\d{2}$/.test(segment);
  }

  function folderAllowsUploadTarget(folderPath, allowUsersSubfolders = false) {
    const folder = normalizeFolderPath(folderPath);
    if (!folder) return false;
    const parts = folder.split("/").filter(Boolean);
    if (String(parts[0] || "").toLowerCase() === "users") {
      if (parts.length === 1) return false;
      if (allowUsersSubfolders) return true;
      return parts.length >= 3 && isDateFolderSegment(parts[2]);
    }
    return true;
  }

  function folderAllowsUserWrites(folderPath) {
    const folder = normalizeFolderPath(folderPath);
    const allowUsersSubfolders = state.role === "admin";
    if (!folderAllowsUploadTarget(folder, allowUsersSubfolders)) return false;
    if (state.role === "admin") return true;
    const home = normalizeFolderPath(state.homeFolder);
    if (!home || !folder || folder === home || !folder.startsWith(`${home}/`)) return false;
    const relative = folder.slice(home.length + 1);
    const daySegment = relative.split("/").filter(Boolean)[0] || "";
    if (!isDateFolderSegment(daySegment)) return false;
    const dayPath = `${home}/${daySegment}`;
    const bootDaily = normalizeFolderPath(state.dailyFolder);
    if (bootDaily && dayPath === bootDaily) return true;
    return state.folders.some((item) => normalizeFolderPath(item && item.path) === dayPath);
  }

  function currentFolderAllowsUserWrites() {
    return folderAllowsUserWrites(currentFolder() || state.homeFolder || "");
  }

  function adminUsersRootFolderPath() {
    const home = normalizeFolderPath(state.homeFolder);
    return normalizeFolderPath(parentFolder(home) || "users");
  }

  function isAdminUsersRootFolder() {
    const folder = normalizeFolderPath(currentFolder() || state.homeFolder || "");
    return state.role === "admin" && !!folder && folder === adminUsersRootFolderPath();
  }

  function isPrintReadySelectMode() {
    return !!state.selectMode && state.selectPurpose === "print-ready";
  }

  function selectedFolderCoversPath(path) {
    const value = String(path || "").trim();
    if (!value) return false;
    return Array.from(state.selectedFolderPaths).some((folderPath) => pathMatchesPrefix(value, folderPath));
  }

  function excludedFolderCoversPath(path) {
    const value = String(path || "").trim();
    if (!value) return false;
    return Array.from(state.excludedFolderPaths).some((folderPath) => pathMatchesPrefix(value, folderPath));
  }

  function isFolderEffectivelySelected(folderPath) {
    const key = String(folderPath || "").trim();
    if (!key) return false;
    if (state.selectedFolderPaths.has(key)) return true;
    if (!isPrintReadySelectMode()) return false;
    if (state.excludedFolderPaths.has(key)) return false;
    return selectedFolderCoversPath(key) && !excludedFolderCoversPath(key);
  }

  function isFileEffectivelySelected(file) {
    const id = Number(file && file.id ? file.id : 0);
    if (!id) return false;
    if (state.selectedFileIds.has(id)) return true;
    if (!isPrintReadySelectMode()) return false;
    if (state.excludedFileIds.has(id)) return false;
    const folder = String((file && file.folder_path) || "").trim();
    return selectedFolderCoversPath(folder) && !excludedFolderCoversPath(folder);
  }

  function selectedCount() {
    return state.selectedFolderPaths.size + state.selectedFileIds.size;
  }

  function selectedFileCount() {
    return state.selectedFileIds.size;
  }

  function printReadySelectionCount() {
    const directlySelected = state.selectedFolderPaths.size + state.selectedFileIds.size;
    const excluded = state.excludedFolderPaths.size + state.excludedFileIds.size;
    return { directlySelected, excluded };
  }

  function clearSelections() {
    state.selectedFolderPaths.clear();
    state.selectedFileIds.clear();
    state.excludedFolderPaths.clear();
    state.excludedFileIds.clear();
  }

  function cleanupPrintReadyExclusions() {
    if (!isPrintReadySelectMode()) return;
    if (state.selectedFolderPaths.size > 0) return;
    state.excludedFolderPaths.clear();
    state.excludedFileIds.clear();
  }

  async function deleteSelectedInSelectMode() {
    const fileIds = Array.from(state.selectedFileIds).map((v) => Number(v || 0)).filter((v) => v > 0);
    const folderPaths = Array.from(state.selectedFolderPaths).map((v) => String(v || "").trim()).filter(Boolean);
    const total = fileIds.length + folderPaths.length;
    if (!total) {
      showStatus(els.uploadStatus, "Vælg mindst én fil eller mappe at slette.", "error");
      return;
    }

    const confirmText = `Slet ${total} valgt(e) element(er)? Dette kan ikke fortrydes.`;
    if (!window.confirm(confirmText)) return;

    const data = await api("/api/files/batch-delete", {
      method: "POST",
      body: {
        file_ids: fileIds,
        folder_paths: folderPaths,
      },
    });

    const removedFiles = Number(data.removed_files || 0);
    const removedFolders = Number(data.removed_folders || 0);
    showStatus(
      els.uploadStatus,
      `Slettet: ${removedFiles} fil(er) og ${removedFolders} mappe(r).`,
      "ok"
    );
    toggleSelectMode(false);
    await loadFolders();
    await loadFiles();
  }

  async function setPrintedForSelectedFiles(printed = true) {
    const fileIds = Array.from(state.selectedFileIds).map((v) => Number(v || 0)).filter((v) => v > 0);
    if (!fileIds.length) {
      showStatus(els.uploadStatus, "Vælg mindst én fil for at markere som printet.", "error");
      return;
    }

    await api("/api/files/printed-batch", {
      method: "POST",
      body: {
        file_ids: fileIds,
        printed: !!printed,
      },
    });

    state.selectedFileIds.clear();
    const label = printed ? "printet" : "ikke printet";
    showStatus(els.uploadStatus, `${fileIds.length} fil(er) markeret som ${label}.`, "ok");
    await loadFiles();
  }

  function closePrintReadyModal() {
    if (els.printReadyModal) els.printReadyModal.classList.add("hidden");
    showStatus(els.printReadyModalStatus, "");
    if (els.printReadyModalFiles) els.printReadyModalFiles.innerHTML = "";
    state.currentPrintReadyProjectId = 0;
    state.currentPrintReadyProject = null;
  }

  function defaultPrintReadyProjectName(project) {
    const title = String((project && project.title) || "").trim();
    if (!title) return "";
    if (title.toLowerCase().startsWith("klar til print")) return "";
    return title.slice(0, 120);
  }

  function settlePrintReadyNameModal(value) {
    const resolver = state.printReadyNameResolver;
    state.printReadyNameResolver = null;
    if (els.printReadyNameModal) els.printReadyNameModal.classList.add("hidden");
    showStatus(els.printReadyNameStatus, "");
    if (els.printReadyNameSendBtn) els.printReadyNameSendBtn.disabled = false;
    if (typeof resolver === "function") resolver(String(value || "").trim());
  }

  function confirmPrintReadyProjectName() {
    const value = String((els.printReadyNameInput && els.printReadyNameInput.value) || "").trim();
    if (!value) {
      showStatus(els.printReadyNameStatus, "Indtast et projekt navn.", "error");
      if (els.printReadyNameInput) els.printReadyNameInput.focus();
      return;
    }
    settlePrintReadyNameModal(value);
  }

  function askPrintReadyProjectName(project) {
    if (!els.printReadyNameModal || !els.printReadyNameInput) {
      const fallback = defaultPrintReadyProjectName(project);
      return Promise.resolve(String(window.prompt("Projekt navn", fallback) || "").trim());
    }
    return new Promise((resolve) => {
      state.printReadyNameResolver = resolve;
      els.printReadyNameInput.value = defaultPrintReadyProjectName(project);
      showStatus(els.printReadyNameStatus, "");
      if (els.printReadyNameSendBtn) els.printReadyNameSendBtn.disabled = false;
      els.printReadyNameModal.classList.remove("hidden");
      window.setTimeout(() => {
        els.printReadyNameInput.focus();
        els.printReadyNameInput.select();
      }, 0);
    });
  }

  function renderPrintReadyModalFiles(project) {
    if (!els.printReadyModalFiles) return;
    const files = Array.isArray(project && project.files) ? project.files : [];
    if (!files.length) {
      els.printReadyModalFiles.innerHTML = "";
      return;
    }
    els.printReadyModalFiles.innerHTML = files.map((file) => {
      const quantity = Math.max(1, Number(file.quantity || 1) || 1);
      const scale = scaleUpLabel(file);
      const note = String(file.note || "").trim();
      const attachments = Array.isArray(file.attachments) ? file.attachments : [];
      const infoParts = [];
      if (note) infoParts.push(esc(note));
      if (scale) infoParts.push(`Større: ${esc(scale)}`);
      return `
        <div class="print-ready-modal-file">
          <div>
            <div class="print-ready-modal-file-name">${esc(file.filename || "-")}</div>
            <div class="print-ready-modal-file-meta">${esc(file.display_path || file.folder_path || "-")} · ${formatSize(file.file_size || 0)}</div>
            ${infoParts.length ? `<div class="print-ready-modal-file-info">${infoParts.join(" · ")}</div>` : ""}
          </div>
          <div class="print-ready-modal-file-badges">
            <span class="print-ready-modal-badge">Antal ${quantity}</span>
            <span class="print-ready-modal-badge">${attachments.length} billede(r)</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function resetSmsConfirmFields() {
    if (els.smsConfirmTrackingInput) els.smsConfirmTrackingInput.value = "";
    if (els.smsConfirmLabelPdfInput) els.smsConfirmLabelPdfInput.value = "";
    if (els.smsConfirmExtracted) {
      els.smsConfirmExtracted.textContent = "";
      els.smsConfirmExtracted.classList.add("hidden");
    }
  }

  function setSmsConfirmExtracted(value, prefix = "Trackingnummer") {
    if (!els.smsConfirmExtracted) return;
    const number = String(value || "").trim();
    if (!number) {
      els.smsConfirmExtracted.textContent = "";
      els.smsConfirmExtracted.classList.add("hidden");
      return;
    }
    els.smsConfirmExtracted.textContent = `${prefix}: ${number}`;
    els.smsConfirmExtracted.classList.remove("hidden");
  }

  function settleSmsConfirmModal(sendSms) {
    const resolver = state.smsConfirmResolver;
    state.smsConfirmResolver = null;
    state.smsConfirmContext = "";
    state.smsConfirmTargetUsername = "";
    if (els.smsConfirmModal) els.smsConfirmModal.classList.add("hidden");
    resetSmsConfirmFields();
    showStatus(els.smsConfirmStatus, "");
    if (typeof resolver === "function") resolver(!!sendSms);
  }

  function askSmsConfirmation(contextText = "", project = null) {
    if (!els.smsConfirmModal) return Promise.resolve(false);
    return new Promise((resolve) => {
      state.smsConfirmResolver = resolve;
      state.smsConfirmContext = String(contextText || "").trim();
      state.smsConfirmTargetUsername = String((project && project.owner_username) || "").trim();
      if (els.smsConfirmSummary) {
        const projectTitle = String((project && project.title) || "").trim();
        const fallback = projectTitle ? `Projekt: ${projectTitle}` : "Projekt færdigmelding";
        els.smsConfirmSummary.textContent = state.smsConfirmContext || fallback;
      }
      resetSmsConfirmFields();
      showStatus(els.smsConfirmStatus, "");
      if (els.smsConfirmTrackingInput) {
        els.smsConfirmTrackingInput.focus();
      }
      els.smsConfirmModal.classList.remove("hidden");
    });
  }

  async function createTrackingEntry(trackingNumber, options = {}) {
    const number = String(trackingNumber || "").trim();
    const targetUsername = String((options && options.targetUsername) || "").trim();
    if (!number) {
      const err = new Error("Indtast tracking- eller pakkenummer.");
      err.status = 400;
      throw err;
    }

    try {
      const payload = { tracking_number: number };
      if (targetUsername) payload.target_username = targetUsername;
      const data = await api("/api/admin/tracking", {
        method: "POST",
        body: payload,
      });
      await loadTracking();
      return {
        duplicate: false,
        item: data && data.item ? data.item : null,
      };
    } catch (err) {
      if (Number((err && err.status) || 0) === 409) {
        await loadTracking();
        return { duplicate: true, item: null };
      }
      throw err;
    }
  }

  async function addTrackingFromSmsConfirmInput() {
    if (state.role !== "admin") return;
    const trackingNumber = String((els.smsConfirmTrackingInput && els.smsConfirmTrackingInput.value) || "").trim();
    if (!trackingNumber) {
      showStatus(els.smsConfirmStatus, "Indtast tracking- eller pakkenummer.", "error");
      if (els.smsConfirmTrackingInput) els.smsConfirmTrackingInput.focus();
      return;
    }

    if (els.smsConfirmAddTrackingBtn) els.smsConfirmAddTrackingBtn.disabled = true;
    showStatus(els.smsConfirmStatus, "Tilføjer trackingnummer...", "ok");
    try {
      const result = await createTrackingEntry(trackingNumber, {
        targetUsername: state.smsConfirmTargetUsername,
      });
      if (els.smsConfirmTrackingInput) els.smsConfirmTrackingInput.value = "";
      if (result.duplicate) {
        setSmsConfirmExtracted(trackingNumber, "Tracking findes allerede");
        showStatus(els.smsConfirmStatus, "Trackingnummer findes allerede i listen.", "ok");
        return;
      }

      const item = result.item;
      const addedNumber = String((item && item.tracking_number) || trackingNumber).trim();
      setSmsConfirmExtracted(addedNumber, "Tracking tilføjet");
      showStatus(
        els.smsConfirmStatus,
        item && item.error ? `Tracking tilføjet, men Bring svarede: ${item.error}` : "Tracking tilføjet og opdateret.",
        item && item.error ? "error" : "ok",
      );
    } catch (err) {
      showStatus(els.smsConfirmStatus, err.message || "Kunne ikke tilføje tracking", "error");
    } finally {
      if (els.smsConfirmAddTrackingBtn) els.smsConfirmAddTrackingBtn.disabled = false;
    }
  }

  async function extractTrackingFromSmsConfirmLabel() {
    if (state.role !== "admin") return;
    const input = els.smsConfirmLabelPdfInput;
    const file = input && input.files && input.files.length ? input.files[0] : null;
    if (!file) {
      showStatus(els.smsConfirmStatus, "Vælg en pakkelabel i PDF-format.", "error");
      return;
    }

    const fileName = String(file.name || "").toLowerCase();
    const looksPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    if (!looksPdf) {
      showStatus(els.smsConfirmStatus, "Kun PDF-filer kan bruges til udtræk.", "error");
      if (els.smsConfirmLabelPdfInput) els.smsConfirmLabelPdfInput.value = "";
      return;
    }

    if (els.smsConfirmExtractBtn) els.smsConfirmExtractBtn.disabled = true;
    showStatus(els.smsConfirmStatus, "Udtrækker pakkenummer fra PDF...", "ok");
    try {
      const formData = new FormData();
      formData.append("label_pdf", file, String(file.name || "label.pdf"));
      const extractData = await api("/api/admin/tracking/extract-label", {
        method: "POST",
        body: formData,
      });

      const extractedNumber = String((extractData && extractData.tracking_number) || "").trim();
      if (!extractedNumber) {
        throw new Error("Kunne ikke finde et gyldigt pakkenummer i PDF-filen.");
      }

      const result = await createTrackingEntry(extractedNumber, {
        targetUsername: state.smsConfirmTargetUsername,
      });
      if (els.smsConfirmTrackingInput) els.smsConfirmTrackingInput.value = extractedNumber;

      if (result.duplicate) {
        setSmsConfirmExtracted(extractedNumber, "Udtrukket (allerede i tracking)");
        showStatus(
          els.smsConfirmStatus,
          `Pakkenummer udtrukket (${extractedNumber}). Nummeret findes allerede i tracking.`,
          "ok",
        );
        return;
      }

      const item = result.item;
      const addedNumber = String((item && item.tracking_number) || extractedNumber).trim();
      setSmsConfirmExtracted(addedNumber, "Udtrukket og tilføjet");
      showStatus(
        els.smsConfirmStatus,
        item && item.error
          ? `Pakkenummer udtrukket (${addedNumber}) og tilføjet, men Bring svarede: ${item.error}`
          : `Pakkenummer udtrukket (${addedNumber}) og tilføjet til tracking.`,
        item && item.error ? "error" : "ok",
      );
    } catch (err) {
      showStatus(els.smsConfirmStatus, err.message || "Kunne ikke udtrække pakkenummer fra PDF", "error");
    } finally {
      if (els.smsConfirmLabelPdfInput) els.smsConfirmLabelPdfInput.value = "";
      if (els.smsConfirmExtractBtn) els.smsConfirmExtractBtn.disabled = false;
    }
  }

  function openPrintReadyModal(project) {
    if (!project || !els.printReadyModal) return;
    state.currentPrintReadyProjectId = Number(project.id || 0) || 0;
    state.currentPrintReadyProject = project;
    const files = Array.isArray(project.files) ? project.files : [];
    const fileCount = Number(project.file_count || files.length || 0);
    const printedCount = Number(project.printed_file_count || files.filter((f) => !!(f && f.printed)).length || 0);
    if (els.printReadyModalSummary) {
      els.printReadyModalSummary.textContent = `${project.title || "Klar til print"} · Filer i alt: ${fileCount} · Printet: ${printedCount}`;
    }
    if (els.printReadyZipLink) {
      els.printReadyZipLink.href = String(project.zip_url || "#");
    }
    if (els.printReadyPdfLink) {
      els.printReadyPdfLink.href = String(project.pdf_url || "#");
    }
    renderPrintReadyModalFiles(project);
    const isReady = String(project.status || "").toLowerCase() === "ready";
    if (els.printReadySendBtn) {
      els.printReadySendBtn.disabled = isReady || !state.currentPrintReadyProjectId;
      els.printReadySendBtn.textContent = isReady ? "Allerede sendt" : "Send til print";
    }
    showStatus(
      els.printReadyModalStatus,
      isReady ? "Projektet er sendt til admin-sektionen." : "Projektet er ikke sendt endnu.",
      isReady ? "ok" : "info"
    );
    els.printReadyModal.classList.remove("hidden");
  }

  async function sendCurrentPrintReadyProject() {
    const id = Number(state.currentPrintReadyProjectId || 0);
    if (!id) return;
    const projectName = await askPrintReadyProjectName(state.currentPrintReadyProject || {});
    if (!projectName) return;
    showStatus(els.printReadyModalStatus, "Sender projektet til print...", "ok");
    const data = await api(`/api/print-ready/${id}/send`, {
      method: "POST",
      body: { project_name: projectName },
    });
    const project = data && data.project ? data.project : null;
    if (project) {
      openPrintReadyModal(project);
    }
    if (state.role === "admin") {
      await loadPrintReadyProjects();
    }
  }

  async function markSelectionPrintReady() {
    const fileIds = Array.from(state.selectedFileIds).map((v) => Number(v || 0)).filter((v) => v > 0);
    const folderPaths = Array.from(state.selectedFolderPaths).map((v) => String(v || "").trim()).filter(Boolean);
    const excludedFileIds = Array.from(state.excludedFileIds).map((v) => Number(v || 0)).filter((v) => v > 0);
    const excludedFolderPaths = Array.from(state.excludedFolderPaths).map((v) => String(v || "").trim()).filter(Boolean);
    const total = fileIds.length + folderPaths.length;
    if (!total) {
      showStatus(els.uploadStatus, "Vælg mindst én fil eller mappe til klar til print.", "error");
      return;
    }

    const data = await api("/api/print-ready", {
      method: "POST",
      body: {
        file_ids: fileIds,
        folder_paths: folderPaths,
        excluded_file_ids: excludedFileIds,
        excluded_folder_paths: excludedFolderPaths,
      },
    });

    const project = data.project || null;
    toggleSelectMode(false);
    await loadFiles();
    if (state.role === "admin") {
      await loadPrintReadyProjects();
    }
    if (project && Array.isArray(project.files) && project.files.length) {
      openMetadataModal(project.files, {
        mode: "print-ready",
        projectId: Number(project.id || 0),
        continueProject: project,
      });
    } else {
      openPrintReadyModal(project);
    }
  }

  function toggleSelectMode(forceValue = null, purpose = "manage") {
    const next = forceValue == null ? !state.selectMode : !!forceValue;
    const nextPurpose = next ? String(purpose || "manage") : "";
    if (state.selectMode === next && state.selectPurpose === nextPurpose) return;
    state.selectMode = next;
    state.selectPurpose = nextPurpose;
    if (!next) {
      clearSelections();
    } else {
      closeFileInfoDrawer();
    }
    updateSelectModeUi();
    renderFolderBrowser();
    renderFiles();
  }

  function startPrintReadySelection() {
    toggleSelectMode(true, "print-ready");
    showStatus(els.uploadStatus, "Vælg filer eller mapper til printprojektet. Mapper vælger automatisk alt indhold.", "ok");
  }

  function toggleFolderSelection(folderPath) {
    const key = String(folderPath || "").trim();
    if (!key) return;
    if (isPrintReadySelectMode()) {
      if (state.selectedFolderPaths.has(key)) {
        state.selectedFolderPaths.delete(key);
        for (const value of Array.from(state.excludedFolderPaths)) {
          if (pathMatchesPrefix(value, key)) state.excludedFolderPaths.delete(value);
        }
        return;
      }
      if (state.excludedFolderPaths.has(key)) {
        state.excludedFolderPaths.delete(key);
        return;
      }
      if (isFolderEffectivelySelected(key)) {
        state.excludedFolderPaths.add(key);
        for (const value of Array.from(state.selectedFolderPaths)) {
          if (pathMatchesPrefix(value, key)) state.selectedFolderPaths.delete(value);
        }
        for (const id of Array.from(state.excludedFileIds)) {
          const file = state.files.find((item) => Number(item && item.id ? item.id : 0) === Number(id));
          if (file && pathMatchesPrefix(String(file.folder_path || ""), key)) state.excludedFileIds.delete(id);
        }
        return;
      }
      state.selectedFolderPaths.add(key);
      for (const value of Array.from(state.excludedFolderPaths)) {
        if (pathMatchesPrefix(value, key)) state.excludedFolderPaths.delete(value);
      }
      return;
    }

    if (state.selectedFolderPaths.has(key)) state.selectedFolderPaths.delete(key);
    else state.selectedFolderPaths.add(key);
  }

  function toggleFileSelection(fileId, file = null) {
    const id = Number(fileId || 0);
    if (!id) return;
    const row = file || fileById(id);
    if (isPrintReadySelectMode()) {
      if (state.selectedFileIds.has(id)) {
        state.selectedFileIds.delete(id);
        return;
      }
      if (state.excludedFileIds.has(id)) {
        state.excludedFileIds.delete(id);
        return;
      }
      if (row && isFileEffectivelySelected(row)) {
        state.excludedFileIds.add(id);
        return;
      }
      state.selectedFileIds.add(id);
      return;
    }

    if (state.selectedFileIds.has(id)) state.selectedFileIds.delete(id);
    else state.selectedFileIds.add(id);
  }

  function pruneSelections() {
    if (!state.selectMode) clearSelections();
  }

  function updateSelectModeUi() {
    const on = !!state.selectMode;
    const printReadyMode = isPrintReadySelectMode();
    const writeAllowed = currentFolderAllowsUserWrites();
    const writeDisabled = on || !writeAllowed;
    if (els.mapperShell) els.mapperShell.classList.toggle("select-mode", on);
    if (els.mapperShell) els.mapperShell.classList.toggle("print-ready-select-mode", printReadyMode);

    const count = selectedCount();
    const fileCount = selectedFileCount();
    if (els.mapperSelectSummary) {
      if (printReadyMode) {
        const stats = printReadySelectionCount();
        const excludedText = stats.excluded > 0 ? ` · ${stats.excluded} fravalgt` : "";
        els.mapperSelectSummary.textContent = `Klar til print: ${stats.directlySelected} valgt${excludedText}`;
      } else {
        els.mapperSelectSummary.textContent = on ? `${count} valgt` : "";
      }
      els.mapperSelectSummary.classList.toggle("hidden", !on);
    }
    if (els.mapperSelectExitBtn) {
      els.mapperSelectExitBtn.classList.toggle("hidden", !on);
      els.mapperSelectExitBtn.textContent = printReadyMode ? "Annuller" : "Afslut vælg";
    }
    if (els.mapperSelectPrintReadyBtn) {
      const showPrintReadyBtn = !on || printReadyMode;
      els.mapperSelectPrintReadyBtn.classList.toggle("hidden", !showPrintReadyBtn);
      els.mapperSelectPrintReadyBtn.disabled = printReadyMode && count <= 0;
      els.mapperSelectPrintReadyBtn.textContent = printReadyMode
        ? (count > 0 ? `Fortsæt til printdetaljer (${count})` : "Fortsæt til printdetaljer")
        : "Vælg filer til print";
    }
    if (els.mapperSelectClearBtn) {
      els.mapperSelectClearBtn.classList.toggle("hidden", !printReadyMode);
      els.mapperSelectClearBtn.disabled = count <= 0 && state.excludedFolderPaths.size <= 0 && state.excludedFileIds.size <= 0;
    }
    if (els.mapperSelectDeleteBtn) {
      els.mapperSelectDeleteBtn.classList.toggle("hidden", !on || printReadyMode);
      els.mapperSelectDeleteBtn.disabled = count <= 0;
      els.mapperSelectDeleteBtn.textContent = count > 0 ? `Slet (${count})` : "Slet";
    }
    if (els.mapperSelectPrintedBtn) {
      const allowPrinted = on && !printReadyMode && state.role === "admin";
      els.mapperSelectPrintedBtn.classList.toggle("hidden", !allowPrinted);
      els.mapperSelectPrintedBtn.disabled = fileCount <= 0;
      els.mapperSelectPrintedBtn.textContent = fileCount > 0 ? `Printet (${fileCount})` : "Printet";
    }

    if (els.mapperMenuSelect) {
      els.mapperMenuSelect.textContent = on ? "Afslut vælg mode" : "Vælg mode";
    }
    if (els.mapperMenuUpload) {
      els.mapperMenuUpload.disabled = writeDisabled;
    }
    if (els.mapperImportLinkBtn) {
      els.mapperImportLinkBtn.classList.toggle("hidden", on || !writeAllowed);
      els.mapperImportLinkBtn.disabled = writeDisabled;
    }
    if (els.mapperDesktopUploadBtn) {
      els.mapperDesktopUploadBtn.classList.toggle("hidden", on || !writeAllowed);
      els.mapperDesktopUploadBtn.disabled = writeDisabled;
    }
    if (els.mapperMenuCreateFolder) {
      els.mapperMenuCreateFolder.disabled = writeDisabled;
    }
    if (els.mapperMenuShare) {
      const hasShareSelection = selectedShareFoldersFromSelection().length > 0;
      els.mapperMenuShare.disabled = !on || printReadyMode || !hasShareSelection;
    }
    if (els.mapperMenuRenameFolder) {
      els.mapperMenuRenameFolder.disabled = !on || state.selectedFolderPaths.size !== 1;
    }

    if (els.mapperSearchBtn) {
      els.mapperSearchBtn.disabled = on;
      els.mapperSearchBtn.classList.toggle("disabled", on);
    }
    if (els.folderUpBtn) {
      els.folderUpBtn.classList.toggle("disabled", false);
    }
    if (els.mapperDropZone) {
      els.mapperDropZone.classList.toggle("disabled", writeDisabled);
    }
    if (els.uploadBtn) {
      els.uploadBtn.disabled = writeDisabled;
    }
    if (els.createFolderBtn) {
      els.createFolderBtn.disabled = writeDisabled;
    }
    if (els.newFolderInput) {
      els.newFolderInput.disabled = writeDisabled;
    }
    if (els.fileInput) {
      els.fileInput.disabled = writeDisabled;
    }
  }

  function listDirectChildren(baseFolder) {
    const base = String(baseFolder || "").trim();
    const out = new Map();
    for (const item of state.folders) {
      const fullPath = String((item && item.path) || "").trim();
      if (!fullPath || fullPath === base) continue;

      const isNested = base
        ? fullPath.startsWith(base + "/")
        : !fullPath.startsWith("/");
      if (!isNested) continue;

      const remainder = base ? fullPath.slice(base.length + 1) : fullPath;
      if (!remainder) continue;
      const nextPart = remainder.split("/").filter(Boolean)[0] || "";
      if (!nextPart) continue;
      const childPath = base ? `${base}/${nextPart}` : nextPart;

      if (!out.has(childPath)) {
        out.set(childPath, {
          path: childPath,
          name: nextPart,
          permission: String(item.permission || ""),
          unseen_count: Number((state.folderUnseenCounts && state.folderUnseenCounts[childPath]) || 0),
        });
      } else {
        const existing = out.get(childPath);
        const unseen = Number((state.folderUnseenCounts && state.folderUnseenCounts[childPath]) || 0);
        if (existing && unseen > Number(existing.unseen_count || 0)) {
          existing.unseen_count = unseen;
        }
      }
    }
    return Array.from(out.values()).sort((a, b) => a.name.localeCompare(b.name, "da"));
  }

  function folderLineage(path) {
    const normalized = normalizeFolderPath(path);
    if (!normalized) return [];
    const parts = normalized.split("/").filter(Boolean);
    const out = [];
    for (let i = 1; i <= parts.length; i += 1) {
      out.push(parts.slice(0, i).join("/"));
    }
    return out;
  }

  function isFilesTabVisible() {
    return !!(els.tabFiles && !els.tabFiles.classList.contains("hidden"));
  }

  function clearNewUploadsDwellTimer() {
    if (!state.newUploadsDwellTimer) return;
    window.clearTimeout(state.newUploadsDwellTimer);
    state.newUploadsDwellTimer = null;
  }

  function scheduleNewUploadsDwellSeen() {
    clearNewUploadsDwellTimer();
    if (state.role !== "admin" || !isFilesTabVisible()) return;

    const folder = normalizeFolderPath(currentFolder() || state.homeFolder || "");
    if (!folder) return;

    const unseenIds = Array.from(state.files || [])
      .map((file) => (file && file.is_new ? Number(file.id || 0) : 0))
      .filter((id) => id > 0);
    if (!unseenIds.length) return;

    state.newUploadsDwellTimer = window.setTimeout(() => {
      state.newUploadsDwellTimer = null;
      if (!isFilesTabVisible()) return;
      const activeFolder = normalizeFolderPath(currentFolder() || state.homeFolder || "");
      if (!activeFolder || activeFolder !== folder) return;

      const liveIds = Array.from(state.files || [])
        .map((file) => (file && file.is_new ? Number(file.id || 0) : 0))
        .filter((id) => id > 0);
      if (!liveIds.length) return;

      markFilesSeen(liveIds).catch(() => {});
    }, 5000);
  }

  function decrementFolderUnseenCounts(folderPath, amount = 1) {
    const delta = Number(amount || 0);
    if (!Number.isFinite(delta) || delta <= 0) return;
    const map = state.folderUnseenCounts && typeof state.folderUnseenCounts === "object"
      ? state.folderUnseenCounts
      : null;
    if (!map) return;

    for (const path of folderLineage(folderPath)) {
      const current = Number(map[path] || 0);
      const next = Math.max(0, Math.floor(current - delta));
      if (next > 0) map[path] = next;
      else delete map[path];
    }
  }

  function setUnseenUploadsExpanded(expanded) {
    state.unseenUploadsExpanded = !!expanded;
    persistUnseenUploadsOverlayExpanded(state.unseenUploadsExpanded);
    if (els.newUploadsOverlay) {
      els.newUploadsOverlay.classList.toggle("expanded", state.unseenUploadsExpanded);
    }
    if (els.newUploadsOverlayBody) {
      els.newUploadsOverlayBody.classList.toggle("hidden", !state.unseenUploadsExpanded);
    }
    if (els.newUploadsOverlayToggle) {
      els.newUploadsOverlayToggle.setAttribute("aria-expanded", state.unseenUploadsExpanded ? "true" : "false");
    }
    if (els.newUploadsOverlayChevron) {
      els.newUploadsOverlayChevron.textContent = state.unseenUploadsExpanded ? "▴" : "▾";
    }
  }

  function renderUnseenUploadsOverlay() {
    if (!els.newUploadsOverlay) return;

    const total = Math.max(0, Math.floor(Number(state.unseenUploadsTotal || 0)));
    const items = Array.isArray(state.unseenUploads) ? state.unseenUploads : [];
    const shouldShow = state.role === "admin" && total > 0;

    if (!shouldShow) {
      els.newUploadsOverlay.classList.add("hidden");
      if (els.newUploadsOverlayList) els.newUploadsOverlayList.innerHTML = "";
      setUnseenUploadsExpanded(state.unseenUploadsExpanded);
      return;
    }

    els.newUploadsOverlay.classList.remove("hidden");
    if (els.newUploadsOverlayCount) {
      els.newUploadsOverlayCount.textContent = String(total);
    }
    if (els.newUploadsOverlayLabel) {
      els.newUploadsOverlayLabel.textContent = total === 1
        ? "Ny uploadet fil (ikke set)"
        : "Nye uploadede filer (ikke set)";
    }
    if (els.newUploadsOverlayMeta) {
      const shown = items.length;
      els.newUploadsOverlayMeta.textContent = shown > 0
        ? `Viser ${shown} seneste af ${total} nye uploads`
        : `${total} nye uploads`;
    }
    if (els.newUploadsOverlayList) {
      if (!items.length) {
        els.newUploadsOverlayList.innerHTML = '<li class="new-uploads-overlay-empty">Ingen detaljer tilgængelige lige nu.</li>';
      } else {
        els.newUploadsOverlayList.innerHTML = items
          .map((item) => {
            const filename = String((item && item.filename) || "Fil");
            const folderPathRaw = String((item && item.folder_path) || "");
            const folderPath = folderPathRaw || "-";
            const uploadedBy = String((item && item.uploaded_by) || "Ukendt");
            const uploadedAt = formatDateDa(item && item.uploaded_at ? item.uploaded_at : "");
            const thumbUrl = String((item && item.thumb_url) || "").trim();
            const contentUrl = String((item && item.content_url) || "").trim();
            const mimeType = String((item && item.mime_type) || "").toLowerCase();
            const extLabel = String((item && item.ext) || "")
              .replace(".", "")
              .toUpperCase()
              .slice(0, 4) || "FIL";
            const imageSrc = thumbUrl || (mimeType.startsWith("image/") ? contentUrl : "");
            const thumbHtml = imageSrc
              ? `<img class="new-uploads-overlay-thumb-img" src="${esc(imageSrc)}" alt="${esc(filename)}" loading="lazy" decoding="async">`
              : `<div class="new-uploads-overlay-thumb-placeholder">${esc(extLabel)}</div>`;

            return `
              <li class="new-uploads-overlay-item" data-file-id="${Number(item && item.id ? item.id : 0)}" data-folder-path="${esc(folderPathRaw)}" role="button" tabindex="0" aria-label="Åbn ${esc(filename)} i mappe ${esc(folderPath)}">
                <div class="new-uploads-overlay-thumb">${thumbHtml}</div>
                <div class="new-uploads-overlay-details">
                  <div class="new-uploads-overlay-file" title="${esc(filename)}">${esc(filename)}</div>
                  <div class="new-uploads-overlay-sub">${esc(uploadedBy)} · ${esc(uploadedAt)}</div>
                  <div class="new-uploads-overlay-sub path" title="${esc(folderPath)}">${esc(folderPath)}</div>
                </div>
              </li>
            `;
          })
          .join("");
      }
    }

    setUnseenUploadsExpanded(state.unseenUploadsExpanded);
  }

  async function loadUnseenUploadsSummary(limit = 12) {
    if (state.role !== "admin") {
      state.unseenUploadsRequestToken = Number((state.unseenUploadsRequestToken || 0) + 1);
      state.unseenUploadsTotal = 0;
      state.unseenUploads = [];
      renderUnseenUploadsOverlay();
      return;
    }

    const safeLimit = Math.max(1, Math.min(40, Number(limit || 12) || 12));
    const requestToken = Number((state.unseenUploadsRequestToken || 0) + 1);
    state.unseenUploadsRequestToken = requestToken;
    const data = await api(`/api/files/unseen-summary?limit=${safeLimit}`);
    if (requestToken !== state.unseenUploadsRequestToken) return;
    state.unseenUploadsTotal = Math.max(0, Math.floor(Number(data && data.total ? data.total : 0)));
    state.unseenUploads = Array.isArray(data && data.items) ? data.items : [];
    renderUnseenUploadsOverlay();
  }

  async function openUnseenUploadItem(fileId, folderPath) {
    if (state.role !== "admin") return;

    const id = Number(fileId || 0);
    const targetFolder = normalizeFolderPath(folderPath || "");

    setTab("files");

    if (targetFolder) {
      let hasFolder = state.folders.some((entry) => normalizeFolderPath(entry && entry.path) === targetFolder);
      if (!hasFolder) {
        await loadFolders();
        hasFolder = state.folders.some((entry) => normalizeFolderPath(entry && entry.path) === targetFolder);
      }

      if (hasFolder) {
        state.currentFolder = targetFolder;
        if (els.folderSelect) {
          els.folderSelect.value = targetFolder;
        }
      }
    }

    await loadFiles();

    if (!id) return;
    const file = fileById(id);
    if (!file) {
      showStatus(els.uploadStatus, "Filen findes ikke længere i den valgte mappe.", "error");
      return;
    }
    await openFileInfoDrawer(id);
  }

  function applySeenIdsLocally(seenIds = []) {
    const ids = Array.from(new Set(Array.from(seenIds || []).map((value) => Number(value || 0)).filter((value) => value > 0)));
    if (!ids.length) return false;

    const idSet = new Set(ids);
    const knownFolders = new Map();
    Array.from(state.files || []).forEach((file) => {
      const id = Number(file && file.id ? file.id : 0);
      if (!id) return;
      knownFolders.set(id, String(file.folder_path || ""));
    });
    Array.from(state.unseenUploads || []).forEach((item) => {
      const id = Number(item && item.id ? item.id : 0);
      if (!id) return;
      if (!knownFolders.has(id)) knownFolders.set(id, String(item.folder_path || ""));
    });

    let changed = false;

    for (const file of Array.from(state.files || [])) {
      const id = Number(file && file.id ? file.id : 0);
      if (!idSet.has(id) || !file || !file.is_new) continue;
      file.is_new = false;
      changed = true;
    }

    const prevTotal = Math.max(0, Math.floor(Number(state.unseenUploadsTotal || 0)));
    const nextTotal = Math.max(0, prevTotal - ids.length);
    if (nextTotal !== prevTotal) {
      state.unseenUploadsTotal = nextTotal;
      changed = true;
    }

    if (Array.isArray(state.unseenUploads) && state.unseenUploads.length) {
      const beforeLen = state.unseenUploads.length;
      state.unseenUploads = state.unseenUploads.filter((item) => !idSet.has(Number(item && item.id ? item.id : 0)));
      if (state.unseenUploads.length !== beforeLen) changed = true;
    }

    for (const id of ids) {
      const folderPath = knownFolders.get(id);
      if (!folderPath) continue;
      decrementFolderUnseenCounts(folderPath, 1);
      changed = true;
    }

    return changed;
  }

  async function markFilesSeen(fileIds = []) {
    if (state.role !== "admin") return;

    const wanted = Array.from(fileIds || [])
      .map((value) => Number(value || 0))
      .filter((value) => value > 0 && !state.fileSeenInFlight.has(value));
    if (!wanted.length) return;

    wanted.forEach((id) => state.fileSeenInFlight.add(id));
    try {
      const data = await api("/api/files/seen-batch", {
        method: "POST",
        body: { file_ids: wanted },
      });

      const seenIds = Array.isArray(data && data.seen_ids)
        ? data.seen_ids.map((value) => Number(value || 0)).filter((value) => value > 0)
        : [];
      if (!seenIds.length) return;

      const changed = applySeenIdsLocally(seenIds);

      if (changed) {
        renderFiles();
        renderFolderBrowser();
        renderUnseenUploadsOverlay();
      }

      loadUnseenUploadsSummary().catch(() => {});
    } catch (_err) {
      // Ignore transient errors; badges refresh on next data reload.
    } finally {
      wanted.forEach((id) => state.fileSeenInFlight.delete(id));
    }
  }

  function updateFolderUiState() {
    const folder = currentFolder() || state.homeFolder || "";
    const isRoot = !!folder && !!state.homeFolder && folder === state.homeFolder;
    const folderLabel = isRoot ? `${folder} (rodmappe)` : (folder || "-");
    const writeAllowed = currentFolderAllowsUserWrites();
    if (els.mapperDropZone) {
      els.mapperDropZone.textContent = writeAllowed
        ? `Slip filer eller mapper her for at uploade til: ${folderLabel}`
        : "Åbn en datomappe for at uploade eller oprette mapper.";
    }
    if (els.folderUpBtn) {
      const parent = parentFolder(folder);
      const canGoUp = !!parent && state.folders.some((f) => String(f.path || "") === parent);
      els.folderUpBtn.disabled = !canGoUp;
    }
    updateSelectModeUi();
  }

  function renderFolderBrowser() {
    if (!els.folderList) return;
    const folder = currentFolder() || state.homeFolder || "";
    const children = listDirectChildren(folder);
    if (!children.length) {
      els.folderList.innerHTML = "";
      els.folderList.classList.add("hidden");
      return;
    }
    els.folderList.classList.remove("hidden");
    els.folderList.innerHTML = children
      .map((child) => {
        const perm = child.permission ? ` · ${esc(child.permission)}` : "";
        const isSelected = isFolderEffectivelySelected(String(child.path || ""));
        const previewHtml = folderTilePreviewHtml(child.path);
        const unseenCount = Math.max(0, Number(child.unseen_count || 0));
        const unseenBadge = state.role === "admin" && unseenCount > 0
          ? `<span class="folder-new-badge" title="${unseenCount} nye filer">${unseenCount}</span>`
          : "";
        return `
          <div class="folder-tile ${isSelected ? "selected" : ""}" data-folder="${esc(child.path)}" role="button" tabindex="0">
            <span class="select-mark ${isSelected ? "selected" : ""}"></span>
            ${unseenBadge}
            <div class="folder-tile-preview">${previewHtml}</div>
            <div class="folder-tile-name" title="${esc(child.name)}"><span class="hover-scroll-text">${esc(child.name)}</span></div>
            <div class="folder-tile-meta">${esc(child.path)}${perm}</div>
            <div class="folder-tile-actions">
              <button class="btn small folder-tile-open" type="button" data-folder-open="${esc(child.path)}">Åbn</button>
            </div>
          </div>
        `;
      })
      .join("");

    bindHoverMarqueeCards(els.folderList, ".folder-tile", ".folder-tile-name");

    ensureFolderTilePreviews(folder, children).catch(() => {});
  }

  function filePreviewUrlForFolderTile(file) {
    if (!file || typeof file !== "object") return "";
    const thumb = String(file.thumb_url || "").trim();
    if (thumb) return thumb;
    const mime = String(file.mime_type || "").toLowerCase();
    if (mime.startsWith("image/")) {
      return String(file.content_url || "").trim();
    }
    return "";
  }

  function buildFolderPreviewEntry(files) {
    const items = Array.isArray(files) ? files : [];
    const seen = new Set();
    const urls = [];
    items.forEach((file) => {
      const url = filePreviewUrlForFolderTile(file);
      if (!url || seen.has(url)) return;
      seen.add(url);
      urls.push(url);
    });
    return {
      urls: urls.slice(0, 4),
      itemCount: items.length,
      loadedAt: Date.now(),
    };
  }

  function folderTilePreviewHtml(folderPath) {
    const key = String(folderPath || "").trim();
    const entry = key ? state.folderPreviewCache[key] : null;
    const urls = Array.isArray(entry && entry.urls) ? entry.urls.filter(Boolean) : [];
    if (!urls.length) {
      const loadingClass = key && state.folderPreviewLoading.has(key) ? " loading" : "";
      return `<div class="folder-tile-preview-empty${loadingClass}">&#128193;</div>`;
    }

    const variant = urls.length === 1 ? "v1" : (urls.length <= 3 ? "v2" : "v4");
    const maxCells = variant === "v1" ? 1 : (variant === "v2" ? 2 : 4);
    const cells = urls
      .slice(0, maxCells)
      .map((url) => `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">`)
      .join("");

    return `<div class="folder-tile-preview-mosaic"><div class="folder-tile-grid ${variant}">${cells}</div></div>`;
  }

  async function ensureFolderTilePreviews(parentFolder, children) {
    const expectedParent = String(parentFolder || "");
    const activeFolder = currentFolder() || state.homeFolder || "";
    if (activeFolder !== expectedParent) return;

    const targetPaths = (Array.isArray(children) ? children : [])
      .map((child) => String(child && child.path ? child.path : "").trim())
      .filter(Boolean);

    const missing = targetPaths.filter((path) => {
      const inCache = Object.prototype.hasOwnProperty.call(state.folderPreviewCache, path);
      return !inCache && !state.folderPreviewLoading.has(path);
    });
    if (!missing.length) return;

    const requestToken = ++state.folderPreviewRequestToken;
    const jobs = missing.map(async (path) => {
      state.folderPreviewLoading.add(path);
      try {
        const data = await api(`/api/folders/preview?folder=${encodeURIComponent(path)}`);
        const files = Array.isArray(data.items) ? data.items : [];
        state.folderPreviewCache[path] = buildFolderPreviewEntry(files);
      } catch (_err) {
        state.folderPreviewCache[path] = { urls: [], itemCount: 0, failed: true, loadedAt: Date.now() };
      } finally {
        state.folderPreviewLoading.delete(path);
      }
    });

    await Promise.allSettled(jobs);

    const stillSameFolder = (currentFolder() || state.homeFolder || "") === expectedParent;
    if (stillSameFolder && requestToken === state.folderPreviewRequestToken) {
      renderFolderBrowser();
    }
  }

  async function loadFolders() {
    const data = await api("/api/folders");
    state.folders = Array.isArray(data.items) ? data.items : [];
    const unseenRaw = data && data.unseen_counts && typeof data.unseen_counts === "object"
      ? data.unseen_counts
      : {};
    const unseenMap = Object.create(null);
    Object.entries(unseenRaw).forEach(([rawPath, rawCount]) => {
      const path = normalizeFolderPath(rawPath);
      const count = Math.max(0, Math.floor(Number(rawCount || 0)));
      if (path && Number.isFinite(count) && count > 0) {
        unseenMap[path] = count;
      }
    });
    state.folderUnseenCounts = unseenMap;
    if (state.role === "admin") {
      loadUnseenUploadsSummary().catch(() => {});
    } else {
      state.unseenUploadsTotal = 0;
      state.unseenUploads = [];
      renderUnseenUploadsOverlay();
    }

    const options = state.folders.map((f) => f.path);
    if (!state.currentFolder) {
      const home = state.homeFolder;
      if (state.role === "admin" && home) {
        const parts = String(home).split("/").filter(Boolean);
        for (let i = 1; i < parts.length; i += 1) {
          const candidate = parts.slice(0, i).join("/");
          if (candidate && options.includes(candidate)) {
            state.currentFolder = candidate;
            break;
          }
        }
      }
      if (!state.currentFolder) {
        const daily = state.role !== "admin" ? String(state.dailyFolder || "") : "";
        if (daily && options.includes(daily)) {
          state.currentFolder = daily;
        }
      }
      if (!state.currentFolder) {
        if (home && options.includes(home)) state.currentFolder = home;
        else state.currentFolder = options[0] || "";
      }
    }
    if (state.currentFolder && !options.includes(state.currentFolder)) {
      const daily = state.role !== "admin" ? String(state.dailyFolder || "") : "";
      state.currentFolder = daily && options.includes(daily) ? daily : (options[0] || "");
    }

    if (els.folderSelect) {
      els.folderSelect.innerHTML = options
        .map((path) => `<option value="${esc(path)}">${esc(path)}</option>`)
        .join("");
      els.folderSelect.value = state.currentFolder;
    }

    if (els.shareFoldersSelect) {
      const shareOptions = state.folders
        .filter((f) => !!f.can_manage)
        .map((f) => `<option value="${esc(f.path)}">${esc(f.path)}</option>`)
        .join("");
      els.shareFoldersSelect.innerHTML = shareOptions;
    }
    pruneSelections();
    renderFolderBrowser();
    updateFolderUiState();
    updateSelectModeUi();
    updateStats();
  }

  function filePreviewHtml(file) {
    if (file.thumb_url) {
      return `<img src="${esc(file.thumb_url)}" alt="${esc(file.filename)}" loading="lazy">`;
    }
    if (file.preview_3d_thumbnail) {
      const src = String(file.preview_model_url || file.content_url || "");
      return `<model-viewer src="${esc(src)}" camera-controls interaction-prompt="none" disable-pan></model-viewer>`;
    }
    if (String(file.mime_type || "").startsWith("image/")) {
      return `<img src="${esc(file.content_url)}" alt="${esc(file.filename)}" loading="lazy">`;
    }
    if (String(file.mime_type || "").startsWith("video/")) {
      return `<video src="${esc(file.content_url)}" muted preload="metadata" controls></video>`;
    }
    if (file.is_3d) {
      const thumbStatus = String(file.thumb_status || "").toLowerCase();
      if (thumbStatus === "error") {
        return `<div class="placeholder">Thumbnail fejl</div>`;
      }
      if (thumbStatus === "cancelled") {
        return `<div class="placeholder">Thumbnail annulleret</div>`;
      }
      return `<div class="placeholder">Genererer 3D thumbnail...</div>`;
    }
    return `<div class="placeholder">${esc(file.ext || "fil").toUpperCase()}</div>`;
  }

  function normalizedSliceStatus(file) {
    if (!file || !file.can_slice) return "none";
    const status = String(file.slice_status || "none").trim().toLowerCase();
    if (status === "queued" || status === "processing" || status === "ready" || status === "error") {
      return status;
    }
    return "none";
  }

  function sliceBadgeHtml(file) {
    if (!file || !file.can_slice) return "";
    const status = normalizedSliceStatus(file);
    if (status === "none") return "";

    const meta = {
      queued: { cls: "queued", text: "Slice i kø" },
      processing: { cls: "processing", text: "Slicer…" },
      ready: { cls: "ready", text: "Slice klar" },
      error: { cls: "error", text: "Slice fejl" },
    }[status];
    if (!meta) return "";
    const fileId = Number(file.id || 0);
    const disabledAttr = SLICE_ACTIONS_DISABLED || status === "queued" ? "disabled" : "";
    const titleAttr = SLICE_ACTIONS_DISABLED ? `title="${esc(SLICE_DISABLED_TITLE)}"` : "";
    const action = status === "processing" ? "stop-slice" : "open-slice";
    if (!fileId) {
      return `<span class="file-slice-badge ${meta.cls}">${esc(meta.text)}</span>`;
    }
    return `<button class="file-slice-badge ${meta.cls}" type="button" data-action="${action}" data-file-id="${fileId}" ${disabledAttr} ${titleAttr}>${esc(meta.text)}</button>`;
  }

  function sliceButtonLabelForStatus(status) {
    if (status === "queued") return "Slicer i kø";
    if (status === "processing") return "Stop slice";
    if (status === "ready") return "Slice igen";
    if (status === "error") return "Prøv slicing igen";
    return "Slice STL";
  }

  function toStringList(values) {
    if (!Array.isArray(values)) return [];
    return values.map((v) => String(v || "").trim()).filter(Boolean);
  }

  function renderSliceSelect(selectEl, options, placeholder = "Vælg", includeEmptyOption = true) {
    if (!selectEl) return;
    const list = toStringList(options);
    const optionsHtml = list.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`);
    const html = (includeEmptyOption
      ? [`<option value="">${esc(placeholder)}</option>`, ...optionsHtml]
      : optionsHtml
    ).join("");
    selectEl.innerHTML = html;
  }

  function firstNonEmptySliceSelectValue(selectEl) {
    if (!selectEl) return "";
    const first = Array.from(selectEl.options || []).find((opt) => String(opt.value || "").trim());
    return first ? String(first.value || "").trim() : "";
  }

  function ensureSliceSelectHasValue(selectEl) {
    if (!selectEl) return "";
    const current = String(selectEl.value || "").trim();
    if (current) return current;
    const first = firstNonEmptySliceSelectValue(selectEl);
    if (first) {
      selectEl.value = first;
      return first;
    }
    return "";
  }

  function syncSliceProcessProfileSelectFromMain() {
    if (!els.slicePrintProfileSelect || !els.sliceProcessProfileSelect) return;
    const mainValue = String(els.slicePrintProfileSelect.value || "");
    const hasOption = Array.from(els.sliceProcessProfileSelect.options || []).some((opt) => String(opt.value || "") === mainValue);
    els.sliceProcessProfileSelect.value = hasOption ? mainValue : "";
  }

  function syncMainPrintProfileSelectFromProcess() {
    if (!els.slicePrintProfileSelect || !els.sliceProcessProfileSelect) return;
    const wanted = String(els.sliceProcessProfileSelect.value || "");
    const hasOption = Array.from(els.slicePrintProfileSelect.options || []).some((opt) => String(opt.value || "") === wanted);
    els.slicePrintProfileSelect.value = hasOption ? wanted : "";
  }

  function renderKnownPrinterSelect(selectEl, selectedKey = "") {
    if (!selectEl) return;
    const models = KNOWN_PRINTER_MODELS; // built-ins first
    const html = models
      .map((m) => {
        const width = Number(m.width_mm || 0);
        const depth = Number(m.depth_mm || 0);
        return `<option value="${esc(m.key)}" data-width-mm="${esc(width)}" data-depth-mm="${esc(depth)}">${esc(m.name)}</option>`;
      })
      .join("");
    selectEl.innerHTML = html;
    const match = models.find((m) => m.key === String(selectedKey || ""));
    selectEl.value = match ? match.key : "";
  }

  function applyKnownPrinterBedSize(key) {
    const wanted = String(key || "").trim();
    if (!wanted || !els.sliceKnownPrinterSelect) return;
    const selectedOption = Array.from(els.sliceKnownPrinterSelect.options || []).find((opt) => String(opt.value || "") === wanted) || null;
    const optionWidth = Number(selectedOption && selectedOption.dataset ? selectedOption.dataset.widthMm : 0);
    const optionDepth = Number(selectedOption && selectedOption.dataset ? selectedOption.dataset.depthMm : 0);
    if (!(optionWidth > 0 && optionDepth > 0)) return;
    if (els.sliceBedWidthInput) els.sliceBedWidthInput.value = String(clampSliceBedSizeMm(optionWidth, DEFAULT_SLICE_BED_SIZE_MM.width_mm));
    if (els.sliceBedDepthInput) els.sliceBedDepthInput.value = String(clampSliceBedSizeMm(optionDepth, DEFAULT_SLICE_BED_SIZE_MM.depth_mm));
    refreshSlicePreviewBedFromSelection();
  }

  function guessKnownModelFromProfileName(name = "") {
    const n = String(name || "").toLowerCase();
    if (!n) return "";
    if (/\bh2d\b/.test(n)) return "bambu-h2d";
    if (/\ba1\s*mini\b|\ba1mini\b/.test(n)) return "bambu-a1-mini";
    if (/\ba1\b/.test(n)) return "bambu-a1";
    if (/\bp1p\b|\bp1s\b/.test(n)) return "bambu-p1";
    if (/\bx1c\b|\bx1\b/.test(n)) return "bambu-x1";
    if (/\b220x?220\b/.test(n)) return "generic-220";
    if (/\b235x?235\b/.test(n)) return "generic-235";
    if (/\b300x?300\b/.test(n)) return "generic-300";
    return "";
  }

  function setSliceSelectValue(selectEl, preferredValue = "") {
    if (!selectEl) return;
    const wanted = String(preferredValue || "").trim();
    if (!wanted) {
      selectEl.value = "";
      return;
    }
    const hasOption = Array.from(selectEl.options || []).some((opt) => String(opt.value || "") === wanted);
    selectEl.value = hasOption ? wanted : "";
  }

  function normalizeProfileToken(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function sliceProfilePrinterFamilyFromName(name = "") {
    const compact = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!compact) return "";
    const padded = ` ${compact} `;
    if (padded.includes(" h2d ")) return "h2d";
    if (padded.includes(" h2c ")) return "h2c";
    if (padded.includes(" a1mini ") || padded.includes(" a1 mini ") || padded.includes(" a1m ")) return "a1mini";
    if (padded.includes(" a1 ")) return "a1";
    if (
      padded.includes(" x1c ")
      || padded.includes(" x1 ")
      || padded.includes(" p1s ")
      || padded.includes(" p1p ")
      || padded.includes(" p1 ")
    ) {
      return "x1p1";
    }
    return "";
  }

  function filteredSliceProfilesForPrinterFamily(
    profiles,
    printerProfileName = "",
    options = {}
  ) {
    const includeGenericProfiles = !Object.prototype.hasOwnProperty.call(options || {}, "includeGenericProfiles")
      ? true
      : Boolean(options && options.includeGenericProfiles);
    const fallbackToAll = !Object.prototype.hasOwnProperty.call(options || {}, "fallbackToAll")
      ? true
      : Boolean(options && options.fallbackToAll);
    const all = toStringList(profiles);
    if (!all.length) return all;

    const printerFamily = sliceProfilePrinterFamilyFromName(printerProfileName);
    if (!printerFamily) return all;

    const allowedFamilies = new Set([printerFamily]);
    const filtered = all.filter((profileName) => {
      const profileFamily = sliceProfilePrinterFamilyFromName(profileName);
      if (!profileFamily) return includeGenericProfiles;
      return allowedFamilies.has(profileFamily);
    });
    return filtered.length ? filtered : (fallbackToAll ? all : []);
  }

  function filteredSlicePrintProfilesForPrinter(printProfiles, printerProfileName = "") {
    const all = toStringList(printProfiles);
    if (!all.length) return all;

    const selectedPrinter = String(printerProfileName || "").trim();
    const selectedModel = sliceProfileModelCodeFromName(selectedPrinter);
    const printerNozzle = sliceProfileNozzleMmFromName(selectedPrinter);
    const overrideNozzle = normalizeSliceNozzleDiameter(
      (els.sliceNozzleLeftDiameterSelect && els.sliceNozzleLeftDiameterSelect.value) || ""
    );
    const selectedNozzle = String(printerNozzle || overrideNozzle || "").trim();

    if (!selectedModel && !selectedNozzle) {
      return filteredSliceProfilesForPrinterFamily(all, selectedPrinter);
    }

    const filtered = all.filter((profileName) => {
      const profileModel = sliceProfileModelCodeFromName(profileName);
      const profileNozzle = sliceProfileNozzleMmFromName(profileName);

      if (selectedModel) {
        if (!profileModel) return false;
        if (profileModel !== selectedModel) return false;
      }

      if (selectedNozzle && profileNozzle && profileNozzle !== selectedNozzle) {
        return false;
      }

      return true;
    });

    if (filtered.length) return filtered;
    return filteredSliceProfilesForPrinterFamily(all, selectedPrinter, {
      includeGenericProfiles: false,
      fallbackToAll: false,
    });
  }

  function sliceProfileModelCodeFromName(name = "") {
    const raw = String(name || "").toUpperCase();
    if (!raw.trim()) return "";
    const compact = raw.replace(/[^A-Z0-9]+/g, "");

    if (compact.includes("H2DPRO") || compact.includes("H2DP")) return "H2DP";
    if (compact.includes("H2D")) return "H2D";
    if (compact.includes("H2C")) return "H2C";
    if (compact.includes("H2S")) return "H2S";
    if (compact.includes("P2S")) return "P2S";
    if (compact.includes("X2D")) return "X2D";
    if (compact.includes("A1MINI") || compact.includes("A1M")) return "A1M";
    if (compact.includes("A1")) return "A1";
    if (compact.includes("P1S")) return "P1S";
    if (compact.includes("P1P")) return "P1P";
    if (compact.includes("P1")) return "P1";
    if (compact.includes("X1C")) return "X1C";
    if (compact.includes("X1E")) return "X1E";
    if (compact.includes("X1")) return "X1";
    return "";
  }

  function slicePrinterUsesDualNozzle(name = "") {
    const raw = String(name || "").toLowerCase();
    const compact = raw.replace(/[^a-z0-9]+/g, "");
    if (!compact) return false;
    if (compact.includes("h2d")) return true;
    if (compact.includes("idex")) return true;
    if (compact.includes("dualnozzle") || compact.includes("dualextruder")) return true;
    return /\bdual\b/.test(raw) && /\b(nozzle|extruder)\b/.test(raw);
  }

  function sliceProfileNozzleMmFromName(name = "") {
    const text = String(name || "");
    const match = text.match(/([0-9]+(?:[.,][0-9]+)?)\s*nozzle\b/i);
    if (!match) return "";
    return normalizeSliceNozzleDiameter(match[1]);
  }

  function filteredSliceFilamentProfilesForPrinter(filamentProfiles, printerProfileName = "") {
    const all = toStringList(filamentProfiles);
    if (!all.length) return all;

    const selectedPrinter = String(printerProfileName || "").trim();
    const selectedModel = sliceProfileModelCodeFromName(selectedPrinter);
    const printerNozzle = sliceProfileNozzleMmFromName(selectedPrinter);
    const overrideNozzle = normalizeSliceNozzleDiameter(
      (els.sliceNozzleLeftDiameterSelect && els.sliceNozzleLeftDiameterSelect.value) || ""
    );
    const selectedNozzle = String(printerNozzle || overrideNozzle || "").trim();

    if (!selectedModel && !selectedNozzle) {
      return filteredSliceProfilesForPrinterFamily(all, selectedPrinter, {
        includeGenericProfiles: false,
        fallbackToAll: false,
      });
    }

    const filtered = all.filter((profileName) => {
      const profileModel = sliceProfileModelCodeFromName(profileName);
      const profileNozzle = sliceProfileNozzleMmFromName(profileName);

      if (selectedModel) {
        if (!profileModel) return false;
        if (profileModel !== selectedModel) return false;
      }

      if (selectedNozzle && profileNozzle && profileNozzle !== selectedNozzle) {
        return false;
      }

      return true;
    });

    return filtered;
  }

  function applySlicePrintProfileFilterForSelectedPrinter(preferredValue = "") {
    if (!els.slicePrintProfileSelect || !els.sliceProcessProfileSelect) return;
    const allPrintProfiles = state.sliceProfiles && typeof state.sliceProfiles === "object"
      ? toStringList(state.sliceProfiles.print_profiles)
      : [];
    const selectedPrinter = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "").trim();
    const filteredPrintProfiles = filteredSlicePrintProfilesForPrinter(allPrintProfiles, selectedPrinter);
    const currentMain = String(els.slicePrintProfileSelect.value || "").trim();
    const currentProcess = String(els.sliceProcessProfileSelect.value || "").trim();
    const wanted = String(preferredValue || currentMain || currentProcess || "").trim();

    renderSliceSelect(els.slicePrintProfileSelect, filteredPrintProfiles, "Auto / fra config");
    renderSliceSelect(els.sliceProcessProfileSelect, filteredPrintProfiles, "Auto / fra config");
    setSliceSelectValue(els.slicePrintProfileSelect, wanted);
    ensureSliceSelectHasValue(els.slicePrintProfileSelect);
    syncSliceProcessProfileSelectFromMain();
  }

  function applySliceFilamentFilterForSelectedPrinter(preferredValue = "") {
    if (!els.sliceFilamentProfileSelect) return;
    const allFilaments = state.sliceProfiles && typeof state.sliceProfiles === "object"
      ? toStringList(state.sliceProfiles.filament_profiles)
      : [];
    const selectedPrinter = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "").trim();
    const currentValue = String(els.sliceFilamentProfileSelect.value || "").trim();
    const filteredFilaments = filteredSliceFilamentProfilesForPrinter(allFilaments, selectedPrinter);
    const hasMatches = filteredFilaments.length > 0;
    const placeholder = selectedPrinter && !hasMatches
      ? "Ingen filamentprofiler for valgt printer"
      : "Vælg filamentprofil";
    renderSliceSelect(els.sliceFilamentProfileSelect, filteredFilaments, placeholder, !hasMatches);
    setSliceSelectValue(els.sliceFilamentProfileSelect, preferredValue || currentValue);
    ensureSliceSelectHasValue(els.sliceFilamentProfileSelect);
  }

  function updateSliceNozzleUiForSelectedPrinter() {
    const printerName = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "");
    const usesDualNozzle = slicePrinterUsesDualNozzle(printerName);
    const rightNozzleCol = els.sliceNozzleRightDiameterSelect
      ? els.sliceNozzleRightDiameterSelect.closest(".slice-nozzle-col")
      : null;
    const leftNozzleCol = els.sliceNozzleLeftDiameterSelect
      ? els.sliceNozzleLeftDiameterSelect.closest(".slice-nozzle-col")
      : null;
    const leftTitle = leftNozzleCol ? leftNozzleCol.querySelector(".slice-nozzle-col-title") : null;

    if (leftTitle) leftTitle.textContent = usesDualNozzle ? "Left nozzle" : "Nozzle";
    if (rightNozzleCol) rightNozzleCol.classList.toggle("hidden", !usesDualNozzle);

    [els.sliceNozzleRightDiameterSelect, els.sliceNozzleRightFlowSelect].forEach((selectEl) => {
      if (!selectEl) return;
      selectEl.disabled = !usesDualNozzle;
      if (!usesDualNozzle) selectEl.value = "";
    });

    if (!usesDualNozzle) {
      state.lastSliceSelection.print_nozzle = "";
      state.lastSliceSelection.nozzle_right_diameter = "";
      state.lastSliceSelection.nozzle_right_flow = "";
      if (state.sliceProcessSettingsOverrides && typeof state.sliceProcessSettingsOverrides === "object") {
        delete state.sliceProcessSettingsOverrides.print_extruder_id;
        delete state.sliceProcessSettingsOverrides.printer_extruder_id;
      }
    }
  }

  function normalizeSliceBedSize(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const width = Number(candidate.width_mm);
    const depth = Number(candidate.depth_mm);
    if (!Number.isFinite(width) || !Number.isFinite(depth)) return null;
    if (width <= 0 || depth <= 0) return null;
    return {
      width_mm: Math.max(40, Math.min(2000, width)),
      depth_mm: Math.max(40, Math.min(2000, depth)),
    };
  }

  function parseSlicePrinterBeds(rawBeds) {
    if (!rawBeds || typeof rawBeds !== "object") return {};
    const out = {};
    Object.entries(rawBeds).forEach(([name, value]) => {
      const key = String(name || "").trim();
      if (!key) return;
      const normalized = normalizeSliceBedSize(value);
      if (!normalized) return;
      out[key] = normalized;
    });
    return out;
  }

  function pickSliceBedByProfileName(beds, profileName = "") {
    if (!beds || typeof beds !== "object") return null;
    const selected = String(profileName || "").trim();
    if (!selected) return null;

    const direct = normalizeSliceBedSize(beds[selected]);
    if (direct) return direct;

    const wanted = normalizeProfileToken(selected);
    if (!wanted) return null;
    for (const [name, value] of Object.entries(beds)) {
      if (normalizeProfileToken(name) !== wanted) continue;
      const normalized = normalizeSliceBedSize(value);
      if (normalized) return normalized;
    }
    return null;
  }

  function resolveSelectedSliceBedSize() {
    const parsedDefault = {
      width_mm: Number(DEFAULT_SLICE_BED_SIZE_MM.width_mm),
      depth_mm: Number(DEFAULT_SLICE_BED_SIZE_MM.depth_mm),
    };

    const selected = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "").trim();

    const mappedBeds = state.sliceProfiles && typeof state.sliceProfiles === "object" && state.sliceProfiles.printer_bed_map
      ? state.sliceProfiles.printer_bed_map
      : {};
    const fromMapped = pickSliceBedByProfileName(mappedBeds, selected);
    if (fromMapped) return fromMapped;

    const detectedBeds = state.sliceProfiles && typeof state.sliceProfiles === "object" && state.sliceProfiles.printer_beds
      ? state.sliceProfiles.printer_beds
      : {};
    const fromDetected = pickSliceBedByProfileName(detectedBeds, selected);
    if (fromDetected) return fromDetected;

    return parsedDefault;
  }

  function pickSliceBedMapEntryByProfileName(rawMap, profileName = "") {
    if (!rawMap || typeof rawMap !== "object") return null;
    const selected = String(profileName || "").trim();
    if (!selected) return null;

    const direct = rawMap[selected];
    if (direct && typeof direct === "object") return direct;

    const wanted = normalizeProfileToken(selected);
    if (!wanted) return null;
    for (const [name, value] of Object.entries(rawMap)) {
      if (normalizeProfileToken(name) !== wanted) continue;
      if (value && typeof value === "object") return value;
    }
    return null;
  }

  function resolveSelectedSlicePlateModelKey() {
    const selectedPrinter = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "").trim();
    const mapFromSettings = state.slicerSettings && typeof state.slicerSettings === "object"
      ? state.slicerSettings.printer_bed_map
      : null;
    const mapFromProfiles = state.sliceProfiles && typeof state.sliceProfiles === "object"
      ? state.sliceProfiles.printer_bed_map_raw
      : null;

    const mappedEntry = pickSliceBedMapEntryByProfileName(mapFromSettings || {}, selectedPrinter)
      || pickSliceBedMapEntryByProfileName(mapFromProfiles || {}, selectedPrinter);
    if (mappedEntry && typeof mappedEntry === "object") {
      const mappedModel = String(mappedEntry.model_key || "").trim().toLowerCase();
      if (mappedModel) return mappedModel;
    }

    const bed = resolveSelectedSliceBedSize();
    return guessBedMapModelKey(selectedPrinter, bed.width_mm, bed.depth_mm);
  }

  function normalizeSlicerPlateAssets(items) {
    const list = Array.isArray(items) ? items : [];
    return list
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const name = String(item.name || "").trim();
        const stem = String(item.stem || "").trim() || name.replace(/\.[^.]+$/, "");
        const ext = String(item.ext || "").trim().toLowerCase();
        const url = String(item.url || "").trim();
        if (!name || !ext || !url) return null;
        return { name, stem, ext, url };
      })
      .filter(Boolean);
  }

  async function loadSlicerPlateAssets(force = false) {
    if (!force && Array.isArray(state.slicePlateAssets)) return state.slicePlateAssets;
    const data = await api("/api/slicer/plates");
    const assets = normalizeSlicerPlateAssets(data && data.items);
    state.slicePlateAssets = assets;
    return assets;
  }

  function plateTokensForModel(modelKey = "") {
    const key = String(modelKey || "").trim().toLowerCase();
    const aliases = Array.isArray(SLICER_PLATE_MODEL_ALIASES[key]) ? SLICER_PLATE_MODEL_ALIASES[key] : [];
    const tokens = [key, ...aliases]
      .map((value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, ""))
      .filter(Boolean);
    return Array.from(new Set(tokens));
  }

  function pickSlicerPlateAssetForModel(modelKey = "", assets = []) {
    const key = String(modelKey || "").trim().toLowerCase();
    if (!key) return null;
    const list = Array.isArray(assets) ? assets : [];
    if (!list.length) return null;
    const tokens = plateTokensForModel(key);
    if (!tokens.length) return null;

    const candidates = list
      .filter((asset) => asset && (asset.ext === ".stl" || asset.ext === ".obj"))
      .map((asset) => {
        const stemToken = String(asset.stem || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        let score = 0;
        tokens.forEach((token) => {
          if (stemToken.includes(token)) score += token.length;
        });
        const extBias = asset.ext === ".stl" ? 2 : 1;
        return { asset, score, extBias };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => (b.score - a.score) || (b.extBias - a.extBias) || String(a.asset.name).localeCompare(String(b.asset.name), "da"));

    return candidates.length ? candidates[0].asset : null;
  }

  function clampSliceRotationDeg(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(-180, Math.min(180, Math.round(numeric)));
  }

  function clampSliceLiftMm(value, fallback = 0) {
    const numeric = Number(value || fallback || 0);
    if (!Number.isFinite(numeric)) return 0;
    const clamped = Math.max(SLICE_LIFT_RANGE_MM.min, Math.min(SLICE_LIFT_RANGE_MM.max, numeric));
    return Math.round(clamped * 10) / 10;
  }

  function normalizeSliceSupportMode(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return SLICE_SUPPORT_MODE_VALUES.has(normalized) ? normalized : "auto";
  }

  function normalizeSliceSupportType(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    if (!normalized) return "";
    if (normalized === "tree" || normalized === "tree_auto" || normalized === "tree(auto)") return "tree(auto)";
    if (normalized === "normal" || normalized === "normal_auto" || normalized === "normal(auto)") return "normal(auto)";
    return SLICE_SUPPORT_TYPE_VALUES.has(normalized) ? normalized : "";
  }

  function normalizeSliceSupportStyle(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    if (!normalized) return "";
    if (normalized === "tree_slim" || normalized === "treeslim") return "tree_slim";
    if (normalized === "tree_strong" || normalized === "treestrong") return "tree_strong";
    if (normalized === "tree_hybrid" || normalized === "treehybrid") return "tree_hybrid";
    if (normalized === "tree_organic" || normalized === "treeorganic") return "tree_organic";
    if (normalized === "default_style" || normalized === "auto") return "default";
    return SLICE_SUPPORT_STYLE_VALUES.has(normalized) ? normalized : "";
  }

  function supportStyleValuesForType(supportType) {
    const normalizedType = normalizeSliceSupportType(supportType);
    if (normalizedType === "tree(auto)") return [...SLICE_SUPPORT_STYLE_TREE_VALUES];
    if (normalizedType === "normal(auto)") return [...SLICE_SUPPORT_STYLE_NORMAL_VALUES];
    return [...SLICE_SUPPORT_STYLE_ALL_VALUES];
  }

  function normalizeSliceNozzleDiameter(value) {
    const raw = String(value || "").trim().replace(",", ".");
    if (!raw) return "";
    if (SLICE_NOZZLE_DIAMETER_VALUES.has(raw)) return raw;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return "";
    const canonical = parsed.toFixed(1);
    return SLICE_NOZZLE_DIAMETER_VALUES.has(canonical) ? canonical : "";
  }

  function normalizeSliceNozzleFlow(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
    if (normalized === "normal") return "standard";
    return SLICE_NOZZLE_FLOW_VALUES.has(normalized) ? normalized : "";
  }

  function normalizeSlicePrintNozzle(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
    if (!normalized) return "";
    if (normalized === "left" || normalized === "venstre" || normalized === "l" || normalized === "1") return "left";
    if (normalized === "right" || normalized === "hojre" || normalized === "højre" || normalized === "r" || normalized === "2") return "right";
    return "";
  }

  function clampSliceBedSizeMm(value, fallback = 0) {
    const numeric = Number(value || fallback || 0);
    if (!Number.isFinite(numeric)) return Number(fallback || 0);
    return Math.max(40, Math.min(2000, numeric));
  }

  function rotationInputElementForAxis(axis) {
    const key = String(axis || "").toLowerCase();
    if (key === "x") return els.sliceRotateXInput;
    if (key === "y") return els.sliceRotateYInput;
    return els.sliceRotateZInput;
  }

  function rotationValueElementForAxis(axis) {
    const key = String(axis || "").toLowerCase();
    if (key === "x") return els.sliceRotateXValue;
    if (key === "y") return els.sliceRotateYValue;
    return els.sliceRotateZValue;
  }

  function currentSliceRotation() {
    return {
      x: clampSliceRotationDeg(state.sliceRotation && state.sliceRotation.x),
      y: clampSliceRotationDeg(state.sliceRotation && state.sliceRotation.y),
      z: clampSliceRotationDeg(state.sliceRotation && state.sliceRotation.z),
    };
  }

  function currentSliceLiftMm() {
    return 0;
  }

  function setSliceRotateAxisValueText(axis, rotationDeg) {
    const valueEl = rotationValueElementForAxis(axis);
    if (!valueEl) return;
    valueEl.textContent = `${clampSliceRotationDeg(rotationDeg)} deg`;
  }

  function syncSliceRotationInputs(rotation = null) {
    const next = rotation && typeof rotation === "object" ? rotation : currentSliceRotation();
    const x = clampSliceRotationDeg(next.x);
    const y = clampSliceRotationDeg(next.y);
    const z = clampSliceRotationDeg(next.z);

    if (!state.sliceRotation || typeof state.sliceRotation !== "object") {
      state.sliceRotation = { x, y, z };
    } else {
      state.sliceRotation.x = x;
      state.sliceRotation.y = y;
      state.sliceRotation.z = z;
    }

    const xInput = rotationInputElementForAxis("x");
    if (xInput) xInput.value = String(x);
    const yInput = rotationInputElementForAxis("y");
    if (yInput) yInput.value = String(y);
    const zInput = rotationInputElementForAxis("z");
    if (zInput) zInput.value = String(z);

    setSliceRotateAxisValueText("x", x);
    setSliceRotateAxisValueText("y", y);
    setSliceRotateAxisValueText("z", z);
  }

  function setSliceLiftValueText(valueMm) {
    if (!els.sliceLiftZValue) return;
    els.sliceLiftZValue.textContent = `${formatNumberCompact(clampSliceLiftMm(valueMm))} mm (auto-snap til plade)`;
  }

  function setSlicePreviewHeight(text, kind = "") {
    if (!els.slicePreviewHeight) return;
    els.slicePreviewHeight.textContent = String(text || "Model Z: -");
    els.slicePreviewHeight.classList.remove("ok", "error", "warn");
    if (kind === "ok" || kind === "error" || kind === "warn") {
      els.slicePreviewHeight.classList.add(kind);
    }
  }

  function currentSliceProcessSupportType() {
    const base = state.sliceProcessSettingsBase && typeof state.sliceProcessSettingsBase === "object"
      ? state.sliceProcessSettingsBase
      : {};
    const overrides = state.sliceProcessSettingsOverrides && typeof state.sliceProcessSettingsOverrides === "object"
      ? state.sliceProcessSettingsOverrides
      : {};
    const fromProcessSettings = normalizeSliceSupportType(
      sliceProcessCurrentValueByCanonicalKey("support_type", base, overrides)
    );
    if (fromProcessSettings) return fromProcessSettings;
    const fromSidebar = normalizeSliceSupportType((els.sliceSupportTypeSelect && els.sliceSupportTypeSelect.value) || "");
    if (fromSidebar) return fromSidebar;
    return normalizeSliceSupportType(state.lastSliceSelection && state.lastSliceSelection.support_type);
  }

  function syncSliceSupportStyleSelectOptions(typeValue) {
    const styleSelect = els.sliceSupportStyleSelect;
    if (!styleSelect) return;
    const styleValues = supportStyleValuesForType(typeValue);
    const currentStyle = normalizeSliceSupportStyle(styleSelect.value || "");
    styleSelect.innerHTML = [
      `<option value="">Auto / fra profil</option>`,
      ...styleValues.map((value) => {
        const label = sliceProcessSettingOptionLabel("support_style", value) || value;
        return `<option value="${esc(value)}">${esc(label)}</option>`;
      }),
    ].join("");
    styleSelect.value = styleValues.includes(currentStyle) ? currentStyle : "";
  }

  function updateSliceSupportControlsUi() {
    const mode = normalizeSliceSupportMode((els.sliceSupportModeSelect && els.sliceSupportModeSelect.value) || "auto");
    if (els.sliceSupportModeSelect && els.sliceSupportModeSelect.value !== mode) {
      els.sliceSupportModeSelect.value = mode;
    }

    const typeSelect = els.sliceSupportTypeSelect;
    const styleSelect = els.sliceSupportStyleSelect;
    const disableDetails = mode !== "on";

    if (typeSelect) {
      const normalizedType = normalizeSliceSupportType(typeSelect.value);
      if (typeSelect.value !== normalizedType) typeSelect.value = normalizedType;
      typeSelect.disabled = disableDetails;
      if (disableDetails) typeSelect.value = "";
      syncSliceSupportStyleSelectOptions(normalizedType);
    }

    if (styleSelect && !typeSelect) {
      syncSliceSupportStyleSelectOptions(currentSliceProcessSupportType());
    }
    if (styleSelect) {
      const normalizedStyle = normalizeSliceSupportStyle(styleSelect.value);
      if (styleSelect.value !== normalizedStyle) styleSelect.value = normalizedStyle;
      styleSelect.disabled = disableDetails;
      if (disableDetails) styleSelect.value = "";
    }
  }

  function sliceProcessSettingsProfileKey() {
    const printer = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "").trim().toLowerCase();
    const print = String((els.slicePrintProfileSelect && els.slicePrintProfileSelect.value) || "").trim().toLowerCase();
    const filament = String((els.sliceFilamentProfileSelect && els.sliceFilamentProfileSelect.value) || "").trim().toLowerCase();
    return `${printer}|${print}|${filament}`;
  }

  function sliceProcessKeyLooksBoolean(key) {
    const normalized = String(key || "").trim().toLowerCase();
    if (!normalized) return false;
    if (/^(prime_tower|wipe_tower|prime_tower_skip_points|prime_tower_internal_ribs|prime_tower_rib_wall|prime_tower_fillet_wall|purge_into_objects_infill|purge_into_objects_support|purge_into_infill|purge_into_support|flush_into_infill|flush_into_support|spiral_vase|reduce_infill_retraction)$/.test(normalized)) {
      return true;
    }
    return /(^|_)(enable|enabled|is|has|use|only|avoid|detect|combination|embedding|slow_down|arc_fitting|precise|print_infill_first|thick_bridges|smooth_speed_discontinuity_area|role_based_wipe_speed|scarf_joint_for_inner_walls|override_filament_scarf_seam_setting|auto_circle_contour_hole_compensation|seam_placement_away_from_overhangs|smart_scarf_seam_application|scarf_around_entire_wall|prime_tower_flat_ironing|only_one_wall_on_top_surfaces|only_one_wall_on_first_layer|smoothing_wall_speed_along_z_experimental|remove|dont|independent|z_overrides)($|_)/.test(normalized);
  }

  function normalizeSliceProcessSettingScalar(value, key = "") {
    if (typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return "";
      const lower = text.toLowerCase();
      const canonicalKey = canonicalSliceProcessKey(key);
      const normalizedKey = normalizeSliceProcessKey(key);

      if (canonicalKey === "support_type") {
        const normalizedSupportType = normalizeSliceSupportType(text);
        if (normalizedSupportType) return normalizedSupportType;
      }
      if (canonicalKey === "support_style" || normalizedKey === "style") {
        const normalizedSupportStyle = normalizeSliceSupportStyle(text);
        if (normalizedSupportStyle) return normalizedSupportStyle;
      }

      if (lower === "true" || lower === "false") return lower === "true";
      if (lower === "on" || lower === "off") return lower === "on";
      if (lower === "yes" || lower === "no") return lower === "yes";

      if (sliceProcessKeyLooksBoolean(key) && (text === "0" || text === "1")) {
        return text === "1";
      }

      if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
        const n = Number(text);
        if (Number.isFinite(n)) return n;
      }

      return text;
    }
    return null;
  }

  function normalizeSliceProcessSettingsMap(raw) {
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    Object.entries(raw).forEach(([keyRaw, valueRaw]) => {
      const key = String(keyRaw || "").trim();
      if (!key) return;
      if (key.length > 120) return;
      const value = normalizeSliceProcessSettingScalar(valueRaw, key);
      if (value === null) return;
      out[key] = value;
    });
    return out;
  }

  function normalizeSliceProcessSettingsOptionsMap(raw) {
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    Object.entries(raw).forEach(([keyRaw, valuesRaw]) => {
      const key = String(keyRaw || "").trim();
      if (!key) return;
      if (key.length > 120) return;
      const values = Array.isArray(valuesRaw) ? valuesRaw : [valuesRaw];
      const normalized = [];
      const seen = new Set();
      values.forEach((itemRaw) => {
        const item = normalizeSliceProcessSettingScalar(itemRaw, key);
        if (item === null) return;
        const signature = `${typeof item}:${String(item)}`;
        if (seen.has(signature)) return;
        seen.add(signature);
        normalized.push(item);
      });
      if (normalized.length > 1) {
        out[key] = normalized;
      }
    });
    return out;
  }

  function mergeSliceProcessSettingsWithFallback(rawSettings, rawSettingOptions) {
    const baseFromApi = normalizeSliceProcessSettingsMap(rawSettings);
    const optionsFromApi = normalizeSliceProcessSettingsOptionsMap(rawSettingOptions);

    // Keep backend values authoritative; fallback only fills missing keys.
    const fallbackBase = normalizeSliceProcessSettingsMap(SLICE_PROCESS_FALLBACK_BASE_SETTINGS);
    const mergedBase = { ...fallbackBase, ...baseFromApi };
    if (typeof mergedBase.wall_generator === "string" && normalizeSliceProcessKey(mergedBase.wall_generator) === "auto") {
      mergedBase.wall_generator = "classic";
    }

    const fallbackOptions = normalizeSliceProcessSettingsOptionsMap(SLICE_PROCESS_FALLBACK_SETTING_OPTIONS);
    const mergedOptions = { ...optionsFromApi };
    Object.entries(fallbackOptions).forEach(([key, fallbackValues]) => {
      const existingValues = Array.isArray(mergedOptions[key]) ? mergedOptions[key] : [];
      const seed = [];
      if (Object.prototype.hasOwnProperty.call(mergedBase, key)) {
        seed.push(mergedBase[key]);
      }
      const normalizedMerged = normalizeSliceProcessSettingsOptionsMap({
        [key]: [...seed, ...existingValues, ...fallbackValues],
      });
      if (Array.isArray(normalizedMerged[key]) && normalizedMerged[key].length > 1) {
        mergedOptions[key] = normalizedMerged[key];
      }
    });

    const wallGeneratorRaw = [
      mergedBase.wall_generator,
      ...(Array.isArray(mergedOptions.wall_generator) ? mergedOptions.wall_generator : []),
    ].map((value) => {
      if (typeof value === "string" && normalizeSliceProcessKey(value) === "auto") {
        return "classic";
      }
      return value;
    });
    const wallGeneratorOptions = normalizeSliceProcessSettingsOptionsMap({
      wall_generator: wallGeneratorRaw,
    });
    if (Array.isArray(wallGeneratorOptions.wall_generator) && wallGeneratorOptions.wall_generator.length > 1) {
      mergedOptions.wall_generator = wallGeneratorOptions.wall_generator;
    } else {
      delete mergedOptions.wall_generator;
    }

    return {
      apiBase: baseFromApi,
      base: mergedBase,
      options: mergedOptions,
    };
  }

  function sliceProcessValueEquals(a, b) {
    if (typeof a === "number" && typeof b === "number") {
      return Math.abs(a - b) < 1e-9;
    }
    return a === b;
  }

  function sliceProcessValueInputType(value) {
    if (typeof value === "boolean") return "bool";
    if (typeof value === "number") return "number";
    return "string";
  }

  function sliceProcessValueToText(value) {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return formatNumberCompact(value);
    return String(value || "");
  }

  function sliceProcessValueToAttr(value) {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
    return String(value == null ? "" : value);
  }

  function parseSliceProcessOverrideByType(baseValue, rawValue, valueType = "string") {
    if (valueType === "bool") {
      return !!rawValue;
    }
    if (valueType === "number") {
      const n = Number(rawValue);
      if (Number.isFinite(n)) return n;
      return Number(baseValue || 0);
    }
    return String(rawValue == null ? "" : rawValue);
  }

  const SLICE_PROCESS_TAB_ORDER = ["quality", "strength", "speed", "support", "others"];
  const SLICE_PROCESS_TAB_LABELS = {
    quality: "Quality",
    strength: "Strength",
    speed: "Speed",
    support: "Support",
    others: "Others",
  };

  const SLICE_PROCESS_KEY_ALIASES = {
    elefant_foot_compensation: "elephant_foot_compensation",
    x_y_hole_compensation: "xy_hole_compensation",
    x_y_contour_compensation: "xy_contour_compensation",
    initial_layer_print_height: "initial_layer_height",
    first_layer_height: "initial_layer_height",
    default_line_width: "line_width",
    perimeter_generator: "wall_generator",
    perimeters: "wall_loops",
    wall_count: "wall_loops",
    wall_line_count: "wall_loops",
    top_layers: "top_shell_layers",
    bottom_layers: "bottom_shell_layers",
    solid_infill_pattern: "internal_solid_infill_pattern",
    sparse_infill_anchor_length: "length_of_sparse_infill_anchor",
    sparse_infill_anchor_max_length: "maximum_length_of_sparse_infill_anchor",
    max_length_of_sparse_infill_anchor: "maximum_length_of_sparse_infill_anchor",
    infill_overlap: "infill_wall_overlap",
    infill_walls_overlap: "infill_wall_overlap",
    minimum_sparse_infill_area: "minimum_sparse_infill_threshold",
    wall_transition_threshold_angle: "wall_transitioning_threshold_angle",
    wall_transition_filter_margin: "wall_transitioning_filter_margin",
    wall_transitioning_length: "wall_transition_length",
    min_wall_width: "minimum_wall_width",
    min_feature_size: "minimum_feature_size",
    initial_layer_print_speed: "initial_layer_speed",
    first_layer_speed: "initial_layer_speed",
    first_layer_infill_speed: "initial_layer_infill_speed",
    initial_layer_infill_print_speed: "initial_layer_infill_speed",
    external_perimeter_speed: "outer_wall_speed",
    perimeter_speed: "inner_wall_speed",
    small_perimeter_min_length: "small_perimeter_threshold",
    internal_infill_speed: "sparse_infill_speed",
    solid_infill_speed: "internal_solid_infill_speed",
    top_surface_print_speed: "top_surface_speed",
    bridge_print_speed: "bridge_speed",
    gap_fill_speed: "gap_infill_speed",
    support_material_speed: "support_speed",
    support_material_interface_speed: "support_interface_speed",
    support_interface_print_speed: "support_interface_speed",
    travel_print_speed: "travel_speed",
    default_acceleration: "normal_printing_acceleration",
    print_acceleration: "normal_printing_acceleration",
    infill_acceleration: "sparse_infill_acceleration",
    internal_infill_acceleration: "sparse_infill_acceleration",
    first_layer_acceleration: "initial_layer_acceleration",
    first_layer_travel_acceleration: "initial_layer_travel_acceleration",
    top_surface_accel: "top_surface_acceleration",
    overhang_1_4_speed: "overhang_speed_25",
    overhang_2_4_speed: "overhang_speed_50",
    overhang_3_4_speed: "overhang_speed_75",
    overhang_4_4_speed: "overhang_speed_100",
    overhang_speed_0: "overhang_speed_10",
    overhang_speed_1: "overhang_speed_25",
    overhang_speed_2: "overhang_speed_50",
    overhang_speed_3: "overhang_speed_75",
    overhang_speed_4: "overhang_speed_100",
    overhang_totally_speed: "overhang_speed_100",
    enable_overhang_speed: "slow_down_for_overhangs",
    support_buildplate_only: "support_on_build_plate_only",
    support_on_buildplate_only: "support_on_build_plate_only",
    support_critical_regions: "support_critical_regions_only",
    support_enable: "enable_support",
    enable_support_material: "enable_support",
    support_material: "enable_support",
    support_structure: "support_type",
    support_remove_small_overhangs: "remove_small_overhangs",
    support_filament_1: "support_filament_raft_base",
    support_filament_2: "support_filament_raft_interface",
    support_raft_base_filament: "support_filament_raft_base",
    support_raft_interface_filament: "support_filament_raft_interface",
    support_base_pattern: "base_pattern",
    support_base_pattern_spacing: "base_pattern_spacing",
    support_interface_top_layers: "top_interface_layers",
    support_interface_bottom_layers: "bottom_interface_layers",
    support_interface_pattern: "interface_pattern",
    support_interface_top_spacing: "top_interface_spacing",
    support_xy_distance: "support_object_xy_distance",
    support_first_layer_gap: "support_object_first_layer_gap",
    support_z_overrides_xy: "z_overrides_xy",
    support_independent_layer_height: "independent_support_layer_height",
    skirt_line_count: "skirt_loops",
    skirt_loop_count: "skirt_loops",
    brim_gap: "brim_object_gap",
    brim_separation: "brim_object_gap",
    brim_object_distance: "brim_object_gap",
    prime_tower_enable: "enable_prime_tower",
    prime_tower: "enable_prime_tower",
    wipe_tower: "enable_prime_tower",
    purge_into_infill: "purge_into_objects_infill",
    purge_into_support: "purge_into_objects_support",
    flush_into_infill: "purge_into_objects_infill",
    flush_into_support: "purge_into_objects_support",
    print_order: "print_sequence",
    spiral_mode: "spiral_vase",
    timelapse: "timelapse_type",
    fuzzy_skin_mode: "fuzzy_skin",
    fuzzy_skin_distance: "fuzzy_skin_point_distance",
    fuzzy_skin_point_dist: "fuzzy_skin_point_distance",
    beam_interlocking: "use_beam_interlocking",
    interlocking_depth: "interlocking_depth_of_a_segmented_region",
    post_process: "post_processing_scripts",
    post_process_script: "post_processing_scripts",
    post_process_scripts: "post_processing_scripts",
  };

  const SLICE_PROCESS_FALLBACK_BASE_SETTINGS = {
    layer_height: 0.16,
    initial_layer_height: 0.2,
    line_width: 0.42,
    initial_layer_line_width: 0.5,
    outer_wall_line_width: 0.42,
    inner_wall_line_width: 0.45,
    top_surface_line_width: 0.42,
    sparse_infill_line_width: 0.45,
    internal_solid_infill_line_width: 0.42,
    support_line_width: 0.42,
    seam_position: "aligned",
    seam_placement_away_from_overhangs: false,
    smart_scarf_seam_application: true,
    scarf_application_angle_threshold: 155,
    scarf_around_entire_wall: false,
    scarf_steps: 10,
    scarf_joint_for_inner_walls: true,
    override_filament_scarf_seam_setting: false,
    role_based_wipe_speed: true,
    slice_gap_closing_radius: 0.049,
    resolution: 0.012,
    arc_fitting: false,
    xy_hole_compensation: 0,
    xy_contour_compensation: 0,
    auto_circle_contour_hole_compensation: true,
    elephant_foot_compensation: 0.075,
    precise_z_height: false,
    ironing_type: "none",
    ironing_pattern: "rectilinear",
    ironing_speed: 20,
    ironing_flow: 20,
    ironing_line_spacing: 0.1,
    ironing_inset: 0.15,
    prime_tower_flat_ironing: true,
    wall_generator: "classic",
    wall_transitioning_threshold_angle: 10,
    wall_transitioning_filter_margin: 25,
    wall_transition_length: 100,
    wall_distribution_count: 1,
    minimum_wall_width: 85,
    minimum_feature_size: 25,
    order_of_walls: "inner_outer",
    print_infill_first: false,
    bridge_flow: 1,
    thick_bridges: false,
    only_one_wall_on_top_surfaces: false,
    only_one_wall_on_first_layer: false,
    smooth_speed_discontinuity_area: false,
    smooth_coefficient: 150,
    avoid_crossing_wall: false,
    smoothing_wall_speed_along_z_experimental: false,
    wall_loops: 2,
    embedding_wall_into_infill: false,
    detect_thin_wall: false,
    top_surface_pattern: "monotonic",
    top_surface_density: 100,
    top_shell_layers: 6,
    top_shell_thickness: 1,
    top_paint_penetration_layers: 6,
    bottom_surface_pattern: "monotonic",
    bottom_surface_density: 100,
    bottom_shell_layers: 4,
    bottom_shell_thickness: 0,
    bottom_paint_penetration_layers: 4,
    internal_solid_infill_pattern: "rectilinear",
    sparse_infill_density: 15,
    fill_multiline: 1,
    sparse_infill_pattern: "grid",
    length_of_sparse_infill_anchor: 400,
    maximum_length_of_sparse_infill_anchor: 20,
    infill_wall_overlap: 15,
    infill_direction: 45,
    bridge_direction: 0,
    minimum_sparse_infill_threshold: 15,
    infill_combination: false,
    detect_narrow_internal_solid_infill: true,
    ensure_vertical_shell_thickness: "enabled",
    detect_floating_vertical_shells: true,
    initial_layer_speed: 50,
    initial_layer_infill_speed: 105,
    outer_wall_speed: 200,
    inner_wall_speed: 300,
    small_perimeter_speed: 50,
    small_perimeter_threshold: 0,
    sparse_infill_speed: 350,
    internal_solid_infill_speed: 250,
    vertical_shell_speed: 80,
    top_surface_speed: 200,
    slow_down_for_overhangs: true,
    overhang_speed_10: 60,
    overhang_speed_25: 50,
    overhang_speed_50: 30,
    overhang_speed_75: 10,
    overhang_speed_100: 10,
    slow_down_by_height: false,
    bridge_speed: 50,
    gap_infill_speed: 250,
    support_speed: 150,
    support_interface_speed: 80,
    travel_speed: 1000,
    normal_printing_acceleration: 8000,
    travel_acceleration: 10000,
    initial_layer_travel_acceleration: 6000,
    initial_layer_acceleration: 500,
    outer_wall_acceleration: 5000,
    inner_wall_acceleration: 0,
    top_surface_acceleration: 2000,
    sparse_infill_acceleration: 100,
    enable_support: false,
    support_type: "tree(auto)",
    support_style: "default",
    support_threshold_angle: 25,
    support_on_build_plate_only: false,
    support_critical_regions_only: false,
    remove_small_overhangs: true,
    raft_layers: 0,
    support_filament_raft_base: "default",
    support_filament_raft_interface: "default",
    initial_layer_density: 90,
    initial_layer_expansion: 3,
    support_wall_loops: -1,
    top_z_distance: 0.16,
    bottom_z_distance: 0.16,
    base_pattern: "default",
    base_pattern_spacing: 2.5,
    pattern_angle: 0,
    top_interface_layers: 2,
    bottom_interface_layers: 2,
    interface_pattern: "default",
    top_interface_spacing: 0.5,
    normal_support_expansion: 0,
    support_object_xy_distance: 0.35,
    z_overrides_xy: false,
    support_object_first_layer_gap: 0.2,
    dont_support_bridges: false,
    independent_support_layer_height: true,
    skirt_loops: 0,
    skirt_height: 1,
    brim_type: "auto",
    brim_width: 5,
    brim_object_gap: 0.1,
    enable_prime_tower: true,
    prime_tower_skip_points: true,
    prime_tower_internal_ribs: false,
    prime_tower_width: 60,
    prime_tower_max_speed: 90,
    prime_tower_brim_width: "auto",
    prime_tower_infill_gap: 150,
    prime_tower_rib_wall: true,
    prime_tower_extra_rib_length: 0,
    prime_tower_rib_width: 8,
    prime_tower_fillet_wall: true,
    purge_into_objects_infill: false,
    purge_into_objects_support: true,
    slicing_mode: "regular",
    print_sequence: "by_layer",
    spiral_vase: false,
    timelapse_type: "traditional",
    fuzzy_skin: "none",
    fuzzy_skin_point_distance: 0.8,
    fuzzy_skin_thickness: 0.3,
    enable_clumping_detection_by_probing: false,
    use_beam_interlocking: false,
    interlocking_depth_of_a_segmented_region: 0,
    reduce_infill_retraction: true,
    post_processing_scripts: "",
    notes: "",
  };

  const SLICE_PROCESS_FALLBACK_SETTING_OPTIONS = {
    seam_position: ["aligned", "nearest", "rear", "random"],
    wall_generator: ["classic", "arachne"],
    order_of_walls: ["inner_outer", "outer_inner", "inner_outer_inner"],
    ironing_type: ["none", "top", "topmost_surface", "all_top_surfaces"],
    ironing_pattern: ["rectilinear", "concentric", "zig_zag"],
    ironing_flow: [10, 15, 20, 25, 30],
    smooth_coefficient: [100, 125, 150, 175, 200],
    bridge_flow: [0.8, 0.9, 1, 1.1, 1.2],
    scarf_steps: [5, 10, 15],
    scarf_application_angle_threshold: [120, 135, 150, 155, 170],
    top_surface_pattern: ["monotonic", "monotonic_line", "rectilinear", "concentric"],
    bottom_surface_pattern: ["monotonic", "monotonic_line", "rectilinear", "concentric"],
    internal_solid_infill_pattern: ["rectilinear", "grid", "monotonic", "aligned_rectilinear"],
    sparse_infill_pattern: ["grid", "gyroid", "cubic", "triangles", "rectilinear", "honeycomb"],
    ensure_vertical_shell_thickness: ["enabled", "critical_only", "disabled"],
    small_perimeter_speed: [30, 40, 50, 60, 70, 80, 100],
    vertical_shell_speed: [60, 70, 80, 90, 100],
    sparse_infill_acceleration: [50, 75, 100],
    support_type: ["tree(auto)", "normal(auto)"],
    support_style: [...SLICE_SUPPORT_STYLE_ALL_VALUES],
    support_filament_raft_base: ["default"],
    support_filament_raft_interface: ["default"],
    base_pattern: ["default", "rectilinear", "grid", "concentric", "honeycomb"],
    interface_pattern: ["default", "rectilinear", "grid", "concentric"],
    brim_type: ["auto", "outer_only", "inner_only", "outer_and_inner", "none"],
    prime_tower_brim_width: ["auto", 0, 2, 4, 6, 8, 10],
    slicing_mode: ["regular"],
    print_sequence: ["by_layer", "by_object"],
    timelapse_type: ["traditional", "smooth"],
    fuzzy_skin: ["none", "contour", "all"],
  };

  const SLICE_PROCESS_LABEL_OVERRIDES = {
    layer_height: "Layer height",
    initial_layer_height: "Initial layer height",
    initial_layer_print_height: "Initial layer height",
    first_layer_height: "Initial layer height",
    line_width: "Default",
    default_line_width: "Default",
    initial_layer_line_width: "Initial layer",
    outer_wall_line_width: "Outer wall",
    inner_wall_line_width: "Inner wall",
    top_surface_line_width: "Top surface",
    sparse_infill_line_width: "Sparse infill",
    internal_solid_infill_line_width: "Internal solid infill",
    support_line_width: "Support",
    seam_position: "Seam position",
    seam_placement_away_from_overhangs: "Seam placement away from overhangs (experimental)",
    smart_scarf_seam_application: "Smart scarf seam application",
    scarf_application_angle_threshold: "Scarf application angle threshold",
    scarf_around_entire_wall: "Scarf around entire wall",
    scarf_steps: "Scarf steps",
    scarf_joint_for_inner_walls: "Scarf joint for inner walls",
    override_filament_scarf_seam_setting: "Override filament scarf seam setting",
    role_based_wipe_speed: "Role-based wipe speed",
    slice_gap_closing_radius: "Slice gap closing radius",
    resolution: "Resolution",
    arc_fitting: "Arc fitting",
    xy_hole_compensation: "X-Y hole compensation",
    x_y_hole_compensation: "X-Y hole compensation",
    xy_contour_compensation: "X-Y contour compensation",
    x_y_contour_compensation: "X-Y contour compensation",
    auto_circle_contour_hole_compensation: "Auto circle contour-hole compensation",
    elephant_foot_compensation: "Elephant foot compensation",
    precise_z_height: "Precise Z height",
    ironing_type: "Ironing Type",
    ironing_pattern: "Ironing Pattern",
    ironing_speed: "Ironing speed",
    ironing_flow: "Ironing flow",
    ironing_line_spacing: "Ironing line spacing",
    ironing_inset: "Ironing inset",
    prime_tower_flat_ironing: "Prime tower flat ironing",
    wall_generator: "Wall generator",
    perimeter_generator: "Wall generator",
    wall_transitioning_threshold_angle: "Wall transitioning threshold angle",
    wall_transition_threshold_angle: "Wall transitioning threshold angle",
    wall_transitioning_filter_margin: "Wall transitioning filter margin",
    wall_transition_filter_margin: "Wall transitioning filter margin",
    wall_transition_length: "Wall transition length",
    wall_distribution_count: "Wall distribution count",
    minimum_wall_width: "Minimum wall width",
    min_wall_width: "Minimum wall width",
    minimum_feature_size: "Minimum feature size",
    min_feature_size: "Minimum feature size",
    order_of_walls: "Order of walls",
    print_infill_first: "Print infill first",
    bridge_flow: "Bridge flow",
    thick_bridges: "Thick bridges",
    only_one_wall_on_top_surfaces: "Only one wall on top surfaces",
    only_one_wall_on_first_layer: "Only one wall on first layer",
    smooth_speed_discontinuity_area: "Smooth speed discontinuity area",
    smooth_coefficient: "Smooth coefficient",
    avoid_crossing_wall: "Avoid crossing wall",
    smoothing_wall_speed_along_z_experimental: "Smoothing wall speed along Z (experimental)",
    wall_loops: "Wall loops",
    wall_count: "Wall loops",
    wall_line_count: "Wall loops",
    embedding_wall_into_infill: "Embedding the wall into the infill",
    detect_thin_wall: "Detect thin wall",
    top_surface_pattern: "Top surface pattern",
    top_surface_density: "Top surface density",
    top_shell_layers: "Top shell layers",
    top_layers: "Top shell layers",
    top_shell_thickness: "Top shell thickness",
    top_paint_penetration_layers: "Top paint penetration layers",
    bottom_surface_pattern: "Bottom surface pattern",
    bottom_surface_density: "Bottom surface density",
    bottom_shell_layers: "Bottom shell layers",
    bottom_layers: "Bottom shell layers",
    bottom_shell_thickness: "Bottom shell thickness",
    bottom_paint_penetration_layers: "Bottom paint penetration layers",
    internal_solid_infill_pattern: "Internal solid infill pattern",
    sparse_infill_density: "Sparse infill density",
    fill_multiline: "Fill multiline",
    sparse_infill_pattern: "Sparse infill pattern",
    length_of_sparse_infill_anchor: "Length of sparse infill anchor",
    maximum_length_of_sparse_infill_anchor: "Maximum length of sparse infill anchor",
    infill_wall_overlap: "Infill/Wall overlap",
    infill_direction: "Infill direction",
    bridge_direction: "Bridge direction",
    minimum_sparse_infill_threshold: "Minimum sparse infill threshold",
    infill_combination: "Infill combination",
    detect_narrow_internal_solid_infill: "Detect narrow internal solid infill",
    ensure_vertical_shell_thickness: "Ensure vertical shell thickness",
    detect_floating_vertical_shells: "Detect floating vertical shells",
    initial_layer_speed: "Initial layer",
    initial_layer_print_speed: "Initial layer",
    first_layer_speed: "Initial layer",
    initial_layer_infill_speed: "Initial layer infill",
    first_layer_infill_speed: "Initial layer infill",
    initial_layer_infill_print_speed: "Initial layer infill",
    outer_wall_speed: "Outer wall",
    external_perimeter_speed: "Outer wall",
    inner_wall_speed: "Inner wall",
    perimeter_speed: "Inner wall",
    small_perimeter_speed: "Small perimeters",
    small_perimeter_threshold: "Small perimeter threshold",
    sparse_infill_speed: "Sparse infill",
    internal_solid_infill_speed: "Internal solid infill",
    top_surface_speed: "Top surface",
    slow_down_for_overhangs: "Slow down for overhangs",
    overhang_speed_10: "Overhang speed 10%",
    overhang_speed_25: "Overhang speed 25%",
    overhang_speed_50: "Overhang speed 50%",
    overhang_speed_75: "Overhang speed 75%",
    overhang_speed_100: "Overhang speed 100%",
    slow_down_by_height: "Slow down by height",
    bridge_speed: "Bridge",
    bridge_print_speed: "Bridge",
    gap_infill_speed: "Gap infill",
    gap_fill_speed: "Gap infill",
    support_speed: "Support",
    support_material_speed: "Support",
    support_interface_speed: "Support interface",
    support_material_interface_speed: "Support interface",
    support_interface_print_speed: "Support interface",
    travel_speed: "Travel",
    travel_print_speed: "Travel",
    normal_printing_acceleration: "Normal printing",
    default_acceleration: "Normal printing",
    print_acceleration: "Normal printing",
    travel_acceleration: "Travel",
    initial_layer_travel_acceleration: "Initial layer travel",
    first_layer_travel_acceleration: "Initial layer travel",
    initial_layer_acceleration: "Initial layer",
    first_layer_acceleration: "Initial layer",
    outer_wall_acceleration: "Outer wall",
    inner_wall_acceleration: "Inner wall",
    top_surface_acceleration: "Top surface",
    top_surface_accel: "Top surface",
    sparse_infill_acceleration: "Sparse infill",
    infill_acceleration: "Sparse infill",
    internal_infill_acceleration: "Sparse infill",
    enable_support: "Enable support",
    support_type: "Type",
    support_style: "Style",
    support_threshold_angle: "Threshold angle",
    support_on_build_plate_only: "On build plate only",
    support_buildplate_only: "On build plate only",
    support_on_buildplate_only: "On build plate only",
    support_critical_regions_only: "Support critical regions only",
    support_critical_regions: "Support critical regions only",
    remove_small_overhangs: "Remove small overhangs",
    support_remove_small_overhangs: "Remove small overhangs",
    raft_layers: "Raft layers",
    support_filament_raft_base: "Support/raft base",
    support_filament_raft_interface: "Support/raft interface",
    support_raft_base_filament: "Support/raft base",
    support_raft_interface_filament: "Support/raft interface",
    initial_layer_density: "Initial layer density",
    initial_layer_expansion: "Initial layer expansion",
    support_wall_loops: "Support wall loops",
    top_z_distance: "Top Z distance",
    bottom_z_distance: "Bottom Z distance",
    base_pattern: "Base pattern",
    support_base_pattern: "Base pattern",
    base_pattern_spacing: "Base pattern spacing",
    support_base_pattern_spacing: "Base pattern spacing",
    pattern_angle: "Pattern angle",
    top_interface_layers: "Top interface layers",
    support_interface_top_layers: "Top interface layers",
    bottom_interface_layers: "Bottom interface layers",
    support_interface_bottom_layers: "Bottom interface layers",
    interface_pattern: "Interface pattern",
    support_interface_pattern: "Interface pattern",
    top_interface_spacing: "Top interface spacing",
    support_interface_top_spacing: "Top interface spacing",
    normal_support_expansion: "Normal Support expansion",
    support_object_xy_distance: "Support/object xy distance",
    support_xy_distance: "Support/object xy distance",
    z_overrides_xy: "Z overrides X/Y",
    support_z_overrides_xy: "Z overrides X/Y",
    support_object_first_layer_gap: "Support/object first layer gap",
    support_first_layer_gap: "Support/object first layer gap",
    dont_support_bridges: "Don't support bridges",
    independent_support_layer_height: "Independent support layer height",
    support_independent_layer_height: "Independent support layer height",
    skirt_loops: "Skirt loops",
    skirt_line_count: "Skirt loops",
    skirt_loop_count: "Skirt loops",
    skirt_height: "Skirt height",
    brim_type: "Brim type",
    brim_width: "Brim width",
    brim_object_gap: "Brim-object gap",
    brim_gap: "Brim-object gap",
    brim_separation: "Brim-object gap",
    brim_object_distance: "Brim-object gap",
    enable_prime_tower: "Enable",
    prime_tower_enable: "Enable",
    prime_tower: "Enable",
    wipe_tower: "Enable",
    prime_tower_skip_points: "Skip points",
    prime_tower_internal_ribs: "Internal ribs",
    prime_tower_width: "Width",
    prime_tower_max_speed: "Max speed",
    prime_tower_brim_width: "Brim width",
    prime_tower_infill_gap: "Infill gap",
    prime_tower_rib_wall: "Rib wall",
    prime_tower_extra_rib_length: "Extra rib length",
    prime_tower_rib_width: "Rib width",
    prime_tower_fillet_wall: "Fillet wall",
    purge_into_objects_infill: "Purge into objects' infill",
    purge_into_infill: "Purge into objects' infill",
    flush_into_infill: "Purge into objects' infill",
    purge_into_objects_support: "Purge into objects' support",
    purge_into_support: "Purge into objects' support",
    flush_into_support: "Purge into objects' support",
    slicing_mode: "Slicing mode",
    print_sequence: "Print sequence",
    print_order: "Print sequence",
    spiral_vase: "Spiral vase",
    spiral_mode: "Spiral vase",
    timelapse_type: "Timelapse",
    timelapse: "Timelapse",
    fuzzy_skin: "Fuzzy skin",
    fuzzy_skin_mode: "Fuzzy skin",
    fuzzy_skin_point_distance: "Fuzzy skin point distance",
    fuzzy_skin_distance: "Fuzzy skin point distance",
    fuzzy_skin_point_dist: "Fuzzy skin point distance",
    fuzzy_skin_thickness: "Fuzzy skin thickness",
    enable_clumping_detection_by_probing: "Enable clumping detection by probing",
    use_beam_interlocking: "Use beam interlocking",
    beam_interlocking: "Use beam interlocking",
    interlocking_depth_of_a_segmented_region: "Interlocking depth of a segmented region",
    interlocking_depth: "Interlocking depth of a segmented region",
    reduce_infill_retraction: "Reduce infill retraction",
    post_processing_scripts: "Post-processing scripts",
    post_process: "Post-processing scripts",
    post_process_script: "Post-processing scripts",
    post_process_scripts: "Post-processing scripts",
    notes: "Notes",
  };

  const SLICE_PROCESS_QUALITY_ROW_ORDER = {
    layer_height: 10,
    initial_layer_height: 20,
    initial_layer_print_height: 20,
    first_layer_height: 20,
    line_width: 10,
    default_line_width: 10,
    initial_layer_line_width: 20,
    outer_wall_line_width: 30,
    inner_wall_line_width: 40,
    top_surface_line_width: 50,
    sparse_infill_line_width: 60,
    internal_solid_infill_line_width: 70,
    support_line_width: 80,
    seam_position: 10,
    seam_placement_away_from_overhangs: 20,
    smart_scarf_seam_application: 30,
    scarf_application_angle_threshold: 40,
    scarf_around_entire_wall: 50,
    scarf_steps: 60,
    scarf_joint_for_inner_walls: 70,
    override_filament_scarf_seam_setting: 80,
    role_based_wipe_speed: 90,
    slice_gap_closing_radius: 10,
    resolution: 20,
    arc_fitting: 30,
    xy_hole_compensation: 40,
    x_y_hole_compensation: 40,
    xy_contour_compensation: 50,
    x_y_contour_compensation: 50,
    auto_circle_contour_hole_compensation: 60,
    elephant_foot_compensation: 70,
    precise_z_height: 80,
    ironing_type: 10,
    ironing_pattern: 20,
    ironing_speed: 30,
    ironing_flow: 40,
    ironing_line_spacing: 50,
    ironing_inset: 60,
    prime_tower_flat_ironing: 70,
    wall_generator: 10,
    perimeter_generator: 10,
    wall_transitioning_threshold_angle: 20,
    wall_transition_threshold_angle: 20,
    wall_transitioning_filter_margin: 30,
    wall_transition_filter_margin: 30,
    wall_transition_length: 40,
    wall_distribution_count: 50,
    minimum_wall_width: 60,
    min_wall_width: 60,
    minimum_feature_size: 70,
    min_feature_size: 70,
    order_of_walls: 10,
    print_infill_first: 20,
    bridge_flow: 30,
    thick_bridges: 40,
    only_one_wall_on_top_surfaces: 50,
    only_one_wall_on_first_layer: 60,
    smooth_speed_discontinuity_area: 70,
    smooth_coefficient: 80,
    avoid_crossing_wall: 90,
    smoothing_wall_speed_along_z_experimental: 100,
  };

  const SLICE_PROCESS_STRENGTH_ROW_ORDER = {
    wall_loops: 10,
    wall_count: 10,
    wall_line_count: 10,
    embedding_wall_into_infill: 20,
    detect_thin_wall: 30,

    top_surface_pattern: 10,
    top_surface_density: 20,
    top_shell_layers: 30,
    top_layers: 30,
    top_shell_thickness: 40,
    top_paint_penetration_layers: 50,
    bottom_surface_pattern: 60,
    bottom_surface_density: 70,
    bottom_shell_layers: 80,
    bottom_layers: 80,
    bottom_shell_thickness: 90,
    bottom_paint_penetration_layers: 100,
    internal_solid_infill_pattern: 110,

    sparse_infill_density: 10,
    fill_multiline: 20,
    sparse_infill_pattern: 30,
    length_of_sparse_infill_anchor: 40,
    maximum_length_of_sparse_infill_anchor: 50,

    infill_wall_overlap: 10,
    infill_direction: 20,
    bridge_direction: 30,
    minimum_sparse_infill_threshold: 40,
    infill_combination: 50,
    detect_narrow_internal_solid_infill: 60,
    ensure_vertical_shell_thickness: 70,
    detect_floating_vertical_shells: 80,
  };

  const SLICE_PROCESS_SPEED_ROW_ORDER = {
    initial_layer_speed: 10,
    initial_layer_print_speed: 10,
    first_layer_speed: 10,
    initial_layer_infill_speed: 20,
    first_layer_infill_speed: 20,
    initial_layer_infill_print_speed: 20,

    outer_wall_speed: 10,
    external_perimeter_speed: 10,
    inner_wall_speed: 20,
    perimeter_speed: 20,
    small_perimeter_speed: 30,
    small_perimeter_threshold: 40,
    sparse_infill_speed: 50,
    internal_solid_infill_speed: 60,
    vertical_shell_speed: 70,
    top_surface_speed: 80,
    slow_down_for_overhangs: 90,
    overhang_speed_10: 100,
    overhang_speed_25: 110,
    overhang_speed_50: 120,
    overhang_speed_75: 130,
    overhang_speed_100: 140,
    slow_down_by_height: 150,
    bridge_speed: 160,
    bridge_print_speed: 160,
    gap_infill_speed: 170,
    gap_fill_speed: 170,
    support_speed: 180,
    support_material_speed: 180,
    support_interface_speed: 190,
    support_material_interface_speed: 190,
    support_interface_print_speed: 190,

    travel_speed: 10,
    travel_print_speed: 10,

    normal_printing_acceleration: 10,
    default_acceleration: 10,
    print_acceleration: 10,
    travel_acceleration: 20,
    initial_layer_travel_acceleration: 30,
    first_layer_travel_acceleration: 30,
    initial_layer_acceleration: 40,
    first_layer_acceleration: 40,
    outer_wall_acceleration: 50,
    inner_wall_acceleration: 60,
    top_surface_acceleration: 70,
    top_surface_accel: 70,
    sparse_infill_acceleration: 80,
    infill_acceleration: 80,
    internal_infill_acceleration: 80,
  };

  const SLICE_PROCESS_SUPPORT_ROW_ORDER = {
    enable_support: 10,
    support_type: 20,
    support_style: 30,
    support_threshold_angle: 40,
    support_on_build_plate_only: 50,
    support_buildplate_only: 50,
    support_on_buildplate_only: 50,
    support_critical_regions_only: 60,
    support_critical_regions: 60,
    remove_small_overhangs: 70,
    support_remove_small_overhangs: 70,

    raft_layers: 10,

    support_filament_raft_base: 10,
    support_raft_base_filament: 10,
    support_filament_raft_interface: 20,
    support_raft_interface_filament: 20,

    initial_layer_density: 10,
    initial_layer_expansion: 20,
    support_wall_loops: 30,
    top_z_distance: 40,
    bottom_z_distance: 50,
    base_pattern: 60,
    support_base_pattern: 60,
    base_pattern_spacing: 70,
    support_base_pattern_spacing: 70,
    pattern_angle: 80,
    top_interface_layers: 90,
    support_interface_top_layers: 90,
    bottom_interface_layers: 100,
    support_interface_bottom_layers: 100,
    interface_pattern: 110,
    support_interface_pattern: 110,
    top_interface_spacing: 120,
    support_interface_top_spacing: 120,
    normal_support_expansion: 130,
    support_object_xy_distance: 140,
    support_xy_distance: 140,
    z_overrides_xy: 150,
    support_z_overrides_xy: 150,
    support_object_first_layer_gap: 160,
    support_first_layer_gap: 160,
    dont_support_bridges: 170,
    independent_support_layer_height: 180,
    support_independent_layer_height: 180,
  };

  const SLICE_PROCESS_OTHERS_ROW_ORDER = {
    skirt_loops: 10,
    skirt_line_count: 10,
    skirt_loop_count: 10,
    skirt_height: 20,
    brim_type: 30,
    brim_width: 40,
    brim_object_gap: 50,
    brim_gap: 50,
    brim_separation: 50,
    brim_object_distance: 50,

    enable_prime_tower: 10,
    prime_tower_enable: 10,
    prime_tower: 10,
    wipe_tower: 10,
    prime_tower_skip_points: 20,
    prime_tower_internal_ribs: 30,
    prime_tower_width: 40,
    prime_tower_max_speed: 50,
    prime_tower_brim_width: 60,
    prime_tower_infill_gap: 70,
    prime_tower_rib_wall: 80,
    prime_tower_extra_rib_length: 90,
    prime_tower_rib_width: 100,
    prime_tower_fillet_wall: 110,

    purge_into_objects_infill: 10,
    purge_into_infill: 10,
    flush_into_infill: 10,
    purge_into_objects_support: 20,
    purge_into_support: 20,
    flush_into_support: 20,

    slicing_mode: 10,
    print_sequence: 20,
    print_order: 20,
    spiral_vase: 30,
    spiral_mode: 30,
    timelapse_type: 40,
    timelapse: 40,
    fuzzy_skin: 50,
    fuzzy_skin_mode: 50,
    fuzzy_skin_point_distance: 60,
    fuzzy_skin_distance: 60,
    fuzzy_skin_point_dist: 60,
    fuzzy_skin_thickness: 70,

    enable_clumping_detection_by_probing: 10,
    use_beam_interlocking: 20,
    beam_interlocking: 20,
    interlocking_depth_of_a_segmented_region: 30,
    interlocking_depth: 30,

    reduce_infill_retraction: 10,

    post_processing_scripts: 10,
    post_process: 10,
    post_process_script: 10,
    post_process_scripts: 10,

    notes: 10,
  };

  function setSliceProcessSettingsActiveTab(tab, rerender = true) {
    const wanted = String(tab || "").trim().toLowerCase();
    state.sliceProcessSettingsActiveTab = SLICE_PROCESS_TAB_ORDER.includes(wanted) ? wanted : "quality";
    syncSliceProcessSettingsTabUi();
    if (rerender) renderSliceProcessSettingsList();
    return state.sliceProcessSettingsActiveTab;
  }

  function syncSliceProcessSettingsTabUi() {
    if (!els.sliceProcessTabBar) return;
    const active = String(state.sliceProcessSettingsActiveTab || "quality");
    const buttons = Array.from(els.sliceProcessTabBar.querySelectorAll("[data-slice-process-tab]"));
    buttons.forEach((button) => {
      const tab = String(button.getAttribute("data-slice-process-tab") || "").toLowerCase();
      const selected = tab === active;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.setAttribute("tabindex", selected ? "0" : "-1");
    });
    if (els.sliceProcessSupportQuickPanel) {
      const showSupportQuickPanel = active === "support";
      els.sliceProcessSupportQuickPanel.classList.toggle("hidden", !showSupportQuickPanel);
      els.sliceProcessSupportQuickPanel.setAttribute("aria-hidden", showSupportQuickPanel ? "false" : "true");
    }
  }

  function normalizeSliceProcessKey(key) {
    return String(key || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function canonicalSliceProcessKey(key) {
    const normalized = normalizeSliceProcessKey(key);
    return Object.prototype.hasOwnProperty.call(SLICE_PROCESS_KEY_ALIASES, normalized)
      ? SLICE_PROCESS_KEY_ALIASES[normalized]
      : normalized;
  }

  function sliceProcessSettingOptionLabel(key, optionValue) {
    const canonical = canonicalSliceProcessKey(key);
    const normalizedValue = normalizeSliceProcessKey(optionValue);

    if (canonical === "support_type") {
      if (normalizedValue === "tree_auto" || normalizedValue === "tree") return "Tree (auto)";
      if (normalizedValue === "normal_auto" || normalizedValue === "normal") return "Normal (auto)";
    }

    if (canonical === "support_style") {
      if (normalizedValue === "default") return "Default";
      if (normalizedValue === "grid") return "Grid";
      if (normalizedValue === "snug") return "Snug";
      if (normalizedValue === "tree_slim") return "Tree Slim";
      if (normalizedValue === "tree_strong") return "Tree Strong";
      if (normalizedValue === "tree_hybrid") return "Tree Hybrid";
      if (normalizedValue === "tree_organic") return "Tree Organic";
    }

    if (canonical === "support_filament_raft_base" || canonical === "support_filament_raft_interface") {
      if (normalizedValue === "default") return "Default";
    }

    if (canonical === "base_pattern" || canonical === "interface_pattern") {
      if (normalizedValue === "default") return "Default";
      if (normalizedValue === "rectilinear") return "Rectilinear";
      if (normalizedValue === "grid") return "Grid";
      if (normalizedValue === "concentric") return "Concentric";
      if (normalizedValue === "honeycomb") return "Honeycomb";
    }

    if (canonical === "brim_type") {
      if (normalizedValue === "auto") return "Auto";
      if (normalizedValue === "outer_only") return "Outer only";
      if (normalizedValue === "inner_only") return "Inner only";
      if (normalizedValue === "outer_and_inner" || normalizedValue === "all") return "Outer and inner";
      if (normalizedValue === "none" || normalizedValue === "no_brim" || normalizedValue === "off") return "None";
    }

    if (canonical === "prime_tower_brim_width") {
      if (normalizedValue === "auto") return "Auto";
    }

    if (canonical === "slicing_mode") {
      if (normalizedValue === "regular") return "Regular";
    }

    if (canonical === "print_sequence") {
      if (normalizedValue === "by_layer") return "By layer";
      if (normalizedValue === "by_object") return "By object";
    }

    if (canonical === "timelapse_type") {
      if (normalizedValue === "traditional") return "Traditional";
      if (normalizedValue === "smooth") return "Smooth";
    }

    if (canonical === "fuzzy_skin") {
      if (normalizedValue === "none" || normalizedValue.startsWith("none")) return "None";
      if (normalizedValue === "contour") return "Contour";
      if (normalizedValue === "all") return "All";
    }

    if (canonical === "wall_generator") {
      if (normalizedValue === "classic" || normalizedValue === "auto") return "Classic";
      if (normalizedValue === "arachne") return "Arachne";
    }

    if (canonical === "ironing_type") {
      if (normalizedValue === "none" || normalizedValue === "no_ironing") return "No ironing";
      if (normalizedValue === "top" || normalizedValue === "top_surfaces") return "Top surfaces";
      if (normalizedValue === "topmost" || normalizedValue === "topmost_surface" || normalizedValue === "topmost_surfaces") {
        return "Topmost surface";
      }
      if (normalizedValue === "all_top_surfaces" || normalizedValue === "all_solid_layer" || normalizedValue === "all_solid_layers") {
        return "All solid layer";
      }
    }

    if (canonical === "ironing_pattern") {
      if (normalizedValue === "rectilinear") return "Rectilinear";
      if (normalizedValue === "concentric") return "Concentric";
      if (normalizedValue === "zig_zag" || normalizedValue === "zigzag") return "Zig zag";
    }

    if (canonical === "ensure_vertical_shell_thickness") {
      if (normalizedValue === "enabled") return "Enabled";
      if (normalizedValue === "critical_only" || normalizedValue === "critical") return "Critical only";
      if (normalizedValue === "disabled") return "Disabled";
    }

    if (processKeyMatches(canonical, [/pattern$/])) {
      if (normalizedValue === "monotonic_line") return "Monotonic line";
      if (normalizedValue === "aligned_rectilinear") return "Aligned rectilinear";
    }

    return sliceProcessValueToText(optionValue);
  }

  function sliceProcessCurrentValueByCanonicalKey(canonicalKey, base, overrides) {
    const wanted = normalizeSliceProcessKey(canonicalKey);
    if (!wanted) return undefined;

    const baseMap = base && typeof base === "object" ? base : {};
    const overridesMap = overrides && typeof overrides === "object" ? overrides : {};
    const allKeys = Array.from(new Set([...Object.keys(baseMap), ...Object.keys(overridesMap)]));
    for (const key of allKeys) {
      if (canonicalSliceProcessKey(key) !== wanted) continue;
      if (Object.prototype.hasOwnProperty.call(overridesMap, key)) {
        return overridesMap[key];
      }
      return baseMap[key];
    }
    return undefined;
  }

  function isSliceProcessIroningDisabled(base, overrides) {
    const ironingType = sliceProcessCurrentValueByCanonicalKey("ironing_type", base, overrides);
    if (typeof ironingType === "boolean") return !ironingType;
    if (typeof ironingType === "number") return ironingType <= 0;
    if (typeof ironingType === "string") {
      const key = normalizeSliceProcessKey(ironingType);
      if (!key || key === "none" || key === "off" || key === "false" || key === "0" || key === "no_ironing") {
        return true;
      }
      return false;
    }

    const enableIroning = sliceProcessCurrentValueByCanonicalKey("enable_ironing", base, overrides);
    if (typeof enableIroning === "boolean") return !enableIroning;
    if (typeof enableIroning === "number") return enableIroning <= 0;
    if (typeof enableIroning === "string") {
      const key = normalizeSliceProcessKey(enableIroning);
      if (key === "0" || key === "false" || key === "off" || key === "no") return true;
      if (key === "1" || key === "true" || key === "on" || key === "yes") return false;
    }

    return false;
  }

  function isSliceProcessWallGeneratorArachne(base, overrides) {
    const generator = sliceProcessCurrentValueByCanonicalKey("wall_generator", base, overrides);
    if (typeof generator === "string") {
      const key = normalizeSliceProcessKey(generator);
      return key === "arachne";
    }
    return false;
  }

  function isSliceProcessSupportEnabled(base, overrides) {
    const enableSupport = sliceProcessCurrentValueByCanonicalKey("enable_support", base, overrides);
    if (typeof enableSupport === "boolean") return enableSupport;
    if (typeof enableSupport === "number") return enableSupport > 0;
    if (typeof enableSupport === "string") {
      const normalized = normalizeSliceProcessKey(enableSupport);
      if (normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes" || normalized === "enabled") {
        return true;
      }
      if (normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no" || normalized === "disabled") {
        return false;
      }
    }
    return false;
  }

  function shouldRenderSliceProcessSettingEntry(entry, base, overrides) {
    if (!entry || !entry.category) return true;
    const sectionName = String(entry.category.section || "");
    const canonical = canonicalSliceProcessKey(entry.key);

    if (sectionName === "Ironing") {
      if (canonical === "ironing_type" || canonical === "enable_ironing") return true;
      return !isSliceProcessIroningDisabled(base, overrides);
    }

    if (sectionName === "Wall generator") {
      if (canonical === "wall_generator") return true;
      return isSliceProcessWallGeneratorArachne(base, overrides);
    }

    return true;
  }

  function processKeyMatches(key, patterns) {
    return patterns.some((pattern) => pattern.test(key));
  }

  function sliceProcessSettingLabel(key) {
    const normalized = normalizeSliceProcessKey(key);
    if (Object.prototype.hasOwnProperty.call(SLICE_PROCESS_LABEL_OVERRIDES, normalized)) {
      return SLICE_PROCESS_LABEL_OVERRIDES[normalized];
    }
    const words = normalized.replace(/_/g, " ").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return String(key || "");
    return words.map((word, idx) => {
      if (word === "xy") return "X-Y";
      if (word === "z") return "Z";
      if (idx === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      return word;
    }).join(" ");
  }

  function sliceProcessSettingUnit(key) {
    const normalized = normalizeSliceProcessKey(key);
    if (normalized === "skirt_loops") return "loops";
    if (normalized === "skirt_height") return "layers";
    if (normalized === "prime_tower_infill_gap") return "%";
    if (processKeyMatches(normalized, [/minimum_sparse_infill_threshold/, /minimum_sparse_infill_area/])) return "mm2";
    if (processKeyMatches(normalized, [/length_of_sparse_infill_anchor/, /maximum_length_of_sparse_infill_anchor/, /sparse_infill_anchor_length/])) {
      return "mm or %";
    }
    if (normalized === "support_wall_loops") return "loops";
    if (processKeyMatches(normalized, [/^raft_layers$/, /^top_interface_layers$/, /^bottom_interface_layers$/, /^support_interface_top_layers$/, /^support_interface_bottom_layers$/])) {
      return "layers";
    }
    if (processKeyMatches(normalized, [/small_perimeter_speed/, /vertical_shell_speed/])) return "mm/s or %";
    if (processKeyMatches(normalized, [/sparse_infill_acceleration/, /infill_acceleration/, /internal_infill_acceleration/])) return "mm/s2 or %";
    if (processKeyMatches(normalized, [/accel/, /acceleration/])) return "mm/s2";
    if (processKeyMatches(normalized, [/(^|_)angle($|_)/])) return "deg";
    if (processKeyMatches(normalized, [/infill_direction/, /bridge_direction/])) return "deg";
    if (processKeyMatches(normalized, [/(^|_)(filter_margin|transition_length|minimum_wall_width|min_wall_width|minimum_feature_size|min_feature_size)($|_)/])) {
      return "%";
    }
    if (processKeyMatches(normalized, [/(^|_)(density|overlap)($|_)/])) return "%";
    if (processKeyMatches(normalized, [/(^|_)flow($|_)/])) return "%";
    if (processKeyMatches(normalized, [/(^|_)speed($|_)/])) return "mm/s";
    if (processKeyMatches(normalized, [/(^|_)(height|width|spacing|inset|radius|resolution|distance|offset|compensation|thickness|length|gap|depth)($|_)/])) {
      return "mm";
    }
    return "";
  }

  function sliceProcessSettingCategory(key) {
    const normalized = canonicalSliceProcessKey(key);

    if (processKeyMatches(normalized, [/layer_height/, /^initial_layer_(print_)?height$/, /^first_layer_height$/])) {
      return { tab: "quality", section: "Layer height", sectionOrder: 10 };
    }
    if (processKeyMatches(normalized, [/line_width/, /extrusion_width/])) {
      return { tab: "quality", section: "Line width", sectionOrder: 20 };
    }
    if (processKeyMatches(normalized, [/seam/, /scarf/, /role_based_wipe/])) {
      return { tab: "quality", section: "Seam", sectionOrder: 30 };
    }
    if (processKeyMatches(normalized, [/slice_gap_closing_radius/, /resolution/, /arc_fitting/, /_hole_compensation$/, /_contour_compensation$/, /elephant_foot_compensation/, /precise_z_height/, /precision/, /compensation/])) {
      return { tab: "quality", section: "Precision", sectionOrder: 40 };
    }
    if (processKeyMatches(normalized, [/ironing/, /^enable_ironing$/])) {
      return { tab: "quality", section: "Ironing", sectionOrder: 50 };
    }
    if (processKeyMatches(normalized, [/wall_generator/, /perimeter_generator/, /wall_transition/, /wall_distribution/, /minimum_wall_width/, /min_wall_width/, /minimum_feature_size/, /min_feature_size/])) {
      return { tab: "quality", section: "Wall generator", sectionOrder: 60 };
    }
    if (processKeyMatches(normalized, [/order_of_walls/, /print_infill_first/, /bridge_flow/, /thick_bridges/, /only_one_wall_/, /^smooth_/, /smooth_coefficient/, /avoid_crossing_wall/, /smoothing_wall_speed_along_z/])) {
      return { tab: "quality", section: "Advanced", sectionOrder: 70 };
    }

    if (processKeyMatches(normalized, [/^initial_layer_speed$/, /^initial_layer_print_speed$/, /^first_layer_speed$/, /^initial_layer_infill_speed$/, /^first_layer_infill_speed$/, /^initial_layer_infill_print_speed$/])) {
      return { tab: "speed", section: "Initial layer speed", sectionOrder: 10 };
    }

    if (processKeyMatches(normalized, [/^outer_wall_speed$/, /^external_perimeter_speed$/, /^inner_wall_speed$/, /^perimeter_speed$/, /small_perimeter_speed/, /small_perimeter_threshold/, /^sparse_infill_speed$/, /^internal_solid_infill_speed$/, /^vertical_shell_speed$/, /^top_surface_speed$/, /^slow_down_for_overhangs$/, /^overhang_speed_/, /^slow_down_by_height$/, /^bridge_speed$/, /^bridge_print_speed$/, /^gap_infill_speed$/, /^gap_fill_speed$/, /^support_speed$/, /^support_material_speed$/, /^support_interface_speed$/, /^support_material_interface_speed$/, /^support_interface_print_speed$/])) {
      return { tab: "speed", section: "Other layers speed", sectionOrder: 20 };
    }

    if (processKeyMatches(normalized, [/^travel_speed$/, /^travel_print_speed$/])) {
      return { tab: "speed", section: "Travel speed", sectionOrder: 30 };
    }

    if (processKeyMatches(normalized, [/accel/, /acceleration/])) {
      return { tab: "speed", section: "Acceleration", sectionOrder: 40 };
    }

    if (processKeyMatches(normalized, [/^skirt_loops$/, /^skirt_line_count$/, /^skirt_loop_count$/, /^skirt_height$/, /^brim_type$/, /^brim_width$/, /^brim_object_gap$/, /^brim_gap$/, /^brim_separation$/, /^brim_object_distance$/])) {
      return { tab: "others", section: "Bed adhesion", sectionOrder: 10 };
    }

    if (processKeyMatches(normalized, [/^enable_prime_tower$/, /^prime_tower_enable$/, /^prime_tower$/, /^wipe_tower$/, /^prime_tower_skip_points$/, /^prime_tower_internal_ribs$/, /^prime_tower_width$/, /^prime_tower_max_speed$/, /^prime_tower_brim_width$/, /^prime_tower_infill_gap$/, /^prime_tower_rib_wall$/, /^prime_tower_extra_rib_length$/, /^prime_tower_rib_width$/, /^prime_tower_fillet_wall$/])) {
      return { tab: "others", section: "Prime tower", sectionOrder: 20 };
    }

    if (processKeyMatches(normalized, [/^purge_into_objects_infill$/, /^purge_into_infill$/, /^flush_into_infill$/, /^purge_into_objects_support$/, /^purge_into_support$/, /^flush_into_support$/])) {
      return { tab: "others", section: "Purge options", sectionOrder: 30 };
    }

    if (processKeyMatches(normalized, [/^slicing_mode$/, /^print_sequence$/, /^print_order$/, /^spiral_vase$/, /^spiral_mode$/, /^timelapse_type$/, /^timelapse$/, /^fuzzy_skin$/, /^fuzzy_skin_mode$/, /^fuzzy_skin_point_distance$/, /^fuzzy_skin_distance$/, /^fuzzy_skin_point_dist$/, /^fuzzy_skin_thickness$/])) {
      return { tab: "others", section: "Special mode", sectionOrder: 40 };
    }

    if (processKeyMatches(normalized, [/^enable_clumping_detection_by_probing$/, /^use_beam_interlocking$/, /^beam_interlocking$/, /^interlocking_depth_of_a_segmented_region$/, /^interlocking_depth$/])) {
      return { tab: "others", section: "Advanced", sectionOrder: 50 };
    }

    if (processKeyMatches(normalized, [/^reduce_infill_retraction$/])) {
      return { tab: "others", section: "G-code output", sectionOrder: 60 };
    }

    if (processKeyMatches(normalized, [/^post_processing_scripts$/, /^post_process$/, /^post_process_script$/, /^post_process_scripts$/])) {
      return { tab: "others", section: "Post-processing scripts", sectionOrder: 70 };
    }

    if (processKeyMatches(normalized, [/^notes$/])) {
      return { tab: "others", section: "Notes", sectionOrder: 80 };
    }

    if (processKeyMatches(normalized, [/^enable_support$/, /^support_type$/, /^support_style$/, /^support_threshold_angle$/, /^support_on_build_plate_only$/, /^support_critical_regions_only$/, /^remove_small_overhangs$/])) {
      return { tab: "support", section: "Support", sectionOrder: 10 };
    }

    if (processKeyMatches(normalized, [/^raft_layers$/])) {
      return { tab: "support", section: "Raft", sectionOrder: 20 };
    }

    if (processKeyMatches(normalized, [/^support_filament_raft_base$/, /^support_filament_raft_interface$/, /^support_filament_1$/, /^support_filament_2$/, /^support_raft_base_filament$/, /^support_raft_interface_filament$/])) {
      return { tab: "support", section: "Filament for Supports", sectionOrder: 30 };
    }

    if (processKeyMatches(normalized, [/^initial_layer_density$/, /^initial_layer_expansion$/, /^support_wall_loops$/, /^top_z_distance$/, /^bottom_z_distance$/, /^base_pattern$/, /^support_base_pattern$/, /^base_pattern_spacing$/, /^support_base_pattern_spacing$/, /^pattern_angle$/, /^top_interface_layers$/, /^support_interface_top_layers$/, /^bottom_interface_layers$/, /^support_interface_bottom_layers$/, /^interface_pattern$/, /^support_interface_pattern$/, /^top_interface_spacing$/, /^support_interface_top_spacing$/, /^normal_support_expansion$/, /^support_object_xy_distance$/, /^support_xy_distance$/, /^z_overrides_xy$/, /^support_z_overrides_xy$/, /^support_object_first_layer_gap$/, /^support_first_layer_gap$/, /^dont_support_bridges$/, /^independent_support_layer_height$/, /^support_independent_layer_height$/])) {
      return { tab: "support", section: "Advanced", sectionOrder: 40 };
    }

    if (processKeyMatches(normalized, [/support/, /raft/, /brim/, /skirt/])) {
      return { tab: "support", section: "Support", sectionOrder: 50 };
    }

    if (processKeyMatches(normalized, [/^wall_loops$/, /^wall_count$/, /^wall_line_count$/, /embedding_wall_into_infill/, /detect_thin_wall/])) {
      return { tab: "strength", section: "Walls", sectionOrder: 10 };
    }

    if (processKeyMatches(normalized, [/top_surface_pattern/, /top_surface_density/, /top_shell_layers/, /top_shell_thickness/, /top_paint_penetration_layers/, /bottom_surface_pattern/, /bottom_surface_density/, /bottom_shell_layers/, /bottom_shell_thickness/, /bottom_paint_penetration_layers/, /internal_solid_infill_pattern/, /solid_infill_pattern/])) {
      return { tab: "strength", section: "Top/bottom shells", sectionOrder: 20 };
    }

    if (processKeyMatches(normalized, [/sparse_infill_density/, /fill_multiline/, /sparse_infill_pattern/, /length_of_sparse_infill_anchor/, /maximum_length_of_sparse_infill_anchor/, /sparse_infill_anchor_length/])) {
      return { tab: "strength", section: "Sparse infill", sectionOrder: 30 };
    }

    if (processKeyMatches(normalized, [/infill_wall_overlap/, /infill_overlap/, /infill_direction/, /bridge_direction/, /minimum_sparse_infill_threshold/, /minimum_sparse_infill_area/, /infill_combination/, /detect_narrow_internal_solid_infill/, /ensure_vertical_shell_thickness/, /detect_floating_vertical_shells/])) {
      return { tab: "strength", section: "Advanced", sectionOrder: 40 };
    }

    if (processKeyMatches(normalized, [/infill/, /wall_count/, /wall_loops/, /perimeter/, /shell/, /top_layers/, /bottom_layers/, /strength/])) {
      return { tab: "strength", section: "Strength", sectionOrder: 10 };
    }

    if (processKeyMatches(normalized, [/(^|_)speed($|_)/, /accel/, /acceleration/, /travel/, /jerk/, /velocity/, /volumetric/])) {
      return { tab: "speed", section: "Speed", sectionOrder: 10 };
    }

    return { tab: "others", section: "Other settings", sectionOrder: 90 };
  }

  function sliceProcessSettingRowOrder(key, section) {
    const normalized = canonicalSliceProcessKey(key);
    if (section === "Layer height" || section === "Line width" || section === "Seam" || section === "Precision" || section === "Ironing" || section === "Wall generator" || section === "Advanced") {
      if (Object.prototype.hasOwnProperty.call(SLICE_PROCESS_QUALITY_ROW_ORDER, normalized)) {
        return SLICE_PROCESS_QUALITY_ROW_ORDER[normalized];
      }
    }
    if (section === "Walls" || section === "Top/bottom shells" || section === "Sparse infill" || section === "Advanced" || section === "Strength") {
      if (Object.prototype.hasOwnProperty.call(SLICE_PROCESS_STRENGTH_ROW_ORDER, normalized)) {
        return SLICE_PROCESS_STRENGTH_ROW_ORDER[normalized];
      }
    }
    if (section === "Initial layer speed" || section === "Other layers speed" || section === "Travel speed" || section === "Acceleration" || section === "Speed") {
      if (Object.prototype.hasOwnProperty.call(SLICE_PROCESS_SPEED_ROW_ORDER, normalized)) {
        return SLICE_PROCESS_SPEED_ROW_ORDER[normalized];
      }
    }
    if (section === "Support" || section === "Raft" || section === "Filament for Supports" || section === "Advanced") {
      if (Object.prototype.hasOwnProperty.call(SLICE_PROCESS_SUPPORT_ROW_ORDER, normalized)) {
        return SLICE_PROCESS_SUPPORT_ROW_ORDER[normalized];
      }
    }
    if (section === "Bed adhesion" || section === "Prime tower" || section === "Purge options" || section === "Special mode" || section === "Advanced" || section === "G-code output" || section === "Post-processing scripts" || section === "Notes") {
      if (Object.prototype.hasOwnProperty.call(SLICE_PROCESS_OTHERS_ROW_ORDER, normalized)) {
        return SLICE_PROCESS_OTHERS_ROW_ORDER[normalized];
      }
    }
    return 500;
  }

  function buildSliceProcessSettingRowHtml(key, baseValue, currentValue, hasOverride, valueType, optionsByKey, meta) {
    const keyEsc = esc(key);
    const labelEsc = esc(meta.label);
    const unit = valueType === "number" ? sliceProcessSettingUnit(key) : "";
    const canonical = canonicalSliceProcessKey(key);
    const disabled = !!(meta && meta.disabled);
    const disabledAttr = disabled ? " disabled" : "";

    if (valueType === "bool") {
      return `
        <div class="slice-process-setting-row ${hasOverride ? "changed" : ""}${disabled ? " is-disabled" : ""}">
          <div class="slice-process-setting-key">${labelEsc}</div>
          <label class="slice-process-setting-bool">
            <input type="checkbox" data-slice-setting-key="${keyEsc}" data-slice-setting-type="bool" ${currentValue ? "checked" : ""}${disabledAttr}>
            <span>${currentValue ? "On" : "Off"}</span>
          </label>
        </div>
      `;
    }

    if (valueType === "string" && (canonical === "post_processing_scripts" || canonical === "notes")) {
      const isNotes = canonical === "notes";
      const textareaClass = `input slice-process-setting-textarea${isNotes ? " is-notes" : ""}`;
      const rows = isNotes ? 8 : 4;
      const valueText = String(currentValue == null ? "" : currentValue);
      return `
        <div class="slice-process-setting-row wide-control ${hasOverride ? "changed" : ""}${disabled ? " is-disabled" : ""}">
          <div class="slice-process-setting-key">${labelEsc}</div>
          <div class="slice-process-setting-control">
            <textarea class="${textareaClass}" rows="${rows}" data-slice-setting-key="${keyEsc}" data-slice-setting-type="${valueType}"${disabledAttr}>${esc(valueText)}</textarea>
          </div>
        </div>
      `;
    }

    const mergedOptions = [];
    const mergedSeen = new Set();
    const pushOption = (rawValue) => {
      const normalized = normalizeSliceProcessSettingScalar(rawValue, key);
      if (normalized === null) return;
      const signature = `${typeof normalized}:${String(normalized)}`;
      if (mergedSeen.has(signature)) return;
      mergedSeen.add(signature);
      mergedOptions.push(normalized);
    };
    const normalizedKey = normalizeSliceProcessKey(key);
    const isSupportStyleField = canonical === "support_style"
      || (normalizedKey === "style" && meta && meta.category && meta.category.tab === "support");
    const supportStyleValues = isSupportStyleField
      ? supportStyleValuesForType(currentSliceProcessSupportType())
      : [];
    const rawOptions = [];
    if (Array.isArray(optionsByKey[key])) {
      rawOptions.push(...optionsByKey[key]);
    }
    if (isSupportStyleField) {
      rawOptions.push(...supportStyleValues);
      if (Array.isArray(optionsByKey.support_style)) {
        rawOptions.push(...optionsByKey.support_style);
      }
      if (Array.isArray(SLICE_PROCESS_FALLBACK_SETTING_OPTIONS.support_style)) {
        rawOptions.push(...SLICE_PROCESS_FALLBACK_SETTING_OPTIONS.support_style);
      }
    }
    rawOptions.forEach(pushOption);
    pushOption(baseValue);
    if (hasOverride) pushOption(currentValue);
    const forceSelectInput = isSupportStyleField;

    const unitHtml = unit ? `<span class="slice-process-setting-unit">${esc(unit)}</span>` : "";
    if (forceSelectInput || mergedOptions.length > 1) {
      const optionsHtml = mergedOptions
        .map((optionValue) => {
          const attrValue = sliceProcessValueToAttr(optionValue);
          const labelText = sliceProcessSettingOptionLabel(key, optionValue) || "(tom)";
          const selected = sliceProcessValueEquals(currentValue, optionValue) ? " selected" : "";
          return `<option value="${esc(attrValue)}"${selected}>${esc(labelText)}</option>`;
        })
        .join("");
      return `
        <div class="slice-process-setting-row ${hasOverride ? "changed" : ""}${disabled ? " is-disabled" : ""}">
          <div class="slice-process-setting-key">${labelEsc}</div>
          <div class="slice-process-setting-control ${unit ? "has-unit" : ""}">
            <select class="select" data-slice-setting-key="${keyEsc}" data-slice-setting-type="${valueType}"${disabledAttr}>
              ${optionsHtml}
            </select>
            ${unitHtml}
          </div>
        </div>
      `;
    }

    const inputType = valueType === "number" ? "number" : "text";
    const valueText = valueType === "number" ? String(currentValue) : sliceProcessValueToText(currentValue);
    const stepAttr = valueType === "number" ? " step=\"any\"" : "";
    return `
      <div class="slice-process-setting-row ${hasOverride ? "changed" : ""}${disabled ? " is-disabled" : ""}">
        <div class="slice-process-setting-key">${labelEsc}</div>
        <div class="slice-process-setting-control ${unit ? "has-unit" : ""}">
          <input class="input" type="${inputType}"${stepAttr} data-slice-setting-key="${keyEsc}" data-slice-setting-type="${valueType}" value="${esc(valueText)}"${disabledAttr}>
          ${unitHtml}
        </div>
      </div>
    `;
  }

  function renderSliceProcessSettingsList() {
    if (!els.sliceProcessSettingsList) return;
    const base = state.sliceProcessSettingsBase && typeof state.sliceProcessSettingsBase === "object"
      ? state.sliceProcessSettingsBase
      : {};
    const optionsByKey = state.sliceProcessSettingsOptions && typeof state.sliceProcessSettingsOptions === "object"
      ? state.sliceProcessSettingsOptions
      : {};
    const overrides = state.sliceProcessSettingsOverrides && typeof state.sliceProcessSettingsOverrides === "object"
      ? state.sliceProcessSettingsOverrides
      : {};
    const activeTab = setSliceProcessSettingsActiveTab(state.sliceProcessSettingsActiveTab, false);
    const activeTabLabel = SLICE_PROCESS_TAB_LABELS[activeTab] || "Settings";
    const search = String((els.sliceProcessSettingsSearchInput && els.sliceProcessSettingsSearchInput.value) || "").trim().toLowerCase();
    const rawKeys = Object.keys(base).sort((a, b) => a.localeCompare(b, "da"));
    const apiBaseKeys = state.sliceProcessSettingsBaseApi && typeof state.sliceProcessSettingsBaseApi === "object"
      ? state.sliceProcessSettingsBaseApi
      : {};
    const canonicalToKey = new Map();
    const scoreKey = (key, canonical) => {
      let score = 0;
      if (Object.prototype.hasOwnProperty.call(apiBaseKeys, key)) score += 10;
      if (normalizeSliceProcessKey(key) === canonical) score += 3;
      score -= String(key || "").length * 0.001;
      return score;
    };
    rawKeys.forEach((key) => {
      const canonical = canonicalSliceProcessKey(key);
      const prev = canonicalToKey.get(canonical);
      if (!prev) {
        canonicalToKey.set(canonical, key);
        return;
      }
      const prevScore = scoreKey(prev, canonical);
      const nextScore = scoreKey(key, canonical);
      if (nextScore > prevScore) {
        canonicalToKey.set(canonical, key);
      }
    });
    const keys = Array.from(canonicalToKey.values()).sort((a, b) => a.localeCompare(b, "da"));

    const categorizedAll = keys.map((key) => {
      const category = sliceProcessSettingCategory(key);
      return {
        key,
        category,
        label: sliceProcessSettingLabel(key),
        labelLower: sliceProcessSettingLabel(key).toLowerCase(),
      };
    });
    const allTabCount = categorizedAll.filter((entry) => entry.category.tab === activeTab).length;
    const qualityFallbackToAll = activeTab === "quality" && allTabCount === 0 && categorizedAll.length > 0;
    const filtered = categorizedAll.filter((entry) => {
      if (!qualityFallbackToAll && entry.category.tab !== activeTab) return false;
      if (!shouldRenderSliceProcessSettingEntry(entry, base, overrides)) return false;
      if (!search) return true;
      if (entry.key.toLowerCase().includes(search)) return true;
      if (entry.labelLower.includes(search)) return true;
      if (String(entry.category.section || "").toLowerCase().includes(search)) return true;
      return false;
    });

    if (!filtered.length) {
      els.sliceProcessSettingsList.innerHTML = `<div class="slice-process-setting-empty hint">Ingen settings matcher denne fane/søgning.</div>`;
    } else {
      const supportEnabledForEditing = activeTab !== "support" || isSliceProcessSupportEnabled(base, overrides);
      const sorted = filtered
        .map((entry) => {
          const sectionOrder = Number(entry.category.sectionOrder || 900);
          const rowOrder = sliceProcessSettingRowOrder(entry.key, entry.category.section);
          return { ...entry, sectionOrder, rowOrder };
        })
        .sort((a, b) => {
          if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
          if (a.rowOrder !== b.rowOrder) return a.rowOrder - b.rowOrder;
          return a.label.localeCompare(b.label, "da");
        });

      const sections = new Map();
      sorted.forEach((entry) => {
        const sectionName = String(entry.category.section || "Other settings");
        if (!sections.has(sectionName)) {
          sections.set(sectionName, []);
        }
        sections.get(sectionName).push(entry);
      });

      const sectionHtml = [];
      sections.forEach((entries, sectionName) => {
        const rowsHtml = entries
          .map((entry) => {
            const key = entry.key;
            const baseValue = base[key];
            const hasOverride = Object.prototype.hasOwnProperty.call(overrides, key);
            const currentValue = hasOverride ? overrides[key] : baseValue;
            const valueType = sliceProcessValueInputType(baseValue);
            const canonical = canonicalSliceProcessKey(key);
            const disableSupportRow = activeTab === "support" && !supportEnabledForEditing && canonical !== "enable_support";
            return buildSliceProcessSettingRowHtml(
              key,
              baseValue,
              currentValue,
              hasOverride,
              valueType,
              optionsByKey,
              {
                label: entry.label,
                disabled: disableSupportRow,
              }
            );
          })
          .join("");

        sectionHtml.push(`
          <section class="slice-process-group">
            <h4 class="slice-process-group-title">${esc(sectionName)}</h4>
            ${rowsHtml}
          </section>
        `);
      });

      els.sliceProcessSettingsList.innerHTML = sectionHtml.join("");
    }

    const changedCount = Object.keys(overrides).length;
    if (els.sliceProcessSettingsMeta) {
      const totalCount = keys.length;
      const shownCount = filtered.length;
      const allTabCountForMeta = qualityFallbackToAll ? categorizedAll.length : allTabCount;
      els.sliceProcessSettingsMeta.textContent = `Settings: ${shownCount}/${allTabCountForMeta} i ${activeTabLabel} | Total: ${totalCount} | Ændret: ${changedCount}`;
    }
    syncSliceProcessSettingsTabUi();
  }

  async function loadSliceProcessSettings(force = false, allowAutoProfileFallback = true) {
    const profileKey = sliceProcessSettingsProfileKey();
    if (!force && profileKey && state.sliceProcessSettingsProfileKey === profileKey && Object.keys(state.sliceProcessSettingsBase || {}).length) {
      renderSliceProcessSettingsList();
      return;
    }

    const params = new URLSearchParams();
    const printer = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "").trim();
    const print = String((els.slicePrintProfileSelect && els.slicePrintProfileSelect.value) || "").trim();
    const filament = String((els.sliceFilamentProfileSelect && els.sliceFilamentProfileSelect.value) || "").trim();
    if (printer) params.set("printer_profile", printer);
    if (print) params.set("print_profile", print);
    if (filament) params.set("filament_profile", filament);

    const token = ++state.sliceProcessSettingsLoadToken;
    if (els.sliceProcessSettingsMeta) {
      els.sliceProcessSettingsMeta.textContent = "Indlæser process settings...";
    }

    const data = await api(`/api/slice/process-settings?${params.toString()}`);
    if (token !== state.sliceProcessSettingsLoadToken) return;
    state.sliceProcessSettingsProfileKey = profileKey;

    const mergedProcessSettings = mergeSliceProcessSettingsWithFallback(
      data && data.settings,
      data && data.setting_options
    );
    state.sliceProcessSettingsBaseApi = normalizeSliceProcessSettingsMap(mergedProcessSettings.apiBase);
    state.sliceProcessSettingsBase = mergedProcessSettings.base;
    state.sliceProcessSettingsOptions = mergedProcessSettings.options;
    state.sliceProcessSettingsOverrides = {};

    // If "Auto / fra config" resolves to a tiny setting set, try first explicit profile once.
    const loadedCount = Object.keys(mergedProcessSettings.apiBase || {}).length;
    const currentProcessProfile = String((els.sliceProcessProfileSelect && els.sliceProcessProfileSelect.value) || "").trim();
    const currentPrintProfile = String((els.slicePrintProfileSelect && els.slicePrintProfileSelect.value) || "").trim();
    if (allowAutoProfileFallback && loadedCount <= 2 && !currentProcessProfile && !currentPrintProfile) {
      const firstExplicitProfile = firstNonEmptySliceSelectValue(els.sliceProcessProfileSelect)
        || firstNonEmptySliceSelectValue(els.slicePrintProfileSelect);
      if (firstExplicitProfile) {
        if (els.sliceProcessProfileSelect) {
          els.sliceProcessProfileSelect.value = firstExplicitProfile;
        }
        syncMainPrintProfileSelectFromProcess();
        await loadSliceProcessSettings(true, false);
        return;
      }
    }

    renderSliceProcessSettingsList();
    showStatus(els.sliceProcessSettingsStatus, "");
  }

  function updateSliceProcessSettingOverride(key, value, valueType = "string") {
    const name = String(key || "").trim();
    if (!name) return;
    const base = state.sliceProcessSettingsBase && typeof state.sliceProcessSettingsBase === "object"
      ? state.sliceProcessSettingsBase
      : {};
    if (!Object.prototype.hasOwnProperty.call(base, name)) return;
    const next = parseSliceProcessOverrideByType(base[name], value, valueType);
    if (!state.sliceProcessSettingsOverrides || typeof state.sliceProcessSettingsOverrides !== "object") {
      state.sliceProcessSettingsOverrides = {};
    }
    if (sliceProcessValueEquals(base[name], next)) {
      delete state.sliceProcessSettingsOverrides[name];
    } else {
      state.sliceProcessSettingsOverrides[name] = next;
    }
    renderSliceProcessSettingsList();
  }

  function setSlicePreviewFootprint(text, kind = "") {
    if (!els.slicePreviewFootprint) return;
    els.slicePreviewFootprint.textContent = String(text || "Model footprint: -");
    els.slicePreviewFootprint.classList.remove("ok", "error");
    if (kind === "ok" || kind === "error") {
      els.slicePreviewFootprint.classList.add(kind);
    }
  }

  function disposeSlicePreviewObject(root) {
    if (!root) return;
    if (typeof root.traverse !== "function") return;
    root.traverse((node) => {
      if (!node) return;
      if (node.geometry && typeof node.geometry.dispose === "function") {
        node.geometry.dispose();
      }
      if (!node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if (material && typeof material.dispose === "function") {
          material.dispose();
        }
      });
    });
  }

  function updateSlicePreviewCursor(preview = state.slicePreview) {
    if (!preview || !preview.canvas) return;
    const rotateActive = state.sliceActiveTool === "rotate";
    let cursor = "grab";
    if (preview.isTransformDragging) {
      cursor = "grabbing";
    } else if (rotateActive && preview.gizmoHoverAxis) {
      cursor = "pointer";
    }
    preview.canvas.style.setProperty("cursor", cursor, "important");
  }

  function clearSliceRotateAxisArrows(preview = state.slicePreview) {
    if (!preview || !preview.rotateAxisArrowGroup) return;
    const group = preview.rotateAxisArrowGroup;
    if (group.parent) {
      try {
        group.parent.remove(group);
      } catch (_err) {}
    }
    disposeSlicePreviewObject(group);
    preview.rotateAxisArrowGroup = null;
    preview.rotateAxisArrowUsesGizmoScale = false;
  }

  function alignSlicePreviewGroundToModel(preview = state.slicePreview) {
    if (!preview) return;
    // Single shared world plane for everything in preview:
    // bed/grid/plate top are always locked to world Z=0.
    const targetZ = 0;

    if (preview.plateGroup && preview.THREE) {
      try {
        const plateBox = new preview.THREE.Box3().setFromObject(preview.plateGroup);
        if (plateBox && !plateBox.isEmpty()) {
          const surfaceZ = estimateSlicePlatePrintableSurfaceZ(preview, preview.plateGroup, plateBox);
          if (Number.isFinite(surfaceZ)) {
            const delta = targetZ - surfaceZ;
            if (Math.abs(delta) > 1e-6) {
              preview.plateGroup.position.z += delta;
              preview.plateGroup.updateMatrixWorld(true);
            }
          }
        }
      } catch (_err) {}
    }

    preview.plateTopZ = targetZ;
    if (preview.bedMesh) preview.bedMesh.position.z = targetZ;
    if (preview.bedOutline) preview.bedOutline.position.z = targetZ + 0.2;
    if (preview.axisGrid) preview.axisGrid.position.z = targetZ - 0.2;
  }

  function updateSliceRotateAxisArrowVisibility(preview = state.slicePreview) {
    if (!preview || !preview.rotateAxisArrowGroup) return;
    preview.rotateAxisArrowGroup.visible = state.sliceActiveTool === "rotate";
  }

  function rebuildSliceRotateAxisArrows(preview = state.slicePreview) {
    if (!preview || !preview.THREE || !preview.modelGroup) return;
    const THREE = preview.THREE;
    clearSliceRotateAxisArrows(preview);

    const usesGizmoScale = !!(preview.transformControls && preview.camera);
    let ringRadius = 0.5;
    let coneLength = 0.13;
    let coneRadius = 0.045;
    if (!usesGizmoScale) {
      const bounds = new THREE.Box3().setFromObject(preview.modelGroup);
      const size = bounds && !bounds.isEmpty()
        ? bounds.getSize(new THREE.Vector3())
        : new THREE.Vector3(28, 28, 28);
      const maxExtent = Math.max(22, Number(size.x || 0), Number(size.y || 0), Number(size.z || 0));
      ringRadius = Math.max(16, maxExtent * 0.44);
      coneLength = Math.max(4.2, Math.min(14, ringRadius * 0.13));
      coneRadius = Math.max(1.8, coneLength * 0.34);
    }
    const arcSpan = 0.42;

    const group = new THREE.Group();
    group.name = "sliceRotateAxisArrows";

    const axes = [
      { axis: "x", color: 0xff3c3c },
      { axis: "y", color: 0x34d95b },
      { axis: "z", color: 0x246dff },
    ];

    const ringPoint = (axis, angle, radius) => {
      if (axis === "x") return new THREE.Vector3(0, Math.cos(angle) * radius, Math.sin(angle) * radius);
      if (axis === "y") return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    };
    const ringTangent = (axis, angle) => {
      if (axis === "x") return new THREE.Vector3(0, -Math.sin(angle), Math.cos(angle));
      if (axis === "y") return new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
      return new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
    };
    const ringRadial = (axis, angle) => {
      if (axis === "x") return new THREE.Vector3(0, Math.cos(angle), Math.sin(angle));
      if (axis === "y") return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      return new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    };

    const addCurvedArrow = (axis, color, baseAngle) => {
      const startA = baseAngle - arcSpan;
      const endA = baseAngle - 0.05;
      const steps = 18;
      const points = [];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const a = startA + ((endA - startA) * t);
        points.push(ringPoint(axis, a, ringRadius));
      }
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.86,
      });
      const arc = new THREE.Line(lineGeom, lineMat);
      group.add(arc);

      const tipPos = ringPoint(axis, endA, ringRadius);
      const tipDir = ringTangent(axis, endA).normalize();
      const tipRadial = ringRadial(axis, endA).normalize();
      const arrowHeadOutset = Math.max(coneRadius * 1.18, ringRadius * 0.16);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(coneRadius, coneLength, 16),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.38,
          metalness: 0.2,
          transparent: true,
          opacity: 0.96,
        })
      );
      cone.position.copy(tipPos).addScaledVector(tipRadial, arrowHeadOutset);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir);
      group.add(cone);
    };

    axes.forEach(({ axis, color }) => {
      addCurvedArrow(axis, color, Math.PI * 0.3);
      addCurvedArrow(axis, color, Math.PI * 1.3);
    });

    group.visible = state.sliceActiveTool === "rotate";
    preview.modelGroup.add(group);
    preview.rotateAxisArrowGroup = group;
    preview.rotateAxisArrowUsesGizmoScale = usesGizmoScale;
    syncSliceRotateAxisArrowsToGizmoScale(preview);
  }

  function syncSliceRotateAxisArrowsToGizmoScale(preview = state.slicePreview) {
    if (!preview || !preview.rotateAxisArrowGroup) return;
    const group = preview.rotateAxisArrowGroup;
    if (!preview.rotateAxisArrowUsesGizmoScale) {
      group.scale.set(1, 1, 1);
      return;
    }
    if (!preview.camera || !preview.transformControls || !preview.modelGroup || !preview.THREE) return;

    if (!preview.rotateAxisArrowWorldPos) preview.rotateAxisArrowWorldPos = new preview.THREE.Vector3();
    if (!preview.rotateAxisArrowCamPos) preview.rotateAxisArrowCamPos = new preview.THREE.Vector3();

    const worldPos = preview.rotateAxisArrowWorldPos;
    const camPos = preview.rotateAxisArrowCamPos;
    preview.modelGroup.getWorldPosition(worldPos);
    preview.camera.updateMatrixWorld();
    preview.camera.getWorldPosition(camPos);

    let factor = 1;
    if (preview.camera.isOrthographicCamera) {
      const top = Number(preview.camera.top || 1);
      const bottom = Number(preview.camera.bottom || -1);
      const zoom = Math.max(1e-6, Number(preview.camera.zoom || 1));
      factor = (top - bottom) / zoom;
    } else {
      const distance = Math.max(1e-6, worldPos.distanceTo(camPos));
      const fov = Number(preview.camera.fov || 50);
      const zoom = Math.max(1e-6, Number(preview.camera.zoom || 1));
      factor = distance * Math.min((1.9 * Math.tan((Math.PI * fov) / 360)) / zoom, 7);
    }

    const gizmoSize = Math.max(0.01, Number(preview.transformControls.size || 1));
    const worldScale = Math.max(0.0001, (factor * gizmoSize) / 4);
    group.scale.setScalar(worldScale);
  }

  function isDescendantOf(node, ancestor) {
    let cur = node;
    while (cur) {
      if (cur === ancestor) return true;
      cur = cur.parent;
    }
    return false;
  }

  function getSliceModelBounds(preview = state.slicePreview) {
    if (!preview || !preview.modelGroup || !preview.THREE) return null;
    // Three.js Box3.setFromObject ignores .visible — temporarily detach
    // the arrow group so it does not inflate the bounding box.
    const arrows = preview.rotateAxisArrowGroup;
    const arrowWasChild = arrows && arrows.parent === preview.modelGroup;
    if (arrowWasChild) {
      preview.modelGroup.remove(arrows);
    }
    let box = null;
    try {
      box = new preview.THREE.Box3().setFromObject(preview.modelGroup);
    } catch (_err) {
      box = null;
    } finally {
      if (arrowWasChild && arrows) {
        preview.modelGroup.add(arrows);
      }
    }
    if (!box || box.isEmpty()) return null;
    return box;
  }

  function estimateSliceContactPlaneFromSamples(samples, fallbackMinZ = 0, fallbackMaxZ = 0) {
    const minZ = Number(fallbackMinZ);
    const maxZ = Number(fallbackMaxZ);
    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      return {
        contactZ: Number.isFinite(minZ) ? minZ : 0,
        outlierUsed: false,
      };
    }

    const span = Math.max(0, maxZ - minZ);
    if (!Array.isArray(samples) || samples.length < 96 || span <= 1e-9) {
      return {
        contactZ: minZ,
        outlierUsed: false,
      };
    }

    const sorted = samples
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (sorted.length < 96) {
      return {
        contactZ: minZ,
        outlierUsed: false,
      };
    }

    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.01)));
    const p01 = Number(sorted[idx]);
    if (!Number.isFinite(p01)) {
      return {
        contactZ: minZ,
        outlierUsed: false,
      };
    }

    const outlierGap = p01 - minZ;
    const outlierThreshold = Math.max(0.35, span * 0.05);
    if (outlierGap > outlierThreshold) {
      return {
        contactZ: p01,
        outlierUsed: true,
      };
    }

    return {
      contactZ: minZ,
      outlierUsed: false,
    };
  }

  function estimateSliceGeometryContactZ(geometry) {
    if (!geometry || typeof geometry.getAttribute !== "function") {
      return {
        contactZ: 0,
        hasOutlier: false,
      };
    }

    const position = geometry.getAttribute("position");
    if (!position || !position.count) {
      return {
        contactZ: 0,
        hasOutlier: false,
      };
    }

    let minZ = Infinity;
    let maxZ = -Infinity;
    const samples = [];

    const raw = position.array;
    const itemSize = Number(position.itemSize || 3);
    if (raw && typeof raw.length === "number" && itemSize >= 3) {
      const count = Math.floor(raw.length / itemSize);
      const stride = Math.max(1, Math.floor(count / 20000));
      for (let i = 0; i < count; i += 1) {
        const z = Number(raw[(i * itemSize) + 2]);
        if (!Number.isFinite(z)) continue;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        if (i % stride === 0) samples.push(z);
      }
    } else {
      const count = Number(position.count || 0);
      const stride = Math.max(1, Math.floor(count / 20000));
      for (let i = 0; i < count; i += 1) {
        const z = Number(position.getZ(i));
        if (!Number.isFinite(z)) continue;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        if (i % stride === 0) samples.push(z);
      }
    }

    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      return {
        contactZ: 0,
        hasOutlier: false,
      };
    }

    const contact = estimateSliceContactPlaneFromSamples(samples, minZ, maxZ);
    return {
      contactZ: Number(contact.contactZ || minZ),
      hasOutlier: !!contact.outlierUsed,
    };
  }

  function estimateSliceModelContactZ(preview = state.slicePreview) {
    if (!preview || !preview.THREE || !preview.modelGroup) return 0;

    const bounds = getSliceModelBounds(preview);
    if (!bounds) return 0;

    const minZ = Number(bounds.min.z);
    const maxZ = Number(bounds.max.z);
    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) return 0;

    const THREE = preview.THREE;
    const temp = new THREE.Vector3();
    const samples = [];

    const arrowGroup = preview.rotateAxisArrowGroup;
    preview.modelGroup.updateMatrixWorld(true);
    preview.modelGroup.traverse((node) => {
      if (!node || !node.isMesh || !node.geometry || typeof node.geometry.getAttribute !== "function") return;
      // Skip meshes that belong to the rotate-axis arrows overlay.
      if (arrowGroup && isDescendantOf(node, arrowGroup)) return;
      const position = node.geometry.getAttribute("position");
      if (!position || !position.count) return;

      const raw = position.array;
      const itemSize = Number(position.itemSize || 3);
      if (raw && typeof raw.length === "number" && itemSize >= 3) {
        const count = Math.floor(raw.length / itemSize);
        const stride = Math.max(1, Math.floor(count / 12000));
        for (let i = 0; i < count; i += stride) {
          const base = i * itemSize;
          temp.set(Number(raw[base]) || 0, Number(raw[base + 1]) || 0, Number(raw[base + 2]) || 0).applyMatrix4(node.matrixWorld);
          const z = Number(temp.z);
          if (Number.isFinite(z)) samples.push(z);
        }
        return;
      }

      const count = Number(position.count || 0);
      const stride = Math.max(1, Math.floor(count / 12000));
      for (let i = 0; i < count; i += stride) {
        temp.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
        const z = Number(temp.z);
        if (Number.isFinite(z)) samples.push(z);
      }
    });

    const contact = estimateSliceContactPlaneFromSamples(samples, minZ, maxZ);
    return Number(contact.contactZ || minZ);
  }

  function renderSlicePreview() {
    const preview = state.slicePreview;
    if (!preview || !preview.renderer || !preview.scene || !preview.camera) return;
    syncSliceRotateAxisArrowsToGizmoScale(preview);
    preview.renderer.render(preview.scene, preview.camera);
  }

  // ---- Lightweight global slice status bar + cancel ----
  async function fetchSliceStatus() {
    try {
      const res = await fetch("/api/slice/status");
      if (!res.ok) return null;
      return await res.json();
    } catch (_err) {
      return null;
    }
  }

  async function cancelSliceJob(fileId) {
    try {
      await fetch(`/api/files/${fileId}/slice/cancel`, { method: "POST" });
    } catch (_err) {}
  }

  function ensureSliceStatusBar() {
    let bar = document.getElementById("sliceStatusBar");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "sliceStatusBar";
    bar.style.position = "fixed";
    bar.style.right = "20px";
    bar.style.bottom = "20px";
    bar.style.zIndex = "75"; // Below file-info-drawer (z-index 80)
    bar.style.background = "rgba(20,30,40,0.95)";
    bar.style.color = "#dfe8f1";
    bar.style.border = "1px solid #2a3b4a";
    bar.style.borderRadius = "8px";
    bar.style.padding = "10px 14px";
    bar.style.fontSize = "13px";
    bar.style.boxShadow = "0 2px 10px rgba(0,0,0,0.35)";
    bar.style.transition = "right 0.19s ease";
    document.body.appendChild(bar);
    return bar;
  }

  function updateSliceStatusBarPosition(bar) {
    const drawer = document.getElementById("fileInfoDrawer");
    const isDrawerOpen = drawer && drawer.classList.contains("open");
    // Drawer is min(430px, calc(100vw - 14px)) wide
    bar.style.right = isDrawerOpen ? "450px" : "20px";
  }

  async function pollSliceStatusLoop() {
    const bar = ensureSliceStatusBar();
    updateSliceStatusBarPosition(bar);
    
    const data = await fetchSliceStatus();
    if (!data || !data.ok) {
      bar.style.display = "none";
      setTimeout(pollSliceStatusLoop, 3000);
      return;
    }
    const stats = (data && data.data && data.data.stats) || { total: 0, completed: 0, processing: 0, errors: 0 };
    const ids = (data && data.data && data.data.processing_ids) || [];

    // Hide if nothing actively processing
    if (stats.processing === 0) {
      bar.style.display = "none";
      setTimeout(pollSliceStatusLoop, 3000);
      return;
    }
    
    bar.style.display = "block";

    // Render text
    const text = `Slicing: ${stats.completed}/${stats.total} • behandler: ${stats.processing} • fejl: ${stats.errors}`;
    bar.innerHTML = `<span>${text}</span>`;

    if (ids.length) {
      const btn = document.createElement("button");
      btn.textContent = "Stop alle";
      btn.style.marginLeft = "10px";
      btn.style.padding = "5px 12px";
      btn.style.borderRadius = "6px";
      btn.style.border = "1px solid #e74c3c";
      btn.style.background = "#c0392b";
      btn.style.color = "#fff";
      btn.style.cursor = "pointer";
      btn.style.fontWeight = "600";
      btn.onmouseenter = () => { btn.style.background = "#e74c3c"; };
      btn.onmouseleave = () => { btn.style.background = "#c0392b"; };
      btn.onclick = () => {
        ids.forEach((id) => cancelSliceJob(id));
      };
      bar.appendChild(btn);
    }

    setTimeout(pollSliceStatusLoop, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => pollSliceStatusLoop());
  } else {
    pollSliceStatusLoop();
  }

  function resizeSlicePreview(preview = state.slicePreview) {
    if (!preview || !preview.renderer || !preview.camera || !preview.canvas) return;
    const rect = preview.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || preview.canvas.clientWidth || 1));
    const height = Math.max(1, Math.floor(rect.height || preview.canvas.clientHeight || 1));
    preview.renderer.setSize(width, height, false);

    const aspect = width / height;
    const halfBase = Math.max(8, Number(preview.halfBase || 180));
    const distanceBase = Math.max(120, halfBase * 3.4);
    preview.viewDistanceBase = distanceBase;

    if (preview.camera.isPerspectiveCamera) {
      preview.camera.aspect = aspect;
      preview.camera.near = 0.1;
      preview.camera.far = distanceBase * 120;
    } else {
      preview.camera.left = -halfBase * aspect;
      preview.camera.right = halfBase * aspect;
      preview.camera.top = halfBase;
      preview.camera.bottom = -halfBase;
      preview.camera.near = 0.1;
      preview.camera.far = halfBase * 40;
      preview.camera.position.set(0, 0, halfBase * 10);
      preview.camera.lookAt(0, 0, 0);
    }

    if (preview.controls) {
      preview.controls.minDistance = Math.max(24, distanceBase * 0.28);
      preview.controls.maxDistance = Math.max(240, distanceBase * 18);
      if (!preview.viewInitialized) {
        preview.camera.position.set(distanceBase * 0.95, -distanceBase * 0.7, distanceBase * 0.9);
        preview.controls.target.set(0, 0, Math.max(0, currentSliceLiftMm() * 0.35));
        preview.controls.update();
        preview.viewInitialized = true;
      }
    }

    preview.camera.updateProjectionMatrix();
    renderSlicePreview();
  }

  function estimateSlicePlatePrintableSurfaceZ(preview, group, precomputedBox = null) {
    if (!preview || !preview.THREE || !group) return 0;
    const THREE = preview.THREE;
    const box = precomputedBox || new THREE.Box3().setFromObject(group);
    if (!box || box.isEmpty()) return 0;

    const minZ = Number(box.min.z);
    const maxZ = Number(box.max.z);
    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) return 0;

    const zSpan = Math.max(1e-6, maxZ - minZ);
    const tolerance = Math.max(0.08, zSpan * 0.012);

    const nearMin = {
      count: 0,
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      normalZSum: 0,
      normalSamples: 0,
    };
    const nearMax = {
      count: 0,
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      normalZSum: 0,
      normalSamples: 0,
    };
    const temp = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3();

    const touchStats = (stats, x, y, normalZ) => {
      stats.count += 1;
      if (x < stats.minX) stats.minX = x;
      if (x > stats.maxX) stats.maxX = x;
      if (y < stats.minY) stats.minY = y;
      if (y > stats.maxY) stats.maxY = y;
      if (Number.isFinite(normalZ)) {
        stats.normalZSum += normalZ;
        stats.normalSamples += 1;
      }
    };
    const footprintArea = (stats) => {
      if (!stats || stats.count < 3) return 0;
      if (!Number.isFinite(stats.minX) || !Number.isFinite(stats.maxX) || !Number.isFinite(stats.minY) || !Number.isFinite(stats.maxY)) {
        return 0;
      }
      const width = Math.max(0, stats.maxX - stats.minX);
      const depth = Math.max(0, stats.maxY - stats.minY);
      return width * depth;
    };
    const avgNormalZ = (stats) => {
      if (!stats || stats.normalSamples <= 0) return 0;
      return stats.normalZSum / stats.normalSamples;
    };
    const upwardScore = (area, avgNz) => {
      return area * (0.35 + Math.max(0, avgNz));
    };

    group.updateMatrixWorld(true);
    group.traverse((node) => {
      if (!node || !node.isMesh || !node.geometry || typeof node.geometry.getAttribute !== "function") return;
      const position = node.geometry.getAttribute("position");
      const normal = node.geometry.getAttribute("normal");
      if (!position || !position.count) return;
      const hasNormal = !!(normal && normal.count >= position.count);
      if (hasNormal) {
        normalMatrix.getNormalMatrix(node.matrixWorld);
      }
      for (let i = 0; i < position.count; i += 1) {
        temp.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
        const z = Number(temp.z);
        let normalZ = NaN;
        if (hasNormal) {
          tempNormal.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
          normalZ = Number(tempNormal.z);
        }
        if (Math.abs(z - minZ) <= tolerance) touchStats(nearMin, Number(temp.x), Number(temp.y), normalZ);
        if (Math.abs(z - maxZ) <= tolerance) touchStats(nearMax, Number(temp.x), Number(temp.y), normalZ);
      }
    });

    const minArea = footprintArea(nearMin);
    const maxArea = footprintArea(nearMax);
    const minAvgNz = avgNormalZ(nearMin);
    const maxAvgNz = avgNormalZ(nearMax);

    const minTopScore = upwardScore(minArea, minAvgNz);
    const maxTopScore = upwardScore(maxArea, maxAvgNz);
    if (maxTopScore > (minTopScore * 1.08)) return maxZ;
    if (minTopScore > (maxTopScore * 1.08)) return minZ;

    if (maxAvgNz > (minAvgNz + 0.08)) return maxZ;
    if (minAvgNz > (maxAvgNz + 0.08)) return minZ;

    if (maxArea > (minArea * 1.12)) return maxZ;
    if (minArea > (maxArea * 1.12)) return minZ;

    // Fallback for ambiguous meshes.
    return Math.abs(maxZ) <= Math.abs(minZ) ? maxZ : minZ;
  }

  function getSlicePreviewPlateTopZ(preview = state.slicePreview) {
    if (!preview) return 0;
    const explicitTop = Number(preview.plateTopZ || 0);
    if (Number.isFinite(explicitTop)) return explicitTop;
    return 0;
  }

  function resolveSlicePreviewModelContactZ(preview, modelBounds = null) {
    if (!preview || !preview.THREE) return 0;
    if (!preview.plateGroup) return getSlicePreviewPlateTopZ(preview);

    const THREE = preview.THREE;
    let plateBox = null;
    try {
      plateBox = new THREE.Box3().setFromObject(preview.plateGroup);
    } catch (_err) {
      plateBox = null;
    }
    if (!plateBox || plateBox.isEmpty()) return getSlicePreviewPlateTopZ(preview);

    const meshes = [];
    preview.plateGroup.traverse((node) => {
      if (node && node.isMesh) meshes.push(node);
    });
    if (!meshes.length) return estimateSlicePlatePrintableSurfaceZ(preview, preview.plateGroup, plateBox);

    const center = modelBounds
      ? modelBounds.getCenter(new THREE.Vector3())
      : new THREE.Vector3(0, 0, 0);
    const plateSpan = Math.max(1, Number(plateBox.max.z) - Number(plateBox.min.z));
    const modelTop = modelBounds ? Number(modelBounds.max.z || 0) : 0;
    const originZ = Math.max(Number(plateBox.max.z || 0), modelTop, 0) + Math.max(plateSpan * 3, 1200);

    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(Number(center.x) || 0, Number(center.y) || 0, originZ), new THREE.Vector3(0, 0, -1));

    let contactZ = Number.NaN;
    try {
      const hits = raycaster.intersectObjects(meshes, false) || [];
      for (const hit of hits) {
        const z = Number(hit && hit.point ? hit.point.z : Number.NaN);
        if (!Number.isFinite(z)) continue;
        if (!Number.isFinite(contactZ) || z > contactZ) {
          contactZ = z;
        }
      }
    } catch (_err) {
      contactZ = Number.NaN;
    }

    if (Number.isFinite(contactZ)) return contactZ;
    return estimateSlicePlatePrintableSurfaceZ(preview, preview.plateGroup, plateBox);
  }

  function updateSlicePreviewFootprint() {
    const preview = state.slicePreview;
    if (!preview || !preview.modelGroup || !preview.THREE) {
      setSlicePreviewFootprint("Model footprint: -");
      setSlicePreviewHeight("Model Z: -");
      return;
    }

    const box = getSliceModelBounds(preview);
    if (!box) {
      setSlicePreviewFootprint("Model footprint: -");
      setSlicePreviewHeight("Model Z: -");
      return;
    }

    const widthMm = Math.max(0, Number(box.max.x) - Number(box.min.x));
    const depthMm = Math.max(0, Number(box.max.y) - Number(box.min.y));
    const fits = widthMm <= (preview.bedWidthMm + 0.05) && depthMm <= (preview.bedDepthMm + 0.05);
    const plateTopZ = getSlicePreviewPlateTopZ(preview);
    const useRobustContact = !!(preview.modelGroup && preview.modelGroup.userData && preview.modelGroup.userData.sliceContactOutlier);
    const modelContactZ = useRobustContact ? estimateSliceModelContactZ(preview) : Number(box.min.z);
    const minZ = Number(modelContactZ) - plateTopZ;
    const maxZ = Number(box.max.z) - plateTopZ;

    setSlicePreviewFootprint(
      `Model footprint: ${formatNumberCompact(widthMm)} x ${formatNumberCompact(depthMm)} mm (${fits ? "fits" : "outside bed"})`,
      fits ? "ok" : "error"
    );

    let zKind = "ok";
    let zNote = "on plate";
    if (minZ < -0.05) {
      zKind = "warn";
      zNote = `under plate by ${formatNumberCompact(Math.abs(minZ))} mm`;
    } else if (minZ > 0.05) {
      zKind = "ok";
      zNote = `lifted ${formatNumberCompact(minZ)} mm`;
    }
    setSlicePreviewHeight(
      `Model Z: ${formatNumberCompact(minZ)} to ${formatNumberCompact(maxZ)} mm (${zNote})`,
      zKind
    );

    if (preview.controls) {
      preview.controls.target.set(0, 0, Math.max(0, Math.min(120, maxZ * 0.25)));
      preview.controls.update();
    }

    if (preview.bedMesh && preview.bedMesh.material && preview.bedMesh.material.color) {
      if (!fits) preview.bedMesh.material.color.setHex(0x4e2329);
      else if (minZ < -0.05) preview.bedMesh.material.color.setHex(0x5a3226);
      else preview.bedMesh.material.color.setHex(0x203949);
    }
  }

  function updateSlicePreviewBedSize(widthMm, depthMm) {
    const preview = state.slicePreview;
    if (!preview || !preview.THREE || !preview.bedMesh || !preview.bedOutline) return;

    const width = Math.max(40, Number(widthMm || DEFAULT_SLICE_BED_SIZE_MM.width_mm));
    const depth = Math.max(40, Number(depthMm || DEFAULT_SLICE_BED_SIZE_MM.depth_mm));

    preview.bedWidthMm = width;
    preview.bedDepthMm = depth;
    preview.halfBase = Math.max(width, depth) * 0.66;

    if (preview.bedMesh.geometry && typeof preview.bedMesh.geometry.dispose === "function") {
      preview.bedMesh.geometry.dispose();
    }
    preview.bedMesh.geometry = new preview.THREE.PlaneGeometry(width, depth);

    if (preview.bedOutline.geometry && typeof preview.bedOutline.geometry.dispose === "function") {
      preview.bedOutline.geometry.dispose();
    }
    preview.bedOutline.geometry = new preview.THREE.EdgesGeometry(preview.bedMesh.geometry);
    alignSlicePreviewGroundToModel(preview);

    resizeSlicePreview(preview);
    updateSlicePreviewFootprint();
    renderSlicePreview();
  }

  function setSlicePreviewBedVisualMode(showDefaultBed = true) {
    const preview = state.slicePreview;
    if (!preview) return;
    const visible = !!showDefaultBed;
    if (preview.bedMesh) preview.bedMesh.visible = visible;
    if (preview.bedOutline) preview.bedOutline.visible = visible;
  }

  function clearSlicePreviewPlate(preview = state.slicePreview) {
    if (!preview) return;
    if (preview.scene && preview.plateGroup) {
      preview.scene.remove(preview.plateGroup);
      disposeSlicePreviewObject(preview.plateGroup);
      preview.plateGroup = null;
    }
    preview.plateTopZ = 0;
    preview.activePlateUrl = "";
  }

  function placeSlicePlateGroupOnBed(preview, group) {
    if (!preview || !group || !preview.THREE) return;
    const THREE = preview.THREE;
    const bedWidth = Math.max(40, Number(preview.bedWidthMm || DEFAULT_SLICE_BED_SIZE_MM.width_mm));
    const bedDepth = Math.max(40, Number(preview.bedDepthMm || DEFAULT_SLICE_BED_SIZE_MM.depth_mm));

    group.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(group);
    if (!rawBox || rawBox.isEmpty()) return;
    const rawSize = rawBox.getSize(new THREE.Vector3());

    let scale = 1;
    if (rawSize.x > 0.001 && rawSize.y > 0.001) {
      const scaleX = bedWidth / rawSize.x;
      const scaleY = bedDepth / rawSize.y;
      const fitScale = Math.min(scaleX, scaleY);
      if (Number.isFinite(fitScale) && fitScale > 0) {
        scale = Math.max(0.03, Math.min(80, fitScale));
      }
    }
    group.scale.setScalar(scale);

    group.updateMatrixWorld(true);
    const placedBox = new THREE.Box3().setFromObject(group);
    if (!placedBox || placedBox.isEmpty()) return;
    const center = placedBox.getCenter(new THREE.Vector3());
    const topSurfaceZ = estimateSlicePlatePrintableSurfaceZ(preview, group, placedBox);
    group.position.set(group.position.x - center.x, group.position.y - center.y, group.position.z - topSurfaceZ);
    group.updateMatrixWorld(true);
    preview.plateTopZ = 0;
  }

  async function loadSlicePreviewPlateAsset(asset, token = state.slicePlateLoadToken) {
    const preview = await ensureSlicePreviewRenderer();
    if (!preview || !asset || !asset.url) return false;
    if (token !== state.slicePlateLoadToken) return false;

    clearSlicePreviewPlate(preview);

    const modules = await ensureThreeModules();
    const { THREE, STLLoader, OBJLoader } = modules;
    const ext = String(asset.ext || "").toLowerCase();
    const assetUrl = String(asset.url || "").trim();
    if (!assetUrl) return false;

    let group = null;
    if (ext === ".stl") {
      const geometry = await new Promise((resolve, reject) => {
        const loader = new STLLoader();
        loader.load(assetUrl, resolve, undefined, reject);
      });
      if (token !== state.slicePlateLoadToken) {
        if (geometry && typeof geometry.dispose === "function") geometry.dispose();
        return false;
      }
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0x2f3d4f,
          roughness: 0.88,
          metalness: 0.08,
          transparent: true,
          opacity: 0.96,
          side: THREE.DoubleSide,
        })
      );
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x7ea2d6, transparent: true, opacity: 0.58 })
      );
      edges.position.z = 0.03;
      group = new THREE.Group();
      group.add(mesh);
      group.add(edges);
    } else if (ext === ".obj") {
      const object = await new Promise((resolve, reject) => {
        const loader = new OBJLoader();
        loader.load(assetUrl, resolve, undefined, reject);
      });
      if (token !== state.slicePlateLoadToken) {
        disposeSlicePreviewObject(object);
        return false;
      }
      object.traverse((node) => {
        if (!node || !node.isMesh) return;
        const geometry = node.geometry || null;
        if (geometry && typeof geometry.computeVertexNormals === "function") {
          try {
            geometry.computeVertexNormals();
          } catch (_err) {}
        }
        if (node.material && typeof node.material.dispose === "function") {
          try {
            node.material.dispose();
          } catch (_err) {}
        }
        node.material = new THREE.MeshStandardMaterial({
          color: 0x2f3d4f,
          roughness: 0.88,
          metalness: 0.08,
          transparent: true,
          opacity: 0.96,
          side: THREE.DoubleSide,
        });
      });
      group = object;
    } else {
      return false;
    }

    if (!group || token !== state.slicePlateLoadToken || !state.slicePreview) {
      disposeSlicePreviewObject(group);
      return false;
    }

    placeSlicePlateGroupOnBed(preview, group);
    preview.scene.add(group);
    preview.plateGroup = group;
    preview.activePlateUrl = assetUrl;
    setSlicePreviewBedVisualMode(false);
    alignSlicePreviewGroundToModel(preview);
    applySlicePreviewRotation();
    renderSlicePreview();
    return true;
  }

  async function refreshSlicePreviewPlateFromSelection() {
    const preview = state.slicePreview;
    if (!preview) return;
    const selectedModelKey = resolveSelectedSlicePlateModelKey();
    if (!selectedModelKey) {
      state.slicePlateLoadToken += 1;
      clearSlicePreviewPlate(preview);
      setSlicePreviewBedVisualMode(true);
      alignSlicePreviewGroundToModel(preview);
      applySlicePreviewRotation();
      renderSlicePreview();
      return;
    }

    const loadToken = ++state.slicePlateLoadToken;
    let assets = [];
    try {
      assets = await loadSlicerPlateAssets();
    } catch (_err) {
      assets = [];
    }
    if (loadToken !== state.slicePlateLoadToken || !state.slicePreview) return;

    const asset = pickSlicerPlateAssetForModel(selectedModelKey, assets);
    if (!asset) {
      clearSlicePreviewPlate(state.slicePreview);
      setSlicePreviewBedVisualMode(true);
      alignSlicePreviewGroundToModel(state.slicePreview);
      applySlicePreviewRotation();
      renderSlicePreview();
      return;
    }

    try {
      const loaded = await loadSlicePreviewPlateAsset(asset, loadToken);
      if (!loaded && loadToken === state.slicePlateLoadToken) {
        clearSlicePreviewPlate(state.slicePreview);
        setSlicePreviewBedVisualMode(true);
        alignSlicePreviewGroundToModel(state.slicePreview);
        applySlicePreviewRotation();
        renderSlicePreview();
      }
    } catch (_err) {
      if (loadToken !== state.slicePlateLoadToken) return;
      clearSlicePreviewPlate(state.slicePreview);
      setSlicePreviewBedVisualMode(true);
      alignSlicePreviewGroundToModel(state.slicePreview);
      applySlicePreviewRotation();
      renderSlicePreview();
    }
  }

  function refreshSlicePreviewBedFromSelection() {
    const bed = resolveSelectedSliceBedSize();
    if (els.slicePreviewBed) {
      els.slicePreviewBed.textContent = `Plade: ${formatNumberCompact(bed.width_mm)} x ${formatNumberCompact(bed.depth_mm)} mm`;
    }
    if (els.sliceBedWidthInput) {
      const w = clampSliceBedSizeMm(bed.width_mm, DEFAULT_SLICE_BED_SIZE_MM.width_mm);
      if (String(els.sliceBedWidthInput.value || "") !== String(w)) els.sliceBedWidthInput.value = String(w);
    }
    if (els.sliceBedDepthInput) {
      const d = clampSliceBedSizeMm(bed.depth_mm, DEFAULT_SLICE_BED_SIZE_MM.depth_mm);
      if (String(els.sliceBedDepthInput.value || "") !== String(d)) els.sliceBedDepthInput.value = String(d);
    }
    updateSlicePreviewBedSize(bed.width_mm, bed.depth_mm);
    refreshSlicePreviewPlateFromSelection().catch(() => {});
  }

  function clearSlicePreview() {
    const preview = state.slicePreview;
    if (!preview) return;
    state.slicePlateLoadToken += 1;

    if (preview.resizeObserver && preview.canvas) {
      try {
        preview.resizeObserver.unobserve(preview.canvas);
      } catch (_err) {}
    }
    if (preview.resizeObserver && typeof preview.resizeObserver.disconnect === "function") {
      try {
        preview.resizeObserver.disconnect();
      } catch (_err) {}
    }
    if (preview.onResize) {
      window.removeEventListener("resize", preview.onResize);
    }

    if (preview.controls && preview.onControlsChange && typeof preview.controls.removeEventListener === "function") {
      try {
        preview.controls.removeEventListener("change", preview.onControlsChange);
      } catch (_err) {}
    }
    if (preview.controls && typeof preview.controls.dispose === "function") {
      try {
      preview.controls.dispose();
      } catch (_err) {}
    }

    if (preview.canvas && preview.onCanvasPointerLeave) {
      try {
        preview.canvas.removeEventListener("pointerleave", preview.onCanvasPointerLeave);
      } catch (_err) {}
    }

    if (preview.transformControls) {
      if (preview.onTransformDraggingChanged && typeof preview.transformControls.removeEventListener === "function") {
        try {
          preview.transformControls.removeEventListener("dragging-changed", preview.onTransformDraggingChanged);
        } catch (_err) {}
      }
      if (preview.onTransformObjectChange && typeof preview.transformControls.removeEventListener === "function") {
        try {
          preview.transformControls.removeEventListener("objectChange", preview.onTransformObjectChange);
        } catch (_err) {}
      }
      if (preview.onTransformHoverOn && typeof preview.transformControls.removeEventListener === "function") {
        try {
          preview.transformControls.removeEventListener("hoveron", preview.onTransformHoverOn);
        } catch (_err) {}
      }
      if (preview.onTransformHoverOff && typeof preview.transformControls.removeEventListener === "function") {
        try {
          preview.transformControls.removeEventListener("hoveroff", preview.onTransformHoverOff);
        } catch (_err) {}
      }
      if (typeof preview.transformControls.detach === "function") {
        try {
          preview.transformControls.detach();
        } catch (_err) {}
      }
      if (preview.scene) {
        try {
          preview.scene.remove(preview.transformControls);
        } catch (_err) {}
      }
      if (typeof preview.transformControls.dispose === "function") {
        try {
          preview.transformControls.dispose();
        } catch (_err) {}
      }
    }

    if (preview.scene && preview.modelGroup) {
      clearSliceRotateAxisArrows(preview);
      preview.scene.remove(preview.modelGroup);
      disposeSlicePreviewObject(preview.modelGroup);
      preview.modelGroup = null;
      updateSliceTransformControlsAttachment();
    }

    clearSlicePreviewPlate(preview);

    if (preview.bedOutline && preview.scene) {
      preview.scene.remove(preview.bedOutline);
      if (preview.bedOutline.geometry && typeof preview.bedOutline.geometry.dispose === "function") {
        preview.bedOutline.geometry.dispose();
      }
      if (preview.bedOutline.material && typeof preview.bedOutline.material.dispose === "function") {
        preview.bedOutline.material.dispose();
      }
    }

    if (preview.bedMesh && preview.scene) {
      preview.scene.remove(preview.bedMesh);
      if (preview.bedMesh.geometry && typeof preview.bedMesh.geometry.dispose === "function") {
        preview.bedMesh.geometry.dispose();
      }
      if (preview.bedMesh.material && typeof preview.bedMesh.material.dispose === "function") {
        preview.bedMesh.material.dispose();
      }
    }

    if (preview.renderer && typeof preview.renderer.dispose === "function") {
      preview.renderer.dispose();
    }

    state.slicePreview = null;
  }

  async function ensureSlicePreviewRenderer() {
    if (state.slicePreview) return state.slicePreview;
    if (!els.slicePreviewCanvas) return null;

    const modules = await ensureThreeModules();
    const { THREE, OrbitControls, TransformControls } = modules;
    const canvas = els.slicePreviewCanvas;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 12000);
    camera.up.set(0, 0, 1);
    camera.position.set(640, -520, 520);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.82));
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(220, 220, 460);
    scene.add(dir);

    const axisGrid = new THREE.GridHelper(700, 14, 0x2d4964, 0x1a2d3f);
    axisGrid.rotation.x = Math.PI / 2;
    axisGrid.position.z = -0.2;
    scene.add(axisGrid);

    const bedMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(DEFAULT_SLICE_BED_SIZE_MM.width_mm, DEFAULT_SLICE_BED_SIZE_MM.depth_mm),
      new THREE.MeshStandardMaterial({
        color: 0x203949,
        roughness: 0.88,
        metalness: 0.04,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      })
    );
    scene.add(bedMesh);

    const bedOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(bedMesh.geometry),
      new THREE.LineBasicMaterial({ color: 0x7ea2d6, transparent: true, opacity: 0.68 })
    );
    bedOutline.position.z = 0.2;
    scene.add(bedOutline);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.82;
    controls.panSpeed = 0.88;
    controls.zoomSpeed = 0.95;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.target.set(0, 0, 0);
    const onControlsChange = () => renderSlicePreview();
    controls.addEventListener("change", onControlsChange);

    const transformControls = new TransformControls(camera, canvas);
    transformControls.setMode("rotate");
    transformControls.setSpace("local");
    transformControls.enabled = false;
    transformControls.visible = false;
    const onTransformDraggingChanged = (event) => {
      preview.isTransformDragging = !!(event && event.value);
      if (controls) {
        controls.enabled = !event.value;
      }
      if (preview.isTransformDragging) {
        preview.gizmoHoverAxis = "";
      }
      updateSlicePreviewCursor(preview);
      if (!event.value) {
        const currentPreview = state.slicePreview;
        if (!currentPreview || currentPreview !== preview) return;
        if (currentPreview.syncingRotation) return;
        syncSliceRotationFromModel();
        applySlicePreviewRotation();
      }
    };
    const onTransformObjectChange = () => {
      const currentPreview = state.slicePreview;
      if (!currentPreview || currentPreview !== preview) return;
      if (currentPreview.syncingRotation) return;
      syncSliceRotationFromModel();
      updateSlicePreviewFootprint();
      renderSlicePreview();
    };
    const onTransformHoverOn = (event) => {
      const currentPreview = state.slicePreview;
      if (!currentPreview || currentPreview !== preview) return;
      currentPreview.gizmoHoverAxis = String((event && event.axis) || "");
      updateSlicePreviewCursor(currentPreview);
    };
    const onTransformHoverOff = () => {
      const currentPreview = state.slicePreview;
      if (!currentPreview || currentPreview !== preview) return;
      currentPreview.gizmoHoverAxis = "";
      updateSlicePreviewCursor(currentPreview);
    };
    const onCanvasPointerLeave = () => {
      const currentPreview = state.slicePreview;
      if (!currentPreview || currentPreview !== preview) return;
      currentPreview.gizmoHoverAxis = "";
      updateSlicePreviewCursor(currentPreview);
    };
    transformControls.addEventListener("dragging-changed", onTransformDraggingChanged);
    transformControls.addEventListener("objectChange", onTransformObjectChange);
    transformControls.addEventListener("hoveron", onTransformHoverOn);
    transformControls.addEventListener("hoveroff", onTransformHoverOff);
    canvas.addEventListener("pointerleave", onCanvasPointerLeave);
    scene.add(transformControls);

    const preview = {
      THREE,
      renderer,
      scene,
      camera,
      controls,
      onControlsChange,
      transformControls,
      onTransformDraggingChanged,
      onTransformObjectChange,
      onTransformHoverOn,
      onTransformHoverOff,
      onCanvasPointerLeave,
      canvas,
      bedMesh,
      bedOutline,
      axisGrid,
      modelGroup: null,
      rotateAxisArrowGroup: null,
      rotateAxisArrowUsesGizmoScale: false,
      rotateAxisArrowWorldPos: null,
      rotateAxisArrowCamPos: null,
      plateGroup: null,
      activePlateUrl: "",
      bedWidthMm: Number(DEFAULT_SLICE_BED_SIZE_MM.width_mm),
      bedDepthMm: Number(DEFAULT_SLICE_BED_SIZE_MM.depth_mm),
      halfBase: Math.max(DEFAULT_SLICE_BED_SIZE_MM.width_mm, DEFAULT_SLICE_BED_SIZE_MM.depth_mm) * 0.66,
      viewDistanceBase: 0,
      viewInitialized: false,
      syncingRotation: false,
      gizmoHoverAxis: "",
      isTransformDragging: false,
      onResize: null,
      resizeObserver: null,
    };

    preview.onResize = () => resizeSlicePreview(preview);
    window.addEventListener("resize", preview.onResize);

    if (typeof ResizeObserver !== "undefined") {
      try {
        preview.resizeObserver = new ResizeObserver(() => resizeSlicePreview(preview));
        preview.resizeObserver.observe(canvas);
      } catch (_err) {
        preview.resizeObserver = null;
      }
    }

    state.slicePreview = preview;
    updateSliceTransformControlsAttachment();
    resizeSlicePreview(preview);
    updateSlicePreviewCursor(preview);
    return preview;
  }

  function applySlicePreviewRotation() {
    const preview = state.slicePreview;
    if (!preview || !preview.modelGroup) return;
    const rotation = currentSliceRotation();
    const liftMm = currentSliceLiftMm();
    preview.syncingRotation = true;
    preview.modelGroup.rotation.set(
      (rotation.x * Math.PI) / 180,
      (rotation.y * Math.PI) / 180,
      (rotation.z * Math.PI) / 180,
      "XYZ"
    );

    // Snap preview mesh to plate after rotation so it mirrors backend slicing behavior.
    preview.modelGroup.position.set(0, 0, 0);
    try {
      const targetMinZ = getSlicePreviewPlateTopZ(preview) + liftMm;
      const useRobustContact = !!(preview.modelGroup.userData && preview.modelGroup.userData.sliceContactOutlier);
      const contactZ = useRobustContact
        ? estimateSliceModelContactZ(preview)
        : (() => {
          const box = getSliceModelBounds(preview);
          return box ? Number(box.min.z) : 0;
        })();
      preview.modelGroup.position.z = targetMinZ - (Number.isFinite(contactZ) ? contactZ : 0);

      const verifyMinZ = useRobustContact
        ? estimateSliceModelContactZ(preview)
        : (() => {
          const verifyBox = getSliceModelBounds(preview);
          return verifyBox ? Number(verifyBox.min.z) : NaN;
        })();
      if (Number.isFinite(verifyMinZ)) {
        const residual = targetMinZ - verifyMinZ;
        if (Math.abs(residual) > 1e-5) {
          preview.modelGroup.position.z += residual;
        }
      }
    } catch (_err) {
      const targetMinZ = getSlicePreviewPlateTopZ(preview) + liftMm;
      preview.modelGroup.position.z = targetMinZ;
    }
    alignSlicePreviewGroundToModel(preview);
    preview.syncingRotation = false;

    updateSlicePreviewFootprint();
    renderSlicePreview();
  }

  function syncSliceRotationFromModel() {
    const preview = state.slicePreview;
    if (!preview || !preview.modelGroup) return;
    const e = preview.modelGroup.rotation || null;
    if (!e) return;
    const next = {
      x: clampSliceRotationDeg((Number(e.x || 0) * 180) / Math.PI),
      y: clampSliceRotationDeg((Number(e.y || 0) * 180) / Math.PI),
      z: clampSliceRotationDeg((Number(e.z || 0) * 180) / Math.PI),
    };
    syncSliceRotationInputs(next);
  }

  function updateSliceToolUi() {
    const mode = state.sliceActiveTool === "rotate" ? "rotate" : "view";
    const viewActive = mode === "view";
    const rotateActive = mode === "rotate";
    if (els.sliceToolViewBtn) {
      els.sliceToolViewBtn.classList.toggle("active", viewActive);
      els.sliceToolViewBtn.setAttribute("aria-pressed", viewActive ? "true" : "false");
    }
    if (els.sliceToolRotateBtn) {
      els.sliceToolRotateBtn.classList.toggle("active", rotateActive);
      els.sliceToolRotateBtn.setAttribute("aria-pressed", rotateActive ? "true" : "false");
    }
    if (els.sliceRotateQuickPanel) {
      els.sliceRotateQuickPanel.classList.toggle("hidden", !rotateActive);
    }
    if (els.sliceStageToolHint) {
      els.sliceStageToolHint.textContent = rotateActive
        ? "Rotate aktiv: træk i ringene på modellen eller skriv X/Y/Z manuelt."
        : "View aktiv: fri orbit-kontrol. Klik Rotate i topmenuen for at starte rotation.";
    }
  }

  function updateSliceTransformControlsAttachment() {
    const preview = state.slicePreview;
    if (!preview || !preview.transformControls) return;
    const mode = state.sliceActiveTool === "rotate" ? "rotate" : "view";
    const canAttach = !!preview.modelGroup;

    if (mode === "rotate" && canAttach) {
      preview.transformControls.enabled = true;
      preview.transformControls.visible = true;
      preview.transformControls.setMode("rotate");
      if (preview.transformControls.object !== preview.modelGroup) {
        preview.transformControls.attach(preview.modelGroup);
      }
    } else {
      preview.transformControls.enabled = false;
      preview.transformControls.visible = false;
      preview.gizmoHoverAxis = "";
      preview.isTransformDragging = false;
      if (preview.transformControls.object) {
        preview.transformControls.detach();
      }
    }
    updateSliceRotateAxisArrowVisibility(preview);
    updateSlicePreviewCursor(preview);
    renderSlicePreview();
  }

  function setSliceToolMode(mode = "view") {
    state.sliceActiveTool = String(mode || "").toLowerCase() === "rotate" ? "rotate" : "view";
    updateSliceToolUi();
    updateSliceTransformControlsAttachment();
  }

  function setSliceModalRotationAxis(axis, rotationDeg) {
    const normalized = clampSliceRotationDeg(rotationDeg);
    if (!state.sliceRotation || typeof state.sliceRotation !== "object") {
      state.sliceRotation = { x: 0, y: 0, z: 0 };
    }
    const key = String(axis || "").toLowerCase();
    if (key === "x" || key === "y" || key === "z") {
      state.sliceRotation[key] = normalized;
    }
    syncSliceRotationInputs(state.sliceRotation);
    applySlicePreviewRotation();
  }

  function setSliceModalRotation(rotation = null) {
    const next = rotation && typeof rotation === "object" ? rotation : {};
    syncSliceRotationInputs({
      x: next.x || 0,
      y: next.y || 0,
      z: next.z || 0,
    });
    applySlicePreviewRotation();
  }

  function setSliceModalLiftMm(valueMm) {
    const normalized = 0;
    if (els.sliceLiftZRange) {
      els.sliceLiftZRange.value = String(normalized);
    }
    setSliceLiftValueText(normalized);
    applySlicePreviewRotation();
  }

  async function loadSlicePreviewModel(file) {
    const preview = await ensureSlicePreviewRenderer();
    if (!preview || !file) return;

    if (preview.modelGroup) {
      clearSliceRotateAxisArrows(preview);
      preview.scene.remove(preview.modelGroup);
      disposeSlicePreviewObject(preview.modelGroup);
      preview.modelGroup = null;
    }

    const ext = String(file.ext || "").toLowerCase();
    if (ext !== ".stl") {
      setSlicePreviewFootprint("Model footprint: Preview understotter STL filer", "error");
      setSlicePreviewHeight("Model Z: Preview understotter STL filer", "error");
      renderSlicePreview();
      return;
    }

    const modelUrl = String(file.content_url || "").trim();
    if (!modelUrl) {
      setSlicePreviewFootprint("Model footprint: Kunne ikke finde STL", "error");
      setSlicePreviewHeight("Model Z: Kunne ikke finde STL", "error");
      renderSlicePreview();
      return;
    }

    state.slicePreviewLoadToken += 1;
    const loadToken = state.slicePreviewLoadToken;
    const modules = await ensureThreeModules();
    const { THREE, STLLoader } = modules;

    setSlicePreviewFootprint("Model footprint: Indlæser model...");
    setSlicePreviewHeight("Model Z: Indlæser model...");

    const geometry = await new Promise((resolve, reject) => {
      const loader = new STLLoader();
      loader.load(modelUrl, resolve, undefined, reject);
    });

    if (loadToken !== state.slicePreviewLoadToken || !state.slicePreview) {
      if (geometry && typeof geometry.dispose === "function") geometry.dispose();
      return;
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) {
      if (typeof geometry.dispose === "function") geometry.dispose();
      throw new Error("Ingen STL geometri i filen");
    }

    const centerX = (Number(box.min.x) + Number(box.max.x)) / 2;
    const centerY = (Number(box.min.y) + Number(box.max.y)) / 2;
    const contact = estimateSliceGeometryContactZ(geometry);
    const contactZ = Number.isFinite(Number(contact.contactZ)) ? Number(contact.contactZ) : Number(box.min.z);
    geometry.translate(-centerX, -centerY, -contactZ);
    // Translation invalidates precomputed bounds; refresh so snap-to-plate uses true min Z.
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: 0x8ec5ff, roughness: 0.65, metalness: 0.14 })
    );

    const modelGroup = new THREE.Group();
    modelGroup.add(mesh);
    modelGroup.userData.sliceContactOutlier = !!contact.hasOutlier;
    preview.scene.add(modelGroup);
    preview.modelGroup = modelGroup;
    rebuildSliceRotateAxisArrows(preview);
    updateSliceTransformControlsAttachment();

    setSliceModalRotation(currentSliceRotation());
    setSliceModalLiftMm(currentSliceLiftMm());
  }

  async function setupSliceModalPreview(file) {
    if (!els.slicePreviewCanvas) return;
    await ensureSlicePreviewRenderer();
    refreshSlicePreviewBedFromSelection();
    await loadSlicePreviewModel(file);
  }

  async function loadSliceProfiles(force = false) {
    if (!force && state.sliceProfiles && typeof state.sliceProfiles === "object") {
      return state.sliceProfiles;
    }
    const data = await api("/api/slice/profiles");
    const profiles = data && data.profiles && typeof data.profiles === "object" ? data.profiles : {};
    state.sliceProfiles = {
      printers: toStringList(profiles.printers),
      print_profiles: toStringList(profiles.print_profiles),
      filament_profiles: toStringList(profiles.filament_profiles),
      printer_beds: parseSlicePrinterBeds(profiles.printer_beds),
      printer_bed_map: parseSlicePrinterBeds(profiles.printer_bed_map),
      printer_bed_map_raw: (profiles.printer_bed_map && typeof profiles.printer_bed_map === "object")
        ? profiles.printer_bed_map
        : {},
      parse_error: String(data.parse_error || ""),
      source: String(data.source || ""),
      config_path: String(data.config_path || ""),
    };
    return state.sliceProfiles;
  }

  function closeSliceModal() {
    settleSliceNozzlePick("");
    state.slicePreviewLoadToken += 1;
    clearSlicePreview();
    state.currentSliceFileId = 0;
    state.sliceProcessSettingsBase = {};
    state.sliceProcessSettingsBaseApi = {};
    state.sliceProcessSettingsOptions = {};
    state.sliceProcessSettingsOverrides = {};
    state.sliceProcessSettingsProfileKey = "";
    state.sliceProcessSettingsActiveTab = "quality";
    state.sliceProcessSettingsLoadToken += 1;
    syncSliceProcessSettingsTabUi();
    if (els.sliceProcessSettingsSearchInput) els.sliceProcessSettingsSearchInput.value = "";
    if (els.sliceProcessSettingsList) els.sliceProcessSettingsList.innerHTML = "";
    if (els.sliceProcessSettingsMeta) els.sliceProcessSettingsMeta.textContent = "Ingen process settings indlæst.";
    showStatus(els.sliceProcessSettingsStatus, "");
    setSliceModalRotation({
      x: clampSliceRotationDeg(state.lastSliceSelection.rotation_x_degrees || 0),
      y: clampSliceRotationDeg(state.lastSliceSelection.rotation_y_degrees || 0),
      z: clampSliceRotationDeg(state.lastSliceSelection.rotation_z_degrees || 0),
    });
    setSliceToolMode("view");
    setSliceModalLiftMm(0);
    if (els.sliceSupportModeSelect) els.sliceSupportModeSelect.value = "auto";
    if (els.sliceSupportTypeSelect) els.sliceSupportTypeSelect.value = "";
    if (els.sliceSupportStyleSelect) els.sliceSupportStyleSelect.value = "";
    if (els.sliceNozzleLeftDiameterSelect) els.sliceNozzleLeftDiameterSelect.value = DEFAULT_SLICE_NOZZLE_DIAMETER;
    if (els.sliceNozzleRightDiameterSelect) els.sliceNozzleRightDiameterSelect.value = DEFAULT_SLICE_NOZZLE_DIAMETER;
    if (els.sliceNozzleLeftFlowSelect) els.sliceNozzleLeftFlowSelect.value = DEFAULT_SLICE_NOZZLE_FLOW;
    if (els.sliceNozzleRightFlowSelect) els.sliceNozzleRightFlowSelect.value = DEFAULT_SLICE_NOZZLE_FLOW;
    updateSliceSupportControlsUi();
    if (els.slicePreviewBed) {
      els.slicePreviewBed.textContent = `Plade: ${formatNumberCompact(DEFAULT_SLICE_BED_SIZE_MM.width_mm)} x ${formatNumberCompact(DEFAULT_SLICE_BED_SIZE_MM.depth_mm)} mm`;
    }
    if (els.sliceBedWidthInput) els.sliceBedWidthInput.value = "";
    if (els.sliceBedDepthInput) els.sliceBedDepthInput.value = "";
    setSlicePreviewFootprint("Model footprint: -");
    setSlicePreviewHeight("Model Z: -");
    showStatus(els.sliceModalStatus, "");
    if (els.sliceModal) els.sliceModal.classList.add("hidden");
  }

  function closeSliceNozzlePickModal() {
    if (els.sliceNozzlePickModal) els.sliceNozzlePickModal.classList.add("hidden");
  }

  function settleSliceNozzlePick(value = "") {
    const normalized = normalizeSlicePrintNozzle(value);
    const resolver = typeof state.sliceNozzlePickResolver === "function" ? state.sliceNozzlePickResolver : null;
    state.sliceNozzlePickResolver = null;
    closeSliceNozzlePickModal();
    if (resolver) resolver(normalized);
  }

  function promptSliceNozzlePick(defaultNozzle = "") {
    const normalizedDefault = normalizeSlicePrintNozzle(defaultNozzle);
    if (!els.sliceNozzlePickModal) {
      return Promise.resolve(normalizedDefault || "left");
    }
    if (typeof state.sliceNozzlePickResolver === "function") {
      try {
        state.sliceNozzlePickResolver("");
      } catch (_) {
      }
      state.sliceNozzlePickResolver = null;
    }
    els.sliceNozzlePickModal.classList.remove("hidden");
    if (normalizedDefault === "right" && els.sliceNozzlePickRightBtn) {
      els.sliceNozzlePickRightBtn.focus();
    } else if (els.sliceNozzlePickLeftBtn) {
      els.sliceNozzlePickLeftBtn.focus();
    }
    return new Promise((resolve) => {
      state.sliceNozzlePickResolver = resolve;
    });
  }

  async function openSliceModal(fileId) {
    if (SLICE_ACTIONS_DISABLED) {
      showStatus(els.uploadStatus, `${SLICE_DISABLED_TITLE}.`, "error");
      return;
    }
    const file = fileById(fileId);
    if (!file || !file.can_slice || state.role !== "admin") return;

    state.currentSliceFileId = Number(file.id || 0);
    state.slicePlateAssets = null;
    state.sliceProcessSettingsBase = {};
    state.sliceProcessSettingsBaseApi = {};
    state.sliceProcessSettingsOptions = {};
    state.sliceProcessSettingsOverrides = {};
    state.sliceProcessSettingsProfileKey = "";
    state.sliceProcessSettingsActiveTab = "quality";
    state.sliceProcessSettingsLoadToken += 1;
    syncSliceProcessSettingsTabUi();
    if (els.sliceModalFileName) els.sliceModalFileName.textContent = String(file.filename || "-");
    if (els.sliceModal) els.sliceModal.classList.remove("hidden");
    setSliceToolMode("view");
    setSliceModalRotation({ x: 0, y: 0, z: 0 });
    setSliceModalLiftMm(clampSliceLiftMm(state.lastSliceSelection.lift_z_mm, 0));
    if (els.sliceSupportModeSelect) {
      els.sliceSupportModeSelect.value = normalizeSliceSupportMode(state.lastSliceSelection.support_mode || "auto");
    }
    if (els.sliceSupportTypeSelect) {
      els.sliceSupportTypeSelect.value = normalizeSliceSupportType(state.lastSliceSelection.support_type || "");
    }
    if (els.sliceSupportStyleSelect) {
      els.sliceSupportStyleSelect.value = normalizeSliceSupportStyle(state.lastSliceSelection.support_style || "");
    }
    if (els.sliceNozzleLeftDiameterSelect) {
      const normalizedNozzleLeftDiameter = normalizeSliceNozzleDiameter(
        state.lastSliceSelection.nozzle_left_diameter || DEFAULT_SLICE_NOZZLE_DIAMETER
      );
      els.sliceNozzleLeftDiameterSelect.value = normalizedNozzleLeftDiameter || DEFAULT_SLICE_NOZZLE_DIAMETER;
    }
    if (els.sliceNozzleRightDiameterSelect) {
      const normalizedNozzleRightDiameter = normalizeSliceNozzleDiameter(
        state.lastSliceSelection.nozzle_right_diameter || DEFAULT_SLICE_NOZZLE_DIAMETER
      );
      els.sliceNozzleRightDiameterSelect.value = normalizedNozzleRightDiameter || DEFAULT_SLICE_NOZZLE_DIAMETER;
    }
    if (els.sliceNozzleLeftFlowSelect) {
      const normalizedNozzleLeftFlow = normalizeSliceNozzleFlow(
        state.lastSliceSelection.nozzle_left_flow || DEFAULT_SLICE_NOZZLE_FLOW
      );
      els.sliceNozzleLeftFlowSelect.value = normalizedNozzleLeftFlow || DEFAULT_SLICE_NOZZLE_FLOW;
    }
    if (els.sliceNozzleRightFlowSelect) {
      const normalizedNozzleRightFlow = normalizeSliceNozzleFlow(
        state.lastSliceSelection.nozzle_right_flow || DEFAULT_SLICE_NOZZLE_FLOW
      );
      els.sliceNozzleRightFlowSelect.value = normalizedNozzleRightFlow || DEFAULT_SLICE_NOZZLE_FLOW;
    }
    if (els.sliceProcessSettingsSearchInput) {
      els.sliceProcessSettingsSearchInput.value = "";
    }
    updateSliceSupportControlsUi();
    setSlicePreviewFootprint("Model footprint: Klargør preview...");
    setSlicePreviewHeight("Model Z: Klargør preview...");
    if (els.sliceModalStartBtn) els.sliceModalStartBtn.disabled = true;
    showStatus(els.sliceModalStatus, "Henter slice-profiler...", "ok");

    try {
      const profiles = await loadSliceProfiles(true);
      renderSliceSelect(els.slicePrinterSelect, profiles.printers, "Vælg printer", false);
      renderSliceSelect(els.slicePrintProfileSelect, profiles.print_profiles, "Auto / fra config");
      renderSliceSelect(els.sliceProcessProfileSelect, profiles.print_profiles, "Auto / fra config");

      setSliceSelectValue(els.slicePrinterSelect, state.lastSliceSelection.printer_profile);
      ensureSliceSelectHasValue(els.slicePrinterSelect);
      applySlicePrintProfileFilterForSelectedPrinter(state.lastSliceSelection.print_profile);
      applySliceFilamentFilterForSelectedPrinter(state.lastSliceSelection.filament_profile);
      updateSliceNozzleUiForSelectedPrinter();
      syncSliceProcessProfileSelectFromMain();
      if (!String((els.sliceProcessProfileSelect && els.sliceProcessProfileSelect.value) || "").trim()) {
        const firstExplicitProcessProfile = firstNonEmptySliceSelectValue(els.sliceProcessProfileSelect)
          || firstNonEmptySliceSelectValue(els.slicePrintProfileSelect);
        if (firstExplicitProcessProfile) {
          if (els.sliceProcessProfileSelect) {
            els.sliceProcessProfileSelect.value = firstExplicitProcessProfile;
          }
          syncMainPrintProfileSelectFromProcess();
        }
      }
      // Render known printer options and try to guess from selected printer name
      if (els.sliceKnownPrinterSelect) {
        const guessed = guessKnownModelFromProfileName((els.slicePrinterSelect && els.slicePrinterSelect.value) || "");
        renderKnownPrinterSelect(els.sliceKnownPrinterSelect, guessed);
      }
      refreshSlicePreviewBedFromSelection();
      try {
        await loadSliceProcessSettings(true);
        const rememberedOverrides = state.lastSliceSelection.process_overrides && typeof state.lastSliceSelection.process_overrides === "object"
          ? normalizeSliceProcessSettingsMap(state.lastSliceSelection.process_overrides)
          : {};
        const rememberedForCurrent = {};
        Object.entries(rememberedOverrides).forEach(([key, value]) => {
          if (Object.prototype.hasOwnProperty.call(state.sliceProcessSettingsBase, key)) {
            rememberedForCurrent[key] = value;
          }
        });
        state.sliceProcessSettingsOverrides = rememberedForCurrent;
        renderSliceProcessSettingsList();
      } catch (processErr) {
        state.sliceProcessSettingsBase = {};
        state.sliceProcessSettingsBaseApi = {};
        state.sliceProcessSettingsOptions = {};
        state.sliceProcessSettingsOverrides = {};
        if (els.sliceProcessSettingsList) {
          els.sliceProcessSettingsList.innerHTML = "";
        }
        if (els.sliceProcessSettingsMeta) {
          els.sliceProcessSettingsMeta.textContent = "Kunne ikke indlæse process settings.";
        }
        showStatus(els.sliceProcessSettingsStatus, (processErr && processErr.message) || "Kunne ikke hente process settings", "error");
      }

      if (profiles.parse_error) {
        showStatus(els.sliceModalStatus, `Profil-læsning: ${profiles.parse_error}`, "error");
      } else {
        const totalProfiles = profiles.printers.length + profiles.print_profiles.length + profiles.filament_profiles.length;
        if (totalProfiles > 0) {
          showStatus(els.sliceModalStatus, "Profiler klar. Vælg og start slicing.", "ok");
        } else {
          showStatus(els.sliceModalStatus, "Ingen profiler fundet. Slicing kan stadig startes med standard config.", "ok");
        }
      }
      if (els.sliceModalStartBtn) els.sliceModalStartBtn.disabled = false;
    } catch (err) {
      renderSliceSelect(els.slicePrinterSelect, [], "Vælg printer", false);
      renderSliceSelect(els.slicePrintProfileSelect, [], "Auto / fra config");
      renderSliceSelect(els.sliceProcessProfileSelect, [], "Auto / fra config");
      renderSliceSelect(els.sliceFilamentProfileSelect, [], "Vælg filamentprofil", false);
      state.sliceProcessSettingsBase = {};
      state.sliceProcessSettingsBaseApi = {};
      state.sliceProcessSettingsOptions = {};
      state.sliceProcessSettingsOverrides = {};
      showStatus(els.sliceModalStatus, err.message || "Kunne ikke hente slice-profiler", "error");
      if (els.sliceModalStartBtn) els.sliceModalStartBtn.disabled = false;
      refreshSlicePreviewBedFromSelection();
      updateSliceNozzleUiForSelectedPrinter();
      if (els.sliceProcessSettingsMeta) {
        els.sliceProcessSettingsMeta.textContent = "Kunne ikke indlæse process settings.";
      }
      if (els.sliceProcessSettingsList) {
        els.sliceProcessSettingsList.innerHTML = "";
      }
    }

    setupSliceModalPreview(file).catch((err) => {
      setSlicePreviewFootprint(`Model footprint: Preview fejl (${String((err && err.message) || err || "ukendt")})`, "error");
      setSlicePreviewHeight(`Model Z: Preview fejl (${String((err && err.message) || err || "ukendt")})`, "error");
    });
  }

  function selectedSliceProfiles() {
    const printer_profile = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "").trim();
    const print_profile = String((els.slicePrintProfileSelect && els.slicePrintProfileSelect.value) || "").trim();
    const filament_profile = String((els.sliceFilamentProfileSelect && els.sliceFilamentProfileSelect.value) || "").trim();
    const support_mode = normalizeSliceSupportMode((els.sliceSupportModeSelect && els.sliceSupportModeSelect.value) || "auto");
    const support_type = support_mode === "on" ? normalizeSliceSupportType((els.sliceSupportTypeSelect && els.sliceSupportTypeSelect.value) || "") : "";
    const support_style = support_mode === "on" ? normalizeSliceSupportStyle((els.sliceSupportStyleSelect && els.sliceSupportStyleSelect.value) || "") : "";
    const usesDualNozzle = slicePrinterUsesDualNozzle(printer_profile);
    const nozzle_left_diameter = normalizeSliceNozzleDiameter((els.sliceNozzleLeftDiameterSelect && els.sliceNozzleLeftDiameterSelect.value) || "");
    const nozzle_right_diameter = usesDualNozzle
      ? normalizeSliceNozzleDiameter((els.sliceNozzleRightDiameterSelect && els.sliceNozzleRightDiameterSelect.value) || "")
      : "";
    const nozzle_left_flow = normalizeSliceNozzleFlow((els.sliceNozzleLeftFlowSelect && els.sliceNozzleLeftFlowSelect.value) || "");
    const nozzle_right_flow = usesDualNozzle
      ? normalizeSliceNozzleFlow((els.sliceNozzleRightFlowSelect && els.sliceNozzleRightFlowSelect.value) || "")
      : "";
    const print_nozzle = usesDualNozzle
      ? normalizeSlicePrintNozzle(state.lastSliceSelection && state.lastSliceSelection.print_nozzle)
      : "";
    const rotation = currentSliceRotation();
    const bed = resolveSelectedSliceBedSize();
    const settingsOverrides = state.sliceProcessSettingsOverrides && typeof state.sliceProcessSettingsOverrides === "object"
      ? state.sliceProcessSettingsOverrides
      : {};
    const apiBaseSettings = state.sliceProcessSettingsBaseApi && typeof state.sliceProcessSettingsBaseApi === "object"
      ? state.sliceProcessSettingsBaseApi
      : {};
    const normalizedOverrides = normalizeSliceProcessSettingsMap(settingsOverrides);
    const filteredOverrides = {};
    if (Object.keys(apiBaseSettings).length) {
      Object.entries(normalizedOverrides).forEach(([key, value]) => {
        if (Object.prototype.hasOwnProperty.call(apiBaseSettings, key)) {
          filteredOverrides[key] = value;
        }
      });

      const wallGeneratorApiValue = sliceProcessCurrentValueByCanonicalKey("wall_generator", apiBaseSettings, {});
      const wallGeneratorUiValue = sliceProcessCurrentValueByCanonicalKey("wall_generator", state.sliceProcessSettingsBase, settingsOverrides);
      if (
        typeof wallGeneratorUiValue === "string"
        && normalizeSliceProcessKey(wallGeneratorUiValue) === "classic"
        && typeof wallGeneratorApiValue === "string"
        && normalizeSliceProcessKey(wallGeneratorApiValue) === "auto"
      ) {
        const apiWallKey = Object.keys(apiBaseSettings).find((key) => canonicalSliceProcessKey(key) === "wall_generator");
        filteredOverrides[apiWallKey || "wall_generator"] = "classic";
      }
    }
    // Profiles are presets; slicing uses the effective process settings map.
    const process_overrides = Object.keys(apiBaseSettings).length
      ? { ...filteredOverrides }
      : { ...normalizedOverrides };
    if (!usesDualNozzle) {
      delete process_overrides.print_extruder_id;
      delete process_overrides.printer_extruder_id;
    }
    return {
      printer_profile,
      print_profile,
      filament_profile,
      support_mode,
      support_type,
      support_style,
      nozzle_left_diameter,
      nozzle_right_diameter,
      nozzle_left_flow,
      nozzle_right_flow,
      print_nozzle,
      rotation_x_degrees: rotation.x,
      rotation_y_degrees: rotation.y,
      rotation_z_degrees: rotation.z,
      lift_z_mm: 0,
      bed_width_mm: clampSliceBedSizeMm(bed && bed.width_mm, DEFAULT_SLICE_BED_SIZE_MM.width_mm),
      bed_depth_mm: clampSliceBedSizeMm(bed && bed.depth_mm, DEFAULT_SLICE_BED_SIZE_MM.depth_mm),
      process_overrides,
    };
  }

  function fileById(fileId) {
    const id = Number(fileId || 0);
    if (!id) return null;
    return state.files.find((f) => Number(f.id || 0) === id) || null;
  }

  function renderFileAttachments(items) {
    if (!els.fileInfoAttachList) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      els.fileInfoAttachList.innerHTML = `<div class="file-info-attach-empty">Ingen billeder tilknyttet denne fil endnu.</div>`;
      return;
    }
    els.fileInfoAttachList.innerHTML = `
      <div class="file-info-attach-grid">
        ${list
          .map((item) => {
            const contentUrl = String(item.content_url || "#");
            const name = String(item.original_name || "Billede");
            return `
              <button class="file-info-attach-card" type="button" data-image-url="${esc(contentUrl)}" data-image-name="${esc(name)}">
                <img src="${esc(contentUrl)}" alt="${esc(name)}" loading="lazy">
                <div class="file-info-attach-meta">
                  <div class="file-info-attach-name" title="${esc(name)}">${esc(name)}</div>
                  <div class="file-info-attach-sub">${formatSize(item.file_size)} · ${formatDate(item.uploaded_at)}</div>
                </div>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  async function loadFileAttachments(fileId) {
    const id = Number(fileId || 0);
    if (!id) return;
    const data = await api(`/api/files/${id}/attachments`);
    if (Number(state.currentInfoFileId || 0) !== id) return;
    state.currentFileAttachments = Array.isArray(data.items) ? data.items : [];
    renderFileAttachments(state.currentFileAttachments);
  }

  async function uploadFileAttachments(fileId, files) {
    const id = Number(fileId || 0);
    const uploadFiles = Array.from(files || []).filter(Boolean);
    if (!id || !uploadFiles.length) return;

    const form = new FormData();
    uploadFiles.forEach((file) => form.append("images", file));
    showStatus(els.fileInfoAttachStatus, `Uploader ${uploadFiles.length} billede(r)...`, "ok");
    const data = await api(`/api/files/${id}/attachments`, { method: "POST", body: form });
    const created = Number(data.created || 0);
    const skippedCount = Array.isArray(data.skipped) ? data.skipped.length : 0;
    let message = `${created} billede(r) uploadet.`;
    if (skippedCount > 0) {
      message += ` ${skippedCount} blev sprunget over.`;
    }
    showStatus(els.fileInfoAttachStatus, message, "ok");
    await loadFileAttachments(id);
  }

  function renderFileInfoDrawer(file) {
    if (!file || !els.fileInfoDrawer) return;
    const id = Number(file.id || 0);
    if (!id) return;

    if (els.fileInfoPreview) {
      els.fileInfoPreview.innerHTML = filePreviewHtml(file);
    }
    if (els.fileInfoName) els.fileInfoName.textContent = String(file.filename || "-");
    if (els.fileInfoMeta) {
      els.fileInfoMeta.textContent = `${formatSize(file.file_size)} · ${String(file.ext || "-")} · ${formatDate(file.uploaded_at)}`;
    }
    if (els.fileInfoFolder) els.fileInfoFolder.textContent = String(file.folder_path || "-");
    if (els.fileInfoExt) els.fileInfoExt.textContent = String(file.ext || "-");
    if (els.fileInfoSize) els.fileInfoSize.textContent = formatSize(file.file_size);
    if (els.fileInfoUploadedAt) els.fileInfoUploadedAt.textContent = formatDate(file.uploaded_at);
    if (els.fileInfoUploadedBy) els.fileInfoUploadedBy.textContent = String(file.uploaded_by || "-");
    const sliceSummary =
      file && file.slice_output && typeof file.slice_output === "object" && file.slice_output.summary && typeof file.slice_output.summary === "object"
        ? file.slice_output.summary
        : null;
    const printTimeTotal = String((sliceSummary && sliceSummary.print_time_total) || "").trim();

    if (els.fileInfoPrintTimeTotal) {
      els.fileInfoPrintTimeTotal.textContent = printTimeTotal || "-";
    }
    if (els.fileInfoRowPrintTimeTotal) {
      els.fileInfoRowPrintTimeTotal.classList.toggle("hidden", !printTimeTotal);
    }

    if (els.fileInfoFilamentGrams) {
      els.fileInfoFilamentGrams.textContent = "-";
    }
    if (els.fileInfoRowFilamentGrams) {
      els.fileInfoRowFilamentGrams.classList.add("hidden");
    }

    if (els.fileInfoFilamentCost) {
      els.fileInfoFilamentCost.textContent = "-";
    }
    if (els.fileInfoRowFilamentCost) {
      els.fileInfoRowFilamentCost.classList.add("hidden");
    }

    if (els.fileInfoNote) els.fileInfoNote.value = String(file.note || "");
    if (els.fileInfoDownloadLink) {
      els.fileInfoDownloadLink.href = String(file.download_url || "#");
    }
    if (els.fileInfoSliceDownloadLink) {
      const sliceOutput = file && file.slice_output && typeof file.slice_output === "object" ? file.slice_output : null;
      const downloadUrl = String((sliceOutput && sliceOutput.download_url) || "").trim();
      const hasSliceOutput = !!downloadUrl;
      els.fileInfoSliceDownloadLink.classList.toggle("hidden", !hasSliceOutput);
      if (hasSliceOutput) {
        const sizeValue = Number((sliceOutput && sliceOutput.file_size) || 0);
        const sizeLabel = sizeValue > 0 ? ` (${formatSize(sizeValue)})` : "";
        els.fileInfoSliceDownloadLink.href = downloadUrl;
        els.fileInfoSliceDownloadLink.textContent = `Download G-code${sizeLabel}`;
        els.fileInfoSliceDownloadLink.title = String((sliceOutput && sliceOutput.filename) || "G-code");
      } else {
        els.fileInfoSliceDownloadLink.href = "#";
        els.fileInfoSliceDownloadLink.textContent = "Download G-code";
        els.fileInfoSliceDownloadLink.removeAttribute("title");
      }
    }
    if (els.fileInfoOpen3DBtn) {
      els.fileInfoOpen3DBtn.classList.toggle("hidden", !file.is_3d_openable);
      els.fileInfoOpen3DBtn.dataset.fileId = String(id);
    }
    if (els.fileInfoSliceBtn) {
      const canSlice = state.role === "admin" && !!file.can_slice;
      const sliceStatus = normalizedSliceStatus(file);
      const isQueued = sliceStatus === "queued";
      const isBusy = sliceStatus === "queued" || sliceStatus === "processing";
      els.fileInfoSliceBtn.classList.toggle("hidden", !canSlice);
      els.fileInfoSliceBtn.disabled = !canSlice || isQueued || SLICE_ACTIONS_DISABLED;
      els.fileInfoSliceBtn.dataset.fileId = String(id);
      els.fileInfoSliceBtn.dataset.sliceStatus = sliceStatus;
      els.fileInfoSliceBtn.textContent = SLICE_ACTIONS_DISABLED ? "Slice slået fra" : sliceButtonLabelForStatus(sliceStatus);
      const errorMessage = String(file.slice_error || "").trim();
      if (SLICE_ACTIONS_DISABLED) {
        els.fileInfoSliceBtn.title = SLICE_DISABLED_TITLE;
      } else if (sliceStatus === "error" && errorMessage) {
        els.fileInfoSliceBtn.title = errorMessage;
      } else {
        els.fileInfoSliceBtn.removeAttribute("title");
      }
      if (els.fileInfoFastSliceBtn) {
        els.fileInfoFastSliceBtn.classList.toggle("hidden", !canSlice);
        els.fileInfoFastSliceBtn.disabled = !canSlice || isBusy || SLICE_ACTIONS_DISABLED;
        els.fileInfoFastSliceBtn.dataset.fileId = String(id);
        els.fileInfoFastSliceBtn.dataset.sliceStatus = sliceStatus;
        els.fileInfoFastSliceBtn.textContent = SLICE_ACTIONS_DISABLED ? "Fast slice slået fra" : "Fast slice";
        if (SLICE_ACTIONS_DISABLED) {
          els.fileInfoFastSliceBtn.title = SLICE_DISABLED_TITLE;
        } else if (canSlice && !isBusy) {
          els.fileInfoFastSliceBtn.title = "Starter slicing uden dialog, profiler eller ekstra settings";
        } else {
          els.fileInfoFastSliceBtn.removeAttribute("title");
        }
      }
    }
  }

  async function openFileInfoDrawer(fileId) {
    const file = fileById(fileId);
    if (!file) return;
    state.currentInfoFileId = Number(file.id || 0);
    renderFileInfoDrawer(file);
    state.currentFileAttachments = [];
    renderFileAttachments([]);
    showStatus(els.fileInfoAttachStatus, "");

    if (state.infoDrawerHideTimer) {
      clearTimeout(state.infoDrawerHideTimer);
      state.infoDrawerHideTimer = null;
    }

    if (els.fileInfoBackdrop) {
      els.fileInfoBackdrop.classList.remove("hidden");
      requestAnimationFrame(() => els.fileInfoBackdrop.classList.add("open"));
    }
    if (els.fileInfoDrawer) {
      els.fileInfoDrawer.classList.remove("hidden");
      els.fileInfoDrawer.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        els.fileInfoDrawer.classList.add("open");
        // Move slice status bar to the left when drawer opens
        const sliceBar = document.getElementById("sliceStatusBar");
        if (sliceBar) sliceBar.style.right = "450px";
      });
    }

    try {
      await loadFileAttachments(state.currentInfoFileId);
    } catch (err) {
      showStatus(els.fileInfoAttachStatus, err.message || "Kunne ikke hente billeder", "error");
    }
  }

  function closeFileInfoDrawer() {
    state.currentInfoFileId = 0;
    state.currentFileAttachments = [];
    renderFileAttachments([]);
    showStatus(els.fileInfoAttachStatus, "");
    if (els.fileInfoDrawer) {
      els.fileInfoDrawer.classList.remove("open");
      els.fileInfoDrawer.setAttribute("aria-hidden", "true");
    }
    if (els.fileInfoBackdrop) {
      els.fileInfoBackdrop.classList.remove("open");
    }
    // Move slice status bar back to the right when drawer closes
    const sliceBar = document.getElementById("sliceStatusBar");
    if (sliceBar) sliceBar.style.right = "20px";
    if (state.infoDrawerHideTimer) {
      clearTimeout(state.infoDrawerHideTimer);
    }
    state.infoDrawerHideTimer = setTimeout(() => {
      if (els.fileInfoDrawer) els.fileInfoDrawer.classList.add("hidden");
      if (els.fileInfoBackdrop) els.fileInfoBackdrop.classList.add("hidden");
      state.infoDrawerHideTimer = null;
    }, 200);
  }

  async function saveCurrentFileInfo() {
    const id = Number(state.currentInfoFileId || 0);
    if (!id) return;
    const note = String((els.fileInfoNote && els.fileInfoNote.value) || "");
    await api(`/api/files/${id}/metadata`, { method: "PATCH", body: { note } });
    showStatus(els.uploadStatus, "Bemærkning gemt.", "ok");
    await loadFiles();
  }

  async function sliceFileById(fileId, profileSelection = null) {
    const id = Number(fileId || 0);
    if (!id) return;
    if (SLICE_ACTIONS_DISABLED) {
      showStatus(els.uploadStatus, `${SLICE_DISABLED_TITLE}.`, "error");
      return;
    }
    const profiles = profileSelection && typeof profileSelection === "object" ? profileSelection : {};
    const body = {};
    const printerProfile = String(profiles.printer_profile || "").trim();
    const printProfile = String(profiles.print_profile || "").trim();
    const filamentProfile = String(profiles.filament_profile || "").trim();
    const supportMode = normalizeSliceSupportMode(profiles.support_mode || "auto");
    const supportType = supportMode === "on" ? normalizeSliceSupportType(profiles.support_type || "") : "";
    const supportStyle = supportMode === "on" ? normalizeSliceSupportStyle(profiles.support_style || "") : "";
    const nozzleLeftDiameter = normalizeSliceNozzleDiameter(profiles.nozzle_left_diameter || "");
    const nozzleRightDiameter = normalizeSliceNozzleDiameter(profiles.nozzle_right_diameter || "");
    const nozzleLeftFlow = normalizeSliceNozzleFlow(profiles.nozzle_left_flow || "");
    const nozzleRightFlow = normalizeSliceNozzleFlow(profiles.nozzle_right_flow || "");
    const printNozzle = normalizeSlicePrintNozzle(profiles.print_nozzle || "");
    const rotationX = clampSliceRotationDeg(profiles.rotation_x_degrees);
    const rotationY = clampSliceRotationDeg(profiles.rotation_y_degrees);
    const rotationZ = clampSliceRotationDeg(profiles.rotation_z_degrees);
    const liftZ = clampSliceLiftMm(profiles.lift_z_mm, 0);
    const bedWidth = clampSliceBedSizeMm(profiles.bed_width_mm, 0);
    const bedDepth = clampSliceBedSizeMm(profiles.bed_depth_mm, 0);
    const processOverridesRaw = profiles.process_overrides && typeof profiles.process_overrides === "object"
      ? normalizeSliceProcessSettingsMap(profiles.process_overrides)
      : {};
    const processOverrides = { ...processOverridesRaw };
    if (printNozzle) {
      processOverrides.print_extruder_id = printNozzle === "right" ? 2 : 1;
    }
    if (printerProfile) body.printer_profile = printerProfile;
    if (printProfile) body.print_profile = printProfile;
    if (filamentProfile) body.filament_profile = filamentProfile;
    body.support_mode = supportMode;
    if (supportType) body.support_type = supportType;
    if (supportStyle) body.support_style = supportStyle;
    if (nozzleLeftDiameter) body.nozzle_left_diameter = nozzleLeftDiameter;
    if (nozzleRightDiameter) body.nozzle_right_diameter = nozzleRightDiameter;
    if (nozzleLeftFlow) body.nozzle_left_flow = nozzleLeftFlow;
    if (nozzleRightFlow) body.nozzle_right_flow = nozzleRightFlow;
    if (printNozzle) body.print_nozzle = printNozzle;
    body.rotation_x_degrees = rotationX;
    body.rotation_y_degrees = rotationY;
    body.rotation_z_degrees = rotationZ;
    body.lift_z_mm = liftZ;
    if (bedWidth > 0) body.bed_width_mm = bedWidth;
    if (bedDepth > 0) body.bed_depth_mm = bedDepth;
    if (Object.keys(processOverrides).length) body.process_overrides = processOverrides;
    const options = { method: "POST" };
    if (Object.keys(body).length) options.body = body;
    const data = await api(`/api/files/${id}/slice`, options);
    if (data && data.already_running) {
      showStatus(els.uploadStatus, "Slicing kører allerede for filen.", "ok");
    } else {
      showStatus(els.uploadStatus, "Slicing sat i kø.", "ok");
    }
    await loadFiles();
  }

  async function fastSliceFileById(fileId) {
    const id = Number(fileId || 0);
    if (!id) return;
    if (SLICE_ACTIONS_DISABLED) {
      showStatus(els.uploadStatus, `${SLICE_DISABLED_TITLE}.`, "error");
      return;
    }
    const data = await api(`/api/files/${id}/slice`, {
      method: "POST",
      body: { fast_slice: true },
    });
    if (data && data.already_running) {
      showStatus(els.uploadStatus, "Slicing kører allerede for filen.", "ok");
    } else {
      showStatus(els.uploadStatus, "Fast slice sat i kø.", "ok");
    }
    await loadFiles();
  }

  function renderFiles() {
    if (!els.fileGrid) return;
    if (!state.files.length) {
      const folder = currentFolder() || state.homeFolder || "";
      const hasChildFolders = listDirectChildren(folder).length > 0;
      els.fileGrid.innerHTML = hasChildFolders
        ? ""
        : `<div class="panel"><p class="hint">Ingen filer eller mapper i denne mappe endnu.</p></div>`;
      if (state.currentInfoFileId) {
        closeFileInfoDrawer();
      }
      syncThumbPoller();
      updateThumbTopStatus();
      updateStats();
      return;
    }

    const html = state.files
      .map((file) => {
        const id = Number(file.id || 0);
        const isSelected = isFileEffectivelySelected(file);
        const sliceBadge = sliceBadgeHtml(file);
        const isNew = state.role === "admin" && !!file.is_new;
        const newBadge = isNew ? '<span class="file-new-badge" title="Ny fil">Ny</span>' : "";
        return `
          <article class="file-card file-card-compact ${isSelected ? "selected" : ""}" data-file-id="${id}">
            <div class="file-preview">
              <span class="select-mark ${isSelected ? "selected" : ""}"></span>
              ${newBadge}
              <button class="file-info-btn" data-action="open-info" data-file-id="${id}" aria-label="Vis fil-info">i</button>
              ${sliceBadge}
              ${filePreviewHtml(file)}
            </div>
            <div class="file-caption" title="${esc(file.filename)}"><span class="hover-scroll-text">${esc(file.filename)}</span></div>
          </article>
        `;
      })
      .join("");
    els.fileGrid.innerHTML = html;

    bindHoverMarqueeCards(els.fileGrid, ".file-card", ".file-caption");

    pruneSelections();

    if (state.currentInfoFileId) {
      const selected = fileById(state.currentInfoFileId);
      if (selected) renderFileInfoDrawer(selected);
      else closeFileInfoDrawer();
    }

    updateSelectModeUi();
    syncThumbPoller();
    updateThumbTopStatus();
    updateStats();
  }

  function thumbQueueStats() {
    let total = 0;
    let ready = 0;
    let queued = 0;
    let processing = 0;
    let error = 0;
    let cancelled = 0;

    for (const f of state.files) {
      if (!f || !f.thumb_supported) continue;
      total += 1;
      const status = String(f.thumb_status || "").toLowerCase();
      if (f.thumb_url || status === "ready") {
        ready += 1;
      } else if (status === "processing") {
        processing += 1;
      } else if (status === "queued") {
        queued += 1;
      } else if (status === "error") {
        error += 1;
      } else if (status === "cancelled") {
        cancelled += 1;
      } else {
        queued += 1;
      }
    }

    const pending = queued + processing;
    const done = ready + error + cancelled;
    const progress = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
    return { total, ready, queued, processing, error, cancelled, pending, done, progress };
  }

  function zipQueueStats() {
    let total = 0;
    let queued = 0;
    let processing = 0;
    let done = 0;
    let error = 0;

    for (const job of Array.isArray(state.zipJobs) ? state.zipJobs : []) {
      if (!job || typeof job !== "object") continue;
      total += 1;
      const status = String(job.status || "queued").toLowerCase();
      if (status === "processing") processing += 1;
      else if (status === "queued") queued += 1;
      else if (status === "error") error += 1;
      else done += 1;
    }

    const pending = queued + processing;
    const progress = total > 0 ? Math.max(0, Math.min(100, Math.round(((done + error) / total) * 100))) : 0;
    return { total, queued, processing, done, error, pending, progress };
  }

  function sliceQueueStats() {
    let total = 0;
    let queued = 0;
    let processing = 0;
    let ready = 0;
    let error = 0;

    for (const file of Array.isArray(state.files) ? state.files : []) {
      if (!file || !file.can_slice) continue;
      const status = normalizedSliceStatus(file);
      if (status === "none") continue;
      total += 1;
      if (status === "queued") queued += 1;
      else if (status === "processing") processing += 1;
      else if (status === "ready") ready += 1;
      else if (status === "error") error += 1;
    }

    const pending = queued + processing;
    const done = ready + error;
    const progress = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
    return { total, queued, processing, ready, error, pending, done, progress };
  }

  function clearSliceStatusHideTimer() {
    if (!state.sliceStatusHideTimer) return;
    window.clearTimeout(state.sliceStatusHideTimer);
    state.sliceStatusHideTimer = null;
  }

  function clearTopStatusFadeTimer() {
    if (!state.topStatusFadeTimer) return;
    window.clearTimeout(state.topStatusFadeTimer);
    state.topStatusFadeTimer = null;
  }

  function setThumbTopStatusVisible(visible, fade = false) {
    if (!els.thumbTopStatus) return;
    if (visible) {
      clearTopStatusFadeTimer();
      els.thumbTopStatus.classList.remove("hidden", "fading");
      return;
    }

    if (fade && !els.thumbTopStatus.classList.contains("hidden")) {
      clearTopStatusFadeTimer();
      els.thumbTopStatus.classList.add("fading");
      state.topStatusFadeTimer = window.setTimeout(() => {
        if (!els.thumbTopStatus) return;
        els.thumbTopStatus.classList.add("hidden");
        els.thumbTopStatus.classList.remove("fading");
        state.topStatusFadeTimer = null;
      }, 260);
      return;
    }

    clearTopStatusFadeTimer();
    els.thumbTopStatus.classList.add("hidden");
    els.thumbTopStatus.classList.remove("fading");
  }

  function updateThumbTopStatus() {
    if (!els.thumbTopStatus || !els.thumbTopStatusLabel || !els.thumbTopStatusBar) return;
    const stats = thumbQueueStats();
    const zipStats = zipQueueStats();
    const sliceStats = sliceQueueStats();

    const now = Date.now();
    if (sliceStats.pending > 0) {
      state.sliceStatusWasPending = true;
      state.sliceStatusHoldUntil = 0;
      clearSliceStatusHideTimer();
    } else if (state.sliceStatusWasPending) {
      state.sliceStatusWasPending = false;
      state.sliceStatusHoldUntil = now + 10000;
      clearSliceStatusHideTimer();
      state.sliceStatusHideTimer = window.setTimeout(() => {
        state.sliceStatusHoldUntil = 0;
        state.sliceStatusHideTimer = null;
        state.sliceStatusFadePulse = Date.now();
        updateThumbTopStatus();
      }, 10040);
    }

    const sliceHoldActive = Number(state.sliceStatusHoldUntil || 0) > now;
    const showSliceStatus = sliceStats.pending > 0 || sliceHoldActive;
    const shouldShow = stats.pending > 0
      || stats.error > 0
      || zipStats.pending > 0
      || zipStats.error > 0
      || showSliceStatus;

    if (!shouldShow) {
      const shouldFadeHide = Number(state.sliceStatusFadePulse || 0) > 0
        && (now - Number(state.sliceStatusFadePulse || 0)) <= 1200;
      setThumbTopStatusVisible(false, shouldFadeHide);
      state.sliceStatusFadePulse = 0;
      if (els.thumbTopStatusCancelBtn) {
        els.thumbTopStatus.classList.remove("can-cancel-thumb", "is-cancelling-thumb");
        els.thumbTopStatusCancelBtn.classList.add("hidden");
        els.thumbTopStatusCancelBtn.disabled = true;
        els.thumbTopStatusCancelBtn.textContent = "Annuller";
      }
      els.thumbTopStatusLabel.textContent = "Thumbnails: Klar";
      els.thumbTopStatusBar.classList.remove("indeterminate");
      els.thumbTopStatusBar.style.width = "0%";
      return;
    }

    state.sliceStatusFadePulse = 0;
    setThumbTopStatusVisible(true, false);

    const canCancelThumbs = state.role === "admin" && stats.pending > 0;
    if (els.thumbTopStatusCancelBtn) {
      els.thumbTopStatus.classList.toggle("can-cancel-thumb", canCancelThumbs && !state.thumbTopStatusCancelling);
      els.thumbTopStatus.classList.toggle("is-cancelling-thumb", !!state.thumbTopStatusCancelling);
      els.thumbTopStatusCancelBtn.classList.toggle("hidden", !canCancelThumbs && !state.thumbTopStatusCancelling);
      els.thumbTopStatusCancelBtn.disabled = !canCancelThumbs || !!state.thumbTopStatusCancelling;
      els.thumbTopStatusCancelBtn.textContent = state.thumbTopStatusCancelling ? "Annullerer..." : "Annuller";
    }

    const labels = [];
    if (zipStats.pending > 0 || zipStats.error > 0) {
      let zipLabel = `ZIP udpakning: ${zipStats.done}/${zipStats.total} færdig`;
      if (zipStats.processing > 0) zipLabel += ` · ${zipStats.processing} behandler`;
      if (zipStats.queued > 0) zipLabel += ` · ${zipStats.queued} i kø`;
      if (zipStats.error > 0) zipLabel += ` · fejl: ${zipStats.error}`;
      labels.push(zipLabel);
    }

    if (showSliceStatus && sliceStats.total > 0) {
      let sliceLabel = `Slicing: ${sliceStats.ready}/${sliceStats.total} færdig`;
      if (sliceStats.pending > 0) {
        if (sliceStats.processing > 0) sliceLabel += ` · ${sliceStats.processing} behandler`;
        if (sliceStats.queued > 0) sliceLabel += ` · ${sliceStats.queued} i kø`;
        if (sliceStats.error > 0) sliceLabel += ` · fejl: ${sliceStats.error}`;
      } else if (sliceStats.error > 0) {
        sliceLabel += ` · fejl: ${sliceStats.error}`;
      } else {
        sliceLabel += " · klar";
      }
      labels.push(sliceLabel);
    }

    if (stats.total > 0 || stats.pending > 0 || stats.error > 0) {
      if (stats.pending > 0) {
        let thumbLabel = `Thumbnails: ${stats.ready}/${stats.total} klar`;
        if (stats.processing > 0) thumbLabel += ` · ${stats.processing} behandler`;
        if (stats.queued > 0) thumbLabel += ` · ${stats.queued} i kø`;
        if (stats.error > 0) thumbLabel += ` · fejl: ${stats.error}`;
        labels.push(thumbLabel);
      } else if (stats.error > 0) {
        labels.push(`Thumbnails færdig · fejl: ${stats.error}`);
      }
    }

    els.thumbTopStatusLabel.textContent = labels.length ? labels.join(" · ") : "Baggrundsjob kører";

    const useIndeterminate = (stats.pending > 0 && stats.progress <= 0)
      || (zipStats.pending > 0 && zipStats.progress <= 0)
      || (showSliceStatus && sliceStats.pending > 0 && sliceStats.progress <= 0);
    els.thumbTopStatusBar.classList.toggle("indeterminate", useIndeterminate);
    if (!useIndeterminate) {
      const progressValues = [];
      if (stats.total > 0 && (stats.pending > 0 || stats.error > 0)) progressValues.push(stats.progress);
      if (zipStats.total > 0 && (zipStats.pending > 0 || zipStats.error > 0)) progressValues.push(zipStats.progress);
      if (showSliceStatus && sliceStats.total > 0) {
        progressValues.push(sliceStats.progress);
      }
      const mergedProgress = progressValues.length
        ? Math.round(progressValues.reduce((sum, value) => sum + Number(value || 0), 0) / progressValues.length)
        : 0;
      els.thumbTopStatusBar.style.width = `${Math.max(0, Math.min(100, Number(mergedProgress || 0)))}%`;
    }
  }

  function cancellableThumbFileIds() {
    const ids = [];
    for (const file of Array.isArray(state.files) ? state.files : []) {
      if (!file || !file.thumb_supported) continue;
      const status = String(file.thumb_status || "none").trim().toLowerCase();
      if (status !== "queued" && status !== "processing") continue;
      const id = Number(file.id || 0);
      if (!id || ids.includes(id)) continue;
      ids.push(id);
    }
    return ids;
  }

  async function cancelTopThumbGeneration() {
    if (state.thumbTopStatusCancelling) return;
    if (state.role !== "admin") return;

    const fileIds = cancellableThumbFileIds();
    if (!fileIds.length) {
      showStatus(els.uploadStatus, "Ingen aktive thumbnail-jobs at annullere.", "ok");
      updateThumbTopStatus();
      return;
    }

    state.thumbTopStatusCancelling = true;
    updateThumbTopStatus();
    try {
      const data = await api("/api/files/thumbnails/cancel", {
        method: "POST",
        body: { file_ids: fileIds },
      });
      const cancelledCount = Number((data && data.cancelled) || 0);
      if (cancelledCount > 0) {
        const suffix = cancelledCount === 1 ? "" : "er";
        showStatus(els.uploadStatus, `Thumbnail-generering annulleret for ${cancelledCount} fil${suffix}.`, "ok");
      } else {
        showStatus(els.uploadStatus, "Ingen aktive thumbnail-jobs at annullere.", "ok");
      }
      await loadFiles();
    } finally {
      state.thumbTopStatusCancelling = false;
      updateThumbTopStatus();
    }
  }

  function hasPendingThumbs() {
    return thumbQueueStats().pending > 0 || zipQueueStats().pending > 0 || sliceQueueStats().pending > 0;
  }

  function syncThumbPoller() {
    const needPoll = hasPendingThumbs();
    if (needPoll && !state.thumbPollTimer) {
      state.thumbPollTimer = window.setInterval(() => {
        loadFiles().catch(() => {});
      }, 5000);
      return;
    }
    if (!needPoll && state.thumbPollTimer) {
      window.clearInterval(state.thumbPollTimer);
      state.thumbPollTimer = null;
    }
  }

  async function loadFiles() {
    clearNewUploadsDwellTimer();
    const folder = currentFolder() || state.homeFolder || "";
    state.currentFolder = folder;
    if (els.folderSelect && folder) {
      els.folderSelect.value = folder;
    }
    const data = await api(`/api/files?folder=${encodeURIComponent(folder)}`);
    state.files = Array.isArray(data.items) ? data.items : [];
    state.zipJobs = Array.isArray(data.zip_jobs) ? data.zip_jobs : [];
    state.folderPreviewCache[String(folder || "")] = buildFolderPreviewEntry(state.files);
    renderFiles();
    renderFolderBrowser();
    updateFolderUiState();
    scheduleNewUploadsDwellSeen();
    if (state.role === "admin") {
      loadUnseenUploadsSummary().catch(() => {});
    }
  }

  function makeClientUploadId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function uploadSingleTus(file, folder, baseFolder, clientUploadId, onProgress) {
    return new Promise((resolve, reject) => {
      if (!(window.tus && typeof window.tus.Upload === "function")) {
        reject(new Error("tus-js-client er ikke tilgængelig"));
        return;
      }
      let settled = false;
      const finishResolve = (value) => {
        if (settled) return;
        settled = true;
        activeTusUpload = null;
        resolve(value);
      };
      const finishReject = (error) => {
        if (settled) return;
        settled = true;
        activeTusUpload = null;
        reject(error);
      };
      const upload = new window.tus.Upload(file, {
        endpoint: "/api/upload/tus",
        chunkSize: 8 * 1024 * 1024,
        retryDelays: [0, 1500, 3000, 5000],
        removeFingerprintOnSuccess: true,
        metadata: {
          filename: file.name,
          folder: folder,
          baseFolder: baseFolder || folder,
          lastModified: String(file.lastModified || 0),
          clientUploadId: clientUploadId,
        },
        onError: (error) => finishReject(error),
        onProgress: (uploadedBytes, totalBytes) => {
          if (typeof onProgress === "function") onProgress(uploadedBytes, totalBytes);
        },
        onSuccess: () => finishResolve({ file, clientUploadId }),
      });
      activeTusUpload = upload;
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads && previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      }).catch(() => upload.start());
    });
  }

  async function resolveUploadedItems(uploadedItems) {
    const resolved = [];
    for (const item of uploadedItems) {
      try {
        const data = await api(`/api/files/by-upload-client/${encodeURIComponent(item.clientUploadId)}`);
        if (data && data.item) {
          resolved.push(data.item);
        }
      } catch (_err) {
        // ignore single lookup errors
      }
    }
    return resolved;
  }

  function getMetadataCurrentItem() {
    if (!Array.isArray(state.pendingMetadata) || !state.pendingMetadata.length) return null;
    const lastIndex = state.pendingMetadata.length - 1;
    const idx = Math.max(0, Math.min(lastIndex, Number(state.metadataIndex || 0)));
    state.metadataIndex = idx;
    return state.pendingMetadata[idx] || null;
  }

  function isPrintReadyMetadataMode() {
    return state.metadataMode === "print-ready";
  }

  function metadataAttachmentFileId(item) {
    return Number((item && item.file_id) || (item && item.id) || 0);
  }

  function syncMetadataModeUi() {
    const printMode = isPrintReadyMetadataMode();
    if (els.metadataModal) {
      els.metadataModal.classList.toggle("metadata-note-only", !printMode);
    }
    if (els.metadataModalTitle) {
      els.metadataModalTitle.textContent = printMode ? "Printdetaljer pr. fil" : "Tilføj bemærkning og billeder";
    }
    if (els.metadataModalHint) {
      els.metadataModalHint.textContent = printMode
        ? "Tjek hver fil før projektet sendes til print."
        : "Skriv en bemærkning og tilføj billeder til den uploadede fil.";
    }
    if (els.metadataSaveBtn) {
      els.metadataSaveBtn.textContent = printMode ? "Gem og se projekt" : "Gem";
    }
    if (els.metadataCancelBtn) {
      els.metadataCancelBtn.textContent = printMode ? "Spring over og se projekt" : "Spring over";
      els.metadataCancelBtn.classList.toggle("hidden", printMode);
    }
  }

  function persistMetadataStepInputs() {
    const item = getMetadataCurrentItem();
    if (!item) return;
    if (els.metadataNoteInput) {
      item.note = String(els.metadataNoteInput.value || "");
    }
    if (isPrintReadyMetadataMode() && els.metadataQtyInput) {
      item.quantity = Math.max(1, Number(els.metadataQtyInput.value || 1) || 1);
      item.scale_up_enabled = !!(els.metadataScaleUpEnabled && els.metadataScaleUpEnabled.checked);
      item.scale_up_value = String((els.metadataScaleUpValue && els.metadataScaleUpValue.value) || "");
      item.scale_up_unit = scaleUpUnit(els.metadataScaleUpUnit && els.metadataScaleUpUnit.value);
    }
  }

  function renderMetadataAttachments(items) {
    if (!els.metadataAttachList) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      els.metadataAttachList.innerHTML = `<div class="file-info-attach-empty">Ingen billeder tilknyttet denne fil endnu.</div>`;
      return;
    }
    els.metadataAttachList.innerHTML = `
      <div class="file-info-attach-grid">
        ${list
          .map((item) => {
            const contentUrl = String(item.content_url || "#");
            const name = String(item.original_name || "Billede");
            return `
              <button class="file-info-attach-card" type="button" data-image-url="${esc(contentUrl)}" data-image-name="${esc(name)}">
                <img src="${esc(contentUrl)}" alt="${esc(name)}" loading="lazy">
                <div class="file-info-attach-meta">
                  <div class="file-info-attach-name" title="${esc(name)}">${esc(name)}</div>
                  <div class="file-info-attach-sub">${formatSize(item.file_size)} · ${formatDate(item.uploaded_at)}</div>
                </div>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  async function loadMetadataAttachments(fileId) {
    const id = Number(fileId || 0);
    if (!id) return;
    const data = await api(`/api/files/${id}/attachments`);
    const current = getMetadataCurrentItem();
    if (!current || metadataAttachmentFileId(current) !== id) return;
    current.attachments = Array.isArray(data.items) ? data.items : [];
    if (isPrintReadyMetadataMode() && state.metadataContinueProject && Array.isArray(state.metadataContinueProject.files)) {
      const projectFileId = Number(current.project_file_id || current.id || 0);
      const projectFile = state.metadataContinueProject.files.find((file) => Number(file && file.id ? file.id : 0) === projectFileId);
      if (projectFile) {
        projectFile.attachments = current.attachments;
      }
    }
    renderMetadataAttachments(current.attachments);
  }

  async function uploadMetadataAttachments(fileId, files) {
    const id = Number(fileId || 0);
    const uploadFiles = Array.from(files || []).filter(Boolean);
    if (!id || !uploadFiles.length) return;

    const form = new FormData();
    uploadFiles.forEach((file) => form.append("images", file));
    showStatus(els.metadataAttachStatus, `Uploader ${uploadFiles.length} billede(r)...`, "ok");
    const data = await api(`/api/files/${id}/attachments`, { method: "POST", body: form });
    const created = Number(data.created || 0);
    const skippedCount = Array.isArray(data.skipped) ? data.skipped.length : 0;
    let message = `${created} billede(r) uploadet.`;
    if (skippedCount > 0) {
      message += ` ${skippedCount} blev sprunget over.`;
    }
    showStatus(els.metadataAttachStatus, message, "ok");
    await loadMetadataAttachments(id);
  }

  function renderMetadataStep() {
    const item = getMetadataCurrentItem();
    if (!item) {
      closeMetadataModal();
      return;
    }

    syncMetadataModeUi();
    const printMode = isPrintReadyMetadataMode();
    const total = state.pendingMetadata.length;
    const current = Number(state.metadataIndex || 0) + 1;
    if (els.metadataStepCounter) {
      els.metadataStepCounter.textContent = `${current}/${total}`;
    }
    if (els.metadataCurrentFileName) {
      const filename = String(item.filename || `Fil ${current}`);
      const displayPath = String(item.display_path || item.folder_path || "").trim();
      els.metadataCurrentFileName.textContent = printMode && displayPath ? `${filename} · ${displayPath}` : filename;
    }
    if (els.metadataNoteInput) {
      els.metadataNoteInput.value = String(item.note || "");
    }
    if (printMode && els.metadataQtyInput) {
      els.metadataQtyInput.value = String(Math.max(1, Number(item.quantity || 1) || 1));
    }
    if (printMode && els.metadataScaleUpValue) {
      els.metadataScaleUpValue.value = String(item.scale_up_value || "");
    }
    if (printMode && els.metadataScaleUpUnit) {
      els.metadataScaleUpUnit.value = scaleUpUnit(item.scale_up_unit);
    }
    setScaleUpControls(
      els.metadataScaleUpEnabled,
      els.metadataScaleUpControls,
      els.metadataScaleUpValue,
      els.metadataScaleUpUnit,
      printMode && !!item.scale_up_enabled
    );

    const hasMultiple = total > 1;
    const isFirst = current <= 1;
    const isLast = current >= total;

    if (els.metadataPrevBtn) {
      els.metadataPrevBtn.classList.toggle("hidden", !hasMultiple);
      els.metadataPrevBtn.disabled = isFirst;
    }
    if (els.metadataNextBtn) {
      els.metadataNextBtn.classList.toggle("hidden", !hasMultiple || isLast);
      els.metadataNextBtn.disabled = isLast;
    }
    if (els.metadataSaveBtn) {
      els.metadataSaveBtn.classList.toggle("hidden", !isLast);
    }

    renderMetadataAttachments(item.attachments || []);
    showStatus(els.metadataAttachStatus, "");
    loadMetadataAttachments(metadataAttachmentFileId(item)).catch((err) => {
      showStatus(els.metadataAttachStatus, err.message || "Kunne ikke hente billeder", "error");
    });
  }

  function moveMetadataStep(offset) {
    if (!Array.isArray(state.pendingMetadata) || !state.pendingMetadata.length) return;
    persistMetadataStepInputs();
    const total = state.pendingMetadata.length;
    const next = Math.max(0, Math.min(total - 1, Number(state.metadataIndex || 0) + Number(offset || 0)));
    if (next === Number(state.metadataIndex || 0)) return;
    state.metadataIndex = next;
    renderMetadataStep();
  }

  function openMetadataModal(files, options = {}) {
    const list = Array.isArray(files) ? files : [];
    const mode = String((options && options.mode) || "upload") === "print-ready" ? "print-ready" : "upload";
    state.metadataMode = mode;
    state.metadataProjectId = Number((options && options.projectId) || 0);
    state.metadataContinueProject = (options && options.continueProject) || null;
    state.pendingMetadata = list
      .map((file) => {
        const projectFileId = Number(file && file.id ? file.id : 0);
        const fileId = Number(mode === "print-ready" ? (file && file.file_id) : projectFileId);
        if (!projectFileId || !fileId) return null;
        return {
          ...file,
          id: projectFileId,
          project_file_id: mode === "print-ready" ? projectFileId : 0,
          file_id: fileId,
          note: String((file && file.note) || ""),
          quantity: Math.max(1, Number((file && file.quantity) || 1) || 1),
          scale_up_enabled: !!(file && file.scale_up_enabled),
          scale_up_value: String((file && file.scale_up_value) || ""),
          scale_up_unit: scaleUpUnit(file && file.scale_up_unit),
          attachments: Array.isArray(file && file.attachments) ? file.attachments : [],
        };
      })
      .filter(Boolean);
    state.metadataIndex = 0;

    if (!state.pendingMetadata.length || !els.metadataModal) {
      const continueProject = state.metadataContinueProject;
      state.metadataMode = "upload";
      state.metadataProjectId = 0;
      state.metadataContinueProject = null;
      if (mode === "print-ready" && continueProject) {
        openPrintReadyModal(continueProject);
      }
      return false;
    }
    syncMetadataModeUi();
    if (els.metadataAttachInput) els.metadataAttachInput.value = "";
    showStatus(els.metadataAttachStatus, "");
    els.metadataModal.classList.remove("hidden");
    renderMetadataStep();
    return true;
  }

  function closeMetadataModal(options = {}) {
    const shouldContinue = options && Object.prototype.hasOwnProperty.call(options, "continueFlow")
      ? !!options.continueFlow
      : isPrintReadyMetadataMode();
    const continueProject = state.metadataContinueProject;
    state.pendingMetadata = [];
    state.metadataIndex = 0;
    state.metadataMode = "upload";
    state.metadataProjectId = 0;
    state.metadataContinueProject = null;
    if (els.metadataAttachInput) els.metadataAttachInput.value = "";
    showStatus(els.metadataAttachStatus, "");
    renderMetadataAttachments([]);
    if (els.metadataModal) {
      els.metadataModal.classList.remove("metadata-note-only");
      els.metadataModal.classList.add("hidden");
    }
    if (shouldContinue && continueProject) {
      openPrintReadyModal(continueProject);
    }
  }

  function openImagePreviewModal(imageUrl, imageName = "Billede") {
    const url = String(imageUrl || "").trim();
    if (!url || !els.imagePreviewModal || !els.imagePreviewImg) return;
    const name = String(imageName || "Billede").trim() || "Billede";
    els.imagePreviewImg.src = url;
    els.imagePreviewImg.alt = name;
    if (els.imagePreviewTitle) {
      els.imagePreviewTitle.textContent = name;
    }
    els.imagePreviewModal.classList.remove("hidden");
  }

  function closeImagePreviewModal() {
    if (!els.imagePreviewModal) return;
    els.imagePreviewModal.classList.add("hidden");
    if (els.imagePreviewImg) {
      els.imagePreviewImg.removeAttribute("src");
      els.imagePreviewImg.alt = "Billede";
    }
    if (els.imagePreviewTitle) {
      els.imagePreviewTitle.textContent = "Billede";
    }
  }

  async function saveBatchMetadata() {
    if (!state.pendingMetadata.length) {
      closeMetadataModal();
      return;
    }

    persistMetadataStepInputs();
    if (isPrintReadyMetadataMode()) {
      const projectId = Number(state.metadataProjectId || 0);
      if (!projectId) throw new Error("Projektet mangler");
      const items = state.pendingMetadata.map((file) => {
        const scaleUpEnabled = !!file.scale_up_enabled;
        return {
          project_file_id: Number(file.project_file_id || file.id || 0),
          note: String(file.note || ""),
          quantity: Math.max(1, Number(file.quantity || 1) || 1),
          scale_up_enabled: scaleUpEnabled,
          scale_up_value: scaleUpEnabled ? normalizeScaleUpValue(file.scale_up_value) : "",
          scale_up_unit: scaleUpUnit(file.scale_up_unit),
        };
      });
      const data = await api(`/api/print-ready/${projectId}/metadata-batch`, { method: "POST", body: { items } });
      const project = data && data.project ? data.project : state.metadataContinueProject;
      state.metadataContinueProject = project;
      closeMetadataModal({ continueFlow: true });
      showStatus(els.uploadStatus, "Printdetaljer gemt.", "ok");
      return;
    }

    const items = state.pendingMetadata.map((file) => ({
      file_id: metadataAttachmentFileId(file),
      note: String(file.note || ""),
    }));
    await api("/api/files/metadata-batch", { method: "POST", body: { items } });
    closeMetadataModal({ continueFlow: false });
    await loadFiles();
    showStatus(els.uploadStatus, "Bemærkning gemt for de uploadede filer.", "ok");
  }

  async function _readDirectoryEntriesRecursive(entry, basePath) {
    const out = [];
    if (!entry) return out;

    if (entry.isFile) {
      let file = null;
      try {
        file = await new Promise((resolve, reject) => {
          entry.file(resolve, reject);
        });
      } catch {
        file = null;
      }
      if (file) {
        const relPath = basePath ? `${basePath}/${file.name}` : String(file.name || "");
        out.push({ file, relPath });
      }
      return out;
    }

    if (!entry.isDirectory) {
      return out;
    }

    const dirName = String(entry.name || "").trim();
    const nextBase = dirName ? (basePath ? `${basePath}/${dirName}` : dirName) : basePath;
    const reader = entry.createReader();

    while (true) {
      let batch = [];
      try {
        batch = await new Promise((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
      } catch {
        batch = [];
      }
      if (!batch || !batch.length) break;
      for (const child of batch) {
        const nested = await _readDirectoryEntriesRecursive(child, nextBase);
        out.push(...nested);
      }
    }

    return out;
  }

  async function collectDroppedFilesWithPaths(dataTransfer) {
    const result = [];
    try {
      const items = dataTransfer && dataTransfer.items ? Array.from(dataTransfer.items) : [];
      const entries = [];
      for (const item of items) {
        try {
          if (item && item.kind === "file" && typeof item.webkitGetAsEntry === "function") {
            const entry = item.webkitGetAsEntry();
            if (entry) entries.push(entry);
          }
        } catch {
          // ignore
        }
      }
      if (entries.length) {
        for (const entry of entries) {
          const parts = await _readDirectoryEntriesRecursive(entry, "");
          result.push(...parts);
        }
        if (result.length) return result;
      }
    } catch {
      // ignore
    }

    const files = dataTransfer && dataTransfer.files ? Array.from(dataTransfer.files) : [];
    for (const file of files) {
      const rel = String(file.webkitRelativePath || file.relativePath || file.name || "").trim() || file.name;
      result.push({ file, relPath: rel });
    }
    return result;
  }

  function groupDroppedFilesByRelativeDir(fileItems) {
    const groups = new Map();
    for (const item of fileItems || []) {
      const file = item && item.file;
      if (!(file instanceof File)) continue;
      const relPath = String((item && item.relPath) || "").replace(/\\/g, "/");
      const parts = relPath.split("/").filter(Boolean);
      const relDir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
      if (!groups.has(relDir)) groups.set(relDir, []);
      groups.get(relDir).push(file);
    }
    return groups;
  }

  async function uploadDroppedDataTransfer(dataTransfer, baseFolder) {
    const base = String(baseFolder || "").trim();
    if (!base) {
      showStatus(els.uploadStatus, "Vælg en mappe før upload.", "error");
      return;
    }
    if (!folderAllowsUserWrites(base)) {
      showStatus(els.uploadStatus, "Upload kan kun ske inde i en datomappe.", "error");
      return;
    }

    const droppedItems = await collectDroppedFilesWithPaths(dataTransfer);
    if (!droppedItems.length) return;

    const groups = groupDroppedFilesByRelativeDir(droppedItems);
    const uploadItems = [];
    for (const [relDir, files] of groups.entries()) {
      const cleanDir = String(relDir || "").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
      const targetFolder = cleanDir ? `${base}/${cleanDir}` : base;
      for (const file of files) {
        uploadItems.push({ file, folder: targetFolder, baseFolder: base });
      }
    }

    if (!uploadItems.length) return;
    await startUpload(uploadItems);
  }

  async function startUpload(files) {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    const fallbackFolder = String(currentFolder() || state.homeFolder || "").trim();
    if (!fallbackFolder) {
      showStatus(els.uploadStatus, "Vælg en mappe før upload.", "error");
      return;
    }
    if (!folderAllowsUserWrites(fallbackFolder)) {
      showStatus(els.uploadStatus, "Upload kan kun ske inde i en datomappe.", "error");
      return;
    }

    let list = incoming
      .map((entry) => {
        if (!entry) return null;
        if (entry instanceof File) {
          return {
            file: entry,
            folder: fallbackFolder,
            baseFolder: fallbackFolder,
          };
        }
        const file = entry.file;
        if (!(file instanceof File)) return null;
        const targetFolder = String(entry.folder || fallbackFolder || "")
          .replace(/\\/g, "/")
          .split("/")
          .filter(Boolean)
          .join("/");
        if (!targetFolder) return null;
        const baseFolder = String(entry.baseFolder || fallbackFolder || "")
          .replace(/\\/g, "/")
          .split("/")
          .filter(Boolean)
          .join("/");
        return {
          file,
          folder: targetFolder,
          baseFolder: baseFolder || targetFolder,
        };
      })
      .filter(Boolean);

    if (!list.length) return;
    if (list.some((item) => !folderAllowsUserWrites(item.folder))) {
      showStatus(els.uploadStatus, "Upload kan kun ske inde i en datomappe.", "error");
      return;
    }
    const unsupported = list.filter((item) => !isSupportedPrimaryUpload(item.file));
    if (unsupported.length) {
      const message = unsupportedPrimaryUploadMessage(unsupported.map((item) => item.file));
      logRejectedFileTypes(
        unsupported.map((item) => item.file),
        "upload",
        message,
        fallbackFolder,
      );
      if (unsupported.length === list.length) {
        showStatus(els.uploadStatus, message, "error");
        return;
      }
      showStatus(els.uploadStatus, message, "error");
      list = list.filter((item) => isSupportedPrimaryUpload(item.file));
    }

    resetUploadUiState();
    const unsupportedCount = unsupported.length;
    const attemptedCount = list.length + unsupportedCount;
    uploadUiState.totalFiles = attemptedCount;
    uploadUiState.totalBytes = list.reduce((sum, item) => sum + Number(item.file && item.file.size ? item.file.size : 0), 0);
    uploadUiState.processedFiles = unsupportedCount;
    uploadUiState.failedFiles = unsupportedCount;
    uploadUiState.collapsed = false;
    uploadStopRequested = false;
    uploadWasStopped = false;
    uploadTransferActive = true;
    showUploadMonitor();
    unsupported.forEach((item, idx) => {
      const file = item && item.file;
      addUploadMonitorItem(
        file && file.name ? file.name : "Fil",
        false,
        `Ikke understøttet · brug ${PRIMARY_UPLOAD_ALLOWED_LABEL}`,
        _uploadItemKey(file && file.name ? file.name : "Fil", `unsupported-${idx}`),
        0
      );
    });
    renderUploadMonitor();

    showStatus(els.uploadStatus, `Starter upload af ${list.length} filer...`, "ok");
    const uploaded = [];
    try {
      for (let i = 0; i < list.length; i += 1) {
        if (uploadStopRequested) break;

        const item = list[i];
        const file = item.file;
        const targetFolder = String(item.folder || fallbackFolder || "").trim();
        const baseFolder = String(item.baseFolder || fallbackFolder || "").trim();
        const cid = makeClientUploadId();
        const itemKey = _uploadItemKey(file.name, i);
        uploadUiState.currentPhaseLabel = "Uploader";
        uploadUiState.currentFileName = file.name || "fil";
        uploadUiState.currentLoaded = 0;
        uploadUiState.currentTotal = Number(file.size || 0);
        addUploadMonitorItem(file.name, null, "Uploader... 0%", itemKey, 0);
        renderUploadMonitor();

        try {
          await uploadSingleTus(file, targetFolder, baseFolder, cid, (uploadedBytes, totalBytes) => {
            const pct = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
            uploadUiState.currentLoaded = Number(uploadedBytes || 0);
            uploadUiState.currentTotal = Number(totalBytes || file.size || 0);
            updateUploadMonitorItem(itemKey, null, `Uploader... ${pct}%`, pct);
            renderUploadMonitor();
            showStatus(
              els.uploadStatus,
              `Uploader ${i + 1}/${list.length}: ${file.name} (${pct}%)`,
              "ok"
            );
          });
          uploaded.push({ clientUploadId: cid, filename: file.name });
          updateUploadMonitorItem(itemKey, true, `Uploadet · ${formatSize(file.size || 0)}`, 100);
        } catch (err) {
          const aborted = uploadStopRequested || isUploadAbortError(err);
          if (aborted) {
            updateUploadMonitorItem(itemKey, false, "Stoppet", 0);
          } else {
            uploadUiState.failedFiles += 1;
            const message = (err && err.message) ? err.message : String(err || "Ukendt fejl");
            updateUploadMonitorItem(itemKey, false, `Fejl: ${message}`, 0);
            showStatus(els.uploadStatus, `Upload fejlede for ${file.name}: ${message}`, "error");
          }
          if (aborted) break;
        } finally {
          uploadUiState.processedFiles += 1;
          uploadUiState.processedBytes += Number(file.size || uploadUiState.currentTotal || 0);
          uploadUiState.currentLoaded = 0;
          uploadUiState.currentTotal = 0;
          renderUploadMonitor();
        }
      }
    } finally {
      uploadTransferActive = false;
      activeTusUpload = null;
      uploadUiState.currentFileName = "";
      uploadUiState.currentPhaseLabel = "";
      uploadUiState.currentLoaded = 0;
      uploadUiState.currentTotal = 0;
      renderUploadMonitor();
    }

    if (uploaded.length) {
      const failedPart = uploadUiState.failedFiles ? ` · fejl: ${uploadUiState.failedFiles}` : "";
      const doneLabel = uploadWasStopped ? "Upload stoppet" : "Upload færdig";
      showStatus(els.uploadStatus, `${doneLabel}: ${uploaded.length}/${attemptedCount} filer${failedPart}.`, uploadUiState.failedFiles ? "error" : "ok");
      const resolved = await resolveUploadedItems(uploaded);
      const firstFolder = resolved.length ? String(resolved[0].folder_path || "").trim() : "";
      await loadFolders();
      if (firstFolder && els.folderSelect) {
        els.folderSelect.value = firstFolder;
        state.currentFolder = firstFolder;
      }
      await loadFiles();
      if (resolved.length) openMetadataModal(resolved, { mode: "upload" });
    } else {
      showStatus(els.uploadStatus, uploadWasStopped ? "Upload stoppet." : "Ingen filer blev uploadet.", uploadWasStopped ? "ok" : "error");
      await loadFiles();
    }
  }

  function cleanFolderNamePart(value) {
    return String(value || "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function lastNameInitial(value) {
    const chars = Array.from(cleanFolderNamePart(value));
    return chars.length ? chars[0].toLocaleUpperCase("da-DK") : "";
  }

  function nonUserFolderBaseName() {
    const firstName = cleanFolderNamePart(els.nonUserFolderFirstName && els.nonUserFolderFirstName.value);
    const initial = lastNameInitial(els.nonUserFolderLastName && els.nonUserFolderLastName.value);
    if (!firstName || !initial) return "";
    return `Ikke bruger mappe (${firstName} ${initial})`;
  }

  function uniqueChildFolderName(parent, baseName) {
    const cleanParent = normalizeFolderPath(parent);
    const existing = new Set(
      state.folders
        .map((item) => normalizeFolderPath(item && item.path))
        .filter(Boolean)
    );
    let candidate = String(baseName || "").trim();
    if (!candidate) return "";
    let idx = 2;
    while (existing.has(normalizeFolderPath(`${cleanParent}/${candidate}`))) {
      candidate = `${baseName}-${idx}`;
      idx += 1;
    }
    return candidate;
  }

  function updateNonUserFolderPreview() {
    if (!els.nonUserFolderPreview) return;
    const baseName = nonUserFolderBaseName();
    const parent = currentFolder() || state.homeFolder || "";
    const folderName = baseName ? uniqueChildFolderName(parent, baseName) : "Ikke bruger mappe";
    els.nonUserFolderPreview.textContent = folderName;
  }

  function resetNonUserFolderModal() {
    if (els.nonUserFolderFirstName) els.nonUserFolderFirstName.value = "";
    if (els.nonUserFolderLastName) els.nonUserFolderLastName.value = "";
    if (els.nonUserFolderCreateBtn) els.nonUserFolderCreateBtn.disabled = false;
    showStatus(els.nonUserFolderStatus, "");
    updateNonUserFolderPreview();
  }

  function openNonUserFolderModal() {
    if (!els.nonUserFolderModal) return;
    resetNonUserFolderModal();
    els.nonUserFolderModal.classList.remove("hidden");
    window.setTimeout(() => {
      if (els.nonUserFolderFirstName) els.nonUserFolderFirstName.focus();
    }, 0);
  }

  function closeNonUserFolderModal() {
    if (els.nonUserFolderModal) els.nonUserFolderModal.classList.add("hidden");
    resetNonUserFolderModal();
  }

  async function createNonUserFolder() {
    if (!isAdminUsersRootFolder()) {
      showStatus(els.nonUserFolderStatus, "Åbn brugernes rodmappe først.", "error");
      return;
    }
    const baseName = nonUserFolderBaseName();
    if (!baseName) {
      showStatus(els.nonUserFolderStatus, "Udfyld fornavn og efternavn.", "error");
      return;
    }
    const parent = currentFolder() || state.homeFolder || "";
    const folderName = uniqueChildFolderName(parent, baseName);
    if (els.nonUserFolderCreateBtn) els.nonUserFolderCreateBtn.disabled = true;
    try {
      await createFolder(folderName);
      closeNonUserFolderModal();
    } finally {
      if (els.nonUserFolderCreateBtn) els.nonUserFolderCreateBtn.disabled = false;
    }
  }

  async function createFolder(nameOverride = "") {
    const name = String(nameOverride || (els.newFolderInput && els.newFolderInput.value) || "").trim();
    if (!name && isAdminUsersRootFolder()) {
      openNonUserFolderModal();
      return;
    }
    if (!name) {
      showStatus(els.uploadStatus, "Skriv et mappenavn først.", "error");
      return;
    }
    const parent = currentFolder();
    if (!folderAllowsUserWrites(parent)) {
      showStatus(els.uploadStatus, "Mapper kan kun oprettes inde i en datomappe.", "error");
      return;
    }
    await api("/api/folders", {
      method: "POST",
      body: { parent, name },
    });
    if (els.newFolderInput) els.newFolderInput.value = "";
    await loadFolders();
    if (els.folderSelect) {
      const next = parent ? `${parent}/${name}` : name;
      els.folderSelect.value = next;
      state.currentFolder = next;
    }
    await loadFiles();
    showStatus(els.uploadStatus, "Mappe oprettet.", "ok");
  }

  function selectedShareFolders() {
    if (!els.shareFoldersSelect) return [];
    return Array.from(els.shareFoldersSelect.selectedOptions).map((o) => String(o.value || ""));
  }

  function selectedShareFoldersFromSelection() {
    const out = [];
    const seen = new Set();

    for (const raw of Array.from(state.selectedFolderPaths)) {
      const value = String(raw || "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }

    for (const rawId of Array.from(state.selectedFileIds)) {
      const id = Number(rawId || 0);
      if (!id) continue;
      const file = state.files.find((item) => Number(item && item.id ? item.id : 0) === id);
      if (!file) continue;
      const folderPath = String(file.folder_path || "").trim();
      if (!folderPath || seen.has(folderPath)) continue;
      seen.add(folderPath);
      out.push(folderPath);
    }

    return out;
  }

  function describeShareSelection(folderPaths) {
    const paths = Array.isArray(folderPaths)
      ? folderPaths.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    if (!paths.length) return "Ingen mapper valgt.";
    if (paths.length <= 3) return `Valgt: ${paths.join(", ")}`;
    const head = paths.slice(0, 3).join(", ");
    return `Valgt (${paths.length}): ${head} +${paths.length - 3} mere`;
  }

  function updateShareModalSelectionSummary(folderPaths = null) {
    if (!els.shareModalSelected) return;
    const paths = Array.isArray(folderPaths) ? folderPaths : selectedShareFolders();
    els.shareModalSelected.textContent = describeShareSelection(paths);
  }

  function resetShareModalFeedback() {
    showStatus(els.shareCreateStatus, "");
    if (els.shareResultWrap) els.shareResultWrap.classList.add("hidden");
    if (els.shareResultLink) els.shareResultLink.value = "";
  }

  function closeShareModal() {
    resetShareModalFeedback();
    if (els.shareModal) els.shareModal.classList.add("hidden");
  }

  async function openShareModal(preselectedFolders = []) {
    if (state.role !== "admin" || !els.shareModal) return;

    let selected = Array.isArray(preselectedFolders)
      ? preselectedFolders.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    if (!selected.length) {
      selected = selectedShareFoldersFromSelection();
    }

    if (els.shareFoldersSelect && !(els.shareFoldersSelect.options || []).length) {
      await loadFolders();
    }

    resetShareModalFeedback();

    if (els.shareFoldersSelect) {
      const wanted = new Set(selected);
      Array.from(els.shareFoldersSelect.options || []).forEach((opt) => {
        const value = String(opt.value || "");
        opt.selected = wanted.has(value);
      });
    }

    if (els.sharePermissionSelect && !String(els.sharePermissionSelect.value || "").trim()) {
      els.sharePermissionSelect.value = "view";
    }
    if (els.shareExpireValue && !String(els.shareExpireValue.value || "").trim()) {
      els.shareExpireValue.value = "7";
    }
    if (els.shareExpireUnit && !String(els.shareExpireUnit.value || "").trim()) {
      els.shareExpireUnit.value = "days";
    }

    if (els.shareUsePasswordChk && !els.shareUsePasswordChk.checked && els.sharePasswordInput) {
      els.sharePasswordInput.value = "";
    }
    if (els.sharePasswordWrap && els.shareUsePasswordChk) {
      els.sharePasswordWrap.classList.toggle("hidden", !els.shareUsePasswordChk.checked);
    }

    const currentName = String((els.shareNameInput && els.shareNameInput.value) || "").trim();
    if (!currentName && selected.length) {
      if (els.shareNameInput) {
        els.shareNameInput.value = selected.length === 1 ? selected[0] : `${selected.length} mapper`;
      }
    }

    updateShareModalSelectionSummary(selected);
    els.shareModal.classList.remove("hidden");
  }

  async function loadShares() {
    if (!els.sharesTableBody) return;
    try {
      const data = await api("/api/shares");
      state.shares = Array.isArray(data.items) ? data.items : [];
      showStatus(els.sharesListStatus, "");
    } catch (err) {
      state.shares = [];
      showStatus(els.sharesListStatus, err.message || "Kunne ikke hente delinger", "error");
    }
    renderShares();
    updateStats();
  }

  function renderShares() {
    if (!els.sharesTableBody) return;
    if (!state.shares.length) {
      els.sharesTableBody.innerHTML = `<tr><td colspan="6" class="hint">Ingen delinger endnu.</td></tr>`;
      return;
    }
    els.sharesTableBody.innerHTML = state.shares
      .map((s) => {
        const id = Number(s.id || 0);
        const folders = Array.isArray(s.folder_paths) ? s.folder_paths.join(", ") : s.folder_path || "";
        const expires = s.expires_at ? formatDate(s.expires_at) : "Aldrig";
        const link = s.link || "";
        return `
          <tr>
            <td>${esc(s.share_name || "-")}</td>
            <td>${esc(folders)}</td>
            <td>${esc(s.permission || "view")}</td>
            <td>${esc(expires)}</td>
            <td>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Åbn</a>` : "-"}</td>
            <td>
              <div class="toolbar">
                ${link ? `<button class="btn" data-share-action="copy" data-share-id="${id}">Kopier</button>` : ""}
                <button class="btn" data-share-action="revoke" data-share-id="${id}">Deaktiver</button>
                <button class="btn danger" data-share-action="delete" data-share-id="${id}">Slet</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function createShare() {
    const folders = selectedShareFolders();
    if (!folders.length) {
      showStatus(els.shareCreateStatus, "Vælg mindst en mappe.", "error");
      updateShareModalSelectionSummary([]);
      return;
    }
    const payload = {
      share_name: (els.shareNameInput && els.shareNameInput.value) || "",
      folder_paths: folders,
      permission: (els.sharePermissionSelect && els.sharePermissionSelect.value) || "view",
      expires_value: Number((els.shareExpireValue && els.shareExpireValue.value) || 0),
      expires_unit: (els.shareExpireUnit && els.shareExpireUnit.value) || "days",
      use_external_base_url: !!(els.shareUseExternalChk && els.shareUseExternalChk.checked),
      require_visitor_name: !!(els.shareRequireVisitorChk && els.shareRequireVisitorChk.checked),
      password: (els.shareUsePasswordChk && els.shareUsePasswordChk.checked)
        ? (els.sharePasswordInput && els.sharePasswordInput.value) || ""
        : "",
    };
    const data = await api("/api/shares", { method: "POST", body: payload });
    showStatus(els.shareCreateStatus, "Deling oprettet.", "ok");
    if (els.shareResultWrap) els.shareResultWrap.classList.remove("hidden");
    if (els.shareResultLink) els.shareResultLink.value = data.link || "";
    updateShareModalSelectionSummary(folders);
    await loadShares();
    if (state.selectMode) toggleSelectMode(false);
  }

  async function onShareTableClick(event) {
    const btn = event.target.closest("[data-share-action]");
    if (!btn) return;
    const action = btn.dataset.shareAction;
    const id = Number(btn.dataset.shareId || 0);
    const item = state.shares.find((s) => Number(s.id || 0) === id);
    if (!id || !item) return;

    if (action === "copy" && item.link) {
      try {
        await navigator.clipboard.writeText(item.link);
        showStatus(els.sharesListStatus, "Link kopieret.", "ok");
      } catch {
        showStatus(els.sharesListStatus, "Kunne ikke kopiere link automatisk.", "error");
      }
      return;
    }

    if (action === "revoke") {
      await api(`/api/shares/${id}/revoke`, { method: "POST" });
      showStatus(els.sharesListStatus, "Deling deaktiveret.", "ok");
      await loadShares();
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Vil du slette delingen permanent?")) return;
      await api(`/api/shares/${id}`, { method: "DELETE" });
      showStatus(els.sharesListStatus, "Deling slettet.", "ok");
      await loadShares();
    }
  }

  async function loadPrintReadyProjects() {
    if (!els.printReadyAdminList) return;
    const listEndpoint = state.role === "admin" ? "/api/admin/print-ready" : "/api/print-ready";
    try {
      const data = await api(listEndpoint);
      state.printReadyProjects = Array.isArray(data.items) ? data.items : [];
      showStatus(els.printReadyStatus, "");
    } catch (err) {
      state.printReadyProjects = [];
      showStatus(els.printReadyStatus, err.message || "Kunne ikke hente klar til print", "error");
    }
    renderPrintReadyProjects();
    updatePrintReadyNavBadge();
  }

  async function loadFinishedProjects() {
    if (!els.finishedProjectsList) return;
    const listEndpoint = state.role === "admin" ? "/api/admin/finished-projects" : "/api/finished-projects";
    try {
      const data = await api(listEndpoint);
      state.finishedProjects = Array.isArray(data.items) ? data.items : [];
      showStatus(els.finishedProjectsStatus, "");
    } catch (err) {
      state.finishedProjects = [];
      showStatus(els.finishedProjectsStatus, err.message || "Kunne ikke hente færdige projekter", "error");
    }
    renderFinishedProjects();
  }

  function printReadyAttachmentHtml(attachments) {
    const list = Array.isArray(attachments) ? attachments : [];
    if (!list.length) return `<span class="hint">Ingen</span>`;
    return `
      <div class="print-ready-attachments">
        ${list.slice(0, 4).map((item) => {
          const url = String(item.content_url || "#");
          const name = String(item.original_name || "Billede");
          return `<a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(name)}"><img src="${esc(url)}" alt="${esc(name)}" loading="lazy"></a>`;
        }).join("")}
        ${list.length > 4 ? `<span class="print-ready-more">+${list.length - 4}</span>` : ""}
      </div>
    `;
  }

  function printReadyProjectFilesHtml(project) {
    if (state.role !== "admin") return "";
    const projectId = Number(project && project.id ? project.id : 0);
    const list = Array.isArray(project && project.project_files) ? project.project_files : [];
    return `
      <section class="print-ready-project-files" aria-label="Gemt i projektet" data-project-id="${projectId}">
        <div class="print-ready-project-files-head">
          <div>
            <div class="print-ready-project-files-title">Gemt i projektet</div>
            <div class="hint">${list.length ? `${list.length} fil(er), kun synlig for admin` : `Upload ${PRINT_READY_PROJECT_FILE_ALLOWED_LABEL} filer til intern brug.`}</div>
            <div class="print-ready-project-drop-hint">Træk ${PRINT_READY_PROJECT_FILE_ALLOWED_LABEL} hertil</div>
          </div>
          <label class="btn small print-ready-project-upload">
            Upload projekt fil(er)
            <input class="print-ready-project-file-input" type="file" accept=".3mf,.stl,.lys,.pwscene" multiple data-project-id="${projectId}">
          </label>
        </div>
        ${
          list.length
            ? `
              <div class="print-ready-project-file-list">
                ${list.map((item) => {
                  const id = Number(item && item.id ? item.id : 0);
                  const name = String((item && item.original_name) || "Projektfil");
                  const url = String((item && item.download_url) || "#");
                  const meta = `${formatSize(item && item.file_size)} · ${formatDate(item && item.uploaded_at)}`;
                  return `
                    <div class="print-ready-project-file-item">
                      <a class="print-ready-project-file-download" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(`Download ${name}`)}" aria-label="${esc(`Download ${name}`)}" data-download-label="Download">
                        <span class="print-ready-project-file-name">${esc(name)}</span>
                        <span class="print-ready-project-file-meta">${esc(meta)}</span>
                      </a>
                      <button class="btn small danger" type="button" data-print-ready-action="delete-project-file" data-id="${projectId}" data-project-file-id="${id}">Slet</button>
                    </div>
                  `;
                }).join("")}
              </div>
            `
            : `<div class="hint">Ingen projektfiler gemt endnu.</div>`
        }
      </section>
    `;
  }

  function printReadyInfoHtml(file) {
    const note = String((file && file.note) || "").trim();
    const scale = scaleUpLabel(file);
    if (!note && !scale) return `<span class="hint">-</span>`;
    return `
      <div class="print-ready-file-info">
        ${note ? `<div>${esc(note)}</div>` : ""}
        ${scale ? `<div class="print-ready-scale-up">Større: ${esc(scale)}</div>` : ""}
      </div>
    `;
  }

  function renderPrintReadyProjects() {
    if (!els.printReadyAdminList) return;
    const isAdmin = state.role === "admin";
    const projects = Array.isArray(state.printReadyProjects) ? state.printReadyProjects : [];
    if (!projects.length) {
      els.printReadyAdminList.innerHTML = `<div class="hint">${isAdmin ? "Ingen projekter er markeret klar til print endnu." : "Du har ingen projekter klar til print endnu."}</div>`;
      return;
    }

    if (!isAdmin) {
      els.printReadyAdminList.innerHTML = `
        <section class="print-ready-user-group">
          <div class="print-ready-projects">
            ${projects.map((project) => renderPrintReadyProjectCard(project)).join("")}
          </div>
        </section>
      `;
      return;
    }

    const groups = new Map();
    for (const project of projects) {
      const user = String(project.owner_username || "Ukendt bruger");
      if (!groups.has(user)) groups.set(user, []);
      groups.get(user).push(project);
    }

    els.printReadyAdminList.innerHTML = Array.from(groups.entries()).map(([username, items]) => `
      <section class="print-ready-user-group">
        <h4>${esc(username)}</h4>
        <div class="print-ready-projects">
          ${items.map((project) => renderPrintReadyProjectCard(project)).join("")}
        </div>
      </section>
    `).join("");
  }

  function renderFinishedProjects() {
    if (!els.finishedProjectsList) return;
    const isAdmin = state.role === "admin";
    const projects = Array.isArray(state.finishedProjects) ? state.finishedProjects : [];
    if (!projects.length) {
      els.finishedProjectsList.innerHTML = `<div class="hint">${isAdmin ? "Ingen færdige projekter endnu." : "Du har ingen færdige projekter endnu."}</div>`;
      return;
    }

    if (!isAdmin) {
      els.finishedProjectsList.innerHTML = `
        <section class="print-ready-user-group">
          <div class="print-ready-projects">
            ${projects.map((project) => renderPrintReadyProjectCard(project, { finished: true })).join("")}
          </div>
        </section>
      `;
      return;
    }

    const groups = new Map();
    for (const project of projects) {
      const user = String(project.owner_username || "Ukendt bruger");
      if (!groups.has(user)) groups.set(user, []);
      groups.get(user).push(project);
    }

    els.finishedProjectsList.innerHTML = Array.from(groups.entries()).map(([username, items]) => `
      <section class="print-ready-user-group">
        <h4>${esc(username)}</h4>
        <div class="print-ready-projects">
          ${items.map((project) => renderPrintReadyProjectCard(project, { finished: true })).join("")}
        </div>
      </section>
    `).join("");
  }

  function renderPrintReadyProjectCard(project, options = {}) {
    const isAdmin = state.role === "admin";
    const finishedMode = !!(options && options.finished);
    const files = Array.isArray(project.files) ? project.files : [];
    const projectStatus = normalizePrintReadyProjectStatus(project.status);
    const isCompletedProject = projectStatus === "completed";
    const isCancelledProject = projectStatus === "cancelled";
    const isFinalProject = isCompletedProject || isCancelledProject;
    const projectCardStatusClass = isCompletedProject
      ? "project-completed"
      : (isCancelledProject ? "project-cancelled" : "project-ready");
    const fileCount = Number(project.file_count || files.length || 0);
    const printedCount = Number(project.printed_file_count || files.filter((f) => !!(f && f.printed)).length || 0);
    const projectFileCount = Array.isArray(project.project_files) ? project.project_files.length : 0;
    const rows = files.map((file) => `
      <tr class="print-ready-file-row">
        <td>${esc(file.display_path || file.folder_path || "-")}</td>
        <td><a class="print-ready-file-download-link" href="${esc(file.download_url || "#")}" download="${esc(file.filename || "")}" data-print-ready-file-download="1">${esc(file.filename || "-")}</a></td>
        <td>${printReadyInfoHtml(file)}</td>
        <td>${file.printed ? `<div class="print-ready-status-pill">Printet</div>` : `<span class="print-ready-status-muted">Ikke printet</span>`}</td>
        <td>${Number(file.quantity || 1)}</td>
        <td>${printReadyAttachmentHtml(file.attachments)}</td>
        <td>
          <div class="print-ready-row-actions">
            ${
              isAdmin
                ? (
                  isFinalProject || finishedMode
                    ? `<button class="btn small" type="button" disabled>${isCancelledProject ? "Annulleret" : "Projekt færdigt"}</button>`
                    : (
                      file.printed
                        ? `<button class="btn small" type="button" data-print-ready-action="uncomplete-file" data-id="${Number(project.id || 0)}" data-file-id="${Number(file.file_id || 0)}">Fjern printet</button>`
                        : `<button class="btn small primary" type="button" data-print-ready-action="complete-file" data-id="${Number(project.id || 0)}" data-file-id="${Number(file.file_id || 0)}">Printet færdig</button>`
                    )
                )
                : `<span class="hint">-</span>`
            }
          </div>
        </td>
      </tr>
    `).join("");
    return `
      <article class="print-ready-project-card ${projectCardStatusClass}">
        <div class="print-ready-project-head">
          <div>
            <div class="hint">${esc(project.created_at_display || formatDate(project.created_at))}</div>
            <div class="hint">Filer i alt: ${fileCount}</div>
            <div class="hint">Printet: ${printedCount}</div>
            ${isAdmin ? `<div class="hint">Gemt i projektet: ${projectFileCount}</div>` : ""}
          </div>
          <div class="toolbar">
            <a class="btn primary" href="${esc(project.zip_url || "#")}" target="_blank" rel="noopener">Download zip fil</a>
            <a class="btn" href="${esc(project.pdf_url || "#")}" target="_blank" rel="noopener">Download PDF produktions info</a>
            ${
              finishedMode
                ? `<button class="btn primary" type="button" data-print-ready-action="resend-project" data-id="${Number(project.id || 0)}">Send til print igen</button>`
                : (
                  isAdmin
                    ? `
                  ${
                    (isCancelledProject || isCompletedProject)
                      ? ""
                      : `<button class="btn small primary" type="button" data-print-ready-action="complete-project" data-id="${Number(project.id || 0)}">Projekt færdig</button>`
                  }
                  <button class="btn danger" type="button" data-print-ready-action="${isCancelledProject ? "delete-project" : "cancel"}" data-id="${Number(project.id || 0)}">${isCancelledProject ? "Slet" : "Annuller"}</button>
                `
                    : ""
                )
            }
          </div>
        </div>
        ${printReadyProjectFilesHtml(project)}
        <div class="print-ready-table-wrap">
          <table class="table compact print-ready-table">
            <thead>
              <tr>
                <th>Sti i mappe</th>
                <th>Filnavn</th>
                <th>Info</th>
                <th>Status</th>
                <th>Antal</th>
                <th>Billeder</th>
                <th>Handling</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="7" class="hint">Ingen filer.</td></tr>`}</tbody>
          </table>
        </div>
      </article>
    `;
  }

  async function uploadPrintReadyProjectFiles(projectId, fileSource, statusElOverride = null) {
    if (state.role !== "admin") return;
    const id = Number(projectId || 0);
    const files = Array.from((fileSource && fileSource.files) || fileSource || []).filter(Boolean);
    if (!id || !files.length) return;
    const statusEl = statusElOverride || (els.finishedProjectsList && fileSource instanceof Element && els.finishedProjectsList.contains(fileSource)
      ? els.finishedProjectsStatus
      : els.printReadyStatus);

    const unsupported = files.filter((file) => !isSupportedPrintReadyProjectFile(file));
    if (unsupported.length) {
      const reason = `${unsupported[0].name || "Filen"} understøttes ikke. Upload kun ${PRINT_READY_PROJECT_FILE_ALLOWED_LABEL} filer.`;
      logRejectedFileTypes(
        unsupported,
        "project-file-upload",
        `Ikke understøttet. Upload kun ${PRINT_READY_PROJECT_FILE_ALLOWED_LABEL} filer.`,
        "",
      );
      showStatus(
        statusEl,
        reason,
        "error",
      );
      if (fileSource && fileSource.files) fileSource.value = "";
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("project_files", file, file.name || "projektfil"));
    showStatus(statusEl, `Uploader ${files.length} projektfil(er)...`, "ok");
    const data = await api(`/api/admin/print-ready/${id}/project-files`, {
      method: "POST",
      body: formData,
    });
    if (fileSource && fileSource.files) fileSource.value = "";
    const created = Math.max(0, Number(data && data.created ? data.created : files.length));
    const skipped = Array.isArray(data && data.skipped) ? data.skipped.length : 0;
    const skippedText = skipped ? ` ${skipped} blev sprunget over.` : "";
    showStatus(statusEl, `${created} projektfil(er) gemt.${skippedText}`, "ok");
    await loadPrintReadyProjects();
    await loadFinishedProjects();
  }

  function bindPrintReadyProjectFileDrop(rootEl, statusEl) {
    if (!rootEl) return;
    const zoneFromEvent = (event) => {
      const target = event && event.target;
      return target && target.closest ? target.closest(".print-ready-project-files[data-project-id]") : null;
    };
    const hasFiles = (event) => !!(
      event &&
      event.dataTransfer &&
      event.dataTransfer.types &&
      Array.from(event.dataTransfer.types).includes("Files")
    );

    rootEl.addEventListener("dragenter", (event) => {
      const zone = zoneFromEvent(event);
      if (!zone || !hasFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      globalDropDepth = 0;
      hideGlobalDropOverlay();
      zone.classList.add("dragover");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });

    rootEl.addEventListener("dragover", (event) => {
      const zone = zoneFromEvent(event);
      if (!zone || !hasFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      globalDropDepth = 0;
      hideGlobalDropOverlay();
      zone.classList.add("dragover");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });

    rootEl.addEventListener("dragleave", (event) => {
      const zone = zoneFromEvent(event);
      if (!zone) return;
      const related = event.relatedTarget;
      if (related instanceof Node && zone.contains(related)) return;
      zone.classList.remove("dragover");
    });

    rootEl.addEventListener("drop", (event) => {
      const zone = zoneFromEvent(event);
      if (!zone) return;
      event.preventDefault();
      event.stopPropagation();
      globalDropDepth = 0;
      hideGlobalDropOverlay();
      zone.classList.remove("dragover");
      const projectId = Number(zone.dataset.projectId || 0);
      uploadPrintReadyProjectFiles(projectId, event.dataTransfer && event.dataTransfer.files, statusEl).catch((err) => {
        showStatus(statusEl, err.message || "Kunne ikke uploade projektfil", "error");
      });
    });
  }

  async function onPrintReadyAdminClick(event) {
    const target = event.target && event.target.closest ? event.target : null;
    const statusEl = els.finishedProjectsList && target && els.finishedProjectsList.contains(target)
      ? els.finishedProjectsStatus
      : els.printReadyStatus;
    const downloadLink = target ? target.closest("[data-print-ready-file-download]") : null;
    if (downloadLink) {
      if (isTouchOrNarrowViewport()) {
        event.preventDefault();
        event.stopPropagation();
        if (triggerHiddenDownload(downloadLink.href)) {
          showStatus(statusEl, "Downloader fil...", "ok");
        }
      }
      return;
    }

    const btn = target ? target.closest("[data-print-ready-action]") : null;
    if (!btn) return;
    const action = String(btn.dataset.printReadyAction || "");
    const id = Number(btn.dataset.id || 0);
    if (!id) return;

    if (action === "resend-project") {
      const ok = window.confirm("Vil du sende dette projekt til print igen?");
      if (!ok) return;
      await api(`/api/print-ready/${id}/resend`, { method: "POST" });
      showStatus(statusEl, "Projektet er sendt til print igen.", "ok");
      await loadFinishedProjects();
      await loadPrintReadyProjects();
      await loadFiles();
      return;
    }

    if (state.role !== "admin") return;

    if (action === "cancel") {
      const ok = window.confirm("Vil du annullere dette projekt? Brugeren skal derefter sende et nyt.");
      if (!ok) return;
      const data = await api(`/api/admin/print-ready/${id}/cancel`, { method: "POST" });
      const resetCount = Number(data && data.reset_printed_count ? data.reset_printed_count : 0);
      showStatus(
        statusEl,
        resetCount > 0
          ? `Projekt annulleret. Printet-status nulstillet for ${resetCount} fil(er).`
          : "Projekt annulleret.",
        "ok",
      );
      await loadPrintReadyProjects();
      return;
    }

    if (action === "delete-project") {
      const ok = window.confirm("Vil du slette dette annullerede projekt permanent?");
      if (!ok) return;
      await api(`/api/admin/print-ready/${id}/delete`, { method: "POST" });
      showStatus(statusEl, "Projekt slettet permanent.", "ok");
      await loadPrintReadyProjects();
      return;
    }

    if (action === "delete-project-file") {
      const assetId = Number(btn.dataset.projectFileId || 0);
      if (!assetId) return;
      const ok = window.confirm("Vil du slette denne gemte projektfil?");
      if (!ok) return;
      await api(`/api/admin/print-ready/${id}/project-files/${assetId}`, { method: "DELETE" });
      showStatus(statusEl, "Projektfil slettet.", "ok");
      await loadPrintReadyProjects();
      await loadFinishedProjects();
      return;
    }

    const project = (Array.isArray(state.printReadyProjects) ? state.printReadyProjects : [])
      .find((item) => Number(item && item.id ? item.id : 0) === id) || null;

    if (action === "complete-file") {
      const fileId = Number(btn.dataset.fileId || 0);
      if (!fileId) return;
      await api(`/api/admin/print-ready/${id}/file/${fileId}/complete`, {
        method: "POST",
        body: { send_sms: false },
      });
      showStatus(statusEl, "Fil markeret som printet.", "ok");
      await loadPrintReadyProjects();
      await loadFiles();
      return;
    }

    if (action === "uncomplete-file") {
      const fileId = Number(btn.dataset.fileId || 0);
      if (!fileId) return;
      await api(`/api/admin/print-ready/${id}/file/${fileId}/uncomplete`, { method: "POST" });
      showStatus(statusEl, "Printet-status fjernet for filen.", "ok");
      await loadPrintReadyProjects();
      await loadFiles();
      return;
    }

    if (action === "complete-project") {
      const shouldComplete = await askSmsConfirmation(`Projekt: ${project && project.title ? project.title : id}`, project);
      if (!shouldComplete) return;

      await api(`/api/admin/print-ready/${id}/complete`, {
        method: "POST",
        body: { send_sms: false },
      });
      showStatus(statusEl, "Projekt markeret som færdigprintet.", "ok");
      await loadPrintReadyProjects();
      await loadFinishedProjects();
      await loadFiles();
    }
  }

  async function loadDns() {
    if (!els.dnsExternalBaseUrlInput) return;
    try {
      const data = await api("/api/settings/dns");
      els.dnsExternalBaseUrlInput.value = data.external_base_url || "";
    } catch (err) {
      showStatus(els.dnsStatus, err.message || "Kunne ikke hente DNS", "error");
    }
  }

  async function saveDns() {
    const url = String((els.dnsExternalBaseUrlInput && els.dnsExternalBaseUrlInput.value) || "").trim();
    const data = await api("/api/settings/dns", {
      method: "POST",
      body: { external_base_url: url },
    });
    if (els.dnsExternalBaseUrlInput) els.dnsExternalBaseUrlInput.value = data.external_base_url || "";
    showStatus(els.dnsStatus, "DNS indstilling gemt.", "ok");
  }

  function updateSmsSenderCounter() {
    if (!els.smsGatewaySenderCount) return;
    const sender = String((els.smsGatewaySenderInput && els.smsGatewaySenderInput.value) || "");
    els.smsGatewaySenderCount.textContent = `${sender.length}/${SMS_SENDER_MAX_LENGTH}`;
  }

  function setSmsSettingsFormState(options = {}) {
    const busy = !!(options && options.busy);
    const action = String((options && options.action) || "");
    if (els.smsGatewayEnabledChk) els.smsGatewayEnabledChk.disabled = busy;
    if (els.smsGatewaySenderInput) els.smsGatewaySenderInput.disabled = busy;
    if (els.smsGatewayTokenInput) els.smsGatewayTokenInput.disabled = busy;
    if (els.smsTestRecipientInput) els.smsTestRecipientInput.disabled = busy;
    if (els.smsTestBtn) {
      els.smsTestBtn.disabled = busy;
      els.smsTestBtn.textContent = busy && action === "test" ? "Sender..." : "Send test-SMS";
    }
    if (els.smsResetTokenBtn) {
      els.smsResetTokenBtn.disabled = busy;
      els.smsResetTokenBtn.textContent = busy && action === "reset" ? "Nulstiller..." : "Nulstil token";
    }
    if (els.smsSaveBtn) {
      els.smsSaveBtn.disabled = busy;
      els.smsSaveBtn.textContent = busy && action === "save" ? "Gemmer..." : "Gem SMS";
    }
  }

  function showSmsTokenPreview() {
    if (!els.smsGatewayTokenInput) return;
    if (!state.smsGatewayTokenConfigured || !state.smsGatewayTokenPreview) {
      state.smsGatewayTokenPreviewActive = false;
      els.smsGatewayTokenInput.type = "password";
      els.smsGatewayTokenInput.value = "";
      els.smsGatewayTokenInput.placeholder = "Indsæt token";
      return;
    }
    state.smsGatewayTokenPreviewActive = true;
    els.smsGatewayTokenInput.type = "text";
    els.smsGatewayTokenInput.value = state.smsGatewayTokenPreview;
    els.smsGatewayTokenInput.placeholder = "Skriv nyt token ved ændring";
  }

  function beginSmsTokenEdit() {
    if (!els.smsGatewayTokenInput || !state.smsGatewayTokenPreviewActive) return;
    state.smsGatewayTokenPreviewActive = false;
    els.smsGatewayTokenInput.type = "password";
    els.smsGatewayTokenInput.value = "";
    els.smsGatewayTokenInput.placeholder = "Skriv nyt token";
  }

  function restoreSmsTokenPreviewIfEmpty() {
    if (!els.smsGatewayTokenInput) return;
    const tokenValue = String(els.smsGatewayTokenInput.value || "").trim();
    if (!tokenValue && state.smsGatewayTokenConfigured) {
      showSmsTokenPreview();
    }
  }

  function applySmsSettings(data) {
    const enabled = !!(data && data.enabled);
    const sender = String((data && data.sender) || "");
    const tokenConfigured = !!(data && data.token_configured);
    const tokenPreview = String((data && data.token_preview) || "");
    state.smsGatewayTokenConfigured = tokenConfigured;
    state.smsGatewayTokenPreview = tokenPreview;
    if (els.smsGatewayEnabledChk) els.smsGatewayEnabledChk.checked = enabled;
    if (els.smsGatewaySenderInput) els.smsGatewaySenderInput.value = sender;
    updateSmsSenderCounter();
    showSmsTokenPreview();
  }

  async function loadSmsSettings() {
    if (state.role !== "admin") return;
    try {
      setSmsSettingsFormState({ busy: true });
      const data = await api("/api/settings/sms");
      applySmsSettings(data || {});
      if (!(data && data.encryption_active)) {
        showStatus(els.smsStatus, "OBS: Sæt SMS_TOKEN_ENCRYPTION_KEY for krypteret token-lagring.", "error");
      } else {
        showStatus(els.smsStatus, "");
      }
    } catch (err) {
      showStatus(els.smsStatus, err.message || "Kunne ikke hente SMS indstillinger", "error");
    } finally {
      setSmsSettingsFormState({ busy: false });
    }
  }

  async function saveSmsSettings() {
    if (state.role !== "admin") return;
    const enabled = !!(els.smsGatewayEnabledChk && els.smsGatewayEnabledChk.checked);
    const sender = String((els.smsGatewaySenderInput && els.smsGatewaySenderInput.value) || "").trim();
    const rawToken = String((els.smsGatewayTokenInput && els.smsGatewayTokenInput.value) || "").trim();
    const token = state.smsGatewayTokenPreviewActive && rawToken === state.smsGatewayTokenPreview ? "" : rawToken;

    try {
      setSmsSettingsFormState({ busy: true, action: "save" });
      const data = await api("/api/settings/sms", {
        method: "POST",
        body: { enabled, sender, token },
      });
      applySmsSettings(data || {});
      const secure = !!(data && data.encryption_active);
      showStatus(
        els.smsStatus,
        secure
          ? "SMS indstillinger gemt. Token vises maskeret."
          : "SMS indstillinger gemt, men token er ikke krypteret uden SMS_TOKEN_ENCRYPTION_KEY.",
        secure ? "ok" : "error",
      );
    } catch (err) {
      showStatus(els.smsStatus, err.message || "Kunne ikke gemme SMS indstillinger", "error");
    } finally {
      setSmsSettingsFormState({ busy: false });
    }
  }

  async function resetSmsGatewayToken() {
    if (state.role !== "admin") return;
    const ok = window.confirm("Vil du nulstille SMS gateway token? Du skal indsætte og gemme en ny token bagefter.");
    if (!ok) return;
    try {
      setSmsSettingsFormState({ busy: true, action: "reset" });
      const data = await api("/api/settings/sms/token", { method: "DELETE" });
      applySmsSettings(data || {});
      showStatus(els.smsStatus, "SMS token er nulstillet. Indsæt en ny token og gem.", "ok");
      if (els.smsGatewayTokenInput) els.smsGatewayTokenInput.focus();
    } catch (err) {
      showStatus(els.smsStatus, err.message || "Kunne ikke nulstille SMS token", "error");
    } finally {
      setSmsSettingsFormState({ busy: false });
    }
  }

  async function sendSmsTest() {
    if (state.role !== "admin") return;
    const recipient = String((els.smsTestRecipientInput && els.smsTestRecipientInput.value) || "").trim();
    const sender = String((els.smsGatewaySenderInput && els.smsGatewaySenderInput.value) || "").trim();
    const rawToken = String((els.smsGatewayTokenInput && els.smsGatewayTokenInput.value) || "").trim();
    const token = state.smsGatewayTokenPreviewActive && rawToken === state.smsGatewayTokenPreview ? "" : rawToken;

    if (!recipient) {
      showStatus(els.smsStatus, "Indtast modtager nummer til test-SMS.", "error");
      if (els.smsTestRecipientInput) els.smsTestRecipientInput.focus();
      return;
    }

    try {
      setSmsSettingsFormState({ busy: true, action: "test" });
      await api("/api/settings/sms/test", {
        method: "POST",
        body: { recipient, sender, token },
      });
      showStatus(els.smsStatus, "Test-SMS sendt. Gem SMS hvis du har ændret token eller afsender.", "ok");
    } catch (err) {
      showStatus(els.smsStatus, err.message || "Kunne ikke sende test-SMS", "error");
    } finally {
      setSmsSettingsFormState({ busy: false });
    }
  }

  function setMakerworldSettingsFormState(options = {}) {
    const busy = !!(options && options.busy);
    const action = String((options && options.action) || "");
    const encryptionActive = !!state.makerworldEncryptionActive;
    const locked = !encryptionActive;
    if (els.makerworldUsernameInput) els.makerworldUsernameInput.disabled = busy || locked;
    if (els.makerworldPasswordInput) els.makerworldPasswordInput.disabled = busy || locked;
    if (els.makerworldResetPasswordBtn) {
      els.makerworldResetPasswordBtn.disabled = busy || locked;
      els.makerworldResetPasswordBtn.textContent = busy && action === "reset" ? "Nulstiller..." : "Nulstil kodeord";
    }
    if (els.makerworldSaveBtn) {
      els.makerworldSaveBtn.disabled = busy || locked;
      if (locked) {
        els.makerworldSaveBtn.textContent = "Kryptering mangler";
      } else {
        els.makerworldSaveBtn.textContent = busy && action === "login" ? "Logger ind..." : "Login";
      }
    }
    if (els.makerworldLoginOpenLink) {
      if (busy || locked || !state.makerworldLoginFlowUrl) {
        els.makerworldLoginOpenLink.classList.add("disabled");
        els.makerworldLoginOpenLink.setAttribute("aria-disabled", "true");
        els.makerworldLoginOpenLink.setAttribute("tabindex", "-1");
      } else {
        els.makerworldLoginOpenLink.classList.remove("disabled");
        els.makerworldLoginOpenLink.removeAttribute("aria-disabled");
        els.makerworldLoginOpenLink.removeAttribute("tabindex");
      }
    }
  }

  function showMakerworldPasswordPreview() {
    if (!els.makerworldPasswordInput) return;
    state.makerworldPasswordPreviewActive = false;
    els.makerworldPasswordInput.type = "password";
    els.makerworldPasswordInput.value = "";
    els.makerworldPasswordInput.placeholder = state.makerworldPasswordConfigured
      ? "Kodeord er gemt (skjult). Skriv nyt for at ændre"
      : "Indsæt kodeord";
  }

  function beginMakerworldPasswordEdit() {
    if (!els.makerworldPasswordInput) return;
    state.makerworldPasswordPreviewActive = false;
    els.makerworldPasswordInput.type = "password";
    if (!String(els.makerworldPasswordInput.value || "").trim()) {
      els.makerworldPasswordInput.placeholder = "Skriv nyt kodeord";
    }
  }

  function restoreMakerworldPasswordPreviewIfEmpty() {
    if (!els.makerworldPasswordInput) return;
    const value = String(els.makerworldPasswordInput.value || "").trim();
    if (!value && state.makerworldPasswordConfigured) {
      showMakerworldPasswordPreview();
    }
  }

  function buildMakerworldLoginFlowUrl() {
    const makerworldTarget = "https://makerworld.com/en";
    const ticketTarget = `https://makerworld.com/api/sign-in/ticket?to=${encodeURIComponent(makerworldTarget)}`;
    return `https://bambulab.com/en/sign-in?ticket=1&to=${encodeURIComponent(ticketTarget)}`;
  }

  function openMakerworldLoginWindowPlaceholder() {
    try {
      const popup = window.open("", "makerworld_login", "width=1280,height=900");
      if (popup && popup.document) {
        popup.document.title = "MakerWorld login";
        popup.document.body.innerHTML = "<p style='font-family: sans-serif; padding: 16px'>Klargør MakerWorld login...</p>";
      }
      return popup;
    } catch (_err) {
      return null;
    }
  }

  function updateMakerworldLoginBrowser(loginUrl) {
    const url = String(loginUrl || "").trim();
    state.makerworldLoginFlowUrl = url;

    if (els.makerworldLoginOpenLink) {
      els.makerworldLoginOpenLink.href = url || "#";
    }
    if (els.makerworldLoginBrowserWrap) {
      if (url) {
        els.makerworldLoginBrowserWrap.classList.remove("hidden");
      } else {
        els.makerworldLoginBrowserWrap.classList.add("hidden");
      }
    }
    if (els.makerworldLoginBrowserFrame && url) {
      if (els.makerworldLoginBrowserFrame.src !== url) {
        els.makerworldLoginBrowserFrame.src = url;
      }
    }
  }

  function launchMakerworldLoginFlow(loginWindow = null) {
    const loginUrl = buildMakerworldLoginFlowUrl();
    updateMakerworldLoginBrowser(loginUrl);

    let opened = false;
    try {
      if (loginWindow && !loginWindow.closed) {
        loginWindow.location.replace(loginUrl);
        opened = true;
      }
    } catch (_err) {
      opened = false;
    }

    if (!opened) {
      try {
        const popup = window.open(loginUrl, "makerworld_login", "width=1280,height=900");
        opened = !!popup;
      } catch (_err) {
        opened = false;
      }
    }

    if (els.makerworldLoginLiveStatus) {
      if (opened) {
        showStatus(
          els.makerworldLoginLiveStatus,
          "MakerWorld login er åbnet. Hvis browser-rammen er tom, brug 'Åbn MakerWorld login'.",
          "ok",
        );
      } else {
        showStatus(
          els.makerworldLoginLiveStatus,
          "Browseren blokerede popup-login. Brug 'Åbn MakerWorld login' ovenfor.",
          "error",
        );
      }
    }

    return opened;
  }

  function applyMakerworldSettings(data) {
    const username = String((data && data.username) || "").trim();
    const encryptionActive = !!(data && data.encryption_active);
    const passwordConfigured = !!(data && data.password_configured);
    const passwordPreview = String((data && data.password_preview) || "");

    if (els.makerworldUsernameInput) els.makerworldUsernameInput.value = username;
    state.makerworldEncryptionActive = encryptionActive;
    state.makerworldPasswordConfigured = passwordConfigured;
    state.makerworldPasswordPreview = passwordPreview;
    showMakerworldPasswordPreview();
  }

  async function loadMakerworldSettings() {
    if (state.role !== "admin") return;
    try {
      setMakerworldSettingsFormState({ busy: true });
      const data = await api("/api/settings/makerworld");
      applyMakerworldSettings(data || {});
      if (!(data && data.encryption_active)) {
        showStatus(els.makerworldStatus, "OBS: Sæt MAKERWORLD_CREDENTIALS_ENCRYPTION_KEY for krypteret lagring af kodeord.", "error");
      } else {
        showStatus(els.makerworldStatus, "");
      }
    } catch (err) {
      showStatus(els.makerworldStatus, err.message || "Kunne ikke hente MakerWorld indstillinger", "error");
    } finally {
      setMakerworldSettingsFormState({ busy: false });
    }
  }

  async function saveMakerworldSettings() {
    if (state.role !== "admin") return;
    if (!state.makerworldEncryptionActive) {
      showStatus(els.makerworldStatus, "MakerWorld login kræver kryptering. Sæt MAKERWORLD_CREDENTIALS_ENCRYPTION_KEY først.", "error");
      return;
    }
    const username = String((els.makerworldUsernameInput && els.makerworldUsernameInput.value) || "").trim();
    const rawPassword = String((els.makerworldPasswordInput && els.makerworldPasswordInput.value) || "").trim();
    const password = rawPassword;

    if (!username) {
      showStatus(els.makerworldStatus, "Indtast MakerWorld brugernavn eller e-mail.", "error");
      if (els.makerworldUsernameInput) els.makerworldUsernameInput.focus();
      return;
    }

    const loginWindow = openMakerworldLoginWindowPlaceholder();

    try {
      setMakerworldSettingsFormState({ busy: true, action: "login" });
      const data = await api("/api/settings/makerworld", {
        method: "POST",
        body: { username, password },
      });
      applyMakerworldSettings(data || {});
      const secure = !!(data && data.encryption_active);
      let launched = false;
      if (secure) {
        launched = launchMakerworldLoginFlow(loginWindow);
      } else {
        try {
          if (loginWindow && !loginWindow.closed) loginWindow.close();
        } catch (_err) {
          // Ignore popup close errors.
        }
      }
      showStatus(
        els.makerworldStatus,
        secure
          ? (launched
            ? "MakerWorld login gemt. Login-flow er startet."
            : "MakerWorld login gemt, men popup blev blokeret. Brug 'Åbn MakerWorld login'.")
          : "MakerWorld login gemt, men kodeord er ikke krypteret uden MAKERWORLD_CREDENTIALS_ENCRYPTION_KEY.",
        secure ? "ok" : "error",
      );
    } catch (err) {
      try {
        if (loginWindow && !loginWindow.closed) loginWindow.close();
      } catch (_err) {
        // Ignore popup close errors.
      }
      showStatus(els.makerworldStatus, err.message || "Kunne ikke gemme/login på MakerWorld", "error");
    } finally {
      setMakerworldSettingsFormState({ busy: false });
    }
  }

  async function resetMakerworldPassword() {
    if (state.role !== "admin") return;
    const ok = window.confirm("Vil du nulstille MakerWorld kodeord? Du kan gemme et nyt bagefter.");
    if (!ok) return;
    try {
      setMakerworldSettingsFormState({ busy: true, action: "reset" });
      const data = await api("/api/settings/makerworld/password", { method: "DELETE" });
      applyMakerworldSettings(data || {});
      showStatus(els.makerworldStatus, "MakerWorld kodeord er nulstillet. Gem et nyt kodeord for login.", "ok");
      if (els.makerworldPasswordInput) els.makerworldPasswordInput.focus();
    } catch (err) {
      showStatus(els.makerworldStatus, err.message || "Kunne ikke nulstille MakerWorld kodeord", "error");
    } finally {
      setMakerworldSettingsFormState({ busy: false });
    }
  }

  async function loadUsers() {
    if (state.role !== "admin" || !els.usersTableBody) return;
    const data = await api("/api/admin/users");
    state.users = Array.isArray(data.items) ? data.items : [];
    const currentUser = state.users.find((user) => !!(user && user.is_current_user));
    if (currentUser && currentUser.username) {
      state.username = String(currentUser.username);
      if (els.sidebarUsername) els.sidebarUsername.textContent = state.username;
    }
    renderUsers();
    await loadSignupRequests();
    await loadSignupLinks();
  }

  function renderUsers() {
    if (!els.usersTableBody) return;
    if (!state.users.length) {
      els.usersTableBody.innerHTML = `<tr><td colspan="6" class="hint">Ingen brugere.</td></tr>`;
      return;
    }
    els.usersTableBody.innerHTML = state.users
      .map((u) => {
        const id = Number(u.id || 0);
        const isCurrentUser = !!u.is_current_user || String(u.username || "") === state.username;
        const canDelete = !isCurrentUser;
        const name = String(u.display_name || u.first_name || "").trim() || "-";
        const guideForced = !!u.app_onboarding_forced;
        const guideTitle = guideForced
          ? "Guiden er allerede sat til næste login"
          : `Vis hele guiden for ${name} ved næste login`;
        return `
          <tr>
            <td>${id}</td>
            <td>${esc(name)}</td>
            <td>${esc(u.username)}</td>
            <td>${esc(u.role)}</td>
            <td>${esc(u.home_folder || "-")}</td>
            <td>
              <div class="toolbar">
                <button class="btn" data-user-action="edit" data-user-id="${id}">Rediger</button>
                <button class="btn" data-user-action="force-guide" data-user-id="${id}" title="${esc(guideTitle)}" ${guideForced ? "disabled" : ""}>${guideForced ? "Guide klar" : "Force guide"}</button>
                ${canDelete ? `<button class="btn danger" data-user-action="delete" data-user-id="${id}">Slet</button>` : ""}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadSignupRequests() {
    if (state.role !== "admin" || !els.signupRequestsTableBody) return;
    const data = await api("/api/admin/profile-signup/requests");
    state.signupRequests = Array.isArray(data.items) ? data.items : [];
    renderSignupRequests();
  }

  function renderSignupRequests() {
    if (!els.signupRequestsTableBody) return;
    if (!state.signupRequests.length) {
      els.signupRequestsTableBody.innerHTML = `<tr><td colspan="6" class="hint">Ingen oprettelser afventer godkendelse.</td></tr>`;
      return;
    }
    els.signupRequestsTableBody.innerHTML = state.signupRequests
      .map((item) => {
        const id = Number(item.id || 0);
        const firstName = String(item.first_name || "").trim() || "-";
        const lastInitial = String(item.last_initial || "").trim() || "-";
        return `
          <tr>
            <td>${id}</td>
            <td>${esc(firstName)}</td>
            <td>${esc(lastInitial)}</td>
            <td>${esc(item.username || "")}</td>
            <td>${esc(formatDate(item.created_at))}</td>
            <td>
              <div class="toolbar">
                <button class="btn primary" data-signup-request-action="approve" data-request-id="${id}">Acceptér</button>
                <button class="btn danger" data-signup-request-action="cancel" data-request-id="${id}">Annuller</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadSignupLinks() {
    if (state.role !== "admin" || !els.signupLinksTableBody) return;
    const data = await api("/api/admin/profile-signup/links");
    state.signupLinks = Array.isArray(data.items) ? data.items : [];
    renderSignupLinks();
  }

  function renderSignupLinks() {
    if (!els.signupLinksTableBody) return;
    if (!state.signupLinks.length) {
      els.signupLinksTableBody.innerHTML = `<tr><td colspan="5" class="hint">Ingen oprettelseslinks.</td></tr>`;
      return;
    }
    els.signupLinksTableBody.innerHTML = state.signupLinks
      .map((item) => {
        const id = Number(item.id || 0);
        const link = String(item.link || "");
        const isActive = String(item.status || "") === "active" && !!link;
        return `
          <tr>
            <td>${id}</td>
            <td>${esc(item.status_label || "-")}</td>
            <td>${esc(formatDate(item.created_at))}</td>
            <td>
              ${link ? `<input class="input signup-link-input" type="text" readonly value="${esc(link)}">` : `<span class="hint">Linket er brugt</span>`}
            </td>
            <td>
              <div class="toolbar">
                ${isActive ? `<button class="btn" data-signup-link-action="copy" data-link-id="${id}">Kopier</button>` : ""}
                <button class="btn danger" data-signup-link-action="delete" data-link-id="${id}">Fjern</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function createSignupLink() {
    if (state.role !== "admin") return;
    const data = await api("/api/admin/profile-signup/links", { method: "POST" });
    const item = data && data.item ? data.item : null;
    if (item) {
      state.signupLinks.unshift(item);
      renderSignupLinks();
      if (item.link) {
        try {
          await navigator.clipboard.writeText(item.link);
          showStatus(els.signupLinksStatus, "Oprettelseslink genereret og kopieret.", "ok");
          return;
        } catch {
          // Fall through to a non-copy success message.
        }
      }
    } else {
      await loadSignupLinks();
    }
    showStatus(els.signupLinksStatus, "Oprettelseslink genereret.", "ok");
  }

  async function onSignupRequestsTableClick(event) {
    const btn = event.target.closest("[data-signup-request-action]");
    if (!btn) return;
    const action = String(btn.dataset.signupRequestAction || "");
    const id = Number(btn.dataset.requestId || 0);
    if (!id) return;

    if (action === "approve") {
      await api(`/api/admin/profile-signup/requests/${id}/approve`, { method: "POST" });
      showStatus(els.signupRequestsStatus, "Oprettelsen er accepteret.", "ok");
      await loadUsers();
      await loadFolders();
      return;
    }

    if (action === "cancel") {
      if (!window.confirm("Vil du annullere oprettelsen?")) return;
      await api(`/api/admin/profile-signup/requests/${id}/cancel`, { method: "POST" });
      showStatus(els.signupRequestsStatus, "Oprettelsen er annulleret.", "ok");
      await loadSignupRequests();
    }
  }

  async function onSignupLinksTableClick(event) {
    const btn = event.target.closest("[data-signup-link-action]");
    if (!btn) return;
    const action = String(btn.dataset.signupLinkAction || "");
    const id = Number(btn.dataset.linkId || 0);
    const item = state.signupLinks.find((entry) => Number(entry.id || 0) === id);
    if (!id || !item) return;

    if (action === "copy") {
      const link = String(item.link || "");
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link);
        showStatus(els.signupLinksStatus, "Link kopieret.", "ok");
      } catch {
        showStatus(els.signupLinksStatus, "Kunne ikke kopiere link automatisk.", "error");
      }
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Vil du fjerne oprettelseslinket?")) return;
      await api(`/api/admin/profile-signup/links/${id}`, { method: "DELETE" });
      showStatus(els.signupLinksStatus, "Oprettelseslink fjernet.", "ok");
      await loadSignupLinks();
    }
  }

  function resetCreateUserModal() {
    if (els.createUserFirstName) els.createUserFirstName.value = "";
    if (els.createUserLastName) els.createUserLastName.value = "";
    if (els.createUserUsername) els.createUserUsername.value = "";
    if (els.createUserPassword) els.createUserPassword.value = "";
    if (els.createUserPassword2) els.createUserPassword2.value = "";
    if (els.createUserRole) els.createUserRole.value = "user";
    showStatus(els.createUserModalStatus, "");
  }

  function openCreateUserModal() {
    if (!els.createUserModal) return;
    resetCreateUserModal();
    els.createUserModal.classList.remove("hidden");
    window.setTimeout(() => {
      if (els.createUserFirstName) els.createUserFirstName.focus();
    }, 0);
  }

  function closeCreateUserModal() {
    if (els.createUserModal) els.createUserModal.classList.add("hidden");
    resetCreateUserModal();
  }

  function userById(id) {
    const userId = Number(id || 0);
    if (!userId) return null;
    return state.users.find((user) => Number(user && user.id ? user.id : 0) === userId) || null;
  }

  function resetEditUserModal() {
    state.editingUserId = 0;
    if (els.editUserFirstName) els.editUserFirstName.value = "";
    if (els.editUserLastName) els.editUserLastName.value = "";
    if (els.editUserUsername) els.editUserUsername.value = "";
    if (els.editUserRole) els.editUserRole.value = "user";
    if (els.editUserHomeFolderHint) els.editUserHomeFolderHint.textContent = "";
    showStatus(els.editUserModalStatus, "");
  }

  function openEditUserModal(userId) {
    const user = userById(userId);
    if (!user || !els.editUserModal) return;
    state.editingUserId = Number(user.id || 0);
    if (els.editUserFirstName) els.editUserFirstName.value = String(user.first_name || "");
    if (els.editUserLastName) els.editUserLastName.value = String(user.last_initial || "");
    if (els.editUserUsername) els.editUserUsername.value = String(user.username || "");
    if (els.editUserRole) els.editUserRole.value = String(user.role || "user").toLowerCase() === "admin" ? "admin" : "user";
    if (els.editUserHomeFolderHint) {
      els.editUserHomeFolderHint.textContent = `Hjemmemappe: ${String(user.home_folder || "-")}`;
    }
    showStatus(els.editUserModalStatus, "");
    els.editUserModal.classList.remove("hidden");
    window.setTimeout(() => {
      if (els.editUserFirstName) els.editUserFirstName.focus();
    }, 0);
  }

  function closeEditUserModal() {
    if (els.editUserModal) els.editUserModal.classList.add("hidden");
    resetEditUserModal();
  }

  async function createUser() {
    const firstName = String((els.createUserFirstName && els.createUserFirstName.value) || "").trim();
    const lastName = String((els.createUserLastName && els.createUserLastName.value) || "").trim();
    const username = String((els.createUserUsername && els.createUserUsername.value) || "").trim();
    const password = String((els.createUserPassword && els.createUserPassword.value) || "");
    const password2 = String((els.createUserPassword2 && els.createUserPassword2.value) || "");
    const role = String((els.createUserRole && els.createUserRole.value) || "user");
    if (!firstName || !lastName || !username || !password || !password2) {
      showStatus(els.createUserModalStatus, "Udfyld navn, efternavn, brugernavn og kodefelter.", "error");
      return;
    }
    if (password !== password2) {
      showStatus(els.createUserModalStatus, "Adgangskoderne matcher ikke.", "error");
      return;
    }
    await api("/api/admin/users", { method: "POST", body: { first_name: firstName, last_name: lastName, username, password, password2, role } });
    closeCreateUserModal();
    showStatus(els.userStatus, "Bruger oprettet.", "ok");
    await loadUsers();
    await loadFolders();
  }

  async function updateUser() {
    const id = Number(state.editingUserId || 0);
    if (!id) return;
    const firstName = String((els.editUserFirstName && els.editUserFirstName.value) || "").trim();
    const lastName = String((els.editUserLastName && els.editUserLastName.value) || "").trim();
    const username = String((els.editUserUsername && els.editUserUsername.value) || "").trim();
    const role = String((els.editUserRole && els.editUserRole.value) || "user");
    if (!firstName || !lastName || !username) {
      showStatus(els.editUserModalStatus, "Udfyld navn, efternavn/initial og brugernavn.", "error");
      return;
    }
    if (els.editUserSaveBtn) {
      els.editUserSaveBtn.disabled = true;
      els.editUserSaveBtn.textContent = "Gemmer...";
    }
    try {
      await api(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: { first_name: firstName, last_name: lastName, username, role },
      });
      closeEditUserModal();
      showStatus(els.userStatus, "Bruger opdateret.", "ok");
      await loadUsers();
      await loadFolders();
    } finally {
      if (els.editUserSaveBtn) {
        els.editUserSaveBtn.disabled = false;
        els.editUserSaveBtn.textContent = "Gem ændringer";
      }
    }
  }

  async function onUsersTableClick(event) {
    const btn = event.target.closest("[data-user-action]");
    if (!btn) return;
    const action = String(btn.dataset.userAction || "");
    const id = Number(btn.dataset.userId || 0);
    if (!id) return;
    if (action === "edit") {
      openEditUserModal(id);
      return;
    }
    if (action === "force-guide") {
      const user = userById(id);
      const name = String((user && (user.display_name || user.username)) || "brugeren");
      if (!window.confirm(`Vil du tvinge guiden frem for ${name} ved næste login? Brugeren skal se hele guiden igennem, før systemet kan bruges.`)) return;
      const data = await api(`/api/admin/users/${id}/force-guide`, { method: "POST" });
      if (data && data.item) {
        const index = state.users.findIndex((entry) => Number(entry && entry.id ? entry.id : 0) === id);
        if (index >= 0) state.users[index] = data.item;
      } else {
        await loadUsers();
      }
      renderUsers();
      showStatus(els.userStatus, `Guiden vises ved næste login for ${name}.`, "ok");
      return;
    }
    if (action === "delete") {
      if (!window.confirm("Vil du slette brugeren?")) return;
      await api(`/api/admin/users/${id}`, { method: "DELETE" });
      showStatus(els.userStatus, "Bruger slettet.", "ok");
      await loadUsers();
      await loadFolders();
    }
  }

  const TRACKING_MONTH_NAMES = [
    "januar",
    "februar",
    "marts",
    "april",
    "maj",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "december",
  ];
  const TRACKING_MONTH_ALIASES = {
    januar: 0,
    jan: 0,
    january: 0,
    februar: 1,
    feb: 1,
    february: 1,
    marts: 2,
    mar: 2,
    march: 2,
    april: 3,
    apr: 3,
    maj: 4,
    may: 4,
    juni: 5,
    jun: 5,
    june: 5,
    juli: 6,
    jul: 6,
    july: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    oktober: 9,
    oct: 9,
    october: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };

  function padTrackingTime(value) {
    return String(value || 0).padStart(2, "0");
  }

  function parseTrackingDate(value) {
    const text = String(value || "").trim();
    if (!text) return null;

    const numericMatch = text.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[,\s]+(?:kl\.?\s*)?(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?/i,
    );
    if (numericMatch) {
      return new Date(
        Number(numericMatch[3]),
        Number(numericMatch[2]) - 1,
        Number(numericMatch[1]),
        Number(numericMatch[4] || 0),
        Number(numericMatch[5] || 0),
        Number(numericMatch[6] || 0),
      );
    }

    const monthMatch = text.toLocaleLowerCase("da-DK").match(
      /^(\d{1,2})\.?\s+([a-zæøå]+)\s+(\d{4})(?:\s*(?:kl\.?|at)?\s*(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?/i,
    );
    if (monthMatch && Object.prototype.hasOwnProperty.call(TRACKING_MONTH_ALIASES, monthMatch[2])) {
      return new Date(
        Number(monthMatch[3]),
        TRACKING_MONTH_ALIASES[monthMatch[2]],
        Number(monthMatch[1]),
        Number(monthMatch[4] || 0),
        Number(monthMatch[5] || 0),
        Number(monthMatch[6] || 0),
      );
    }

    const directDate = new Date(text);
    if (!Number.isNaN(directDate.getTime())) return directDate;

    return null;
  }

  function trackingDateHasTime(value) {
    return /(?:T|\bkl\.?\b|\bat\b|(?:^|[\s,])\d{1,2}[.:]\d{2}(?:[.:]\d{2})?(?:\s|$))/i.test(String(value || ""));
  }

  function formatTrackingDate(value) {
    const text = String(value || "").trim();
    if (!text) return "-";
    const d = parseTrackingDate(text);
    if (d) {
      const datePart = `${d.getDate()} ${TRACKING_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (!trackingDateHasTime(text)) return datePart;
      const timePart = `${padTrackingTime(d.getHours())}:${padTrackingTime(d.getMinutes())}`;
      return `${datePart}, ${timePart}`;
    }
    return text;
  }

  function trackingStatusClass(item) {
    if (item && item.error) return "error";
    const status = String((item && item.status) || "").toLowerCase();
    if (status.includes("leveret") || status.includes("delivered")) return "ok";
    if (status.includes("ikke fundet") || status.includes("fejl")) return "error";
    return "";
  }

  function trackingEventsForItem(item) {
    const events = Array.isArray(item && item.events) ? item.events.filter(Boolean) : [];
    if (events.length) return events;
    const fallbackText = String((item && item.last_event_text) || "").trim();
    if (!fallbackText) return [];
    return [{
      description: fallbackText,
      display_date: String((item && item.last_event_at) || "").trim(),
      location: String((item && item.last_event_location) || "").trim(),
      status: String((item && item.status_code) || "").trim(),
      date_iso: "",
    }];
  }

  function trackingEventDate(event) {
    const value = String(
      (event && (event.date_iso || event.display_date || event.display_time)) || "",
    ).trim();
    return formatTrackingDate(value);
  }

  function renderTrackingEvents(events) {
    if (!events.length) {
      return `<div class="hint">Ingen hændelser gemt endnu. Tryk Opdater for at hente seneste historik fra Bring.</div>`;
    }
    return `
      <ol class="tracking-timeline">
        ${events.map((event) => {
          const description = String((event && event.description) || (event && event.status) || "Hændelse").trim();
          const dateText = trackingEventDate(event);
          const location = String((event && event.location) || "").trim();
          return `
            <li class="tracking-timeline-item">
              <span class="tracking-timeline-dot" aria-hidden="true"></span>
              <div class="tracking-timeline-body">
                <div class="tracking-timeline-title">${esc(description)}</div>
                ${dateText && dateText !== "-" ? `<div class="tracking-timeline-date">${esc(dateText)}</div>` : ""}
                ${location ? `<div class="tracking-timeline-location">${esc(location)}</div>` : ""}
              </div>
            </li>
          `;
        }).join("")}
      </ol>
    `;
  }

  async function loadTracking() {
    if (!els.trackingTableBody) return;
    const endpoint = state.role === "admin" ? "/api/admin/tracking" : "/api/tracking";
    try {
      const data = await api(endpoint);
      state.tracking = Array.isArray(data.items) ? data.items : [];
      const liveIds = new Set(state.tracking.map((item) => Number(item.id || 0)).filter(Boolean));
      state.trackingExpandedIds.forEach((id) => {
        if (!liveIds.has(id)) state.trackingExpandedIds.delete(id);
      });
      renderTracking();
      showStatus(els.trackingStatus, "");
    } catch (err) {
      state.tracking = [];
      renderTracking();
      showStatus(els.trackingStatus, err.message || "Kunne ikke hente tracking", "error");
    }
  }

  function renderTracking() {
    if (!els.trackingTableBody) return;
    const isAdmin = state.role === "admin";
    if (!state.tracking.length) {
      els.trackingTableBody.innerHTML = `<tr><td colspan="7" class="hint">Ingen trackingnumre endnu.</td></tr>`;
      return;
    }
    els.trackingTableBody.innerHTML = state.tracking
      .map((item) => {
        const id = Number(item.id || 0);
        const status = String(item.status || (item.error ? "Fejl" : "-"));
        const statusClass = trackingStatusClass(item);
        const events = trackingEventsForItem(item);
        const hasEvents = events.length > 0;
        const canExpandEvents = events.length > 1;
        const isExpanded = canExpandEvents && state.trackingExpandedIds.has(id);
        const eventText = String(item.last_event_text || item.summary || "-");
        const eventLocation = String(item.last_event_location || "");
        const source = String(item.source || "");
        const targetUsername = String(item.target_username || "").trim();
        const assigneeHtml = targetUsername ? esc(targetUsername) : `<span class="hint">Ikke tildelt</span>`;
        const error = String(item.error || "");
        const trackingUrl = String(item.tracking_url || "");
        const numberHtml = trackingUrl
          ? `<a href="${esc(trackingUrl)}" target="_blank" rel="noopener">${esc(item.tracking_number)}</a>`
          : esc(item.tracking_number);
        const actionButtons = [
          canExpandEvents
            ? `<button class="btn small" type="button" data-tracking-action="toggle-events" data-tracking-id="${id}" aria-expanded="${isExpanded ? "true" : "false"}">${isExpanded ? "Fold ind" : "Fold ud"}</button>`
            : "",
          isAdmin ? `<button class="btn small" type="button" data-tracking-action="assign-user" data-tracking-id="${id}">Tildel en bruger</button>` : "",
          isAdmin ? `<button class="btn small primary" type="button" data-tracking-action="refresh" data-tracking-id="${id}">Opdater</button>` : "",
          isAdmin ? `<button class="btn danger" type="button" data-tracking-action="delete" data-tracking-id="${id}">Slet</button>` : "",
          isAdmin ? `<button class="btn small" type="button" data-tracking-action="share" data-tracking-id="${id}">Del</button>` : "",
        ].filter(Boolean).join("");
        return `
          <tr>
            <td>${id}</td>
            <td>
              <div class="tracking-number-cell">
                ${numberHtml}
                ${source ? `<span class="hint">${esc(source)}</span>` : ""}
              </div>
            </td>
            <td>${assigneeHtml}</td>
            <td><span class="tracking-status ${statusClass}">${esc(status)}</span></td>
            <td>
              <div class="tracking-event">${esc(eventText)}</div>
              ${eventLocation ? `<div class="hint">${esc(eventLocation)}</div>` : ""}
              ${hasEvents ? `<div class="hint">${events.length} hændelse${events.length === 1 ? "" : "r"} gemt</div>` : ""}
              ${error ? `<div class="tracking-error">${esc(error)}</div>` : ""}
            </td>
            <td>${esc(formatTrackingDate(item.last_checked_at || item.updated_at))}</td>
            <td>
              <div class="tracking-row-actions">
                ${actionButtons || `<span class="hint">-</span>`}
              </div>
            </td>
          </tr>
          ${isExpanded ? `
            <tr class="tracking-events-row">
              <td></td>
              <td colspan="6">
                <div class="tracking-events-wrap">
                  <div class="tracking-events-head">Alle hændelser</div>
                  ${renderTrackingEvents(events)}
                </div>
              </td>
            </tr>
          ` : ""}
        `;
      })
      .join("");
  }

  async function addTracking() {
    if (state.role !== "admin") return;
    const trackingNumber = String((els.trackingNumberInput && els.trackingNumberInput.value) || "").trim();
    if (!trackingNumber) {
      showStatus(els.trackingStatus, "Indtast tracking- eller pakkenummer.", "error");
      if (els.trackingNumberInput) els.trackingNumberInput.focus();
      return;
    }
    if (els.trackingAddBtn) els.trackingAddBtn.disabled = true;
    showStatus(els.trackingStatus, "Tilføjer og henter Bring status...", "ok");
    try {
      const result = await createTrackingEntry(trackingNumber);
      if (els.trackingNumberInput) els.trackingNumberInput.value = "";

      if (result.duplicate) {
        showStatus(els.trackingStatus, "Trackingnummer findes allerede.", "ok");
        return;
      }

      const item = result.item;
      showStatus(
        els.trackingStatus,
        item && item.error ? `Tracking tilføjet, men Bring svarede: ${item.error}` : "Tracking tilføjet og opdateret.",
        item && item.error ? "error" : "ok",
      );
    } catch (err) {
      showStatus(els.trackingStatus, err.message || "Kunne ikke tilføje tracking", "error");
    } finally {
      if (els.trackingAddBtn) els.trackingAddBtn.disabled = false;
    }
  }

  async function refreshTracking(id) {
    if (state.role !== "admin" || !id) return;
    showStatus(els.trackingStatus, "Opdaterer tracking hos Bring...", "ok");
    const data = await api(`/api/admin/tracking/${id}/refresh`, { method: "POST" });
    const item = data && data.item ? data.item : null;
    if (item) {
      const idx = state.tracking.findIndex((entry) => Number(entry.id || 0) === Number(item.id || 0));
      if (idx >= 0) state.tracking[idx] = item;
      else state.tracking.unshift(item);
      renderTracking();
    } else {
      await loadTracking();
    }
    showStatus(
      els.trackingStatus,
      item && item.error ? `Opdateret med fejl: ${item.error}` : "Tracking opdateret.",
      item && item.error ? "error" : "ok",
    );
  }

  async function deleteTracking(id) {
    if (state.role !== "admin" || !id) return;
    if (!window.confirm("Vil du slette dette trackingnummer?")) return;
    await api(`/api/admin/tracking/${id}`, { method: "DELETE" });
    state.tracking = state.tracking.filter((item) => Number(item.id || 0) !== Number(id));
    state.trackingExpandedIds.delete(Number(id));
    renderTracking();
    showStatus(els.trackingStatus, "Tracking slettet.", "ok");
  }

  function closeTrackingAssignModal() {
    state.trackingAssignTrackingId = 0;
    if (els.trackingAssignModal) els.trackingAssignModal.classList.add("hidden");
    if (els.trackingAssignUserSelect) els.trackingAssignUserSelect.innerHTML = "";
    if (els.trackingAssignNumberHint) els.trackingAssignNumberHint.textContent = "-";
    if (els.trackingAssignSaveBtn) els.trackingAssignSaveBtn.disabled = false;
    showStatus(els.trackingAssignStatus, "");
  }

  async function openTrackingAssignModal(id) {
    if (state.role !== "admin" || !id || !els.trackingAssignModal) return;
    const item = state.tracking.find((entry) => Number(entry.id || 0) === Number(id));
    if (!item) {
      throw new Error("Tracking findes ikke");
    }

    state.trackingAssignTrackingId = Number(id);
    if (els.trackingAssignNumberHint) {
      const number = String(item.tracking_number || "").trim() || "-";
      els.trackingAssignNumberHint.textContent = `Tracking: ${number}`;
    }

    if (els.trackingAssignSaveBtn) els.trackingAssignSaveBtn.disabled = true;
    if (els.trackingAssignModal) els.trackingAssignModal.classList.remove("hidden");
    showStatus(els.trackingAssignStatus, "Henter brugere...", "ok");

    try {
      const data = await api("/api/admin/users");
      const users = (Array.isArray(data.items) ? data.items : [])
        .map((u) => ({
          username: String((u && u.username) || "").trim(),
          role: String((u && u.role) || "user").trim().toLowerCase(),
        }))
        .filter((u) => !!u.username)
        .sort((a, b) => a.username.localeCompare(b.username, "da", { sensitivity: "base" }));

      if (els.trackingAssignUserSelect) {
        const optionsHtml = [
          `<option value="">Ikke tildelt</option>`,
          ...users.map((u) => {
            const roleLabel = u.role === "admin" ? "admin" : "bruger";
            return `<option value="${esc(u.username)}">${esc(u.username)} (${roleLabel})</option>`;
          }),
        ].join("");
        els.trackingAssignUserSelect.innerHTML = optionsHtml;
        els.trackingAssignUserSelect.value = String(item.target_username || "").trim();
      }

      showStatus(els.trackingAssignStatus, "");
    } catch (err) {
      showStatus(els.trackingAssignStatus, err.message || "Kunne ikke hente brugerliste", "error");
      throw err;
    } finally {
      if (els.trackingAssignSaveBtn) els.trackingAssignSaveBtn.disabled = false;
    }
  }

  async function saveTrackingAssignee() {
    if (state.role !== "admin") return;
    const trackingId = Number(state.trackingAssignTrackingId || 0);
    if (!trackingId) {
      throw new Error("Tracking findes ikke");
    }

    const targetUsername = String((els.trackingAssignUserSelect && els.trackingAssignUserSelect.value) || "").trim();
    if (els.trackingAssignSaveBtn) els.trackingAssignSaveBtn.disabled = true;
    showStatus(els.trackingAssignStatus, "Gemmer tildeling...", "ok");

    try {
      const data = await api(`/api/admin/tracking/${trackingId}/assign-user`, {
        method: "POST",
        body: { target_username: targetUsername },
      });
      const item = data && data.item ? data.item : null;
      if (item) {
        const idx = state.tracking.findIndex((entry) => Number(entry.id || 0) === Number(item.id || 0));
        if (idx >= 0) state.tracking[idx] = item;
        else state.tracking.unshift(item);
        renderTracking();
      } else {
        await loadTracking();
      }
      const msg = targetUsername
        ? `Tracking er nu tildelt bruger ${targetUsername}.`
        : "Tracking er ikke længere tildelt en bruger.";
      showStatus(els.trackingStatus, msg, "ok");
      closeTrackingAssignModal();
    } finally {
      if (els.trackingAssignSaveBtn) els.trackingAssignSaveBtn.disabled = false;
    }
  }

  function closeTrackingShareModal() {
    if (els.trackingShareModal) els.trackingShareModal.classList.add("hidden");
    if (els.trackingShareLinkInput) els.trackingShareLinkInput.value = "";
    showStatus(els.trackingShareStatus, "");
  }

  async function openTrackingShareModal(id) {
    if (state.role !== "admin" || !id || !els.trackingShareModal) return;
    if (els.trackingShareLinkInput) els.trackingShareLinkInput.value = "";
    els.trackingShareModal.classList.remove("hidden");
    showStatus(els.trackingShareStatus, "Opretter tracking-link...", "ok");
    try {
      const data = await api(`/api/admin/tracking/${id}/share`, { method: "POST" });
      if (els.trackingShareLinkInput) {
        els.trackingShareLinkInput.value = String((data && data.link) || "");
        els.trackingShareLinkInput.focus();
        els.trackingShareLinkInput.select();
      }
      showStatus(els.trackingShareStatus, "Tracking-link er klar.", "ok");
    } catch (err) {
      showStatus(els.trackingShareStatus, err.message || "Kunne ikke oprette tracking-link", "error");
      throw err;
    }
  }

  async function copyTrackingShareLink() {
    const text = String((els.trackingShareLinkInput && els.trackingShareLinkInput.value) || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showStatus(els.trackingShareStatus, "Link kopieret.", "ok");
    } catch {
      if (els.trackingShareLinkInput) {
        els.trackingShareLinkInput.focus();
        els.trackingShareLinkInput.select();
      }
      showStatus(els.trackingShareStatus, "Kunne ikke kopiere automatisk. Linket er markeret.", "error");
    }
  }

  function toggleTrackingEvents(id) {
    if (!id) return;
    if (state.trackingExpandedIds.has(id)) state.trackingExpandedIds.delete(id);
    else state.trackingExpandedIds.add(id);
    renderTracking();
  }

  async function onTrackingTableClick(event) {
    const btn = event.target.closest("[data-tracking-action]");
    if (!btn) return;
    const id = Number(btn.dataset.trackingId || 0);
    const action = String(btn.dataset.trackingAction || "");
    if (action === "toggle-events") toggleTrackingEvents(id);
    if (action === "assign-user") await openTrackingAssignModal(id);
    if (action === "refresh") await refreshTracking(id);
    if (action === "delete") await deleteTracking(id);
    if (action === "share") await openTrackingShareModal(id);
  }

  async function loadAdminLogs() {
    if (state.role !== "admin" || !els.logsTableBody) return;
    try {
      const data = await api("/api/admin/logs?limit=200");
      state.adminLogs = Array.isArray(data.items) ? data.items : [];
      showStatus(els.logsStatus, "");
    } catch (err) {
      state.adminLogs = [];
      showStatus(els.logsStatus, err.message || "Kunne ikke hente logs", "error");
    }
    renderAdminLogs();
  }

  async function loadRejectedFileTypes() {
    if (state.role !== "admin" || !els.rejectedFileTypesTableBody) return;
    try {
      const data = await api("/api/admin/rejected-file-types");
      state.rejectedFileTypes = Array.isArray(data.items) ? data.items : [];
      showStatus(els.rejectedFileTypesStatus, "");
    } catch (err) {
      state.rejectedFileTypes = [];
      showStatus(els.rejectedFileTypesStatus, err.message || "Kunne ikke hente afviste filtyper", "error");
    }
    renderRejectedFileTypes();
  }

  async function clearRejectedFileTypes() {
    if (state.role !== "admin") return;
    if (!window.confirm("Ryd loggen over afviste filtyper?")) return;
    const data = await api("/api/admin/rejected-file-types", { method: "DELETE" });
    const deleted = Math.max(0, Number(data.deleted || 0));
    state.rejectedFileTypes = [];
    renderRejectedFileTypes();
    showStatus(els.rejectedFileTypesStatus, `Afviste filtyper ryddet (${deleted}).`, "ok");
  }

  async function clearAdminLogs() {
    if (state.role !== "admin") return;
    if (!window.confirm("Ryd alle loglinjer? Dette kan ikke fortrydes.")) return;
    const data = await api("/api/admin/logs", { method: "DELETE" });
    const deleted = Math.max(0, Number(data.deleted || 0));
    state.adminLogs = [];
    renderAdminLogs();
    showStatus(els.logsStatus, `Logs ryddet (${deleted}).`, "ok");
  }

  const SLICER_PROFILE_KIND_CONFIG = {
    machine: {
      title: "Printer profil (machine.json)",
      label: "printer-profiler",
      accept: ".json,application/json",
      dropHint: "Træk en eller flere printer-profiler hertil, eller klik for at vælge filer.",
      emptyText: "Ingen printer-profiler uploadet.",
    },
    process: {
      title: "Print settings (process.json)",
      label: "print-settings profiler",
      accept: ".json,application/json",
      dropHint: "Træk en eller flere print-settings profiler hertil, eller klik for at vælge filer.",
      emptyText: "Ingen print-settings profiler uploadet.",
    },
    filament: {
      title: "Filament profil (filament.json)",
      label: "filament-profiler",
      accept: ".json,application/json",
      dropHint: "Træk en eller flere filament-profiler hertil, eller klik for at vælge filer.",
      emptyText: "Ingen filament-profiler uploadet.",
    },
    config: {
      title: "Konfigurationsbundle (INI/CFG)",
      label: "config-bundle",
      accept: ".ini,.cfg,.conf,.txt,text/plain",
      dropHint: "Træk en eller flere config-filer hertil, eller klik for at vælge filer.",
      emptyText: "Ingen config-filer uploadet.",
    },
  };

  function getSlicerProfileKindConfig(kind) {
    const key = String(kind || "").trim().toLowerCase();
    return SLICER_PROFILE_KIND_CONFIG[key] || null;
  }

  function slicerKindUi(kind) {
    const key = String(kind || "").trim().toLowerCase();
    const map = {
      machine: {
        openBtn: els.slicerMachineOpenUploadBtn,
        summaryEl: els.slicerMachineSummary,
        tableBodyEl: els.slicerMachineTableBody,
      },
      process: {
        openBtn: els.slicerProcessOpenUploadBtn,
        summaryEl: els.slicerProcessSummary,
        tableBodyEl: els.slicerProcessTableBody,
      },
      filament: {
        openBtn: els.slicerFilamentOpenUploadBtn,
        summaryEl: els.slicerFilamentSummary,
        tableBodyEl: els.slicerFilamentTableBody,
      },
      config: {
        openBtn: els.slicerConfigOpenUploadBtn,
        summaryEl: els.slicerConfigSummary,
        tableBodyEl: els.slicerConfigTableBody,
      },
    };
    return map[key] || null;
  }

  function slicerMetaText(item) {
    const count = Math.max(0, Number(item && item.count ? item.count : 0));
    if (!item || count <= 0) return "Ingen filer uploadet.";

    const sizeText = formatSize(Number(item.size || 0));
    const updatedText = item.updated_at ? formatDate(item.updated_at) : "-";
    return `Filer: ${count} (${sizeText}, ${updatedText})`;
  }

  function normalizeSlicerFiles(source) {
    if (!source) return [];
    if (Array.isArray(source)) return source.filter(Boolean);
    if (typeof FileList !== "undefined" && source instanceof FileList) return Array.from(source);
    if (source && source.files) return Array.from(source.files || []);
    return [];
  }

  function bedMapBrandOptionsHtml(selectedKey = "bambu-lab") {
    const selected = String(selectedKey || "bambu-lab");
    return BED_MAP_MANUFACTURERS
      .map((entry) => {
        const key = String((entry && entry.key) || "");
        const label = String((entry && entry.name) || key || "-");
        return `<option value="${esc(key)}"${key === selected ? " selected" : ""}>${esc(label)}</option>`;
      })
      .join("");
  }

  function bedMapModelOptionsHtml(brandKey = "bambu-lab", selectedKey = "") {
    const brand = String(brandKey || "bambu-lab");
    const selected = String(selectedKey || "");
    const presets = Array.isArray(BED_MAP_MODEL_PRESETS[brand]) ? BED_MAP_MODEL_PRESETS[brand] : [];
    const options = [
      `<option value="">Vælg model</option>`,
      ...presets.map((entry) => {
        const key = String((entry && entry.key) || "");
        const label = String((entry && entry.name) || key || "-");
        return `<option value="${esc(key)}"${key === selected ? " selected" : ""}>${esc(label)}</option>`;
      }),
      `<option value="${esc(BED_MAP_CUSTOM_MODEL_KEY)}"${selected === BED_MAP_CUSTOM_MODEL_KEY ? " selected" : ""}>Brugerdefineret</option>`,
    ];
    return options.join("");
  }

  function bedMapPresetByKey(modelKey = "") {
    return BED_MAP_MODEL_LOOKUP.get(String(modelKey || "")) || null;
  }

  function guessBedMapModelKeyFromPrinterName(name = "") {
    const n = String(name || "").toLowerCase();
    if (!n) return "";
    if (/\bh2d\b/.test(n)) return "bambu-h2d";
    if (/\ba1\s*mini\b|\ba1mini\b/.test(n)) return "bambu-a1-mini";
    if (/\ba1\b/.test(n)) return "bambu-a1";
    if (/\bp1s\b/.test(n)) return "bambu-p1s";
    if (/\bp1p\b/.test(n)) return "bambu-p1p";
    if (/\bx1e\b/.test(n)) return "bambu-x1e";
    if (/\bx1c\b|\bx1\s*carbon\b/.test(n)) return "bambu-x1-carbon";
    if (/\bx1\b/.test(n)) return "bambu-x1";
    return "";
  }

  function guessBedMapModelKey(name = "", widthMm = 0, depthMm = 0) {
    const w = clampSliceBedSizeMm(widthMm, 0);
    const d = clampSliceBedSizeMm(depthMm, 0);
    if (w > 0 && d > 0) {
      const matches = BAMBU_BED_MODEL_PRESETS.filter((entry) => {
        return Math.abs(Number(entry.width_mm || 0) - w) < 0.01 && Math.abs(Number(entry.depth_mm || 0) - d) < 0.01;
      });
      if (matches.length === 1) return String(matches[0].key || "");
      if (matches.length > 1) {
        const nameGuess = guessBedMapModelKeyFromPrinterName(name);
        if (nameGuess && matches.some((entry) => String(entry.key || "") === nameGuess)) return nameGuess;
        return String(matches[0].key || "");
      }
    }

    const byName = guessBedMapModelKeyFromPrinterName(name);
    if (byName) return byName;
    return (w > 0 && d > 0) ? BED_MAP_CUSTOM_MODEL_KEY : "";
  }

  function getSlicerBedMapRowName(row) {
    return String(row && row.dataset ? row.dataset.bedMapName : "").trim();
  }

  function setSlicerBedMapRowSource(row, sourceLabel = "-") {
    if (!row || !row.dataset) return;
    const source = String(sourceLabel || "-");
    row.dataset.bedMapSource = source;
    const sourceEl = row.querySelector("[data-bed-map-source]");
    if (sourceEl) sourceEl.textContent = source;
  }

  function refreshSlicerBedMapRowValues(row) {
    if (!row || !row.dataset) return;
    const width = clampSliceBedSizeMm(row.dataset.bedMapWidthMm || 0, 0);
    const depth = clampSliceBedSizeMm(row.dataset.bedMapDepthMm || 0, 0);
    const widthEl = row.querySelector("[data-bed-map-width]");
    const depthEl = row.querySelector("[data-bed-map-depth]");
    if (widthEl) widthEl.textContent = width > 0 ? formatNumberCompact(width) : "-";
    if (depthEl) depthEl.textContent = depth > 0 ? formatNumberCompact(depth) : "-";
    row.dataset.bedMapWidthMm = width > 0 ? String(width) : "";
    row.dataset.bedMapDepthMm = depth > 0 ? String(depth) : "";
  }

  function setSlicerBedMapRowSize(row, widthMm, depthMm, sourceLabel = "Preset") {
    if (!row || !row.dataset) return;
    const width = clampSliceBedSizeMm(widthMm, 0);
    const depth = clampSliceBedSizeMm(depthMm, 0);
    row.dataset.bedMapWidthMm = width > 0 ? String(width) : "";
    row.dataset.bedMapDepthMm = depth > 0 ? String(depth) : "";
    refreshSlicerBedMapRowValues(row);
    setSlicerBedMapRowSource(row, sourceLabel);
  }

  function buildSlicerBedMapRowHtml(name, options = {}) {
    const printerName = String(name || "").trim();
    if (!printerName) return "";

    const brandKey = String(options.brandKey || "bambu-lab");
    const widthMm = clampSliceBedSizeMm(options.widthMm, 0);
    const depthMm = clampSliceBedSizeMm(options.depthMm, 0);
    const sourceLabel = String(options.sourceLabel || "-");
    let modelKey = String(options.modelKey || "");
    if (!modelKey && (widthMm > 0 || depthMm > 0)) {
      modelKey = guessBedMapModelKey(printerName, widthMm, depthMm);
    }

    return `
      <tr data-bed-map-name="${esc(printerName)}" data-bed-map-width-mm="${esc(widthMm > 0 ? String(widthMm) : "")}" data-bed-map-depth-mm="${esc(depthMm > 0 ? String(depthMm) : "")}" data-bed-map-source="${esc(sourceLabel)}">
        <td><span class="slicer-bedmap-name">${esc(printerName)}</span></td>
        <td>
          <select class="select" data-bed-map-brand>
            ${bedMapBrandOptionsHtml(brandKey)}
          </select>
        </td>
        <td>
          <select class="select" data-bed-map-model>
            ${bedMapModelOptionsHtml(brandKey, modelKey)}
          </select>
        </td>
        <td><span class="slicer-bedmap-value" data-bed-map-width>${esc(widthMm > 0 ? formatNumberCompact(widthMm) : "-")}</span></td>
        <td><span class="slicer-bedmap-value" data-bed-map-depth>${esc(depthMm > 0 ? formatNumberCompact(depthMm) : "-")}</span></td>
        <td><span data-bed-map-source>${esc(sourceLabel)}</span></td>
        <td>
          <div class="slicer-bedmap-actions">
            <button class="btn small" type="button" data-bed-map-action="edit">Edit</button>
            <button class="btn small danger" type="button" data-bed-map-action="delete">Slet</button>
          </div>
        </td>
      </tr>
    `;
  }

  function ensureSlicerBedMapEmptyState() {
    if (!els.slicerBedMapTableBody) return;
    const rows = Array.from(els.slicerBedMapTableBody.querySelectorAll("tr[data-bed-map-name]"));
    if (rows.length) return;
    els.slicerBedMapTableBody.innerHTML = `<tr><td colspan="7" class="hint">Ingen printere i mapping endnu. Klik på "Tilføj printer".</td></tr>`;
  }

  function findSlicerBedMapRowByName(name = "") {
    const normalized = String(name || "").trim();
    if (!normalized || !els.slicerBedMapTableBody) return null;
    const rows = Array.from(els.slicerBedMapTableBody.querySelectorAll("tr[data-bed-map-name]"));
    return rows.find((row) => getSlicerBedMapRowName(row).toLowerCase() === normalized.toLowerCase()) || null;
  }

  function addSlicerBedMapRow(name, options = {}) {
    const normalizedName = String(name || "").trim().slice(0, 200);
    if (!normalizedName || !els.slicerBedMapTableBody) return null;
    if (findSlicerBedMapRowByName(normalizedName)) return null;

    const emptyHintRow = els.slicerBedMapTableBody.querySelector("tr td.hint");
    if (emptyHintRow) {
      els.slicerBedMapTableBody.innerHTML = "";
    }
    els.slicerBedMapTableBody.insertAdjacentHTML("beforeend", buildSlicerBedMapRowHtml(normalizedName, options));
    const row = findSlicerBedMapRowByName(normalizedName);
    if (row) {
      refreshSlicerBedMapRowValues(row);
      state.slicerBedMapHiddenNames.delete(normalizedName);
    }
    return row;
  }

  function openAddSlicerBedMapPrinterPrompt() {
    const nameRaw = window.prompt("Navn på printerprofil:", "");
    const name = String(nameRaw || "").trim().slice(0, 200);
    if (!name) return;
    if (findSlicerBedMapRowByName(name)) {
      showStatus(els.slicerSettingsStatus, `Printerprofil findes allerede: ${name}`, "error");
      return;
    }
    const guessedModel = guessBedMapModelKeyFromPrinterName(name) || "bambu-a1";
    const preset = bedMapPresetByKey(guessedModel);
    const row = addSlicerBedMapRow(name, {
      brandKey: "bambu-lab",
      modelKey: guessedModel,
      widthMm: preset ? Number(preset.width_mm || 0) : 0,
      depthMm: preset ? Number(preset.depth_mm || 0) : 0,
      sourceLabel: preset ? "Preset" : "Tilføjet",
    });
    if (!row) {
      showStatus(els.slicerSettingsStatus, `Kunne ikke tilføje printerprofil: ${name}`, "error");
      return;
    }
    showStatus(els.slicerSettingsStatus, `Tilføjet printerprofil: ${name}`, "ok");
  }

  function openSlicerBedMapEditModal(row) {
    if (!row || !els.slicerBedMapEditModal) return;
    const name = getSlicerBedMapRowName(row);
    if (!name) return;
    const width = clampSliceBedSizeMm(row.dataset.bedMapWidthMm || 0, DEFAULT_SLICE_BED_SIZE_MM.width_mm);
    const depth = clampSliceBedSizeMm(row.dataset.bedMapDepthMm || 0, DEFAULT_SLICE_BED_SIZE_MM.depth_mm);

    state.currentSlicerBedMapEditName = name;
    if (els.slicerBedMapEditName) els.slicerBedMapEditName.textContent = name;
    if (els.slicerBedMapEditWidthInput) els.slicerBedMapEditWidthInput.value = String(width);
    if (els.slicerBedMapEditDepthInput) els.slicerBedMapEditDepthInput.value = String(depth);
    els.slicerBedMapEditModal.classList.remove("hidden");
  }

  function closeSlicerBedMapEditModal() {
    state.currentSlicerBedMapEditName = "";
    if (els.slicerBedMapEditModal) els.slicerBedMapEditModal.classList.add("hidden");
  }

  function applySlicerBedMapModalEdit() {
    const name = String(state.currentSlicerBedMapEditName || "").trim();
    if (!name) {
      closeSlicerBedMapEditModal();
      return;
    }

    const row = findSlicerBedMapRowByName(name);
    if (!row) {
      closeSlicerBedMapEditModal();
      showStatus(els.slicerSettingsStatus, "Printerprofilen findes ikke længere i tabellen.", "error");
      return;
    }

    const width = clampSliceBedSizeMm((els.slicerBedMapEditWidthInput && els.slicerBedMapEditWidthInput.value) || 0, 0);
    const depth = clampSliceBedSizeMm((els.slicerBedMapEditDepthInput && els.slicerBedMapEditDepthInput.value) || 0, 0);
    if (!(width > 0 && depth > 0)) {
      showStatus(els.slicerSettingsStatus, "Angiv gyldig X og Y mellem 40 og 2000 mm.", "error");
      return;
    }

    setSlicerBedMapRowSize(row, width, depth, "Manuel");
    const modelSelect = row.querySelector("select[data-bed-map-model]");
    const guessedModel = guessBedMapModelKey(name, width, depth);
    if (modelSelect) {
      const options = Array.from(modelSelect.options || []);
      const hasOption = options.some((option) => String(option.value || "") === guessedModel);
      modelSelect.value = hasOption && guessedModel ? guessedModel : BED_MAP_CUSTOM_MODEL_KEY;
      if (!modelSelect.value) modelSelect.value = BED_MAP_CUSTOM_MODEL_KEY;
    }
    closeSlicerBedMapEditModal();
    showStatus(els.slicerSettingsStatus, `Pladestørrelse opdateret for ${name}. Husk at gemme mapping.`, "ok");
  }

  function onSlicerBedMapTableChange(event) {
    const target = event && event.target ? event.target : null;
    if (!target) return;
    const row = target.closest("tr[data-bed-map-name]");
    if (!row) return;

    if (target.matches("select[data-bed-map-brand]")) {
      const brandKey = String(target.value || "bambu-lab");
      const modelSelect = row.querySelector("select[data-bed-map-model]");
      const currentModel = modelSelect ? String(modelSelect.value || "") : "";
      if (modelSelect) {
        modelSelect.innerHTML = bedMapModelOptionsHtml(brandKey, currentModel);
      }
      return;
    }

    if (target.matches("select[data-bed-map-model]")) {
      const modelKey = String(target.value || "");
      const preset = bedMapPresetByKey(modelKey);
      if (preset) {
        setSlicerBedMapRowSize(
          row,
          Number(preset.width_mm || 0),
          Number(preset.depth_mm || 0),
          "Preset"
        );
      } else if (modelKey === BED_MAP_CUSTOM_MODEL_KEY) {
        setSlicerBedMapRowSource(row, "Manuel");
      } else {
        setSlicerBedMapRowSize(row, 0, 0, "-");
        setSlicerBedMapRowSource(row, "-");
      }
    }
  }

  function onSlicerBedMapTableClick(event) {
    const btn = event && event.target && event.target.closest
      ? event.target.closest("button[data-bed-map-action]")
      : null;
    if (!btn) return;
    const row = btn.closest("tr[data-bed-map-name]");
    if (!row) return;

    const action = String(btn.dataset.bedMapAction || "").trim().toLowerCase();
    const name = getSlicerBedMapRowName(row);
    if (!name) return;

    if (action === "edit") {
      openSlicerBedMapEditModal(row);
      return;
    }

    if (action === "delete") {
      if (!window.confirm(`Slet printerprofil '${name}' fra mapping-tabellen?`)) return;
      row.remove();
      state.slicerBedMapHiddenNames.add(name);
      ensureSlicerBedMapEmptyState();
      showStatus(els.slicerSettingsStatus, `Fjernet: ${name}. Husk at gemme mapping.`, "ok");
    }
  }

  function renderSlicerBedMapRows(printers, detectedBeds, mappedBeds, hiddenNames = []) {
    if (!els.slicerBedMapTableBody) return;

    const hiddenSet = new Set(toStringList(hiddenNames).map((value) => String(value || "").trim()).filter(Boolean));
    state.slicerBedMapHiddenNames = hiddenSet;

    const printerNames = Array.from(new Set([
      ...toStringList(printers),
      ...Object.keys(detectedBeds || {}),
      ...Object.keys(mappedBeds || {}),
    ]))
      .map((value) => String(value || "").trim())
      .filter((value) => value && !hiddenSet.has(value));

    if (!printerNames.length) {
      els.slicerBedMapTableBody.innerHTML = "";
      ensureSlicerBedMapEmptyState();
      return;
    }

    printerNames.sort((a, b) => String(a).localeCompare(String(b), "da"));
    els.slicerBedMapTableBody.innerHTML = printerNames
      .map((name) => {
        const mapped = pickSliceBedByProfileName(mappedBeds, name);
        const detected = pickSliceBedByProfileName(detectedBeds, name);
        const active = mapped || detected;
        const widthMm = active ? Number(active.width_mm || 0) : 0;
        const depthMm = active ? Number(active.depth_mm || 0) : 0;
        const sourceLabel = mapped ? "Indstillinger" : (detected ? "Profil" : "-");
        return buildSlicerBedMapRowHtml(name, {
          brandKey: "bambu-lab",
          modelKey: guessBedMapModelKey(name, widthMm, depthMm),
          widthMm,
          depthMm,
          sourceLabel,
        });
      })
      .join("");

    const rows = Array.from(els.slicerBedMapTableBody.querySelectorAll("tr[data-bed-map-name]"));
    rows.forEach((row) => {
      refreshSlicerBedMapRowValues(row);
    });
  }

  function collectSlicerBedMapFromTable() {
    const printer_bed_map = {};
    const rows = Array.from((els.slicerBedMapTableBody && els.slicerBedMapTableBody.querySelectorAll("tr[data-bed-map-name]")) || []);
    const visibleNames = new Set();

    rows.forEach((row) => {
      const name = getSlicerBedMapRowName(row);
      if (!name) return;
      visibleNames.add(name);
      const width = clampSliceBedSizeMm(row.dataset.bedMapWidthMm || 0, 0);
      const depth = clampSliceBedSizeMm(row.dataset.bedMapDepthMm || 0, 0);
      if (width > 0 && depth > 0) {
        printer_bed_map[name] = { width_mm: width, depth_mm: depth };
      }
      state.slicerBedMapHiddenNames.delete(name);
    });

    const printer_bed_hidden = Array.from(state.slicerBedMapHiddenNames)
      .map((value) => String(value || "").trim())
      .filter((value) => value && !visibleNames.has(value))
      .sort((a, b) => a.localeCompare(b, "da"));

    return { printer_bed_map, printer_bed_hidden };
  }

  async function saveSlicerBedMap() {
    if (state.role !== "admin") return;
    const payload = collectSlicerBedMapFromTable();
    const data = await api("/api/settings/slicer-profiles", {
      method: "POST",
      body: payload,
    });
    state.slicerSettings = data && typeof data === "object" ? data : {};
    state.sliceProfiles = null;
    renderSlicerSettings();
    const count = Object.keys(payload.printer_bed_map).length;
    const hiddenCount = payload.printer_bed_hidden.length;
    showStatus(els.slicerSettingsStatus, `Printer-mapping gemt (${count} profiler, skjult ${hiddenCount}).`, "ok");
  }

  async function resetSlicerBedMap() {
    if (state.role !== "admin") return;
    if (!window.confirm("Nulstil alle gemte printer-pladestørrelser?")) return;
    const data = await api("/api/settings/slicer-profiles", {
      method: "POST",
      body: { printer_bed_map: {}, printer_bed_hidden: [] },
    });
    state.slicerSettings = data && typeof data === "object" ? data : {};
    state.sliceProfiles = null;
    state.slicerBedMapHiddenNames = new Set();
    renderSlicerSettings();
    showStatus(els.slicerSettingsStatus, "Printer-mapping nulstillet.", "ok");
  }

  function renderSlicerSettings() {
    const data = state.slicerSettings && typeof state.slicerSettings === "object" ? state.slicerSettings : {};
    const items = data.items && typeof data.items === "object" ? data.items : {};
    const effective = data.effective && typeof data.effective === "object" ? data.effective : {};
    const profiles = data.profiles && typeof data.profiles === "object" ? data.profiles : {};
    const printerNames = toStringList(profiles.printers);
    const detectedBeds = parseSlicePrinterBeds(profiles.printer_beds);
    const mappedBeds = parseSlicePrinterBeds(data.printer_bed_map);
    const hiddenNames = toStringList(data.printer_bed_hidden);

    renderSlicerFilesTable("machine", items.machine);
    renderSlicerFilesTable("process", items.process);
    renderSlicerFilesTable("filament", items.filament);
    renderSlicerFilesTable("config", items.config);

    renderSlicerBedMapRows(printerNames, detectedBeds, mappedBeds, hiddenNames);

    if (els.slicerEffectiveInfo) {
      const lines = [
        `Effektiv config: ${String(effective.config_path || "(ingen)")}`,
        `Effektiv settings: ${String(effective.load_settings || "(auto)")}`,
        `Effektiv filament: ${String(effective.load_filaments || "(auto)")}`,
        `Printer-mapping: ${String(Object.keys(mappedBeds).length)}`,
        `Skjult i tabel: ${String(hiddenNames.length)}`,
      ];
      els.slicerEffectiveInfo.textContent = lines.join(" | ");
    }
  }

  function renderSlicerFilesTable(kind, item) {
    const config = getSlicerProfileKindConfig(kind);
    const ui = slicerKindUi(kind);
    if (!config || !ui) return;

    if (ui.summaryEl) {
      ui.summaryEl.textContent = slicerMetaText(item);
    }
    if (!ui.tableBodyEl) return;

    const files = Array.isArray(item && item.files) ? item.files : [];
    if (!files.length) {
      ui.tableBodyEl.innerHTML = `<tr><td colspan="4" class="hint">${esc(config.emptyText)}</td></tr>`;
      return;
    }

    ui.tableBodyEl.innerHTML = files
      .map((entry) => {
        const name = String((entry && entry.name) || "").trim();
        const size = formatSize(Number((entry && entry.size) || 0));
        const updated = entry && entry.updated_at ? formatDate(entry.updated_at) : "-";
        const disabledAttr = name ? "" : " disabled";
        return `
          <tr>
            <td>${esc(name || "-")}</td>
            <td>${esc(size)}</td>
            <td>${esc(updated)}</td>
            <td>
              <button class="btn small danger" type="button" data-slicer-delete-kind="${esc(kind)}" data-slicer-delete-file="${esc(name)}"${disabledAttr}>Slet</button>
            </td>
          </tr>
        `;
      })
      .join("");

    const omitted = Math.max(0, Number(item && item.omitted ? item.omitted : 0));
    if (omitted > 0) {
      ui.tableBodyEl.insertAdjacentHTML("beforeend", `<tr><td colspan="4" class="hint">Viser de nyeste ${files.length} filer. ${omitted} ældre filer er skjult.</td></tr>`);
    }
  }

  async function loadSlicerSettings() {
    if (state.role !== "admin") return null;
    const data = await api("/api/settings/slicer-profiles");
    state.slicerSettings = data && typeof data === "object" ? data : {};
    renderSlicerSettings();
    showStatus(els.slicerSettingsStatus, "");
    return state.slicerSettings;
  }

  async function uploadSlicerFile(kind, fileSource, label) {
    if (state.role !== "admin") return;
    const files = normalizeSlicerFiles(fileSource);
    if (!files.length) {
      showStatus(els.slicerSettingsStatus, `Vælg mindst én fil for ${label}.`, "error");
      return;
    }

    const formData = new FormData();
    formData.append("kind", String(kind || ""));
    files.forEach((file) => {
      formData.append("file", file, (file && file.name) || "profil");
    });

    const data = await api("/api/settings/slicer-profiles", { method: "POST", body: formData });
    state.slicerSettings = data && typeof data === "object" ? data : {};
    renderSlicerSettings();
    state.sliceProfiles = null;
    if (fileSource && fileSource.files) fileSource.value = "";

    const uploadedCount = Math.max(0, Number(data && data.uploaded_count ? data.uploaded_count : files.length));
    const fileWord = uploadedCount === 1 ? "fil" : "filer";
    showStatus(els.slicerSettingsStatus, `${uploadedCount} ${fileWord} uploadet til ${label}.`, "ok");
  }

  async function deleteSlicerFile(kind, label, fileName = "") {
    if (state.role !== "admin") return;
    const normalizedFileName = String(fileName || "").trim();
    const isSingleFile = Boolean(normalizedFileName);
    const confirmText = isSingleFile
      ? `Slet filen '${normalizedFileName}' fra ${label}?`
      : `Slet alle filer i ${label}?`;
    if (!window.confirm(confirmText)) return;

    const params = new URLSearchParams();
    params.set("kind", String(kind || ""));
    if (isSingleFile) params.set("filename", normalizedFileName);

    const data = await api(`/api/settings/slicer-profiles?${params.toString()}`, {
      method: "DELETE",
    });
    state.slicerSettings = data && typeof data === "object" ? data : {};
    renderSlicerSettings();
    state.sliceProfiles = null;

    const deletedCount = Math.max(0, Number(data && data.deleted_count ? data.deleted_count : 0));
    if (deletedCount <= 0) {
      if (isSingleFile) {
        showStatus(els.slicerSettingsStatus, `Filen blev ikke fundet i ${label}.`, "ok");
      } else {
        showStatus(els.slicerSettingsStatus, `Ingen filer at slette i ${label}.`, "ok");
      }
      return;
    }

    if (isSingleFile) {
      showStatus(els.slicerSettingsStatus, `Fil slettet fra ${label}: ${normalizedFileName}`, "ok");
      return;
    }

    const fileWord = deletedCount === 1 ? "fil" : "filer";
    showStatus(els.slicerSettingsStatus, `${deletedCount} ${fileWord} slettet fra ${label}.`, "ok");
  }

  function renderSlicerUploadSelectedFiles() {
    if (!els.slicerUploadSelectedFiles) return;
    const files = normalizeSlicerFiles(state.currentSlicerUploadFiles);
    if (!files.length) {
      els.slicerUploadSelectedFiles.textContent = "Ingen filer valgt.";
      return;
    }
    const preview = files
      .slice(0, 6)
      .map((file) => String((file && file.name) || "").trim())
      .filter(Boolean)
      .join(", ");
    const omitted = files.length > 6 ? ` (+${files.length - 6} mere)` : "";
    els.slicerUploadSelectedFiles.textContent = `${files.length} filer valgt: ${preview}${omitted}`;
  }

  function setSlicerUploadFiles(fileSource) {
    state.currentSlicerUploadFiles = normalizeSlicerFiles(fileSource);
    renderSlicerUploadSelectedFiles();
    showStatus(els.slicerUploadModalStatus, "");
  }

  function closeSlicerUploadModal() {
    state.currentSlicerUploadKind = "";
    state.currentSlicerUploadFiles = [];
    if (els.slicerUploadInput) els.slicerUploadInput.value = "";
    if (els.slicerUploadDropZone) {
      els.slicerUploadDropZone.classList.remove("dragover");
    }
    renderSlicerUploadSelectedFiles();
    showStatus(els.slicerUploadModalStatus, "");
    if (els.slicerUploadModal) {
      els.slicerUploadModal.classList.add("hidden");
    }
  }

  function openSlicerUploadModal(kind) {
    const config = getSlicerProfileKindConfig(kind);
    if (!config || !els.slicerUploadModal) return;

    state.currentSlicerUploadKind = String(kind || "").trim().toLowerCase();
    state.currentSlicerUploadFiles = [];

    if (els.slicerUploadModalTitle) {
      els.slicerUploadModalTitle.textContent = `Upload: ${config.title}`;
    }
    if (els.slicerUploadModalHint) {
      els.slicerUploadModalHint.textContent = config.dropHint;
    }
    if (els.slicerUploadDropZone) {
      els.slicerUploadDropZone.textContent = config.dropHint;
      els.slicerUploadDropZone.classList.remove("dragover");
    }
    if (els.slicerUploadInput) {
      els.slicerUploadInput.accept = config.accept;
      els.slicerUploadInput.value = "";
    }
    if (els.slicerUploadConfirmBtn) {
      els.slicerUploadConfirmBtn.disabled = false;
    }

    showStatus(els.slicerUploadModalStatus, "");
    renderSlicerUploadSelectedFiles();
    els.slicerUploadModal.classList.remove("hidden");
  }

  async function submitSlicerUploadModal() {
    const kind = String(state.currentSlicerUploadKind || "").trim().toLowerCase();
    const config = getSlicerProfileKindConfig(kind);
    if (!kind || !config) {
      closeSlicerUploadModal();
      return;
    }

    const files = normalizeSlicerFiles(state.currentSlicerUploadFiles);
    if (!files.length) {
      showStatus(els.slicerUploadModalStatus, `Vælg mindst én fil for ${config.label}.`, "error");
      return;
    }

    if (els.slicerUploadConfirmBtn) {
      els.slicerUploadConfirmBtn.disabled = true;
    }

    try {
      await uploadSlicerFile(kind, files, config.label);
      closeSlicerUploadModal();
    } catch (err) {
      showStatus(els.slicerUploadModalStatus, err.message || `Kunne ikke uploade filer til ${config.label}`, "error");
    } finally {
      if (els.slicerUploadConfirmBtn) {
        els.slicerUploadConfirmBtn.disabled = false;
      }
    }
  }

  async function onSlicerProfileTableClick(event) {
    const deleteBtn = event && event.target && event.target.closest
      ? event.target.closest("button[data-slicer-delete-kind][data-slicer-delete-file]")
      : null;
    if (!deleteBtn) return;

    const kind = String(deleteBtn.dataset.slicerDeleteKind || "").trim().toLowerCase();
    const fileName = String(deleteBtn.dataset.slicerDeleteFile || "").trim();
    const config = getSlicerProfileKindConfig(kind);
    if (!config || !fileName) return;

    await deleteSlicerFile(kind, config.label, fileName);
  }

  function bindSlicerUploadModalDropZone() {
    if (!els.slicerUploadDropZone) return;
    const zone = els.slicerUploadDropZone;

    zone.addEventListener("click", () => {
      if (!els.slicerUploadInput) return;
      els.slicerUploadInput.click();
    });
    zone.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!els.slicerUploadInput) return;
      els.slicerUploadInput.click();
    });

    zone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      event.stopPropagation();
      globalDropDepth = 0;
      hideGlobalDropOverlay();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
      globalDropDepth = 0;
      hideGlobalDropOverlay();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", (event) => {
      event.stopPropagation();
      zone.classList.remove("dragover");
    });
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      globalDropDepth = 0;
      hideGlobalDropOverlay();
      zone.classList.remove("dragover");
      const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
      setSlicerUploadFiles(files);
    });
  }

  function bindSlicerProfileCardDropZones() {
    const cards = Array.isArray(els.slicerProfileCards) ? els.slicerProfileCards : [];
    if (!cards.length) return;

    cards.forEach((card) => {
      if (!card || card.dataset.dropBound === "1") return;
      const kind = String((card.dataset && card.dataset.slicerUploadKind) || "").trim().toLowerCase();
      const config = getSlicerProfileKindConfig(kind);
      if (!config) return;

      card.dataset.dropBound = "1";
      card.addEventListener("dragenter", (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        card.classList.add("dragover");
      });
      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        card.classList.add("dragover");
      });
      card.addEventListener("dragleave", (event) => {
        event.stopPropagation();
        card.classList.remove("dragover");
      });
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        card.classList.remove("dragover");
        const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []).filter(Boolean);
        if (!files.length) return;
        uploadSlicerFile(kind, files, config.label).catch((err) => {
          showStatus(els.slicerSettingsStatus, err.message || `Kunne ikke uploade filer til ${config.label}`, "error");
        });
      });
    });
  }

  function renderAdminLogs() {
    if (!els.logsTableBody) return;
    const list = Array.isArray(state.adminLogs) ? state.adminLogs : [];
    if (!list.length) {
      els.logsTableBody.innerHTML = `<tr><td colspan="6" class="hint">Ingen loghændelser fundet.</td></tr>`;
      return;
    }

    els.logsTableBody.innerHTML = list
      .map((entry) => {
        const timeText = formatDate(entry.timestamp || "");
        const kind = String(entry.kind_label || entry.kind || "Log");
        const target = String(entry.target || "-");
        const folder = String(entry.folder_path || "-");
        const message = String(entry.message || "-");
        const action = String(entry.action_label || entry.action || "").trim();
        const actor = String(entry.actor || "").trim();
        const levelRaw = String(entry.level || "").toLowerCase();
        const isError = levelRaw === "error"
          || String(entry.action || "").toLowerCase() === "error"
          || /\b(error|fejl|failed|failure)\b/i.test(message);
        const statusText = isError ? "Error" : "Success";
        const statusClass = isError ? "error" : "success";

        let description = message;
        if (actor && actor.toLowerCase() !== "system") {
          description = `[${actor}] ${description}`;
        }
        if (action && action.toLowerCase() !== "event") {
          description = `${action}: ${description}`;
        }

        return `
          <tr>
            <td>${esc(timeText)}</td>
            <td class="log-entry-status"><span class="log-status-pill log-status-${esc(statusClass)}">${esc(statusText)}</span></td>
            <td class="log-entry-type">${esc(kind)}</td>
            <td class="log-entry-target">${esc(target)}</td>
            <td class="log-entry-folder">${esc(folder)}</td>
            <td class="log-entry-message">${esc(description)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderRejectedFileTypes() {
    if (!els.rejectedFileTypesTableBody) return;
    const list = Array.isArray(state.rejectedFileTypes) ? state.rejectedFileTypes : [];
    if (!list.length) {
      els.rejectedFileTypesTableBody.innerHTML = `<tr><td colspan="7" class="hint">Ingen afviste filtyper logget endnu.</td></tr>`;
      return;
    }

    els.rejectedFileTypesTableBody.innerHTML = list
      .map((item) => {
        const ext = String(item.ext || "(ingen)");
        const count = Math.max(0, Number(item.count || 0));
        const filename = String(item.filename || "-");
        const reason = String(item.reason || "-");
        const context = String(item.context || "-").replace(/-/g, " ");
        const actor = String(item.actor || "-");
        const latest = formatDate(item.created_at || "");
        return `
          <tr>
            <td class="rejected-file-type-ext">${esc(ext)}</td>
            <td>${count}</td>
            <td>${esc(filename)}</td>
            <td>${esc(reason)}</td>
            <td>${esc(context)}</td>
            <td>${esc(actor)}</td>
            <td>${esc(latest)}</td>
          </tr>
        `;
      })
      .join("");
  }

  async function ensureThreeModules() {
    if (state.threeModules) return state.threeModules;
    const sources = [
      {
        three: "https://esm.sh/three@0.166.1",
        orbit: "https://esm.sh/three@0.166.1/examples/jsm/controls/OrbitControls.js",
        transform: "https://esm.sh/three@0.166.1/examples/jsm/controls/TransformControls.js",
        fly: "https://esm.sh/three@0.166.1/examples/jsm/controls/FlyControls.js",
        stl: "https://esm.sh/three@0.166.1/examples/jsm/loaders/STLLoader.js",
        obj: "https://esm.sh/three@0.166.1/examples/jsm/loaders/OBJLoader.js",
      },
      {
        three: "https://cdn.jsdelivr.net/npm/three@0.166.1/+esm",
        orbit: "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/OrbitControls.js/+esm",
        transform: "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/TransformControls.js/+esm",
        fly: "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/FlyControls.js/+esm",
        stl: "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/STLLoader.js/+esm",
        obj: "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/OBJLoader.js/+esm",
      },
    ];

    let lastErr = null;
    for (const src of sources) {
      try {
        const THREE = await import(src.three);
        const [{ OrbitControls }, { TransformControls }, { FlyControls }, { STLLoader }, { OBJLoader }] = await Promise.all([
          import(src.orbit),
          import(src.transform),
          import(src.fly),
          import(src.stl),
          import(src.obj),
        ]);
        state.threeModules = { THREE, OrbitControls, TransformControls, FlyControls, STLLoader, OBJLoader };
        return state.threeModules;
      } catch (err) {
        lastErr = err;
      }
    }

    const message = lastErr && lastErr.message ? lastErr.message : "Ukendt importfejl";
    throw new Error(`Kunne ikke indlæse 3D biblioteker: ${message}`);
  }

  function cleanupThree() {
    if (!state.three) return;
    const t = state.three;
    if (t.frameId) cancelAnimationFrame(t.frameId);
    if (t.controls && typeof t.controls.dispose === "function") t.controls.dispose();
    if (t.renderer) t.renderer.dispose();
    if (t.onResize) window.removeEventListener("resize", t.onResize);
    if (t.onKeyDown) window.removeEventListener("keydown", t.onKeyDown);
    if (t.onKeyUp) window.removeEventListener("keyup", t.onKeyUp);
    if (t.onBlur) window.removeEventListener("blur", t.onBlur);
    if (t.onMouseDown && t.canvas) t.canvas.removeEventListener("mousedown", t.onMouseDown);
    if (t.onMouseMove) window.removeEventListener("mousemove", t.onMouseMove);
    if (t.onMouseUp) window.removeEventListener("mouseup", t.onMouseUp);
    if (t.onMouseLeave && t.canvas) t.canvas.removeEventListener("mouseleave", t.onMouseLeave);
    if (t.onWheel && t.canvas) t.canvas.removeEventListener("wheel", t.onWheel);
    if (t.onContextMenu && t.canvas) t.canvas.removeEventListener("contextmenu", t.onContextMenu);
    state.three = null;
  }

  async function open3DModal(file) {
    if (!file || !els.modelModal) return;
    const loadToken = Number(state.modelPreviewLoadToken || 0) + 1;
    state.modelPreviewLoadToken = loadToken;
    const isActiveLoad = () => Number(state.modelPreviewLoadToken || 0) === loadToken;

    state.modelModalCloseGuardUntil = 0;
    cleanupThree();
    if (els.modelViewer) els.modelViewer.removeAttribute("src");
    setModelPreviewLoading(false);

    if (els.modelTitle) els.modelTitle.textContent = `3D: ${file.filename || ""}`;
    setModelHintMessage("");
    updateModelInfoBar({
      controls: modelControlsText(),
      height: "Måler...",
      scale: `Dåse ${SCALE_CAN_HEIGHT_MM}x${SCALE_CAN_DIAMETER_MM} mm`,
    });
    els.modelModal.classList.remove("hidden");

    const ext = String(file.ext || "").toLowerCase();
    if (ext === ".glb" || ext === ".gltf") {
      if (els.modelViewerPane) els.modelViewerPane.classList.remove("hidden");
      if (els.threePane) els.threePane.classList.add("hidden");
      setModelPreviewLoading(true, "viewer");
      if (els.modelViewer) {
        const viewer = els.modelViewer;
        viewer.setAttribute("environment-image", "neutral");
        viewer.setAttribute("shadow-intensity", "1.25");
        viewer.setAttribute("shadow-softness", "0.95");
        viewer.style.background = "transparent";

        const onLoad = () => {
          viewer.removeEventListener("error", onError);
          if (!isActiveLoad()) return;
          setModelPreviewLoading(false);

          let height = 0;
          try {
            if (typeof viewer.getDimensions === "function") {
              const dims = viewer.getDimensions();
              if (dims && Number.isFinite(Number(dims.y))) {
                height = Number(dims.y);
              }
            }
          } catch (_err) {
            height = 0;
          }
          const unitContext = GLTF_UNIT_CONTEXT;
          const heightLabel = formatHeightDisplayValue(height, unitContext);
          updateModelInfoBar({
            controls: modelControlsText(),
            height: heightLabel,
            scale: "Reference-dåse vises i STL/OBJ preview",
          });
          const extraHints = [buildUnitHintText(unitContext)];
          if (els.modelHint) els.modelHint.textContent = buildModelHint(height, extraHints, modelControlsText(), unitContext);
        };

        const onError = () => {
          viewer.removeEventListener("load", onLoad);
          if (!isActiveLoad()) return;
          setModelPreviewLoading(false);
          updateModelInfoBar({
            controls: "Kunne ikke åbne model",
            height: "-",
            scale: "-",
          });
          setModelHintMessage("Kunne ikke åbne 3D filen i preview.");
        };

        viewer.addEventListener("load", onLoad, { once: true });
        viewer.addEventListener("error", onError, { once: true });
        viewer.setAttribute("src", file.content_url || "");
      } else {
        setModelPreviewLoading(false);
      }
      updateModelInfoBar({
        controls: modelControlsText(),
        height: "Måler...",
        scale: "Reference-dåse vises i STL/OBJ preview",
      });
      if (els.modelHint) els.modelHint.textContent = `${buildModelHint()} Måler model...`;
      return;
    }

    if (!(ext === ".stl" || ext === ".obj")) {
      setModelPreviewLoading(false);
      if (els.modelViewerPane) els.modelViewerPane.classList.add("hidden");
      if (els.threePane) els.threePane.classList.add("hidden");
      updateModelInfoBar({
        controls: "Preview ikke understøttet",
        height: "-",
        scale: "-",
      });
      setModelHintMessage("Denne 3D filtype er ikke understøttet i preview endnu.");
      return;
    }

    if (els.modelViewerPane) els.modelViewerPane.classList.add("hidden");
    if (els.threePane) els.threePane.classList.remove("hidden");
    setModelPreviewLoading(true, "three");
    if (els.modelViewer) els.modelViewer.removeAttribute("src");

    let modules;
    try {
      modules = await ensureThreeModules();
    } catch (err) {
      if (!isActiveLoad()) return;
      setModelPreviewLoading(false);
      updateModelInfoBar({
        controls: "Kunne ikke indlæse viewer",
        height: "-",
        scale: "-",
      });
      setModelHintMessage(`Kunne ikke indlæse 3D viewer: ${err.message || err}`);
      return;
    }
    if (!isActiveLoad()) return;
    const { THREE, OrbitControls, STLLoader, OBJLoader } = modules;

    cleanupThree();

    if (!els.threeCanvas || !els.threePane) {
      setModelPreviewLoading(false);
      return;
    }
    const canvas = els.threeCanvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
    camera.position.set(2, 2, 2);
    camera.up.set(0, 1, 0);

    canvas.style.touchAction = "none";
    let controls = null;
    let controlsHintText = modelControlsText("fly");
    let updateControls = () => {};
    let handleControlsResize = () => {};
    let applyControlTarget = (_center, _radius) => {};
    let onFlyKeyDown = null;
    let onFlyKeyUp = null;
    let onFlyBlur = null;
    let onFlyMouseDown = null;
    let onFlyMouseMove = null;
    let onFlyMouseUp = null;
    let onFlyMouseLeave = null;
    let onFlyWheel = null;
    let onFlyContextMenu = null;
    let baseMoveSpeed = 120;
    let orbitPickObjects = [];
    const orbitFallbackTarget = new THREE.Vector3();

    const isTouchPrimary = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    if (isTouchPrimary) {
      controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.rotateSpeed = 0.92;
      controls.zoomSpeed = 0.95;
      controls.touches.ONE = THREE.TOUCH.ROTATE;
      controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
      controlsHintText = modelControlsText("orbit");
      updateControls = () => controls.update();
      handleControlsResize = () => {};
      applyControlTarget = (center) => {
        if (controls && controls.target) {
          controls.target.copy(center);
          controls.update();
        }
      };
    } else {
      canvas.tabIndex = 0;
      canvas.style.outline = "none";
      const flyState = {
        dragging: false,
        dragMode: "",
        dragMoved: false,
        lastX: 0,
        lastY: 0,
        yaw: 0,
        pitch: 0,
        orbitTarget: new THREE.Vector3(),
        orbitSpherical: new THREE.Spherical(1, Math.PI / 2, 0),
        speedBoost: 1,
        keys: {
          forward: false,
          back: false,
          left: false,
          right: false,
          up: false,
          down: false,
        },
      };

      controls = {
        dispose() {},
      };

      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      const forwardVec = new THREE.Vector3();
      const rightVec = new THREE.Vector3();
      const worldUp = new THREE.Vector3(0, 1, 0);
      const orbitRaycaster = new THREE.Raycaster();
      const orbitPointer = new THREE.Vector2();
      const orbitOffset = new THREE.Vector3();

      const syncYawPitchFromCamera = () => {
        euler.setFromQuaternion(camera.quaternion, "YXZ");
        flyState.yaw = euler.y;
        flyState.pitch = euler.x;
      };

      const applyYawPitch = () => {
        const maxPitch = (Math.PI / 2) - 0.01;
        flyState.pitch = Math.max(-maxPitch, Math.min(maxPitch, flyState.pitch));
        euler.set(flyState.pitch, flyState.yaw, 0, "YXZ");
        camera.quaternion.setFromEuler(euler);
      };

      const movementFromKeys = () => {
        const dir = new THREE.Vector3(
          (flyState.keys.right ? 1 : 0) - (flyState.keys.left ? 1 : 0),
          (flyState.keys.up ? 1 : 0) - (flyState.keys.down ? 1 : 0),
          (flyState.keys.forward ? 1 : 0) - (flyState.keys.back ? 1 : 0)
        );
        if (dir.lengthSq() > 1) dir.normalize();
        return dir;
      };

      const pickOrbitTargetFromEvent = (event) => {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Number(rect.width || 1));
        const height = Math.max(1, Number(rect.height || 1));
        const x = ((Number(event.clientX || 0) - rect.left) / width) * 2 - 1;
        const y = -(((Number(event.clientY || 0) - rect.top) / height) * 2 - 1);
        orbitPointer.set(x, y);
        orbitRaycaster.setFromCamera(orbitPointer, camera);
        if (Array.isArray(orbitPickObjects) && orbitPickObjects.length) {
          const hits = orbitRaycaster.intersectObjects(orbitPickObjects, true);
          if (hits && hits.length && hits[0] && hits[0].point) {
            return hits[0].point;
          }
        }
        return orbitFallbackTarget;
      };

      const beginOrbitDrag = (event) => {
        const target = pickOrbitTargetFromEvent(event);
        flyState.orbitTarget.copy(target);
        orbitOffset.copy(camera.position).sub(flyState.orbitTarget);
        if (orbitOffset.lengthSq() < 1e-8) orbitOffset.set(0, 0, 1);
        flyState.orbitSpherical.setFromVector3(orbitOffset);
      };

      syncYawPitchFromCamera();

      onFlyKeyDown = (event) => {
        if (!event) return;
        const key = String(event.key || "");
        if (key === "Shift") {
          flyState.speedBoost = 2.7;
          return;
        }
        if (key === "w" || key === "W" || key === "ArrowUp") {
          flyState.keys.forward = true;
          event.preventDefault();
          return;
        }
        if (key === "s" || key === "S" || key === "ArrowDown") {
          flyState.keys.back = true;
          event.preventDefault();
          return;
        }
        if (key === "a" || key === "A" || key === "ArrowLeft") {
          flyState.keys.left = true;
          event.preventDefault();
          return;
        }
        if (key === "d" || key === "D" || key === "ArrowRight") {
          flyState.keys.right = true;
          event.preventDefault();
          return;
        }
        if (key === "r" || key === "R") {
          flyState.keys.up = true;
          event.preventDefault();
          return;
        }
        if (key === "f" || key === "F") {
          flyState.keys.down = true;
          event.preventDefault();
        }
      };

      onFlyKeyUp = (event) => {
        if (!event) return;
        const key = String(event.key || "");
        if (key === "Shift") {
          flyState.speedBoost = 1;
          return;
        }
        if (key === "w" || key === "W" || key === "ArrowUp") {
          flyState.keys.forward = false;
          event.preventDefault();
          return;
        }
        if (key === "s" || key === "S" || key === "ArrowDown") {
          flyState.keys.back = false;
          event.preventDefault();
          return;
        }
        if (key === "a" || key === "A" || key === "ArrowLeft") {
          flyState.keys.left = false;
          event.preventDefault();
          return;
        }
        if (key === "d" || key === "D" || key === "ArrowRight") {
          flyState.keys.right = false;
          event.preventDefault();
          return;
        }
        if (key === "r" || key === "R") {
          flyState.keys.up = false;
          event.preventDefault();
          return;
        }
        if (key === "f" || key === "F") {
          flyState.keys.down = false;
          event.preventDefault();
        }
      };

      onFlyMouseDown = (event) => {
        if (!event) return;
        const button = Number(event.button);
        if (button !== 0 && button !== 2) return;
        flyState.dragging = true;
        flyState.dragMode = button === 2 ? "orbit" : "look";
        flyState.dragMoved = false;
        flyState.lastX = Number(event.clientX || 0);
        flyState.lastY = Number(event.clientY || 0);
        if (flyState.dragMode === "orbit") {
          beginOrbitDrag(event);
        }
        canvas.focus({ preventScroll: true });
        event.preventDefault();
      };

      onFlyMouseMove = (event) => {
        if (!event || !flyState.dragging) return;
        const currentX = Number(event.clientX || 0);
        const currentY = Number(event.clientY || 0);
        const dx = currentX - flyState.lastX;
        const dy = currentY - flyState.lastY;
        if (Math.abs(dx) + Math.abs(dy) >= 2) {
          flyState.dragMoved = true;
        }
        flyState.lastX = currentX;
        flyState.lastY = currentY;

        if (flyState.dragMode === "orbit") {
          const orbitSensitivity = 0.0046;
          flyState.orbitSpherical.theta -= dx * orbitSensitivity;
          flyState.orbitSpherical.phi -= dy * orbitSensitivity;
          const minPhi = 0.03;
          const maxPhi = Math.PI - 0.03;
          flyState.orbitSpherical.phi = Math.max(minPhi, Math.min(maxPhi, flyState.orbitSpherical.phi));
          orbitOffset.setFromSpherical(flyState.orbitSpherical);
          camera.position.copy(flyState.orbitTarget).add(orbitOffset);
          camera.lookAt(flyState.orbitTarget);
          syncYawPitchFromCamera();
          return;
        }

        const lookSensitivity = 0.0024;
        flyState.yaw -= dx * lookSensitivity;
        flyState.pitch -= dy * lookSensitivity;
        applyYawPitch();
      };

      onFlyBlur = () => {
        flyState.speedBoost = 1;
        flyState.dragging = false;
        flyState.dragMode = "";
        flyState.keys.forward = false;
        flyState.keys.back = false;
        flyState.keys.left = false;
        flyState.keys.right = false;
        flyState.keys.up = false;
        flyState.keys.down = false;
      };

      onFlyMouseUp = () => {
        if (flyState.dragging && flyState.dragMoved) {
          state.modelModalCloseGuardUntil = Date.now() + 280;
        }
        flyState.dragging = false;
        flyState.dragMode = "";
        flyState.dragMoved = false;
      };

      onFlyMouseLeave = () => {
        flyState.dragging = false;
        flyState.dragMode = "";
        flyState.dragMoved = false;
      };

      onFlyWheel = (event) => {
        if (!event) return;
        const delta = Number(event.deltaY || 0);
        if (!Number.isFinite(delta) || delta === 0) return;

        event.preventDefault();

        const wheelFactor = Math.max(0.35, Math.min(2.4, Math.abs(delta) / 100));
        const direction = delta < 0 ? 1 : -1;

        const orbitAnchor = flyState.dragMode === "orbit"
          ? flyState.orbitTarget
          : orbitFallbackTarget;
        const distanceToAnchor = Math.max(0.001, camera.position.distanceTo(orbitAnchor));
        const baseStep = Math.max(distanceToAnchor * 0.12, 1.0);
        const signedStep = direction * baseStep * wheelFactor;

        if (flyState.dragMode === "orbit") {
          orbitOffset.copy(camera.position).sub(flyState.orbitTarget);
          let currentDistance = orbitOffset.length();
          if (!Number.isFinite(currentDistance) || currentDistance <= 0) {
            currentDistance = distanceToAnchor;
          }
          const minDistance = Math.max((camera.near || 0.01) * 4, 0.04);
          const maxDistance = Math.max(minDistance * 2, (camera.far || 100) * 0.45);
          const nextDistance = Math.max(minDistance, Math.min(maxDistance, currentDistance - signedStep));
          if (orbitOffset.lengthSq() < 1e-8) {
            orbitOffset.set(0, 0, nextDistance);
          } else {
            orbitOffset.setLength(nextDistance);
          }
          camera.position.copy(flyState.orbitTarget).add(orbitOffset);
          camera.lookAt(flyState.orbitTarget);
          syncYawPitchFromCamera();
          return;
        }

        camera.getWorldDirection(forwardVec);
        forwardVec.normalize();
        camera.position.addScaledVector(forwardVec, signedStep);
      };

      onFlyContextMenu = (event) => {
        if (event) event.preventDefault();
      };

      window.addEventListener("keydown", onFlyKeyDown);
      window.addEventListener("keyup", onFlyKeyUp);
      window.addEventListener("blur", onFlyBlur);
      canvas.addEventListener("mousedown", onFlyMouseDown);
      window.addEventListener("mousemove", onFlyMouseMove);
      window.addEventListener("mouseup", onFlyMouseUp);
      canvas.addEventListener("mouseleave", onFlyMouseLeave);
      canvas.addEventListener("wheel", onFlyWheel, { passive: false });
      canvas.addEventListener("contextmenu", onFlyContextMenu);

      const clock = new THREE.Clock();
      updateControls = () => {
        const delta = clock.getDelta();
        const dir = movementFromKeys();
        if (dir.lengthSq() <= 0) return;

        const speed = baseMoveSpeed * flyState.speedBoost;
        const step = speed * delta;
        camera.getWorldDirection(forwardVec);
        forwardVec.normalize();
        rightVec.crossVectors(forwardVec, worldUp).normalize();

        if (dir.z !== 0) camera.position.addScaledVector(forwardVec, dir.z * step);
        if (dir.x !== 0) camera.position.addScaledVector(rightVec, dir.x * step);
        if (dir.y !== 0) camera.position.y += dir.y * step;
      };

      applyControlTarget = (center, radius) => {
        camera.lookAt(center);
        syncYawPitchFromCamera();
        baseMoveSpeed = Math.max(radius * 1.65, 40);
      };
      controlsHintText = modelControlsText("fly");
    }

    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 8, 6);
    dir.castShadow = true;
    dir.shadow.bias = -0.00025;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir.target);
    scene.add(dir);

    function createWalnutTexture() {
      const sizePx = 512;
      const canvasTexture = document.createElement("canvas");
      canvasTexture.width = sizePx;
      canvasTexture.height = sizePx;
      const ctx = canvasTexture.getContext("2d");
      if (!ctx) return null;

      const base = ctx.createLinearGradient(0, 0, sizePx, sizePx);
      base.addColorStop(0, "#6a422a");
      base.addColorStop(0.5, "#4f311f");
      base.addColorStop(1, "#3b2519");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, sizePx, sizePx);

      for (let y = 0; y < sizePx; y += 2) {
        const wobble = Math.sin(y * 0.06) * 7 + Math.sin(y * 0.013) * 5;
        const alpha = 0.06 + (Math.sin(y * 0.091) + 1) * 0.03;
        ctx.fillStyle = `rgba(219, 171, 124, ${alpha.toFixed(3)})`;
        ctx.fillRect(0, y, sizePx, 1);
        ctx.fillStyle = `rgba(40, 23, 15, ${(alpha * 0.85).toFixed(3)})`;
        ctx.fillRect(Math.max(0, wobble), y + 1, sizePx, 1);
      }

      for (let i = 0; i < 10; i += 1) {
        const cx = 40 + Math.random() * (sizePx - 80);
        const cy = 40 + Math.random() * (sizePx - 80);
        const r = 12 + Math.random() * 24;
        const knot = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
        knot.addColorStop(0, "rgba(130, 84, 56, 0.45)");
        knot.addColorStop(0.7, "rgba(82, 50, 33, 0.22)");
        knot.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = knot;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvasTexture);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy() || 1, 8);
      if ("colorSpace" in texture && "SRGBColorSpace" in THREE) {
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      return texture;
    }

    function createCanLabelTexture() {
      const width = 1024;
      const height = 512;
      const canvasTexture = document.createElement("canvas");
      canvasTexture.width = width;
      canvasTexture.height = height;
      const ctx = canvasTexture.getContext("2d");
      if (!ctx) return null;

      const base = ctx.createLinearGradient(0, 0, width, 0);
      base.addColorStop(0, "#991d19");
      base.addColorStop(0.35, "#c43029");
      base.addColorStop(0.65, "#b62620");
      base.addColorStop(1, "#861712");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#eceff3";
      ctx.fillRect(0, Math.floor(height * 0.42), width, Math.floor(height * 0.16));

      ctx.fillStyle = "rgba(255,255,255,0.22)";
      for (let x = 0; x < width; x += 6) {
        const alpha = 0.02 + ((Math.sin(x * 0.023) + 1) * 0.03);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fillRect(x, 0, 2, height);
      }

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 96px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SODA", width * 0.5, height * 0.31);

      ctx.fillStyle = "rgba(255,255,255,0.84)";
      ctx.font = "600 44px system-ui";
      ctx.fillText("33 cl", width * 0.5, height * 0.73);

      const texture = new THREE.CanvasTexture(canvasTexture);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy() || 1, 8);
      if ("colorSpace" in texture && "SRGBColorSpace" in THREE) {
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      return texture;
    }

    function chooseCanPosition(tableInfo, canRadius) {
      const { modelBox, modelCenter, topWidth, topDepth } = tableInfo;
      const safety = canRadius * 1.35;
      const tableMinX = modelCenter.x - topWidth / 2 + canRadius * 1.1;
      const tableMaxX = modelCenter.x + topWidth / 2 - canRadius * 1.1;
      const tableMinZ = modelCenter.z - topDepth / 2 + canRadius * 1.1;
      const tableMaxZ = modelCenter.z + topDepth / 2 - canRadius * 1.1;

      const pad = canRadius * 1.35;
      const minX = modelBox.min.x - pad;
      const maxX = modelBox.max.x + pad;
      const minZ = modelBox.min.z - pad;
      const maxZ = modelBox.max.z + pad;

      const insideExpandedModel = (x, z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ;
      const insideTable = (x, z) => x >= tableMinX && x <= tableMaxX && z >= tableMinZ && z <= tableMaxZ;

      const candidates = [
        { x: modelBox.max.x + safety + canRadius, z: modelCenter.z },
        { x: modelBox.min.x - safety - canRadius, z: modelCenter.z },
        { x: modelCenter.x, z: modelBox.max.z + safety + canRadius },
        { x: modelCenter.x, z: modelBox.min.z - safety - canRadius },
      ];

      for (const cand of candidates) {
        if (insideTable(cand.x, cand.z) && !insideExpandedModel(cand.x, cand.z)) {
          return cand;
        }
      }

      const fallback = candidates[0];
      const clamped = {
        x: Math.min(tableMaxX, Math.max(tableMinX, fallback.x)),
        z: Math.min(tableMaxZ, Math.max(tableMinZ, fallback.z)),
      };
      if (!insideExpandedModel(clamped.x, clamped.z)) {
        return clamped;
      }

      return {
        x: Math.min(tableMaxX, Math.max(tableMinX, maxX + canRadius * 1.1)),
        z: Math.min(tableMaxZ, Math.max(tableMinZ, modelCenter.z)),
      };
    }

    function collectModelSamplePoints(object, maxPoints = 6500) {
      const meshes = [];
      object.traverse((node) => {
        if (!node || !node.isMesh || !node.geometry || typeof node.geometry.getAttribute !== "function") return;
        const pos = node.geometry.getAttribute("position");
        if (!pos || !pos.count) return;
        meshes.push(node);
      });
      if (!meshes.length) return [];

      object.updateMatrixWorld(true);
      const invRoot = object.matrixWorld.clone().invert();
      const perMeshTarget = Math.max(120, Math.floor(maxPoints / meshes.length));
      const points = [];
      const localVertex = new THREE.Vector3();
      const normalized = new THREE.Vector3();

      for (const mesh of meshes) {
        const pos = mesh.geometry.getAttribute("position");
        const step = Math.max(1, Math.floor(pos.count / perMeshTarget));
        for (let i = 0; i < pos.count; i += step) {
          localVertex.fromBufferAttribute(pos, i);
          normalized.copy(localVertex).applyMatrix4(mesh.matrixWorld).applyMatrix4(invRoot);
          points.push(normalized.clone());
          if (points.length >= maxPoints) return points;
        }
      }
      return points;
    }

    function applyBestStandingOrientation(object) {
      const baseQuaternion = object.quaternion.clone();
      const samplePoints = collectModelSamplePoints(object, 6500);
      const bestQuaternion = new THREE.Quaternion();
      const tempPoint = new THREE.Vector3();
      let bestScore = -Infinity;

      if (!samplePoints.length) {
        object.quaternion.copy(baseQuaternion);
        object.updateMatrixWorld(true);
        return;
      }

      const yUp = new THREE.Vector3(0, 1, 0);
      const upAxes = [
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1),
      ];

      const candidates = [];
      const seen = new Set();
      upAxes.forEach((axis) => {
        const align = new THREE.Quaternion().setFromUnitVectors(axis, yUp);
        for (let i = 0; i < 4; i += 1) {
          const spin = new THREE.Quaternion().setFromAxisAngle(yUp, i * (Math.PI / 2));
          const localQ = align.clone().multiply(spin);
          const key = `${localQ.x.toFixed(4)}|${localQ.y.toFixed(4)}|${localQ.z.toFixed(4)}|${localQ.w.toFixed(4)}`;
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push(localQ);
          }
        }
      });

      const evaluateOrientation = (quat) => {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;

        for (let i = 0; i < samplePoints.length; i += 1) {
          tempPoint.copy(samplePoints[i]).applyQuaternion(quat);
          if (tempPoint.x < minX) minX = tempPoint.x;
          if (tempPoint.x > maxX) maxX = tempPoint.x;
          if (tempPoint.y < minY) minY = tempPoint.y;
          if (tempPoint.y > maxY) maxY = tempPoint.y;
          if (tempPoint.z < minZ) minZ = tempPoint.z;
          if (tempPoint.z > maxZ) maxZ = tempPoint.z;
        }

        const width = Math.max(maxX - minX, 1e-6);
        const depth = Math.max(maxZ - minZ, 1e-6);
        const height = Math.max(maxY - minY, 1e-6);
        const footprintArea = width * depth;
        const contactTolerance = Math.max(height * 0.014, 0.4);

        let contactCount = 0;
        let cMinX = Infinity;
        let cMaxX = -Infinity;
        let cMinZ = Infinity;
        let cMaxZ = -Infinity;

        for (let i = 0; i < samplePoints.length; i += 1) {
          tempPoint.copy(samplePoints[i]).applyQuaternion(quat);
          if (tempPoint.y > minY + contactTolerance) continue;
          contactCount += 1;
          if (tempPoint.x < cMinX) cMinX = tempPoint.x;
          if (tempPoint.x > cMaxX) cMaxX = tempPoint.x;
          if (tempPoint.z < cMinZ) cMinZ = tempPoint.z;
          if (tempPoint.z > cMaxZ) cMaxZ = tempPoint.z;
        }

        if (contactCount < 8) return -Infinity;

        const contactWidth = Math.max(cMaxX - cMinX, 1e-6);
        const contactDepth = Math.max(cMaxZ - cMinZ, 1e-6);
        const contactArea = contactWidth * contactDepth;
        const contactRatio = contactArea / footprintArea;
        const contactAspect = Math.min(contactWidth, contactDepth) / Math.max(contactWidth, contactDepth);
        const density = contactCount / Math.max(samplePoints.length, 1);
        const uprightness = height / Math.max(width, depth, 1e-6);

        return (contactRatio * 7.0) + (contactAspect * 2.8) + (density * 2.6) + (Math.min(uprightness, 4) * 0.55);
      };

      candidates.forEach((localQ) => {
        const fullQ = baseQuaternion.clone().multiply(localQ);
        const score = evaluateOrientation(fullQ);
        if (score > bestScore) {
          bestScore = score;
          bestQuaternion.copy(fullQ);
        }
      });

      if (bestScore > -Infinity) {
        object.quaternion.copy(bestQuaternion);
      } else {
        object.quaternion.copy(baseQuaternion);
      }
      object.updateMatrixWorld(true);
    }

    function addPresentationTable(object, unitContext = null) {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const mmPerUnitRaw = Number(unitContext && unitContext.mmPerUnit);
      const mmPerUnit = Number.isFinite(mmPerUnitRaw) && mmPerUnitRaw > 0 ? mmPerUnitRaw : 1;
      const mmToUnits = (mm) => Number(mm || 0) / mmPerUnit;
      const canHeightUnits = Number(unitContext && unitContext.canHeightUnits);
      const canDiameterUnits = Number(unitContext && unitContext.canDiameterUnits);
      const referenceCanHeight = Number.isFinite(canHeightUnits) && canHeightUnits > 0
        ? canHeightUnits
        : SCALE_CAN_HEIGHT_MM;
      const referenceCanDiameter = Number.isFinite(canDiameterUnits) && canDiameterUnits > 0
        ? canDiameterUnits
        : SCALE_CAN_DIAMETER_MM;

      const targetTableSize = mmToUnits(PRESENTATION_TABLE_SIZE_MM);
      const edgeMargin = Math.max(referenceCanDiameter * 1.25, mmToUnits(45));
      const topWidth = Math.max(targetTableSize, size.x + edgeMargin * 2);
      const topDepth = Math.max(targetTableSize, size.z + edgeMargin * 2);
      const modelSpan = Math.max(size.x, size.z, referenceCanDiameter);
      const topThickness = Math.max(mmToUnits(24), modelSpan * 0.055);
      const legHeight = Math.max(mmToUnits(340), modelSpan * 0.9, size.y * 0.8, referenceCanHeight * 0.45);
      const legThickness = Math.max(mmToUnits(38), Math.min(topWidth, topDepth) * 0.06);
      const clearance = Math.max(mmToUnits(2), topThickness * 0.14);

      const topCenterY = box.min.y - clearance - topThickness / 2;
      const topSurfaceY = topCenterY + topThickness / 2;
      const legCenterY = topCenterY - topThickness / 2 - legHeight / 2;
      const insetX = Math.max(topWidth / 2 - legThickness * 1.1, legThickness);
      const insetZ = Math.max(topDepth / 2 - legThickness * 1.1, legThickness);

      const table = new THREE.Group();
      table.name = "presentationTable";

      const walnutTopTexture = createWalnutTexture();
      if (walnutTopTexture) {
        const topWidthMm = topWidth * mmPerUnit;
        const topDepthMm = topDepth * mmPerUnit;
        walnutTopTexture.repeat.set(Math.max(topWidthMm / 120, 1), Math.max(topDepthMm / 120, 1));
      }

      const topMaterialConfig = {
        color: 0x6f4a32,
        roughness: 0.78,
        metalness: 0.04,
      };
      if (walnutTopTexture) topMaterialConfig.map = walnutTopTexture;

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(topWidth, topThickness, topDepth),
        new THREE.MeshStandardMaterial(topMaterialConfig)
      );
      top.position.set(center.x, topCenterY, center.z);
      top.castShadow = true;
      top.receiveShadow = true;
      table.add(top);

      const legGeometry = new THREE.BoxGeometry(legThickness, legHeight, legThickness);
      const walnutLegTexture = walnutTopTexture ? walnutTopTexture.clone() : null;
      if (walnutLegTexture) {
        const legHeightMm = legHeight * mmPerUnit;
        walnutLegTexture.repeat.set(1, Math.max(legHeightMm / 70, 1));
      }
      const legMaterialConfig = {
        color: 0x3f2a1d,
        roughness: 0.86,
        metalness: 0.03,
      };
      if (walnutLegTexture) legMaterialConfig.map = walnutLegTexture;
      const legMaterial = new THREE.MeshStandardMaterial(legMaterialConfig);
      [
        [-insetX, -insetZ],
        [insetX, -insetZ],
        [-insetX, insetZ],
        [insetX, insetZ],
      ].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(center.x + x, legCenterY, center.z + z);
        leg.castShadow = true;
        leg.receiveShadow = true;
        table.add(leg);
      });

      const tableMaterials = [];
      const seenMaterials = new Set();
      table.traverse((node) => {
        if (!node || !node.isMesh || !node.material) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          if (!material || seenMaterials.has(material)) return;
          seenMaterials.add(material);
          const baseOpacity = Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1;
          tableMaterials.push({
            material,
            baseOpacity,
            baseDepthWrite: material.depthWrite !== false,
          });
          material.transparent = true;
          material.opacity = baseOpacity;
        });
      });

      scene.add(table);
      return {
        modelBox: box.clone(),
        modelSize: size.clone(),
        modelCenter: center.clone(),
        topSurfaceY,
        topWidth,
        topDepth,
        topWidthMm: topWidth * mmPerUnit,
        topDepthMm: topDepth * mmPerUnit,
        mmPerUnit,
        tableMaterials,
      };
    }

    function addScaleCan(tableInfo, unitContext = null) {
      if (!tableInfo) return null;
      const mmPerUnitRaw = Number(unitContext && unitContext.mmPerUnit);
      const mmPerUnit = Number.isFinite(mmPerUnitRaw) && mmPerUnitRaw > 0 ? mmPerUnitRaw : 1;
      const canHeightUnits = Number(unitContext && unitContext.canHeightUnits);
      const canDiameterUnits = Number(unitContext && unitContext.canDiameterUnits);
      const canHeight = Number.isFinite(canHeightUnits) && canHeightUnits > 0
        ? canHeightUnits
        : SCALE_CAN_HEIGHT_MM;
      const canDiameter = Number.isFinite(canDiameterUnits) && canDiameterUnits > 0
        ? canDiameterUnits
        : SCALE_CAN_DIAMETER_MM;
      const canRadius = canDiameter / 2;

      const { topSurfaceY } = tableInfo;
      const { x: canX, z: canZ } = chooseCanPosition(tableInfo, canRadius);

      const canBaseY = topSurfaceY + (0.25 / mmPerUnit);
      const canGroup = new THREE.Group();
      canGroup.name = "scaleCan";

      const labelTexture = createCanLabelTexture();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(canRadius, canRadius, canHeight, 64, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: labelTexture || null,
          roughness: 0.34,
          metalness: 0.44,
        })
      );
      body.position.set(canX, canBaseY + canHeight / 2, canZ);
      body.castShadow = true;
      body.receiveShadow = true;
      canGroup.add(body);

      const capMaterial = new THREE.MeshStandardMaterial({ color: 0xb3b9c2, roughness: 0.25, metalness: 0.9 });
      const capTop = new THREE.Mesh(
        new THREE.CylinderGeometry(canRadius * 0.982, canRadius * 0.982, 1.6, 64),
        capMaterial
      );
      capTop.position.set(canX, canBaseY + canHeight - 0.8, canZ);
      capTop.castShadow = true;
      capTop.receiveShadow = true;
      canGroup.add(capTop);

      const topInset = new THREE.Mesh(
        new THREE.CylinderGeometry(canRadius * 0.86, canRadius * 0.86, 0.7, 64),
        new THREE.MeshStandardMaterial({ color: 0x868d97, roughness: 0.34, metalness: 0.82 })
      );
      topInset.position.set(canX, canBaseY + canHeight - 0.15, canZ);
      topInset.castShadow = true;
      topInset.receiveShadow = true;
      canGroup.add(topInset);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(canRadius * 0.85, canRadius * 0.05, 18, 64),
        capMaterial
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(canX, canBaseY + canHeight - 0.2, canZ);
      rim.castShadow = true;
      rim.receiveShadow = true;
      canGroup.add(rim);

      const tabRing = new THREE.Mesh(
        new THREE.TorusGeometry(canRadius * 0.24, canRadius * 0.045, 12, 40),
        capMaterial
      );
      tabRing.rotation.x = Math.PI / 2;
      tabRing.position.set(canX + canRadius * 0.08, canBaseY + canHeight + 0.55, canZ - canRadius * 0.08);
      tabRing.castShadow = true;
      tabRing.receiveShadow = true;
      canGroup.add(tabRing);

      const tabBridge = new THREE.Mesh(
        new THREE.BoxGeometry(canRadius * 0.4, 0.8, canRadius * 0.12),
        capMaterial
      );
      tabBridge.position.set(canX + canRadius * 0.05, canBaseY + canHeight + 0.45, canZ + canRadius * 0.16);
      tabBridge.castShadow = true;
      tabBridge.receiveShadow = true;
      canGroup.add(tabBridge);

      const capBottom = new THREE.Mesh(
        new THREE.CylinderGeometry(canRadius * 0.985, canRadius * 0.985, 1.4, 64),
        capMaterial
      );
      capBottom.position.set(canX, canBaseY + 0.7, canZ);
      capBottom.castShadow = true;
      capBottom.receiveShadow = true;
      canGroup.add(capBottom);

      scene.add(canGroup);
      return {
        canHeight,
        canDiameter,
        canHeightMm: SCALE_CAN_HEIGHT_MM,
        canDiameterMm: SCALE_CAN_DIAMETER_MM,
        group: canGroup,
      };
    }

    function fit(object, extraObjects = []) {
      const box = new THREE.Box3().setFromObject(object);
      (Array.isArray(extraObjects) ? extraObjects : []).forEach((extra) => {
        if (extra) box.expandByObject(extra);
      });
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z) || 1;
      camera.near = radius / 100;
      camera.far = radius * 100;
      camera.position.set(center.x + radius * 1.6, center.y + radius * 1.3, center.z + radius * 1.6);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      applyControlTarget(center, radius);

      const shadowSpan = radius * 2.2;
      dir.position.set(center.x + radius * 2.1, center.y + radius * 2.9, center.z + radius * 1.6);
      dir.target.position.copy(center);
      dir.shadow.camera.left = -shadowSpan;
      dir.shadow.camera.right = shadowSpan;
      dir.shadow.camera.top = shadowSpan;
      dir.shadow.camera.bottom = -shadowSpan;
      dir.shadow.camera.near = Math.max(radius / 20, 0.1);
      dir.shadow.camera.far = radius * 12;
      dir.shadow.camera.updateProjectionMatrix();
      return size;
    }

    const modelUrl = file.content_url;
    const loadObjPromise = new Promise((resolve, reject) => {
      if (ext === ".stl") {
        const loader = new STLLoader();
        loader.load(
          modelUrl,
          (geometry) => {
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({ color: 0x8ec5ff, metalness: 0.15, roughness: 0.75 });
            const mesh = new THREE.Mesh(geometry, material);
            resolve(mesh);
          },
          undefined,
          reject
        );
        return;
      }
      const loader = new OBJLoader();
      loader.load(modelUrl, resolve, undefined, reject);
    });

    let fittedSize = null;
    let modelOnlySize = null;
    let tableInfo = null;
    let canInfo = null;
    let unitContext = null;
    try {
      const obj = await loadObjPromise;
      if (!isActiveLoad()) {
        renderer.dispose();
        return;
      }
      applyBestStandingOrientation(obj);
      obj.traverse((node) => {
        if (node && node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      scene.add(obj);
      const modelOnlyBox = new THREE.Box3().setFromObject(obj);
      modelOnlySize = modelOnlyBox.getSize(new THREE.Vector3());
      unitContext = buildModelUnitContext(modelOnlySize && modelOnlySize.y, file.filename || "");
      orbitFallbackTarget.copy(modelOnlyBox.getCenter(new THREE.Vector3()));
      orbitPickObjects = [obj];
      tableInfo = addPresentationTable(obj, unitContext);
      canInfo = addScaleCan(tableInfo, unitContext);
      if (canInfo && canInfo.group) orbitPickObjects.push(canInfo.group);
      fittedSize = fit(obj, [canInfo && canInfo.group ? canInfo.group : null]);
    } catch (err) {
      if (!isActiveLoad()) {
        renderer.dispose();
        return;
      }
      setModelPreviewLoading(false);
      updateModelInfoBar({
        controls: "Kunne ikke åbne model",
        height: "-",
        scale: "-",
      });
      setModelHintMessage(`Kunne ikke åbne 3D filen: ${err.message || err}`);
      return;
    }

    function resize() {
      if (!els.threePane) return;
      const rect = els.threePane.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      handleControlsResize();
    }
    resize();

    function updatePresentationTableFade() {
      if (!tableInfo || !Array.isArray(tableInfo.tableMaterials) || !tableInfo.tableMaterials.length) return;
      const topSurfaceY = Number(tableInfo.topSurfaceY);
      if (!Number.isFinite(topSurfaceY)) return;

      const mmPerUnit = Number(tableInfo.mmPerUnit);
      const unitScale = Number.isFinite(mmPerUnit) && mmPerUnit > 0 ? mmPerUnit : 1;
      const fadeStart = 18 / unitScale;
      const fadeEnd = -130 / unitScale;
      const yDelta = Number(camera.position.y || 0) - topSurfaceY;
      const ratio = Math.max(0, Math.min(1, (yDelta - fadeEnd) / Math.max(fadeStart - fadeEnd, 1e-6)));
      const minOpacity = 0.04;
      const blendOpacity = minOpacity + ((1 - minOpacity) * ratio);
      const useDepthWrite = blendOpacity >= 0.35;

      tableInfo.tableMaterials.forEach((entry) => {
        if (!entry || !entry.material) return;
        const mat = entry.material;
        const baseOpacity = Number.isFinite(Number(entry.baseOpacity)) ? Number(entry.baseOpacity) : 1;
        mat.opacity = Math.max(0.001, Math.min(1, baseOpacity * blendOpacity));
        mat.depthWrite = useDepthWrite && !!entry.baseDepthWrite;
      });
    }

    function animate() {
      if (!state.three) return;
      updateControls();
      updatePresentationTableFade();
      renderer.render(scene, camera);
      state.three.frameId = requestAnimationFrame(animate);
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    state.three = {
      renderer,
      scene,
      camera,
      controls,
      frameId: 0,
      onResize,
      onKeyDown: onFlyKeyDown,
      onKeyUp: onFlyKeyUp,
      onBlur: onFlyBlur,
      onMouseDown: onFlyMouseDown,
      onMouseMove: onFlyMouseMove,
      onMouseUp: onFlyMouseUp,
      onMouseLeave: onFlyMouseLeave,
      onWheel: onFlyWheel,
      onContextMenu: onFlyContextMenu,
      canvas,
    };
    animate();
    if (!isActiveLoad()) {
      cleanupThree();
      return;
    }
    setModelPreviewLoading(false);

    const heightValue = modelOnlySize && Number.isFinite(Number(modelOnlySize.y))
      ? Number(modelOnlySize.y)
      : (fittedSize && Number.isFinite(Number(fittedSize.y)) ? Number(fittedSize.y) : 0);
    if (!unitContext) {
      unitContext = buildModelUnitContext(heightValue, file.filename || "");
    }
    const heightLabel = formatHeightDisplayValue(heightValue, unitContext);
    const scaleLabel = canInfo
      ? `Dåse ${canInfo.canHeightMm}x${canInfo.canDiameterMm} mm`
      : `Dåse ${SCALE_CAN_HEIGHT_MM}x${SCALE_CAN_DIAMETER_MM} mm`;

    updateModelInfoBar({
      controls: controlsHintText,
      height: heightLabel,
      scale: scaleLabel,
    });

    const extraHints = [];
    if (tableInfo && Number.isFinite(Number(tableInfo.topWidthMm)) && Number.isFinite(Number(tableInfo.topDepthMm))) {
      extraHints.push(
        `Bord: ${formatNumberCompact(Number(tableInfo.topWidthMm) / 10)}x${formatNumberCompact(Number(tableInfo.topDepthMm) / 10)} cm.`
      );
    } else {
      extraHints.push(`Bord: ${formatNumberCompact(PRESENTATION_TABLE_SIZE_MM / 10)}x${formatNumberCompact(PRESENTATION_TABLE_SIZE_MM / 10)} cm.`);
    }
    if (canInfo) {
      const unitLabel = unitContext && unitContext.unitLabel ? unitContext.unitLabel : "model-enheder";
      extraHints.push(
        `Skala-reference: sodavandsdåse ${canInfo.canHeightMm}x${canInfo.canDiameterMm} mm (tegnet som ${formatNumberCompact(canInfo.canHeight)}x${formatNumberCompact(canInfo.canDiameter)} ${unitLabel}).`
      );
    }
    extraHints.push(buildUnitHintText(unitContext));
    if (els.modelHint) els.modelHint.textContent = buildModelHint(heightValue, extraHints, controlsHintText, unitContext);
  }

  function close3DModal() {
    state.modelPreviewLoadToken = Number(state.modelPreviewLoadToken || 0) + 1;
    state.modelModalCloseGuardUntil = 0;
    cleanupThree();
    if (els.modelViewer) els.modelViewer.removeAttribute("src");
    setModelPreviewLoading(false);
    setModelHintMessage("");
    updateModelInfoBar({
      controls: modelControlsText(),
      height: "-",
      scale: `Dåse ${SCALE_CAN_HEIGHT_MM}x${SCALE_CAN_DIAMETER_MM} mm`,
    });
    if (els.modelModal) els.modelModal.classList.add("hidden");
  }

  async function onFileGridClick(event) {
    if (state.selectMode) {
      const card = event.target.closest("[data-file-id]");
      if (card) {
        const id = Number(card.dataset.fileId || 0);
        if (id) {
          toggleFileSelection(id, fileById(id));
          cleanupPrintReadyExclusions();
          renderFiles();
          renderFolderBrowser();
        }
      }
      return;
    }

    const infoBtn = event.target.closest("[data-action='open-info']");
    if (infoBtn) {
      const id = Number(infoBtn.dataset.fileId || 0);
      if (id) openFileInfoDrawer(id);
      return;
    }

    const sliceBtn = event.target.closest("[data-action='open-slice']");
    if (sliceBtn) {
      const id = Number(sliceBtn.dataset.fileId || 0);
      const file = fileById(id);
      if (!file) return;
      if (state.role === "admin" && !!file.can_slice && !sliceBtn.disabled) {
        await openSliceModal(id);
      } else {
        openFileInfoDrawer(id);
      }
      return;
    }

    const stopSliceBtn = event.target.closest("[data-action='stop-slice']");
    if (stopSliceBtn) {
      const id = Number(stopSliceBtn.dataset.fileId || 0);
      if (id) {
        try {
          await fetch(`/api/files/${id}/slice/cancel`, { method: "POST" });
          await loadFiles();
        } catch (err) {
          showStatus(els.uploadStatus, err.message || "Kunne ikke stoppe slicing", "error");
        }
      }
      return;
    }

    const modelBtn = event.target.closest("[data-action='open-3d']");
    if (modelBtn) {
      const id = Number(modelBtn.dataset.fileId || 0);
      const file = fileById(id);
      if (file) {
        showStatus(els.uploadStatus, "");
        await open3DModal(file);
      }
      return;
    }

    const fileCard = event.target.closest("[data-file-id]");
    if (fileCard) {
      const id = Number(fileCard.dataset.fileId || 0);
      const file = fileById(id);
      if (!file) return;
      if (file.is_3d) {
        showStatus(els.uploadStatus, "");
        await open3DModal(file);
        return;
      }
      openFileInfoDrawer(id);
    }
  }

  function setMapperMenuOpen(open) {
    if (!els.mapperMenu || !els.mapperMenuBtn) return;
    const isOpen = !!open;
    els.mapperMenu.classList.toggle("hidden", !isOpen);
    els.mapperMenuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function openMapperUploadPicker() {
    if (state.selectMode) return;
    if (!currentFolderAllowsUserWrites()) {
      showStatus(els.uploadStatus, "Upload kan kun ske inde i en datomappe.", "error");
      return;
    }
    if (els.fileInput) els.fileInput.click();
  }

  function importLinkTargetFolder() {
    return currentFolder() || state.homeFolder || "";
  }

  function openImportLinkModal() {
    if (state.selectMode) return;
    if (!currentFolderAllowsUserWrites()) {
      showStatus(els.uploadStatus, "Link-import kan kun ske inde i en datomappe.", "error");
      return;
    }
    if (!els.importLinkModal) return;
    showStatus(els.importLinkStatus, "");
    if (els.importLinkInput) {
      els.importLinkInput.value = "";
    }
    els.importLinkModal.classList.remove("hidden");
    window.setTimeout(() => {
      if (els.importLinkInput) els.importLinkInput.focus();
    }, 0);
  }

  function closeImportLinkModal() {
    if (els.importLinkModal) els.importLinkModal.classList.add("hidden");
    showStatus(els.importLinkStatus, "");
  }

  function closeImportPreviewModal() {
    if (els.importPreviewModal) els.importPreviewModal.classList.add("hidden");
    showStatus(els.importPreviewStatus, "");
  }

  function formatImportDuration(seconds) {
    const total = Math.max(0, Number(seconds || 0));
    if (!Number.isFinite(total) || total <= 0) return "-";
    const hours = total / 3600;
    if (hours >= 1) return `${hours.toFixed(hours >= 10 ? 0 : 1)} t`;
    const minutes = Math.max(1, Math.round(total / 60));
    return `${minutes} min`;
  }

  function formatImportNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return "0";
    return n.toLocaleString("da-DK");
  }

  function importMetaChip(label, value) {
    const text = String(value || "").trim();
    if (!text || text === "0") return "";
    return `<span class="import-meta-chip"><strong>${esc(label)}</strong>${esc(text)}</span>`;
  }

  function importSelectedProfiles(preview) {
    const profiles = Array.isArray(preview && preview.profiles) ? preview.profiles : [];
    const selectedIds = Array.isArray(state.importLinkSelectedProfileIds)
      ? state.importLinkSelectedProfileIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    if (!selectedIds.length) return [];
    const selectedSet = new Set(selectedIds);
    return profiles.filter((profile) => selectedSet.has(String((profile && profile.id) || "")));
  }

  function importSelectedProfile(preview) {
    return importSelectedProfiles(preview)[0] || null;
  }

  function importProfileDownloadUrl(preview, profile) {
    const item = profile && typeof profile === "object" ? profile : {};
    const directUrl = String(item.download_url || "").trim();
    if (directUrl) return directUrl;

    const source = String((preview && preview.source) || "").trim().toLowerCase();
    if (source !== "makerworld") return "";

    const instanceId = Number(item.id || 0);
    if (!Number.isFinite(instanceId) || instanceId <= 0) return "";

    return `https://makerworld.com/api/v1/design-service/instance/${encodeURIComponent(String(instanceId))}/f3mf?type=download&fileType=`;
  }

  function importSelectedProfileDownloadUrls(preview) {
    const selectedProfiles = importSelectedProfiles(preview || {});
    if (!selectedProfiles.length) return [];
    const urls = selectedProfiles
      .map((profile) => importProfileDownloadUrl(preview || {}, profile))
      .map((url) => String(url || "").trim())
      .filter(Boolean);
    return Array.from(new Set(urls));
  }

  function renderImportPreview(preview) {
    if (!els.importPreviewBody) return;
    const data = preview && typeof preview === "object" ? preview : {};
    const profiles = Array.isArray(data.profiles) ? data.profiles : [];
    const selectedProfiles = importSelectedProfiles(data);
    const selectedProfileIds = selectedProfiles.map((profile) => String(profile.id || "")).filter(Boolean);
    const selectedProfileIdSet = new Set(selectedProfileIds);
    state.importLinkSelectedProfileIds = selectedProfileIds;
    state.importLinkSelectedProfileId = selectedProfileIds[0] || "";
    const selectedCount = selectedProfiles.length;
    if (els.importPreviewTitle) {
      els.importPreviewTitle.textContent = String(data.title || "Model fra link");
    }
    if (els.importPreviewSubtitle) {
      const creator = String(data.creator || "").trim();
      const source = String(data.source_label || "Link").trim();
      els.importPreviewSubtitle.textContent = creator ? `${source} · ${creator}` : source;
    }
    if (els.importPreviewUseBtn) {
      els.importPreviewUseBtn.disabled = profiles.length <= 0 || selectedCount <= 0;
      if (profiles.length <= 0) {
        els.importPreviewUseBtn.textContent = "Ingen profiler";
      } else if (selectedCount > 0) {
        els.importPreviewUseBtn.textContent = `Download profiler (${selectedCount})`;
      } else {
        els.importPreviewUseBtn.textContent = "Download profiler";
      }
    }

    const images = Array.isArray(data.image_urls) ? data.image_urls.filter(Boolean).slice(0, 12) : [];
    const cover = String(data.cover_url || "").trim();
    const galleryImages = [];
    if (cover) galleryImages.push(cover);
    images.forEach((url) => {
      const normalized = String(url || "").trim();
      if (!normalized || galleryImages.includes(normalized)) return;
      galleryImages.push(normalized);
    });
    const selectedImage = String(state.importLinkSelectedImageUrl || "").trim();
    const activeImage = galleryImages.includes(selectedImage) ? selectedImage : (galleryImages[0] || "");
    state.importLinkSelectedImageUrl = activeImage;
    const imageHtml = activeImage
      ? `
        <div class="import-preview-gallery">
          <button class="import-preview-cover-btn" type="button" data-import-preview-open="${esc(activeImage)}" aria-label="Åbn billede i stor visning">
            <img class="import-preview-cover" src="${esc(activeImage)}" alt="${esc(data.title || "Model billede")}" loading="lazy" decoding="async">
          </button>
          <div class="import-preview-thumbs">
            ${galleryImages.map((url, index) => {
              const isActive = url === activeImage;
              return `<button class="import-preview-thumb-btn${isActive ? " is-active" : ""}" type="button" data-import-preview-image="${esc(url)}" aria-label="Vis billede ${index + 1}"><img src="${esc(url)}" alt="" loading="lazy" decoding="async"></button>`;
            }).join("")}
          </div>
        </div>
      `
      : `<div class="import-preview-empty-media">Intet billede fundet</div>`;

    const stats = data.stats || {};
    const statsHtml = [
      importMetaChip("Downloads", formatImportNumber(stats.downloads)),
      importMetaChip("Print", formatImportNumber(stats.prints)),
      importMetaChip("Likes", formatImportNumber(stats.likes)),
      importMetaChip("Kommentarer", formatImportNumber(stats.comments)),
    ].join("");
    const license = data.license || {};
    const categoryHtml = (Array.isArray(data.categories) ? data.categories : [])
      .map((item) => `<span class="import-category">${esc(item)}</span>`)
      .join("");
    const description = String(data.description || "Ingen beskrivelse fundet.").trim();
    const profileHtml = profiles.length
      ? profiles.map((profile, index) => {
          const id = String(profile.id || "");
          const checked = selectedProfileIdSet.has(id) ? "checked" : "";
          const settings = profile.settings || {};
          const filamentHtml = (Array.isArray(profile.filaments) ? profile.filaments : [])
            .slice(0, 4)
            .map((filament) => {
              const color = String(filament.color || "").trim();
              const type = String(filament.type || "Filament").trim();
              const used = String(filament.used_g || "").trim();
              return `<span class="import-filament"><span style="background:${esc(color || "#6b7280")}"></span>${esc(type)}${used ? ` ${esc(used)}g` : ""}</span>`;
            })
            .join("");
          const printers = (Array.isArray(profile.compatible_printers) ? profile.compatible_printers : []).slice(0, 4).join(", ");
          const coverUrl = String(profile.cover_url || (Array.isArray(profile.picture_urls) && profile.picture_urls[0]) || "").trim();
          return `
            <label class="import-profile-card ${checked ? "selected" : ""}">
              <input type="checkbox" name="importProfiles" value="${esc(id)}" ${checked}>
              ${coverUrl ? `<img class="import-profile-thumb" src="${esc(coverUrl)}" alt="" loading="lazy" decoding="async">` : `<div class="import-profile-thumb placeholder">${index + 1}</div>`}
              <div class="import-profile-main">
                <div class="import-profile-title">${esc(profile.title || "Printprofil")}</div>
                <div class="import-profile-meta">
                  ${profile.is_designer ? `<span>Designer</span>` : ""}
                  <span>${esc(formatImportDuration(profile.print_time_seconds))}</span>
                  <span>${esc(formatImportNumber(profile.plate_count))} plade${Number(profile.plate_count || 0) === 1 ? "" : "r"}</span>
                  ${profile.rating ? `<span>${esc(profile.rating)} (${esc(formatImportNumber(profile.rating_count))})</span>` : ""}
                </div>
                <div class="import-profile-settings">
                  ${settings.layer_height ? `<span>${esc(settings.layer_height)}mm lag</span>` : ""}
                  ${settings.wall_loops ? `<span>${esc(settings.wall_loops)} vægge</span>` : ""}
                  ${settings.infill ? `<span>${esc(settings.infill)} infill</span>` : ""}
                  ${profile.need_ams ? `<span>AMS</span>` : ""}
                </div>
                ${filamentHtml ? `<div class="import-filaments">${filamentHtml}</div>` : ""}
                ${printers ? `<div class="import-profile-printers">${esc(printers)}</div>` : ""}
              </div>
            </label>
          `;
        }).join("")
      : `<div class="empty-note">Ingen printprofiler fundet på linket.</div>`;

    els.importPreviewBody.innerHTML = `
      <div class="import-preview-grid">
        ${imageHtml}
        <div class="import-preview-summary">
          <div class="import-preview-source">${esc(data.source_label || "Link")}</div>
          <h4>${esc(data.title || "Model fra link")}</h4>
          ${data.creator ? `<div class="import-preview-creator">Af ${esc(data.creator)}</div>` : ""}
          ${statsHtml ? `<div class="import-meta-chips">${statsHtml}</div>` : ""}
          ${categoryHtml ? `<div class="import-categories">${categoryHtml}</div>` : ""}
          <div class="import-license">
            <div class="import-section-title">Licens</div>
            <div class="import-license-value">${esc(license.label || license.code || "Ukendt licens")}</div>
          </div>
        </div>
      </div>
      <div class="import-preview-section">
        <div class="import-section-title">Beskrivelse</div>
        <div class="import-description">${esc(description).replace(/\n/g, "<br>")}</div>
      </div>
      <div class="import-preview-section">
        <div class="import-section-title">Printprofiler</div>
        <div class="import-profiles">${profileHtml}</div>
      </div>
    `;
  }

  function openImportPreviewModal(preview) {
    state.importLinkPreview = preview || null;
    const profiles = Array.isArray(preview && preview.profiles) ? preview.profiles : [];
    const selectedFromSource = profiles
      .filter((profile) => !!(profile && profile.selected))
      .map((profile) => String((profile && profile.id) || "").trim())
      .filter(Boolean);
    const firstProfileId = String((profiles[0] && profiles[0].id) || "").trim();
    const selectedIds = selectedFromSource.length
      ? Array.from(new Set(selectedFromSource))
      : (firstProfileId ? [firstProfileId] : []);
    state.importLinkSelectedProfileIds = selectedIds;
    state.importLinkSelectedProfileId = selectedIds[0] || "";
    state.importLinkSelectedImageUrl = "";
    renderImportPreview(preview);
    showStatus(els.importPreviewStatus, "");
    if (els.importPreviewModal) els.importPreviewModal.classList.remove("hidden");
  }

  async function fetchImportLinkPreview() {
    if (!els.importLinkInput) return;
    const url = String(els.importLinkInput.value || "").trim();
    if (!url) {
      showStatus(els.importLinkStatus, "Indsæt et link først.", "error");
      return;
    }
    if (!currentFolderAllowsUserWrites()) {
      showStatus(els.importLinkStatus, "Link-import kan kun ske inde i en datomappe.", "error");
      return;
    }
    if (els.importLinkNextBtn) {
      els.importLinkNextBtn.disabled = true;
      els.importLinkNextBtn.textContent = "Henter...";
    }
    showStatus(els.importLinkStatus, "Henter oplysninger...", "ok");
    try {
      const data = await api("/api/import-link/preview", {
        method: "POST",
        body: {
          url,
          folder: importLinkTargetFolder(),
        },
      });
      closeImportLinkModal();
      openImportPreviewModal(data.preview || {});
    } catch (err) {
      showStatus(els.importLinkStatus, err.message || "Kunne ikke hente link-oplysninger", "error");
    } finally {
      if (els.importLinkNextBtn) {
        els.importLinkNextBtn.disabled = false;
        els.importLinkNextBtn.textContent = "Næste";
      }
    }
  }

  async function onMapperMenuAction(action) {
    const cmd = String(action || "").trim().toLowerCase();
    if (!cmd) return;

    if (cmd === "select") {
      toggleSelectMode();
      return;
    }

    if (cmd === "upload") {
      openMapperUploadPicker();
      return;
    }

    if (cmd === "create-folder") {
      if (state.selectMode) return;
      if (!currentFolderAllowsUserWrites()) {
        showStatus(els.uploadStatus, "Mapper kan kun oprettes inde i en datomappe.", "error");
        return;
      }
      if (isAdminUsersRootFolder()) {
        openNonUserFolderModal();
        return;
      }
      const name = window.prompt("Nyt mappenavn:");
      if (!name) return;
      await createFolder(name);
      return;
    }

    if (cmd === "share") {
      const selectedPaths = selectedShareFoldersFromSelection();
      if (!state.selectMode || !selectedPaths.length) return;
      if (state.role !== "admin") {
        showStatus(els.uploadStatus, "Kun admin kan oprette delinger.", "error");
        return;
      }
      await openShareModal(selectedPaths);
      return;
    }

    if (cmd === "rename-folder") {
      if (!state.selectMode || state.selectedFolderPaths.size !== 1) return;
      showStatus(els.uploadStatus, "Omdøb mappe er ikke aktiveret endnu.", "error");
    }
  }

  function bindEvents() {
    if (els.sidebarNav) {
      els.sidebarNav.addEventListener("click", async (event) => {
        const btn = event.target.closest(".nav-item[data-tab]");
        if (!btn) return;
        const tab = btn.dataset.tab;
        setTab(tab);
        if (tab === "print-ready") {
          await loadPrintReadyProjects();
        }
        if (tab === "finished-projects") {
          await loadFinishedProjects();
        }
        if (tab === "tracking") {
          await loadTracking();
        }
        if (tab === "rejected-file-types" && state.role === "admin") {
          await loadRejectedFileTypes();
        }
        if (tab === "settings" && state.role === "admin") {
          if (state.currentSettingsTab === "shares") await loadShares();
          if (state.currentSettingsTab === "dns") await loadDns();
          if (state.currentSettingsTab === "users") await loadUsers();
          if (state.currentSettingsTab === "makerworld") await loadMakerworldSettings();
          if (state.currentSettingsTab === "sms") await loadSmsSettings();
          if (state.currentSettingsTab === "logs") await loadAdminLogs();
          if (state.currentSettingsTab === "slicer") await loadSlicerSettings();
        }
      });
    }
    if (els.profileFooterBtn) {
      els.profileFooterBtn.addEventListener("click", () => {
        openProfileModal();
        if (window.innerWidth <= 1000) {
          closeMobileDrawer();
        }
      });
    }

    // Close drawer on sidebar navigation (mobile)
    if (els.sidebarNav) {
      els.sidebarNav.addEventListener("click", () => {
        if (window.innerWidth <= 1000) {
          closeMobileDrawer();
        }
      });
    }

    if (els.settingsTabs) {
      els.settingsTabs.addEventListener("click", async (event) => {
        const btn = event.target.closest(".tab-btn[data-settings-tab]");
        if (!btn || state.role !== "admin") return;
        const tab = String(btn.dataset.settingsTab || "shares");
        setSettingsTab(tab);
        if (tab === "shares") await loadShares();
        if (tab === "dns") await loadDns();
        if (tab === "users") await loadUsers();
        if (tab === "makerworld") await loadMakerworldSettings();
        if (tab === "sms") await loadSmsSettings();
        if (tab === "logs") await loadAdminLogs();
        if (tab === "slicer") await loadSlicerSettings();
      });
    }

    if (els.settingsTabSelect) {
      els.settingsTabSelect.addEventListener("change", async () => {
        if (state.role !== "admin") return;
        const tab = String(els.settingsTabSelect.value || "shares");
        setSettingsTab(tab);
        if (tab === "shares") await loadShares();
        if (tab === "dns") await loadDns();
        if (tab === "users") await loadUsers();
        if (tab === "makerworld") await loadMakerworldSettings();
        if (tab === "sms") await loadSmsSettings();
        if (tab === "logs") await loadAdminLogs();
        if (tab === "slicer") await loadSlicerSettings();
      });
    }

    if (els.profileSmsEnabledChk) {
      els.profileSmsEnabledChk.addEventListener("change", () => {
        setProfileSmsFormState({ busy: false });
        showStatus(els.profileSmsStatus, "");
      });
    }
    if (els.profileSmsCountrySelect) {
      els.profileSmsCountrySelect.addEventListener("change", () => {
        updateProfileSmsPreview();
        showStatus(els.profileSmsStatus, "");
      });
    }
    if (els.profileSmsPhoneInput) {
      els.profileSmsPhoneInput.addEventListener("input", () => {
        updateProfileSmsPreview();
        showStatus(els.profileSmsStatus, "");
      });
    }
    if (els.profileSmsSaveBtn) {
      els.profileSmsSaveBtn.addEventListener("click", () => {
        saveMyProfile().catch((err) => {
          showStatus(els.profileSmsStatus, err.message || "Kunne ikke gemme profil", "error");
        });
      });
    }

    if (els.profilePasswordForm) {
      els.profilePasswordForm.addEventListener("submit", (event) => {
        event.preventDefault();
        saveProfileChanges().catch((err) => {
          showStatus(els.profilePwdStatus, err.message || "Kunne ikke gemme profil", "error");
        });
      });
    }
    if (els.profileModalCancelBtn) {
      els.profileModalCancelBtn.addEventListener("click", closeProfileModal);
    }
    if (els.profileModal) {
      els.profileModal.addEventListener("click", (event) => {
        if (event.target === els.profileModal || event.target.classList.contains("modal-backdrop")) {
          closeProfileModal();
        }
      });
    }
    if (els.profileGuideEnabledChk) {
      els.profileGuideEnabledChk.addEventListener("change", () => {
        setProfileGuideFormState({ busy: false });
        showStatus(els.profileGuideStatus, "");
      });
    }
    if (els.profileShowGuideBtn) {
      els.profileShowGuideBtn.addEventListener("click", () => {
        const enabledChecked = !!(els.profileGuideEnabledChk && els.profileGuideEnabledChk.checked);
        if (!enabledChecked) return;
        (async () => {
          if (enabledChecked !== !!state.appOnboardingEnabled) {
            await saveProfileGuidePreference();
          }
          openAppOnboarding({ force: true, closeProfile: true });
        })().catch((err) => {
          showStatus(els.profileGuideStatus, err.message || "Kunne ikke åbne guiden", "error");
        });
      });
    }

    if (els.folderList) {
      els.folderList.addEventListener("click", async (event) => {
        const openBtn = event.target.closest("[data-folder-open]");
        if (openBtn && els.folderSelect) {
          event.stopPropagation();
          els.folderSelect.value = openBtn.dataset.folderOpen || "";
          state.currentFolder = els.folderSelect.value;
          await loadFiles();
          return;
        }
        const btn = event.target.closest("[data-folder]");
        if (!btn || !els.folderSelect) return;
        if (state.selectMode) {
          toggleFolderSelection(btn.dataset.folder || "");
          cleanupPrintReadyExclusions();
          renderFolderBrowser();
          renderFiles();
          updateSelectModeUi();
          return;
        }
        els.folderSelect.value = btn.dataset.folder || "";
        state.currentFolder = els.folderSelect.value;
        await loadFiles();
      });

      els.folderList.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.target.closest("[data-folder-open]")) return;
        const tile = event.target.closest("[data-folder]");
        if (!tile || !els.folderSelect) return;
        event.preventDefault();
        if (state.selectMode) {
          toggleFolderSelection(tile.dataset.folder || "");
          cleanupPrintReadyExclusions();
          renderFolderBrowser();
          renderFiles();
          updateSelectModeUi();
          return;
        }
        els.folderSelect.value = tile.dataset.folder || "";
        state.currentFolder = els.folderSelect.value;
        await loadFiles();
      });
    }

    if (els.mapperSelectExitBtn) {
      els.mapperSelectExitBtn.addEventListener("click", () => toggleSelectMode(false));
    }
    if (els.mapperSelectClearBtn) {
      els.mapperSelectClearBtn.addEventListener("click", () => {
        clearSelections();
        renderFolderBrowser();
        renderFiles();
        updateSelectModeUi();
      });
    }
    if (els.mapperSelectDeleteBtn) {
      els.mapperSelectDeleteBtn.addEventListener("click", () => {
        deleteSelectedInSelectMode().catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke slette valgte elementer", "error");
        });
      });
    }
    if (els.mapperSelectPrintReadyBtn) {
      els.mapperSelectPrintReadyBtn.addEventListener("click", () => {
        if (!isPrintReadySelectMode()) {
          startPrintReadySelection();
          return;
        }
        markSelectionPrintReady().catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke markere klar til print", "error");
        });
      });
    }
    if (els.mapperSelectPrintedBtn) {
      els.mapperSelectPrintedBtn.addEventListener("click", () => {
        setPrintedForSelectedFiles(true).catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke markere filer som printet", "error");
        });
      });
    }

    if (els.folderUpBtn) {
      els.folderUpBtn.addEventListener("click", async () => {
        const current = currentFolder();
        const parent = parentFolder(current);
        if (!parent) return;
        if (!state.folders.some((f) => String(f.path || "") === parent)) return;
        state.currentFolder = parent;
        if (els.folderSelect) els.folderSelect.value = parent;
        await loadFiles();
      });
    }

    if (els.mapperSearchBtn) {
      els.mapperSearchBtn.addEventListener("click", async () => {
        if (state.selectMode) return;
        const query = String(window.prompt("Søg efter mappe (navn eller sti):") || "").trim().toLowerCase();
        if (!query) return;
        const hit = state.folders.find((f) => String(f.path || "").toLowerCase().includes(query));
        if (!hit) {
          showStatus(els.uploadStatus, "Ingen mappe matcher søgningen.", "error");
          return;
        }
        const target = String(hit.path || "");
        state.currentFolder = target;
        if (els.folderSelect) els.folderSelect.value = target;
        await loadFiles();
      });
    }

    if (els.thumbTopStatusCancelBtn && state.role === "admin") {
      els.thumbTopStatusCancelBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        cancelTopThumbGeneration().catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke annullere thumbnail-generering", "error");
        });
      });
    }

    if (els.mapperMenuBtn) {
      els.mapperMenuBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = !!(els.mapperMenu && !els.mapperMenu.classList.contains("hidden"));
        setMapperMenuOpen(!isOpen);
      });
    }

    if (els.mapperMenu) {
      els.mapperMenu.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-mapper-action]");
        if (!btn) return;
        const action = String(btn.dataset.mapperAction || "");
        setMapperMenuOpen(false);
        onMapperMenuAction(action).catch((err) => {
          showStatus(els.uploadStatus, err.message || "Menu handling fejlede", "error");
        });
      });
    }

    document.addEventListener("click", (event) => {
      if (!els.mapperMenu || !els.mapperMenuBtn) return;
      const withinMenu = event.target.closest("#mapperMenu");
      const withinBtn = event.target.closest("#mapperMenuBtn");
      if (!withinMenu && !withinBtn) setMapperMenuOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const shareModalOpen = !!(els.shareModal && !els.shareModal.classList.contains("hidden"));
      const printReadyModalOpen = !!(els.printReadyModal && !els.printReadyModal.classList.contains("hidden"));
      const printReadyNameModalOpen = !!(els.printReadyNameModal && !els.printReadyNameModal.classList.contains("hidden"));
      if (printReadyNameModalOpen) {
        settlePrintReadyNameModal("");
        return;
      }
      if (shareModalOpen || printReadyModalOpen) return;
      if (!state.selectMode) return;
      toggleSelectMode(false);
    });

    if (els.folderSelect) {
      els.folderSelect.addEventListener("change", async () => {
        state.currentFolder = els.folderSelect.value || "";
        await loadFiles();
      });
    }

    if (els.refreshFilesBtn) {
      els.refreshFilesBtn.addEventListener("click", async () => {
        await loadFolders();
        await loadFiles();
      });
    }

    if (els.uploadBtn && els.fileInput) {
      els.uploadBtn.addEventListener("click", () => {
        openMapperUploadPicker();
      });
      els.fileInput.addEventListener("change", async () => {
        const files = Array.from(els.fileInput.files || []);
        await startUpload(files);
        els.fileInput.value = "";
      });
    }

    if (els.mapperDesktopUploadBtn) {
      els.mapperDesktopUploadBtn.addEventListener("click", () => {
        openMapperUploadPicker();
      });
    }

    if (els.mapperImportLinkBtn) {
      els.mapperImportLinkBtn.addEventListener("click", () => {
        openImportLinkModal();
      });
    }

    if (els.mapperDropZone) {
      const dropZone = els.mapperDropZone;
      dropZone.addEventListener("click", () => {
        openMapperUploadPicker();
      });
      dropZone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        if (!currentFolderAllowsUserWrites()) return;
        dropZone.classList.add("dragover");
      });
      dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (!currentFolderAllowsUserWrites()) return;
        dropZone.classList.add("dragover");
      });
      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
      });
      dropZone.addEventListener("drop", (event) => {
        if (state.selectMode) {
          globalDropDepth = 0;
          hideGlobalDropOverlay();
          return;
        }
        event.preventDefault();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        dropZone.classList.remove("dragover");
        if (!currentFolderAllowsUserWrites()) {
          showStatus(els.uploadStatus, "Upload kan kun ske inde i en datomappe.", "error");
          return;
        }
        uploadDroppedDataTransfer(event.dataTransfer, currentFolder() || state.homeFolder).catch((err) => {
          showStatus(els.uploadStatus, err.message || "Upload via dropzone fejlede", "error");
        });
      });
    }

    document.addEventListener("dragstart", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest(".file-card") && !target.closest("#fileInfoDrawer")) return;
      internalImageDrag = true;
      if (target instanceof HTMLImageElement) {
        event.preventDefault();
      }
    });

    document.addEventListener("dragend", () => {
      internalImageDrag = false;
      globalDropDepth = 0;
      hideGlobalDropOverlay();
    });

    window.addEventListener("dragenter", (event) => {
      if (internalImageDrag) return;
      if (!(event.dataTransfer && event.dataTransfer.types && event.dataTransfer.types.includes("Files"))) return;
      globalDropDepth += 1;
      showGlobalDropOverlay();
    });

    window.addEventListener("dragover", (event) => {
      if (internalImageDrag) return;
      if (event.dataTransfer && event.dataTransfer.types && event.dataTransfer.types.includes("Files")) {
        event.preventDefault();
        showGlobalDropOverlay();
      }
    });

    window.addEventListener("dragleave", () => {
      globalDropDepth = Math.max(0, globalDropDepth - 1);
      if (globalDropDepth === 0) hideGlobalDropOverlay();
    });

    window.addEventListener("drop", async (event) => {
      globalDropDepth = 0;
      if (internalImageDrag) {
        internalImageDrag = false;
        hideGlobalDropOverlay();
        return;
      }

      const hasFiles = !!(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length);
      if (!hasFiles) {
        hideGlobalDropOverlay();
        return;
      }

      event.preventDefault();
      const droppedInsideMapperZone = !!(els.mapperDropZone && event.target instanceof Node && els.mapperDropZone.contains(event.target));
      if (droppedInsideMapperZone) {
        hideGlobalDropOverlay();
        return;
      }

      if (!canUploadFromCurrentView()) {
        const filesVisible = !!(els.tabFiles && !els.tabFiles.classList.contains("hidden"));
        showStatus(
          els.uploadStatus,
          filesVisible ? "Upload kan kun ske inde i en datomappe." : "Gå til Mapper-fanen for at uploade via drag og drop.",
          "error"
        );
        hideGlobalDropOverlay();
        return;
      }

      // Close overlay immediately when files are dropped; keep upload running in background UI.
      hideGlobalDropOverlay();

      try {
        await uploadDroppedDataTransfer(event.dataTransfer, currentFolder() || state.homeFolder);
      } catch (err) {
        showStatus(els.uploadStatus, err.message || "Upload via drag og drop fejlede", "error");
      }
    });

    if (els.createFolderBtn) {
      els.createFolderBtn.addEventListener("click", async () => {
        await createFolder();
      });
    }

    if (els.newUploadsOverlayToggle) {
      els.newUploadsOverlayToggle.addEventListener("click", () => {
        setUnseenUploadsExpanded(!state.unseenUploadsExpanded);
      });
    }

    if (els.newUploadsOverlayList) {
      const onOpenUnseenOverlayItem = async (target) => {
        const item = target && target.closest
          ? target.closest(".new-uploads-overlay-item[data-file-id]")
          : null;
        if (!item) return;

        const fileId = Number(item.dataset.fileId || 0);
        const folderPath = String(item.dataset.folderPath || "");
        if (!fileId && !folderPath) return;

        await openUnseenUploadItem(fileId, folderPath);
      };

      els.newUploadsOverlayList.addEventListener("click", (event) => {
        onOpenUnseenOverlayItem(event.target).catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke åbne upload", "error");
        });
      });

      els.newUploadsOverlayList.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpenUnseenOverlayItem(event.target).catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke åbne upload", "error");
        });
      });
    }

    if (els.fileGrid) {
      els.fileGrid.addEventListener("click", (event) => {
        onFileGridClick(event).catch((err) => {
          showStatus(els.uploadStatus, err.message || "Ukendt fejl", "error");
        });
      });
    }

    if (els.closeFileInfoBtn) {
      els.closeFileInfoBtn.addEventListener("click", closeFileInfoDrawer);
    }
    if (els.fileInfoBackdrop) {
      els.fileInfoBackdrop.addEventListener("click", closeFileInfoDrawer);
    }
    if (els.fileInfoSaveBtn) {
      els.fileInfoSaveBtn.addEventListener("click", () => {
        saveCurrentFileInfo().catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke gemme bemærkning", "error");
        });
      });
    }
    const queueInfoAttachmentUpload = (files) => {
      const id = Number(state.currentInfoFileId || 0);
      const list = Array.from(files || []);
      if (!id || !list.length) {
        if (els.fileInfoAttachInput) els.fileInfoAttachInput.value = "";
        return;
      }
      uploadFileAttachments(id, list)
        .catch((err) => {
          showStatus(els.fileInfoAttachStatus, err.message || "Kunne ikke uploade billeder", "error");
        })
        .finally(() => {
          if (els.fileInfoAttachInput) els.fileInfoAttachInput.value = "";
        });
    };

    const onAttachmentCardClick = (event) => {
      const card = event.target.closest(".file-info-attach-card");
      if (!card) return;
      event.preventDefault();
      const imageUrl = String(card.dataset.imageUrl || "").trim();
      if (!imageUrl) return;
      const imageName = String(card.dataset.imageName || "Billede");
      openImagePreviewModal(imageUrl, imageName);
    };

    if (els.fileInfoAttachList) {
      els.fileInfoAttachList.addEventListener("click", onAttachmentCardClick);
    }
    if (els.metadataAttachList) {
      els.metadataAttachList.addEventListener("click", onAttachmentCardClick);
    }

    if (els.fileInfoAttachUploadBtn && els.fileInfoAttachInput) {
      els.fileInfoAttachUploadBtn.addEventListener("click", () => {
        const id = Number(state.currentInfoFileId || 0);
        if (!id) return;
        els.fileInfoAttachInput.click();
      });
      els.fileInfoAttachInput.addEventListener("change", () => {
        queueInfoAttachmentUpload((els.fileInfoAttachInput && els.fileInfoAttachInput.files) || []);
      });
    }

    if (els.fileInfoAttachDropZone) {
      const zone = els.fileInfoAttachDropZone;
      zone.addEventListener("click", () => {
        const id = Number(state.currentInfoFileId || 0);
        if (!id || !els.fileInfoAttachInput) return;
        els.fileInfoAttachInput.click();
      });
      zone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        zone.classList.add("dragover");
      });
      zone.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        zone.classList.add("dragover");
      });
      zone.addEventListener("dragleave", (event) => {
        event.stopPropagation();
        zone.classList.remove("dragover");
      });
      zone.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        zone.classList.remove("dragover");
        const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
        queueInfoAttachmentUpload(files);
      });
    }
    if (els.fileInfoOpen3DBtn) {
      els.fileInfoOpen3DBtn.addEventListener("click", () => {
        const id = Number((els.fileInfoOpen3DBtn && els.fileInfoOpen3DBtn.dataset.fileId) || state.currentInfoFileId || 0);
        const file = fileById(id);
        if (!file) return;
        showStatus(els.uploadStatus, "");
        open3DModal(file).catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke åbne 3D", "error");
        });
      });
    }
    if (els.fileInfoSliceBtn) {
      els.fileInfoSliceBtn.addEventListener("click", async () => {
        const id = Number((els.fileInfoSliceBtn && els.fileInfoSliceBtn.dataset.fileId) || state.currentInfoFileId || 0);
        if (!id || els.fileInfoSliceBtn.disabled || SLICE_ACTIONS_DISABLED) return;
        const status = els.fileInfoSliceBtn.dataset.sliceStatus || "";
        if (status === "processing") {
          try {
            await fetch(`/api/files/${id}/slice/cancel`, { method: "POST" });
            await loadFiles();
          } catch (err) {
            showStatus(els.uploadStatus, err.message || "Kunne ikke stoppe slicing", "error");
          }
          return;
        }
        openSliceModal(id).catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke åbne slice-dialog", "error");
        });
      });
    }
    if (els.fileInfoFastSliceBtn) {
      els.fileInfoFastSliceBtn.addEventListener("click", async () => {
        const id = Number((els.fileInfoFastSliceBtn && els.fileInfoFastSliceBtn.dataset.fileId) || state.currentInfoFileId || 0);
        if (!id || els.fileInfoFastSliceBtn.disabled) return;
        try {
          els.fileInfoFastSliceBtn.disabled = true;
          await fastSliceFileById(id);
        } catch (err) {
          showStatus(els.uploadStatus, err.message || "Kunne ikke starte fast slice", "error");
          if (els.fileInfoFastSliceBtn) els.fileInfoFastSliceBtn.disabled = false;
        }
      });
    }

    if (els.sliceModalCloseBtn) {
      els.sliceModalCloseBtn.addEventListener("click", closeSliceModal);
    }
    if (els.sliceModalCancelBtn) {
      els.sliceModalCancelBtn.addEventListener("click", closeSliceModal);
    }
    if (els.slicePrinterSelect) {
      els.slicePrinterSelect.addEventListener("change", () => {
        // Try to preselect a known model when the printer profile name hints at one.
        // Keep this in sync with bed resolution before we refresh the preview.
        const name = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "");
        const guessed = guessKnownModelFromProfileName(name);
        if (els.sliceKnownPrinterSelect) {
          renderKnownPrinterSelect(els.sliceKnownPrinterSelect, guessed);
        }
        applySlicePrintProfileFilterForSelectedPrinter();
        applySliceFilamentFilterForSelectedPrinter();
        updateSliceNozzleUiForSelectedPrinter();
        refreshSlicePreviewBedFromSelection();
        loadSliceProcessSettings(true).catch((err) => {
          showStatus(els.sliceProcessSettingsStatus, err.message || "Kunne ikke hente process settings", "error");
        });
      });
    }
    if (els.slicePrintProfileSelect) {
      els.slicePrintProfileSelect.addEventListener("change", () => {
        syncSliceProcessProfileSelectFromMain();
        loadSliceProcessSettings(true).catch((err) => {
          showStatus(els.sliceProcessSettingsStatus, err.message || "Kunne ikke hente process settings", "error");
        });
      });
    }
    if (els.sliceProcessProfileSelect) {
      els.sliceProcessProfileSelect.addEventListener("change", () => {
        syncMainPrintProfileSelectFromProcess();
        loadSliceProcessSettings(true).catch((err) => {
          showStatus(els.sliceProcessSettingsStatus, err.message || "Kunne ikke hente process settings", "error");
        });
      });
    }
    if (els.sliceFilamentProfileSelect) {
      els.sliceFilamentProfileSelect.addEventListener("change", () => {
        loadSliceProcessSettings(true).catch((err) => {
          showStatus(els.sliceProcessSettingsStatus, err.message || "Kunne ikke hente process settings", "error");
        });
      });
    }
    if (els.sliceToolViewBtn) {
      els.sliceToolViewBtn.addEventListener("click", () => setSliceToolMode("view"));
    }
    if (els.sliceToolRotateBtn) {
      els.sliceToolRotateBtn.addEventListener("click", () => setSliceToolMode("rotate"));
    }
    if (els.sliceToolResetRotationBtn) {
      els.sliceToolResetRotationBtn.addEventListener("click", () => {
        setSliceModalRotation({ x: 0, y: 0, z: 0 });
      });
    }
    if (els.sliceRotateXInput) {
      els.sliceRotateXInput.addEventListener("change", () => {
        setSliceModalRotationAxis("x", els.sliceRotateXInput.value || 0);
      });
    }
    if (els.sliceRotateYInput) {
      els.sliceRotateYInput.addEventListener("change", () => {
        setSliceModalRotationAxis("y", els.sliceRotateYInput.value || 0);
      });
    }
    if (els.sliceRotateZInput) {
      els.sliceRotateZInput.addEventListener("change", () => {
        setSliceModalRotationAxis("z", els.sliceRotateZInput.value || 0);
      });
    }
    if (els.sliceProcessSettingsSearchInput) {
      els.sliceProcessSettingsSearchInput.addEventListener("input", () => {
        renderSliceProcessSettingsList();
      });
    }
    if (els.sliceProcessSettingsResetBtn) {
      els.sliceProcessSettingsResetBtn.addEventListener("click", () => {
        state.sliceProcessSettingsOverrides = {};
        renderSliceProcessSettingsList();
      });
    }
    if (els.sliceProcessTabBar) {
      els.sliceProcessTabBar.addEventListener("click", (event) => {
        const btn = event.target instanceof HTMLElement ? event.target.closest("[data-slice-process-tab]") : null;
        if (!btn) return;
        const tab = String(btn.getAttribute("data-slice-process-tab") || "").toLowerCase();
        setSliceProcessSettingsActiveTab(tab, true);
      });
    }
    if (els.sliceProcessSettingsList) {
      els.sliceProcessSettingsList.addEventListener("change", (event) => {
        const input = event.target instanceof HTMLElement ? event.target.closest("[data-slice-setting-key]") : null;
        if (!input) return;
        const key = String(input.getAttribute("data-slice-setting-key") || "");
        const valueType = String(input.getAttribute("data-slice-setting-type") || "string");
        if (input instanceof HTMLInputElement && valueType === "bool") {
          updateSliceProcessSettingOverride(key, !!input.checked, valueType);
          return;
        }
        if (input instanceof HTMLInputElement) {
          updateSliceProcessSettingOverride(key, input.value, valueType);
          return;
        }
        if (input instanceof HTMLTextAreaElement) {
          updateSliceProcessSettingOverride(key, input.value, valueType);
          return;
        }
        if (input instanceof HTMLSelectElement) {
          updateSliceProcessSettingOverride(key, input.value, valueType);
        }
      });
    }
    if (els.sliceKnownPrinterSelect) {
      renderKnownPrinterSelect(els.sliceKnownPrinterSelect, "");
      els.sliceKnownPrinterSelect.addEventListener("change", () => {
        applyKnownPrinterBedSize(els.sliceKnownPrinterSelect.value || "");
      });
    }

    if (els.sliceSaveKnownPrinterBtn) {
      els.sliceSaveKnownPrinterBtn.addEventListener("click", () => {
        const w = clampSliceBedSizeMm(els.sliceBedWidthInput && els.sliceBedWidthInput.value ? Number(els.sliceBedWidthInput.value) : 0, 0);
        const d = clampSliceBedSizeMm(els.sliceBedDepthInput && els.sliceBedDepthInput.value ? Number(els.sliceBedDepthInput.value) : 0, 0);
        if (!(w > 0 && d > 0)) {
          showStatus(els.sliceModalStatus, "Angiv først gyldig X og Y (mm) før du gemmer som kendt printer.", "error");
          return;
        }
        const name = window.prompt("Navn på kendt printer (fx 'Bambu Lab H2D'):", "Bambu Lab H2D");
        const label = String(name || "").trim();
        if (!label) return;
        // Normalize to an in-session entry by re-rendering the select with a temporary custom option
        const key = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
        // Build a transient list: prepend the custom one then built-ins (simple approach without persistence for now)
        const custom = { key, name: `${label} (${w}×${d})`, width_mm: w, depth_mm: d };
        const models = [KNOWN_PRINTER_MODELS[0], custom, ...KNOWN_PRINTER_MODELS.slice(1)];
        const html = models
          .map((m) => `<option value="${esc(m.key)}" data-width-mm="${esc(m.width_mm || 0)}" data-depth-mm="${esc(m.depth_mm || 0)}">${esc(m.name)}</option>`)
          .join("");
        if (els.sliceKnownPrinterSelect) {
          els.sliceKnownPrinterSelect.innerHTML = html;
          els.sliceKnownPrinterSelect.value = key;
        }
        showStatus(els.sliceModalStatus, `Tilføjet kendt printer: ${label} (${w}×${d} mm)`, "ok");
      });
    }
    if (els.sliceBedWidthInput) {
      const onManualBedChange = () => {
        if (els.sliceKnownPrinterSelect && String(els.sliceKnownPrinterSelect.value || "").trim()) {
          els.sliceKnownPrinterSelect.value = "";
        }
        const w = clampSliceBedSizeMm(els.sliceBedWidthInput.value || DEFAULT_SLICE_BED_SIZE_MM.width_mm, DEFAULT_SLICE_BED_SIZE_MM.width_mm);
        els.sliceBedWidthInput.value = String(w);
        refreshSlicePreviewBedFromSelection();
      };
      els.sliceBedWidthInput.addEventListener("change", onManualBedChange);
      els.sliceBedWidthInput.addEventListener("input", onManualBedChange);
    }
    if (els.sliceBedDepthInput) {
      const onManualBedChange = () => {
        if (els.sliceKnownPrinterSelect && String(els.sliceKnownPrinterSelect.value || "").trim()) {
          els.sliceKnownPrinterSelect.value = "";
        }
        const d = clampSliceBedSizeMm(els.sliceBedDepthInput.value || DEFAULT_SLICE_BED_SIZE_MM.depth_mm, DEFAULT_SLICE_BED_SIZE_MM.depth_mm);
        els.sliceBedDepthInput.value = String(d);
        refreshSlicePreviewBedFromSelection();
      };
      els.sliceBedDepthInput.addEventListener("change", onManualBedChange);
      els.sliceBedDepthInput.addEventListener("input", onManualBedChange);
    }
    const bindSliceLiftControls = () => {
      if (els.sliceLiftZRange) {
        els.sliceLiftZRange.disabled = true;
        els.sliceLiftZRange.value = "0";
        els.sliceLiftZRange.addEventListener("input", () => {
          setSliceModalLiftMm(0);
        });
        els.sliceLiftZRange.addEventListener("change", () => {
          setSliceModalLiftMm(0);
        });
      }
      if (els.sliceLiftZMinusBtn) {
        els.sliceLiftZMinusBtn.disabled = true;
        els.sliceLiftZMinusBtn.addEventListener("click", () => {
          setSliceModalLiftMm(0);
        });
      }
      if (els.sliceLiftZPlusBtn) {
        els.sliceLiftZPlusBtn.disabled = true;
        els.sliceLiftZPlusBtn.addEventListener("click", () => {
          setSliceModalLiftMm(0);
        });
      }
      setSliceModalLiftMm(0);
    };
    bindSliceLiftControls();

    if (els.sliceSupportModeSelect) {
      els.sliceSupportModeSelect.addEventListener("change", () => {
        updateSliceSupportControlsUi();
      });
    }
    if (els.sliceSupportTypeSelect) {
      els.sliceSupportTypeSelect.addEventListener("change", () => {
        const normalized = normalizeSliceSupportType(els.sliceSupportTypeSelect.value || "");
        if (els.sliceSupportTypeSelect.value !== normalized) {
          els.sliceSupportTypeSelect.value = normalized;
        }
      });
    }
    if (els.sliceSupportStyleSelect) {
      els.sliceSupportStyleSelect.addEventListener("change", () => {
        const normalized = normalizeSliceSupportStyle(els.sliceSupportStyleSelect.value || "");
        if (els.sliceSupportStyleSelect.value !== normalized) {
          els.sliceSupportStyleSelect.value = normalized;
        }
      });
    }
    if (els.sliceNozzleLeftDiameterSelect) {
      els.sliceNozzleLeftDiameterSelect.addEventListener("change", () => {
        const normalized = normalizeSliceNozzleDiameter(els.sliceNozzleLeftDiameterSelect.value || "");
        if (els.sliceNozzleLeftDiameterSelect.value !== normalized) {
          els.sliceNozzleLeftDiameterSelect.value = normalized;
        }
        applySlicePrintProfileFilterForSelectedPrinter();
        applySliceFilamentFilterForSelectedPrinter();
        loadSliceProcessSettings(true).catch((err) => {
          showStatus(els.sliceProcessSettingsStatus, err.message || "Kunne ikke hente process settings", "error");
        });
      });
    }
    if (els.sliceNozzleRightDiameterSelect) {
      els.sliceNozzleRightDiameterSelect.addEventListener("change", () => {
        const normalized = normalizeSliceNozzleDiameter(els.sliceNozzleRightDiameterSelect.value || "");
        if (els.sliceNozzleRightDiameterSelect.value !== normalized) {
          els.sliceNozzleRightDiameterSelect.value = normalized;
        }
        applySlicePrintProfileFilterForSelectedPrinter();
        applySliceFilamentFilterForSelectedPrinter();
        loadSliceProcessSettings(true).catch((err) => {
          showStatus(els.sliceProcessSettingsStatus, err.message || "Kunne ikke hente process settings", "error");
        });
      });
    }
    if (els.sliceNozzleLeftFlowSelect) {
      els.sliceNozzleLeftFlowSelect.addEventListener("change", () => {
        const normalized = normalizeSliceNozzleFlow(els.sliceNozzleLeftFlowSelect.value || "");
        if (els.sliceNozzleLeftFlowSelect.value !== normalized) {
          els.sliceNozzleLeftFlowSelect.value = normalized;
        }
      });
    }
    if (els.sliceNozzleRightFlowSelect) {
      els.sliceNozzleRightFlowSelect.addEventListener("change", () => {
        const normalized = normalizeSliceNozzleFlow(els.sliceNozzleRightFlowSelect.value || "");
        if (els.sliceNozzleRightFlowSelect.value !== normalized) {
          els.sliceNozzleRightFlowSelect.value = normalized;
        }
      });
    }
    updateSliceSupportControlsUi();
    syncSliceRotationInputs({ x: 0, y: 0, z: 0 });
    updateSliceToolUi();

    if (els.sliceModalStartBtn) {
      els.sliceModalStartBtn.disabled = SLICE_ACTIONS_DISABLED;
      if (SLICE_ACTIONS_DISABLED) els.sliceModalStartBtn.title = SLICE_DISABLED_TITLE;
      els.sliceModalStartBtn.addEventListener("click", async () => {
        if (SLICE_ACTIONS_DISABLED) return;
        const id = Number(state.currentSliceFileId || state.currentInfoFileId || 0);
        if (!id) return;
        let profiles = null;
        try {
          profiles = selectedSliceProfiles();
        } catch (err) {
          showStatus(els.sliceModalStatus, (err && err.message) || "Ugyldige process-indstillinger", "error");
          return;
        }
        els.sliceModalStartBtn.disabled = true;
        try {
          const usesDualNozzle = slicePrinterUsesDualNozzle(profiles.printer_profile);
          const normalizedProcessOverrides = profiles.process_overrides && typeof profiles.process_overrides === "object"
            ? normalizeSliceProcessSettingsMap(profiles.process_overrides)
            : {};
          let pickedNozzle = "";
          if (usesDualNozzle) {
            pickedNozzle = await promptSliceNozzlePick(
              normalizeSlicePrintNozzle(state.lastSliceSelection && state.lastSliceSelection.print_nozzle)
            );
            if (!pickedNozzle) {
              showStatus(els.sliceModalStatus, "Slicing annulleret: vælg venstre eller højre nozzle.", "error");
              return;
            }
            normalizedProcessOverrides.print_extruder_id = pickedNozzle === "right" ? 2 : 1;
          } else {
            delete normalizedProcessOverrides.print_extruder_id;
            delete normalizedProcessOverrides.printer_extruder_id;
          }
          profiles = {
            ...profiles,
            nozzle_right_diameter: usesDualNozzle ? profiles.nozzle_right_diameter : "",
            nozzle_right_flow: usesDualNozzle ? profiles.nozzle_right_flow : "",
            print_nozzle: pickedNozzle,
            process_overrides: normalizedProcessOverrides,
          };

          state.lastSliceSelection = {
            printer_profile: String(profiles.printer_profile || ""),
            print_profile: String(profiles.print_profile || ""),
            filament_profile: String(profiles.filament_profile || ""),
            support_mode: String(profiles.support_mode || "auto"),
            support_type: String(profiles.support_type || ""),
            support_style: String(profiles.support_style || ""),
            nozzle_left_diameter: normalizeSliceNozzleDiameter(profiles.nozzle_left_diameter || ""),
            nozzle_right_diameter: normalizeSliceNozzleDiameter(profiles.nozzle_right_diameter || ""),
            nozzle_left_flow: normalizeSliceNozzleFlow(profiles.nozzle_left_flow || ""),
            nozzle_right_flow: normalizeSliceNozzleFlow(profiles.nozzle_right_flow || ""),
            print_nozzle: usesDualNozzle ? pickedNozzle : "",
            rotation_x_degrees: clampSliceRotationDeg(profiles.rotation_x_degrees || 0),
            rotation_y_degrees: clampSliceRotationDeg(profiles.rotation_y_degrees || 0),
            rotation_z_degrees: clampSliceRotationDeg(profiles.rotation_z_degrees || 0),
            lift_z_mm: clampSliceLiftMm(profiles.lift_z_mm, 0),
            process_overrides: normalizedProcessOverrides,
          };

          showStatus(els.sliceModalStatus, "Starter slicing...", "ok");
          await sliceFileById(id, profiles);
          closeSliceModal();
        } catch (err) {
          showStatus(els.sliceModalStatus, err.message || "Kunne ikke starte slicing", "error");
        } finally {
          if (els.sliceModalStartBtn) els.sliceModalStartBtn.disabled = false;
        }
      });
    }
    if (els.sliceModal) {
      els.sliceModal.addEventListener("click", (event) => {
        if (event.target === els.sliceModal || event.target.classList.contains("modal-backdrop")) {
          closeSliceModal();
        }
      });
    }
    if (els.sliceNozzlePickLeftBtn) {
      els.sliceNozzlePickLeftBtn.addEventListener("click", () => {
        settleSliceNozzlePick("left");
      });
    }
    if (els.sliceNozzlePickRightBtn) {
      els.sliceNozzlePickRightBtn.addEventListener("click", () => {
        settleSliceNozzlePick("right");
      });
    }
    if (els.sliceNozzlePickCloseBtn) {
      els.sliceNozzlePickCloseBtn.addEventListener("click", () => {
        settleSliceNozzlePick("");
      });
    }
    if (els.sliceNozzlePickCancelBtn) {
      els.sliceNozzlePickCancelBtn.addEventListener("click", () => {
        settleSliceNozzlePick("");
      });
    }
    if (els.sliceNozzlePickModal) {
      els.sliceNozzlePickModal.addEventListener("click", (event) => {
        if (event.target === els.sliceNozzlePickModal || event.target.classList.contains("modal-backdrop")) {
          settleSliceNozzlePick("");
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const nozzlePickModalOpen = !!(els.sliceNozzlePickModal && !els.sliceNozzlePickModal.classList.contains("hidden"));
      if (nozzlePickModalOpen) {
        settleSliceNozzlePick("");
        return;
      }
      const imageModalOpen = !!(els.imagePreviewModal && !els.imagePreviewModal.classList.contains("hidden"));
      if (imageModalOpen) {
        closeImagePreviewModal();
        return;
      }
      const bedMapEditModalOpen = !!(els.slicerBedMapEditModal && !els.slicerBedMapEditModal.classList.contains("hidden"));
      if (bedMapEditModalOpen) {
        closeSlicerBedMapEditModal();
        return;
      }
      const slicerUploadModalOpen = !!(els.slicerUploadModal && !els.slicerUploadModal.classList.contains("hidden"));
      if (slicerUploadModalOpen) {
        closeSlicerUploadModal();
        return;
      }
      const smsConfirmModalOpen = !!(els.smsConfirmModal && !els.smsConfirmModal.classList.contains("hidden"));
      if (smsConfirmModalOpen) {
        settleSmsConfirmModal(false);
        return;
      }
      const smsOnboardingModalOpen = !!(els.smsOnboardingModal && !els.smsOnboardingModal.classList.contains("hidden"));
      if (smsOnboardingModalOpen) {
        closeSmsOnboardingModal();
        return;
      }
      const printReadyNameModalOpen = !!(els.printReadyNameModal && !els.printReadyNameModal.classList.contains("hidden"));
      if (printReadyNameModalOpen) {
        settlePrintReadyNameModal("");
        return;
      }
      const printReadyModalOpen = !!(els.printReadyModal && !els.printReadyModal.classList.contains("hidden"));
      if (printReadyModalOpen) {
        closePrintReadyModal();
        return;
      }
      const profileModalOpen = !!(els.profileModal && !els.profileModal.classList.contains("hidden"));
      if (profileModalOpen) {
        closeProfileModal();
        return;
      }
      const createUserModalOpen = !!(els.createUserModal && !els.createUserModal.classList.contains("hidden"));
      if (createUserModalOpen) {
        closeCreateUserModal();
        return;
      }
      const editUserModalOpen = !!(els.editUserModal && !els.editUserModal.classList.contains("hidden"));
      if (editUserModalOpen) {
        closeEditUserModal();
        return;
      }
      const nonUserFolderModalOpen = !!(els.nonUserFolderModal && !els.nonUserFolderModal.classList.contains("hidden"));
      if (nonUserFolderModalOpen) {
        closeNonUserFolderModal();
        return;
      }
      const shareModalOpen = !!(els.shareModal && !els.shareModal.classList.contains("hidden"));
      if (shareModalOpen) {
        closeShareModal();
        return;
      }
      const sliceModalOpen = !!(els.sliceModal && !els.sliceModal.classList.contains("hidden"));
      if (sliceModalOpen) {
        closeSliceModal();
        return;
      }
      if (state.currentInfoFileId) closeFileInfoDrawer();
    });

    const queueMetadataAttachmentUpload = (files) => {
      const current = getMetadataCurrentItem();
      const id = metadataAttachmentFileId(current);
      const list = Array.from(files || []);
      if (!id || !list.length) {
        if (els.metadataAttachInput) els.metadataAttachInput.value = "";
        return;
      }
      uploadMetadataAttachments(id, list)
        .catch((err) => {
          showStatus(els.metadataAttachStatus, err.message || "Kunne ikke uploade billeder", "error");
        })
        .finally(() => {
          if (els.metadataAttachInput) els.metadataAttachInput.value = "";
        });
    };

    if (els.metadataNoteInput) {
      els.metadataNoteInput.addEventListener("input", persistMetadataStepInputs);
      els.metadataNoteInput.addEventListener("change", persistMetadataStepInputs);
    }
    if (els.metadataQtyInput) {
      els.metadataQtyInput.addEventListener("input", persistMetadataStepInputs);
      els.metadataQtyInput.addEventListener("change", persistMetadataStepInputs);
    }
    if (els.metadataScaleUpEnabled) {
      els.metadataScaleUpEnabled.addEventListener("change", () => {
        setScaleUpControls(
          els.metadataScaleUpEnabled,
          els.metadataScaleUpControls,
          els.metadataScaleUpValue,
          els.metadataScaleUpUnit,
          !!els.metadataScaleUpEnabled.checked
        );
        if (els.metadataScaleUpEnabled.checked && els.metadataScaleUpValue) {
          els.metadataScaleUpValue.focus();
        }
        persistMetadataStepInputs();
      });
    }
    if (els.metadataScaleUpValue) {
      els.metadataScaleUpValue.addEventListener("input", persistMetadataStepInputs);
      els.metadataScaleUpValue.addEventListener("change", persistMetadataStepInputs);
    }
    if (els.metadataScaleUpUnit) {
      els.metadataScaleUpUnit.addEventListener("change", persistMetadataStepInputs);
    }
    if (els.metadataPrevBtn) {
      els.metadataPrevBtn.addEventListener("click", () => moveMetadataStep(-1));
    }
    if (els.metadataNextBtn) {
      els.metadataNextBtn.addEventListener("click", () => moveMetadataStep(1));
    }
    if (els.metadataAttachUploadBtn && els.metadataAttachInput) {
      els.metadataAttachUploadBtn.addEventListener("click", () => {
        const current = getMetadataCurrentItem();
        if (!current || !metadataAttachmentFileId(current)) return;
        els.metadataAttachInput.click();
      });
      els.metadataAttachInput.addEventListener("change", () => {
        queueMetadataAttachmentUpload((els.metadataAttachInput && els.metadataAttachInput.files) || []);
      });
    }
    if (els.metadataAttachDropZone) {
      const zone = els.metadataAttachDropZone;
      zone.addEventListener("click", () => {
        const current = getMetadataCurrentItem();
        if (!current || !metadataAttachmentFileId(current) || !els.metadataAttachInput) return;
        els.metadataAttachInput.click();
      });
      zone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        zone.classList.add("dragover");
      });
      zone.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        zone.classList.add("dragover");
      });
      zone.addEventListener("dragleave", (event) => {
        event.stopPropagation();
        zone.classList.remove("dragover");
      });
      zone.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalDropDepth = 0;
        hideGlobalDropOverlay();
        zone.classList.remove("dragover");
        const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
        queueMetadataAttachmentUpload(files);
      });
    }

    if (els.metadataCancelBtn) {
      els.metadataCancelBtn.addEventListener("click", closeMetadataModal);
    }
    if (els.metadataSaveBtn) {
      els.metadataSaveBtn.addEventListener("click", () => {
        saveBatchMetadata().catch((err) => {
          showStatus(els.metadataAttachStatus, err.message || "Kunne ikke gemme metadata", "error");
        });
      });
    }
    if (els.metadataModal) {
      els.metadataModal.addEventListener("click", (event) => {
        if (event.target === els.metadataModal || event.target.classList.contains("modal-backdrop")) {
          closeMetadataModal();
        }
      });
    }

    if (els.closeImagePreviewBtn) {
      els.closeImagePreviewBtn.addEventListener("click", closeImagePreviewModal);
    }
    if (els.imagePreviewModal) {
      els.imagePreviewModal.addEventListener("click", (event) => {
        if (event.target === els.imagePreviewModal || event.target.classList.contains("modal-backdrop")) {
          closeImagePreviewModal();
        }
      });
    }

    if (els.closeModelModalBtn) {
      els.closeModelModalBtn.addEventListener("click", close3DModal);
    }
    if (els.modelModal) {
      els.modelModal.addEventListener("click", (event) => {
        if (event.target === els.modelModal || event.target.classList.contains("modal-backdrop")) {
          const guardUntil = Number(state.modelModalCloseGuardUntil || 0);
          if (Date.now() < guardUntil) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          close3DModal();
        }
      });
    }

    if (els.shareUsePasswordChk) {
      els.shareUsePasswordChk.addEventListener("change", () => {
        if (!els.sharePasswordWrap) return;
        els.sharePasswordWrap.classList.toggle("hidden", !els.shareUsePasswordChk.checked);
        if (!els.shareUsePasswordChk.checked && els.sharePasswordInput) {
          els.sharePasswordInput.value = "";
        }
      });
    }

    if (els.shareFoldersSelect) {
      els.shareFoldersSelect.addEventListener("change", () => {
        updateShareModalSelectionSummary();
      });
    }

    if (els.importLinkCloseBtn) {
      els.importLinkCloseBtn.addEventListener("click", closeImportLinkModal);
    }
    if (els.importLinkCancelBtn) {
      els.importLinkCancelBtn.addEventListener("click", closeImportLinkModal);
    }
    if (els.importLinkNextBtn) {
      els.importLinkNextBtn.addEventListener("click", () => {
        fetchImportLinkPreview().catch((err) => {
          showStatus(els.importLinkStatus, err.message || "Kunne ikke hente link-oplysninger", "error");
        });
      });
    }
    if (els.importLinkInput) {
      els.importLinkInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        fetchImportLinkPreview().catch((err) => {
          showStatus(els.importLinkStatus, err.message || "Kunne ikke hente link-oplysninger", "error");
        });
      });
    }
    if (els.importLinkModal) {
      els.importLinkModal.addEventListener("click", (event) => {
        if (event.target === els.importLinkModal || event.target.classList.contains("modal-backdrop")) {
          closeImportLinkModal();
        }
      });
    }
    if (els.importPreviewCloseBtn) {
      els.importPreviewCloseBtn.addEventListener("click", closeImportPreviewModal);
    }
    if (els.importPreviewBackBtn) {
      els.importPreviewBackBtn.addEventListener("click", () => {
        closeImportPreviewModal();
        openImportLinkModal();
      });
    }
    if (els.importPreviewUseBtn) {
      els.importPreviewUseBtn.addEventListener("click", () => {
        const selectedProfiles = importSelectedProfiles(state.importLinkPreview || {});
        if (!selectedProfiles.length) {
          showStatus(els.importPreviewStatus, "Vælg mindst en printprofil først.", "error");
          return;
        }

        const downloadUrls = importSelectedProfileDownloadUrls(state.importLinkPreview || {});
        if (!downloadUrls.length) {
          showStatus(els.importPreviewStatus, "Download er ikke understøttet for den valgte kilde/profil.", "error");
          return;
        }

        let started = 0;
        downloadUrls.forEach((url, index) => {
          window.setTimeout(() => {
            if (triggerHiddenDownload(url)) started += 1;
          }, index * 220);
        });

        const source = String((state.importLinkPreview && state.importLinkPreview.source_label) || "MakerWorld").trim() || "MakerWorld";
        const selectedCount = selectedProfiles.length;
        const plannedCount = downloadUrls.length;
        showStatus(
          els.importPreviewStatus,
          `Starter download af ${plannedCount} valgt${plannedCount === 1 ? "" : "e"} profil${plannedCount === 1 ? "" : "er"} fra ${source}. Hvis intet hentes, så log ind på MakerWorld først og prøv igen.`,
          "ok"
        );

        window.setTimeout(() => {
          if (started <= 0) {
            showStatus(els.importPreviewStatus, "Browseren blokerede download. Prøv igen eller tillad download/popups.", "error");
          } else if (started < plannedCount) {
            showStatus(
              els.importPreviewStatus,
              `Download delvist startet (${started}/${plannedCount}) for ${selectedCount} valgte profiler.`,
              "ok"
            );
          }
        }, Math.max(1200, plannedCount * 260));
      });
    }
    if (els.importPreviewBody) {
      els.importPreviewBody.addEventListener("change", (event) => {
        const input = event.target && event.target.closest ? event.target.closest('input[name="importProfiles"]') : null;
        if (!input) return;

        const checkedIds = Array.from(els.importPreviewBody.querySelectorAll('input[name="importProfiles"]:checked'))
          .map((node) => String((node && node.value) || "").trim())
          .filter(Boolean);
        state.importLinkSelectedProfileIds = Array.from(new Set(checkedIds));
        state.importLinkSelectedProfileId = state.importLinkSelectedProfileIds[0] || "";

        els.importPreviewBody.querySelectorAll(".import-profile-card").forEach((card) => {
          const checkbox = card.querySelector('input[name="importProfiles"]');
          card.classList.toggle("selected", !!checkbox && checkbox.checked);
        });

        if (els.importPreviewUseBtn) {
          const profiles = Array.isArray(state.importLinkPreview && state.importLinkPreview.profiles)
            ? state.importLinkPreview.profiles
            : [];
          const selectedCount = state.importLinkSelectedProfileIds.length;
          els.importPreviewUseBtn.disabled = profiles.length <= 0 || selectedCount <= 0;
          if (profiles.length <= 0) {
            els.importPreviewUseBtn.textContent = "Ingen profiler";
          } else if (selectedCount > 0) {
            els.importPreviewUseBtn.textContent = `Download profiler (${selectedCount})`;
          } else {
            els.importPreviewUseBtn.textContent = "Download profiler";
          }
        }

        showStatus(els.importPreviewStatus, "");
      });
      els.importPreviewBody.addEventListener("click", (event) => {
        const thumb = event.target && event.target.closest ? event.target.closest(".import-preview-thumb-btn") : null;
        if (thumb) {
          const imageUrl = String((thumb.dataset && thumb.dataset.importPreviewImage) || "").trim();
          if (!imageUrl || imageUrl === String(state.importLinkSelectedImageUrl || "")) return;
          state.importLinkSelectedImageUrl = imageUrl;
          renderImportPreview(state.importLinkPreview || {});
          return;
        }

        const cover = event.target && event.target.closest ? event.target.closest(".import-preview-cover-btn") : null;
        if (!cover) return;
        const imageUrl = String((cover.dataset && cover.dataset.importPreviewOpen) || "").trim();
        if (!imageUrl) return;
        const imageName = String((state.importLinkPreview && state.importLinkPreview.title) || "MakerWorld billede").trim() || "MakerWorld billede";
        openImagePreviewModal(imageUrl, imageName);
      });
    }
    if (els.importPreviewModal) {
      els.importPreviewModal.addEventListener("click", (event) => {
        if (event.target === els.importPreviewModal || event.target.classList.contains("modal-backdrop")) {
          closeImportPreviewModal();
        }
      });
    }

    if (els.shareModalCloseBtn) {
      els.shareModalCloseBtn.addEventListener("click", closeShareModal);
    }
    if (els.shareModalCancelBtn) {
      els.shareModalCancelBtn.addEventListener("click", closeShareModal);
    }
    if (els.shareModal) {
      els.shareModal.addEventListener("click", (event) => {
        if (event.target === els.shareModal || event.target.classList.contains("modal-backdrop")) {
          closeShareModal();
        }
      });
    }

    if (els.printReadyModalCloseBtn) {
      els.printReadyModalCloseBtn.addEventListener("click", closePrintReadyModal);
    }
    if (els.printReadyModal) {
      els.printReadyModal.addEventListener("click", (event) => {
        if (event.target === els.printReadyModal || event.target.classList.contains("modal-backdrop")) {
          closePrintReadyModal();
        }
      });
    }
    if (els.printReadySendBtn) {
      els.printReadySendBtn.addEventListener("click", () => {
        sendCurrentPrintReadyProject().catch((err) => {
          showStatus(els.printReadyModalStatus, err.message || "Kunne ikke sende til admin", "error");
        });
      });
    }
    if (els.printReadyNameCancelBtn) {
      els.printReadyNameCancelBtn.addEventListener("click", () => settlePrintReadyNameModal(""));
    }
    if (els.printReadyNameSendBtn) {
      els.printReadyNameSendBtn.addEventListener("click", confirmPrintReadyProjectName);
    }
    if (els.printReadyNameInput) {
      els.printReadyNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          confirmPrintReadyProjectName();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          settlePrintReadyNameModal("");
        }
      });
      els.printReadyNameInput.addEventListener("input", () => {
        showStatus(els.printReadyNameStatus, "");
      });
    }
    if (els.printReadyNameModal) {
      els.printReadyNameModal.addEventListener("click", (event) => {
        if (event.target === els.printReadyNameModal || event.target.classList.contains("modal-backdrop")) {
          settlePrintReadyNameModal("");
        }
      });
    }
    if (els.smsConfirmCloseBtn) {
      els.smsConfirmCloseBtn.addEventListener("click", () => settleSmsConfirmModal(false));
    }
    if (els.smsConfirmNoBtn) {
      els.smsConfirmNoBtn.addEventListener("click", () => settleSmsConfirmModal(false));
    }
    if (els.smsConfirmYesBtn) {
      els.smsConfirmYesBtn.addEventListener("click", () => settleSmsConfirmModal(true));
    }
    if (els.smsConfirmAddTrackingBtn) {
      els.smsConfirmAddTrackingBtn.addEventListener("click", () => {
        addTrackingFromSmsConfirmInput().catch((err) => {
          showStatus(els.smsConfirmStatus, err.message || "Kunne ikke tilføje tracking", "error");
        });
      });
    }
    if (els.smsConfirmTrackingInput) {
      els.smsConfirmTrackingInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        addTrackingFromSmsConfirmInput().catch((err) => {
          showStatus(els.smsConfirmStatus, err.message || "Kunne ikke tilføje tracking", "error");
        });
      });
    }
    if (els.smsConfirmExtractBtn) {
      els.smsConfirmExtractBtn.addEventListener("click", () => {
        extractTrackingFromSmsConfirmLabel().catch((err) => {
          showStatus(els.smsConfirmStatus, err.message || "Kunne ikke udtrække pakkenummer", "error");
        });
      });
    }
    if (els.smsConfirmLabelPdfInput) {
      els.smsConfirmLabelPdfInput.addEventListener("change", () => {
        showStatus(els.smsConfirmStatus, "");
      });
    }
    if (els.smsConfirmModal) {
      els.smsConfirmModal.addEventListener("click", (event) => {
        if (event.target === els.smsConfirmModal || event.target.classList.contains("modal-backdrop")) {
          settleSmsConfirmModal(false);
        }
      });
    }
    if (els.smsOnboardingCountrySelect) {
      els.smsOnboardingCountrySelect.addEventListener("change", () => {
        updateSmsOnboardingPreview();
        showStatus(els.smsOnboardingStatus, "");
      });
    }
    if (els.smsOnboardingPhoneInput) {
      els.smsOnboardingPhoneInput.addEventListener("input", () => {
        updateSmsOnboardingPreview();
        showStatus(els.smsOnboardingStatus, "");
      });
    }
    if (els.smsOnboardingCodeInput) {
      els.smsOnboardingCodeInput.addEventListener("input", () => {
        els.smsOnboardingCodeInput.value = String(els.smsOnboardingCodeInput.value || "").replace(/\D/g, "").slice(0, 6);
        showStatus(els.smsOnboardingStatus, "");
      });
    }
    [els.smsOnboardingSkipBtn, els.smsOnboardingSkipTopBtn].forEach((btn) => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        skipSmsOnboarding().catch((err) => {
          showStatus(els.smsOnboardingStatus, err.message || "Kunne ikke gemme SMS-valg", "error");
        });
      });
    });
    if (els.smsOnboardingSendCodeBtn) {
      els.smsOnboardingSendCodeBtn.addEventListener("click", () => {
        sendSmsOnboardingCode().catch((err) => {
          showStatus(els.smsOnboardingStatus, err.message || "Kunne ikke sende SMS-kode", "error");
        });
      });
    }
    if (els.smsOnboardingVerifyBtn) {
      els.smsOnboardingVerifyBtn.addEventListener("click", () => {
        verifySmsOnboardingCode().catch((err) => {
          showStatus(els.smsOnboardingStatus, err.message || "Kunne ikke verificere SMS-kode", "error");
        });
      });
    }

    if (els.createShareBtn) {
      els.createShareBtn.addEventListener("click", () => {
        createShare().catch((err) => {
          showStatus(els.shareCreateStatus, err.message || "Kunne ikke oprette deling", "error");
        });
      });
    }

    if (els.copyShareLinkBtn && els.shareResultLink) {
      els.copyShareLinkBtn.addEventListener("click", async () => {
        const text = els.shareResultLink.value || "";
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          showStatus(els.shareCreateStatus, "Link kopieret.", "ok");
        } catch {
          showStatus(els.shareCreateStatus, "Kunne ikke kopiere link.", "error");
        }
      });
    }

    if (els.sharesTableBody) {
      els.sharesTableBody.addEventListener("click", (event) => {
        onShareTableClick(event).catch((err) => {
          showStatus(els.sharesListStatus, err.message || "Fejl i deling", "error");
        });
      });
    }

    if (els.printReadyRefreshBtn) {
      els.printReadyRefreshBtn.addEventListener("click", () => {
        loadPrintReadyProjects().catch((err) => {
          showStatus(els.printReadyStatus, err.message || "Kunne ikke hente klar til print", "error");
        });
      });
    }
    if (els.finishedProjectsRefreshBtn) {
      els.finishedProjectsRefreshBtn.addEventListener("click", () => {
        loadFinishedProjects().catch((err) => {
          showStatus(els.finishedProjectsStatus, err.message || "Kunne ikke hente færdige projekter", "error");
        });
      });
    }

    if (els.printReadyAdminList) {
      els.printReadyAdminList.addEventListener("click", (event) => {
        onPrintReadyAdminClick(event).catch((err) => {
          showStatus(els.printReadyStatus, err.message || "Fejl i projektet", "error");
        });
      });
      els.printReadyAdminList.addEventListener("change", (event) => {
        const input = event.target && event.target.closest
          ? event.target.closest(".print-ready-project-file-input")
          : null;
        if (!input) return;
        const projectId = Number(input.dataset.projectId || 0);
        uploadPrintReadyProjectFiles(projectId, input).catch((err) => {
          showStatus(els.printReadyStatus, err.message || "Kunne ikke uploade projektfil", "error");
          input.value = "";
        });
      });
      bindPrintReadyProjectFileDrop(els.printReadyAdminList, els.printReadyStatus);
    }
    if (els.finishedProjectsList) {
      els.finishedProjectsList.addEventListener("click", (event) => {
        onPrintReadyAdminClick(event).catch((err) => {
          showStatus(els.finishedProjectsStatus, err.message || "Fejl i projektet", "error");
        });
      });
      els.finishedProjectsList.addEventListener("change", (event) => {
        const input = event.target && event.target.closest
          ? event.target.closest(".print-ready-project-file-input")
          : null;
        if (!input) return;
        const projectId = Number(input.dataset.projectId || 0);
        uploadPrintReadyProjectFiles(projectId, input).catch((err) => {
          showStatus(els.finishedProjectsStatus, err.message || "Kunne ikke uploade projektfil", "error");
          input.value = "";
        });
      });
      bindPrintReadyProjectFileDrop(els.finishedProjectsList, els.finishedProjectsStatus);
    }

    if (els.dnsSaveBtn) {
      els.dnsSaveBtn.addEventListener("click", () => {
        saveDns().catch((err) => {
          showStatus(els.dnsStatus, err.message || "Kunne ikke gemme DNS", "error");
        });
      });
    }
    if (els.smsSaveBtn) {
      els.smsSaveBtn.addEventListener("click", () => {
        saveSmsSettings().catch((err) => {
          showStatus(els.smsStatus, err.message || "Kunne ikke gemme SMS indstillinger", "error");
        });
      });
    }
    if (els.smsTestBtn) {
      els.smsTestBtn.addEventListener("click", () => {
        sendSmsTest().catch((err) => {
          showStatus(els.smsStatus, err.message || "Kunne ikke sende test-SMS", "error");
        });
      });
    }
    if (els.smsResetTokenBtn) {
      els.smsResetTokenBtn.addEventListener("click", () => {
        resetSmsGatewayToken().catch((err) => {
          showStatus(els.smsStatus, err.message || "Kunne ikke nulstille SMS token", "error");
        });
      });
    }
    if (els.smsGatewayEnabledChk) {
      els.smsGatewayEnabledChk.addEventListener("change", () => showStatus(els.smsStatus, ""));
    }
    if (els.smsGatewaySenderInput) {
      els.smsGatewaySenderInput.addEventListener("input", () => {
        updateSmsSenderCounter();
        showStatus(els.smsStatus, "");
      });
    }
    if (els.smsGatewayTokenInput) {
      els.smsGatewayTokenInput.addEventListener("focus", beginSmsTokenEdit);
      els.smsGatewayTokenInput.addEventListener("input", () => {
        state.smsGatewayTokenPreviewActive = false;
        showStatus(els.smsStatus, "");
      });
      els.smsGatewayTokenInput.addEventListener("blur", restoreSmsTokenPreviewIfEmpty);
    }
    if (els.smsTestRecipientInput) {
      els.smsTestRecipientInput.addEventListener("input", () => showStatus(els.smsStatus, ""));
    }

    if (els.makerworldSaveBtn) {
      els.makerworldSaveBtn.addEventListener("click", () => {
        saveMakerworldSettings().catch((err) => {
          showStatus(els.makerworldStatus, err.message || "Kunne ikke logge ind på MakerWorld", "error");
        });
      });
    }
    if (els.makerworldLoginOpenLink) {
      els.makerworldLoginOpenLink.addEventListener("click", (event) => {
        if (els.makerworldLoginOpenLink.classList.contains("disabled") || !state.makerworldLoginFlowUrl) {
          event.preventDefault();
          return;
        }
        showStatus(els.makerworldLoginLiveStatus, "MakerWorld login er åbnet i ny fane.", "ok");
      });
    }
    if (els.makerworldResetPasswordBtn) {
      els.makerworldResetPasswordBtn.addEventListener("click", () => {
        resetMakerworldPassword().catch((err) => {
          showStatus(els.makerworldStatus, err.message || "Kunne ikke nulstille MakerWorld kodeord", "error");
        });
      });
    }
    if (els.makerworldUsernameInput) {
      els.makerworldUsernameInput.addEventListener("input", () => showStatus(els.makerworldStatus, ""));
    }
    if (els.makerworldPasswordInput) {
      els.makerworldPasswordInput.addEventListener("focus", beginMakerworldPasswordEdit);
      els.makerworldPasswordInput.addEventListener("input", () => {
        state.makerworldPasswordPreviewActive = false;
        showStatus(els.makerworldStatus, "");
      });
      els.makerworldPasswordInput.addEventListener("blur", restoreMakerworldPasswordPreviewIfEmpty);
    }

    if (els.openCreateUserModalBtn) {
      els.openCreateUserModalBtn.addEventListener("click", openCreateUserModal);
    }
    if (els.createUserModalCancelBtn) {
      els.createUserModalCancelBtn.addEventListener("click", closeCreateUserModal);
    }
    if (els.createUserForm) {
      els.createUserForm.addEventListener("submit", (event) => {
        event.preventDefault();
        createUser().catch((err) => {
          showStatus(els.createUserModalStatus, err.message || "Kunne ikke oprette bruger", "error");
        });
      });
    }
    if (els.createUserModal) {
      els.createUserModal.addEventListener("click", (event) => {
        if (event.target === els.createUserModal || event.target.classList.contains("modal-backdrop")) {
          closeCreateUserModal();
        }
      });
    }
    if (els.editUserModalCancelBtn) {
      els.editUserModalCancelBtn.addEventListener("click", closeEditUserModal);
    }
    if (els.editUserForm) {
      els.editUserForm.addEventListener("submit", (event) => {
        event.preventDefault();
        updateUser().catch((err) => {
          showStatus(els.editUserModalStatus, err.message || "Kunne ikke opdatere bruger", "error");
        });
      });
    }
    if (els.editUserModal) {
      els.editUserModal.addEventListener("click", (event) => {
        if (event.target === els.editUserModal || event.target.classList.contains("modal-backdrop")) {
          closeEditUserModal();
        }
      });
    }
    if (els.nonUserFolderCancelBtn) {
      els.nonUserFolderCancelBtn.addEventListener("click", closeNonUserFolderModal);
    }
    if (els.nonUserFolderFirstName) {
      els.nonUserFolderFirstName.addEventListener("input", () => {
        showStatus(els.nonUserFolderStatus, "");
        updateNonUserFolderPreview();
      });
    }
    if (els.nonUserFolderLastName) {
      els.nonUserFolderLastName.addEventListener("input", () => {
        showStatus(els.nonUserFolderStatus, "");
        updateNonUserFolderPreview();
      });
    }
    if (els.nonUserFolderForm) {
      els.nonUserFolderForm.addEventListener("submit", (event) => {
        event.preventDefault();
        createNonUserFolder().catch((err) => {
          showStatus(els.nonUserFolderStatus, err.message || "Kunne ikke oprette mappe", "error");
        });
      });
    }
    if (els.nonUserFolderModal) {
      els.nonUserFolderModal.addEventListener("click", (event) => {
        if (event.target === els.nonUserFolderModal || event.target.classList.contains("modal-backdrop")) {
          closeNonUserFolderModal();
        }
      });
    }
    if (els.usersTableBody) {
      els.usersTableBody.addEventListener("click", (event) => {
        onUsersTableClick(event).catch((err) => {
          showStatus(els.userStatus, err.message || "Kunne ikke behandle bruger", "error");
        });
      });
    }
    if (els.createSignupLinkBtn) {
      els.createSignupLinkBtn.addEventListener("click", () => {
        createSignupLink().catch((err) => {
          showStatus(els.signupLinksStatus, err.message || "Kunne ikke generere oprettelseslink", "error");
        });
      });
    }
    if (els.signupRequestsTableBody) {
      els.signupRequestsTableBody.addEventListener("click", (event) => {
        onSignupRequestsTableClick(event).catch((err) => {
          showStatus(els.signupRequestsStatus, err.message || "Kunne ikke behandle oprettelsen", "error");
        });
      });
    }
    if (els.signupLinksTableBody) {
      els.signupLinksTableBody.addEventListener("click", (event) => {
        onSignupLinksTableClick(event).catch((err) => {
          showStatus(els.signupLinksStatus, err.message || "Kunne ikke ændre oprettelseslink", "error");
        });
      });
    }
    if (els.trackingAddBtn) {
      els.trackingAddBtn.addEventListener("click", () => {
        addTracking().catch((err) => {
          showStatus(els.trackingStatus, err.message || "Kunne ikke tilføje tracking", "error");
        });
      });
    }
    if (els.trackingNumberInput) {
      els.trackingNumberInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        addTracking().catch((err) => {
          showStatus(els.trackingStatus, err.message || "Kunne ikke tilføje tracking", "error");
        });
      });
      els.trackingNumberInput.addEventListener("input", () => showStatus(els.trackingStatus, ""));
    }
    if (els.trackingTableBody) {
      els.trackingTableBody.addEventListener("click", (event) => {
        onTrackingTableClick(event).catch((err) => {
          showStatus(els.trackingStatus, err.message || "Kunne ikke ændre tracking", "error");
        });
      });
    }
    if (els.trackingShareModalCloseBtn) {
      els.trackingShareModalCloseBtn.addEventListener("click", closeTrackingShareModal);
    }
    if (els.trackingAssignModalCloseBtn) {
      els.trackingAssignModalCloseBtn.addEventListener("click", closeTrackingAssignModal);
    }
    if (els.trackingAssignCancelBtn) {
      els.trackingAssignCancelBtn.addEventListener("click", closeTrackingAssignModal);
    }
    if (els.trackingAssignSaveBtn) {
      els.trackingAssignSaveBtn.addEventListener("click", () => {
        saveTrackingAssignee().catch((err) => {
          showStatus(els.trackingAssignStatus, err.message || "Kunne ikke gemme tildeling", "error");
        });
      });
    }
    if (els.trackingShareCopyBtn) {
      els.trackingShareCopyBtn.addEventListener("click", () => {
        copyTrackingShareLink().catch((err) => {
          showStatus(els.trackingShareStatus, err.message || "Kunne ikke kopiere link", "error");
        });
      });
    }
    if (els.trackingShareModal) {
      els.trackingShareModal.addEventListener("click", (event) => {
        if (event.target === els.trackingShareModal || event.target.classList.contains("modal-backdrop")) {
          closeTrackingShareModal();
        }
      });
    }
    if (els.trackingAssignModal) {
      els.trackingAssignModal.addEventListener("click", (event) => {
        if (event.target === els.trackingAssignModal || event.target.classList.contains("modal-backdrop")) {
          closeTrackingAssignModal();
        }
      });
    }

    if (els.logsRefreshBtn) {
      els.logsRefreshBtn.addEventListener("click", () => {
        loadAdminLogs().catch((err) => {
          showStatus(els.logsStatus, err.message || "Kunne ikke hente logs", "error");
        });
      });
    }
    if (els.logsClearBtn) {
      els.logsClearBtn.addEventListener("click", () => {
        clearAdminLogs().catch((err) => {
          showStatus(els.logsStatus, err.message || "Kunne ikke rydde logs", "error");
        });
      });
    }
    if (els.rejectedFileTypesRefreshBtn) {
      els.rejectedFileTypesRefreshBtn.addEventListener("click", () => {
        loadRejectedFileTypes().catch((err) => {
          showStatus(els.rejectedFileTypesStatus, err.message || "Kunne ikke hente afviste filtyper", "error");
        });
      });
    }
    if (els.rejectedFileTypesClearBtn) {
      els.rejectedFileTypesClearBtn.addEventListener("click", () => {
        clearRejectedFileTypes().catch((err) => {
          showStatus(els.rejectedFileTypesStatus, err.message || "Kunne ikke rydde afviste filtyper", "error");
        });
      });
    }

    if (els.slicerRefreshBtn) {
      els.slicerRefreshBtn.addEventListener("click", () => {
        loadSlicerSettings().catch((err) => {
          showStatus(els.slicerSettingsStatus, err.message || "Kunne ikke hente slicer-profiler", "error");
        });
      });
    }
    if (els.slicerBedMapSaveBtn) {
      els.slicerBedMapSaveBtn.addEventListener("click", () => {
        saveSlicerBedMap().catch((err) => {
          showStatus(els.slicerSettingsStatus, err.message || "Kunne ikke gemme printer-mapping", "error");
        });
      });
    }
    if (els.slicerBedMapResetBtn) {
      els.slicerBedMapResetBtn.addEventListener("click", () => {
        resetSlicerBedMap().catch((err) => {
          showStatus(els.slicerSettingsStatus, err.message || "Kunne ikke nulstille printer-mapping", "error");
        });
      });
    }
    if (els.slicerBedMapAddBtn) {
      els.slicerBedMapAddBtn.addEventListener("click", () => {
        openAddSlicerBedMapPrinterPrompt();
      });
    }
    if (els.slicerBedMapTableBody) {
      els.slicerBedMapTableBody.addEventListener("change", (event) => {
        onSlicerBedMapTableChange(event);
      });
      els.slicerBedMapTableBody.addEventListener("click", (event) => {
        onSlicerBedMapTableClick(event);
      });
    }
    if (els.slicerBedMapEditSaveBtn) {
      els.slicerBedMapEditSaveBtn.addEventListener("click", () => {
        applySlicerBedMapModalEdit();
      });
    }
    if (els.slicerBedMapEditCloseBtn) {
      els.slicerBedMapEditCloseBtn.addEventListener("click", closeSlicerBedMapEditModal);
    }
    if (els.slicerBedMapEditCancelBtn) {
      els.slicerBedMapEditCancelBtn.addEventListener("click", closeSlicerBedMapEditModal);
    }
    if (els.slicerBedMapEditModal) {
      els.slicerBedMapEditModal.addEventListener("click", (event) => {
        if (event.target === els.slicerBedMapEditModal || event.target.classList.contains("modal-backdrop")) {
          closeSlicerBedMapEditModal();
        }
      });
    }

    if (els.slicerMachineOpenUploadBtn) {
      els.slicerMachineOpenUploadBtn.addEventListener("click", () => openSlicerUploadModal("machine"));
    }
    if (els.slicerProcessOpenUploadBtn) {
      els.slicerProcessOpenUploadBtn.addEventListener("click", () => openSlicerUploadModal("process"));
    }
    if (els.slicerFilamentOpenUploadBtn) {
      els.slicerFilamentOpenUploadBtn.addEventListener("click", () => openSlicerUploadModal("filament"));
    }
    if (els.slicerConfigOpenUploadBtn) {
      els.slicerConfigOpenUploadBtn.addEventListener("click", () => openSlicerUploadModal("config"));
    }

    const slicerTableBodies = [
      els.slicerMachineTableBody,
      els.slicerProcessTableBody,
      els.slicerFilamentTableBody,
      els.slicerConfigTableBody,
    ].filter(Boolean);
    slicerTableBodies.forEach((tableBody) => {
      tableBody.addEventListener("click", (event) => {
        onSlicerProfileTableClick(event).catch((err) => {
          showStatus(els.slicerSettingsStatus, err.message || "Kunne ikke slette slicer-fil", "error");
        });
      });
    });

    if (els.slicerUploadPickBtn) {
      els.slicerUploadPickBtn.addEventListener("click", () => {
        if (!els.slicerUploadInput) return;
        els.slicerUploadInput.click();
      });
    }
    if (els.slicerUploadInput) {
      els.slicerUploadInput.addEventListener("change", () => {
        setSlicerUploadFiles((els.slicerUploadInput && els.slicerUploadInput.files) || []);
      });
    }
    if (els.slicerUploadConfirmBtn) {
      els.slicerUploadConfirmBtn.addEventListener("click", () => {
        submitSlicerUploadModal().catch((err) => {
          showStatus(els.slicerUploadModalStatus, err.message || "Upload fejlede", "error");
        });
      });
    }
    if (els.slicerUploadCloseBtn) {
      els.slicerUploadCloseBtn.addEventListener("click", closeSlicerUploadModal);
    }
    if (els.slicerUploadCancelBtn) {
      els.slicerUploadCancelBtn.addEventListener("click", closeSlicerUploadModal);
    }
    if (els.slicerUploadModal) {
      els.slicerUploadModal.addEventListener("click", (event) => {
        if (event.target === els.slicerUploadModal || event.target.classList.contains("modal-backdrop")) {
          closeSlicerUploadModal();
        }
      });
    }
    // App onboarding modal elements/bindings
    if (els.appOnboardingNavItems && els.appOnboardingNavItems.length) {
      els.appOnboardingNavItems.forEach((item) => {
        item.addEventListener("click", () => {
          setAppOnboardingPanel(String(item.dataset.guidePanel || ""));
        });
      });
    }
    if (els.appOnboardingGuideGifs && els.appOnboardingGuideGifs.length) {
      els.appOnboardingGuideGifs.forEach((gif) => {
        ensureAppOnboardingGuideMedia(gif);
        rememberAppOnboardingGifSrc(gif);
        gif.addEventListener("error", () => {
          const fallbackSrc = String(gif.dataset.fallbackSrc || "").trim();
          if (!fallbackSrc || gif.dataset.fallbackApplied === "1") return;
          gif.dataset.fallbackApplied = "1";
          gif.dataset.originalSrc = fallbackSrc;
          gif.src = appOnboardingReplaySrc(fallbackSrc, state.appOnboardingStepToken || Date.now());
        });
      });
    }
    if (els.appOnboardingDoneBtn) {
      els.appOnboardingDoneBtn.addEventListener("click", () => {
        completeAppOnboardingFromModal().catch((err) => {
          showStatus(els.appOnboardingStatus, err.message || "Kunne ikke gemme guidevalg", "error");
        });
      });
    }
    bindSlicerUploadModalDropZone();
    bindSlicerProfileCardDropZones();
  }

  function bindMobileNav() {
    const bottom = els.mobileBottomNav;
    const backdrop = els.mobileSidebarBackdrop;
    if (!bottom) return;

    bottom.addEventListener("click", async (event) => {
      const btn = event.target.closest(".mobile-nav-item");
      if (!btn) return;
      const action = String(btn.dataset.mobileAction || "");
      if (action === "navigate") {
        if (document.body.classList.contains("mobile-drawer-open")) {
          closeMobileDrawer();
        } else {
          openMobileDrawer();
        }
        return;
      }
      if (action === "files") {
        try {
          setTab("files");
          if (els.folderSelect) {
            els.folderSelect.value = String(state.homeFolder || "");
            state.currentFolder = els.folderSelect.value;
          }
          await loadFiles();
        } catch (_) {}
      } else if (action === "profile") {
        openProfileModal();
      } else if (action === "settings") {
        if (state.role === "admin") {
          setTab("settings");
        }
      }
      // Close drawer when a non-navigate action is taken
      closeMobileDrawer();
    });

    if (backdrop) {
      backdrop.addEventListener("click", closeMobileDrawer);
    }
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMobileDrawer();
    });
  }

  async function init() {
    applyRoleVisibility();
    updateSelectModeUi();
    bindEvents();
    // Ensure bottom nav + drawer work on mobile
    bindMobileNav();
    renderProfileSmsCountryOptions();
    renderSmsCountryOptions(els.smsOnboardingCountrySelect);
    setProfileSmsFormState({ busy: false });
    bindUploadMonitorDomEvents();
    renderUploadMonitor();
    await loadFolders();
    await loadFiles();
    if (state.role === "admin") {
      await loadShares();
      await loadPrintReadyProjects();
      await loadDns();
      await loadUsers();
      setSettingsTab("shares");
    }
    setTab("files");
    await maybeShowAppOnboarding();
    await maybeShowSmsOnboarding();
  }

  init().catch((err) => {
    showStatus(els.uploadStatus, err.message || "Init fejlede", "error");
  });
})();
