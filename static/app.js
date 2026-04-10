(function () {
  "use strict";

  document.body.classList.add("app-mode");

  const boot = document.getElementById("bootstrap");
  const state = {
    username: (boot && boot.dataset.username) || "",
    role: ((boot && boot.dataset.role) || "user").toLowerCase(),
    homeFolder: (boot && boot.dataset.homeFolder) || "",
    currentFolder: "",
    folders: [],
    files: [],
    zipJobs: [],
    shares: [],
    users: [],
    adminLogs: [],
    pendingMetadata: [],
    metadataIndex: 0,
    threeModules: null,
    three: null,
    thumbPollTimer: null,
    currentSettingsTab: "shares",
    currentInfoFileId: 0,
    currentFileAttachments: [],
    currentSliceFileId: 0,
    sliceProfiles: null,
    lastSliceSelection: {
      printer_profile: "",
      print_profile: "",
      filament_profile: "",
    },
    infoDrawerHideTimer: null,
    selectMode: false,
    selectedFolderPaths: new Set(),
    selectedFileIds: new Set(),
    folderPreviewCache: Object.create(null),
    folderPreviewLoading: new Set(),
    folderPreviewRequestToken: 0,
    modelModalCloseGuardUntil: 0,
  };

  const els = {
    contentHeader: document.getElementById("contentHeader"),
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    statFiles: document.getElementById("statFiles"),
    statFolders: document.getElementById("statFolders"),
    statShares: document.getElementById("statShares"),
    sidebarNav: document.getElementById("sidebarNav"),
    tabFiles: document.getElementById("tab-files"),
    tabSettings: document.getElementById("tab-settings"),
    settingsTabs: document.getElementById("settingsTabs"),
    settingsTabSelect: document.getElementById("settingsTabSelect"),
    settingsPanelShares: document.getElementById("settings-panel-shares"),
    settingsPanelDns: document.getElementById("settings-panel-dns"),
    settingsPanelUsers: document.getElementById("settings-panel-users"),
    settingsPanelLogs: document.getElementById("settings-panel-logs"),
    adminOnly: Array.from(document.querySelectorAll(".admin-only")),
    folderSelect: document.getElementById("folderSelect"),
    refreshFilesBtn: document.getElementById("refreshFilesBtn"),
    uploadBtn: document.getElementById("uploadBtn"),
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
    folderList: document.getElementById("folderList"),
    fileGrid: document.getElementById("fileGrid"),
    folderUpBtn: document.getElementById("folderUpBtn"),
    mapperDropZone: document.getElementById("mapperDropZone"),
    thumbTopStatus: document.getElementById("thumbTopStatus"),
    thumbTopStatusLabel: document.getElementById("thumbTopStatusLabel"),
    thumbTopStatusBar: document.getElementById("thumbTopStatusBar"),
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
    fileInfoNote: document.getElementById("fileInfoNote"),
    fileInfoQty: document.getElementById("fileInfoQty"),
    fileInfoAttachUploadBtn: document.getElementById("fileInfoAttachUploadBtn"),
    fileInfoAttachInput: document.getElementById("fileInfoAttachInput"),
    fileInfoAttachDropZone: document.getElementById("fileInfoAttachDropZone"),
    fileInfoAttachStatus: document.getElementById("fileInfoAttachStatus"),
    fileInfoAttachList: document.getElementById("fileInfoAttachList"),
    fileInfoSaveBtn: document.getElementById("fileInfoSaveBtn"),
    fileInfoDownloadLink: document.getElementById("fileInfoDownloadLink"),
    fileInfoSliceBtn: document.getElementById("fileInfoSliceBtn"),
    fileInfoOpen3DBtn: document.getElementById("fileInfoOpen3DBtn"),
    sliceModal: document.getElementById("sliceModal"),
    sliceModalCloseBtn: document.getElementById("sliceModalCloseBtn"),
    sliceModalCancelBtn: document.getElementById("sliceModalCancelBtn"),
    sliceModalStartBtn: document.getElementById("sliceModalStartBtn"),
    sliceModalFileName: document.getElementById("sliceModalFileName"),
    sliceModalStatus: document.getElementById("sliceModalStatus"),
    slicePrinterSelect: document.getElementById("slicePrinterSelect"),
    slicePrintProfileSelect: document.getElementById("slicePrintProfileSelect"),
    sliceFilamentProfileSelect: document.getElementById("sliceFilamentProfileSelect"),
    metadataModal: document.getElementById("metadataModal"),
    metadataStepCounter: document.getElementById("metadataStepCounter"),
    metadataCurrentFileName: document.getElementById("metadataCurrentFileName"),
    metadataNoteInput: document.getElementById("metadataNoteInput"),
    metadataQtyInput: document.getElementById("metadataQtyInput"),
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
    sharesTableBody: document.getElementById("sharesTableBody"),
    dnsExternalBaseUrlInput: document.getElementById("dnsExternalBaseUrlInput"),
    dnsSaveBtn: document.getElementById("dnsSaveBtn"),
    dnsStatus: document.getElementById("dnsStatus"),
    createUserUsername: document.getElementById("createUserUsername"),
    createUserPassword: document.getElementById("createUserPassword"),
    createUserRole: document.getElementById("createUserRole"),
    createUserBtn: document.getElementById("createUserBtn"),
    userStatus: document.getElementById("userStatus"),
    usersTableBody: document.getElementById("usersTableBody"),
    logsRefreshBtn: document.getElementById("logsRefreshBtn"),
    logsStatus: document.getElementById("logsStatus"),
    logsTableBody: document.getElementById("logsTableBody"),
  };

  const TABS = {
    files: {
      title: "Mapper",
      subtitle: "Mapper, upload og metadata",
    },
    settings: {
      title: "Indstillinger",
      subtitle: "Delinger, DNS og brugere",
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
    return filesVisible && !state.selectMode;
  }

  function showGlobalDropOverlay() {
    ensureUploadOverlayRefs();
    if (!els.uploadOverlay) return;
    const canUploadHere = canUploadFromCurrentView();
    const targetFolder = String(currentFolder() || state.homeFolder || "").trim();
    const titleEl = els.uploadOverlay.querySelector(".upload-title");
    if (titleEl) {
      titleEl.textContent = canUploadHere
        ? "Slip filer eller mapper for at uploade"
        : "Upload er ikke aktiv her";
    }
    if (els.uploadProgressText) {
      els.uploadProgressText.textContent = canUploadHere
        ? `Upload destination: ${targetFolder || "(ingen mappe valgt)"}`
        : "Gå til Mapper for at uploade";
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

  const SCALE_CAN_HEIGHT_MM = 122;
  const SCALE_CAN_DIAMETER_MM = 66;
  const PRESENTATION_TABLE_SIZE_MM = 600;
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

  function setTab(tab) {
    const target = String(tab || "files");
    const map = {
      files: els.tabFiles,
      settings: els.tabSettings,
    };
    Object.entries(map).forEach(([key, section]) => {
      if (!section) return;
      section.classList.toggle("hidden", key !== target);
    });
    const navButtons = Array.from((els.sidebarNav && els.sidebarNav.querySelectorAll(".nav-item")) || []);
    navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === target));
    if (els.contentHeader) {
      els.contentHeader.classList.toggle("hidden", target === "files");
    }
    const tabMeta = TABS[target] || { title: "FjordShare", subtitle: "" };
    if (els.pageTitle) els.pageTitle.textContent = tabMeta.title || "FjordShare";
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
      if (target !== "files") els.thumbTopStatus.classList.add("hidden");
      else updateThumbTopStatus();
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

  function setSettingsTab(tab) {
    const target = String(tab || "shares");
    state.currentSettingsTab = target;

    const panelMap = {
      shares: els.settingsPanelShares,
      dns: els.settingsPanelDns,
      users: els.settingsPanelUsers,
      logs: els.settingsPanelLogs,
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
    if (!isAdmin) setTab("files");
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

  function selectedCount() {
    return state.selectedFolderPaths.size + state.selectedFileIds.size;
  }

  function selectedFileCount() {
    return state.selectedFileIds.size;
  }

  function clearSelections() {
    state.selectedFolderPaths.clear();
    state.selectedFileIds.clear();
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

  function toggleSelectMode(forceValue = null) {
    const next = forceValue == null ? !state.selectMode : !!forceValue;
    if (state.selectMode === next) return;
    state.selectMode = next;
    if (!next) {
      clearSelections();
    } else {
      closeFileInfoDrawer();
    }
    updateSelectModeUi();
    renderFolderBrowser();
    renderFiles();
  }

  function toggleFolderSelection(folderPath) {
    const key = String(folderPath || "").trim();
    if (!key) return;
    if (state.selectedFolderPaths.has(key)) state.selectedFolderPaths.delete(key);
    else state.selectedFolderPaths.add(key);
  }

  function toggleFileSelection(fileId) {
    const id = Number(fileId || 0);
    if (!id) return;
    if (state.selectedFileIds.has(id)) state.selectedFileIds.delete(id);
    else state.selectedFileIds.add(id);
  }

  function pruneSelections() {
    const currentFolderPath = currentFolder() || state.homeFolder || "";
    const childPathSet = new Set(listDirectChildren(currentFolderPath).map((c) => String(c.path || "")));
    const fileIdSet = new Set(state.files.map((f) => Number(f.id || 0)).filter((n) => n > 0));

    for (const folderPath of Array.from(state.selectedFolderPaths)) {
      if (!childPathSet.has(folderPath)) state.selectedFolderPaths.delete(folderPath);
    }
    for (const id of Array.from(state.selectedFileIds)) {
      if (!fileIdSet.has(Number(id))) state.selectedFileIds.delete(Number(id));
    }
  }

  function updateSelectModeUi() {
    const on = !!state.selectMode;
    if (els.mapperShell) els.mapperShell.classList.toggle("select-mode", on);

    const count = selectedCount();
    const fileCount = selectedFileCount();
    if (els.mapperSelectSummary) {
      els.mapperSelectSummary.textContent = on ? `${count} valgt` : "";
      els.mapperSelectSummary.classList.toggle("hidden", !on);
    }
    if (els.mapperSelectExitBtn) {
      els.mapperSelectExitBtn.classList.toggle("hidden", !on);
    }
    if (els.mapperSelectDeleteBtn) {
      els.mapperSelectDeleteBtn.classList.toggle("hidden", !on);
      els.mapperSelectDeleteBtn.disabled = count <= 0;
      els.mapperSelectDeleteBtn.textContent = count > 0 ? `Slet (${count})` : "Slet";
    }
    if (els.mapperSelectPrintedBtn) {
      const allowPrinted = on && state.role === "admin";
      els.mapperSelectPrintedBtn.classList.toggle("hidden", !allowPrinted);
      els.mapperSelectPrintedBtn.disabled = fileCount <= 0;
      els.mapperSelectPrintedBtn.textContent = fileCount > 0 ? `Printet (${fileCount})` : "Printet";
    }

    if (els.mapperMenuSelect) {
      els.mapperMenuSelect.textContent = on ? "Afslut vælg mode" : "Vælg mode";
    }
    if (els.mapperMenuUpload) {
      els.mapperMenuUpload.disabled = on;
    }
    if (els.mapperMenuCreateFolder) {
      els.mapperMenuCreateFolder.disabled = on;
    }
    if (els.mapperMenuShare) {
      const hasShareSelection = state.selectedFolderPaths.size > 0;
      els.mapperMenuShare.disabled = !on || !hasShareSelection;
    }
    if (els.mapperMenuRenameFolder) {
      els.mapperMenuRenameFolder.disabled = !on || state.selectedFolderPaths.size !== 1;
    }

    if (els.mapperSearchBtn) {
      els.mapperSearchBtn.disabled = on;
      els.mapperSearchBtn.classList.toggle("disabled", on);
    }
    if (els.folderUpBtn) {
      els.folderUpBtn.classList.toggle("disabled", on);
    }
    if (els.mapperDropZone) {
      els.mapperDropZone.classList.toggle("disabled", on);
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
        });
      }
    }
    return Array.from(out.values()).sort((a, b) => a.name.localeCompare(b.name, "da"));
  }

  function updateFolderUiState() {
    const folder = currentFolder() || state.homeFolder || "";
    const isRoot = !!folder && !!state.homeFolder && folder === state.homeFolder;
    const folderLabel = isRoot ? `${folder} (rodmappe)` : (folder || "-");
    if (els.mapperDropZone) {
      els.mapperDropZone.textContent = `Slip filer eller mapper her for at uploade til: ${folderLabel}`;
    }
    if (els.folderUpBtn) {
      const parent = parentFolder(folder);
      const canGoUp = !!parent && state.folders.some((f) => String(f.path || "") === parent);
      els.folderUpBtn.disabled = state.selectMode || !canGoUp;
    }
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
        const isSelected = state.selectedFolderPaths.has(String(child.path || ""));
        const previewHtml = folderTilePreviewHtml(child.path);
        return `
          <button class="folder-tile ${isSelected ? "selected" : ""}" type="button" data-folder="${esc(child.path)}">
            <span class="select-mark ${isSelected ? "selected" : ""}"></span>
            <div class="folder-tile-preview">${previewHtml}</div>
            <div class="folder-tile-name">${esc(child.name)}</div>
            <div class="folder-tile-meta">${esc(child.path)}${perm}</div>
          </button>
        `;
      })
      .join("");

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
        const data = await api(`/api/files?folder=${encodeURIComponent(path)}`);
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
        if (home && options.includes(home)) state.currentFolder = home;
        else state.currentFolder = options[0] || "";
      }
    }
    if (state.currentFolder && !options.includes(state.currentFolder)) {
      state.currentFolder = options[0] || "";
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
      return `<model-viewer src="${esc(file.content_url)}" camera-controls interaction-prompt="none" disable-pan></model-viewer>`;
    }
    if (String(file.mime_type || "").startsWith("image/")) {
      return `<img src="${esc(file.content_url)}" alt="${esc(file.filename)}" loading="lazy">`;
    }
    if (String(file.mime_type || "").startsWith("video/")) {
      return `<video src="${esc(file.content_url)}" muted preload="metadata" controls></video>`;
    }
    if (file.is_3d) {
      if (String(file.thumb_status || "").toLowerCase() === "error") {
        return `<div class="placeholder">Thumbnail fejl</div>`;
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
      processing: { cls: "processing", text: "Slicer..." },
      ready: { cls: "ready", text: "Slice klar" },
      error: { cls: "error", text: "Slice fejl" },
    }[status];
    if (!meta) return "";
    const fileId = Number(file.id || 0);
    const disabledAttr = (status === "queued" || status === "processing") ? "disabled" : "";
    if (!fileId) {
      return `<span class="file-slice-badge ${meta.cls}">${esc(meta.text)}</span>`;
    }
    return `<button class="file-slice-badge ${meta.cls}" type="button" data-action="open-slice" data-file-id="${fileId}" ${disabledAttr}>${esc(meta.text)}</button>`;
  }

  function sliceButtonLabelForStatus(status) {
    if (status === "queued") return "Slicer i kø";
    if (status === "processing") return "Slicer...";
    if (status === "ready") return "Slice igen";
    if (status === "error") return "Prøv slicing igen";
    return "Slice STL";
  }

  function toStringList(values) {
    if (!Array.isArray(values)) return [];
    return values.map((v) => String(v || "").trim()).filter(Boolean);
  }

  function renderSliceSelect(selectEl, options, placeholder = "Vælg") {
    if (!selectEl) return;
    const list = toStringList(options);
    const html = [`<option value="">${esc(placeholder)}</option>`]
      .concat(list.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`))
      .join("");
    selectEl.innerHTML = html;
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
      parse_error: String(data.parse_error || ""),
      source: String(data.source || ""),
      config_path: String(data.config_path || ""),
    };
    return state.sliceProfiles;
  }

  function closeSliceModal() {
    state.currentSliceFileId = 0;
    showStatus(els.sliceModalStatus, "");
    if (els.sliceModal) els.sliceModal.classList.add("hidden");
  }

  async function openSliceModal(fileId) {
    const file = fileById(fileId);
    if (!file || !file.can_slice || state.role !== "admin") return;

    state.currentSliceFileId = Number(file.id || 0);
    if (els.sliceModalFileName) els.sliceModalFileName.textContent = String(file.filename || "-");
    if (els.sliceModal) els.sliceModal.classList.remove("hidden");
    if (els.sliceModalStartBtn) els.sliceModalStartBtn.disabled = true;
    showStatus(els.sliceModalStatus, "Henter slice-profiler...", "ok");

    try {
      const profiles = await loadSliceProfiles(true);
      renderSliceSelect(els.slicePrinterSelect, profiles.printers, "Auto / fra config");
      renderSliceSelect(els.slicePrintProfileSelect, profiles.print_profiles, "Auto / fra config");
      renderSliceSelect(els.sliceFilamentProfileSelect, profiles.filament_profiles, "Auto / fra config");

      setSliceSelectValue(els.slicePrinterSelect, state.lastSliceSelection.printer_profile);
      setSliceSelectValue(els.slicePrintProfileSelect, state.lastSliceSelection.print_profile);
      setSliceSelectValue(els.sliceFilamentProfileSelect, state.lastSliceSelection.filament_profile);

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
      renderSliceSelect(els.slicePrinterSelect, [], "Auto / fra config");
      renderSliceSelect(els.slicePrintProfileSelect, [], "Auto / fra config");
      renderSliceSelect(els.sliceFilamentProfileSelect, [], "Auto / fra config");
      showStatus(els.sliceModalStatus, err.message || "Kunne ikke hente slice-profiler", "error");
      if (els.sliceModalStartBtn) els.sliceModalStartBtn.disabled = false;
    }
  }

  function selectedSliceProfiles() {
    const printer_profile = String((els.slicePrinterSelect && els.slicePrinterSelect.value) || "").trim();
    const print_profile = String((els.slicePrintProfileSelect && els.slicePrintProfileSelect.value) || "").trim();
    const filament_profile = String((els.sliceFilamentProfileSelect && els.sliceFilamentProfileSelect.value) || "").trim();
    return {
      printer_profile,
      print_profile,
      filament_profile,
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
    if (els.fileInfoNote) els.fileInfoNote.value = String(file.note || "");
    if (els.fileInfoQty) els.fileInfoQty.value = String(Math.max(1, Number(file.quantity || 1) || 1));
    if (els.fileInfoDownloadLink) {
      els.fileInfoDownloadLink.href = String(file.download_url || "#");
    }
    if (els.fileInfoOpen3DBtn) {
      els.fileInfoOpen3DBtn.classList.toggle("hidden", !file.is_3d_openable);
      els.fileInfoOpen3DBtn.dataset.fileId = String(id);
    }
    if (els.fileInfoSliceBtn) {
      const canSlice = state.role === "admin" && !!file.can_slice;
      const sliceStatus = normalizedSliceStatus(file);
      const isBusy = sliceStatus === "queued" || sliceStatus === "processing";
      els.fileInfoSliceBtn.classList.toggle("hidden", !canSlice);
      els.fileInfoSliceBtn.disabled = !canSlice || isBusy;
      els.fileInfoSliceBtn.dataset.fileId = String(id);
      els.fileInfoSliceBtn.textContent = sliceButtonLabelForStatus(sliceStatus);
      const errorMessage = String(file.slice_error || "").trim();
      if (sliceStatus === "error" && errorMessage) {
        els.fileInfoSliceBtn.title = errorMessage;
      } else {
        els.fileInfoSliceBtn.removeAttribute("title");
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
      requestAnimationFrame(() => els.fileInfoDrawer.classList.add("open"));
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
    const quantity = Math.max(1, Number((els.fileInfoQty && els.fileInfoQty.value) || 1) || 1);
    await api(`/api/files/${id}/metadata`, { method: "PATCH", body: { note, quantity } });
    showStatus(els.uploadStatus, "Fil-information gemt.", "ok");
    await loadFiles();
  }

  async function sliceFileById(fileId, profileSelection = null) {
    const id = Number(fileId || 0);
    if (!id) return;
    const profiles = profileSelection && typeof profileSelection === "object" ? profileSelection : {};
    const body = {};
    const printerProfile = String(profiles.printer_profile || "").trim();
    const printProfile = String(profiles.print_profile || "").trim();
    const filamentProfile = String(profiles.filament_profile || "").trim();
    if (printerProfile) body.printer_profile = printerProfile;
    if (printProfile) body.print_profile = printProfile;
    if (filamentProfile) body.filament_profile = filamentProfile;
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

  function renderFiles() {
    if (!els.fileGrid) return;
    if (!state.files.length) {
      els.fileGrid.innerHTML = `<div class="panel"><p class="hint">Ingen filer i denne mappe endnu.</p></div>`;
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
        const isSelected = state.selectedFileIds.has(id);
        const isPrinted = !!file.printed;
        const printedBadge = isPrinted ? `<span class="file-print-badge">Printet</span>` : "";
        const sliceBadge = sliceBadgeHtml(file);
        return `
          <article class="file-card file-card-compact ${isSelected ? "selected" : ""}" data-file-id="${id}">
            <div class="file-preview">
              <span class="select-mark ${isSelected ? "selected" : ""}"></span>
              <button class="file-info-btn" data-action="open-info" data-file-id="${id}" aria-label="Vis fil-info">i</button>
              ${printedBadge}
              ${sliceBadge}
              ${filePreviewHtml(file)}
            </div>
            <div class="file-caption" title="${esc(file.filename)}">${esc(file.filename)}</div>
          </article>
        `;
      })
      .join("");
    els.fileGrid.innerHTML = html;

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
      } else {
        queued += 1;
      }
    }

    const pending = queued + processing;
    const done = ready + error;
    const progress = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
    return { total, ready, queued, processing, error, pending, done, progress };
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

  function updateThumbTopStatus() {
    if (!els.thumbTopStatus || !els.thumbTopStatusLabel || !els.thumbTopStatusBar) return;
    const stats = thumbQueueStats();
    const zipStats = zipQueueStats();
    const sliceStats = sliceQueueStats();
    const shouldShow = stats.pending > 0
      || stats.error > 0
      || zipStats.pending > 0
      || zipStats.error > 0
      || sliceStats.pending > 0
      || sliceStats.error > 0;
    els.thumbTopStatus.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) {
      els.thumbTopStatusLabel.textContent = "Thumbnails: Klar";
      els.thumbTopStatusBar.classList.remove("indeterminate");
      els.thumbTopStatusBar.style.width = "0%";
      return;
    }

    const labels = [];
    if (zipStats.pending > 0 || zipStats.error > 0) {
      let zipLabel = `ZIP udpakning: ${zipStats.done}/${zipStats.total} færdig`;
      if (zipStats.processing > 0) zipLabel += ` · ${zipStats.processing} behandler`;
      if (zipStats.queued > 0) zipLabel += ` · ${zipStats.queued} i kø`;
      if (zipStats.error > 0) zipLabel += ` · fejl: ${zipStats.error}`;
      labels.push(zipLabel);
    }

    if (sliceStats.pending > 0 || sliceStats.error > 0) {
      let sliceLabel = `Slicing: ${sliceStats.ready}/${sliceStats.total} færdig`;
      if (sliceStats.processing > 0) sliceLabel += ` · ${sliceStats.processing} behandler`;
      if (sliceStats.queued > 0) sliceLabel += ` · ${sliceStats.queued} i kø`;
      if (sliceStats.error > 0) sliceLabel += ` · fejl: ${sliceStats.error}`;
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
      || (sliceStats.pending > 0 && sliceStats.progress <= 0);
    els.thumbTopStatusBar.classList.toggle("indeterminate", useIndeterminate);
    if (!useIndeterminate) {
      const progressValues = [];
      if (stats.total > 0 && (stats.pending > 0 || stats.error > 0)) progressValues.push(stats.progress);
      if (zipStats.total > 0 && (zipStats.pending > 0 || zipStats.error > 0)) progressValues.push(zipStats.progress);
      if (sliceStats.total > 0 && (sliceStats.pending > 0 || sliceStats.error > 0)) {
        progressValues.push(sliceStats.progress);
      }
      const mergedProgress = progressValues.length
        ? Math.round(progressValues.reduce((sum, value) => sum + Number(value || 0), 0) / progressValues.length)
        : 0;
      els.thumbTopStatusBar.style.width = `${Math.max(0, Math.min(100, Number(mergedProgress || 0)))}%`;
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
  }

  function makeClientUploadId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function uploadSingleTus(file, folder, clientUploadId, onProgress) {
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

  function persistMetadataStepInputs() {
    const item = getMetadataCurrentItem();
    if (!item) return;
    if (els.metadataNoteInput) {
      item.note = String(els.metadataNoteInput.value || "");
    }
    if (els.metadataQtyInput) {
      item.quantity = Math.max(1, Number(els.metadataQtyInput.value || 1) || 1);
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
    if (!current || Number(current.id || 0) !== id) return;
    current.attachments = Array.isArray(data.items) ? data.items : [];
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

    const total = state.pendingMetadata.length;
    const current = Number(state.metadataIndex || 0) + 1;
    if (els.metadataStepCounter) {
      els.metadataStepCounter.textContent = `${current}/${total}`;
    }
    if (els.metadataCurrentFileName) {
      els.metadataCurrentFileName.textContent = String(item.filename || `Fil ${current}`);
    }
    if (els.metadataNoteInput) {
      els.metadataNoteInput.value = String(item.note || "");
    }
    if (els.metadataQtyInput) {
      els.metadataQtyInput.value = String(Math.max(1, Number(item.quantity || 1) || 1));
    }

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
    loadMetadataAttachments(Number(item.id || 0)).catch((err) => {
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

  function openMetadataModal(files) {
    const list = Array.isArray(files) ? files : [];
    state.pendingMetadata = list
      .map((file) => {
        const id = Number(file && file.id ? file.id : 0);
        if (!id) return null;
        return {
          ...file,
          id,
          note: String((file && file.note) || ""),
          quantity: Math.max(1, Number((file && file.quantity) || 1) || 1),
          attachments: [],
        };
      })
      .filter(Boolean);
    state.metadataIndex = 0;

    if (!state.pendingMetadata.length || !els.metadataModal) return;
    if (els.metadataAttachInput) els.metadataAttachInput.value = "";
    showStatus(els.metadataAttachStatus, "");
    els.metadataModal.classList.remove("hidden");
    renderMetadataStep();
  }

  function closeMetadataModal() {
    state.pendingMetadata = [];
    state.metadataIndex = 0;
    if (els.metadataAttachInput) els.metadataAttachInput.value = "";
    showStatus(els.metadataAttachStatus, "");
    renderMetadataAttachments([]);
    if (els.metadataModal) els.metadataModal.classList.add("hidden");
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
    const items = state.pendingMetadata.map((file) => {
      return {
        file_id: Number(file.id),
        note: String(file.note || ""),
        quantity: Math.max(1, Number(file.quantity || 1) || 1),
      };
    });
    await api("/api/files/metadata-batch", { method: "POST", body: { items } });
    closeMetadataModal();
    await loadFiles();
    showStatus(els.uploadStatus, "Metadata gemt for de uploadede filer.", "ok");
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

    const droppedItems = await collectDroppedFilesWithPaths(dataTransfer);
    if (!droppedItems.length) return;

    const groups = groupDroppedFilesByRelativeDir(droppedItems);
    const uploadItems = [];
    for (const [relDir, files] of groups.entries()) {
      const cleanDir = String(relDir || "").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
      const targetFolder = cleanDir ? `${base}/${cleanDir}` : base;
      for (const file of files) {
        uploadItems.push({ file, folder: targetFolder });
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

    const list = incoming
      .map((entry) => {
        if (!entry) return null;
        if (entry instanceof File) {
          return {
            file: entry,
            folder: fallbackFolder,
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
        return {
          file,
          folder: targetFolder,
        };
      })
      .filter(Boolean);

    if (!list.length) return;

    resetUploadUiState();
    uploadUiState.totalFiles = list.length;
    uploadUiState.totalBytes = list.reduce((sum, item) => sum + Number(item.file && item.file.size ? item.file.size : 0), 0);
    uploadUiState.collapsed = false;
    uploadStopRequested = false;
    uploadWasStopped = false;
    uploadTransferActive = true;
    showUploadMonitor();
    renderUploadMonitor();

    showStatus(els.uploadStatus, `Starter upload af ${list.length} filer...`, "ok");
    const uploaded = [];
    try {
      for (let i = 0; i < list.length; i += 1) {
        if (uploadStopRequested) break;

        const item = list[i];
        const file = item.file;
        const targetFolder = String(item.folder || fallbackFolder || "").trim();
        const cid = makeClientUploadId();
        const itemKey = _uploadItemKey(file.name, i);
        uploadUiState.currentPhaseLabel = "Uploader";
        uploadUiState.currentFileName = file.name || "fil";
        uploadUiState.currentLoaded = 0;
        uploadUiState.currentTotal = Number(file.size || 0);
        addUploadMonitorItem(file.name, null, "Uploader... 0%", itemKey, 0);
        renderUploadMonitor();

        try {
          await uploadSingleTus(file, targetFolder, cid, (uploadedBytes, totalBytes) => {
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
      showStatus(els.uploadStatus, `${doneLabel}: ${uploaded.length}/${list.length} filer${failedPart}.`, uploadUiState.failedFiles ? "error" : "ok");
      const resolved = await resolveUploadedItems(uploaded);
      const firstFolder = resolved.length ? String(resolved[0].folder_path || "").trim() : "";
      await loadFolders();
      if (firstFolder && els.folderSelect) {
        els.folderSelect.value = firstFolder;
        state.currentFolder = firstFolder;
      }
      await loadFiles();
      if (resolved.length) openMetadataModal(resolved);
    } else {
      showStatus(els.uploadStatus, uploadWasStopped ? "Upload stoppet." : "Ingen filer blev uploadet.", uploadWasStopped ? "ok" : "error");
      await loadFiles();
    }
  }

  async function createFolder(nameOverride = "") {
    const name = String(nameOverride || (els.newFolderInput && els.newFolderInput.value) || "").trim();
    if (!name) {
      showStatus(els.uploadStatus, "Skriv et mappenavn først.", "error");
      return;
    }
    const parent = currentFolder();
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

  async function loadShares() {
    if (!els.sharesTableBody) return;
    try {
      const data = await api("/api/shares");
      state.shares = Array.isArray(data.items) ? data.items : [];
    } catch (err) {
      state.shares = [];
      showStatus(els.shareCreateStatus, err.message || "Kunne ikke hente delinger", "error");
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
    await loadShares();
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
        showStatus(els.shareCreateStatus, "Link kopieret.", "ok");
      } catch {
        showStatus(els.shareCreateStatus, "Kunne ikke kopiere link automatisk.", "error");
      }
      return;
    }

    if (action === "revoke") {
      await api(`/api/shares/${id}/revoke`, { method: "POST" });
      showStatus(els.shareCreateStatus, "Deling deaktiveret.", "ok");
      await loadShares();
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Vil du slette delingen permanent?")) return;
      await api(`/api/shares/${id}`, { method: "DELETE" });
      showStatus(els.shareCreateStatus, "Deling slettet.", "ok");
      await loadShares();
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

  async function loadUsers() {
    if (state.role !== "admin" || !els.usersTableBody) return;
    const data = await api("/api/admin/users");
    state.users = Array.isArray(data.items) ? data.items : [];
    renderUsers();
  }

  function renderUsers() {
    if (!els.usersTableBody) return;
    if (!state.users.length) {
      els.usersTableBody.innerHTML = `<tr><td colspan="5" class="hint">Ingen brugere.</td></tr>`;
      return;
    }
    els.usersTableBody.innerHTML = state.users
      .map((u) => {
        const id = Number(u.id || 0);
        const canDelete = u.username !== state.username;
        return `
          <tr>
            <td>${id}</td>
            <td>${esc(u.username)}</td>
            <td>${esc(u.role)}</td>
            <td>${esc(u.home_folder || "-")}</td>
            <td>
              ${canDelete ? `<button class="btn danger" data-user-action="delete" data-user-id="${id}">Slet</button>` : ""}
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function createUser() {
    const username = String((els.createUserUsername && els.createUserUsername.value) || "").trim();
    const password = String((els.createUserPassword && els.createUserPassword.value) || "");
    const role = String((els.createUserRole && els.createUserRole.value) || "user");
    if (!username || !password) {
      showStatus(els.userStatus, "Udfyld brugernavn og kode.", "error");
      return;
    }
    await api("/api/admin/users", { method: "POST", body: { username, password, role } });
    if (els.createUserUsername) els.createUserUsername.value = "";
    if (els.createUserPassword) els.createUserPassword.value = "";
    showStatus(els.userStatus, "Bruger oprettet.", "ok");
    await loadUsers();
    await loadFolders();
  }

  async function onUsersTableClick(event) {
    const btn = event.target.closest("[data-user-action='delete']");
    if (!btn) return;
    const id = Number(btn.dataset.userId || 0);
    if (!id) return;
    if (!window.confirm("Vil du slette brugeren?")) return;
    await api(`/api/admin/users/${id}`, { method: "DELETE" });
    showStatus(els.userStatus, "Bruger slettet.", "ok");
    await loadUsers();
    await loadFolders();
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

  function renderAdminLogs() {
    if (!els.logsTableBody) return;
    const list = Array.isArray(state.adminLogs) ? state.adminLogs : [];
    if (!list.length) {
      els.logsTableBody.innerHTML = `<tr><td colspan="5" class="hint">Ingen fejl fundet.</td></tr>`;
      return;
    }

    els.logsTableBody.innerHTML = list
      .map((entry) => {
        const timeText = formatDate(entry.timestamp || "");
        const kind = String(entry.kind_label || entry.kind || "Log");
        const target = String(entry.target || "-");
        const folder = String(entry.folder_path || "-");
        const message = String(entry.message || "-");
        return `
          <tr>
            <td>${esc(timeText)}</td>
            <td class="log-entry-type">${esc(kind)}</td>
            <td class="log-entry-target">${esc(target)}</td>
            <td class="log-entry-folder">${esc(folder)}</td>
            <td class="log-entry-message">${esc(message)}</td>
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
        fly: "https://esm.sh/three@0.166.1/examples/jsm/controls/FlyControls.js",
        stl: "https://esm.sh/three@0.166.1/examples/jsm/loaders/STLLoader.js",
        obj: "https://esm.sh/three@0.166.1/examples/jsm/loaders/OBJLoader.js",
      },
      {
        three: "https://cdn.jsdelivr.net/npm/three@0.166.1/+esm",
        orbit: "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/OrbitControls.js/+esm",
        fly: "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/FlyControls.js/+esm",
        stl: "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/STLLoader.js/+esm",
        obj: "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/OBJLoader.js/+esm",
      },
    ];

    let lastErr = null;
    for (const src of sources) {
      try {
        const THREE = await import(src.three);
        const [{ OrbitControls }, { FlyControls }, { STLLoader }, { OBJLoader }] = await Promise.all([
          import(src.orbit),
          import(src.fly),
          import(src.stl),
          import(src.obj),
        ]);
        state.threeModules = { THREE, OrbitControls, FlyControls, STLLoader, OBJLoader };
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
    state.modelModalCloseGuardUntil = 0;
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
      cleanupThree();
      if (els.modelViewerPane) els.modelViewerPane.classList.remove("hidden");
      if (els.threePane) els.threePane.classList.add("hidden");
      if (els.modelViewer) {
        const viewer = els.modelViewer;
        viewer.setAttribute("environment-image", "neutral");
        viewer.setAttribute("shadow-intensity", "1.25");
        viewer.setAttribute("shadow-softness", "0.95");
        viewer.style.background = "transparent";
        viewer.setAttribute("src", file.content_url || "");
        viewer.addEventListener("load", () => {
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
        }, { once: true });
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
    if (els.modelViewer) els.modelViewer.removeAttribute("src");

    let modules;
    try {
      modules = await ensureThreeModules();
    } catch (err) {
      updateModelInfoBar({
        controls: "Kunne ikke indlæse viewer",
        height: "-",
        scale: "-",
      });
      setModelHintMessage(`Kunne ikke indlæse 3D viewer: ${err.message || err}`);
      return;
    }
    const { THREE, OrbitControls, STLLoader, OBJLoader } = modules;

    cleanupThree();

    if (!els.threeCanvas || !els.threePane) return;
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
    state.modelModalCloseGuardUntil = 0;
    cleanupThree();
    if (els.modelViewer) els.modelViewer.removeAttribute("src");
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
          toggleFileSelection(id);
          renderFiles();
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

  async function onMapperMenuAction(action) {
    const cmd = String(action || "").trim().toLowerCase();
    if (!cmd) return;

    if (cmd === "select") {
      toggleSelectMode();
      return;
    }

    if (cmd === "upload") {
      if (state.selectMode) return;
      if (els.fileInput) els.fileInput.click();
      return;
    }

    if (cmd === "create-folder") {
      if (state.selectMode) return;
      const name = window.prompt("Nyt mappenavn:");
      if (!name) return;
      await createFolder(name);
      return;
    }

    if (cmd === "share") {
      if (!state.selectMode || !state.selectedFolderPaths.size) return;
      if (state.role !== "admin") {
        showStatus(els.uploadStatus, "Kun admin kan oprette delinger.", "error");
        return;
      }
      const selectedPaths = Array.from(state.selectedFolderPaths);
      setTab("settings");
      setSettingsTab("shares");
      await loadShares();
      if (els.shareFoldersSelect) {
        const wanted = new Set(selectedPaths);
        Array.from(els.shareFoldersSelect.options || []).forEach((opt) => {
          opt.selected = wanted.has(String(opt.value || ""));
        });
      }
      toggleSelectMode(false);
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
        if (tab === "settings" && state.role === "admin") {
          if (state.currentSettingsTab === "shares") await loadShares();
          if (state.currentSettingsTab === "dns") await loadDns();
          if (state.currentSettingsTab === "users") await loadUsers();
          if (state.currentSettingsTab === "logs") await loadAdminLogs();
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
        if (tab === "logs") await loadAdminLogs();
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
        if (tab === "logs") await loadAdminLogs();
      });
    }

    if (els.folderList) {
      els.folderList.addEventListener("click", async (event) => {
        const btn = event.target.closest("[data-folder]");
        if (!btn || !els.folderSelect) return;
        if (state.selectMode) {
          toggleFolderSelection(btn.dataset.folder || "");
          renderFolderBrowser();
          updateSelectModeUi();
          return;
        }
        els.folderSelect.value = btn.dataset.folder || "";
        state.currentFolder = els.folderSelect.value;
        await loadFiles();
      });
    }

    if (els.mapperSelectExitBtn) {
      els.mapperSelectExitBtn.addEventListener("click", () => toggleSelectMode(false));
    }
    if (els.mapperSelectDeleteBtn) {
      els.mapperSelectDeleteBtn.addEventListener("click", () => {
        deleteSelectedInSelectMode().catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke slette valgte elementer", "error");
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
        if (state.selectMode) return;
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
      els.uploadBtn.addEventListener("click", () => els.fileInput.click());
      els.fileInput.addEventListener("change", async () => {
        const files = Array.from(els.fileInput.files || []);
        await startUpload(files);
        els.fileInput.value = "";
      });
    }

    if (els.mapperDropZone) {
      const dropZone = els.mapperDropZone;
      dropZone.addEventListener("click", () => {
        if (state.selectMode) return;
        if (els.fileInput) els.fileInput.click();
      });
      dropZone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        dropZone.classList.add("dragover");
      });
      dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
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
        showStatus(els.uploadStatus, "Gå til Mapper-fanen for at uploade via drag og drop.", "error");
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
          showStatus(els.uploadStatus, err.message || "Kunne ikke gemme fil-info", "error");
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
      els.fileInfoSliceBtn.addEventListener("click", () => {
        const id = Number((els.fileInfoSliceBtn && els.fileInfoSliceBtn.dataset.fileId) || state.currentInfoFileId || 0);
        if (!id) return;
        openSliceModal(id).catch((err) => {
          showStatus(els.uploadStatus, err.message || "Kunne ikke åbne slice-dialog", "error");
        });
      });
    }

    if (els.sliceModalCloseBtn) {
      els.sliceModalCloseBtn.addEventListener("click", closeSliceModal);
    }
    if (els.sliceModalCancelBtn) {
      els.sliceModalCancelBtn.addEventListener("click", closeSliceModal);
    }
    if (els.sliceModalStartBtn) {
      els.sliceModalStartBtn.addEventListener("click", () => {
        const id = Number(state.currentSliceFileId || state.currentInfoFileId || 0);
        if (!id) return;
        const profiles = selectedSliceProfiles();
        state.lastSliceSelection = {
          printer_profile: String(profiles.printer_profile || ""),
          print_profile: String(profiles.print_profile || ""),
          filament_profile: String(profiles.filament_profile || ""),
        };

        els.sliceModalStartBtn.disabled = true;
        showStatus(els.sliceModalStatus, "Starter slicing...", "ok");

        sliceFileById(id, profiles)
          .then(() => {
            closeSliceModal();
          })
          .catch((err) => {
            showStatus(els.sliceModalStatus, err.message || "Kunne ikke starte slicing", "error");
          })
          .finally(() => {
            if (els.sliceModalStartBtn) els.sliceModalStartBtn.disabled = false;
          });
      });
    }
    if (els.sliceModal) {
      els.sliceModal.addEventListener("click", (event) => {
        if (event.target === els.sliceModal || event.target.classList.contains("modal-backdrop")) {
          closeSliceModal();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const imageModalOpen = !!(els.imagePreviewModal && !els.imagePreviewModal.classList.contains("hidden"));
      if (imageModalOpen) {
        closeImagePreviewModal();
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
      const id = Number(current && current.id ? current.id : 0);
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
    if (els.metadataPrevBtn) {
      els.metadataPrevBtn.addEventListener("click", () => moveMetadataStep(-1));
    }
    if (els.metadataNextBtn) {
      els.metadataNextBtn.addEventListener("click", () => moveMetadataStep(1));
    }
    if (els.metadataAttachUploadBtn && els.metadataAttachInput) {
      els.metadataAttachUploadBtn.addEventListener("click", () => {
        const current = getMetadataCurrentItem();
        if (!current || !Number(current.id || 0)) return;
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
        if (!current || !Number(current.id || 0) || !els.metadataAttachInput) return;
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
          showStatus(els.uploadStatus, err.message || "Kunne ikke gemme metadata", "error");
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
          showStatus(els.shareCreateStatus, err.message || "Fejl i deling", "error");
        });
      });
    }

    if (els.dnsSaveBtn) {
      els.dnsSaveBtn.addEventListener("click", () => {
        saveDns().catch((err) => {
          showStatus(els.dnsStatus, err.message || "Kunne ikke gemme DNS", "error");
        });
      });
    }

    if (els.createUserBtn) {
      els.createUserBtn.addEventListener("click", () => {
        createUser().catch((err) => {
          showStatus(els.userStatus, err.message || "Kunne ikke oprette bruger", "error");
        });
      });
    }
    if (els.usersTableBody) {
      els.usersTableBody.addEventListener("click", (event) => {
        onUsersTableClick(event).catch((err) => {
          showStatus(els.userStatus, err.message || "Kunne ikke slette bruger", "error");
        });
      });
    }

    if (els.logsRefreshBtn) {
      els.logsRefreshBtn.addEventListener("click", () => {
        loadAdminLogs().catch((err) => {
          showStatus(els.logsStatus, err.message || "Kunne ikke hente logs", "error");
        });
      });
    }
  }

  async function init() {
    applyRoleVisibility();
    updateSelectModeUi();
    bindEvents();
    bindUploadMonitorDomEvents();
    renderUploadMonitor();
    await loadFolders();
    await loadFiles();
    if (state.role === "admin") {
      await loadShares();
      await loadDns();
      await loadUsers();
      setSettingsTab("shares");
    }
    setTab("files");
  }

  init().catch((err) => {
    showStatus(els.uploadStatus, err.message || "Init fejlede", "error");
  });
})();


