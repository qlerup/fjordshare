(function () {
  "use strict";

  const boot = document.getElementById("bootstrap");
  const state = {
    username: (boot && boot.dataset.username) || "",
    role: ((boot && boot.dataset.role) || "user").toLowerCase(),
    homeFolder: (boot && boot.dataset.homeFolder) || "",
    currentFolder: "",
    folders: [],
    files: [],
    shares: [],
    users: [],
    pendingMetadata: [],
    threeModules: null,
    three: null,
    thumbPollTimer: null,
    currentSettingsTab: "shares",
  };

  const els = {
    pageTitle: document.getElementById("pageTitle"),
    sidebarNav: document.getElementById("sidebarNav"),
    tabFiles: document.getElementById("tab-files"),
    tabSettings: document.getElementById("tab-settings"),
    settingsTabs: document.getElementById("settingsTabs"),
    settingsTabSelect: document.getElementById("settingsTabSelect"),
    settingsPanelShares: document.getElementById("settings-panel-shares"),
    settingsPanelDns: document.getElementById("settings-panel-dns"),
    settingsPanelUsers: document.getElementById("settings-panel-users"),
    adminOnly: Array.from(document.querySelectorAll(".admin-only")),
    folderSelect: document.getElementById("folderSelect"),
    refreshFilesBtn: document.getElementById("refreshFilesBtn"),
    uploadBtn: document.getElementById("uploadBtn"),
    fileInput: document.getElementById("fileInput"),
    newFolderInput: document.getElementById("newFolderInput"),
    createFolderBtn: document.getElementById("createFolderBtn"),
    uploadStatus: document.getElementById("uploadStatus"),
    folderList: document.getElementById("folderList"),
    fileGrid: document.getElementById("fileGrid"),
    metadataModal: document.getElementById("metadataModal"),
    metadataTableBody: document.getElementById("metadataTableBody"),
    metadataCancelBtn: document.getElementById("metadataCancelBtn"),
    metadataSaveBtn: document.getElementById("metadataSaveBtn"),
    modelModal: document.getElementById("modelModal"),
    modelTitle: document.getElementById("modelTitle"),
    closeModelModalBtn: document.getElementById("closeModelModalBtn"),
    modelViewerPane: document.getElementById("modelViewerPane"),
    modelViewer: document.getElementById("modelViewer"),
    threePane: document.getElementById("threePane"),
    threeCanvas: document.getElementById("threeCanvas"),
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
  };

  const TABS = {
    files: "Filer",
    settings: "Indstillinger",
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
    if (els.pageTitle) els.pageTitle.textContent = TABS[target] || "FjordShare";

    if (target === "settings" && state.role === "admin") {
      setSettingsTab(state.currentSettingsTab || "shares");
    }
  }

  function setSettingsTab(tab) {
    const target = String(tab || "shares");
    state.currentSettingsTab = target;

    const panelMap = {
      shares: els.settingsPanelShares,
      dns: els.settingsPanelDns,
      users: els.settingsPanelUsers,
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
  }

  function currentFolder() {
    return String((els.folderSelect && els.folderSelect.value) || state.currentFolder || "");
  }

  async function loadFolders() {
    const data = await api("/api/folders");
    state.folders = Array.isArray(data.items) ? data.items : [];

    const options = state.folders.map((f) => f.path);
    if (!state.currentFolder) {
      const home = state.homeFolder;
      if (home && options.includes(home)) state.currentFolder = home;
      else state.currentFolder = options[0] || "";
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

    if (els.folderList) {
      els.folderList.innerHTML = state.folders
        .map((f) => {
          const badge = f.permission ? ` (${esc(f.permission)})` : "";
          return `<button class="folder-item" data-folder="${esc(f.path)}">${esc(f.path)}${badge}</button>`;
        })
        .join("");
    }

    if (els.shareFoldersSelect) {
      const shareOptions = state.folders
        .filter((f) => !!f.can_manage)
        .map((f) => `<option value="${esc(f.path)}">${esc(f.path)}</option>`)
        .join("");
      els.shareFoldersSelect.innerHTML = shareOptions;
    }
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

  function renderFiles() {
    if (!els.fileGrid) return;
    if (!state.files.length) {
      els.fileGrid.innerHTML = `<div class="panel"><p class="hint">Ingen filer i denne mappe endnu.</p></div>`;
      return;
    }

    const html = state.files
      .map((file) => {
        const id = Number(file.id || 0);
        return `
          <article class="file-card">
            <div class="file-preview">${filePreviewHtml(file)}</div>
            <div class="file-body">
              <div class="file-name">${esc(file.filename)}</div>
              <div class="file-meta">${formatSize(file.file_size)}  -  ${esc(file.ext || "-")}  -  ${formatDate(file.uploaded_at)}</div>
              <div class="file-inputs">
                <input class="input note-input" data-file-id="${id}" type="text" placeholder="Bemærkning" value="${esc(file.note || "")}">
                <input class="input qty-input" data-file-id="${id}" type="number" min="1" value="${Number(file.quantity || 1)}">
              </div>
              <div class="file-actions">
                <button class="btn" data-action="save-meta" data-file-id="${id}">Gem info</button>
                <a class="btn" href="${esc(file.download_url)}" target="_blank" rel="noopener">Download</a>
                ${file.is_3d_openable ? `<button class="btn" data-action="open-3d" data-file-id="${id}">Åbn 3D</button>` : ""}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
    els.fileGrid.innerHTML = html;
    syncThumbPoller();
  }

  function hasPendingThumbs() {
    return state.files.some((f) => {
      if (!f || !f.is_3d) return false;
      if (f.thumb_url) return false;
      const status = String(f.thumb_status || "").toLowerCase();
      return status === "queued" || status === "processing" || status === "" || status === "none";
    });
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
    const folder = currentFolder();
    state.currentFolder = folder;
    const data = await api(`/api/files?folder=${encodeURIComponent(folder)}`);
    state.files = Array.isArray(data.items) ? data.items : [];
    renderFiles();
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
        onError: (error) => reject(error),
        onProgress: (uploadedBytes, totalBytes) => {
          if (typeof onProgress === "function") onProgress(uploadedBytes, totalBytes);
        },
        onSuccess: () => resolve({ file, clientUploadId }),
      });
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

  function openMetadataModal(files) {
    state.pendingMetadata = Array.isArray(files) ? files : [];
    if (!state.pendingMetadata.length || !els.metadataModal || !els.metadataTableBody) return;
    els.metadataTableBody.innerHTML = state.pendingMetadata
      .map((file, idx) => {
        return `
          <tr>
            <td>${esc(file.filename)}</td>
            <td><input class="input metadata-note" data-index="${idx}" type="text" value="${esc(file.note || "")}"></td>
            <td><input class="input metadata-qty" data-index="${idx}" type="number" min="1" value="${Number(file.quantity || 1)}"></td>
          </tr>
        `;
      })
      .join("");
    els.metadataModal.classList.remove("hidden");
  }

  function closeMetadataModal() {
    state.pendingMetadata = [];
    if (els.metadataModal) els.metadataModal.classList.add("hidden");
  }

  async function saveBatchMetadata() {
    if (!state.pendingMetadata.length) {
      closeMetadataModal();
      return;
    }
    const notes = Array.from(document.querySelectorAll(".metadata-note"));
    const qtys = Array.from(document.querySelectorAll(".metadata-qty"));
    const items = state.pendingMetadata.map((file, idx) => {
      const noteInput = notes.find((n) => Number(n.dataset.index) === idx);
      const qtyInput = qtys.find((q) => Number(q.dataset.index) === idx);
      return {
        file_id: Number(file.id),
        note: (noteInput && noteInput.value) || "",
        quantity: Math.max(1, Number((qtyInput && qtyInput.value) || 1) || 1),
      };
    });
    await api("/api/files/metadata-batch", { method: "POST", body: { items } });
    closeMetadataModal();
    await loadFiles();
    showStatus(els.uploadStatus, "Metadata gemt for de uploadede filer.", "ok");
  }

  async function startUpload(files) {
    const list = Array.from(files || []);
    if (!list.length) return;

    const folder = currentFolder();
    if (!folder) {
      showStatus(els.uploadStatus, "Vælg en mappe før upload.", "error");
      return;
    }

    showStatus(els.uploadStatus, `Starter upload af ${list.length} filer...`, "ok");
    const uploaded = [];
    for (let i = 0; i < list.length; i += 1) {
      const file = list[i];
      const cid = makeClientUploadId();
      try {
        await uploadSingleTus(file, folder, cid, (uploadedBytes, totalBytes) => {
          const pct = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
          showStatus(
            els.uploadStatus,
            `Uploader ${i + 1}/${list.length}: ${file.name} (${pct}%)`,
            "ok"
          );
        });
        uploaded.push({ clientUploadId: cid, filename: file.name });
      } catch (err) {
        showStatus(els.uploadStatus, `Upload fejlede for ${file.name}: ${err.message || err}`, "error");
      }
    }

    await loadFiles();

    if (uploaded.length) {
      showStatus(els.uploadStatus, `Upload færdig: ${uploaded.length}/${list.length} filer.`, "ok");
      const resolved = await resolveUploadedItems(uploaded);
      if (resolved.length) openMetadataModal(resolved);
    } else {
      showStatus(els.uploadStatus, "Ingen filer blev uploadet.", "error");
    }
  }

  async function createFolder() {
    const name = String((els.newFolderInput && els.newFolderInput.value) || "").trim();
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

  async function ensureThreeModules() {
    if (state.threeModules) return state.threeModules;
    const THREE = await import("https://unpkg.com/three@0.166.1/build/three.module.js");
    const { OrbitControls } = await import("https://unpkg.com/three@0.166.1/examples/jsm/controls/OrbitControls.js");
    const { STLLoader } = await import("https://unpkg.com/three@0.166.1/examples/jsm/loaders/STLLoader.js");
    const { OBJLoader } = await import("https://unpkg.com/three@0.166.1/examples/jsm/loaders/OBJLoader.js");
    state.threeModules = { THREE, OrbitControls, STLLoader, OBJLoader };
    return state.threeModules;
  }

  function cleanupThree() {
    if (!state.three) return;
    const t = state.three;
    if (t.frameId) cancelAnimationFrame(t.frameId);
    if (t.controls) t.controls.dispose();
    if (t.renderer) t.renderer.dispose();
    if (t.onResize) window.removeEventListener("resize", t.onResize);
    state.three = null;
  }

  async function open3DModal(file) {
    if (!file || !els.modelModal) return;
    if (els.modelTitle) els.modelTitle.textContent = `3D: ${file.filename || ""}`;
    if (els.modelHint) els.modelHint.textContent = "";
    els.modelModal.classList.remove("hidden");

    const ext = String(file.ext || "").toLowerCase();
    if (ext === ".glb" || ext === ".gltf") {
      cleanupThree();
      if (els.modelViewerPane) els.modelViewerPane.classList.remove("hidden");
      if (els.threePane) els.threePane.classList.add("hidden");
      if (els.modelViewer) els.modelViewer.setAttribute("src", file.content_url || "");
      if (els.modelHint) els.modelHint.textContent = "Du kan rotere og zoome direkte i modellen.";
      return;
    }

    if (!(ext === ".stl" || ext === ".obj")) {
      if (els.modelViewerPane) els.modelViewerPane.classList.add("hidden");
      if (els.threePane) els.threePane.classList.add("hidden");
      if (els.modelHint) els.modelHint.textContent = "Denne 3D filtype er ikke understøttet i preview endnu.";
      return;
    }

    if (els.modelViewerPane) els.modelViewerPane.classList.add("hidden");
    if (els.threePane) els.threePane.classList.remove("hidden");
    if (els.modelViewer) els.modelViewer.removeAttribute("src");

    const modules = await ensureThreeModules();
    const { THREE, OrbitControls, STLLoader, OBJLoader } = modules;

    cleanupThree();

    if (!els.threeCanvas || !els.threePane) return;
    const canvas = els.threeCanvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c121b);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
    camera.position.set(2, 2, 2);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 8, 6);
    scene.add(dir);

    function fit(object) {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z) || 1;
      camera.near = radius / 100;
      camera.far = radius * 100;
      camera.position.set(center.x + radius * 1.6, center.y + radius * 1.3, center.z + radius * 1.6);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
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

    try {
      const obj = await loadObjPromise;
      scene.add(obj);
      fit(obj);
    } catch (err) {
      if (els.modelHint) {
        els.modelHint.textContent = `Kunne ikke åbne 3D filen: ${err.message || err}`;
      }
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
    }
    resize();

    function animate() {
      if (!state.three) return;
      controls.update();
      renderer.render(scene, camera);
      state.three.frameId = requestAnimationFrame(animate);
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    state.three = { renderer, scene, camera, controls, frameId: 0, onResize };
    animate();

    if (els.modelHint) els.modelHint.textContent = "Roter med musen og zoom med scroll.";
  }

  function close3DModal() {
    cleanupThree();
    if (els.modelViewer) els.modelViewer.removeAttribute("src");
    if (els.modelModal) els.modelModal.classList.add("hidden");
  }

  async function onFileGridClick(event) {
    const saveBtn = event.target.closest("[data-action='save-meta']");
    if (saveBtn) {
      const id = Number(saveBtn.dataset.fileId || 0);
      const noteInput = document.querySelector(`.note-input[data-file-id='${id}']`);
      const qtyInput = document.querySelector(`.qty-input[data-file-id='${id}']`);
      const note = (noteInput && noteInput.value) || "";
      const quantity = Math.max(1, Number((qtyInput && qtyInput.value) || 1) || 1);
      await api(`/api/files/${id}/metadata`, { method: "PATCH", body: { note, quantity } });
      showStatus(els.uploadStatus, "Fil-information gemt.", "ok");
      return;
    }

    const modelBtn = event.target.closest("[data-action='open-3d']");
    if (modelBtn) {
      const id = Number(modelBtn.dataset.fileId || 0);
      const file = state.files.find((f) => Number(f.id || 0) === id);
      if (file) {
        await open3DModal(file);
      }
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
      });
    }

    if (els.folderList) {
      els.folderList.addEventListener("click", async (event) => {
        const btn = event.target.closest("[data-folder]");
        if (!btn || !els.folderSelect) return;
        els.folderSelect.value = btn.dataset.folder || "";
        state.currentFolder = els.folderSelect.value;
        await loadFiles();
      });
    }

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

    if (els.closeModelModalBtn) {
      els.closeModelModalBtn.addEventListener("click", close3DModal);
    }
    if (els.modelModal) {
      els.modelModal.addEventListener("click", (event) => {
        if (event.target === els.modelModal || event.target.classList.contains("modal-backdrop")) {
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
  }

  async function init() {
    applyRoleVisibility();
    bindEvents();
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


