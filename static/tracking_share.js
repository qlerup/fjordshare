(function () {
  "use strict";

  const boot = document.getElementById("trackingShareBootstrap");
  const token = String((boot && boot.dataset.token) || "").trim();
  const LANGUAGE_STORAGE_KEY = "fjordshare.trackingShare.lang.v1";
  const SUPPORTED_LANGS = ["da", "en", "fr"];
  const LANG_LOCALES = {
    da: "da-DK",
    en: "en-GB",
    fr: "fr-FR",
  };
  const UI_TEXT = {
    da: {
      title: "Tracking",
      meta: "Direkte tracking for en forsendelse",
      shipment: "Forsendelse",
      refreshBtn: "Opdater",
      languageLabel: "Sprog",
      statusLabel: "Status",
      latestEventLabel: "Seneste haendelse",
      updatedAtLabel: "Sidst opdateret",
      allEventsLabel: "Alle haendelser",
      noEventsStored: "Ingen haendelser gemt endnu.",
      eventFallback: "Haendelse",
      missingToken: "Tracking-link mangler token.",
      loadingLatest: "Henter seneste tracking...",
      refreshing: "Opdaterer tracking...",
      updated: "Tracking opdateret.",
      updatedWithError: "Opdateret med fejl: {error}",
      autoRefreshFailed: "Kunne ikke opdatere automatisk.",
      openFailed: "Tracking-linket kunne ikke aabnes.",
      refreshFailed: "Kunne ikke opdatere tracking.",
    },
    en: {
      title: "Tracking",
      meta: "Direct tracking for a shipment",
      shipment: "Shipment",
      refreshBtn: "Refresh",
      languageLabel: "Language",
      statusLabel: "Status",
      latestEventLabel: "Latest event",
      updatedAtLabel: "Last updated",
      allEventsLabel: "All events",
      noEventsStored: "No events stored yet.",
      eventFallback: "Event",
      missingToken: "Tracking link is missing a token.",
      loadingLatest: "Loading latest tracking...",
      refreshing: "Refreshing tracking...",
      updated: "Tracking updated.",
      updatedWithError: "Updated with error: {error}",
      autoRefreshFailed: "Could not refresh automatically.",
      openFailed: "Could not open tracking link.",
      refreshFailed: "Could not refresh tracking.",
    },
    fr: {
      title: "Suivi",
      meta: "Suivi direct d'un envoi",
      shipment: "Envoi",
      refreshBtn: "Actualiser",
      languageLabel: "Langue",
      statusLabel: "Statut",
      latestEventLabel: "Dernier evenement",
      updatedAtLabel: "Derniere mise a jour",
      allEventsLabel: "Tous les evenements",
      noEventsStored: "Aucun evenement enregistre.",
      eventFallback: "Evenement",
      missingToken: "Le lien de suivi n'a pas de jeton.",
      loadingLatest: "Chargement du suivi...",
      refreshing: "Actualisation du suivi...",
      updated: "Suivi actualise.",
      updatedWithError: "Actualise avec erreur: {error}",
      autoRefreshFailed: "Impossible d'actualiser automatiquement.",
      openFailed: "Impossible d'ouvrir le lien de suivi.",
      refreshFailed: "Impossible d'actualiser le suivi.",
    },
  };

  const translationCache = {
    da: Object.create(null),
    en: Object.create(null),
    fr: Object.create(null),
  };

  const state = {
    lang: detectInitialLanguage(),
    item: null,
    renderToken: 0,
    translationMap: Object.create(null),
  };

  const els = {
    title: document.getElementById("trackingShareTitle"),
    meta: document.getElementById("trackingShareMeta"),
    number: document.getElementById("trackingShareNumber"),
    latest: document.getElementById("trackingShareLatest"),
    refreshBtn: document.getElementById("trackingShareRefreshBtn"),
    status: document.getElementById("trackingShareStatus"),
    content: document.getElementById("trackingShareContent"),
    langLabel: document.getElementById("trackingShareLangLabel"),
    langSelect: document.getElementById("trackingShareLangSelect"),
  };

  const MONTH_ALIASES = {
    januar: 0,
    jan: 0,
    january: 0,
    fevrier: 1,
    fevr: 1,
    février: 1,
    februar: 1,
    feb: 1,
    february: 1,
    mars: 2,
    marts: 2,
    mar: 2,
    march: 2,
    avril: 3,
    april: 3,
    apr: 3,
    mai: 4,
    maj: 4,
    may: 4,
    juin: 5,
    juni: 5,
    jun: 5,
    june: 5,
    juillet: 6,
    juli: 6,
    jul: 6,
    july: 6,
    aout: 7,
    aoutt: 7,
    aoat: 7,
    août: 7,
    august: 7,
    aug: 7,
    septembre: 8,
    september: 8,
    sep: 8,
    sept: 8,
    octobre: 9,
    oktober: 9,
    oct: 9,
    october: 9,
    novembre: 10,
    november: 10,
    nov: 10,
    decembre: 11,
    décembre: 11,
    december: 11,
    dec: 11,
  };

  function normalizeLanguage(value) {
    const lang = String(value || "").trim().toLowerCase();
    if (SUPPORTED_LANGS.includes(lang)) return lang;
    return "da";
  }

  function detectInitialLanguage() {
    try {
      const storedRaw = String(window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "").trim().toLowerCase();
      if (SUPPORTED_LANGS.includes(storedRaw)) return storedRaw;
    } catch (_err) {
      // Ignore storage read errors.
    }
    const browserLang = String((navigator && navigator.language) || "").trim().toLowerCase();
    if (browserLang.startsWith("fr")) return "fr";
    if (browserLang.startsWith("en")) return "en";
    return "da";
  }

  function persistLanguage(lang) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(lang));
    } catch (_err) {
      // Ignore storage write errors.
    }
  }

  const htmlEscapeEl = document.createElement("span");

  function esc(value) {
    htmlEscapeEl.textContent = String(value == null ? "" : value);
    return htmlEscapeEl.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function textFor(key, vars) {
    const lang = normalizeLanguage(state.lang);
    const active = UI_TEXT[lang] || UI_TEXT.da;
    const fallback = UI_TEXT.da;
    let template = String(active[key] || fallback[key] || key);
    if (vars && typeof vars === "object") {
      template = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, varName) => {
        if (!Object.prototype.hasOwnProperty.call(vars, varName)) return full;
        return String(vars[varName] == null ? "" : vars[varName]);
      });
    }
    return template;
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
    const monthMatch = text.toLowerCase().match(
      /^(\d{1,2})\.?\s+([a-z\u00e6\u00f8\u00e5\u00e9\u00fb\u00f4\u00e0\u00e7]+)\s+(\d{4})(?:\s*(?:kl\.?|at)?\s*(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?/i,
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
    const locale = LANG_LOCALES[normalizeLanguage(state.lang)] || "da-DK";
    if (!dateHasTime(text)) {
      return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
    }
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
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

  function shouldTranslateText(value) {
    const text = String(value || "").trim();
    if (!text || text === "-") return false;
    if (/^[0-9\s:.,/\\\-+()]+$/.test(text)) return false;
    return text.length > 1;
  }

  function getLangCache(lang) {
    const normalized = normalizeLanguage(lang);
    if (!translationCache[normalized]) {
      translationCache[normalized] = Object.create(null);
    }
    return translationCache[normalized];
  }

  function translateText(value, map) {
    const source = String(value || "").trim();
    if (!source) return "";
    if (!shouldTranslateText(source)) return source;
    if (map && Object.prototype.hasOwnProperty.call(map, source)) {
      return String(map[source] || source);
    }
    const langCache = getLangCache(state.lang);
    return String(langCache[source] || source);
  }

  async function requestTranslations(uniqueTexts, targetLang) {
    const lang = normalizeLanguage(targetLang);
    if (lang === "da" || !Array.isArray(uniqueTexts) || !uniqueTexts.length || !token) {
      return Object.create(null);
    }

    const data = await api(`/api/tracking-share/${encodeURIComponent(token)}/translate`, {
      method: "POST",
      body: {
        target_lang: lang,
        texts: uniqueTexts,
      },
    });

    const out = Object.create(null);
    const items = Array.isArray(data && data.items) ? data.items : [];
    items.forEach((item) => {
      const source = String((item && item.source) || "").trim();
      if (!source) return;
      const translated = String((item && item.translated) || source).trim() || source;
      out[source] = translated;
    });
    return out;
  }

  async function buildTranslationMap(item) {
    const lang = normalizeLanguage(state.lang);
    const out = Object.create(null);
    if (lang === "da") return out;

    const candidateTexts = [];
    const seen = new Set();
    const langCache = getLangCache(lang);

    function pushText(value) {
      const text = String(value || "").trim();
      if (!shouldTranslateText(text)) return;
      if (seen.has(text)) return;
      seen.add(text);
      candidateTexts.push(text);
      if (Object.prototype.hasOwnProperty.call(langCache, text)) {
        out[text] = String(langCache[text] || text);
      }
    }

    const status = String((item && item.status) || ((item && item.error) ? "Fejl" : "-")).trim();
    const latestText = String((item && (item.last_event_text || item.summary)) || "-").trim();
    const latestLocation = String((item && item.last_event_location) || "").trim();
    const error = String((item && item.error) || "").trim();
    const events = trackingEventsForItem(item);

    pushText(status);
    pushText(latestText);
    pushText(latestLocation);
    pushText(error);

    events.forEach((event) => {
      pushText((event && event.description) || (event && event.status) || textFor("eventFallback"));
      pushText((event && event.location) || "");
    });

    const missing = candidateTexts.filter((text) => !Object.prototype.hasOwnProperty.call(langCache, text));
    if (missing.length) {
      try {
        const translatedMap = await requestTranslations(missing, lang);
        Object.keys(translatedMap).forEach((source) => {
          const translated = String(translatedMap[source] || source).trim() || source;
          langCache[source] = translated;
          out[source] = translated;
        });
      } catch (_err) {
        // Translation is best effort only.
      }
    }

    candidateTexts.forEach((text) => {
      if (!Object.prototype.hasOwnProperty.call(out, text)) {
        out[text] = String(langCache[text] || text);
      }
    });

    return out;
  }

  function renderTrackingEvents(events, translationMap) {
    if (!events.length) {
      return `<div class="hint">${esc(textFor("noEventsStored"))}</div>`;
    }
    return `
      <ol class="tracking-timeline">
        ${events.map((event) => {
          const descriptionRaw = String((event && event.description) || (event && event.status) || textFor("eventFallback")).trim();
          const description = translateText(descriptionRaw, translationMap);
          const dateText = trackingEventDate(event);
          const locationRaw = String((event && event.location) || "").trim();
          const location = translateText(locationRaw, translationMap);
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

  function applyStaticLanguageTexts() {
    if (els.langLabel) els.langLabel.textContent = textFor("languageLabel");
    if (els.refreshBtn) els.refreshBtn.textContent = textFor("refreshBtn");
    if (els.title && !state.item) els.title.textContent = textFor("title");
    if (els.meta && !state.item) els.meta.textContent = textFor("meta");
    if (els.number && !state.item) els.number.textContent = textFor("shipment");
    if (els.langSelect) {
      const normalized = normalizeLanguage(state.lang);
      if (els.langSelect.value !== normalized) {
        els.langSelect.value = normalized;
      }
    }
  }

  async function renderTracking(item) {
    state.item = item || {};
    const runToken = ++state.renderToken;
    const translationMap = await buildTranslationMap(state.item);
    if (runToken !== state.renderToken) return;

    state.translationMap = translationMap;

    const trackingNumber = String((state.item && state.item.tracking_number) || "");
    const statusRaw = String((state.item && state.item.status) || ((state.item && state.item.error) ? "Fejl" : "-"));
    const status = translateText(statusRaw, translationMap);
    const statusClass = trackingStatusClass(state.item);
    const events = trackingEventsForItem(state.item);
    const latestTextRaw = String((state.item && (state.item.last_event_text || state.item.summary)) || "-");
    const latestText = translateText(latestTextRaw, translationMap);
    const latestLocationRaw = String((state.item && state.item.last_event_location) || "");
    const latestLocation = translateText(latestLocationRaw, translationMap);
    const updated = formatTrackingDate((state.item && (state.item.last_checked_at || state.item.updated_at)) || "");
    const errorRaw = String((state.item && state.item.error) || "");
    const error = translateText(errorRaw, translationMap);

    if (els.title) els.title.textContent = textFor("title");
    if (els.meta) els.meta.textContent = textFor("meta");
    if (els.number) els.number.textContent = trackingNumber || textFor("shipment");
    if (els.latest) els.latest.textContent = latestText || "";
    if (els.langLabel) els.langLabel.textContent = textFor("languageLabel");
    if (els.refreshBtn) els.refreshBtn.textContent = textFor("refreshBtn");
    if (els.langSelect) {
      const normalized = normalizeLanguage(state.lang);
      if (els.langSelect.value !== normalized) {
        els.langSelect.value = normalized;
      }
    }

    if (!els.content) return;

    els.content.innerHTML = `
      <div class="tracking-share-summary-grid">
        <div>
          <div class="tracking-share-label">${esc(textFor("statusLabel"))}</div>
          <span class="tracking-status ${statusClass}">${esc(status)}</span>
        </div>
        <div>
          <div class="tracking-share-label">${esc(textFor("latestEventLabel"))}</div>
          <div class="tracking-event">${esc(latestText)}</div>
          ${latestLocation ? `<div class="hint">${esc(latestLocation)}</div>` : ""}
        </div>
        <div>
          <div class="tracking-share-label">${esc(textFor("updatedAtLabel"))}</div>
          <div>${esc(updated)}</div>
        </div>
      </div>
      ${error ? `<div class="tracking-error">${esc(error)}</div>` : ""}
      <div class="tracking-events-wrap tracking-share-events">
        <div class="tracking-events-head">${esc(textFor("allEventsLabel"))}</div>
        ${renderTrackingEvents(events, translationMap)}
      </div>
    `;
  }

  async function loadTracking() {
    const data = await api(`/api/tracking-share/${encodeURIComponent(token)}`);
    await renderTracking(data.item || {});
  }

  async function refreshTracking(isInitial = false) {
    if (!token) {
      showStatus(els.status, textFor("missingToken"), "error");
      return;
    }
    if (els.refreshBtn) els.refreshBtn.disabled = true;
    showStatus(els.status, isInitial ? textFor("loadingLatest") : textFor("refreshing"), "ok");
    try {
      const data = await api(`/api/tracking-share/${encodeURIComponent(token)}/refresh`, { method: "POST" });
      const item = data.item || {};
      await renderTracking(item);
      if (item.error) {
        const translatedError = translateText(String(item.error || ""), state.translationMap);
        showStatus(
          els.status,
          textFor("updatedWithError", { error: translatedError || String(item.error || "") }),
          "error",
        );
      } else {
        showStatus(els.status, textFor("updated"), "ok");
      }
    } catch (err) {
      if (isInitial) {
        try {
          await loadTracking();
          const fallbackMessage = String((err && err.message) || "").trim() || textFor("autoRefreshFailed");
          showStatus(els.status, fallbackMessage, "error");
        } catch (loadErr) {
          const loadMessage = String((loadErr && loadErr.message) || "").trim();
          const errMessage = String((err && err.message) || "").trim();
          showStatus(els.status, loadMessage || errMessage || textFor("openFailed"), "error");
        }
      } else {
        const message = String((err && err.message) || "").trim() || textFor("refreshFailed");
        showStatus(els.status, message, "error");
      }
    } finally {
      if (els.refreshBtn) {
        els.refreshBtn.disabled = false;
        els.refreshBtn.textContent = textFor("refreshBtn");
      }
    }
  }

  if (els.refreshBtn) {
    els.refreshBtn.addEventListener("click", () => {
      refreshTracking(false).catch((err) => {
        const message = String((err && err.message) || "").trim() || textFor("refreshFailed");
        showStatus(els.status, message, "error");
      });
    });
  }

  if (els.langSelect) {
    els.langSelect.value = normalizeLanguage(state.lang);
    els.langSelect.addEventListener("change", () => {
      const nextLang = normalizeLanguage(els.langSelect.value);
      if (nextLang === state.lang) return;
      state.lang = nextLang;
      persistLanguage(nextLang);
      applyStaticLanguageTexts();
      if (state.item) {
        renderTracking(state.item).catch(() => {
          // Ignore translation render failures and keep existing content.
        });
      }
    });
  }

  applyStaticLanguageTexts();

  refreshTracking(true).catch((err) => {
    const message = String((err && err.message) || "").trim() || textFor("openFailed");
    showStatus(els.status, message, "error");
  });
})();
