(function () {
  "use strict";

  const boot = document.getElementById("trackingShareBootstrap");
  const token = String((boot && boot.dataset.token) || "").trim();
  const els = {
    title: document.getElementById("trackingShareTitle"),
    meta: document.getElementById("trackingShareMeta"),
    number: document.getElementById("trackingShareNumber"),
    latest: document.getElementById("trackingShareLatest"),
    refreshBtn: document.getElementById("trackingShareRefreshBtn"),
    status: document.getElementById("trackingShareStatus"),
    content: document.getElementById("trackingShareContent"),
  };

  const MONTH_NAMES = [
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
  const MONTH_ALIASES = {
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

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function api(path, options = {}) {
    const opts = Object.assign({ method: "GET" }, options);
    opts.headers = Object.assign({ Accept: "application/json" }, opts.headers || {});
    if (opts.body && typeof opts.body !== "string" && !(opts.body instanceof FormData)) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    const response = await fetch(path, opts);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : {};
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  function showStatus(el, message, type = "ok") {
    if (!el) return;
    const text = String(message || "").trim();
    el.textContent = text;
    el.classList.toggle("hidden", !text);
    el.classList.toggle("ok", !!text && type !== "error");
    el.classList.toggle("error", !!text && type === "error");
  }

  function padTime(value) {
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
    if (monthMatch && Object.prototype.hasOwnProperty.call(MONTH_ALIASES, monthMatch[2])) {
      return new Date(
        Number(monthMatch[3]),
        MONTH_ALIASES[monthMatch[2]],
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

  function dateHasTime(value) {
    return /(?:T|\bkl\.?\b|\bat\b|(?:^|[\s,])\d{1,2}[.:]\d{2}(?:[.:]\d{2})?(?:\s|$))/i.test(String(value || ""));
  }

  function formatTrackingDate(value) {
    const text = String(value || "").trim();
    if (!text) return "-";
    const d = parseTrackingDate(text);
    if (!d) return text;
    const datePart = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    if (!dateHasTime(text)) return datePart;
    return `${datePart}, ${padTime(d.getHours())}:${padTime(d.getMinutes())}`;
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
      return `<div class="hint">Ingen hændelser gemt endnu.</div>`;
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

  function renderTracking(item) {
    const trackingNumber = String((item && item.tracking_number) || "");
    const status = String((item && item.status) || ((item && item.error) ? "Fejl" : "-"));
    const statusClass = trackingStatusClass(item);
    const events = trackingEventsForItem(item);
    const latestText = String((item && (item.last_event_text || item.summary)) || "-");
    const latestLocation = String((item && item.last_event_location) || "");
    const updated = formatTrackingDate((item && (item.last_checked_at || item.updated_at)) || "");
    const error = String((item && item.error) || "");

    if (els.title) els.title.textContent = "Tracking";
    if (els.meta) els.meta.textContent = "Direkte tracking for én forsendelse";
    if (els.number) els.number.textContent = trackingNumber || "Forsendelse";
    if (els.latest) els.latest.textContent = latestText || "";
    if (!els.content) return;

    els.content.innerHTML = `
      <div class="tracking-share-summary-grid">
        <div>
          <div class="tracking-share-label">Status</div>
          <span class="tracking-status ${statusClass}">${esc(status)}</span>
        </div>
        <div>
          <div class="tracking-share-label">Seneste hændelse</div>
          <div class="tracking-event">${esc(latestText)}</div>
          ${latestLocation ? `<div class="hint">${esc(latestLocation)}</div>` : ""}
        </div>
        <div>
          <div class="tracking-share-label">Sidst opdateret</div>
          <div>${esc(updated)}</div>
        </div>
      </div>
      ${error ? `<div class="tracking-error">${esc(error)}</div>` : ""}
      <div class="tracking-events-wrap tracking-share-events">
        <div class="tracking-events-head">Alle hændelser</div>
        ${renderTrackingEvents(events)}
      </div>
    `;
  }

  async function loadTracking() {
    const data = await api(`/api/tracking-share/${encodeURIComponent(token)}`);
    renderTracking(data.item || {});
  }

  async function refreshTracking(isInitial = false) {
    if (!token) {
      showStatus(els.status, "Tracking-link mangler token.", "error");
      return;
    }
    if (els.refreshBtn) els.refreshBtn.disabled = true;
    showStatus(els.status, isInitial ? "Henter seneste tracking..." : "Opdaterer tracking...", "ok");
    try {
      const data = await api(`/api/tracking-share/${encodeURIComponent(token)}/refresh`, { method: "POST" });
      const item = data.item || {};
      renderTracking(item);
      showStatus(
        els.status,
        item.error ? `Opdateret med fejl: ${item.error}` : "Tracking opdateret.",
        item.error ? "error" : "ok",
      );
    } catch (err) {
      if (isInitial) {
        try {
          await loadTracking();
          showStatus(els.status, err.message || "Kunne ikke opdatere automatisk.", "error");
        } catch (loadErr) {
          showStatus(els.status, loadErr.message || err.message || "Tracking-linket kunne ikke åbnes.", "error");
        }
      } else {
        showStatus(els.status, err.message || "Kunne ikke opdatere tracking.", "error");
      }
    } finally {
      if (els.refreshBtn) els.refreshBtn.disabled = false;
    }
  }

  if (els.refreshBtn) {
    els.refreshBtn.addEventListener("click", () => {
      refreshTracking(false).catch((err) => {
        showStatus(els.status, err.message || "Kunne ikke opdatere tracking.", "error");
      });
    });
  }

  refreshTracking(true).catch((err) => {
    showStatus(els.status, err.message || "Tracking-linket kunne ikke åbnes.", "error");
  });
})();
