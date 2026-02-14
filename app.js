/* Beat Sheet Pro - app.js (FULL REPLACE v_EXPORT_HTML_2FILES) */
(() => {
"use strict";

/***********************
✅ remembers last textarea user typed in (mobile fix)
***********************/
let lastTextarea = null;
document.addEventListener("focusin", (e)=>{
  const t = e.target;
  if(t && t.tagName === "TEXTAREA") lastTextarea = t;
});

/***********************
✅ STORAGE ISOLATION (IMPORTANT)
***********************/
const APP_VERSION = "Hobo Beat Sheet";

const need = (id) => document.getElementById(id);
const els = {
  exportBtn: need("exportBtn"),
  saveBtn: need("saveBtn"),
  bpm: need("bpm"),
  metroBtn: need("metroBtn"),
  highlightMode: need("highlightMode"),
  autoSplitMode: need("autoSplitMode"),

  // merged header projects UI
  projectPicker: need("projectPicker"),
  newProjectBtn: need("newProjectBtn"),
  copyProjectBtn: need("copyProjectBtn"),
  deleteProjectBtn: need("deleteProjectBtn"),

  toast: need("toast"),
  statusText: need("statusText"),

  headerToggle: need("headerToggle"),
  headerToggle2: need("headerToggle2"),

  sectionTabs: need("sectionTabs"),
  bars: need("bars"),

  projectName: need("projectName"), // now in header

  recordBtn: need("recordBtn"),
  recordName: need("recordName"),
  recordingsList: need("recordingsList"),
  recHint: need("recHint"),

  rhymeDock: need("rhymeDock"),
  rhymeBase: need("rhymeBase"),
  rhymeList: need("rhymeList"),
  dockToggle: need("dockToggle"),
};

const STORAGE_SCOPE = (() => {
  const firstFolder = (location.pathname.split("/").filter(Boolean)[0] || "root");
  return firstFolder.replace(/[^a-z0-9_-]+/gi, "_");
})();
const KEY_PREFIX = `beatsheetpro__${STORAGE_SCOPE}__`;

const STORAGE_KEY = `${KEY_PREFIX}projects_v1`;
const RHYME_CACHE_KEY = `${KEY_PREFIX}rhyme_cache_v1`;
const DOCK_HIDDEN_KEY = `${KEY_PREFIX}rhymeDock_hidden_v1`;
const HEADER_COLLAPSED_KEY = `${KEY_PREFIX}header_collapsed_v1`;

const OLD_STORAGE_KEY = "beatsheetpro_projects_v1";
const OLD_RHYME_CACHE_KEY = "beatsheetpro_rhyme_cache_v1";
const OLD_DOCK_HIDDEN_KEY = "beatsheetpro_rhymeDock_hidden_v1";
const OLD_HEADER_COLLAPSED_KEY = "beatsheetpro_header_collapsed_v1";

(function migrateOldKeysOnce(){
  try{
    if(!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(OLD_STORAGE_KEY)){
      localStorage.setItem(STORAGE_KEY, localStorage.getItem(OLD_STORAGE_KEY));
    }
    if(!localStorage.getItem(RHYME_CACHE_KEY) && localStorage.getItem(OLD_RHYME_CACHE_KEY)){
      localStorage.setItem(RHYME_CACHE_KEY, localStorage.getItem(OLD_RHYME_CACHE_KEY));
    }
    if(!localStorage.getItem(DOCK_HIDDEN_KEY) && localStorage.getItem(OLD_DOCK_HIDDEN_KEY)){
      localStorage.setItem(DOCK_HIDDEN_KEY, localStorage.getItem(OLD_DOCK_HIDDEN_KEY));
    }
    if(!localStorage.getItem(HEADER_COLLAPSED_KEY) && localStorage.getItem(OLD_HEADER_COLLAPSED_KEY)){
      localStorage.setItem(HEADER_COLLAPSED_KEY, localStorage.getItem(OLD_HEADER_COLLAPSED_KEY));
    }
  }catch{}
})();

const SECTION_DEFS = [
  { key:"verse1",  title:"Verse 1",  bars:16, extra:4 },
  { key:"chorus1", title:"Chorus 1", bars:12, extra:4 },
  { key:"verse2",  title:"Verse 2",  bars:16, extra:4 },
  { key:"chorus2", title:"Chorus 2", bars:12, extra:4 },
  { key:"verse3",  title:"Verse 3",  bars:16, extra:4 },
  { key:"chorus3", title:"Chorus 3", bars:12, extra:4 },
  { key:"bridge",  title:"Bridge",   bars: 8, extra:4 },
];

const FULL_ORDER = ["verse1","chorus1","verse2","chorus2","verse3","bridge","chorus3"];
const FULL_HEADINGS = FULL_ORDER.map(k => (SECTION_DEFS.find(s=>s.key===k)?.title || k).toUpperCase());
const headingSet = new Set(FULL_HEADINGS);

// ---------- utils ----------
const nowISO = () => new Date().toISOString();
const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

function showToast(msg){
  if(!els.toast) return;
  els.toast.textContent = msg || "Saved";
  els.toast.classList.add("show");
  setTimeout(()=>els.toast.classList.remove("show"), 1200);
}
function escapeHtml(s){
  return String(s || "").replace(/[&<>"]/g, (c)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;"
  }[c]));
}
function clampInt(v,min,max){
  if(Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

// ---------- headshot eye blink ----------
let eyePulseTimer = null;
let metroOn = false;
let recording = false;

function headerIsVisibleForEyes(){
  return !document.body.classList.contains("headerCollapsed");
}
function getEyeEls(){
  const eyeL = document.getElementById("eyeL");
  const eyeR = document.getElementById("eyeR");
  if(!eyeL || !eyeR) return null;
  return { eyeL, eyeR };
}
function flashEyes(){
  if(!headerIsVisibleForEyes()) return;
  const eyes = getEyeEls();
  if(!eyes) return;
  eyes.eyeL.classList.add("on");
  eyes.eyeR.classList.add("on");
  setTimeout(()=>{
    eyes.eyeL.classList.remove("on");
    eyes.eyeR.classList.remove("on");
  }, 90);
}
function stopEyePulse(){
  if(eyePulseTimer) clearInterval(eyePulseTimer);
  eyePulseTimer = null;
}
function startEyePulseFromBpm(){
  stopEyePulse();
  if(!headerIsVisibleForEyes()) return;
  if(!(metroOn || recording)) return;

  const p = getActiveProject();
  const bpm = clampInt(parseInt(els.bpm?.value || p.bpm || 95, 10), 40, 240);
  const intervalMs = 60000 / bpm;
  eyePulseTimer = setInterval(()=>flashEyes(), intervalMs);
}
// Some older builds referenced this. Keep it defined so Shared never crashes.
window.updateBlinkTargets = window.updateBlinkTargets || function(){};

// ---------- header collapse ----------
function loadHeaderCollapsed(){
  try{ return localStorage.getItem(HEADER_COLLAPSED_KEY) === "1"; }catch{ return false; }
}
function saveHeaderCollapsed(isCollapsed){
  try{ localStorage.setItem(HEADER_COLLAPSED_KEY, isCollapsed ? "1" : "0"); }catch{}
}
function setHeaderCollapsed(isCollapsed){
  document.body.classList.toggle("headerCollapsed", !!isCollapsed);
  if(els.headerToggle)  els.headerToggle.textContent  = isCollapsed ? "Show" : "Hide";
  if(els.headerToggle2) els.headerToggle2.textContent = isCollapsed ? "Show" : "Hide";
  saveHeaderCollapsed(!!isCollapsed);
  updateDockForKeyboard();
  if(isCollapsed) stopEyePulse();
  else startEyePulseFromBpm();
}
els.headerToggle?.addEventListener("click", ()=>{
  const collapsed = document.body.classList.contains("headerCollapsed");
  setHeaderCollapsed(!collapsed);
});
els.headerToggle2?.addEventListener("click", ()=>{
  const collapsed = document.body.classList.contains("headerCollapsed");
  setHeaderCollapsed(!collapsed);
});

// Keep rhyme dock visible above keyboard (Android)
function updateDockForKeyboard(){
  const vv = window.visualViewport;
  if(!els.rhymeDock) return;
  if(!vv){ els.rhymeDock.style.bottom = "10px"; return; }
  const keyboardPx = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop));
  els.rhymeDock.style.bottom = (10 + keyboardPx) + "px";
}
window.visualViewport?.addEventListener("resize", updateDockForKeyboard);
window.visualViewport?.addEventListener("scroll", updateDockForKeyboard);
window.addEventListener("resize", updateDockForKeyboard);

// ---------- rhyme dock hide/show ----------
function loadDockHidden(){
  try{ return localStorage.getItem(DOCK_HIDDEN_KEY) === "1"; }catch{ return false; }
}
function saveDockHidden(isHidden){
  try{ localStorage.setItem(DOCK_HIDDEN_KEY, isHidden ? "1" : "0"); }catch{}
}
function setDockHidden(isHidden){
  if(!els.rhymeDock || !els.dockToggle) return;
  els.rhymeDock.classList.toggle("dockHidden", !!isHidden);
  els.dockToggle.textContent = isHidden ? "R" : "Hide";
  saveDockHidden(!!isHidden);
  updateDockForKeyboard();
}
els.dockToggle?.addEventListener("click", ()=>{
  const nowHidden = els.rhymeDock?.classList?.contains("dockHidden");
  setDockHidden(!nowHidden);
});

// ---------- syllables ----------
function normalizeWord(w){ return (w||"").toLowerCase().replace(/[^a-z']/g,""); }
const SYLL_DICT = {
  "im":1,"i'm":1,"ive":1,"i've":1,"ill":1,"i'll":1,"id":1,"i'd":1,
  "dont":1,"don't":1,"cant":1,"can't":1,"wont":1,"won't":1,"aint":1,"ain't":1,
  "yeah":1,"ya":1,"yup":1,"nah":1,"yall":1,"y'all":1,"bruh":1,"bro":1,
  "wanna":2,"gonna":2,"tryna":2,"lemme":2,"gotta":2,"kinda":2,"outta":2,
  "toyota":3,"hiphop":2,"gfunk":2,"gangsta":2,"birthday":2
};
function countSyllablesWord(word){
  if(!word) return 0;
  const forced = String(word).match(/\((\d+)\)\s*$/);
  if(forced) return Math.max(1, parseInt(forced[1],10));
  let w = normalizeWord(word);
  if(!w) return 0;
  if(SYLL_DICT[w] != null) return SYLL_DICT[w];
  if(/^\d+$/.test(w)) return 1;
  if(w.length <= 3) return 1;

  w = w.replace(/'/g,"");
  if(/[^aeiou]e$/.test(w) && !/[^aeiou]le$/.test(w)) w = w.slice(0,-1);

  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 0;

  if(/(tion|sion|cion)$/.test(w)) count -= 1;
  if(/(ious|eous)$/.test(w)) count -= 1;
  if(/[^aeiou]le$/.test(w)) count += 1;

  return Math.max(1, count || 1);
}
function countSyllablesLine(line){
  const clean = (line||"").replace(/[\/]/g," ").trim();
  if(!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).reduce((sum,w)=>sum+countSyllablesWord(w),0);
}
function syllGlowClass(n){
  if(!n) return "";
  if(n <= 6) return "red";
  if(n <= 9) return "yellow";
  if(n <= 13) return "green";
  if(n <= 16) return "yellow";
  return "red";
}

// ---------- beat splitting ----------
function splitBySlashes(text){
  const parts = (text||"").split("/").map(s=>s.trim());
  return [parts[0]||"", parts[1]||"", parts[2]||"", parts[3]||""];
}
function autoSplitWords(text){
  const clean = (text||"").replace(/[\/]/g," ").trim();
  if(!clean) return ["","","",""];
  const words = clean.split(/\s+/);
  const per = Math.ceil(words.length/4) || 1;
  const per2 = per * 2;
  const per3 = per * 3;
  return [
    words.slice(0,per).join(" "),
    words.slice(per,per2).join(" "),
    words.slice(per2,per3).join(" "),
    words.slice(per3).join(" "),
  ];
}
function splitWordIntoChunks(word){
  const raw = String(word);
  const cleaned = raw.replace(/[^A-Za-z']/g,"");
  if(!cleaned) return [raw];
  const groups = cleaned.match(/[aeiouy]+|[^aeiouy]+/gi) || [cleaned];
  const out = [];
  for(const g of groups){
    if(out.length && /^[^aeiouy]+$/i.test(g) && g.length <= 2){
      out[out.length-1] += g;
    } else out.push(g);
  }
  return out.length ? out : [raw];
}
function chunkSyllCount(chunk){
  const w = String(chunk).toLowerCase().replace(/[^a-z']/g,"").replace(/'/g,"");
  const groups = w.match(/[aeiouy]+/g);
  return Math.max(1, (groups ? groups.length : 0) || 1);
}
function buildTargets(total){
  const base = Math.floor(total/4);
  const rem = total % 4;
  const t = [base,base,base,base];
  for(let i=0;i<rem;i++) t[i] += 1;
  if(total < 4){
    t.fill(0);
    for(let i=0;i<total;i++) t[i] = 1;
  }
  return t;
}
function autoSplitSyllablesClean(text){
  const clean = (text||"").replace(/[\/]/g," ").trim();
  if(!clean) return ["","","",""];
  const words = clean.split(/\s+/).filter(Boolean);
  const sylls = words.map(w=>countSyllablesWord(w));
  const total = sylls.reduce((a,b)=>a+b,0);
  if(!total) return ["","","",""];
  const targets = buildTargets(total);
  const beats = [[],[],[],[]];
  const beatSyll = [0,0,0,0];
  let b = 0;

  function pushWord(beatIndex, w){ beats[beatIndex].push(w); }

  for(let i=0;i<words.length;i++){
    const w = words[i];
    const s = sylls[i];

    while(b < 3 && beatSyll[b] >= targets[b]) b++;
    const remaining = targets[b] - beatSyll[b];
    if(remaining <= 0 && b < 3) b++;

    const rem2 = targets[b] - beatSyll[b];

    if(s <= rem2 || b === 3){
      pushWord(b, w);
      beatSyll[b] += s;
      continue;
    }
    if(rem2 <= 1 && b < 3){
      b++;
      pushWord(b, w);
      beatSyll[b] += s;
      continue;
    }

    const chunks = splitWordIntoChunks(w);
    const chunkS = chunks.map(chunkSyllCount);

    let take = [];
    let takeSyll = 0;
    for(let c=0;c<chunks.length;c++){
      if(takeSyll + chunkS[c] > rem2 && take.length > 0) break;
      take.push(chunks[c]);
      takeSyll += chunkS[c];
      if(takeSyll >= rem2) break;
    }
    if(!take.length){
      pushWord(b, w);
      beatSyll[b] += s;
      continue;
    }

    const left = take.join("");
    const right = chunks.slice(take.length).join("");

    pushWord(b, left);
    beatSyll[b] += takeSyll;

    if(b < 3){
      b++;
      pushWord(b, right);
      beatSyll[b] += Math.max(1, s - takeSyll);
    }else{
      pushWord(b, right);
      beatSyll[b] += Math.max(1, s - takeSyll);
    }
  }

  return beats.map(arr=>arr.join(" ").trim());
}
function computeBeats(text, mode){
  const hasSlash = (text||"").includes("/");
  if(hasSlash) return splitBySlashes(text);
  if(mode === "none") return ["","","",""];
  if(mode === "words") return autoSplitWords(text);
  return autoSplitSyllablesClean(text);
}

// ---------- rhymes ----------
const rhymeCache = (() => {
  try{ return JSON.parse(localStorage.getItem(RHYME_CACHE_KEY) || "{}"); }
  catch{ return {}; }
})();
function saveRhymeCache(){
  try{ localStorage.setItem(RHYME_CACHE_KEY, JSON.stringify(rhymeCache)); }catch{}
}
let rhymeAbort = null;

function lastWord(str){
  const s = (str||"").toLowerCase().replace(/[^a-z0-9'\s-]/g," ").trim();
  if(!s) return "";
  const parts = s.split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length-1].replace(/^-+|-+$/g,"") : "";
}
function caretBeatIndex(text, caretPos){
  const before = (text||"").slice(0, Math.max(0, caretPos||0));
  const count = (before.match(/\//g) || []).length;
  return Math.max(0, Math.min(3, count));
}

async function updateRhymes(seed){
  const w = (seed||"").toLowerCase().replace(/[^a-z0-9']/g,"").trim();
  if(!w){
    if(els.rhymeBase) els.rhymeBase.textContent = "Tap into a beat…";
    if(els.rhymeList) els.rhymeList.innerHTML = `<span class="small">Rhymes appear for last word in previous beat box.</span>`;
    return;
  }
  if(els.rhymeBase) els.rhymeBase.textContent = w;

  if(Array.isArray(rhymeCache[w]) && rhymeCache[w].length){
    renderRhymes(rhymeCache[w]);
    return;
  }
  if(els.rhymeList) els.rhymeList.innerHTML = `<span class="small">Loading…</span>`;

  try{
    if(rhymeAbort) rhymeAbort.abort();
    rhymeAbort = new AbortController();

    const url = `https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(w)}&max=18`;
    const res = await fetch(url, { signal: rhymeAbort.signal });
    const data = await res.json();
    const words = (data||[]).map(x=>x.word).filter(Boolean);

    rhymeCache[w] = words;
    saveRhymeCache();
    renderRhymes(words);
  }catch(e){
    if(String(e).includes("AbortError")) return;
    if(els.rhymeList) els.rhymeList.innerHTML = `<span class="small" style="color:#b91c1c;">Rhyme lookup failed.</span>`;
  }
}
function renderRhymes(words){
  if(!els.rhymeList) return;
  if(!words || !words.length){
    els.rhymeList.innerHTML = `<span class="small">No rhymes found.</span>`;
    return;
  }
  els.rhymeList.innerHTML = words.slice(0,18)
    .map(w=>`<button type="button" class="rhymeChip" data-rhyme="${escapeHtml(w)}">${escapeHtml(w)}</button>`)
    .join("");
}

// ✅ MOBILE-PROOF rhyme insert
document.addEventListener("click", (e)=>{
  const chip = e.target.closest(".rhymeChip");
  if(!chip) return;

  const word = (chip.getAttribute("data-rhyme") || chip.textContent || "").trim();
  if(!word) return;

  let ta = null;
  if(document.activeElement && document.activeElement.tagName === "TEXTAREA") ta = document.activeElement;
  else ta = lastTextarea;

  if(ta && ta.tagName === "TEXTAREA"){
    ta.focus();

    const start = ta.selectionStart ?? ta.value.length;
    const end   = ta.selectionEnd ?? ta.value.length;

    const before = ta.value.slice(0,start);
    const after  = ta.value.slice(end);

    const match = before.match(/(^|[\s\/])([^\s\/]*)$/);
    const prefix = match ? before.slice(0, before.length - (match[2]||"").length) : before;

    const afterMatch = after.match(/^([^\s\/]*)(.*)$/);
    const afterRest = afterMatch ? afterMatch[2] : after;

    const space = prefix && !/[\s\/]$/.test(prefix) ? " " : "";
    const insert = space + word;

    ta.value = prefix + insert + afterRest;
    ta.dispatchEvent(new Event("input",{bubbles:true}));

    const pos = (prefix + insert).length;
    ta.setSelectionRange(pos,pos);

    showToast("Inserted");
    return;
  }

  navigator.clipboard?.writeText?.(word)
    .then(()=>showToast("Copied"))
    .catch(()=>showToast("Copy failed"));
});

// ---------- projects ----------
function blankSections(){
  const sections = {};
  for(const s of SECTION_DEFS){
    sections[s.key] = {
      key: s.key,
      title: s.title,
      bars: Array.from({length: s.bars + s.extra}, ()=>({ text:"" })),
    };
  }
  return sections;
}
function newProject(name=""){
  return {
    id: uid(),
    name: name || "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    activeSection: "verse1",
    bpm: 95,
    highlightMode: "focused",
    autoSplitMode: "syllables",
    recordings: [],
    sections: blankSections(),
  };
}
function loadStore(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const p = newProject("");
    const s = { activeProjectId: p.id, projects:[p] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }
  try{ return JSON.parse(raw); }
  catch{
    localStorage.removeItem(STORAGE_KEY);
    return loadStore();
  }
}
let store = loadStore();

function repairProject(p){
  if(!p.sections || typeof p.sections !== "object") p.sections = blankSections();
  for(const def of SECTION_DEFS){
    if(!p.sections[def.key] || !Array.isArray(p.sections[def.key].bars)){
      p.sections[def.key] = { key:def.key, title:def.title, bars:Array.from({length:def.bars+def.extra}, ()=>({text:""})) };
    }
  }
  if(!p.activeSection) p.activeSection = "verse1";
  if(!Array.isArray(p.recordings)) p.recordings = [];
  if(!p.bpm) p.bpm = 95;
  if(!p.highlightMode) p.highlightMode = "focused";
  if(!p.autoSplitMode) p.autoSplitMode = "syllables";
  return p;
}

store.projects = (store.projects || []).map(repairProject);
if(!store.projects.length){
  const p = newProject("");
  store.projects = [p];
  store.activeProjectId = p.id;
}
if(!store.activeProjectId || !store.projects.find(p=>p.id===store.activeProjectId)){
  store.activeProjectId = store.projects[0].id;
}

function saveStore(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
function getActiveProject(){ return store.projects.find(p=>p.id===store.activeProjectId) || store.projects[0]; }
function touchProject(p){ p.updatedAt = nowISO(); saveStore(); }

// ✅ header project picker
function renderProjectPicker(){
  if(!els.projectPicker) return;

  const projects = [...store.projects].sort((a,b)=>{
    const an = (a.name||"").trim() || "(unnamed)";
    const bn = (b.name||"").trim() || "(unnamed)";
    return an.localeCompare(bn, undefined, { sensitivity:"base" });
  });

  const active = getActiveProject();
  els.projectPicker.innerHTML = projects.map(p=>{
    const label = (p.name||"").trim() || "(unnamed)";
    const sel = (p.id === active.id) ? "selected" : "";
    return `<option value="${escapeHtml(p.id)}" ${sel}>${escapeHtml(label)}</option>`;
  }).join("");
}

// ---------- metronome + recording (unchanged core) ----------
let audioCtx = null;
let metroGain = null;
let recordDest = null;

let metroTimer = null;
let metroBeat16 = 0;

function ensureAudio(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    metroGain = audioCtx.createGain();
    metroGain.gain.value = 0.9;
    recordDest = audioCtx.createMediaStreamDestination();
    metroGain.connect(audioCtx.destination);
    metroGain.connect(recordDest);
  }
}
function playKick(){
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
function playSnare(){
  ensureAudio();
  const t = audioCtx.currentTime;
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.12);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
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
function playHat(){
  ensureAudio();
  const t = audioCtx.currentTime;
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.03);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
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

let focusedBarIdx = 0;
function flashBeats(beatInBar){
  const p = getActiveProject();
  const highlight = p.highlightMode || "focused";
  const barEls = document.querySelectorAll(".bar");
  const targets = (highlight === "all") ? Array.from(barEls) : [barEls[focusedBarIdx] || barEls[0]];
  targets.forEach(barEl=>{
    const beats = barEl?.querySelectorAll(".beat");
    if(!beats || beats.length < 4) return;
    beats.forEach(b=>b.classList.remove("flash"));
    beats[beatInBar]?.classList.add("flash");
    setTimeout(()=>beats.forEach(b=>b.classList.remove("flash")), 90);
  });
}

function startMetronome(){
  ensureAudio();
  if(audioCtx.state === "suspended") audioCtx.resume();
  stopMetronome();

  metroOn = true;
  if(els.metroBtn){
    els.metroBtn.textContent = "Stop";
    els.metroBtn.classList.add("on");
  }
  metroBeat16 = 0;
  startEyePulseFromBpm();

  const tick = () => {
    const p = getActiveProject();
    const bpm = clampInt(parseInt(els.bpm?.value || p.bpm,10), 40, 240);
    const intervalMs = 60000 / bpm / 4;
    const step16 = metroBeat16 % 16;
    const beatInBar = Math.floor(step16 / 4);

    playHat();
    if(step16 === 0 || step16 === 8) playKick();
    if(step16 === 4 || step16 === 12) playSnare();
    if(step16 % 4 === 0) flashBeats(beatInBar);

    metroBeat16++;
    metroTimer = setTimeout(tick, intervalMs);
  };
  tick();
}
function stopMetronome(){
  if(metroTimer) clearTimeout(metroTimer);
  metroTimer = null;
  metroOn = false;
  if(els.metroBtn){
    els.metroBtn.textContent = "Metronome";
    els.metroBtn.classList.remove("on");
  }
  if(!recording) stopEyePulse();
}

// smooth playback
let currentPlayback = null;
let currentPlaybackId = null;
const decodedCache = new Map();

function stopSmoothPlayback(){
  try{ currentPlayback?.stop?.(); }catch{}
  currentPlayback = null;
  currentPlaybackId = null;
}
async function dataUrlToBlob(dataUrl){
  const res = await fetch(dataUrl);
  return await res.blob();
}
async function getDecodedBufferForRec(rec){
  ensureAudio();
  if(decodedCache.has(rec.id)) return decodedCache.get(rec.id);
  const blob = await dataUrlToBlob(rec.dataUrl);
  const arr = await blob.arrayBuffer();
  const buffer = await audioCtx.decodeAudioData(arr);
  decodedCache.set(rec.id, buffer);
  return buffer;
}
async function play(rec){
  ensureAudio();
  if(audioCtx.state === "suspended") await audioCtx.resume();

  stopSmoothPlayback();
  if(metroOn) stopMetronome();

  const buffer = await getDecodedBufferForRec(rec);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(audioCtx.destination);
  src.start(0);

  currentPlayback = src;
  currentPlaybackId = rec.id;

  src.onended = () => {
    if(currentPlayback === src){
      currentPlayback = null;
      currentPlaybackId = null;
      renderRecordings();
    }
  };
}
async function downloadRec(rec){
  try{
    const blob = await dataUrlToBlob(rec.dataUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = (rec.name || "take").replace(/[^\w\s.-]+/g,"").trim() || "take";
    a.download = `${safe}.${(rec.mime||"audio/webm").includes("ogg") ? "ogg" : "webm"}`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }catch(e){
    console.error(e);
    showToast("Download failed");
  }
}

// recording
let recorder = null;
let recChunks = [];
let micStream = null;
let micSource = null;
let micGain = null;

async function ensureMic(){
  if(micStream) return;
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true }
  });
  ensureAudio();
  micSource = audioCtx.createMediaStreamSource(micStream);
  micGain = audioCtx.createGain();
  micGain.gain.value = 1.0;
  micSource.connect(micGain);
  micGain.connect(recordDest);
}
function pickBestMime(){
  const candidates = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/ogg"];
  for(const m of candidates){
    if(window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}
function blobToDataURL(blob){
  return new Promise((resolve)=>{
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.readAsDataURL(blob);
  });
}
function takeNameFromInput(){ return (els.recordName?.value || "").trim(); }
function clearTakeNameInput(){ if(els.recordName) els.recordName.value = ""; }
function updateRecordButtonUI(){
  if(!els.recordBtn) return;
  if(recording){
    els.recordBtn.textContent = "Stop";
    els.recordBtn.classList.add("recOn");
  }else{
    els.recordBtn.textContent = "Record";
    els.recordBtn.classList.remove("recOn");
  }
}
async function startRecording(){
  await ensureMic();
  ensureAudio();
  if(audioCtx.state === "suspended") await audioCtx.resume();

  recChunks = [];
  recording = true;
  updateRecordButtonUI();
  stopSmoothPlayback();
  startEyePulseFromBpm();

  const mimeType = pickBestMime();
  const opts = {};
  if(mimeType) opts.mimeType = mimeType;
  opts.audioBitsPerSecond = 64000;

  recorder = new MediaRecorder(recordDest.stream, opts);

  recorder.ondataavailable = (e)=>{
    if(e.data && e.data.size > 0) recChunks.push(e.data);
  };

  recorder.onstop = async ()=>{
    recording = false;
    updateRecordButtonUI();

    if(metroOn) stopMetronome();
    if(!metroOn) stopEyePulse();

    const blob = new Blob(recChunks, { type: recorder.mimeType || mimeType || "audio/webm" });
    const dataUrl = await blobToDataURL(blob);

    const p = getActiveProject();
    const typed = takeNameFromInput();
    const name = typed || `Take ${new Date().toLocaleString()}`;

    const rec = { id: uid(), name, createdAt: nowISO(), mime: blob.type || "audio/webm", dataUrl };
    p.recordings.unshift(rec);
    decodedCache.delete(rec.id);

    clearTakeNameInput();
    touchProject(p);
    renderRecordings();
    showToast("Saved take");
  };

  recorder.start(1000);
}
function stopRecording(){
  if(recorder && recording) recorder.stop();
}

// rename UI
let editingRecId = null;

function renderRecordings(){
  const p = getActiveProject();
  if(!els.recordingsList) return;

  els.recordingsList.innerHTML = "";

  if(!p.recordings?.length){
    els.recordingsList.innerHTML = `<div class="small">No recordings yet.</div>`;
    return;
  }

  for(const rec of p.recordings){
    const row = document.createElement("div");
    row.className = "audioItem";

    if(editingRecId === rec.id){
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
      save.addEventListener("click", ()=>{
        const newName = (input.value || "").trim();
        rec.name = newName || rec.name || "Take";
        touchProject(p);
        editingRecId = null;
        renderRecordings();
        showToast("Renamed");
      });

      const cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", ()=>{
        editingRecId = null;
        renderRecordings();
      });

      input.addEventListener("keydown", (e)=>{
        if(e.key === "Enter"){ e.preventDefault(); save.click(); }
        if(e.key === "Escape"){ e.preventDefault(); cancel.click(); }
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
    editBtn.addEventListener("click", ()=>{
      editingRecId = rec.id;
      renderRecordings();
      requestAnimationFrame(()=>{
        const inp = els.recordingsList.querySelector('input[type="text"]');
        inp?.focus?.();
        inp?.select?.();
      });
    });

    const playBtn = document.createElement("button");
    playBtn.className = "iconBtn play";
    playBtn.title = "Play";
    playBtn.textContent = (currentPlaybackId === rec.id) ? "…" : "▶";
    playBtn.addEventListener("click", async ()=>{
      try{ await play(rec); renderRecordings(); }
      catch(e){ console.error(e); showToast("Playback failed"); }
    });

    const stopBtn = document.createElement("button");
    stopBtn.className = "iconBtn stop";
    stopBtn.title = "Stop";
    stopBtn.textContent = "■";
    stopBtn.addEventListener("click", ()=>{
      stopSmoothPlayback();
      renderRecordings();
    });

    const dlBtn = document.createElement("button");
    dlBtn.className = "iconBtn";
    dlBtn.title = "Download";
    dlBtn.textContent = "⬇";
    dlBtn.addEventListener("click", ()=>downloadRec(rec));

    const delBtn = document.createElement("button");
    delBtn.className = "iconBtn delete";
    delBtn.title = "Delete";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", ()=>{
      if(currentPlaybackId === rec.id) stopSmoothPlayback();
      if(editingRecId === rec.id) editingRecId = null;
      decodedCache.delete(rec.id);
      p.recordings = p.recordings.filter(r=>r.id !== rec.id);
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

// ---------- FULL editor ----------
function buildFullTextFromProject(p){
  const out = [];
  for(const key of FULL_ORDER){
    const heading = (SECTION_DEFS.find(s=>s.key===key)?.title || key).toUpperCase();
    out.push(heading);

    const sec = p.sections[key];
    if(sec?.bars){
      for(const b of sec.bars){
        const t = (b.text || "").replace(/\s+$/,"");
        if(!t.trim()) continue;
        out.push(t);
        out.push("");
      }
    }
    out.push("");
  }
  return out.join("\n");
}
function applyFullTextToProject(p, fullText){
  const lines = String(fullText||"").replace(/\r/g,"").split("\n");
  let currentKey = null;
  let writeIndex = 0;

  for(const key of FULL_ORDER){
    const sec = p.sections[key];
    if(sec?.bars) sec.bars.forEach(b => b.text = "");
  }

  function headingToKey(line){
    const up = String(line||"").trim().toUpperCase();
    const def = SECTION_DEFS.find(s => s.title.toUpperCase() === up);
    return def ? def.key : null;
  }

  for(const raw of lines){
    const key = headingToKey(raw);
    if(key){ currentKey = key; writeIndex = 0; continue; }
    if(!currentKey) continue;
    if(!String(raw).trim()) continue;

    const sec = p.sections[currentKey];
    if(!sec?.bars) continue;
    if(writeIndex >= sec.bars.length) continue;

    sec.bars[writeIndex].text = raw.replace(/\s+$/,"");
    writeIndex++;
  }

  touchProject(p);
}

function updateRhymesFromFullCaret(fullTa){
  if(!fullTa) return;
  const text = fullTa.value || "";
  const caret = fullTa.selectionStart || 0;
  const before = text.slice(0, caret);
  const lines = before.replace(/\r/g,"").split("\n");

  let j = lines.length - 2;
  while(j >= 0){
    const line = (lines[j] ?? "");
    const trimmed = line.trim();
    if(!trimmed){ j--; continue; }
    const up = trimmed.toUpperCase();
    if(headingSet.has(up)){ j--; continue; }
    updateRhymes(lastWord(trimmed));
    return;
  }
  updateRhymes("");
}

document.addEventListener("selectionchange", ()=>{
  const p = getActiveProject();
  if(p.activeSection !== "full") return;
  const ta = document.getElementById("fullEditor");
  if(!ta) return;
  if(document.activeElement !== ta) return;
  updateRhymesFromFullCaret(ta);
}, { passive:true });

// ---------- rendering ----------
function renderTabs(){
  const p = getActiveProject();
  els.sectionTabs.innerHTML = "";

  for(const s of SECTION_DEFS){
    const btn = document.createElement("button");
    btn.type="button";
    btn.className="tab" + (p.activeSection === s.key ? " active" : "");
    btn.textContent=s.title;
    btn.addEventListener("click", ()=>{
      p.activeSection = s.key;
      touchProject(p);
      renderAll();
    });
    els.sectionTabs.appendChild(btn);
  }

  const fullBtn = document.createElement("button");
  fullBtn.type = "button";
  fullBtn.className = "tab" + (p.activeSection === "full" ? " active" : "");
  fullBtn.textContent = "Full";
  fullBtn.addEventListener("click", ()=>{
    p.activeSection = "full";
    touchProject(p);
    renderAll();
  });
  els.sectionTabs.appendChild(fullBtn);
}

function renderBars(){
  const p = getActiveProject();

  if(p.activeSection === "full"){
    const fullText = buildFullTextFromProject(p);
    els.bars.innerHTML = `
      <div class="fullBox">
        <div class="fullSub">
          Paste + edit here. Rhymes follow the last word on the line ABOVE your cursor.<br>
          ✅ Blank lines are just spacing (they do NOT create empty bars).<br>
          Headings: ${FULL_HEADINGS.join(", ")}
        </div>
        <textarea id="fullEditor" class="fullEditor" spellcheck="false">${escapeHtml(fullText)}</textarea>
      </div>
    `;

    const ta = document.getElementById("fullEditor");
    let tmr = null;

    const commit = () => applyFullTextToProject(p, ta.value || "");
    const refresh = () => { updateRhymesFromFullCaret(ta); updateDockForKeyboard(); };

    refresh();

    ta.addEventListener("input", ()=>{
      if(tmr) clearTimeout(tmr);
      tmr = setTimeout(commit, 220);
      refresh();
    });
    ta.addEventListener("click", refresh);
    ta.addEventListener("keyup", refresh);
    ta.addEventListener("focus", refresh);

    return;
  }

  const sec = p.sections[p.activeSection];
  els.bars.innerHTML = "";

  sec.bars.forEach((bar, idx)=>{
    const wrap = document.createElement("div");
    wrap.className = "bar";

    const n = countSyllablesLine(bar.text||"");
    const glow = syllGlowClass(n);
    const beats = computeBeats(bar.text||"", p.autoSplitMode || "syllables");

    wrap.innerHTML = `
      <div class="barTop">
        <div class="barLeft">
          <div class="barNum">${idx+1}</div>
          <div class="syllPill ${glow}">
            <span class="lbl">Syllables</span>
            <span class="val" data-syll="${idx}">${n ? n : ""}</span>
          </div>
        </div>
      </div>

      <textarea data-idx="${idx}" placeholder="Type your bar. Optional: use / for beat breaks.">${escapeHtml(bar.text||"")}</textarea>

      <div class="beats">
        <div class="beat">${escapeHtml(beats[0]||"")}</div>
        <div class="beat snare">${escapeHtml(beats[1]||"")}</div>
        <div class="beat">${escapeHtml(beats[2]||"")}</div>
        <div class="beat snare">${escapeHtml(beats[3]||"")}</div>
      </div>
    `;

    const ta = wrap.querySelector("textarea");
    const syllVal = wrap.querySelector(`[data-syll="${idx}"]`);
    const syllPill = wrap.querySelector(".syllPill");
    const beatEls = wrap.querySelectorAll(".beat");

    function refreshRhymesForCaret(){
      const text = ta.value || "";
      const caret = ta.selectionStart || 0;
      const beatIdx = caretBeatIndex(text, caret);
      const modeNow = p.autoSplitMode || "syllables";
      const b = computeBeats(text, modeNow);

      let prevText = "";
      if(beatIdx > 0){
        prevText = b[beatIdx-1] || "";
      }else{
        const prevBar = sec.bars[idx-1];
        if(prevBar && prevBar.text){
          const pb = computeBeats(prevBar.text, modeNow);
          prevText = pb[3] || pb[2] || pb[1] || pb[0] || "";
        }
      }
      updateRhymes(lastWord(prevText));
    }

    ta.addEventListener("focus", ()=>{
      focusedBarIdx = idx;
      refreshRhymesForCaret();
      updateDockForKeyboard();
    });
    ta.addEventListener("click", refreshRhymesForCaret);
    ta.addEventListener("keyup", refreshRhymesForCaret);

    ta.addEventListener("input", (e)=>{
      const text = e.target.value;
      bar.text = text;
      touchProject(p);

      const newN = countSyllablesLine(text);
      syllVal.textContent = newN ? String(newN) : "";
      syllPill.classList.remove("red","yellow","green");
      const g = syllGlowClass(newN);
      if(g) syllPill.classList.add(g);

      const modeNow = p.autoSplitMode || "syllables";
      const b = computeBeats(text, modeNow);
      for(let i=0;i<4;i++){
        beatEls[i].innerHTML = escapeHtml(b[i]||"");
      }

      refreshRhymesForCaret();
    });

    ta.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        e.preventDefault();
        const next = els.bars.querySelector(`textarea[data-idx="${idx+1}"]`);
        if(next) next.focus();
      }
    });

    els.bars.appendChild(wrap);
  });
}

function renderAll(){
  const p = getActiveProject();
  document.body.classList.toggle("fullMode", p.activeSection === "full");

  // header fields
  if(els.projectName) els.projectName.value = p.name || "";
  if(els.bpm) els.bpm.value = p.bpm || 95;
  if(els.highlightMode) els.highlightMode.value = p.highlightMode || "focused";
  if(els.autoSplitMode) els.autoSplitMode.value = p.autoSplitMode || "syllables";

  renderProjectPicker();
  renderTabs();
  renderBars();
  renderRecordings();

  if(els.statusText) els.statusText.textContent = " ";
  updateDockForKeyboard();
  updateRecordButtonUI();

  if(!(metroOn || recording)) stopEyePulse();
  else startEyePulseFromBpm();
}

// ---------- EXPORT (NEW): downloads 2 HTML files ----------
function safeFileName(name){
  const base = (name || "Beat Sheet Pro Export").trim() || "Beat Sheet Pro Export";
  return base.replace(/[^\w\s.-]+/g,"").replace(/\s+/g," ").trim();
}

function makeHtmlDoc(title, bodyText){
  const esc = escapeHtml(bodyText);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body{ font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; margin:16px; }
  h1{ font-size:20px; margin:0 0 10px; }
  .meta{ color:#555; font-size:12px; margin-bottom:14px; }
  pre{
    white-space:pre-wrap;
    word-wrap:break-word;
    border:1px solid rgba(0,0,0,.12);
    border-radius:14px;
    padding:12px;
    background:#fff;
    font-size:14px;
    line-height:1.35;
    font-weight:700;
  }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Exported: ${escapeHtml(new Date().toLocaleString())}</div>
  <pre>${esc}</pre>
</body>
</html>`;
}

function downloadTextAsFile(filename, text, mime="text/html"){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 6000);
}

function buildSplitExportText(p){
  // Same section headings, but each bar line becomes: b1 | b2 | b3 | b4
  const modeNow = p.autoSplitMode || "syllables";
  const out = [];
  for(const s of SECTION_DEFS){
    out.push(`[${s.title}]`);
    const sec = p.sections[s.key];
    for(const bar of (sec?.bars || [])){
      const raw = (bar.text || "").trim();
      if(!raw) continue;
      const beats = computeBeats(raw, modeNow).map(x => (x||"").trim());
      const line = beats.filter(Boolean).join(" | "); // vertical separators
      out.push(line);
    }
    out.push("");
  }
  return out.join("\n");
}

els.exportBtn?.addEventListener("click", ()=>{
  const p = getActiveProject();
  const name = safeFileName(p.name || "Beat Sheet Pro");

  // File A: Full export (same as Full view)
  const fullText = buildFullTextFromProject(p).trim() || "";
  const htmlA = makeHtmlDoc(`${name} — FULL`, fullText);
  downloadTextAsFile(`${name} - FULL.html`, htmlA);

  // File B: Split export (card split with |)
  const splitText = buildSplitExportText(p).trim() || "";
  const htmlB = makeHtmlDoc(`${name} — SPLIT`, splitText);
  downloadTextAsFile(`${name} - SPLIT.html`, htmlB);

  showToast("Exported 2 HTML files");
});

// ---------- events ----------
els.newProjectBtn?.addEventListener("click", ()=>{
  const p = newProject("");
  store.projects.unshift(p);
  store.activeProjectId = p.id;
  saveStore();
  renderAll();
  showToast("New project");
});

els.copyProjectBtn?.addEventListener("click", ()=>{
  const active = getActiveProject();
  const clone = JSON.parse(JSON.stringify(active));
  clone.id = uid();
  clone.name = (active.name || "Project") + " (copy)";
  clone.createdAt = nowISO();
  clone.updatedAt = nowISO();
  store.projects.unshift(repairProject(clone));
  store.activeProjectId = clone.id;
  saveStore();
  renderAll();
  showToast("Copied");
});

els.deleteProjectBtn?.addEventListener("click", ()=>{
  const active = getActiveProject();
  if(store.projects.length <= 1){
    showToast("Can't delete last project");
    return;
  }
  store.projects = store.projects.filter(p=>p.id !== active.id);
  store.activeProjectId = store.projects[0].id;
  saveStore();
  renderAll();
  showToast("Deleted");
});

els.projectPicker?.addEventListener("change", ()=>{
  const id = els.projectPicker.value;
  if(!id) return;
  if(store.projects.find(p=>p.id===id)){
    store.activeProjectId = id;
    saveStore();
    renderAll();
    showToast("Opened");
  }
});

els.projectName?.addEventListener("input", (e)=>{
  const p = getActiveProject();
  p.name = e.target.value || "";
  touchProject(p);
  renderProjectPicker(); // keep dropdown label updated
});

els.saveBtn?.addEventListener("click", ()=>{
  const p = getActiveProject();
  touchProject(p);
  showToast("Saved");
});

els.bpm?.addEventListener("change", ()=>{
  const p = getActiveProject();
  p.bpm = clampInt(parseInt(els.bpm.value,10), 40, 240);
  els.bpm.value = p.bpm;
  touchProject(p);
  if(metroOn) startMetronome();
  if(metroOn || recording) startEyePulseFromBpm();
});

els.highlightMode?.addEventListener("change", ()=>{
  const p = getActiveProject();
  p.highlightMode = els.highlightMode.value;
  touchProject(p);
});

els.autoSplitMode?.addEventListener("change", ()=>{
  const p = getActiveProject();
  p.autoSplitMode = els.autoSplitMode.value;
  touchProject(p);
  renderBars();
  showToast("Split mode");
});

els.metroBtn?.addEventListener("click", ()=>{
  if(metroOn) stopMetronome();
  else startMetronome();
});

els.recordBtn?.addEventListener("click", async ()=>{
  try{
    if(!recording) await startRecording();
    else stopRecording();
  }catch(err){
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
