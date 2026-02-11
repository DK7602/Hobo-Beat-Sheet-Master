/* Beat Sheet Pro - app.js (FULL REPLACE) */
(() => {
  "use strict";

  /**
   ✅ STORAGE ISOLATION (IMPORTANT)
   This scopes localStorage keys to the FIRST folder in the URL path.
   Examples:
   https://dk7602.github.io/Beat-Sheet-Pro/           => scope "Beat-Sheet-Pro"
   https://dk7602.github.io/Beat-Sheet-Pro---Shared/  => scope "Beat-Sheet-Pro---Shared"
   Result: Main + Shared DO NOT share projects/recordings anymore.
  */

  const APP_VERSION = "v20260210_9_SCROLL_SECTIONS";

  const need = (id) => document.getElementById(id);
  const els = {
    exportBtn: need("exportBtn"),
    saveBtn: need("saveBtn"),
    bpm: need("bpm"),
    metroBtn: need("metroBtn"),
    highlightMode: need("highlightMode"),
    autoSplitMode: need("autoSplitMode"),
    projectSort: need("projectSort"),
    toast: need("toast"),
    statusText: need("statusText"),

    headerToggle: need("headerToggle"),
    headerToggle2: need("headerToggle2"),

    sectionTabs: need("sectionTabs"),
    bars: need("bars"),

    projectName: need("projectName"),
    projectList: need("projectList"),
    newProjectBtn: need("newProjectBtn"),

    recordBtn: need("recordBtn"),
    recordName: need("recordName"),
    recordingsList: need("recordingsList"),
    recHint: need("recHint"),

    rhymeDock: need("rhymeDock"),
    rhymeBase: need("rhymeBase"),
    rhymeList: need("rhymeList"),
    dockToggle: need("dockToggle"),
  };

  // ✅ NEW: repo-scoped storage keys
  const STORAGE_SCOPE = (() => {
    const firstFolder = (location.pathname.split("/").filter(Boolean)[0] || "root");
    return firstFolder.replace(/[^a-z0-9_-]+/gi, "_");
  })();
  const KEY_PREFIX = `beatsheetpro__${STORAGE_SCOPE}__`;

  const STORAGE_KEY = `${KEY_PREFIX}projects_v1`;
  const RHYME_CACHE_KEY = `${KEY_PREFIX}rhyme_cache_v1`;
  const DOCK_HIDDEN_KEY = `${KEY_PREFIX}rhymeDock_hidden_v1`;
  const HEADER_COLLAPSED_KEY = `${KEY_PREFIX}header_collapsed_v1`;

  // ✅ Optional: clean separation from old global keys (pre-scope)
  const OLD_STORAGE_KEY = "beatsheetpro_projects_v1";
  const OLD_RHYME_CACHE_KEY = "beatsheetpro_rhyme_cache_v1";
  const OLD_DOCK_HIDDEN_KEY = "beatsheetpro_rhymeDock_hidden_v1";
  const OLD_HEADER_COLLAPSED_KEY = "beatsheetpro_header_collapsed_v1";

  (function migrateOldKeysOnce() {
    try {
      if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(OLD_STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, localStorage.getItem(OLD_STORAGE_KEY));
      }
      if (!localStorage.getItem(RHYME_CACHE_KEY) && localStorage.getItem(OLD_RHYME_CACHE_KEY)) {
        localStorage.setItem(RHYME_CACHE_KEY, localStorage.getItem(OLD_RHYME_CACHE_KEY));
      }
      if (!localStorage.getItem(DOCK_HIDDEN_KEY) && localStorage.getItem(OLD_DOCK_HIDDEN_KEY)) {
        localStorage.setItem(DOCK_HIDDEN_KEY, localStorage.getItem(OLD_DOCK_HIDDEN_KEY));
      }
      if (!localStorage.getItem(HEADER_COLLAPSED_KEY) && localStorage.getItem(OLD_HEADER_COLLAPSED_KEY)) {
        localStorage.setItem(HEADER_COLLAPSED_KEY, localStorage.getItem(OLD_HEADER_COLLAPSED_KEY));
      }
    } catch {}
  })();

  const SECTION_DEFS = [
    { key: "verse1",  title: "Verse 1",  bars: 16, extra: 4 },
    { key: "chorus1", title: "Chorus 1", bars: 12, extra: 4 },
    { key: "verse2",  title: "Verse 2",  bars: 16, extra: 4 },
    { key: "chorus2", title: "Chorus 2", bars: 12, extra: 4 },
    { key: "verse3",  title: "Verse 3",  bars: 16, extra: 4 },
    { key: "chorus3", title: "Chorus 3", bars: 12, extra: 4 },
    { key: "bridge",  title: "Bridge",   bars:  8, extra: 4 },
  ];

  const FULL_ORDER = ["verse1", "chorus1", "verse2", "chorus2", "verse3", "bridge", "chorus3"];

  // ---------- utils ----------
  const nowISO = () => new Date().toISOString();
  const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg || "Saved";
    els.toast.classList.add("show");
    setTimeout(() => els.toast.classList.remove("show"), 1200);
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[c]));
  }

  function clampInt(v, min, max) {
    if (Number.isNaN(v)) return min;
    return Math.max(min, Math.min(max, v));
  }

  function normalizeNewlines(text) {
    return String(text || "").replace(/\r/g, "");
  }

  function trimRightEachLine(text) {
    return normalizeNewlines(text)
      .split("\n")
      .map(l => String(l).replace(/\s+$/g, ""))
      .join("\n");
  }

  // ✅ treat whitespace-only (including NBSP / zero-width) as blank
  function isBlankLine(line) {
    const s = String(line ?? "");
    const cleaned = s.replace(/[\s\u00A0\u200B\u200C\u200D\uFEFF]+/g, "");
    return cleaned.length === 0;
  }

  // ---------- active typing target (for rhyme insert) ----------
  let lastTypingTarget = null;
  function isTextTarget(el) { return !!el && el.tagName === "TEXTAREA"; }
  function setLastTypingTarget(el) { if (isTextTarget(el)) lastTypingTarget = el; }
  document.addEventListener("focusin", (e) => {
    if (isTextTarget(e.target)) setLastTypingTarget(e.target);
  });

  // ---------- headshot eye blink ----------
  let eyePulseTimer = null;

  function headerIsVisibleForEyes() {
    return !document.body.classList.contains("headerCollapsed");
  }

  function flashEyes() {
    if (!headerIsVisibleForEyes()) return;
    const eyeL = document.getElementById("eyeL");
    const eyeR = document.getElementById("eyeR");
    if (!eyeL || !eyeR) return;

    eyeL.classList.add("on");
    eyeR.classList.add("on");
    setTimeout(() => {
      eyeL.classList.remove("on");
      eyeR.classList.remove("on");
    }, 90);
  }

  function stopEyePulse() {
    if (eyePulseTimer) clearInterval(eyePulseTimer);
    eyePulseTimer = null;
  }

  function startEyePulseFromBpm() {
    stopEyePulse();
    if (!headerIsVisibleForEyes()) return;

    const p = getActiveProject();
    const bpm = clampInt(parseInt(els.bpm?.value || p?.bpm || 95, 10), 40, 240);
    const intervalMs = 60000 / bpm;
    eyePulseTimer = setInterval(() => flashEyes(), intervalMs);
  }

  // ---------- header collapse ----------
  function loadHeaderCollapsed() {
    try { return localStorage.getItem(HEADER_COLLAPSED_KEY) === "1"; } catch { return false; }
  }
  function saveHeaderCollapsed(isCollapsed) {
    try { localStorage.setItem(HEADER_COLLAPSED_KEY, isCollapsed ? "1" : "0"); } catch {}
  }
  function setHeaderCollapsed(isCollapsed) {
    document.body.classList.toggle("headerCollapsed", !!isCollapsed);
    if (els.headerToggle)  els.headerToggle.textContent  = isCollapsed ? "Show" : "Hide";
    if (els.headerToggle2) els.headerToggle2.textContent = isCollapsed ? "Show" : "Hide";
    saveHeaderCollapsed(!!isCollapsed);
    updateDockForKeyboard();

    if (isCollapsed) stopEyePulse();
    else {
      if (metroOn) {}
      else if (recording) startEyePulseFromBpm();
    }
  }
  if (els.headerToggle) {
    els.headerToggle.addEventListener("click", () => {
      const collapsed = document.body.classList.contains("headerCollapsed");
      setHeaderCollapsed(!collapsed);
    });
  }
  if (els.headerToggle2) {
    els.headerToggle2.addEventListener("click", () => {
      const collapsed = document.body.classList.contains("headerCollapsed");
      setHeaderCollapsed(!collapsed);
    });
  }

  // Keep rhyme dock visible above keyboard (Android)
  function updateDockForKeyboard() {
    const vv = window.visualViewport;
    if (!els.rhymeDock) return;
    if (!vv) {
      els.rhymeDock.style.bottom = "10px";
      return;
    }
    const keyboardPx = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop));
    els.rhymeDock.style.bottom = (10 + keyboardPx) + "px";
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateDockForKeyboard);
    window.visualViewport.addEventListener("scroll", updateDockForKeyboard);
  }
  window.addEventListener("resize", updateDockForKeyboard);

  // ---------- rhyme dock hide/show ----------
  function loadDockHidden() {
    try { return localStorage.getItem(DOCK_HIDDEN_KEY) === "1"; } catch { return false; }
  }
  function saveDockHidden(isHidden) {
    try { localStorage.setItem(DOCK_HIDDEN_KEY, isHidden ? "1" : "0"); } catch {}
  }
  function setDockHidden(isHidden) {
    if (!els.rhymeDock || !els.dockToggle) return;
    els.rhymeDock.classList.toggle("dockHidden", !!isHidden);
    els.dockToggle.textContent = isHidden ? "R" : "Hide";
    saveDockHidden(!!isHidden);
    updateDockForKeyboard();
  }
  if (els.dockToggle) {
    els.dockToggle.addEventListener("click", () => {
      const nowHidden = els.rhymeDock?.classList?.contains("dockHidden");
      setDockHidden(!nowHidden);
    });
  }

  // ---------- syllables ----------
  function normalizeWord(w) { return (w || "").toLowerCase().replace(/[^a-z']/g, ""); }

  const SYLL_DICT = {
    "im": 1, "i'm": 1, "ive": 1, "i've": 1, "ill": 1, "i'll": 1, "id": 1, "i'd": 1,
    "dont": 1, "don't": 1, "cant": 1, "can't": 1, "wont": 1, "won't": 1, "aint": 1, "ain't": 1,
    "yeah": 1, "ya": 1, "yup": 1, "nah": 1, "yall": 1, "y'all": 1, "bruh": 1, "bro": 1,
    "wanna": 2, "gonna": 2, "tryna": 2, "lemme": 2, "gotta": 2, "kinda": 2, "outta": 2,
    "toyota": 3, "hiphop": 2, "gfunk": 2, "gangsta": 2, "birthday": 2
  };

  function countSyllablesWord(word) {
    if (!word) return 0;
    let w = normalizeWord(word);
    if (!w) return 0;
    if (SYLL_DICT[w] != null) return SYLL_DICT[w];
    if (/^\d+$/.test(w)) return 1;
    if (w.length <= 3) return 1;

    w = w.replace(/'/g, "");
    if (/[^aeiou]e$/.test(w) && !/[^aeiou]le$/.test(w)) w = w.slice(0, -1);

    const groups = w.match(/[aeiouy]+/g);
    let count = groups ? groups.length : 0;

    if (/(tion|sion|cion)$/.test(w)) count -= 1;
    if (/(ious|eous)$/.test(w)) count -= 1;
    if (/[^aeiou]le$/.test(w)) count += 1;

    return Math.max(1, count || 1);
  }

  function countSyllablesLine(line) {
    const clean = (line || "").replace(/[/]/g, " ").trim();
    if (!clean) return 0;
    return clean.split(/\s+/).filter(Boolean).reduce((sum, w) => sum + countSyllablesWord(w), 0);
  }

  function syllGlowClass(n) {
    if (!n) return "";
    if (n <= 6) return "red";
    if (n <= 9) return "yellow";
    if (n <= 13) return "green";
    if (n <= 16) return "yellow";
    return "red";
  }

  // ---------- beat splitting ----------
  function splitBySlashes(text) {
    const parts = (text || "").split("/").map(s => s.trim());
    return [parts[0] || "", parts[1] || "", parts[2] || "", parts[3] || ""];
  }

  function autoSplitWords(text) {
    const clean = (text || "").replace(/[/]/g, " ").trim();
    if (!clean) return ["", "", "", ""];
    const words = clean.split(/\s+/);
    const per = Math.ceil(words.length / 4) || 1;
    const per2 = per * 2;
    const per3 = per * 3;
    return [
      words.slice(0, per).join(" "),
      words.slice(per, per2).join(" "),
      words.slice(per2, per3).join(" "),
      words.slice(per3).join(" "),
    ];
  }

  function splitWordIntoChunks(word) {
    const raw = String(word);
    const cleaned = raw.replace(/[^A-Za-z']/g, "");
    if (!cleaned) return [raw];
    const groups = cleaned.match(/[aeiouy]+|[^aeiouy]+/gi) || [cleaned];
    const out = [];
    for (const g of groups) {
      if (out.length && /^[^aeiouy]+$/i.test(g) && g.length <= 2) out[out.length - 1] += g;
      else out.push(g);
    }
    return out.length ? out : [raw];
  }

  function chunkSyllCount(chunk) {
    const w = String(chunk).toLowerCase().replace(/[^a-z']/g, "").replace(/'/g, "");
    const groups = w.match(/[aeiouy]+/g);
    return Math.max(1, (groups ? groups.length : 0) || 1);
  }

  function buildTargets(total) {
    const base = Math.floor(total / 4);
    const rem = total % 4;
    const t = [base, base, base, base];
    for (let i = 0; i < rem; i++) t[i] += 1;
    if (total < 4) {
      t.fill(0);
      for (let i = 0; i < total; i++) t[i] = 1;
    }
    return t;
  }

  function autoSplitSyllablesClean(text) {
    const clean = (text || "").replace(/[/]/g, " ").trim();
    if (!clean) return ["", "", "", ""];

    const words = clean.split(/\s+/).filter(Boolean);
    const sylls = words.map(w => countSyllablesWord(w));
    const total = sylls.reduce((a, b) => a + b, 0);
    if (!total) return ["", "", "", ""];

    const targets = buildTargets(total);
    const beats = [[], [], [], []];
    const beatSyll = [0, 0, 0, 0];
    let b = 0;

    function pushWord(beatIndex, w) { beats[beatIndex].push(w); }

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const s = sylls[i];

      while (b < 3 && beatSyll[b] >= targets[b]) b++;
      const remaining = targets[b] - beatSyll[b];
      if (remaining <= 0 && b < 3) b++;

      const rem2 = targets[b] - beatSyll[b];

      if (s <= rem2 || b === 3) {
        pushWord(b, w);
        beatSyll[b] += s;
        continue;
      }

      if (rem2 <= 1 && b < 3) {
        b++;
        pushWord(b, w);
        beatSyll[b] += s;
        continue;
      }

      const chunks = splitWordIntoChunks(w);
      const chunkS = chunks.map(chunkSyllCount);

      let take = [];
      let takeSyll = 0;

      for (let c = 0; c < chunks.length; c++) {
        if (takeSyll + chunkS[c] > rem2 && take.length > 0) break;
        take.push(chunks[c]);
        takeSyll += chunkS[c];
        if (takeSyll >= rem2) break;
      }

      if (!take.length) {
        pushWord(b, w);
        beatSyll[b] += s;
        continue;
      }

      const left = take.join("");
      const right = chunks.slice(take.length).join("");

      pushWord(b, left);
      beatSyll[b] += takeSyll;

      if (b < 3) {
        b++;
        pushWord(b, right);
        beatSyll[b] += Math.max(1, s - takeSyll);
      } else {
        pushWord(b, right);
        beatSyll[b] += Math.max(1, s - takeSyll);
      }
    }

    return beats.map(arr => arr.join(" ").trim());
  }

  function computeBeats(text, mode) {
    const hasSlash = (text || "").includes("/");
    if (hasSlash) return splitBySlashes(text);
    if (mode === "none") return ["", "", "", ""];
    if (mode === "words") return autoSplitWords(text);
    return autoSplitSyllablesClean(text);
  }

  // ---------- rhymes ----------
  const rhymeCache = (() => {
    try { return JSON.parse(localStorage.getItem(RHYME_CACHE_KEY) || "{}"); }
    catch { return {}; }
  })();

  function saveRhymeCache() {
    try { localStorage.setItem(RHYME_CACHE_KEY, JSON.stringify(rhymeCache)); } catch {}
  }

  let rhymeAbort = null;

  function lastWord(str) {
    const s = (str || "").toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").trim();
    if (!s) return "";
    const parts = s.split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1].replace(/^-+|-+$/g, "") : "";
  }

  function caretBeatIndex(text, caretPos) {
    const before = (text || "").slice(0, Math.max(0, caretPos || 0));
    const count = (before.match(/\//g) || []).length;
    return Math.max(0, Math.min(3, count));
  }

  async function updateRhymes(seed) {
    const w = (seed || "").toLowerCase().replace(/[^a-z0-9']/g, "").trim();
    if (!w) {
      els.rhymeBase.textContent = "Tap into a beat…";
      els.rhymeList.innerHTML = `<span class="small">Rhymes appear for last word in previous beat box.</span>`;
      return;
    }

    els.rhymeBase.textContent = w;

    if (Array.isArray(rhymeCache[w]) && rhymeCache[w].length) {
      renderRhymes(rhymeCache[w]);
      return;
    }

    els.rhymeList.innerHTML = `<span class="small">Loading…</span>`;

    try {
      if (rhymeAbort) rhymeAbort.abort();
      rhymeAbort = new AbortController();

      const url = `https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(w)}&max=18`;
      const res = await fetch(url, { signal: rhymeAbort.signal });
      const data = await res.json();
      const words = (data || []).map(x => x.word).filter(Boolean);

      rhymeCache[w] = words;
      saveRhymeCache();
      renderRhymes(words);

    } catch (e) {
      if (String(e).includes("AbortError")) return;
      els.rhymeList.innerHTML = `<span class="small" style="color:#b91c1c;">Rhyme lookup failed.</span>`;
    }
  }

  function renderRhymes(words) {
    if (!words || !words.length) {
      els.rhymeList.innerHTML = `<span class="small">No rhymes found.</span>`;
      return;
    }
    els.rhymeList.innerHTML = words.slice(0, 18)
      .map(w => `<button type="button" class="rhymeChip" data-rhyme="${escapeHtml(w)}">${escapeHtml(w)}</button>`)
      .join("");
  }

  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".rhymeChip");
    if (!chip) return;

    const w = (chip.getAttribute("data-rhyme") || chip.textContent || "").trim();
    if (!w) return;

    const active = (document.activeElement && isTextTarget(document.activeElement)) ? document.activeElement : null;
    const target = active || lastTypingTarget;

    if (target && isTextTarget(target)) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const before = target.value.slice(0, start);
      const after = target.value.slice(end);

      const spacer = before && !/\s$/.test(before) ? " " : "";
      target.value = before + spacer + w + after;

      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.focus();

      const pos = (before + spacer + w).length;
      target.setSelectionRange(pos, pos);

      setLastTypingTarget(target);
      return;
    }

    showToast("Tap a text box first");
  });

  // ---------- projects ----------
  function blankSections() {
    const sections = {};
    for (const s of SECTION_DEFS) {
      sections[s.key] = {
        key: s.key,
        title: s.title,
        bars: Array.from({ length: s.bars + s.extra }, () => ({ text: "" })),
        fullText: ""
      };
    }
    return sections;
  }

  function newProject(name = "") {
    return {
      id: uid(),
      name: name || "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      activeSection: "verse1", // NOTE: now used mainly for tab highlight / jump + "full" mode toggle
      bpm: 95,
      highlightMode: "focused",
      autoSplitMode: "syllables",
      recordings: [],
      sections: blankSections(),
    };
  }

  function loadStore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const p = newProject("");
      const s = { activeProjectId: p.id, projects: [p], projectSort: "recent" };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    try { return JSON.parse(raw); }
    catch {
      localStorage.removeItem(STORAGE_KEY);
      return loadStore();
    }
  }

  let store = loadStore();

  // keep fullText and bars in sync
  function ensureSectionFullText(sec) {
    if (!sec) return;
    if (typeof sec.fullText === "string" && sec.fullText.length) return;

    const lines = (sec.bars || [])
      .map(b => String(b?.text ?? "").replace(/\s+$/g, ""))
      .filter(l => !isBlankLine(l));
    sec.fullText = lines.join("\n");
  }

  function syncBarsFromFullText(sec) {
    if (!sec?.bars) return;

    ensureSectionFullText(sec);

    const nonEmpty = trimRightEachLine(sec.fullText)
      .split("\n")
      .filter(l => !isBlankLine(l));

    sec.bars.forEach(b => b.text = "");
    for (let i = 0; i < Math.min(nonEmpty.length, sec.bars.length); i++) {
      sec.bars[i].text = nonEmpty[i];
    }
  }

  function updateFullTextLineForBar(sec, barIndex, newText) {
    if (!sec) return;
    ensureSectionFullText(sec);

    const rawLines = normalizeNewlines(sec.fullText).split("\n");
    const nonEmptyIdx = [];
    for (let i = 0; i < rawLines.length; i++) {
      if (!isBlankLine(rawLines[i])) nonEmptyIdx.push(i);
    }

    if (!rawLines.length && (sec.bars?.length)) {
      const fallback = (sec.bars || [])
        .map(b => String(b?.text ?? "").replace(/\s+$/g, ""))
        .filter(l => !isBlankLine(l))
        .join("\n");
      sec.fullText = fallback;
      return updateFullTextLineForBar(sec, barIndex, newText);
    }

    const line = String(newText ?? "");

    if (barIndex < nonEmptyIdx.length) {
      rawLines[nonEmptyIdx[barIndex]] = line;
    } else {
      rawLines.push(line);
    }

    let end = rawLines.length;
    while (end > 0 && isBlankLine(rawLines[end - 1])) end--;
    sec.fullText = rawLines.slice(0, end).join("\n");
  }

  function repairProject(p) {
    if (!p.sections || typeof p.sections !== "object") p.sections = blankSections();
    for (const def of SECTION_DEFS) {
      if (!p.sections[def.key] || !Array.isArray(p.sections[def.key].bars)) {
        p.sections[def.key] = {
          key: def.key,
          title: def.title,
          bars: Array.from({ length: def.bars + def.extra }, () => ({ text: "" })),
          fullText: ""
        };
      }
      ensureSectionFullText(p.sections[def.key]);
      syncBarsFromFullText(p.sections[def.key]);
    }
    if (!p.activeSection) p.activeSection = "verse1";
    if (!Array.isArray(p.recordings)) p.recordings = [];
    if (!p.bpm) p.bpm = 95;
    if (!p.highlightMode) p.highlightMode = "focused";
    if (!p.autoSplitMode) p.autoSplitMode = "syllables";
    return p;
  }

  store.projects = (store.projects || []).map(repairProject);
  if (!store.projects.length) {
    const p = newProject("");
    store.projects = [p];
    store.activeProjectId = p.id;
  }
  if (!store.activeProjectId || !store.projects.find(p => p.id === store.activeProjectId)) {
    store.activeProjectId = store.projects[0].id;
  }

  function saveStore() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
  function getActiveProject() { return store.projects.find(p => p.id === store.activeProjectId) || store.projects[0]; }
  function touchProject(p) { p.updatedAt = nowISO(); saveStore(); }

  // ---------- metronome ----------
  let audioCtx = null;
  let metroGain = null;
  let recordDest = null;

  let metroTimer = null;
  let metroOn = false;
  let metroBeat16 = 0;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      metroGain = audioCtx.createGain();
      metroGain.gain.value = 0.9;

      recordDest = audioCtx.createMediaStreamDestination();

      metroGain.connect(audioCtx.destination);
      metroGain.connect(recordDest);
    }
  }

  function playKick() {
    ensureAudio();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(metroGain);
    o.start(t); o.stop(t + 0.14);
  }

  function playSnare() {
    ensureAudio();
    const t = audioCtx.currentTime;
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.12);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

    noise.connect(filter);
    filter.connect(g);
    g.connect(metroGain);

    noise.start(t);
    noise.stop(t + 0.12);
  }

  function playHat() {
    ensureAudio();
    const t = audioCtx.currentTime;
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.03);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 5500;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

    noise.connect(filter);
    filter.connect(g);
    g.connect(metroGain);

    noise.start(t);
    noise.stop(t + 0.04);
  }

  // focused bar is now a GLOBAL index across the whole scroll list
  let focusedBarIdx = 0;

  function flashBeats(beatInBar) {
    const p = getActiveProject();
    const highlight = p.highlightMode || "focused";
    const barEls = document.querySelectorAll(".bar");
    const targets = (highlight === "all") ? Array.from(barEls) : [barEls[focusedBarIdx] || barEls[0]];
    targets.forEach(barEl => {
      const beats = barEl?.querySelectorAll(".beat");
      if (!beats || beats.length < 4) return;
      beats.forEach(b => b.classList.remove("flash"));
      beats[beatInBar]?.classList.add("flash");
      setTimeout(() => beats.forEach(b => b.classList.remove("flash")), 90);
    });
  }

  function startMetronome() {
    ensureAudio();
    if (audioCtx.state === "suspended") audioCtx.resume();
    stopMetronome(); stopEyePulse();

    metroOn = true;
    els.metroBtn.textContent = "Stop";
    els.metroBtn.classList.add("on");
    metroBeat16 = 0;

    const tick = () => {
      const p = getActiveProject();
      const bpm = clampInt(parseInt(els.bpm.value || p.bpm, 10), 40, 240);

      const intervalMs = 60000 / bpm / 4; // 16th notes
      const step16 = metroBeat16 % 16;
      const beatInBar = Math.floor(step16 / 4);

      playHat();
      if (step16 === 0 || step16 === 8) playKick();
      if (step16 === 4 || step16 === 12) playSnare();
      if (step16 % 4 === 0) {
        flashBeats(beatInBar);
        flashEyes();
      }

      metroBeat16++;
      metroTimer = setTimeout(tick, intervalMs);
    };

    tick();
  }

  function stopMetronome() {
    if (metroTimer) clearTimeout(metroTimer);
    metroTimer = null;
    metroOn = false;
    els.metroBtn.textContent = "Metronome";
    els.metroBtn.classList.remove("on");

    if (recording) startEyePulseFromBpm();
    else stopEyePulse();
  }

  // ---------- smooth playback (WebAudio) ----------
  let currentPlayback = null;
  let currentPlaybackId = null;
  const decodedCache = new Map();

  function stopSmoothPlayback() {
    try { currentPlayback?.stop?.(); } catch {}
    currentPlayback = null;
    currentPlaybackId = null;
  }

  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  async function getDecodedBufferForRec(rec) {
    ensureAudio();
    if (decodedCache.has(rec.id)) return decodedCache.get(rec.id);

    const blob = await dataUrlToBlob(rec.dataUrl);
    const arr = await blob.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(arr);
    decodedCache.set(rec.id, buffer);
    return buffer;
  }

  async function play(rec) {
    ensureAudio();
    if (audioCtx.state === "suspended") await audioCtx.resume();

    stopSmoothPlayback();
    if (metroOn) stopMetronome();

    const buffer = await getDecodedBufferForRec(rec);

    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    src.start(0);

    currentPlayback = src;
    currentPlaybackId = rec.id;

    src.onended = () => {
      if (currentPlayback === src) {
        currentPlayback = null;
        currentPlaybackId = null;
        renderRecordings();
      }
    };
  }

  async function downloadRec(rec) {
    try {
      const blob = await dataUrlToBlob(rec.dataUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (rec.name || "take").replace(/[^\w\s.-]+/g, "").trim() || "take";
      a.download = `${safe}.${(rec.mime || "audio/webm").includes("ogg") ? "ogg" : "webm"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error(e);
      showToast("Download failed");
    }
  }

  // ---------- recording ----------
  let recorder = null;
  let recChunks = [];
  let recording = false;

  let micStream = null;
  let micSource = null;
  let micGain = null;

  async function ensureMic() {
    if (micStream) return;
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    ensureAudio();
    micSource = audioCtx.createMediaStreamSource(micStream);
    micGain = audioCtx.createGain();
    micGain.gain.value = 1.0;

    micSource.connect(micGain);
    micGain.connect(recordDest);
  }

  function pickBestMime() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg"
    ];
    for (const m of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
    return "";
  }

  function blobToDataURL(blob) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.readAsDataURL(blob);
    });
  }

  function takeNameFromInput() { return (els.recordName?.value || "").trim(); }
  function clearTakeNameInput() { if (els.recordName) els.recordName.value = ""; }

  function updateRecordButtonUI() {
    if (!els.recordBtn) return;
    if (recording) {
      els.recordBtn.textContent = "Stop";
      els.recordBtn.classList.add("recOn");
    } else {
      els.recordBtn.textContent = "Record";
      els.recordBtn.classList.remove("recOn");
    }
  }

  async function startRecording() {
    await ensureMic();
    ensureAudio();
    if (audioCtx.state === "suspended") await audioCtx.resume();

    recChunks = [];
    recording = true;
    updateRecordButtonUI();

    if (!metroOn) startEyePulseFromBpm();
    else stopEyePulse();

    stopSmoothPlayback();

    const mimeType = pickBestMime();
    const opts = {};
    if (mimeType) opts.mimeType = mimeType;
    opts.audioBitsPerSecond = 64000;

    recorder = new MediaRecorder(recordDest.stream, opts);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recChunks.push(e.data);
    };

    recorder.onstop = async () => {
      recording = false;
      updateRecordButtonUI();
      stopEyePulse();

      if (metroOn) stopMetronome();

      const blob = new Blob(recChunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      const dataUrl = await blobToDataURL(blob);

      const p = getActiveProject();
      const typed = takeNameFromInput();
      const name = typed || `Take ${new Date().toLocaleString()}`;

      const rec = {
        id: uid(),
        name,
        createdAt: nowISO(),
        mime: blob.type || "audio/webm",
        dataUrl
      };

      p.recordings.unshift(rec);
      decodedCache.delete(rec.id);

      clearTakeNameInput();

      touchProject(p);
      renderRecordings();
      showToast("Saved take");
    };

    recorder.start(1000);
  }

  function stopRecording() {
    if (recorder && recording) recorder.stop();
  }

  // rename UI
  let editingRecId = null;

  function renderRecordings() {
    const p = getActiveProject();
    if (!els.recordingsList) return;

    els.recordingsList.innerHTML = "";

    if (!p.recordings?.length) {
      els.recordingsList.innerHTML = `<div class="small">No recordings yet.</div>`;
      return;
    }

    for (const rec of p.recordings) {
      const row = document.createElement("div");
      row.className = "audioItem";

      if (editingRecId === rec.id) {
        const input = document.createElement("input");
        input.type = "text";
        input.value = rec.name || "";
        input.style.fontWeight = "1000";
        input.style.flex = "1";
        input.style.minWidth = "180px";
        input.style.padding = "10px 12px";
        input.style.borderRadius = "14px";
        input.style.border = "1px solid rgba(0,0,0,.12)";
        input.style.boxShadow = "0 6px 14px rgba(0,0,0,.05)";

        const save = document.createElement("button");
        save.textContent = "Save";
        save.addEventListener("click", () => {
          const newName = (input.value || "").trim();
          rec.name = newName || rec.name || "Take";
          touchProject(p);
          editingRecId = null;
          renderRecordings();
          showToast("Renamed");
        });

        const cancel = document.createElement("button");
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => {
          editingRecId = null;
          renderRecordings();
        });

        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); save.click(); }
          if (e.key === "Escape") { e.preventDefault(); cancel.click(); }
        });

        row.appendChild(input);
        row.appendChild(save);
        row.appendChild(cancel);
        els.recordingsList.appendChild(row);
        continue;
      }

      const label = document.createElement("div");
      label.className = "audioLabel";
      label.textContent = rec.name || "Take";

      const icons = document.createElement("div");
      icons.className = "iconRow";

      const editBtn = document.createElement("button");
      editBtn.className = "iconBtn";
      editBtn.title = "Edit name";
      editBtn.textContent = "i";
      editBtn.addEventListener("click", () => {
        editingRecId = rec.id;
        renderRecordings();
        requestAnimationFrame(() => {
          const inp = els.recordingsList.querySelector('input[type="text"]');
          inp?.focus?.();
          inp?.select?.();
        });
      });

      const playBtn = document.createElement("button");
      playBtn.className = "iconBtn play";
      playBtn.title = "Play";
      playBtn.textContent = (currentPlaybackId === rec.id) ? "…" : "▶";
      playBtn.addEventListener("click", async () => {
        try {
          await play(rec);
          renderRecordings();
        } catch (e) {
          console.error(e);
          showToast("Playback failed");
        }
      });

      const stopBtn = document.createElement("button");
      stopBtn.className = "iconBtn stop";
      stopBtn.title = "Stop";
      stopBtn.textContent = "■";
      stopBtn.addEventListener("click", () => {
        stopSmoothPlayback();
        renderRecordings();
      });

      const dlBtn = document.createElement("button");
      dlBtn.className = "iconBtn";
      dlBtn.title = "Download";
      dlBtn.textContent = "⬇";
      dlBtn.addEventListener("click", () => downloadRec(rec));

      const delBtn = document.createElement("button");
      delBtn.className = "iconBtn delete";
      delBtn.title = "Delete";
      delBtn.textContent = "×";
      delBtn.addEventListener("click", () => {
        if (currentPlaybackId === rec.id) stopSmoothPlayback();
        if (editingRecId === rec.id) editingRecId = null;
        decodedCache.delete(rec.id);
        p.recordings = p.recordings.filter(r => r.id !== rec.id);
        touchProject(p);
        renderRecordings();
        showToast("Deleted");
      });

      icons.appendChild(editBtn);
      icons.appendChild(playBtn);
      icons.appendChild(stopBtn);
      icons.appendChild(dlBtn);
      icons.appendChild(delBtn);

      row.appendChild(label);
      row.appendChild(icons);
      els.recordingsList.appendChild(row);
    }
  }

  // ---------- FULL editor (boxed headers + true blank-line persistence) ----------
  function getSectionTitle(key) {
    return (SECTION_DEFS.find(s => s.key === key)?.title || key);
  }

  function buildSectionText(p, key) {
    const sec = p.sections[key];
    if (!sec) return "";
    ensureSectionFullText(sec);
    return normalizeNewlines(sec.fullText);
  }

  function applySectionTextToProject(p, key, text) {
    const sec = p.sections[key];
    if (!sec?.bars) return;

    sec.fullText = normalizeNewlines(text);
    syncBarsFromFullText(sec);

    touchProject(p);
  }

  function updateRhymesFromFullBoxes(activeTa) {
    if (!activeTa) { updateRhymes(""); return; }

    const key = activeTa.getAttribute("data-fullkey") || "";
    const text = activeTa.value || "";
    const caret = activeTa.selectionStart || 0;
    const before = text.slice(0, caret);
    const lines = before.replace(/\r/g, "").split("\n");

    for (let i = lines.length - 2; i >= 0; i--) {
      const line = (lines[i] ?? "").trim();
      if (!line) continue;
      updateRhymes(lastWord(line));
      return;
    }

    const idx = FULL_ORDER.indexOf(key);
    for (let s = idx - 1; s >= 0; s--) {
      const prevKey = FULL_ORDER[s];
      const prevTa = els.bars.querySelector(`textarea.fullEditor[data-fullkey="${prevKey}"]`);
      if (!prevTa) continue;
      const prevLines = (prevTa.value || "").replace(/\r/g, "").split("\n").map(x => x.trim()).filter(Boolean);
      if (prevLines.length) {
        updateRhymes(lastWord(prevLines[prevLines.length - 1]));
        return;
      }
    }

    updateRhymes("");
  }

  // ---------- NEW: section header + scroll helpers ----------
  function ensureScrollCSSOnce() {
    if (document.getElementById("scrollSectionCSS")) return;
    const st = document.createElement("style");
    st.id = "scrollSectionCSS";
    st.textContent = `
      .secWrap{ margin: 10px 0 14px 0; }
      .secHeaderRow{ display:flex; align-items:center; gap:10px; margin: 0 0 8px 0; }
      .secHeaderBox{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:10px 14px;
        border-radius:16px;
        border:2px solid rgba(0,0,0,.12);
        background: rgba(0,0,0,.06);
        font-weight:1000;
        letter-spacing:.9px;
        font-size:13px;
        user-select:none;
      }
      .secDivider{
        height: 2px;
        flex: 1;
        border-radius: 999px;
        background: rgba(0,0,0,.08);
      }
    `;
    document.head.appendChild(st);
  }

  function scrollToSection(key) {
    const el = document.getElementById(`sec-${key}`);
    if (!el) return;
    // scroll so header is visible below sticky top UI
    const y = el.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  // ---------- rendering ----------
  function renderProjectList() {
    const sort = store.projectSort || "recent";
    const projects = [...store.projects];

    if (sort === "az") {
      projects.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    } else {
      projects.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    }

    els.projectList.innerHTML = "";
    const active = getActiveProject();

    for (const proj of projects) {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.marginBottom = "8px";
      row.style.flexWrap = "wrap";

      const btn = document.createElement("button");
      btn.textContent = proj.name?.trim() ? proj.name.trim() : "(unnamed)";
      btn.style.flex = "1";
      if (proj.id === active.id) {
        btn.style.background = "#111";
        btn.style.color = "#fff";
        btn.style.borderColor = "#111";
      }
      btn.addEventListener("click", () => {
        store.activeProjectId = proj.id;
        saveStore();
        renderAll();
        showToast("Opened");
      });

      const dup = document.createElement("button");
      dup.textContent = "Copy";
      dup.addEventListener("click", () => {
        const clone = JSON.parse(JSON.stringify(proj));
        clone.id = uid();
        clone.name = (proj.name || "Project") + " (copy)";
        clone.createdAt = nowISO();
        clone.updatedAt = nowISO();
        store.projects.unshift(repairProject(clone));
        store.activeProjectId = clone.id;
        saveStore();
        renderAll();
        showToast("Copied");
      });

      const del = document.createElement("button");
      del.textContent = "Del";
      del.addEventListener("click", () => {
        if (store.projects.length <= 1) {
          showToast("Can't delete last project");
          return;
        }
        store.projects = store.projects.filter(p => p.id !== proj.id);
        if (store.activeProjectId === proj.id) store.activeProjectId = store.projects[0].id;
        saveStore();
        renderAll();
        showToast("Deleted");
      });

      row.appendChild(btn);
      row.appendChild(dup);
      row.appendChild(del);
      els.projectList.appendChild(row);
    }
  }

  function renderTabs() {
    const p = getActiveProject();
    els.sectionTabs.innerHTML = "";

    for (const s of SECTION_DEFS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab" + (p.activeSection === s.key ? " active" : "");
      btn.textContent = s.title;
      btn.addEventListener("click", () => {
        // ✅ keep active styling + allow jumping, but rendering is now one continuous scroll
        p.activeSection = s.key;
        touchProject(p);

        // if user was in Full mode, exit Full into scroll view first
        if (document.body.classList.contains("fullMode")) {
          renderAll();
          setTimeout(() => scrollToSection(s.key), 50);
        } else {
          scrollToSection(s.key);
        }
      });
      els.sectionTabs.appendChild(btn);
    }

    const fullBtn = document.createElement("button");
    fullBtn.type = "button";
    fullBtn.className = "tab" + (p.activeSection === "full" ? " active" : "");
    fullBtn.textContent = "Full";
    fullBtn.addEventListener("click", () => {
      p.activeSection = "full";
      touchProject(p);
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    els.sectionTabs.appendChild(fullBtn);
  }

  function renderBars() {
    const p = getActiveProject();

    if (p.activeSection === "full") {
      const sectionsHtml = FULL_ORDER.map((key) => {
        const title = getSectionTitle(key).toUpperCase();
        const text = buildSectionText(p, key);
        return `
          <div class="fullSection" data-fullwrap="${escapeHtml(key)}">
            <div class="fullHeaderBox">${escapeHtml(title)}</div>
            <textarea class="fullEditor" data-fullkey="${escapeHtml(key)}" spellcheck="false" placeholder="Type ${escapeHtml(title)} here…">${escapeHtml(text)}</textarea>
          </div>
        `;
      }).join("");

      els.bars.innerHTML = `
        <div class="fullBox">
          <div class="fullSub">
            Full view with boxed section headers. ✅ Blank lines are preserved permanently.<br>
            Tip: Tap a section and use the rhyme dock to insert words.
          </div>
          <div class="fullGrid">
            ${sectionsHtml}
          </div>
        </div>
      `;

      if (!document.getElementById("fullBoxCSS")) {
        const st = document.createElement("style");
        st.id = "fullBoxCSS";
        st.textContent = `
          .fullGrid{ display:flex; flex-direction:column; gap:12px; }
          .fullSection{
            border:1px solid rgba(0,0,0,.12);
            border-radius:18px;
            padding:10px;
            box-shadow: 0 10px 24px rgba(0,0,0,.06);
            background:#fff;
          }
          .fullHeaderBox{
            display:inline-flex;
            align-items:center;
            justify-content:center;
            padding:8px 12px;
            border-radius:14px;
            border:2px solid rgba(0,0,0,.12);
            background: rgba(0,0,0,.06);
            font-weight:1000;
            letter-spacing:.8px;
            font-size:12px;
            margin-bottom:8px;
            user-select:none;
          }
          .fullSection .fullEditor{
            height:220px;
            min-height:160px;
            background:#fff;
          }
          body.fullMode .fullSection .fullEditor{ height:260px; }
        `;
        document.head.appendChild(st);
      }

      const editors = Array.from(els.bars.querySelectorAll("textarea.fullEditor"));
      const tmrByKey = new Map();

      function bindEditor(ta) {
        const key = ta.getAttribute("data-fullkey");
        if (!key) return;

        const commit = () => applySectionTextToProject(p, key, ta.value || "");
        const refresh = () => { updateRhymesFromFullBoxes(ta); updateDockForKeyboard(); };

        ta.addEventListener("focus", () => { setLastTypingTarget(ta); refresh(); });
        ta.addEventListener("click", refresh);
        ta.addEventListener("keyup", refresh);

        ta.addEventListener("input", () => {
          setLastTypingTarget(ta);
          if (tmrByKey.get(key)) clearTimeout(tmrByKey.get(key));
          tmrByKey.set(key, setTimeout(commit, 220));
          refresh();
        });
      }

      editors.forEach(bindEditor);
      updateRhymes("");
      updateDockForKeyboard();
      return;
    }

    // ✅ OLD BEHAVIOR: one continuous scroll containing ALL sections, with standout headers
    ensureScrollCSSOnce();
    els.bars.innerHTML = "";

    // We'll use FULL_ORDER for display order
    const order = FULL_ORDER.slice();

    // helper: find previous non-empty bar text across sections
    function getPrevNonEmptyBarText(sectionKey, barIdx) {
      const modeNow = p.autoSplitMode || "syllables";

      const sec = p.sections[sectionKey];
      if (!sec) return "";

      // within same section, previous bar
      if (barIdx > 0) {
        const prevBar = sec.bars[barIdx - 1];
        if (prevBar && prevBar.text && !isBlankLine(prevBar.text)) {
          const pb = computeBeats(prevBar.text, modeNow);
          return pb[3] || pb[2] || pb[1] || pb[0] || "";
        }
      }

      // otherwise, walk backward through prior sections
      const si = order.indexOf(sectionKey);
      for (let s = si - 1; s >= 0; s--) {
        const pk = order[s];
        const ps = p.sections[pk];
        if (!ps?.bars) continue;
        for (let i = ps.bars.length - 1; i >= 0; i--) {
          const t = ps.bars[i]?.text || "";
          if (!isBlankLine(t)) {
            const pb = computeBeats(t, modeNow);
            return pb[3] || pb[2] || pb[1] || pb[0] || "";
          }
        }
      }

      return "";
    }

    // build DOM
    let globalBarCounter = 0;

    for (const sectionKey of order) {
      const sec = p.sections[sectionKey];
      if (!sec?.bars) continue;

      const wrapSec = document.createElement("div");
      wrapSec.className = "secWrap";
      wrapSec.id = `sec-${sectionKey}`;

      const headerRow = document.createElement("div");
      headerRow.className = "secHeaderRow";

      const header = document.createElement("div");
      header.className = "secHeaderBox";
      header.textContent = (getSectionTitle(sectionKey) || sectionKey).toUpperCase();

      const divider = document.createElement("div");
      divider.className = "secDivider";

      headerRow.appendChild(header);
      headerRow.appendChild(divider);

      wrapSec.appendChild(headerRow);

      sec.bars.forEach((bar, idx) => {
        const wrap = document.createElement("div");
        wrap.className = "bar";

        const n = countSyllablesLine(bar.text || "");
        const glow = syllGlowClass(n);
        const beats = computeBeats(bar.text || "", p.autoSplitMode || "syllables");

        wrap.innerHTML = `
          <div class="barTop">
            <div class="barLeft">
              <div class="barNum">${idx + 1}</div>
              <div class="syllPill ${glow}">
                <span class="lbl">Syllables</span>
                <span class="val" data-syll="${idx}">${n ? n : ""}</span>
              </div>
            </div>
          </div>

          <textarea data-sec="${escapeHtml(sectionKey)}" data-idx="${idx}" placeholder="Type your bar. Optional: use / for beat breaks.">${escapeHtml(bar.text || "")}</textarea>

          <div class="beats">
            <div class="beat">${escapeHtml(beats[0] || "")}</div>
            <div class="beat snare">${escapeHtml(beats[1] || "")}</div>
            <div class="beat">${escapeHtml(beats[2] || "")}</div>
            <div class="beat snare">${escapeHtml(beats[3] || "")}</div>
          </div>
        `;

        const ta = wrap.querySelector("textarea");
        const syllVal = wrap.querySelector(`[data-syll="${idx}"]`);
        const syllPill = wrap.querySelector(".syllPill");
        const beatEls = wrap.querySelectorAll(".beat");

        const thisGlobalIndex = globalBarCounter;

        function refreshRhymesForCaret() {
          const text = ta.value || "";
          const caret = ta.selectionStart || 0;
          const beatIdx = caretBeatIndex(text, caret);
          const modeNow = p.autoSplitMode || "syllables";
          const b = computeBeats(text, modeNow);

          let prevText = "";
          if (beatIdx > 0) {
            prevText = b[beatIdx - 1] || "";
          } else {
            prevText = getPrevNonEmptyBarText(sectionKey, idx);
          }
          updateRhymes(lastWord(prevText));
        }

        ta.addEventListener("focus", () => {
          focusedBarIdx = thisGlobalIndex;
          setLastTypingTarget(ta);
          refreshRhymesForCaret();
          updateDockForKeyboard();
        });
        ta.addEventListener("click", refreshRhymesForCaret);
        ta.addEventListener("keyup", refreshRhymesForCaret);

        ta.addEventListener("input", (e) => {
          const text = e.target.value;
          bar.text = text;

          // keep Full view in sync, but never create “blank bars”
          updateFullTextLineForBar(sec, idx, text);

          touchProject(p);

          const newN = countSyllablesLine(text);
          syllVal.textContent = newN ? String(newN) : "";
          syllPill.classList.remove("red", "yellow", "green");
          const g = syllGlowClass(newN);
          if (g) syllPill.classList.add(g);

          const modeNow = p.autoSplitMode || "syllables";
          const b = computeBeats(text, modeNow);
          for (let i = 0; i < 4; i++) beatEls[i].innerHTML = escapeHtml(b[i] || "");

          refreshRhymesForCaret();
        });

        ta.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // jump to the next textarea in the whole scroll
            const all = Array.from(els.bars.querySelectorAll("textarea[data-sec][data-idx]"));
            const here = all.indexOf(ta);
            const next = all[here + 1];
            if (next) next.focus();
          }
        });

        wrapSec.appendChild(wrap);
        globalBarCounter++;
      });

      els.bars.appendChild(wrapSec);
    }

    updateRhymes("");
    updateDockForKeyboard();
  }

  function renderAll() {
    const p = getActiveProject();
    document.body.classList.toggle("fullMode", p.activeSection === "full");

    els.projectName.value = p.name || "";
    els.bpm.value = p.bpm || 95;
    els.highlightMode.value = p.highlightMode || "focused";
    els.autoSplitMode.value = p.autoSplitMode || "syllables";
    els.projectSort.value = store.projectSort || "recent";

    renderTabs();
    renderProjectList();
    renderBars();
    renderRecordings();

    if (els.statusText) {
      els.statusText.textContent = `${APP_VERSION} • Updated ${new Date(p.updatedAt).toLocaleString()}`;
    }
    updateDockForKeyboard();
    updateRecordButtonUI();
  }

  // ---------- events ----------
  els.newProjectBtn?.addEventListener("click", () => {
    const p = newProject("");
    store.projects.unshift(p);
    store.activeProjectId = p.id;
    saveStore();
    renderAll();
    showToast("New project");
  });

  els.projectName?.addEventListener("input", (e) => {
    const p = getActiveProject();
    p.name = e.target.value || "";
    touchProject(p);
    renderProjectList();
  });

  els.saveBtn?.addEventListener("click", () => {
    const p = getActiveProject();
    touchProject(p);
    showToast("Saved");
  });

  els.exportBtn?.addEventListener("click", async () => {
    const p = getActiveProject();
    const lines = [];
    lines.push(`${p.name || "Beat Sheet Pro Export"}`);
    lines.push(`Updated: ${new Date(p.updatedAt).toLocaleString()}`);
    lines.push("");

    for (const s of SECTION_DEFS) {
      const sec = p.sections[s.key];
      lines.push(`[${s.title}]`);
      sec.bars.forEach(b => { if (b.text && b.text.trim()) lines.push(b.text.trim()); });
      lines.push("");
    }

    const out = lines.join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: "Beat Sheet Pro", text: out });
        showToast("Shared");
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(out);
      showToast("Copied");
    } catch {
      showToast("Copy failed");
    }
  });

  els.projectSort?.addEventListener("change", () => {
    store.projectSort = els.projectSort.value || "recent";
    saveStore();
    renderProjectList();
    showToast("Sorted");
  });

  els.bpm?.addEventListener("change", () => {
    const p = getActiveProject();
    p.bpm = clampInt(parseInt(els.bpm.value, 10), 40, 240);
    els.bpm.value = p.bpm;
    touchProject(p);
    if (metroOn) startMetronome();
  });

  els.highlightMode?.addEventListener("change", () => {
    const p = getActiveProject();
    p.highlightMode = els.highlightMode.value;
    touchProject(p);
  });

  els.autoSplitMode?.addEventListener("change", () => {
    const p = getActiveProject();
    p.autoSplitMode = els.autoSplitMode.value;
    touchProject(p);
    renderBars();
    showToast("Split mode");
  });

  els.metroBtn?.addEventListener("click", () => {
    if (metroOn) stopMetronome();
    else startMetronome();
  });

  els.recordBtn?.addEventListener("click", async () => {
    try {
      if (!recording) await startRecording();
      else stopRecording();
    } catch (err) {
      console.error(err);
      showToast("Record failed (mic?)");
    }
  });

  // ---------- boot ----------
  setDockHidden(loadDockHidden());
  setHeaderCollapsed(loadHeaderCollapsed());

  renderAll();
  updateRhymes("");

})();
```0
