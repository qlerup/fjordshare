(function () {
  "use strict";

  const boot = document.getElementById("shareBootstrap");
  const token = (boot && boot.dataset.token) || "";

  const state = {
    share: null,
    files: [],
    thumbPollTimer: null,
  };

  const els = {
    shareTitle: document.getElementById("shareTitle"),
    shareMeta: document.getElementById("shareMeta"),
    shareAuthBox: document.getElementById("shareAuthBox"),
    shareVisitorInput: document.getElementById("shareVisitorInput"),
    sharePasswordInput: document.getElementById("sharePasswordInput"),
    shareAuthBtn: document.getElementById("shareAuthBtn"),
    shareAuthStatus: document.getElementById("shareAuthStatus"),
    shareMainBox: document.getElementById("shareMainBox"),
    shareUploadBox: document.getElementById("shareUploadBox"),
    shareFolderSelect: document.getElementById("shareFolderSelect"),
    shareUploadBtn: document.getElementById("shareUploadBtn"),
    shareFileInput: document.getElementById("shareFileInput"),
    shareUploadStatus: document.getElementById("shareUploadStatus"),
    shareFileGrid: document.getElementById("shareFileGrid"),
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

  const PRIMARY_UPLOAD_ALLOWED_EXTS = new Set([".step", ".3mf", ".stl"]);
  const PRIMARY_UPLOAD_ALLOWED_LABEL = ".step, .3mf og .stl";

  function fileExt(filename) {
    const name = String(filename || "").trim().toLowerCase();
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx) : "";
  }

  function isSupportedPrimaryUpload(file) {
    return !!file && PRIMARY_UPLOAD_ALLOWED_EXTS.has(fileExt(file.name));
  }

  function unsupportedPrimaryUploadMessage(files) {
    const list = Array.from(files || []).filter(Boolean);
    const names = list.slice(0, 3).map((file) => String(file && file.name ? file.name : "Fil")).join(", ");
    const extra = list.length > 3 ? ` +${list.length - 3} flere` : "";
    const subject = list.length === 1 ? names : `${list.length} filer${names ? ` (${names}${extra})` : ""}`;
    return `${subject} understøttes ikke. Upload kun ${PRIMARY_UPLOAD_ALLOWED_LABEL} filer.`;
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
      data = { ok: false, error: text || "Ugyldigt svar" };
    }
    if (!res.ok || data.ok === false) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
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
    if (!els.shareFileGrid) return;
    if (!state.files.length) {
      els.shareFileGrid.innerHTML = `<div class="panel"><p class="hint">Ingen filer i delingen endnu.</p></div>`;
      return;
    }
    els.shareFileGrid.innerHTML = state.files
      .map((file) => {
        const id = Number(file.id || 0);
        return `
          <article class="file-card">
            <div class="file-preview">${filePreviewHtml(file)}</div>
            <div class="file-body">
              <div class="file-name">${esc(file.filename)}</div>
              <div class="file-meta">${esc(file.note || "")}  -  Antal: ${Number(file.quantity || 1)}</div>
              <div class="file-actions">
                <a class="btn" href="${esc(file.download_url)}" target="_blank" rel="noopener">Download</a>
                ${state.share && state.share.can_delete ? `<button class="btn danger" data-delete-id="${id}">Slet</button>` : ""}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
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
    const data = await api(`/api/share/${encodeURIComponent(token)}/files`);
    state.files = Array.isArray(data.items) ? data.items : [];
    renderFiles();
  }

  async function loadShareInfo() {
    try {
      const data = await api(`/api/share/${encodeURIComponent(token)}/info`);
      state.share = data.share || null;
      applyShareState();
      await loadFiles();
    } catch (err) {
      const needsAuth = err.data && err.data.requires_auth;
      if (needsAuth) {
        if (els.shareAuthBox) els.shareAuthBox.classList.remove("hidden");
        if (els.shareMainBox) els.shareMainBox.classList.add("hidden");
        showStatus(els.shareAuthStatus, err.message || "Adgang kræver login", "error");
        return;
      }
      showStatus(els.shareAuthStatus, err.message || "Kunne ikke åbne delingen", "error");
    }
  }

  function applyShareState() {
    if (!state.share) return;
    if (els.shareAuthBox) els.shareAuthBox.classList.add("hidden");
    if (els.shareMainBox) els.shareMainBox.classList.remove("hidden");
    if (els.shareTitle) els.shareTitle.textContent = state.share.share_name || "Delt mappe";
    if (els.shareMeta) {
      const folders = Array.isArray(state.share.folder_paths) ? state.share.folder_paths.join(", ") : "-";
      els.shareMeta.textContent = `Mapper: ${folders}  -  Rettighed: ${state.share.permission || "view"}`;
    }
    if (els.shareUploadBox) {
      els.shareUploadBox.classList.toggle("hidden", !state.share.can_upload);
    }
    if (els.shareFolderSelect) {
      const folders = Array.isArray(state.share.folder_paths) ? state.share.folder_paths : [];
      els.shareFolderSelect.innerHTML = folders.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join("");
    }
  }

  async function authShare() {
    const password = (els.sharePasswordInput && els.sharePasswordInput.value) || "";
    const visitorName = (els.shareVisitorInput && els.shareVisitorInput.value) || "";
    await api(`/api/share/${encodeURIComponent(token)}/auth`, {
      method: "POST",
      body: { password, visitor_name: visitorName },
    });
    showStatus(els.shareAuthStatus, "", "ok");
    await loadShareInfo();
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
        endpoint: `/api/share/${encodeURIComponent(token)}/upload/tus`,
        chunkSize: 8 * 1024 * 1024,
        retryDelays: [0, 1500, 3000, 5000],
        removeFingerprintOnSuccess: true,
        metadata: {
          filename: file.name,
          folder: folder,
          lastModified: String(file.lastModified || 0),
          clientUploadId: clientUploadId,
        },
        onError: reject,
        onProgress: (uploadedBytes, totalBytes) => {
          if (typeof onProgress === "function") onProgress(uploadedBytes, totalBytes);
        },
        onSuccess: resolve,
      });
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads && previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      }).catch(() => upload.start());
    });
  }

  async function startUpload(files) {
    const rawList = Array.from(files || []);
    if (!rawList.length) return;
    const unsupported = rawList.filter((file) => !isSupportedPrimaryUpload(file));
    const list = rawList.filter((file) => isSupportedPrimaryUpload(file));
    if (unsupported.length) {
      const message = unsupportedPrimaryUploadMessage(unsupported);
      if (!list.length) {
        showStatus(els.shareUploadStatus, message, "error");
        return;
      }
      showStatus(els.shareUploadStatus, message, "error");
    }
    const folder = (els.shareFolderSelect && els.shareFolderSelect.value) || "";
    let uploadedCount = 0;
    let failedCount = unsupported.length;
    for (let i = 0; i < list.length; i += 1) {
      const file = list[i];
      const clientUploadId = makeClientUploadId();
      try {
        await uploadSingleTus(file, folder, clientUploadId, (uploaded, total) => {
          const pct = total > 0 ? Math.round((uploaded / total) * 100) : 0;
          showStatus(els.shareUploadStatus, `Uploader ${i + 1}/${list.length}: ${file.name} (${pct}%)`, "ok");
        });
        uploadedCount += 1;
      } catch (err) {
        failedCount += 1;
        showStatus(els.shareUploadStatus, `Upload fejlede for ${file.name}: ${err.message || err}`, "error");
      }
    }
    const failedPart = failedCount ? ` · fejl: ${failedCount}` : "";
    showStatus(els.shareUploadStatus, `Upload færdig: ${uploadedCount}/${rawList.length} filer${failedPart}.`, failedCount ? "error" : "ok");
    await loadFiles();
  }

  async function deleteShareFile(fileId) {
    await api(`/api/share/${encodeURIComponent(token)}/file/${encodeURIComponent(String(fileId))}`, {
      method: "DELETE",
    });
    await loadFiles();
  }

  function bindEvents() {
    if (els.shareAuthBtn) {
      els.shareAuthBtn.addEventListener("click", () => {
        authShare().catch((err) => {
          showStatus(els.shareAuthStatus, err.message || "Kunne ikke godkende adgang", "error");
        });
      });
    }

    if (els.shareUploadBtn && els.shareFileInput) {
      els.shareUploadBtn.addEventListener("click", () => els.shareFileInput.click());
      els.shareFileInput.addEventListener("change", async () => {
        const files = Array.from(els.shareFileInput.files || []);
        await startUpload(files);
        els.shareFileInput.value = "";
      });
    }

    if (els.shareFileGrid) {
      els.shareFileGrid.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-delete-id]");
        if (!btn) return;
        const id = Number(btn.dataset.deleteId || 0);
        if (!id) return;
        if (!window.confirm("Vil du slette filen?")) return;
        deleteShareFile(id).catch((err) => {
          showStatus(els.shareUploadStatus, err.message || "Kunne ikke slette filen", "error");
        });
      });
    }
  }

  bindEvents();
  loadShareInfo();
})();



