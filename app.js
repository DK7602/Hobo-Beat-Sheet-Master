/* Beat Sheet Pro - app.js (FULL REPLACE v_IDB_AUDIO_ONE_PAGE_SWIPE_TRAP_RECORD_MIX_FIX_v2) */
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

  // upload
  mp3Btn: need("mp3Btn"),
  mp3Input: need("mp3Input"),

  // drums
  drum1Btn: need("drum1Btn"),
  drum2Btn: need("drum2Btn"),
  drum3Btn: need("drum3Btn"),
  drum4Btn: need("drum4Btn"),

  // projects
  projectPicker: need("projectPicker"),
  editProjectBtn: need("editProjectBtn"),
  newProjectBtn: need("newProjectBtn"),
  copyProjectBtn: need("copyProjectBtn"),
  deleteProjectBtn: need("deleteProjectBtn"),

  toast: need("toast"),
  statusText: need("statusText"),

  headerToggle: need("headerToggle"),
  headerToggle2: need("headerToggle2"),

  sectionTabs: need("sectionTabs"),
  bars: need("bars"),

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

/***********************
✅ SECTIONS
***********************/
const SECTION_DEFS = [
  { key:"verse1",  title:"Verse 1",  bars:16, extra:4 },
  { key:"chorus1", title:"Chorus 1", bars:12, extra:4 },
  { key:"verse2",  title:"Verse 2",  bars:16, extra:4 },
  { key:"chorus2", title:"Chorus 2", bars:12, extra:4 },
  { key:"verse3",  title:"Verse 3",  bars:16, extra:4 },
  { key:"bridge",  title:"Bridge",   bars: 8, extra:4 },
  { key:"chorus3", title:"Chorus 3", bars:12, extra:4 },
];

const FULL_ORDER = ["verse1","chorus1","verse2","chorus2","verse3","bridge","chorus3"];
const PAGE_ORDER = [...FULL_ORDER, "full"];
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
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
  }[c]));
}
function clampInt(v,min,max){
  if(Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}
function isCollapsed(){
  return document.body.classList.contains("headerCollapsed");
}
function getActiveProject(){ return store.projects.find(p=>p.id===store.activeProjectId) || store.projects[0]; }
function getProjectBpm(){
  const p = getActiveProject();
  return clampInt(parseInt(els.bpm?.value || p.bpm || 95, 10), 40, 240);
}

/***********************
✅ IndexedDB AUDIO
***********************/
const AUDIO_DB_NAME = `${KEY_PREFIX}audio_db_v1`;
const AUDIO_STORE = "audio";

function openAudioDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(AUDIO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(AUDIO_STORE)){
        db.createObjectStore(AUDIO_STORE, { keyPath:"id" });
      }
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

async function idbPutAudio({ id, blob, name, mime, createdAt }){
  const db = await openAudioDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).put({
      id,
      blob,
      name: name || "",
      mime: mime || (blob?.type || ""),
      createdAt: createdAt || nowISO()
    });
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
    tx.onabort = ()=>reject(tx.error);
  });
}

async function idbGetAudio(id){
  const db = await openAudioDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(AUDIO_STORE, "readonly");
    const req = tx.objectStore(AUDIO_STORE).get(id);
    req.onsuccess = ()=>resolve(req.result || null);
    req.onerror = ()=>reject(req.error);
  });
}

async function idbDeleteAudio(id){
  const db = await openAudioDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).delete(id);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
    tx.onabort = ()=>reject(tx.error);
  });
}

async function dataUrlToBlob(dataUrl){
  const res = await fetch(dataUrl);
  return await res.blob();
}

// migrate old stored dataUrl -> idb
async function ensureRecInIdb(rec){
  if(rec && rec.dataUrl && !rec.blobId){
    try{
      const blob = await dataUrlToBlob(rec.dataUrl);
      const id = rec.id || uid();
      await idbPutAudio({ id, blob, name: rec.name, mime: rec.mime || blob.type, createdAt: rec.createdAt });
      rec.blobId = id;
      rec.mime = rec.mime || blob.type || "audio/*";
      delete rec.dataUrl; // ✅ critical
      return true;
    }catch(e){
      console.error(e);
      return false;
    }
  }
  return false;
}

async function getRecBlob(rec){
  if(!rec) return null;
  if(rec.dataUrl){
    try{ return await dataUrlToBlob(rec.dataUrl); }catch{ return null; }
  }
  const id = rec.blobId || rec.id;
  if(!id) return null;

  try{
    const row = await idbGetAudio(id);
    return row?.blob || null;
  }catch(e){
    console.error(e);
    return null;
  }
}

/***********************
✅ safer save
***********************/
function saveStoreSafe(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  }catch(e){
    console.error(e);
    showToast("Storage full (audio not saved)");
    return false;
  }
}

/***********************
✅ headshot eye blink
***********************/
let eyePulseTimer = null;
let metroOn = false;
let recording = false;

function headerIsVisibleForEyes(){ return !document.body.classList.contains("headerCollapsed"); }
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
  if(!(metroOn || recording || playback.isPlaying)) return;

  const bpm = getProjectBpm();
  const intervalMs = 60000 / bpm;
  eyePulseTimer = setInterval(()=>flashEyes(), intervalMs);
}
window.updateBlinkTargets = window.updateBlinkTargets || function(){};

/***********************
✅ header collapse
***********************/
function loadHeaderCollapsed(){
  try{ return localStorage.getItem(HEADER_COLLAPSED_KEY) === "1"; }catch{ return false; }
}
function saveHeaderCollapsed(isCollapsed2){
  try{ localStorage.setItem(HEADER_COLLAPSED_KEY, isCollapsed2 ? "1" : "0"); }catch{}
}
function setHeaderCollapsed(isCol){
  document.body.classList.toggle("headerCollapsed", !!isCol);
  if(els.headerToggle)  els.headerToggle.textContent  = isCol ? "Show" : "Hide";
  if(els.headerToggle2) els.headerToggle2.textContent = isCol ? "Show" : "Hide";
  saveHeaderCollapsed(!!isCol);

  updateDockForKeyboard();
  if(isCol) stopEyePulse();
  else startEyePulseFromBpm();

  renderAll();
}
els.headerToggle?.addEventListener("click", ()=>setHeaderCollapsed(!isCollapsed()));
els.headerToggle2?.addEventListener("click", ()=>setHeaderCollapsed(!isCollapsed()));

/***********************
✅ Keep rhyme dock visible above keyboard (Android)
***********************/
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

/***********************
✅ rhyme dock hide/show
***********************/
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

/***********************
✅ syllables
***********************/
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

/***********************
✅ beat splitting
***********************/
function splitBySlashes(text){
  const parts = (text||"").split("/").map(s=>s.trim());
  return [parts[0]||"", parts[1]||"", parts[2]||"", parts[3]||""];
}
function splitWordIntoChunks(word){
  const raw = String(word);
  const cleaned = raw.replace(/[^A-Za-z']/g,"");
  if(!cleaned) return [raw];
  const groups = cleaned.match(/[aeiouy]+|[^aeiouy]+/gi) || [cleaned];
  const out = [];
  for(const g of groups){
    if(out.length && /^[^aeiouy]+$/i.test(g) && g.length <= 2) out[out.length-1] += g;
    else out.push(g);
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
    const rem2 = targets[b] - beatSyll[b];

    if(s <= rem2 || b === 3){
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
function computeBeats(text){
  if((text||"").includes("/")) return splitBySlashes(text);
  return autoSplitSyllablesClean(text);
}

/***********************
✅ rhymes
***********************/
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

/***********************
✅ projects
***********************/
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
    highlightMode: "all",
    recordings: [], // ✅ metadata only; audio blobs in IndexedDB
    sections: blankSections(),
  };
}
function loadStore(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const p = newProject("");
    const s = { activeProjectId: p.id, projects:[p] };
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }catch{}
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
  p.highlightMode = "all";

  p.recordings.forEach(r=>{
    if(r && r.kind === "backing") r.kind = "track";
    if(!r.kind) r.kind = "take";
    if(!r.blobId && r.id) r.blobId = r.blobId || r.id;
  });

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

function touchProject(p){
  p.updatedAt = nowISO();
  saveStoreSafe();
}

/***********************
✅ migrate old audio (dataUrl -> idb)
***********************/
async function migrateAllAudioOnce(){
  let changed = false;
  for(const p of store.projects){
    for(const rec of (p.recordings || [])){
      const did = await ensureRecInIdb(rec);
      if(did) changed = true;
    }
  }
  if(changed) saveStoreSafe();
}

/***********************
✅ project picker
***********************/
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

/***********************
✅ AUDIO ENGINE (metronome + record mix bus)
IMPORTANT FIX:
- Playback is now WebAudio BufferSource (NOT <audio> element)
- That guarantees the mp3/track is in the SAME graph as the mic
- MediaRecorder records recordDest.stream => includes mic + mp3 + metronome
***********************/
let audioCtx = null;
let metroGain = null;
let playbackGain = null;
let recordDest = null;

let metroTimer = null;
let metroBeat16 = 0;

let activeDrum = 1;

function ensureAudio(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    metroGain = audioCtx.createGain();
    metroGain.gain.value = 0.9;

    playbackGain = audioCtx.createGain();
    playbackGain.gain.value = 1.0;

    recordDest = audioCtx.createMediaStreamDestination();

    // user hears
    metroGain.connect(audioCtx.destination);
    playbackGain.connect(audioCtx.destination);

    // recorder hears
    metroGain.connect(recordDest);
    playbackGain.connect(recordDest);
  }
}

/***********************
✅ TRAP DRUMS (closed hat + kick + snare)
***********************/
function playKick(){
  ensureAudio();
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(155, t);
  o.frequency.exponentialRampToValueAtTime(52, t + 0.07);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.75, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  o.connect(g); g.connect(metroGain);
  o.start(t); o.stop(t + 0.13);
}

function playSnare(){
  ensureAudio();
  const t = audioCtx.currentTime;

  const bufferSize = Math.floor(audioCtx.sampleRate * 0.14);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const bp = audioCtx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800;
  bp.Q.value = 0.9;

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

  noise.connect(bp);
  bp.connect(g);
  g.connect(metroGain);

  noise.start(t);
  noise.stop(t + 0.16);
}

function playHat(atTime = null, amp = 0.18){
  ensureAudio();
  const t = atTime ?? audioCtx.currentTime;

  const bufferSize = Math.floor(audioCtx.sampleRate * 0.02);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.02, amp), t + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

  noise.connect(hp);
  hp.connect(g);
  g.connect(metroGain);

  noise.start(t);
  noise.stop(t + 0.02);
}

/* highlight ALWAYS ALL */
function flashBeats(beatInBar){
  const barEls = document.querySelectorAll(".bar");
  barEls.forEach(barEl=>{
    const beats = barEl?.querySelectorAll(".beat");
    if(!beats || beats.length < 4) return;
    beats.forEach(b=>b.classList.remove("flash"));
    beats[beatInBar]?.classList.add("flash");
    setTimeout(()=>beats.forEach(b=>b.classList.remove("flash")), 90);
  });
}

function drumButtons(){
  return [els.drum1Btn, els.drum2Btn, els.drum3Btn, els.drum4Btn].filter(Boolean);
}
function updateDrumButtonsUI(){
  const btns = drumButtons();
  btns.forEach((b, i)=>{
    b.classList.remove("active","running");
    if(metroOn) b.classList.add("running");
    if(metroOn && activeDrum === (i+1)) b.classList.add("active");
  });
}

function startMetronome(){
  ensureAudio();
  if(audioCtx.state === "suspended") audioCtx.resume();
  stopMetronome();

  metroOn = true;
  metroBeat16 = 0;
  startEyePulseFromBpm();
  updateDrumButtonsUI();

  const tick = () => {
    const bpm = getProjectBpm();
    const intervalMs = 60000 / bpm / 4;

    const step16 = metroBeat16 % 16;
    const beatInBar = Math.floor(step16 / 4);

    if(activeDrum === 1){
      playHat(null, (step16 % 4 === 2) ? 0.14 : 0.18);
      if(step16 === 0 || step16 === 7 || step16 === 10) playKick();
      if(step16 === 4 || step16 === 12) playSnare();

    }else if(activeDrum === 2){
      const t = audioCtx.currentTime;
      playHat(t, 0.17);
      if(step16 === 3 || step16 === 11){
        playHat(t + (intervalMs/1000)*0.5, 0.12);
      }
      if(step16 === 0 || step16 === 6 || step16 === 9 || step16 === 14) playKick();
      if(step16 === 4 || step16 === 12) playSnare();

    }else if(activeDrum === 3){
      const t = audioCtx.currentTime;
      playHat(t, (step16 % 2 === 0) ? 0.18 : 0.14);

      if(step16 === 14){
        playHat(t + (intervalMs/1000)*0.33, 0.12);
        playHat(t + (intervalMs/1000)*0.66, 0.12);
      }
      if(step16 === 0 || step16 === 5 || step16 === 8 || step16 === 13) playKick();
      if(step16 === 4 || step16 === 12) playSnare();

    }else{
      const t = audioCtx.currentTime;
      if(step16 % 2 === 0) playHat(t, 0.18);
      if(step16 === 7 || step16 === 15) playHat(t, 0.12);

      if(step16 === 0 || step16 === 7 || step16 === 11) playKick();
      if(step16 === 4 || step16 === 12) playSnare();
    }

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
  updateDrumButtonsUI();
  if(!(recording || playback.isPlaying)) stopEyePulse();
}
function handleDrumPress(which){
  if(!metroOn){
    activeDrum = which;
    startMetronome();
    showToast(`Trap ${which}`);
    return;
  }
  if(metroOn && activeDrum === which){
    stopMetronome();
    showToast("Stop");
    return;
  }
  activeDrum = which;
  updateDrumButtonsUI();
  showToast(`Trap ${which}`);
}

/***********************
✅ PLAYBACK (WebAudio buffer) + BPM SYNC HIGHLIGHT
Fix: guaranteed record mix includes MP3/track
***********************/
const decodedCache = new Map(); // key: blobId/id -> AudioBuffer

async function blobToArrayBuffer(blob){
  return await blob.arrayBuffer();
}
async function decodeBlobToBuffer(blob){
  ensureAudio();
  const ab = await blobToArrayBuffer(blob);
  return await new Promise((resolve, reject)=>{
    // Safari can be picky; keep callback form
    audioCtx.decodeAudioData(ab, resolve, reject);
  });
}

const playback = {
  isPlaying: false,
  recId: null,

  _buf: null,
  _src: null,
  _startTime: 0,
  _offset: 0, // seconds
  raf: null,
  lastBeat: -1,

  stop(fromEnded){
    if(this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.lastBeat = -1;

    if(this._src){
      try{ this._src.onended = null; }catch{}
      try{ this._src.stop(0); }catch{}
      try{ this._src.disconnect(); }catch{}
    }
    this._src = null;
    this._buf = null;
    this._offset = 0;
    this._startTime = 0;

    this.isPlaying = false;
    this.recId = null;

    renderRecordings();
    if(!(metroOn || recording)) stopEyePulse();
    if(fromEnded) showToast("Done");
  },

  _startSyncLoop(){
    const loop = () => {
      if(!this.isPlaying || !this._buf) return;

      const bpm = getProjectBpm();
      const t = Math.max(0, (audioCtx.currentTime - this._startTime) + this._offset);
      const beatPos = (t * bpm) / 60;
      const beatInBar = Math.floor(beatPos) % 4;

      if(beatInBar !== this.lastBeat){
        this.lastBeat = beatInBar;
        flashBeats(beatInBar);
      }

      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  async playRec(rec){
    ensureAudio();
    if(audioCtx.state === "suspended") await audioCtx.resume();

    // stop previous
    this.stop(false);

    this.recId = rec.id;
    this.lastBeat = -1;

    const blob = await getRecBlob(rec);
    if(!blob){
      showToast("Missing audio");
      this.recId = null;
      return;
    }

    const cacheKey = rec.blobId || rec.id;
    let buf = decodedCache.get(cacheKey);
    if(!buf){
      try{
        buf = await decodeBlobToBuffer(blob);
        decodedCache.set(cacheKey, buf);
      }catch(e){
        console.error(e);
        showToast("Can't decode audio");
        this.recId = null;
        return;
      }
    }

    this._buf = buf;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(playbackGain);

    src.onended = () => {
      // if user stopped, _src is null already
      if(this._src === src){
        this.stop(true);
      }
    };

    this._src = src;
    this._offset = 0;
    this._startTime = audioCtx.currentTime;

    this.isPlaying = true;
    startEyePulseFromBpm();

    try{
      src.start(0, this._offset);
    }catch(e){
      console.error(e);
      this.stop(false);
      showToast("Play failed");
      return;
    }

    this._startSyncLoop();
    renderRecordings();
  }
};

/***********************
✅ RECORDINGS helpers (download uses IDB blob)
***********************/
async function downloadRec(rec){
  try{
    const blob = await getRecBlob(rec);
    if(!blob){ showToast("Missing audio"); return; }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const safe = (rec.name || "take").replace(/[^\w\s.-]+/g,"").trim() || "take";
    const type = (rec.mime || blob.type || "").toLowerCase();

    const ext =
      type.includes("mpeg") ? "mp3" :
      type.includes("wav")  ? "wav" :
      type.includes("ogg")  ? "ogg" :
      type.includes("mp4")  ? "m4a" :
      type.includes("webm") ? "webm" :
      "audio";

    a.download = `${safe}.${ext}`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }catch(e){
    console.error(e);
    showToast("Download failed");
  }
}

/***********************
✅ MIC RECORDING (mic + metronome + MP3) -> saves blob to IDB
***********************/
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

  // mic -> record bus ONLY (no feedback to speakers)
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
  startEyePulseFromBpm();

  const mimeType = pickBestMime();
  const opts = {};
  if(mimeType) opts.mimeType = mimeType;
  opts.audioBitsPerSecond = 64000;

  // ✅ recordDest stream contains: playbackGain + metroGain + micGain
  recorder = new MediaRecorder(recordDest.stream, opts);

  recorder.ondataavailable = (e)=>{
    if(e.data && e.data.size > 0) recChunks.push(e.data);
  };

  recorder.onstop = async ()=>{
    recording = false;
    updateRecordButtonUI();
    if(metroOn) stopMetronome();
    if(!(metroOn || playback.isPlaying)) stopEyePulse();

    const blob = new Blob(recChunks, { type: recorder.mimeType || mimeType || "audio/webm" });
    const p = getActiveProject();

    const typed = takeNameFromInput();
    const name = typed || `Take ${new Date().toLocaleString()}`;

    const id = uid();
    try{
      await idbPutAudio({ id, blob, name, mime: blob.type, createdAt: nowISO() });
    }catch(e){
      console.error(e);
      showToast("Audio save failed");
      return;
    }

    const rec = { id, blobId: id, name, createdAt: nowISO(), mime: blob.type || "audio/webm", kind:"take" };
    p.recordings.unshift(rec);

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

/***********************
✅ Upload audio -> saves blob to IDB
***********************/
async function handleUploadFile(file){
  if(!file) return;
  const p = getActiveProject();

  const id = uid();
  const name = file.name || `Audio ${new Date().toLocaleString()}`;
  const mime = file.type || "audio/*";

  await idbPutAudio({ id, blob: file, name, mime, createdAt: nowISO() });

  // clear decode cache if same id reused (rare)
  decodedCache.delete(id);

  const rec = {
    id,
    blobId: id,
    name,
    createdAt: nowISO(),
    mime,
    kind: "track"
  };

  p.recordings.unshift(rec);
  touchProject(p);
  renderRecordings();
  showToast("Uploaded");
}

/***********************
✅ FULL editor helpers
***********************/
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

/***********************
✅ ONE-PAGE SWIPE (collapsed horizontal pager)
FIX v2: stops “flying” through multiple pages
- direction lock (only hijack when horizontal wins)
- prevent native momentum by preventing default earlier
- infinite recenter is disabled while dragging
***********************/
let pagesCopyWidth = 0;
let pageViewportW = 0;

function measurePager(pagerEl){
  const groups = pagerEl.querySelectorAll(".pageGroup");
  const mid = groups[1] || groups[0];
  if(mid){
    pagesCopyWidth = Math.round(mid.getBoundingClientRect().width);
    pageViewportW = Math.round(pagesCopyWidth / PAGE_ORDER.length);
    return;
  }
  const w = Math.round(pagerEl.clientWidth || pagerEl.getBoundingClientRect().width || 0);
  pageViewportW = Math.max(0, w);
  pagesCopyWidth = pageViewportW * PAGE_ORDER.length;
}
function getMidStart(pagerEl){
  const groups = pagerEl.querySelectorAll(".pageGroup");
  return (groups[1]?.offsetLeft) || pagesCopyWidth;
}
function getCurrentIdx(pagerEl){
  if(!pagesCopyWidth || !pageViewportW) measurePager(pagerEl);
  const midStart = getMidStart(pagerEl);
  const x = pagerEl.scrollLeft;
  const rel = ((x - midStart) % pagesCopyWidth + pagesCopyWidth) % pagesCopyWidth;
  let idx = Math.round(rel / pageViewportW);
  idx = Math.max(0, Math.min(PAGE_ORDER.length-1, idx));
  return idx;
}
function snapToIdx(pagerEl, idx, behavior="auto"){
  if(!pagesCopyWidth || !pageViewportW) measurePager(pagerEl);
  const midStart = getMidStart(pagerEl);
  idx = Math.max(0, Math.min(PAGE_ORDER.length-1, idx));
  const left = Math.round(midStart + idx * pageViewportW);
  pagerEl.scrollTo({ left, behavior });
}

function setupOnePageSwipe(pagerEl){
  // try to keep browser from doing its own fling
  pagerEl.style.touchAction = "pan-y";
  pagerEl.style.overscrollBehavior = "contain";
  pagerEl.style.webkitOverflowScrolling = "auto"; // iOS: reduce momentum
  pagerEl.style.scrollBehavior = "auto";

  let dragging = false;
  let horizontalLock = false;
  let startX = 0;
  let startY = 0;
  let startScroll = 0;
  let startIdx = 0;

  const setDragging = (v)=>{
    dragging = v;
    pagerEl.__bsDragging = v; // shared with infinite recenter + tab sync
  };

  const onStart = (clientX, clientY)=>{
    if(!pagesCopyWidth || !pageViewportW) measurePager(pagerEl);
    setDragging(true);
    horizontalLock = false;
    startX = clientX;
    startY = clientY;
    startScroll = pagerEl.scrollLeft;
    startIdx = getCurrentIdx(pagerEl);
    pagerEl.classList.add("dragging");
  };

  const onMove = (clientX, clientY, e)=>{
    if(!dragging) return;

    const dx = clientX - startX;
    const dy = clientY - startY;

    // direction lock: only hijack when horizontal wins
    if(!horizontalLock){
      if(Math.abs(dx) > Math.abs(dy) + 6){
        horizontalLock = true;
      }else{
        // let vertical scroll happen (don’t preventDefault)
        return;
      }
    }

    // we are handling horizontal now
    if(e && e.cancelable) e.preventDefault();
    pagerEl.scrollLeft = startScroll - dx;
  };

  const onEnd = (clientX)=>{
    if(!dragging) return;
    setDragging(false);
    pagerEl.classList.remove("dragging");

    const dx = clientX - startX;
    const threshold = Math.max(42, Math.round(window.innerWidth * 0.14));

    let target = startIdx;

    if(horizontalLock && Math.abs(dx) >= threshold){
      target = startIdx + (dx < 0 ? 1 : -1);
    }else{
      // snap back to nearest (but still enforce ±1)
      target = getCurrentIdx(pagerEl);
    }

    if(target > startIdx + 1) target = startIdx + 1;
    if(target < startIdx - 1) target = startIdx - 1;

    snapToIdx(pagerEl, target, "smooth");
  };

  // touch
  pagerEl.addEventListener("touchstart", (e)=>{
    if(!e.touches || !e.touches.length) return;
    const t = e.touches[0];
    onStart(t.clientX, t.clientY);
  }, { passive:true });

  pagerEl.addEventListener("touchmove", (e)=>{
    if(!e.touches || !e.touches.length) return;
    const t = e.touches[0];
    onMove(t.clientX, t.clientY, e);
  }, { passive:false });

  pagerEl.addEventListener("touchend", (e)=>{
    const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
    onEnd(t ? t.clientX : startX);
  }, { passive:true });

  // mouse
  pagerEl.addEventListener("mousedown", (e)=>{
    if(e.button !== 0) return;
    onStart(e.clientX, e.clientY);
  });

  window.addEventListener("mousemove", (e)=>{
    onMove(e.clientX, e.clientY, e);
  });

  window.addEventListener("mouseup", (e)=>{
    onEnd(e.clientX);
  });
}

/***********************
✅ INFINITE PAGES (3 groups) + one-page swipe snap
FIX v2:
- NO recenter while dragging
- NO activeSection “spam” while dragging
***********************/
function setupInfinitePager(pagerEl){
  requestAnimationFrame(()=>{
    measurePager(pagerEl);
    if(!pagesCopyWidth || !pageViewportW) return;

    const midStart = getMidStart(pagerEl);
    pagerEl.scrollLeft = midStart;

    let adjusting = false;

    pagerEl.addEventListener("scroll", ()=>{
      // do not recenter while user is dragging
      if(pagerEl.__bsDragging) return;
      if(adjusting) return;

      const midS = getMidStart(pagerEl);
      const x = pagerEl.scrollLeft;

      const limit = pagesCopyWidth * 0.92; // wider = fewer bounce loops

      if(x < midS - limit){
        adjusting = true;
        pagerEl.scrollLeft = x + pagesCopyWidth;
        requestAnimationFrame(()=>{ adjusting = false; });
        return;
      }
      if(x > midS + limit){
        adjusting = true;
        pagerEl.scrollLeft = x - pagesCopyWidth;
        requestAnimationFrame(()=>{ adjusting = false; });
        return;
      }
    }, { passive:true });

    setupOnePageSwipe(pagerEl);

    window.addEventListener("resize", ()=>{
      const idx = getCurrentIdx(pagerEl);
      measurePager(pagerEl);
      snapToIdx(pagerEl, idx, "auto");
    }, { passive:true });
  });
}

function scrollPagerToSection(pagerEl, key){
  if(!pagesCopyWidth || !pageViewportW) measurePager(pagerEl);
  const idx = PAGE_ORDER.indexOf(key);
  if(idx < 0) return;
  snapToIdx(pagerEl, idx, "auto");
}

/***********************
✅ tabs rendering
***********************/
function renderTabs(){
  const p = getActiveProject();
  if(!els.sectionTabs) return;
  els.sectionTabs.innerHTML = "";

  const items = [
    ...SECTION_DEFS.map(s => ({ key:s.key, title:s.title })),
    { key:"full", title:"Full" }
  ];

  for(const it of items){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab" + (p.activeSection === it.key ? " active" : "");
    btn.textContent = it.title;
    btn.dataset.key = it.key;
    btn.addEventListener("click", ()=>{
      p.activeSection = it.key;
      touchProject(p);
      renderAll();
    });
    els.sectionTabs.appendChild(btn);
  }
}

/***********************
✅ bar rendering helper
***********************/
function renderSectionBarsInto(p, sectionKey, mountEl){
  const sec = p.sections[sectionKey];
  if(!sec?.bars) return;

  sec.bars.forEach((bar, idx)=>{
    const wrap = document.createElement("div");
    wrap.className = "bar";

    const n = countSyllablesLine(bar.text||"");
    const glow = syllGlowClass(n);
    const beats = computeBeats(bar.text||"");

    wrap.innerHTML = `
      <div class="barTop">
        <div class="barLeft">
          <div class="barNum">${idx+1}</div>
          <div class="syllPill ${glow}">
            <span class="lbl">Syllables</span>
            <span class="val" data-syll="${sectionKey}:${idx}">${n ? n : ""}</span>
          </div>
        </div>
      </div>

      <textarea data-sec="${escapeHtml(sectionKey)}" data-idx="${idx}" placeholder="Type your bar. Optional: use / for beat breaks.">${escapeHtml(bar.text||"")}</textarea>

      <div class="beats">
        <div class="beat">${escapeHtml(beats[0]||"")}</div>
        <div class="beat snare">${escapeHtml(beats[1]||"")}</div>
        <div class="beat">${escapeHtml(beats[2]||"")}</div>
        <div class="beat snare">${escapeHtml(beats[3]||"")}</div>
      </div>
    `;

    const ta = wrap.querySelector("textarea");
    const syllVal = wrap.querySelector(`[data-syll="${sectionKey}:${idx}"]`);
    const syllPill = wrap.querySelector(".syllPill");
    const beatEls = wrap.querySelectorAll(".beat");

    function refreshRhymesForCaret(){
      const text = ta.value || "";
      const caret = ta.selectionStart || 0;
      const beatIdx = caretBeatIndex(text, caret);
      const b = computeBeats(text);

      let prevText = "";
      if(beatIdx > 0){
        prevText = b[beatIdx-1] || "";
      }else{
        const prevBar = sec.bars[idx-1];
        if(prevBar && prevBar.text){
          const pb = computeBeats(prevBar.text);
          prevText = pb[3] || pb[2] || pb[1] || pb[0] || "";
        }
      }
      updateRhymes(lastWord(prevText));
    }

    ta.addEventListener("focus", ()=>{
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

      const bb = computeBeats(text);
      for(let i=0;i<4;i++){
        beatEls[i].innerHTML = escapeHtml(bb[i]||"");
      }

      refreshRhymesForCaret();
    });

    ta.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        e.preventDefault();
        const next = mountEl.querySelector(`textarea[data-sec="${CSS.escape(sectionKey)}"][data-idx="${idx+1}"]`);
        if(next) next.focus();
      }
    });

    mountEl.appendChild(wrap);
  });
}

/***********************
✅ renderBars
***********************/
function renderBars(){
  const p = getActiveProject();
  if(!els.bars) return;

  if(isCollapsed()){
    els.bars.innerHTML = "";

    const pager = document.createElement("div");
    pager.className = "pager";
    pager.id = "pagesPager";

    for(let g=1; g<=3; g++){
      const group = document.createElement("div");
      group.className = "pageGroup";
      group.dataset.pagesGroup = String(g);

      for(const key of PAGE_ORDER){
        const page = document.createElement("div");
        page.className = "page";
        page.dataset.pageKey = key;

        if(key === "full"){
          page.innerHTML = `<div class="pageTitle">FULL</div>`;
          const box = document.createElement("div");
          box.className = "fullBox";
          box.innerHTML = `
            <div class="fullSub">
              Paste + edit. Rhymes follow the last word on the line above your cursor. Use "/" for manual beat breaks.
            </div>
            <textarea class="fullEditor" spellcheck="false"></textarea>
          `;
          page.appendChild(box);
          group.appendChild(page);
          continue;
        }

        const title = (SECTION_DEFS.find(s=>s.key===key)?.title || key).toUpperCase();
        page.innerHTML = `<div class="pageTitle">${escapeHtml(title)}</div>`;

        const mount = document.createElement("div");
        mount.style.display = "flex";
        mount.style.flexDirection = "column";
        mount.style.gap = "10px";

        renderSectionBarsInto(p, key, mount);
        page.appendChild(mount);
        group.appendChild(page);
      }

      pager.appendChild(group);
    }

    els.bars.appendChild(pager);

    const fullTa = els.bars.querySelector(".fullEditor");
    if(fullTa){
      fullTa.value = buildFullTextFromProject(p);

      let tmr = null;
      const commit = () => applyFullTextToProject(p, fullTa.value || "");
      const refresh = () => { updateRhymesFromFullCaret(fullTa); updateDockForKeyboard(); };

      refresh();

      fullTa.addEventListener("input", ()=>{
        if(tmr) clearTimeout(tmr);
        tmr = setTimeout(commit, 220);
        refresh();
      });
      fullTa.addEventListener("click", refresh);
      fullTa.addEventListener("keyup", refresh);
      fullTa.addEventListener("focus", refresh);
    }

    setupInfinitePager(pager);
    requestAnimationFrame(()=>scrollPagerToSection(pager, p.activeSection || "verse1"));

    pager.addEventListener("scroll", ()=>{
      if(pager.__bsDragging) return; // ✅ stop rapid updates while swiping
      if(!pagesCopyWidth || !pageViewportW) return;
      const idx = getCurrentIdx(pager);
      const key = PAGE_ORDER[idx];
      if(key && key !== p.activeSection){
        p.activeSection = key;
        touchProject(p);
      }
    }, { passive:true });

    return;
  }

  if(p.activeSection === "full"){
    const fullText = buildFullTextFromProject(p);
    els.bars.innerHTML = `
      <div class="fullBox">
        <div class="fullSub">
          Paste + edit. Rhymes follow the last word on the line above your cursor. Use "/" for manual beat breaks.
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

  els.bars.innerHTML = "";
  const mount = document.createElement("div");
  mount.id = "barsMount";
  mount.style.display = "flex";
  mount.style.flexDirection = "column";
  mount.style.gap = "10px";
  els.bars.appendChild(mount);

  renderSectionBarsInto(p, p.activeSection, mount);
}

/***********************
✅ recordings list (uses IDB)
***********************/
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
      save.addEventListener("click", async ()=>{
        const newName = (input.value || "").trim();
        rec.name = newName || rec.name || "Take";
        touchProject(p);

        try{
          const blob = await getRecBlob(rec);
          if(blob) await idbPutAudio({ id: rec.blobId || rec.id, blob, name: rec.name, mime: rec.mime, createdAt: rec.createdAt });
        }catch{}

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

    const isTrack = rec.kind === "track";
    const prefix = isTrack ? "🎵 " : "";

    const label = document.createElement("div");
    label.className = "audioLabel";
    label.textContent = prefix + (rec.name || (isTrack ? "Audio" : "Take"));

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
    const isThisPlaying = playback.isPlaying && playback.recId === rec.id;
    playBtn.textContent = isThisPlaying ? "…" : "▶";
    playBtn.addEventListener("click", async ()=>{
      try{
        await playback.playRec(rec);
        showToast("Play");
      }catch(e){
        console.error(e);
        showToast("Playback failed");
      }
    });

    const stopBtn = document.createElement("button");
    stopBtn.className = "iconBtn stop";
    stopBtn.title = "Stop";
    stopBtn.textContent = "■";
    stopBtn.addEventListener("click", ()=>{
      playback.stop(false);
      showToast("Stop");
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
    delBtn.addEventListener("click", async ()=>{
      try{
        if(playback.recId === rec.id) playback.stop(false);
        if(editingRecId === rec.id) editingRecId = null;

        const id = rec.blobId || rec.id;
        if(id) await idbDeleteAudio(id);

        decodedCache.delete(id);

        p.recordings = p.recordings.filter(r=>r.id !== rec.id);
        touchProject(p);
        renderRecordings();
        showToast("Deleted");
      }catch(e){
        console.error(e);
        showToast("Delete failed");
      }
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

/***********************
✅ renderAll
***********************/
function renderAll(){
  const p = getActiveProject();
  document.body.classList.toggle("fullMode", p.activeSection === "full");

  if(els.bpm) els.bpm.value = p.bpm || 95;

  renderProjectPicker();
  renderTabs();
  renderBars();
  renderRecordings();

  if(els.statusText) els.statusText.textContent = " ";
  updateDockForKeyboard();
  updateRecordButtonUI();
  updateDrumButtonsUI();

  if(!(metroOn || recording || playback.isPlaying)) stopEyePulse();
  else startEyePulseFromBpm();
}

/***********************
✅ EXPORT (unchanged)
***********************/
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
  const out = [];
  for(const s of SECTION_DEFS){
    out.push(`[${s.title}]`);
    const sec = p.sections[s.key];
    for(const bar of (sec?.bars || [])){
      const raw = (bar.text || "").trim();
      if(!raw) continue;
      const beats = computeBeats(raw).map(x => (x||"").trim());
      const line = beats.filter(Boolean).join(" | ");
      out.push(line);
    }
    out.push("");
  }
  return out.join("\n");
}

els.exportBtn?.addEventListener("click", ()=>{
  const p = getActiveProject();
  const name = safeFileName(p.name || "Beat Sheet Pro");

  const fullText = buildFullTextFromProject(p).trim() || "";
  const htmlA = makeHtmlDoc(`${name} — FULL`, fullText);
  downloadTextAsFile(`${name} - FULL.html`, htmlA);

  const splitText = buildSplitExportText(p).trim() || "";
  const htmlB = makeHtmlDoc(`${name} — SPLIT`, splitText);
  downloadTextAsFile(`${name} - SPLIT.html`, htmlB);

  showToast("Exported 2 HTML files");
});

/***********************
✅ events
***********************/
els.newProjectBtn?.addEventListener("click", ()=>{
  const p = newProject("");
  store.projects.unshift(p);
  store.activeProjectId = p.id;
  saveStoreSafe();
  playback.stop(false);
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
  saveStoreSafe();
  playback.stop(false);
  renderAll();
  showToast("Copied");
});

els.deleteProjectBtn?.addEventListener("click", async ()=>{
  const active = getActiveProject();
  if(store.projects.length <= 1){
    showToast("Can't delete last project");
    return;
  }

  playback.stop(false);

  try{
    for(const rec of (active.recordings || [])){
      const id = rec.blobId || rec.id;
      if(id) await idbDeleteAudio(id);
      decodedCache.delete(id);
    }
  }catch{}

  store.projects = store.projects.filter(p=>p.id !== active.id);
  store.activeProjectId = store.projects[0].id;
  saveStoreSafe();
  renderAll();
  showToast("Deleted");
});

els.projectPicker?.addEventListener("change", ()=>{
  const id = els.projectPicker.value;
  if(!id) return;
  if(store.projects.find(p=>p.id===id)){
    store.activeProjectId = id;
    saveStoreSafe();
    playback.stop(false);
    renderAll();
    showToast("Opened");
  }
});

// rename via Edit button (prompt)
els.editProjectBtn?.addEventListener("click", ()=>{
  const p = getActiveProject();
  const cur = (p.name || "").trim();
  const next = prompt("Project name:", cur);
  if(next === null) return;
  p.name = String(next || "").trim();
  touchProject(p);
  renderProjectPicker();
  showToast("Renamed");
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
  if(metroOn || recording || playback.isPlaying) startEyePulseFromBpm();
});

// drum buttons
els.drum1Btn?.addEventListener("click", ()=>handleDrumPress(1));
els.drum2Btn?.addEventListener("click", ()=>handleDrumPress(2));
els.drum3Btn?.addEventListener("click", ()=>handleDrumPress(3));
els.drum4Btn?.addEventListener("click", ()=>handleDrumPress(4));

// record button
els.recordBtn?.addEventListener("click", async ()=>{
  try{
    if(!recording) await startRecording();
    else stopRecording();
  }catch(err){
    console.error(err);
    showToast("Record failed (mic?)");
  }
});

/***********************
✅ Upload button wiring (IDB)
***********************/
els.mp3Btn?.addEventListener("click", ()=>{
  try{ els.mp3Input?.click?.(); }
  catch(e){ console.error(e); showToast("Upload failed"); }
});

els.mp3Input?.addEventListener("change", async (e)=>{
  try{
    const file = e.target.files?.[0];
    e.target.value = "";
    if(!file) return;
    await handleUploadFile(file);
  }catch(err){
    console.error(err);
    showToast("Upload failed");
  }
});

/***********************
✅ boot
***********************/
(async function boot(){
  setDockHidden(loadDockHidden());
  document.body.classList.toggle("headerCollapsed", loadHeaderCollapsed());

  await migrateAllAudioOnce();

  renderAll();
  updateRhymes("");
})();
})();
