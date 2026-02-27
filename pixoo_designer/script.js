// ==========================================
// PIXOO DESIGNER - FRANKENSTEIN multimodes portraits
// Base: V140 (wrap/align/line spacing + progress + PAGE YAML)
// Greffe: V144 (RAW image + sliders + dithering Pixoo 3-3-2)
// + FIX: sliders LaMetric par défaut (51 / 150)
// + FIX: synchro "Forcer YAML H" dès qu'on bouge H
// + AJOUT: boutons Center X / Center Y / Center XY
// + AJOUT: pushPreviewToHA (Preview composite 64x64 -> upload -> show_message)
// ==========================================
// Dossier HA où sont stockées les images (côté Home Assistant)
// /config/www/pixoo_media/ → /config/www/pixoo_designer/pixoo_media/
const SAVE_DIR_HA = "/config/www/pixoo_designer/pixoo_media/";

// Dossier HA où sont stockés les GIF cuits (MultiGif)
const SAVE_DIR_HA_GIF = "/config/www/pixoo_designer/pixoo_media_gif/";
// ----------------------------------------------------------
// 0) GLOBALS / CONFIG
// ----------------------------------------------------------
// L'IP stricte de Home Assistant (Vitale pour que le Pixoo arrive à télécharger les GIF)
const HA_LOCAL_IP = "192.168.1.92:8123";
// Zoom (taille d’affichage dans l’éditeur)
let ZOOM = 8;
const _multigifWarnedNoFilename = new Set();
// Dossier HA où sont stockées les images (côté Home Assistant)
///config/www/pixoo_media/ → /config/www/pixoo_designer/pixoo_media/
// Tous les composants posés sur le “board”
// ---------------------------
// MULTI PAGES (V1)
// ---------------------------
let pages = [
  {
    id: "page_1",
    name: "Page 1",
    duration: 15,
    enabled_template: "{{ is_state('input_boolean.pixoo_override','on') }}",
    comps: []
  }
];
// ----------------------------------------------------------
// THEMES & GRILLE (V4 : CSS Externe et Propre)
// ----------------------------------------------------------
let gridEnabled = false;

function initThemes() {
  // Plus d'injection CSS ici, tout est géré proprement dans style.css !
  const savedTheme = localStorage.getItem('pixoo_theme') || 'fallout';
  changeTheme(savedTheme);
}

function changeTheme(themeName) {
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('pixoo_theme', themeName);
  if (typeof gridEnabled !== 'undefined' && gridEnabled) renderCanvas();
}

function updateThemeFromSlider(val) {
  let t = 'fallout';
  if (val == 1) t = 'ha-dark';
  if (val == 2) t = 'ha-light';
  changeTheme(t);
  
  const lbl = document.getElementById('theme-label');
  if (lbl) {
    if (val == 0) lbl.innerText = "☢️ Fallout";
    if (val == 1) lbl.innerText = "🌙 HA Dark";
    if (val == 2) lbl.innerText = "☀️ HA Light";
  }
}

function toggleGrid() {
  gridEnabled = !gridEnabled;
  renderCanvas();
}

function changeTheme(themeName) {
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('pixoo_theme', themeName);
  if (gridEnabled) renderCanvas();
}

function updateThemeFromSlider(val) {
  let t = 'fallout';
  if (val == 1) t = 'ha-dark';
  if (val == 2) t = 'ha-light';
  changeTheme(t);
  
  const lbl = document.getElementById('theme-label');
  if (lbl) {
    if (val == 0) lbl.innerText = "☢️ Fallout";
    if (val == 1) lbl.innerText = "🌙 HA Dark";
    if (val == 2) lbl.innerText = "☀️ HA Light";
  }
}

function toggleGrid() {
  gridEnabled = !gridEnabled;
  renderCanvas();
}

function changeTheme(themeName) {
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('pixoo_theme', themeName);
  
  // Met à jour la liste déroulante si elle existe
  const sel = document.getElementById('theme-selector');
  if (sel) sel.value = themeName;
  
  // Si la grille est active, on force le redessin pour changer sa couleur en direct
  if (gridEnabled) renderCanvas();
}

function toggleGrid() {
  gridEnabled = !gridEnabled;
  renderCanvas();
}
let currentPageIndex = 0;

// Cache des entités Home Assistant (states + attributes)
let haEntities = [];

// Cache de la liste des icônes MDI
let mdiIconNames = [];

// Fonction pour récupérer le fichier officiel JSON
async function fetchMdiNames() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/Templarian/MaterialDesign/master/meta.json');
    if (res.ok) {
      const data = await res.json();
      mdiIconNames = data.map(icon => icon.name);
      logDebug(`✅ ${mdiIconNames.length} icônes MDI chargées !`);
    }
  } catch (e) {
    logDebug("Erreur lors du chargement de la liste MDI", "error");
  }
}


// Getter / setter pour garder la compatibilité avec le code existant
function getComps() {
  return pages[currentPageIndex].comps;
}
function setComps(arr) {
  pages[currentPageIndex].comps = arr;
}

// IMPORTANT : on garde "comps" pour ne rien casser
let comps = getComps();

function syncCompsRef() {
  comps = getComps();
}

// ID du composant sélectionné
let selectedId = null;

// Drag/Resize state
let drag = {
  active: false,
  resize: false,
  id: null,

  startClientX: 0,
  startClientY: 0,

  startX: 0,
  startY: 0,
  startW: 0,
  startH: 0,
};
// ------------------------------------------------
// Type de pages
// ------------------------------------------------
function injectPagePickerModal() {
  if (!document.getElementById('page-picker-modal')) {
    const d = document.createElement('div');
    d.id = 'page-picker-modal';
    d.className = 'retro-modal-window';
    d.style.display = 'none';
    d.style.zIndex = '100000';
    d.style.width = '550px';
    d.style.top = '150px';
    d.style.left = '50%';
    d.style.transform = 'translateX(-50%)';
    
    d.innerHTML = `
      <div class="retro-modal-header" id="page-picker-header">
        <span>>_ NOUVELLE PAGE : SÉLECTION DU TYPE</span>
        <button onclick="document.getElementById('page-picker-modal').style.display='none'" title="Fermer">[X]</button>
      </div>
      <div class="retro-modal-content" style="padding: 15px; background: #222;">
        <div style="color: #64ffda; font-size: 11px; margin-bottom: 15px; text-align: center;">Sélectionne le type de page à générer :</div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          
          <div class="tool-btn" style="text-align: left; padding: 10px; height: auto;" onclick="confirmAddPage('components')">
            <div style="color: #4af626; font-weight: bold; margin-bottom: 5px;"><i class="mdi mdi-view-dashboard"></i> Components</div>
            <div style="font-size: 9px; color: #aaa; white-space: normal; line-height: 1.4;">Page standard (Pixoo Designer). Textes, formes, images libres.</div>
          </div>

          <div class="tool-btn" style="text-align: left; padding: 10px; height: auto; border: 2px dashed #ff9800; color: #ff9800; background: rgba(255, 152, 0, 0.1);" onclick="confirmAddPage('multigif')">
            <div style="font-weight: bold; margin-bottom: 5px;"><i class="mdi mdi-layers"></i> MultiGif</div>
            <div style="font-size: 9px; color: #fff; white-space: normal; line-height: 1.4;">page gif animée totalement</div>
          </div>

          <div class="tool-btn" style="text-align: left; padding: 10px; height: auto;" onclick="confirmAddPage('clock')">
            <div style="color: #4af626; font-weight: bold; margin-bottom: 5px;"><i class="mdi mdi-clock-outline"></i> Clock</div>
            <div style="font-size: 9px; color: #aaa; white-space: normal; line-height: 1.4;">Horloges pré-intégrées (animées, différents styles).</div>
          </div>

          <div class="tool-btn" style="text-align: left; padding: 10px; height: auto;" onclick="confirmAddPage('weather')">
            <div style="color: #4af626; font-weight: bold; margin-bottom: 5px;"><i class="mdi mdi-weather-partly-cloudy"></i> Weather</div>
            <div style="font-size: 9px; color: #aaa; white-space: normal; line-height: 1.4;">Affichage météo plein écran (animé).</div>
          </div>

          <div class="tool-btn" style="text-align: left; padding: 10px; height: auto;" onclick="confirmAddPage('fuel')">
            <div style="color: #4af626; font-weight: bold; margin-bottom: 5px;"><i class="mdi mdi-gas-station"></i> Fuel</div>
            <div style="font-size: 9px; color: #aaa; white-space: normal; line-height: 1.4;">Prix des carburants (3 stations max).</div>
          </div>

          <div class="tool-btn" style="text-align: left; padding: 10px; height: auto;" onclick="confirmAddPage('image')">
            <div style="color: #4af626; font-weight: bold; margin-bottom: 5px;"><i class="mdi mdi-image"></i> Image</div>
            <div style="font-size: 9px; color: #aaa; white-space: normal; line-height: 1.4;">Affiche une seule image statique plein écran.</div>
          </div>

          <div class="tool-btn" style="text-align: left; padding: 10px; height: auto;" onclick="confirmAddPage('gif')">
            <div style="color: #4af626; font-weight: bold; margin-bottom: 5px;"><i class="mdi mdi-gif"></i> GIF</div>
            <div style="font-size: 9px; color: #aaa; white-space: normal; line-height: 1.4;">Joue un GIF animé en boucle plein écran.</div>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(d);
    dragElement(d, document.getElementById('page-picker-header'));
  }
}


// ----------------------------------------------------------
// 1) UI HELPERS (modals, reset, copy, debug toggle)
// ----------------------------------------------------------

function toggleDebug() {
  const d = document.getElementById('debug-console');
  if (d) d.style.display = (d.style.display === 'flex' ? 'none' : 'flex');
}

function openConfig() {
  const m = document.getElementById('config-modal');
  if (m) {
    m.style.display = 'flex';
    if (localStorage.getItem('ha_token')) {
      document.getElementById('ha-token').value = localStorage.getItem('ha_token');
    }
  }
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function copyCode() {
  const ta = document.getElementById('yaml-output');
  ta.select();
  document.execCommand('copy');
  showToast("Copié !");
}

function downloadProject() {
  showToast("Sauvegarde sur le serveur HA en cours...");
  backupSurHA(); // Déclenche uniquement le backup Home Assistant
}

function resetAll() {
  if (confirm("Tout effacer ?")) {
    pages[currentPageIndex].comps = []; // <-- FIX: On vide la vraie mémoire de la page
    syncCompsRef();                     // <-- FIX: On resynchronise la vue
    selectedId = null;
    renderCanvas();
    renderLayers();
    renderProps();
  }
}



// ----------------------------------------------------------
// 2) DEBUG (console flottante) + INIT
// ----------------------------------------------------------

// Log dans console + dans la fenêtre debug UI
function logDebug(msg, type = "info") {
  console.log("[LOG]", msg);
  const c = document.getElementById('debug-log'); // <-- C'était ici l'erreur !
  if (c) {
    const color = type === 'error' ? '#ff5252' : '#4af626'; // Vert néon au lieu de vert classique
    c.innerHTML += `<div class="log-line" style="color:${color}">[${new Date().toLocaleTimeString()}] ${msg}</div>`;
    c.scrollTop = c.scrollHeight;
  }
}

// Catch global errors
window.onerror = (msg) => { logDebug(`ERR: ${msg}`, 'error'); return false; };

// Boot
window.onload = function () {
  // fonts.js obligatoire
  if (typeof FONTS === 'undefined') { alert("ERREUR: fonts.js non chargé"); return; }
  
  initThemes();
  // Nettoyage ancien modal LaMetric s'il existe
  const oldModal = document.getElementById('lametric-modal');
  if (oldModal) oldModal.remove();

  // UI overlays
  if (!document.getElementById('debug-console')) injectDebugConsole(); 
  //injectZoomControls();
  injectLaMetricModal();
  injectMDIModal();
  injectGifPickerModal();
  injectPagePickerModal(); // <--- NOUVEAU !
  injectConfigModal();
  fetchMdiNames();
  //injectPageYamlButton();

  // HA connect auto si token déjà connu
  if (localStorage.getItem('ha_token')) checkHA();
  else logDebug("Token HA manquant");

  // events
  window.addEventListener('resize', autoFitZoom);

  // drag/drop fichiers
  document.body.ondragover = (e) => e.preventDefault();
  document.body.ondrop = dropHandler;

  // auto fit
  setTimeout(autoFitZoom, 500);

  // refresh HA states (pour preview sensors dans l’éditeur)
  setInterval(updateLiveStates, 5000);

  // initial render
  renderCanvas();
  renderLayers();
  logDebug("Frankenstein (sans graph) prêt ✅");
};



// ----------------------------------------------------------
// 3) KEYBOARD SHORTCUTS (déplacement / delete)
// ----------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (!selectedId || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const c = comps.find(x => x.id === selectedId);
  if (!c) return;

  const step = e.shiftKey ? 10 : 1;
  switch (e.key) {
    case 'ArrowUp': c.y -= step; break;
    case 'ArrowDown': c.y += step; break;
    case 'ArrowLeft': c.x -= step; break;
    case 'ArrowRight': c.x += step; break;
    case 'Backspace': // Ajout pour le Mac !
    case 'Delete': deleteComp(); return;
  }
  c.x = Math.round(c.x);
  c.y = Math.round(c.y);
  e.preventDefault();
  renderCanvas();
  renderProps();
});



// ----------------------------------------------------------
// 4) HOME ASSISTANT CONNECT + FETCH STATES
// ----------------------------------------------------------

async function checkHA() {
  let token = document.getElementById('ha-token')?.value?.trim() || localStorage.getItem('ha_token');
  if (!token) { showToast("Token vide", "error"); return; }
  logDebug("Connexion HA...");

  try {
    const res = await fetch('/api/states', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) {
      haEntities = await res.json();
      localStorage.setItem('ha_token', token);
      closeModal('config-modal');
      showToast("HA Connecté");
      logDebug(`HA OK: ${haEntities.length} entités`);
      renderCanvas();
    } else {
      showToast("Erreur Auth", "error");
      logDebug("Auth Failed: " + res.status, 'error');
    }
  } catch (e) {
    showToast("Erreur Réseau", "error");
    logDebug("Network Error", 'error');
  }
}

// Rafraîchit les états HA en arrière-plan
async function updateLiveStates() {
  const token = localStorage.getItem('ha_token');
  if (!token) return;
  try {
    const res = await fetch('/api/states', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) { haEntities = await res.json(); renderCanvas(); }
  } catch (e) { /* silence */ }
}

// Upload base64 (PNG) vers HA via ton pyscript
async function sendToHA(base64, filename) {
  const token = localStorage.getItem('ha_token');
  if (!token) return;
  logDebug("Upload vers HA...");
  await fetch('/api/services/pyscript/pixoo_upload_base64', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64_data: base64, filename })
  });
  logDebug("Upload OK: " + filename);
}

// Vider le dossier /config/www/pixoo_media/ (côté HA) via un pyscript
// Requiert un service pyscript.pixoo_clear_media (voir snippet plus bas)
async function cleanPixooMedia() {
  const token = localStorage.getItem('ha_token');
  if (!token) { showToast("Token HA manquant", "error"); return; }

  if (!confirm("Vider le dossier pixoo_media ?\n\nCela supprimera les PNG générés (saved_, upload_, layer_, composite_, lametric_).")) return;

  try {
    showToast("Nettoyage pixoo_media...");
    // correction de /api/services/pyscript/pixoo_clear_media
    const res = await fetch('/api/services/pyscript/pixoo_clean_pixoo_media', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory: SAVE_DIR_HA })
    });

    const txtRes = await res.text().catch(() => "");
    if (!res.ok) {
      logDebug(`cleanPixooMedia ERROR ${res.status}: ${txtRes}`, "error");
      showToast("Erreur nettoyage (voir debug)", "error");
      return;
    }

    logDebug("cleanPixooMedia OK");
    showToast("✅ Dossier vidé !");
  } catch (e) {
    logDebug("cleanPixooMedia exception: " + (e?.message || e), "error");
    showToast("Erreur nettoyage", "error");
  }
}




// ----------------------------------------------------------
// 5) CORE HELPERS (colors, text pixel fonts, wrapping)
// ----------------------------------------------------------

function hexToRgb(h) {
  if (!h || h.length < 7) return [254, 254, 254];
  let r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return (r > 250 && g > 250 && b > 250) ? [254, 254, 254] : [r, g, b];
}

// Clamp float between min/max
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// --- Text pixel perfect + gradient angle support ---
function drawTextPixelPerfect(ctx, txt, x, y, col, fontName, col2 = null, gradDir = "to bottom", gradAngleDeg = null) {
  const f = FONTS[fontName] || FONTS['PICO_8'];
  const rgb1 = hexToRgb(col);
  let cx = x;

  for (let char of (txt || "")) {
    const glyph = f[char] || f[char.toUpperCase()] || f['?'] || [0, 0, 0, 3];
    const w = glyph[glyph.length - 1];
    const pixels = glyph.slice(0, -1);
    const h = Math.ceil(pixels.length / w);

    let useAngle = (typeof gradAngleDeg === 'number' && isFinite(gradAngleDeg));
    let vx = 0, vy = 1;

    if (useAngle) {
      const rad = (gradAngleDeg % 360) * Math.PI / 180;
      vx = Math.cos(rad);
      vy = Math.sin(rad);
    } else {
      if (gradDir === "to right") { vx = 1; vy = 0; }
      else { vx = 0; vy = 1; }
    }

    const denomX = (w - 1 || 1), denomY = (h - 1 || 1);
    const p00 = (0 / denomX) * vx + (0 / denomY) * vy;
    const p10 = (1) * vx + (0 / denomY) * vy;
    const p01 = (0 / denomX) * vx + (1) * vy;
    const p11 = (1) * vx + (1) * vy;
    const pmin = Math.min(p00, p10, p01, p11);
    const pmax = Math.max(p00, p10, p01, p11);
    const prange = (pmax - pmin) || 1;

    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] === 1) {
        let lx = i % w, ly = Math.floor(i / w);

        if (col2) {
          const rgb2 = hexToRgb(col2);
          let nx = (lx / denomX), ny = (ly / denomY);
          let proj = nx * vx + ny * vy;
          let ratio = (proj - pmin) / prange;
          ratio = Math.max(0, Math.min(1, ratio));

          let r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * ratio);
          let g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * ratio);
          let b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * ratio);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = `rgb(${rgb1[0]},${rgb1[1]},${rgb1[2]})`;
        }
        ctx.fillRect(cx + lx, y + ly, 1, 1);
      }
    }
    cx += w + 1;
  }
}

// SHIFT+ENTER newline (dans le textarea)
function handleTextBoxKeydown(e) {
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      e.preventDefault();
      const t = e.target;
      const start = t.selectionStart ?? t.value.length;
      const end = t.selectionEnd ?? t.value.length;
      const v = t.value || "";
      t.value = v.slice(0, start) + "\n" + v.slice(end);
      const pos = start + 1;
      try { t.setSelectionRange(pos, pos); } catch (_) { }
      upd('content', t.value, false);
      renderCanvas();
    } else {
      e.preventDefault();
    }
  }
}

// Mesure largeur pixel d'une string dans une font pixel
function measureTextPixelWidth(txt, fontName) {
  const f = FONTS[fontName] || FONTS['PICO_8'];
  let w = 0;
  for (let char of (txt || "")) {
    const glyph = f[char] || f[char.toUpperCase()] || f['?'] || [0, 0, 0, 3];
    const gw = glyph[glyph.length - 1];
    w += gw + 1;
  }
  return Math.max(0, w - 1);
}

// Wrap mots selon maxWidthPx
function wrapTextPixelPerfect(txt, fontName, maxWidthPx) {
  txt = (txt ?? "").toString();
  const paragraphs = txt.split('\n');
  const outLines = [];
  const fits = (s) => measureTextPixelWidth(s, fontName) <= maxWidthPx;

  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p];

    if (para === "") {
      outLines.push("");
      continue;
    }

    const words = para.split(' ');
    let line = "";

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const test = line ? (line + " " + w) : w;

      if (fits(test)) {
        line = test;
      } else {
        if (line) outLines.push(line);

        if (!fits(w)) {
          let chunk = "";
          for (let ch of w) {
            const t2 = chunk + ch;
            if (fits(t2)) chunk = t2;
            else {
              if (chunk) outLines.push(chunk);
              chunk = ch;
            }
          }
          line = chunk;
        } else {
          line = w;
        }
      }
    }
    if (line) outLines.push(line);

    if (p < paragraphs.length - 1) outLines.push("");
  }

  return outLines;
}

// Draw wrapped text (align + line spacing + gradient)
function drawWrappedTextPixelPerfect(ctx, txt, x, y, maxWidthPx, col, fontName, align = "left",
  col2 = null, gradDir = "to bottom", gradAngleDeg = null, lineSpacingPx = 1) {

  const lineH = (fontName === 'ELEVEN_PIX' || fontName === 'CLOCK') ? 16 : 10;
  const lines = wrapTextPixelPerfect(txt, fontName, maxWidthPx);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lw = measureTextPixelWidth(line, fontName);

    let ox = 0;
    if (align === "center") ox = Math.round((maxWidthPx - lw) / 2);
    if (align === "right") ox = Math.round((maxWidthPx - lw));

    drawTextPixelPerfect(
      ctx,
      line,
      x + Math.max(0, ox),
      y + i * (lineH + (lineSpacingPx || 0)),
      col,
      fontName,
      col2,
      gradDir,
      gradAngleDeg
    );
  }

  return { lines_count: lines.length, line_height: lineH, line_spacing: (lineSpacingPx || 0) };
}



// ----------------------------------------------------------
// 6) IMAGE PIPELINE (RAW + SLIDERS + DITHER Pixoo 3-3-2)
// ----------------------------------------------------------

// Quantize RGB to Pixoo-like 3-3-2 (8 levels for R/G, 4 for B)
function quantizePixoo332(r, g, b) {
  const rq = Math.round((r / 255) * 7);
  const gq = Math.round((g / 255) * 7);
  const bq = Math.round((b / 255) * 3);
  return [
    Math.round((rq / 7) * 255),
    Math.round((gq / 7) * 255),
    Math.round((bq / 3) * 255),
  ];
}

// Dither Floyd-Steinberg + quantize 3-3-2 (SERPENTINE scan = moins d'artefacts)
function ditherFloydSteinbergPixoo(imageData) {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;

  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const idx = (x, y) => (y * w + x) * 4;

  for (let y = 0; y < h; y++) {
    const leftToRight = (y % 2 === 0);
    const xStart = leftToRight ? 0 : w - 1;
    const xEnd = leftToRight ? w : -1;
    const xStep = leftToRight ? 1 : -1;

    for (let x = xStart; x !== xEnd; x += xStep) {
      const i = idx(x, y);
      if (data[i + 3] === 0) continue;

      const oldR = data[i], oldG = data[i + 1], oldB = data[i + 2];
      const [newR, newG, newB] = quantizePixoo332(oldR, oldG, oldB);

      data[i] = newR; data[i + 1] = newG; data[i + 2] = newB;

      const errR = oldR - newR;
      const errG = oldG - newG;
      const errB = oldB - newB;

      const distribute = (xx, yy, factor) => {
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) return;
        const j = idx(xx, yy);
        if (data[j + 3] === 0) return;
        data[j]     = clamp255(data[j]     + errR * factor);
        data[j + 1] = clamp255(data[j + 1] + errG * factor);
        data[j + 2] = clamp255(data[j + 2] + errB * factor);
      };

      // Floyd-Steinberg coefficients
      // Normal (->) : (x+1,y)=7/16 ; (x-1,y+1)=3/16 ; (x,y+1)=5/16 ; (x+1,y+1)=1/16
      // Reverse (<-) : mirror horizontally
      if (leftToRight) {
        distribute(x + 1, y,     7 / 16);
        distribute(x - 1, y + 1, 3 / 16);
        distribute(x,     y + 1, 5 / 16);
        distribute(x + 1, y + 1, 1 / 16);
      } else {
        distribute(x - 1, y,     7 / 16);
        distribute(x + 1, y + 1, 3 / 16);
        distribute(x,     y + 1, 5 / 16);
        distribute(x - 1, y + 1, 1 / 16);
      }
    }
  }

  return imageData;
}

// ==========================================================
// PORTRAIT MODE (pré-traitement doux pour visages)
// ==========================================================
function preprocessPortrait(imageData) {
  const d = imageData.data;
  const clamp = (v) => (v < 0 ? 0 : (v > 255 ? 255 : v));

  // réglages "safe"
  const contrast = 1.10;  // un poil moins agressif
  const gamma = 0.95;     // moins "wash"
  const vibrance = 0.14;  // plus soft

  const applyContrast = (v) => (v - 128) * contrast + 128;
  const applyGamma = (v) => 255 * Math.pow(v / 255, gamma);

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;

    let r = d[i], g = d[i + 1], b = d[i + 2];

    r = applyGamma(clamp(applyContrast(r)));
    g = applyGamma(clamp(applyContrast(g)));
    b = applyGamma(clamp(applyContrast(b)));

    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const sat = (maxc - minc) / 255;

    const vib = vibrance * (1 - sat);
    r = r + (r - 128) * vib;
    g = g + (g - 128) * vib;
    b = b + (b - 128) * vib;

    d[i]     = clamp(Math.round(r));
    d[i + 1] = clamp(Math.round(g));
    d[i + 2] = clamp(Math.round(b));
  }
}

// ----------------------------------------------------------
// Ultra Custom (Gemini-like) : SmartBlur + Expo + Sat + Posterize + Sobel
// ----------------------------------------------------------
function ultraCustomPipeline(imageData, c) {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;

  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  const expo   = parseInt(c.uc_expo ?? 0, 10) || 0;        // -50..100
  const sat    = parseFloat(c.uc_sat ?? 1.0);              // 0..4
  const levels = parseInt(c.uc_levels ?? 16, 10) || 16;    // 2..16 (16 = quasi neutre)
  const edgeTh = parseInt(c.uc_edge ?? 200, 10) || 200;    // 10..200 (200 = quasi neutre)
  const smartR = parseInt(c.uc_smartblur ?? 0, 10) || 0;   // 0..6

  // 1) Smart blur (aplats) - réduit le bruit coloré
  if (smartR > 0) {
    applySmartBlurPixoo(data, w, h, smartR, 70);
  }

  // 2) Expo + Saturation (et luma pour Sobel)
  const luma = new Float32Array(w * h);
  const original = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    let r = data[i], g = data[i + 1], b = data[i + 2];

    // expo
    r = clamp(r + expo);
    g = clamp(g + expo);
    b = clamp(b + expo);

    // saturation
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = clamp(gray + (r - gray) * sat);
    g = clamp(gray + (g - gray) * sat);
    b = clamp(gray + (b - gray) * sat);

    data[i] = r; data[i + 1] = g; data[i + 2] = b;

    original[i] = r; original[i + 1] = g; original[i + 2] = b;
    luma[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // 3) Posterize (niveaux) : 16 = très léger
  if (levels >= 2 && levels <= 16) {
    const factor = 255 / (levels - 1);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      data[i]   = Math.round(data[i]   / factor) * factor;
      data[i+1] = Math.round(data[i+1] / factor) * factor;
      data[i+2] = Math.round(data[i+2] / factor) * factor;
    }
  }

  // 4) Sobel edges : edgeTh élevé = peu de contours (200 ~ neutre)
  if (edgeTh >= 10 && edgeTh <= 200) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = (y * w + x);
        const i = p * 4;

        const L = (yy, xx) => luma[(yy * w + xx)];
        const tl = L(y-1, x-1), tc = L(y-1, x), tr = L(y-1, x+1);
        const ml = L(y,   x-1),                 mr = L(y,   x+1);
        const bl = L(y+1, x-1), bc = L(y+1, x), br = L(y+1, x+1);

        const gx = -tl - 2*ml - bl + tr + 2*mr + br;
        const gy = -tl - 2*tc - tr + bl + 2*bc + br;
        const mag = Math.sqrt(gx*gx + gy*gy);

        if (mag > edgeTh) {
          // contour discret (assombrir légèrement)
          data[i]   = original[i]   * 0.55;
          data[i+1] = original[i+1] * 0.55;
          data[i+2] = original[i+2] * 0.55;
        }
      }
    }
  }

  return imageData;
}

// Smart blur (aplats) — version Pixoo
function applySmartBlurPixoo(data, width, height, radius, edgeTolerance) {
  const temp = new Uint8ClampedArray(data);
  const idx = (x, y) => (y * width + x) * 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y);
      if (temp[i + 3] === 0) continue;

      const r0 = temp[i], g0 = temp[i+1], b0 = temp[i+2];
      let sr = 0, sg = 0, sb = 0, count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const j = idx(nx, ny);
          if (temp[j + 3] === 0) continue;

          const r = temp[j], g = temp[j+1], b = temp[j+2];
          const diff = Math.abs(r0 - r) + Math.abs(g0 - g) + Math.abs(b0 - b);

          if (diff < edgeTolerance) {
            sr += r; sg += g; sb += b; count++;
          }
        }
      }

      if (count > 0) {
        data[i]   = sr / count;
        data[i+1] = sg / count;
        data[i+2] = sb / count;
      }
    }
  }
}

// Defaults "neutres" : Ultra Custom = image quasi identique de base
function initUltraCustomDefaults(c) {
  c.uc_zoom = 1;
  c.uc_panx = 50;
  c.uc_pany = 50;

  c.uc_expo = 0;        // neutre
  c.uc_smartblur = 0;   // neutre
  c.uc_sat = 1.0;       // neutre
  c.uc_levels = 16;     // quasi neutre (pas de gros aplats)
  c.uc_edge = 200;      // quasi neutre (peu de contours)
}

// Applique: seuil noir->alpha, saturation, dither
function applyImageFilters(id) {
  const c = comps.find(x => x.id == id);
  if (!c || !c.source) return;

  const img = new Image();
  img.crossOrigin = "Anonymous";

  img.onload = () => {
    const cvs = document.createElement('canvas');
    cvs.width = img.width;
    cvs.height = img.height;
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    // --- Ultra custom: crop/zoom/pan AVANT traitement ---
    if (c.freeze_mode === "ultra_custom") {
      const zoom = Math.max(1, parseFloat(c.uc_zoom ?? 1));
      const panX = (parseFloat(c.uc_panx ?? 50) / 100);
      const panY = (parseFloat(c.uc_pany ?? 50) / 100);

      const baseSize = Math.min(img.width, img.height);
      const cropSize = baseSize / zoom;

      const maxX = img.width - cropSize;
      const maxY = img.height - cropSize;

      const sx = maxX * panX;
      const sy = maxY * panY;

      ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, cvs.width, cvs.height);
    } else {
      ctx.drawImage(img, 0, 0);
    }

    const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
    const data = imageData.data;

    // 1) Ultra pipeline (si ultra_custom)
    if (c.freeze_mode === "ultra_custom") {
      ultraCustomPipeline(imageData, c);
    }

    // 2) Seuil noir -> alpha (utile dans tous les modes)
    const thresh = parseInt(c.black_threshold ?? 0, 10) || 0;
    if (thresh > 0) {
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        if ((data[i] + data[i + 1] + data[i + 2]) / 3 < thresh) {
          data[i + 3] = 0;
        }
      }
    }

    // 3) Saturation “simple” (uniquement hors ultra_custom, car ultra gère déjà sa sat)
    const satStd = (c.saturation !== undefined) ? (parseInt(c.saturation, 10) / 100) : 1;
    if (satStd !== 1 && c.freeze_mode !== "ultra_custom") {
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        let r = data[i], g = data[i + 1], b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * satStd;
        g = gray + (g - gray) * satStd;
        b = gray + (b - gray) * satStd;
        data[i]     = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }
    }

    // 4) Dither + quantize (Pixoo)
    ditherFloydSteinbergPixoo(imageData);

    ctx.putImageData(imageData, 0, 0);

    c.preview = cvs.toDataURL("image/png");
    renderCanvas();
  };

  img.src = c.source;
}

function applyImageFilters_IMG(id) {
  return applyImageFilters(id);
}

// -----------------------------------------------------------
// 7) Multipage
// -----------------------------------------------------------
function addPage() {
  // Au lieu de créer la page direct, on ouvre la modale
  const modal = document.getElementById('page-picker-modal');
  if (modal) modal.style.display = 'block';
}

function confirmAddPage(type) {
  document.getElementById('page-picker-modal').style.display = 'none';
  
  const n = pages.length + 1;
  pages.push({
    id: "page_" + Date.now(),
    name: "Page " + n + " (" + type + ")",
    page_type: type, // <--- On sauvegarde le type choisi !
    duration: 15,
    enabled_template: pages[0]?.enabled_template || "{{ is_state('input_boolean.pixoo_override','on') }}",
    comps: []
  });
  
  currentPageIndex = pages.length - 1;
  syncCompsRef();
  selectedId = null;
  
  // On met à jour l'UI
  renderPagesUI(); 
  renderCanvas();
  renderProps();
  generateYAML();
}

function duplicatePage() {
  const src = pages[currentPageIndex];
  const clone = JSON.parse(JSON.stringify(src));
  clone.id = "page_" + Date.now();
  clone.name = src.name + " (copy)";
  pages.splice(currentPageIndex + 1, 0, clone);
  currentPageIndex++;
  syncCompsRef();
  selectedId = null;
  
  renderPagesUI(); // <-- FIX : Met à jour la liste déroulante
  renderCanvas();
  renderProps();
  generateYAML();
}

function deletePage() {
  if (pages.length <= 1) {
    showToast("⚠️ Impossible: il faut au moins 1 page.", "error");
    return;
  }
  pages.splice(currentPageIndex, 1);
  currentPageIndex = Math.max(0, currentPageIndex - 1);
  syncCompsRef();
  selectedId = null;
  
  renderPagesUI(); // <-- FIX : Met à jour la liste déroulante
  renderCanvas();
  renderProps();
  generateYAML();
}
// Sauvegarde les paramètres spécifiques à une page (ex: clockId)
function updatePageConfig(key, value) {
  const page = pages[currentPageIndex];
  page.config = page.config || {};
  page.config[key] = value;
  renderCanvas();
  renderProps();
  generateYAML();
}

function gotoPage(idx) {
  if (idx < 0 || idx >= pages.length) return;
  currentPageIndex = idx;
  syncCompsRef();
  selectedId = null;
  
  renderPagesUI(); // <-- FIX : Met à jour le compteur de pages
  renderCanvas();
  renderProps();
  generateYAML();
}

function renameCurrentPage(newName) {
  pages[currentPageIndex].name = (newName || "").trim() || `Page ${currentPageIndex + 1}`;
  renderPagesUI();
}

function setCurrentPageDuration(v) {
  pages[currentPageIndex].duration = Number(v || 15);
  generateYAML();
}

function setCurrentPageEnabledTemplate(v) {
  pages[currentPageIndex].enabled_template = v || "";
  generateYAML();
}

// ----------------------------------------------------------
// 7B) RENDER pages created (board DOM) + YAML generation
// ----------------------------------------------------------
function renderPagesUI() {
  const counter = document.getElementById("pm-counter");
  if (counter) {
  counter.innerText = `Page ${currentPageIndex+1} / ${pages.length}`;
  }
  const sel = document.getElementById("pages-select");
  const inpName = document.getElementById("page-name");
  const inpDur = document.getElementById("page-duration");
  if (!sel) return;

  sel.innerHTML = pages.map((p, i) =>
    `<option value="${i}" ${i === currentPageIndex ? "selected" : ""}>${i+1}. ${p.name}</option>`
  ).join("");

  if (inpName) inpName.value = pages[currentPageIndex].name || "";
  if (inpDur) inpDur.value = pages[currentPageIndex].duration || 15;
}

function injectConfigModal() {
  if (!document.getElementById('config-modal')) {
    const d = document.createElement('div');
    d.id = 'config-modal';
    d.className = 'retro-modal-window';
    d.style.display = 'none';
    d.style.width = '400px';
    d.style.height = 'auto';
    d.style.top = '150px';
    d.style.left = '50%';
    d.style.transform = 'translateX(-50%)';
    d.style.zIndex = '100000';
    
    d.innerHTML = `
      <div class="retro-modal-header" id="config-modal-header">
        <span>>_ CONFIGURATION HOME ASSISTANT</span>
        <button onclick="document.getElementById('config-modal').style.display='none'" title="Fermer">[X]</button>
      </div>
      <div class="retro-modal-content" style="padding: 20px; background: var(--panel); text-align: center;">
        <div style="font-size: 11px; color: var(--muted); margin-bottom: 15px; line-height: 1.4;">
          Génère un jeton d'accès longue durée dans ton profil Home Assistant et colle-le ici pour autoriser l'envoi des images.
        </div>
        <input type="password" id="ha-token" class="ctl" style="width: 100%; margin-bottom: 15px;" placeholder="eyJh..." />
        <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="checkHA()">
          <i class="mdi mdi-connection"></i> TESTER LA CONNEXION & SAUVEGARDER
        </button>
      </div>
    `;
    document.body.appendChild(d);
    
    // Rendre la modale déplaçable
    if (typeof dragElement === 'function') {
      dragElement(d, document.getElementById('config-modal-header'));
    }
  }
}
// ----------------------------------------------------------
// 7C) RENDER (board DOM) + YAML generation
// ----------------------------------------------------------

// Throttle YAML (évite spam + lag pendant drag/resize)
let _yamlTimer = null;
function scheduleYAMLUpdate() {
  clearTimeout(_yamlTimer);
  _yamlTimer = setTimeout(() => {
    try { generateYAML(); } catch (e) { console.warn("generateYAML() failed:", e); }
  }, 80);
}

function renderCanvas() {
  const b = document.getElementById('pixoo-board');
  if (!b) return;

  b.innerHTML = '';
  const size = 64 * ZOOM;
  b.style.width = size + 'px';
  b.style.height = size + 'px';
  b.style.backgroundSize = `${ZOOM}px ${ZOOM}px`;

  // ==== DÉBUT DE LA GRILLE ====
  if (gridEnabled) {
    b.style.backgroundImage = `linear-gradient(to right, var(--grid-color) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-color) 1px, transparent 1px)`;
  } else {
    b.style.backgroundImage = 'none';
  }
  // ==== FIN DE LA GRILLE ====

  // ==== DÉBUT DU MODE CAMÉLÉON ====
  const page = pages[currentPageIndex];
  const isComponents = (page.page_type === 'components' || page.page_type === 'multigif' || !page.page_type);

  if (!isComponents) {
    const overlay = document.createElement('div');
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.flexDirection = 'column';
    overlay.style.backgroundColor = '#111';
    overlay.style.color = '#4af626';
    overlay.style.fontFamily = 'Roboto Mono, monospace';
    overlay.style.textAlign = 'center';
    
    let icon = 'apps';
    if (page.page_type === 'clock') icon = 'clock-outline';
    if (page.page_type === 'weather') icon = 'weather-partly-cloudy';
    if (page.page_type === 'fuel') icon = 'gas-station';
    if (page.page_type === 'image') icon = 'image';
    if (page.page_type === 'gif') icon = 'gif';
    
    let subtext = `PAGE ${page.page_type.toUpperCase()}`;
    if (page.page_type === 'clock' && page.config?.clockId) subtext = `HORLOGE ID : ${page.config.clockId}`;
    if ((page.page_type === 'image' || page.page_type === 'gif') && page.config?.image_path) subtext = `FICHIER LIÉ`;

    // ✅ NOUVEAU : Affichage du fichier Image ou GIF directement sur le Canvas !
    if ((page.page_type === 'gif' || page.page_type === 'image') && page.config?.image_path) {
      let previewUrl = page.config.image_path;
      // On traduit le chemin serveur (config/www) en lien lisible par le navigateur (/local)
      if (previewUrl.startsWith('/config/www/')) {
        previewUrl = previewUrl.replace('/config/www/', '/local/');
      }
      overlay.innerHTML = `<img src="${previewUrl}?v=${Date.now()}" style="width:100%; height:100%; object-fit:contain; image-rendering:pixelated;">`;
    } else {
      // Icône par défaut si pas de fichier
      overlay.innerHTML = `<i class="mdi mdi-${icon}" style="font-size:${30 * (ZOOM/8)}px; margin-bottom:10px;"></i><div style="font-size:${10 * (ZOOM/8)}px">${subtext}</div>`;
    }

    b.appendChild(overlay);
    scheduleYAMLUpdate();
    return; // Stoppe le rendu normal
  }
  // ==== FIN DU MODE CAMÉLÉON ====

  comps.forEach((c, idx) => {
    const el = document.createElement('div');
    el.className = `component ${c.id === selectedId ? 'selected' : ''}`;
    el.style.left = (Math.round(c.x) * ZOOM) + 'px';
    el.style.top  = (Math.round(c.y) * ZOOM) + 'px';
    el.style.zIndex = (idx + 10);

    // IMPORTANT: seul le conteneur capture la souris
    el.style.pointerEvents = "auto";
    el.style.cursor = "move";
    el.style.userSelect = "none";

    // Click = select + drag
    el.onmousedown = (e) => {
      // seulement clic gauche
      if (e.button !== 0) return;

      // sécurité: si un input/select/etc se retrouve dans le composant un jour
      const tag = e.target?.tagName;
      if (tag && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'LABEL'].includes(tag)) return;

      e.stopPropagation();
      e.preventDefault();

      select(c.id);
      startDrag(e, c.id);
    };

    // ---------------------------
    // A) IMAGE PREVIEW (image/lametric)
    // ---------------------------
    if (c.preview && (c.type === 'image' || c.type === 'lametric')) {
      el.style.width  = ((Math.round(c.w) || 16) * ZOOM) + 'px';
      el.style.height = ((Math.round(c.h) || 16) * ZOOM) + 'px';
      if (c.use_absolute_position) el.style.border = "1px solid #00e676";

      const img = document.createElement('img');
      img.src = c.preview;
      img.draggable = false;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.imageRendering = "pixelated";

      // CRITIQUE: ne doit jamais capter la souris
      img.style.pointerEvents = "none";

      el.appendChild(img);
    }

    // ---------------------------
    // B) TEXT / SENSOR / DATETIME => rendu canvas pixel
    // ---------------------------
    else if (['text', 'sensor', 'datetime'].includes(c.type)) {
      const cvs = document.createElement('canvas');
      const maxW = 64;

      let val = c.content || "";

      if (c.type === 'sensor') {
        const ent = haEntities.find(e => e.entity_id === c.entity);
        if (ent) {
          const n = parseFloat(ent.state);
          if (isFinite(n)) val = n.toFixed(c.precision || 0);
          else val = (ent.state ?? '').toString();
          if (c.show_unit) val += " " + (ent.attributes.unit_of_measurement || "");
        } else {
          val = '{VAL}';
        }
      }

      if (c.type === 'datetime') {
        val = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }

      const lineH = (c.font === 'ELEVEN_PIX' || c.font === 'CLOCK') ? 16 : 10;
      const ls = (isFinite(c.line_spacing) ? c.line_spacing : 1);

      const lines = wrapTextPixelPerfect(val, c.font, maxW);
      const hpx = Math.min(64, (lines.length * (lineH + ls)) - ls);

      cvs.width = 64;
      cvs.height = Math.max(lineH, hpx);

      const ctx = cvs.getContext('2d');

      drawWrappedTextPixelPerfect(
        ctx,
        val,
        0,
        0,
        64,
        c.color,
        c.font,
        c.text_align || "left",
        c.grad_active ? c.color2 : null,
        c.grad_dir,
        c.grad_angle,
        ls
      );

      cvs.style.width = (64 * ZOOM) + 'px';
      cvs.style.height = (cvs.height * ZOOM) + 'px';
      cvs.style.imageRendering = 'pixelated';

      // CRITIQUE: canvas ne doit pas capter la souris
      cvs.style.pointerEvents = "none";

      el.appendChild(cvs);
    }

    // ---------------------------
    // C) ICON / WEATHER (mdi preview DOM)
    // ---------------------------
    else if (['weather', 'icon'].includes(c.type)) {
      el.style.width  = (Math.round(c.w) * ZOOM) + 'px';
      el.style.height = (Math.round(c.h) * ZOOM) + 'px';
      el.style.color = c.color;

      const icon = document.createElement("i");
      icon.className = `mdi mdi-${c.type === 'weather' ? 'weather-partly-cloudy' : c.content}`;
      icon.style.fontSize = (Math.min(c.w, c.h) * ZOOM) + "px";
      icon.style.display = "flex";
      icon.style.justifyContent = "center";
      icon.style.alignItems = "center";
      icon.style.width = "100%";
      icon.style.height = "100%";
      icon.style.lineHeight = "1";

      // CRITIQUE: l’icône ne doit pas capter la souris
      icon.style.pointerEvents = "none";

      el.appendChild(icon);
    }

    // ---------------------------
    // D) PROGRESS (canvas)
    // ---------------------------
    else if (c.type === 'progress') {
      const cvs = document.createElement('canvas');
      cvs.width = Math.round(c.w);
      cvs.height = Math.round(c.h);
      const ctx = cvs.getContext('2d');

      ctx.fillStyle = c.bg_color || "#333333";
      ctx.fillRect(0, 0, c.w, c.h);

      let val = 50;
      const ent = haEntities.find(e => e.entity_id === c.entity);
      if (ent && !isNaN(parseFloat(ent.state))) val = parseFloat(ent.state);

      const min = parseFloat(c.min) || 0;
      const max = parseFloat(c.max) || 100;
      const pct = (max - min) === 0 ? 0 : Math.max(0, Math.min(1, (val - min) / (max - min)));

      if (c.conditional_color) {
        ctx.fillStyle = (val < c.threshold) ? c.color_low : c.color_high;
      } else {
        ctx.fillStyle = c.color;
      }

      ctx.fillRect(0, 0, Math.round(c.w * pct), c.h);

      cvs.style.width = (Math.round(c.w) * ZOOM) + 'px';
      cvs.style.height = (Math.round(c.h) * ZOOM) + 'px';
      cvs.style.imageRendering = 'pixelated';

      // CRITIQUE: canvas ne doit pas capter la souris
      cvs.style.pointerEvents = "none";

      el.appendChild(cvs);
    }

    // ---------------------------
    // E) SHAPES (rect, round_rect, circle)
    // ---------------------------
    else {
      el.style.width = (Math.round(c.w) * ZOOM) + 'px';
      el.style.height = (Math.round(c.h) * ZOOM) + 'px';

      let bg = c.color;

      if (c.grad_active) {
        const fn = c.grad_type === 'linear' ? 'linear-gradient' : 'radial-gradient';
        const dir = c.grad_type === 'linear'
          ? (c.grad_dir === 'to bottom' ? 'to bottom' : 'to right')
          : 'circle';
        bg = `${fn}(${dir}, ${c.color}, ${c.color2})`;
      }

      el.style.background = bg;

      if (c.type === 'circle') el.style.borderRadius = '50%';
      if (c.radius > 0) el.style.borderRadius = (Math.round(c.radius) * ZOOM) + 'px';

      if (!c.filled && c.type !== 'progress') {
        el.style.background = 'transparent';
        el.style.boxShadow = `inset 0 0 0 ${1 * ZOOM}px ${c.color}`;
      }
    }

    // ---------------------------
    // Resizer handle (uniquement non-text)
    // ---------------------------
    if (c.id === selectedId && !['text', 'sensor', 'datetime'].includes(c.type)) {
      const r = document.createElement('div');
      r.className = 'resizer';
      r.style.zIndex = 9999;
      r.style.pointerEvents = "auto";

      // IMPORTANT: empêcher le drag du parent quand on resize
      r.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        startResize(e, c.id);
      };

      el.appendChild(r);
    }

    b.appendChild(el);
  });
  // ==== DÉBUT DE LA GRILLE (EN OVERLAY PAR DESSUS TOUT) ====
  if (typeof gridEnabled !== 'undefined' && gridEnabled) {
    const gridOverlay = document.createElement('div');
    gridOverlay.style.position = 'absolute';
    gridOverlay.style.top = '0';
    gridOverlay.style.left = '0';
    gridOverlay.style.width = '100%';
    gridOverlay.style.height = '100%';
    gridOverlay.style.pointerEvents = 'none'; // IMPORTANT: Laisse passer la souris !
    gridOverlay.style.zIndex = '999999';      // IMPORTANT: Au-dessus de tous les composants
    gridOverlay.style.backgroundImage = `linear-gradient(to right, var(--grid-color) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-color) 1px, transparent 1px)`;
    gridOverlay.style.backgroundSize = `${ZOOM}px ${ZOOM}px`;
    b.appendChild(gridOverlay);
  }
  // ==== FIN DE LA GRILLE ====
  // Au lieu de generateYAML() direct (spam / lag), on throttle
  scheduleYAMLUpdate();
}

// ----------------------------------------------------------
// 8) DRAG / RESIZE ENGINE (FIX)
// ----------------------------------------------------------

// ----------------------------------------------------------
// 8) DRAG / RESIZE ENGINE  (FIXED: client vs grid coords)
// ----------------------------------------------------------

function startDrag(e, id) {
  e.preventDefault();
  e.stopPropagation();

  const c = comps.find(x => x.id == id);
  if (!c) return;

  drag.active = true;
  drag.resize = false;
  drag.id = id;

  drag.startClientX = e.clientX;
  drag.startClientY = e.clientY;

  drag.startX = c.x;
  drag.startY = c.y;

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', stopDrag, true);
}

function startResize(e, id) {
  e.preventDefault();
  e.stopPropagation();

  const c = comps.find(x => x.id == id);
  if (!c) return;

  drag.active = true;
  drag.resize = true;
  drag.id = id;

  drag.startClientX = e.clientX;
  drag.startClientY = e.clientY;

  drag.startW = c.w;
  drag.startH = c.h;

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', stopDrag, true);
}

function stopDrag(e) {
  drag.active = false;
  drag.resize = false;
  drag.id = null;

  document.removeEventListener('mousemove', onMove, true);
  document.removeEventListener('mouseup', stopDrag, true);
}

function onMove(e) {
  if (!drag.active) return;

  const c = comps.find(x => x.id == drag.id);
  if (!c) return;

  const dx = Math.round((e.clientX - drag.startClientX) / ZOOM);
  const dy = Math.round((e.clientY - drag.startClientY) / ZOOM);

  if (drag.resize) {
    c.w = Math.max(1, drag.startW + dx);

    if (c.lock_ratio) {
      c.h = Math.max(1, c.w);
    } else {
      c.h = Math.max(1, drag.startH + dy);
    }
  } else {
    c.x = Math.round(drag.startX + dx);
    c.y = Math.round(drag.startY + dy);

    // optionnel: clamp dans le 64x64
    c.x = Math.max(0, Math.min(63, c.x));
    c.y = Math.max(0, Math.min(63, c.y));
  }

  renderCanvas();
  renderProps();
}
// ----------------------------------------------------------
// 9) FREEZE ENGINE (convertir un composant en PNG uploadé)
// ----------------------------------------------------------

async function freezeCompToLayer() {
  const c = comps.find(x => x.id === selectedId);
  if (!c) return;

  showToast("Sauvegarde PNG...");
  // A) IMAGE / LAMETRIC => cuire preview actuel
  if (c.type === 'image' || c.type === 'lametric') {
    const cvs = document.createElement('canvas');
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = async () => {
      cvs.width = img.width;
      cvs.height = img.height;

      ctx.clearRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);

      // ===============================
      // IMAGE : modes de figer
      // ===============================
      if (c.type === 'image') {

        const mode = c.freeze_mode || "none";

        // CLEAN = Pixoo safe uniquement
        if (mode === "clean") {
          cleanCanvasPixels(ctx, img.width, img.height);
        }
        // ULTRA CUSTOM live pipeline (avant dither)
        //if (c.freeze_mode === "ultra_custom") {
        //  ultraCustomPipeline(imageData, c);
        //}
        // PREMIUM = Floyd + quantize 3-3-2
        else if (mode === "premium") {
          const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
          ditherFloydSteinbergPixoo(imageData);
          ctx.putImageData(imageData, 0, 0);
        }

        // PORTRAIT = preprocess doux + Floyd
        else if (mode === "portrait") {
          const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);

          preprocessPortrait(imageData);
          ditherFloydSteinbergPixoo(imageData);

          ctx.putImageData(imageData, 0, 0);
        }

        // ultra_custom = pipeline “aplats anime” (8 sliders live)
        else if (mode === "ultra_custom") {
          const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);

          preprocessUltraCustom(imageData, c);

          ctx.putImageData(imageData, 0, 0);
        }

        // mode "none" => aucun retraitement
      }
        
      // ===============================
      // LAMETRIC : comportement original
      // ===============================
      if (c.type === 'lametric') {
        cleanCanvasPixels(ctx, img.width, img.height);
      }

      const base64 = cvs.toDataURL("image/png");
      const name = `saved_${Date.now()}.png`;
      await sendToHA(base64, name);

      c.type = 'image';
      c.filename = name;
      c.preview = base64;
      c.source = base64;

      // reset filtres
      c.black_threshold = 0;
      c.saturation = 100;

      renderCanvas();
      renderProps();
      showToast("Image Sauvegardée !");
    };

    img.src = c.preview || c.source;
    return;
  }

  // B) Autres => snapshot du board en 64x64 (calque)
  const cvs = document.createElement('canvas');
  cvs.width = 64; cvs.height = 64;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const dx = Math.round(c.x);
  const dy = Math.round(c.y);

  if (c.type === 'text') {
    const ls = (isFinite(c.line_spacing) ? c.line_spacing : 1);
    drawWrappedTextPixelPerfect(ctx, c.content, dx, dy, 64, c.color, c.font,
      c.text_align || "left", c.grad_active ? c.color2 : null, c.grad_dir, c.grad_angle, ls);
  }
  else if (c.type === 'icon') {
    // NOTE: icônes MDI en "freeze" (dépend du font MDI chargé)
    let size = c.font_size || Math.min(c.w, c.h);
    ctx.font = `${size}px "Material Design Icons"`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    let rgb = hexToRgb(c.color);
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    const temp = document.createElement('i');
    temp.className = `mdi mdi-${c.content}`;
    document.body.appendChild(temp);
    const content = window.getComputedStyle(temp, ':before').getPropertyValue('content').replace(/['"]/g, '');
    document.body.removeChild(temp);
    ctx.fillText(content, dx, dy);
  }
  else if (['rect', 'round_rect', 'circle'].includes(c.type)) {
    let rgb = hexToRgb(c.color);
    let fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

    if (c.grad_active) {
      let grd;
      if (c.grad_dir === 'to bottom') grd = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
      else grd = ctx.createLinearGradient(c.x, c.y, c.x + c.w, c.y);

      grd.addColorStop(0, fillStyle);
      let c2 = hexToRgb(c.color2);
      grd.addColorStop(1, `rgb(${c2[0]},${c2[1]},${c2[2]})`);
      fillStyle = grd;
    }

    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    if (c.type === 'circle') {
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, 2 * Math.PI);
    } else if (c.type === 'round_rect') {
      const r = c.radius || 3;
      ctx.roundRect(c.x, c.y, c.w, c.h, r);
    } else {
      ctx.rect(c.x, c.y, c.w, c.h);
    }

    if (c.filled) {
      ctx.fill();
    } else {
      ctx.lineWidth = 1;
      // IMPORTANT : contour toujours en couleur unie comme le preview (même si grad_active)
      ctx.strokeStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.stroke();
    }
  }

  cleanCanvasPixels(ctx, 64, 64);
  const b64 = cvs.toDataURL("image/png");
  const name = `layer_${Date.now()}.png`;
  await sendToHA(b64, name);

  // Conversion en image 64x64 absolue
  c.type = 'image';
  c.filename = name;
  c.preview = b64;
  c.source = b64;
  c.x = 0; c.y = 0; c.w = 64; c.h = 64;
  c.use_absolute_position = true;

  // Nettoyage attributs “non image”
  delete c.content; delete c.grad_active; delete c.filled; delete c.radius; delete c.as_image;

  renderCanvas();
  renderProps();
  showToast("✅ Calque généré !");
}

// Nettoyage pixels: blanc 255->254, noir->transparent (évite fond)
function cleanCanvasPixels(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h);
  const da = d.data;
  for (let i = 0; i < da.length; i += 4) {
    if (da[i] === 255 && da[i + 1] === 255 && da[i + 2] === 255) { da[i] = 254; da[i + 1] = 254; da[i + 2] = 254; }
    if (da[i] < 45 && da[i + 1] < 45 && da[i + 2] < 45) da[i + 3] = 0;
  }
  ctx.putImageData(d, 0, 0);
}
function renderLayers() {
  const cont = document.getElementById('layer-list');
  if (!cont) return;
  cont.innerHTML = '';
  
  // Mode Caméléon : on ne montre les calques que sur les pages 'components'
  const page = pages[currentPageIndex];
  const isComponents = (!page || !page.page_type || page.page_type === 'components');
  if (!isComponents) return;

  // On affiche les calques du plus haut au plus bas
  [...comps].reverse().forEach(c => {
    const d = document.createElement('div');
    d.className = `layer-item ${c.id === selectedId ? 'selected' : ''}`;
    d.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:6px; border-bottom:1px solid #333; cursor:pointer;";
    if (c.id === selectedId) d.style.background = "#1b5e20";
    
    d.onclick = () => select(c.id);

    let icon = 'shape';
    if (c.type === 'text') icon = 'format-text';
    if (c.type === 'image' || c.type === 'lametric') icon = 'image';
    if (c.type === 'icon') icon = 'emoticon-happy';
    if (c.type === 'sensor') icon = 'flash';
    if (c.type === 'progress') icon = 'gauge';
    if (c.type === 'datetime') icon = 'clock-digital';
    if (c.type === 'weather') icon = 'weather-partly-cloudy';

    let name = c.type.toUpperCase();
    if (c.type === 'text') name = `TXT: ${(c.content || '').substring(0,8)}`;
    if (c.type === 'sensor') name = `HA: ${(c.entity || '').substring(0,8)}`;
    if (c.use_absolute_position) name = `[FIGÉ] ${name}`;

    d.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <i class="mdi mdi-${icon}"></i>
        <span style="font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:110px;">${name}</span>
      </div>
      <div style="display:flex; gap:2px;">
        <button class="icon-btn" onclick="event.stopPropagation(); moveZ(${c.id}, 1)" style="padding:2px 5px; font-size:10px;">▲</button>
        <button class="icon-btn" onclick="event.stopPropagation(); moveZ(${c.id}, -1)" style="padding:2px 5px; font-size:10px;">▼</button>
      </div>
    `;
    cont.appendChild(d);
  });
}


// ----------------------------------------------------------
// 10) LAYERS LIST (z-order) + PROPERTIES PANEL
// ----------------------------------------------------------

function renderProps() {
  const p = document.getElementById('properties-panel'); if (!p) return;
  p.innerHTML = '';
  
  // ==== DÉBUT DU MODE CAMÉLÉON ====
  const page = pages[currentPageIndex];
  const isComponents = (page.page_type === 'components' || page.page_type === 'multigif' || !page.page_type);

  // 1. Griser les boutons de gauche
  document.querySelectorAll('.tools-grid button').forEach(btn => {
    btn.disabled = !isComponents;
    btn.style.opacity = isComponents ? '1' : '0.3';
    btn.style.cursor = isComponents ? 'pointer' : 'not-allowed';
  });
  
  // 2. Masquer les calques
  const layersDiv = document.getElementById('layers-container');
  if (layersDiv) layersDiv.style.display = isComponents ? 'block' : 'none';

  // 3. UI Spécifique si pas "components"
  if (!isComponents) {
    page.config = page.config || {};
    let h = `<div class="prop-group"><div class="prop-header">> CONFIG ${page.page_type.toUpperCase()}</div>`;
// Champ de durée universel pour toutes les pages
    h += `<label style="color:#fff;">Durée de la page (secondes)</label>
          <input type="number" min="1" max="999" value="${page.duration || 15}" oninput="setCurrentPageDuration(this.value)" style="margin-bottom: 15px;">`;    
    if (page.page_type === 'clock') {
      // Ton dictionnaire structuré des horloges
      const clockList = {
        "Pixel Art": {57: "Cloud Channel", 59: "Visualizer", 61: "Custom 1", 63: "Custom 2", 65: "Custom3"},
        "Normal": {10: "Classic Digital Clock", 108: "Mondrian Pixel Art", 122: "wrist watch", 124: "Oriental zodiac", 128: "Automation clock", 132: "sleeping kitty clock", 138: "bun one clcok", 140: "bun two clcok", 142: "pixel display clock", 144: "iced lemonade clock", 174: "Retrclcok", 176: "Girl's room clock", 178: "Lucky Casino Clock", 180: "Digital Frame", 230: "Plush tiger and rainbow", 232: "Shiba Inu | Tiger", 856: "Graffiti time-128", 858: "Purple orange moment-128", 860: "Classic Digital Clock-64", 862: "Automation clock-64", 866: "Time(Sci-Fi)-128", 868: "Oriental zodiac-64", 870: "wrist watch-64", 872: "Mondrian Pixel Art-64", 884: "iced lemonade clock-64", 886: "pixel display clock-64", 888: "bun two clcok-64", 892: "bun one clcok-64", 894: "Time(Neon)-129", 900: "sleeping kitty clock-64", 908: "Digital Frame-64", 910: "Lucky Casino Clock-64", 912: "Girl's room clock-64", 914: "Retrclcok-64", 932: "Shiba Inu | Tiger-64", 934: "Plush tiger and rainbow-64", 942: "Tourmaline clock-128", 944: "Celestial clock-128", 946: "Azure gradient-128", 948: "Kids Crayon-128", 950: "Red Neon Chic-128", 952: "Green Neon Chic-128", 954: "Purple Neon Chic-128", 956: "CyberChrono-128", 958: "SunburstTime-128", 960: "DigitalMeteo-128", 962: "Black Pink-128", 964: "StickFamily-128", 966: "Pinkclock-128", 968: "LCD-Concept1-128", 970: "Retro web cute pastel-128", 978: "Fluoro Gleam Clock-64", 980: "Vital Sprout Clock-64", 982: "Roman numeral Clock-64"},
        "Social": {24: "X- Post", 26: "Facebook Video", 38: "YouTube Account", 40: "YouTube Video", 46: "Bilibili Account", 48: "Bilibili-works", 52: "Bilibili Concept Account", 53: "YouTube Video List", 54: "Bilibili Concept Video", 55: "YouTube Account List", 58: "DouYu Stream", 100: "X- Account", 102: "Influencer", 114: "Bilibili Video", 116: "Bilibili Stream", 160: "Divoom", 222: "TikTok Video", 248: "New Twitch Account", 252: "New Twitch Stream", 258: "Twitch Live List", 407: "Facebook Photo", 628: "TikTok User", 664: "reddit", 665: "Pinterest", 666: "Tumblr"},
        "Financial": {12: "Stock - 2", 64: "Bitcoin", 196: "Stock - Detail", 206: "Cyber Currency", 240: "Exchange Rate"},
        "Weather": {136: "Chameleon clock", 146: "Valoub Clock", 152: "Big Time", 168: "Shiba Inu clock", 170: "pink design clock", 172: "Weather TWO", 182: "Weather ONE", 882: "Big Time-64", 896: "Chameleon clock-64", 916: "Weather TWO-64", 918: "pink design clock-64", 920: "Shiba Inu clock-64"},
        "Holidays": {74: "Anniversary Pink", 76: "Anniversary Green", 126: "Christmas clock1", 212: "Shiba Inu Christmas", 214: "Christmas calendar", 216: "Christmas clock2", 218: "Christmas girl room clock", 238: "Happy New Year", 864: "Christmas clock1-64", 878: "Anniversary Green-64", 880: "Anniversary Pink-64", 902: "Christmas calendar-64", 904: "Shiba Inu Christmas-64", 924: "Anniversary Countdown-128", 926: "Birthday countdown-128", 930: "Happy New Year-64", 938: "Christmas girl room clock-64", 940: "Christmas clock2-64"},
        "Tools": {72: "World Clocks", 98: "Pink Message Board", 104: "Message Board(English only)", 186: "Spotify Clock", 188: "Amazon music", 224: "Vintage Message Board", 234: "RSS Clock", 246: "Custom RSS", 282: "QR code", 677: "Tidal Time", 874: "Message Board(English only)-64", 876: "Pink Message Board-64", 928: "Love notes-128", 936: "Vintage Message Board-64"},
        "Sport": {5: "MLB", 292: "NBA® Matches Clock", 296: "NBA® Teams Clock", 298: "F1® Clock", 302: "URFA® League Clock", 304: "NBA® Live Clock", 602: "NHL"},
        "Game": {90: "League of Legends", 92: "Overwatch", 208: "Fortnite", 696: "PUBG"},
        "Smart hardware": {4: "HUAWEI health", 202: "Fitbit clock", 625: "PC Monitor", 846: "Pulsoid Dial"},
        "Custom": {3: "Clock Collections", 283: "DIY Analog Clock", 284: "DIY Digital Clock", 285: "DIY Digit Pic Clock", 310: "DIY Net Data Clock"},
        "Plan": {189: "Plan2", 191: "Plan3", 193: "Plan4", 195: "Plan5", 201: "Plan1"}
      };

      h += `<label style="color:#64ffda;">Sélecteur d'horloge</label>
            <select style="margin-top:5px; padding:8px; width:100%; background:#111; color:#fff; border:1px solid #4af626; border-radius:4px; font-family:'Roboto Mono', monospace;" onchange="updatePageConfig('clockId', this.value)">
              <option value="">-- Choisir une horloge --</option>`;
      
      // Génération de la liste déroulante classée par catégories
      for (const [category, clocks] of Object.entries(clockList)) {
        h += `<optgroup label="=== ${category} ===">`;
        for (const [id, name] of Object.entries(clocks)) {
          h += `<option value="${id}" ${page.config.clockId == id ? 'selected' : ''}>${id} : ${name}</option>`;
        }
        h += `</optgroup>`;
      }
      
      h += `</select>
            <div style="margin-top: 15px; text-align: center;">
              <a href="https://github.com/gickowtf/pixoo-homeassistant/blob/main/READMES/CLOCKS.md" target="_blank" class="tool-btn" style="color:#ffb74d; text-decoration:none; display:block;">
                <i class="mdi mdi-open-in-new"></i> Voir le catalogue complet Github
              </a>
            </div>`;
    } 
    else if (page.page_type === 'weather') {
       h += `<div style="font-size:11px; color:#aaa; line-height:1.4;">La page Météo est automatique. Ses paramètres sont gérés directement dans la configuration YAML de l'intégration Home Assistant.</div>`;
    }
    else if (page.page_type === 'fuel') {
       h += `<div style="font-size:11px; color:#aaa; line-height:1.4;">La page Carburant (Fuel) récupère automatiquement les prix des stations définies dans votre configuration Home Assistant.</div>`;
    }
else if (page.page_type === 'image' || page.page_type === 'gif') {
       h += `<label>Chemin du fichier (Local HA ou URL)</label>
             <input type="text" placeholder="/config/www/pixoo_designer/..." value="${page.config.image_path || ''}" oninput="updatePageConfig('image_path', this.value)">`;
             
       if (page.page_type === 'gif') {
         h += `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #444;">
                 <label style="color:#64ffda;">> Raccourci GIF LaMetric</label>
                 <div class="row" style="margin-top:5px; gap:8px;">
                   <input type="number" id="page-lametric-id" placeholder="ID (ex: 4823)" style="flex:1;">
                   <select id="page-lametric-size" style="width:75px; padding:4px; background:#111; color:#fff; border:1px solid #4af626; border-radius:4px;">
                     <option value="16">16px</option>
                     <option value="32">32px</option>
                     <option value="64" selected>64px</option>
                   </select>
                 </div>
                 <button class="tool-btn" style="margin-top:8px; background:#1b5e20;" onclick="downloadAndLinkLaMetricGif()">
                   <i class="mdi mdi-download"></i> Télécharger & Lier
                 </button>
                 <button class="tool-btn" style="margin-top:5px;" onclick="document.getElementById('lametric-modal').style.display='flex'">
                   <i class="mdi mdi-library"></i> Ouvrir Biblio LaMetric
                 </button>
               </div>`;
       }
    }
    h += `</div>`;
    
    p.innerHTML = h;
    return; // Stoppe ici, on ne charge pas les propriétés des composants
  }
  // ==== FIN DU MODE CAMÉLÉON ====

//  const c = comps.find(x => x.id === selectedId); 
//  if (!c) {
//    p.innerHTML = '<div class="empty-state">AUCUNE CIBLE DÉTECTÉE.</div>';
//    return;
//  }
const c = comps.find(x => x.id === selectedId); 
if (!c) {
  // ✅ Si MultiGif et rien sélectionné : on affiche quand même le panneau "Page dynamique"
  const page = pages[currentPageIndex];
  if (page && page.page_type === "multigif") {
    page.refresh_s = Number.isFinite(page.refresh_s) ? page.refresh_s : 60;
    page.output_name = page.output_name || "";

    p.innerHTML = `
      <div class="prop-group">
        <div class="prop-header">> MULTIGIF — PAGE DYNAMIQUE</div>

        <label class="lbl">Nom de page (affichage / liste)</label>
        <input id="page-name-input" class="ctl" type="text"
               value="${(page.name || "").replace(/"/g, '&quot;')}"
               placeholder="Ex: Conso Maison" />

        <label class="lbl">Nom de fichier GIF (optionnel — priorité)</label>
        <input id="page-output-input" class="ctl" type="text"
               value="${(page.output_name || "").replace(/"/g, '&quot;')}"
               placeholder="Ex: conso_maison (sans .gif)" />

        <label class="lbl">Refresh (secondes)</label>
        <input id="page-refresh-input" class="ctl ctl-num" type="number"
               min="10" step="5" value="${page.refresh_s || 60}" />

        <button class="btn btn-primary" style="width:100%; margin-top:10px;"
                onclick="saveCurrentMultiGifPageDynamic()">
          💾 Sauver page dynamique
        </button>

        <div style="margin-top:10px; font-size:11px; color:#aaa; line-height:1.4;">
          Cette action prépare la sauvegarde backend (service <b>pyscript.pixoo_page_save</b>).
        </div>
      </div>
    `;
    return;
  }

  p.innerHTML = '<div class="empty-state">AUCUNE CIBLE DÉTECTÉE.</div>';
  return;
}



// ------------------------------------------------
  // ACTION BAR (boutons du haut)
  // ------------------------------------------------
  // CX  = centrer en X
  // CY  = centrer en Y
  // CXY = centrer X+Y
  // DUO = dupliquer
  // SUPP= supprimer
  let h = `<div class="action-bar">
             <button class="icon-btn" onclick="centerComp('x')">CX</button>
             <button class="icon-btn" onclick="centerComp('y')">CY</button>
             <button class="icon-btn" onclick="centerComp('xy')">CXY</button>
             <button class="icon-btn" onclick="duplicate()">DUO</button>
             <button class="icon-btn" style="color:var(--error)" onclick="deleteComp()">SUPP</button>
           </div>`;

  // Label calque figé
  if (c.use_absolute_position) h += `<div style="background:#1b5e20; color:#fff; padding:5px; font-size:10px; margin-bottom:10px;">✅ Calque Figé 64x64</div>`;

  // ------------------------------------------------
  // GEO (X/Y + éventuellement W/H)
  // ------------------------------------------------
  h += `<div class="prop-group"><div class="prop-header">Géo</div>
        <div class="row">
          <div class="col"><label>X</label><input type="number" value="${c.x}" oninput="upd('x',this.value,false)"></div>
          <div class="col"><label>Y</label><input type="number" value="${c.y}" oninput="upd('y',this.value,false)"></div>
        </div>`;

  // W/H pas pour text/sensor/datetime/weather
  if (!['text', 'sensor', 'datetime', 'weather'].includes(c.type)) {
    h += `<div class="row">
            <div class="col"><label>W</label><input type="number" value="${c.w}" oninput="upd('w',this.value,false)"></div>
            <div class="col"><label>H</label><input type="number" value="${c.h}" oninput="upd('h',this.value,false)"></div>
          </div>`;
  }
  h += `</div>`;

  // ------------------------------------------------
  // CONTENT (text/sensor/datetime/icon)
  // ------------------------------------------------
  if (['text', 'sensor', 'datetime', 'icon'].includes(c.type)) {
    h += `<div class="prop-group"><div class="prop-header">Contenu</div>`;

    // TEXT: textarea avec SHIFT+ENTER
    if (c.type === 'text') {
      h += `<label>Valeur</label>
            <textarea style="width:100%; min-height:60px; resize:vertical;"
                      onkeydown="handleTextBoxKeydown(event)"
                      oninput="upd('content',this.value,false); renderCanvas();">${(c.content || "")}</textarea>`;
    }

    // ICON: input + bouton freeze
    if (c.type === 'icon') {
      h += `<label>Valeur (MDI)</label>
            <div style="position:relative;">
              <input type="text" value="${c.content}" onkeyup="searchMDIIcons(this.value)" oninput="upd('content',this.value,false)" placeholder="ex: home, weather...">
              <div id="mdi-list" class="sensor-dropdown"
                   style="position:absolute; top:100%; left:0; width:100%; background:var(--bg); border:1px solid var(--accent);
                          z-index:9999; max-height:220px; overflow-y:auto; display:none; box-shadow:0 10px 25px rgba(0,0,0,0.9);"></div>
            </div>`;
            
      h += `<div class="row" style="margin-top:10px;">
              <button class="tool-btn" onclick="document.getElementById('mdi-modal').style.display='flex'">Biblio MDI</button>
              <button class="tool-btn" style="color:#ffb74d; border-color:#ffb74d;" onclick="freezeCompToLayer()">📸 Figer</button>
            </div>`;
    }

    // SENSOR: champ entity + dropdown + checkbox unité
    if (c.type === 'sensor') {
      h += `<label>Entity</label>
            <div style="position:relative;">
              <input type="text" value="${c.entity || ''}" onkeyup="searchSensors(this.value,'entity')" oninput="upd('entity',this.value,false)" placeholder="Chercher...">
              <div id="sensor-list-entity" class="sensor-dropdown"
                   style="position:absolute; top:100%; left:0; width:100%; background:#111; border:1px solid #444;
                          z-index:9999; max-height:200px; overflow-y:auto; display:none; box-shadow:0 5px 15px rgba(0,0,0,0.8);"></div>
            </div>
            <label style="margin-top:10px; display:block;">
              <input type="checkbox" ${c.show_unit ? 'checked' : ''} onchange="upd('show_unit',this.checked)">
              Afficher unité
            </label>`;
    }

    // Police pour tout sauf icon
    if (c.type !== 'icon') {
      h += `<label>Police</label>
            <select onchange="upd('font',this.value)">
              <option value="GICKO" ${c.font === 'GICKO' ? 'selected' : ''}>Gicko</option>
              <option value="FIVE_PIX" ${c.font === 'FIVE_PIX' ? 'selected' : ''}>Five Pix</option>
              <option value="PICO_8" ${c.font === 'PICO_8' ? 'selected' : ''}>Pico 8</option>
              <option value="ELEVEN_PIX" ${c.font === 'ELEVEN_PIX' ? 'selected' : ''}>Eleven Pix</option>
              <option value="CLOCK" ${c.font === 'CLOCK' ? 'selected' : ''}>Clock</option>
            </select>`;
    }

    // Align + interligne
    if (['text', 'sensor', 'datetime'].includes(c.type)) {
      h += `<label>Alignement</label>
            <select onchange="upd('text_align',this.value)">
              <option value="left" ${c.text_align === 'left' ? 'selected' : ''}>Gauche</option>
              <option value="center" ${c.text_align === 'center' ? 'selected' : ''}>Centré</option>
              <option value="right" ${c.text_align === 'right' ? 'selected' : ''}>Droite</option>
            </select>

            <label style="margin-top:10px; display:block;">Espacement lignes (px)</label>
            <input type="number" min="0" max="50" step="1"
                   value="${isFinite(c.line_spacing) ? c.line_spacing : 1}"
                   oninput="upd('line_spacing', parseInt(this.value||0,10), false); renderCanvas();">`;
    }

    // Text gradient => PNG required
    if (c.type === 'text') {
      h += `<div style="margin-top:10px; border-top:1px solid #444; padding-top:8px;">
              <label style="display:block; margin-bottom:6px;">Mode Couleur</label>
              <label style="display:block;">
                <input type="radio" name="txtmode_${c.id}" ${!c.grad_active ? 'checked' : ''}
                       onchange="upd('grad_active',false); upd('as_image',false);"> Couleur unique
              </label>
              <label style="display:block; margin-top:4px;">
                <input type="radio" name="txtmode_${c.id}" ${c.grad_active ? 'checked' : ''}
                       onchange="upd('grad_active',true); upd('as_image',true);"> Dégradé (PNG requis)
              </label>
            </div>`;

      if (c.grad_active) {
        h += `<div style="background:#222; padding:8px; margin-top:8px;">
                <label>Couleur 2</label>
                <input type="color" value="${c.color2}" oninput="upd('color2',this.value,false)">
                <label style="margin-top:8px; display:block;">Orientation (degrés)</label>
                <input type="number" value="${isFinite(c.grad_angle) ? c.grad_angle : 90}" min="0" max="359"
                       oninput="upd('grad_angle',this.value,false)">
                <button class="tool-btn" style="background:#e91e63; margin-top:10px;" onclick="freezeCompToLayer()">
                  🖼️ Convertir en PNG
                </button>
              </div>`;
      }
    }

    h += `</div>`;
  }

  // ------------------------------------------------
  // PROGRESS PARAMS
  // ------------------------------------------------
  if (c.type === 'progress') {
    h += `<div class="prop-group"><div class="prop-header">Paramètres Barre</div>
          <label>Entity Sensor</label>
          <div style="position:relative;">
            <input type="text" value="${c.entity || ''}" onkeyup="searchSensors(this.value,'entity')" oninput="upd('entity',this.value,false)" placeholder="Chercher...">
            <div id="sensor-list-entity" class="sensor-dropdown"
                 style="position:absolute; top:100%; left:0; width:100%; background:#111; border:1px solid #444;
                        z-index:9999; max-height:200px; overflow-y:auto; display:none;"></div>
          </div>

          <div class="row" style="margin-top:5px;">
            <div class="col"><label>Min</label><input type="number" value="${c.min ?? 0}" oninput="upd('min',this.value,false)"></div>
            <div class="col"><label>Max</label><input type="number" value="${c.max ?? 100}" oninput="upd('max',this.value,false)"></div>
          </div>
          </div>`;
  }

  // ------------------------------------------------
  // IMAGE / LAMETRIC
  // ------------------------------------------------
  if (c.type === 'image' || c.type === 'lametric') {
    h += `<div class="prop-group"><div class="prop-header">Image</div>`;

  // ✅ MultiGif: contrôle GIF (animé vs frame fixe)
  const isGifFile = ((c.filename || "").toLowerCase().endsWith(".gif"));
  if (isGifFile) {
    // valeurs par défaut safe
    if (!c.gif_mode) c.gif_mode = "animated";
    if (!Number.isFinite(c.gif_frame)) c.gif_frame = 0;

    h += `
      <div style="background:#222; padding:10px; margin-top:10px; border-radius:6px; border:1px solid #444;">
        <div style="font-weight:800; color:#ffb74d; margin-bottom:8px;">GIF</div>

        <label>Mode</label>
        <select onchange="upd('gif_mode', this.value, false); renderProps();">
          <option value="animated" ${c.gif_mode === "animated" ? "selected" : ""}>🎞 Animé</option>
          <option value="frame" ${c.gif_mode === "frame" ? "selected" : ""}>🖼 Frame fixe</option>
        </select>

        ${c.gif_mode === "frame" ? `
          <label style="margin-top:10px; display:block;">Index de frame</label>
          <input type="number" min="0" step="1"
            value="${Number.isFinite(c.gif_frame) ? c.gif_frame : 0}"
            oninput="upd('gif_frame', parseInt(this.value||0,10), false);">
          <div style="font-size:10px; color:#aaa; margin-top:6px; line-height:1.3;">
            Astuce: 0 = première frame (souvent la “poster”).
          </div>
        ` : ``}
      </div>
    `;
  }
    // Upload local
    if (c.type === 'image') {
      h += `<input type="file" onchange="handleUpload(this)">
            <label style="margin-top:10px;">
              <input type="checkbox" ${c.lock_ratio ? 'checked' : ''} onchange="upd('lock_ratio',this.checked)"> Ratio Fixe
            </label>`;
    }

    // LaMetric load by ID
    if (c.type === 'lametric') {
      h += `<div class="row">
              <input type="number" id="lametric-id-input" placeholder="ID" value="${c.filename ? (c.filename.match(/\d+/) || [''])[0] : ''}">
              <button class="tool-btn" onclick="loadLaMetric()">Charger</button>
            </div>
            <button class="tool-btn" style="margin-top:5px;" onclick="document.getElementById('lametric-modal').style.display='flex'">Biblio</button>`;
    }

    // ========================================================
    // NOUVELLE LOGIQUE : LISTE INTELLIGENTE (LAMETRIC) VS SLIDERS (IMAGE)
    // ========================================================
    if (c.type === 'lametric') {
      // 1. Liste dynamique : on fusionne les standards avec la taille réelle (si modifiée à la poignée)
      const sizes = [8, 16, 24, 32, 64];
      const currentH = Math.round(c.forced_height || c.h || 8);
      
      const optionsHTML = Array.from(new Set([...sizes, currentH])).sort((a,b) => a - b)
        .map(s => `<option value="${s}" ${s === currentH ? 'selected' : ''}>${s}x${s} px</option>`)
        .join('');

      h += `<div style="background:#222; padding:8px; margin-top:10px; border:1px solid #777; border-radius:4px;">
              <label style="color:#4fc3f7;">Taille LaMetric</label>
              <select style="margin-top:5px;" onchange="
                const val = parseInt(this.value, 10);
                upd('w', val, false);
                upd('h', val, false);
                upd('forced_height', val, true);
              ">
                ${optionsHTML}
              </select>
            </div>`;
            
    } else {
      // 2. Comportement Classique pour IMAGE (Champ libre + Sliders)
      h += `<div style="background:#222; padding:8px; margin-top:10px; border:1px solid #777;">
              <label style="color:#4fc3f7;">Forcer YAML H</label>
              <input type="number" value="${c.forced_height || 0}" oninput="upd('forced_height', this.value, false)">
            </div>`;

      // Sliders: seuil noir + saturation + labels dynamiques
      h += `<div style="background:#222; padding:8px; margin-top:10px; border-radius:4px;">
              <label>
                Seuil Noir / Transparence (<span id="lbl-black-${c.id}">${c.black_threshold ?? 0}</span>)
              </label>
              <input type="range" min="0" max="255" value="${c.black_threshold ?? 0}"
                oninput="
                  upd('black_threshold', this.value, false);
                  const s=document.getElementById('lbl-black-${c.id}'); if(s) s.textContent=this.value;
                  applyImageFilters_IMG('${c.id}');
                ">

              <label style="margin-top:10px;">
                Saturation (<span id="lbl-sat-${c.id}">${c.saturation ?? 100}</span>%)
              </label>
              <input type="range" min="0" max="300" value="${c.saturation ?? 100}"
                oninput="
                  upd('saturation', this.value, false);
                  const s=document.getElementById('lbl-sat-${c.id}'); if(s) s.textContent=this.value;
                  applyImageFilters_IMG('${c.id}');
                ">
            </div>`;
    }
    // ========================================================
    // ✅ NOUVEAU : mode de figer (IMAGE uniquement)
    if (c.type === 'image') {
      c.freeze_mode = c.freeze_mode || "none";
      h += `
        <label style="margin-top:10px; display:block;">Figer PNG : traitement</label>
        <select onchange="
          upd('freeze_mode', this.value, false);
          if (this.value === 'ultra_custom') {
            const cc = comps.find(x => x.id == '${c.id}');
            if (cc) initUltraCustomDefaults(cc);
          }
          renderProps();
          applyImageFilters_IMG('${c.id}');
        ">
          <option value="none" ${c.freeze_mode==='none'?'selected':''}>Aucun (identique preview)</option>
          <option value="clean" ${c.freeze_mode==='clean'?'selected':''}>Nettoyage (clean)</option>
          <option value="premium" ${c.freeze_mode==='premium'?'selected':''}>Premium (HQ + Floyd–Steinberg)</option>
          <option value="portrait" ${((c.freeze_mode||"none")==="portrait")?'selected':''}>Portrait LED (peau + lunettes)</option>
          <option value="ultra_custom" ${c.freeze_mode==='ultra_custom'?'selected':''}>Ultra custom (8 sliders live)</option>
        </select>

        ${c.freeze_mode === 'ultra_custom' ? `
          <div style="background:#222; padding:10px; margin-top:10px; border-radius:6px; border:1px solid #444;">
            <div style="font-weight:700; color:#64ffda; margin-bottom:8px;">Ultra custom (live)</div>

            <label>Expo</label>
            <input type="range" min="-50" max="100" value="${c.uc_expo ?? 25}"
              oninput="upd('uc_expo', this.value, false); applyImageFilters_IMG('${c.id}')">

            <label style="margin-top:8px;">Niveaux</label>
            <input type="range" min="2" max="16" value="${c.uc_levels ?? 5}"
              oninput="upd('uc_levels', this.value, false); applyImageFilters_IMG('${c.id}')">

            <label style="margin-top:8px;">Contours</label>
            <input type="range" min="10" max="200" value="${c.uc_edge ?? 110}"
              oninput="upd('uc_edge', this.value, false); applyImageFilters_IMG('${c.id}')">
            
              <label style="margin-top:8px;">Zoom</label>
            <input type="range" min="1" max="4" step="0.1" value="${c.uc_zoom ?? 1}"
              oninput="upd('uc_zoom', this.value, false); applyImageFilters_IMG('${c.id}')">

            <label style="margin-top:8px;">Pan X</label>
            <input type="range" min="0" max="100" value="${c.uc_panx ?? 50}"
              oninput="upd('uc_panx', this.value, false); applyImageFilters_IMG('${c.id}')">

            <label style="margin-top:8px;">Pan Y</label>
            <input type="range" min="0" max="100" value="${c.uc_pany ?? 50}"
              oninput="upd('uc_pany', this.value, false); applyImageFilters_IMG('${c.id}')">

            <label style="margin-top:8px;">Flou intelligent (Aplats)</label>
            <input type="range" min="0" max="6" value="${c.uc_smartblur ?? 3}"
              oninput="upd('uc_smartblur', this.value, false); applyImageFilters_IMG('${c.id}')">

            <label style="margin-top:8px;">Saturation (Style)</label>
            <input type="range" min="0" max="4" step="0.1" value="${c.uc_sat ?? 1.7}"
              oninput="upd('uc_sat', this.value, false); applyImageFilters_IMG('${c.id}')">
          </div>
        ` : ``}
      `;
    }
    if (c.preview) h += `<button class="tool-btn" style="background:#e91e63; margin-top:10px;" onclick="freezeCompToLayer()">📸 Figer PNG</button>`;

    h += `</div>`;
  }

  // ------------------------------------------------
  // APPEARANCE (couleurs)
  // ------------------------------------------------
  h += `<div class="prop-group"><div class="prop-header">Apparence</div>`;

  if (c.type === 'progress') {
    h += `<label>Couleur Fond</label><input type="color" value="${c.bg_color || '#333333'}" oninput="upd('bg_color',this.value,false)">`;

    h += `<div style="margin-top:10px; border-top:1px solid #444; padding-top:5px;">
            <label><input type="checkbox" ${c.conditional_color ? 'checked' : ''} onchange="upd('conditional_color',this.checked)"> Activer Seuils</label>
          </div>`;

    if (!c.conditional_color) {
      h += `<label>Couleur Barre</label><input type="color" value="${c.color}" oninput="upd('color',this.value,false)">`;
    } else {
      h += `<div class="row" style="margin-top:5px;">
              <div class="col"><label>Seuil</label><input type="number" value="${c.threshold ?? 50}" oninput="upd('threshold',this.value,false)"></div>
            </div>
            <div class="row">
              <div class="col"><label>Si < Seuil</label><input type="color" value="${c.color_low || '#00ff00'}" oninput="upd('color_low',this.value,false)"></div>
              <div class="col"><label>Si >= Seuil</label><input type="color" value="${c.color_high || '#ff0000'}" oninput="upd('color_high',this.value,false)"></div>
            </div>`;
    }
  } else if (!(c.type === 'image' || c.type === 'lametric')) {
    h += `<label>Couleur</label><input type="color" value="${c.color}" oninput="upd('color',this.value,false)">`;
  }

// Shapes: contour / rempli / dégradé + options + freeze
if (['rect', 'round_rect', 'circle'].includes(c.type)) {

  const modeShape = c.grad_active ? 'gradient' : (c.filled ? 'fill' : 'stroke');

  h += `
    <div style="background:#222; padding:10px; margin-top:10px; border-radius:6px; border:1px solid #444;">
      <div style="font-weight:800; color:#ffb74d; margin-bottom:8px;">Forme</div>

      <div class="row" style="gap:8px;">
        <button class="tool-btn" style="flex:1; ${modeShape==='stroke'?'background:#64ffda;color:#000;':''}"
          onclick="upd('filled', false, false); upd('grad_active', false, false); renderProps(); renderCanvas();">
          Contour
        </button>

        <button class="tool-btn" style="flex:1; ${modeShape==='fill'?'background:#64ffda;color:#000;':''}"
          onclick="upd('filled', true, false); upd('grad_active', false, false); renderProps(); renderCanvas();">
          Rempli
        </button>

        <button class="tool-btn" style="flex:1; ${modeShape==='gradient'?'background:#64ffda;color:#000;':''}"
          onclick="upd('filled', true, false); upd('grad_active', true, false); renderProps(); renderCanvas();">
          Dégradé
        </button>
      </div>
  `;

  if (c.type === 'round_rect') {
    h += `
      <label style="margin-top:10px;">Rayon</label>
      <input type="number" value="${c.radius || 3}" 
        oninput="upd('radius',this.value,false); renderCanvas();">
    `;
  }

  if (c.grad_active) {
    h += `
      <div style="margin-top:10px; padding-top:10px; border-top:1px solid #444;">
        <label>Couleur 2</label>
        <input type="color" value="${c.color2 || '#ffffff'}"
          oninput="upd('color2',this.value,false); renderCanvas();">

        <label style="margin-top:10px;">Type</label>
        <select onchange="upd('grad_type',this.value,false); renderCanvas();">
          <option value="linear" ${c.grad_type === 'linear' ? 'selected' : ''}>Linéaire</option>
          <option value="radial" ${c.grad_type === 'radial' ? 'selected' : ''}>Radial</option>
        </select>
      </div>
    `;
  }

  // Toujours afficher le bouton freeze
  h += `
      <button class="tool-btn" style="background:#e91e63; margin-top:12px;" onclick="freezeCompToLayer()">📸 Figer en Calque</button>
    </div>
  `;
}

  h += `</div>`;
  p.innerHTML = h;
}



// ----------------------------------------------------------
// 10B) CENTER HELPERS (CX/CY/CXY)
// ----------------------------------------------------------
// Centre n’importe quel composant en prenant en compte sa taille réelle.
// - Pour images/shapes/progress => c.w / c.h
// - Pour text/sensor/datetime => calcul hauteur réelle des lignes (wrap)
//   (Largeur retenue = 64 parce que ton rendu text preview est un canvas 64px)

function centerComp(mode) {
  const c = comps.find(x => x.id === selectedId);
  if (!c) return;

  const boardSize = 64;

  let realW = c.w;
  let realH = c.h;

  // Text-like => hauteur réelle calculée, largeur = 64
  if (['text', 'sensor', 'datetime'].includes(c.type)) {
    const val = c.content || "";
    const maxW = 64;
    const lineH = (c.font === 'ELEVEN_PIX' || c.font === 'CLOCK') ? 16 : 10;
    const ls = (isFinite(c.line_spacing) ? c.line_spacing : 1);

    const lines = wrapTextPixelPerfect(val, c.font, maxW);
    realH = Math.min(64, (lines.length * (lineH + ls)) - ls);
    realW = 64;
  }

  if (mode === 'x' || mode === 'xy') {
    c.x = Math.round((boardSize - realW) / 2);
  }

  if (mode === 'y' || mode === 'xy') {
    c.y = Math.round((boardSize - realH) / 2);
  }

  renderCanvas();
  renderProps();
}



// ----------------------------------------------------------
// 11) SEARCH SENSORS DROPDOWN
// ----------------------------------------------------------

function searchSensors(q, targetField = 'entity') {
  const listId = `sensor-list-${targetField}`;
  const list = document.getElementById(listId);
  if (!list) return;

  if (!q || q.length < 2) { list.style.display = 'none'; return; }

  list.innerHTML = '';
  const terms = q.toLowerCase().split(' ').filter(t => t.length > 0);

  const matches = haEntities.filter(e => {
    const id = e.entity_id.toLowerCase();
    const name = (e.attributes.friendly_name || "").toLowerCase();
    return terms.every(term => id.includes(term) || name.includes(term));
  }).slice(0, 15);

  if (matches.length === 0) { list.style.display = 'none'; return; }

  list.style.display = 'block';
  matches.forEach(e => {
    const item = document.createElement('div');
    item.style.cssText = "padding:6px; cursor:pointer; border-bottom:1px solid #333; color:#fff; font-size:10px;";
    item.innerHTML = `<span style="color:#00e676; font-weight:bold;">${e.entity_id}</span><br><span style="color:#aaa;">${e.attributes.friendly_name || ''}</span>`;
    item.onmouseover = () => item.style.background = "#333";
    item.onmouseout = () => item.style.background = "transparent";
    item.onmousedown = (ev) => {
      ev.preventDefault();
      upd(targetField, e.entity_id, false);
      const input = list.previousElementSibling;
      if (input) input.value = e.entity_id;
      list.style.display = 'none';
      renderCanvas();
    };
    list.appendChild(item);
  });
}

// ----------------------------------------------------------
// 11B) SEARCH MDI ICONS DROPDOWN
// ----------------------------------------------------------
function searchMDIIcons(q) {
  const list = document.getElementById('mdi-list');
  if (!list) return;

  if (!q || q.length < 2) { list.style.display = 'none'; return; }

  list.innerHTML = '';
  const terms = q.toLowerCase().split(' ').filter(t => t.length > 0);

  // Filtre les icônes qui matchent et limite à 50 résultats pour ne pas lagger
  const matches = mdiIconNames.filter(name => {
    return terms.every(term => name.includes(term));
  }).slice(0, 50);

  if (matches.length === 0) { list.style.display = 'none'; return; }

  list.style.display = 'block';
  matches.forEach(name => {
    const item = document.createElement('div');
    item.style.cssText = "padding:8px; cursor:pointer; border-bottom:1px solid var(--border2); color:var(--accent); font-size:12px; display:flex; align-items:center; gap:10px;";
    
    // On injecte l'aperçu de l'icône à gauche du texte
    item.innerHTML = `<i class="mdi mdi-${name}" style="font-size:18px;"></i> <span>${name}</span>`;
    
    item.onmouseover = () => { item.style.background = "var(--accent)"; item.style.color = "var(--txt-dark)"; };
    item.onmouseout = () => { item.style.background = "transparent"; item.style.color = "var(--accent)"; };
    
    item.onmousedown = (ev) => {
      ev.preventDefault();
      upd('content', name, false);
      const input = list.previousElementSibling;
      if (input) input.value = name;
      list.style.display = 'none';
      renderCanvas();
    };
    list.appendChild(item);
  });
}


// ----------------------------------------------------------
// 12) LAMETRIC LOAD (PIXEL PERFECT) + LOCAL UPLOAD
// ----------------------------------------------------------

// 1. Fonction principale de chargement
async function loadLaMetric() {
  const id = document.getElementById('lametric-id-input')?.value?.trim();
  if (!id) return;

  // On tape directement dans les fichiers bruts via corsproxy
  let targetUrl = `https://developer.lametric.com/content/apps/icon_thumbs/${id}.gif`;
  let proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

  showToast("📥 Chargement de l'icône...");

  try {
    let res = await fetch(proxyUrl);
    
    // Si pas de GIF, on tente le PNG
    if (!res.ok) {
       targetUrl = `https://developer.lametric.com/content/apps/icon_thumbs/${id}.png`;
       proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
       res = await fetch(proxyUrl);
       if (!res.ok) throw new Error("Icône introuvable.");
    }
    
    const buffer = await res.arrayBuffer();
    const header = new Uint8Array(buffer, 0, 3);
    const isGIF = (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46); 

    // Ferme la modale de bibliothèque LaMetric si elle est ouverte
    const libModal = document.getElementById('lametric-modal');
    if (libModal) libModal.style.display = 'none';

    // Aiguillage
    if (isGIF) {
      processLaMetricGIF(buffer, id);
    } else {
      processLaMetricStatic(buffer, id);
    }

  } catch (e) {
    showToast("Erreur LaMetric", "error");
    logDebug("❌ Erreur : " + e.message, "error");
  }
}

// 2. Traitement d'une image fixe (Extraction 8x8 propre)
function processLaMetricStatic(buffer, idString) {
  const blob = new Blob([buffer]);
  const url = URL.createObjectURL(blob);
  const img = new Image();
  
  img.onload = () => {
    const tempCvs = document.createElement('canvas');
    tempCvs.width = img.width; tempCvs.height = img.height;
    const tempCtx = tempCvs.getContext('2d');
    tempCtx.drawImage(img, 0, 0);

    const pureCvs = document.createElement('canvas');
    pureCvs.width = 8; pureCvs.height = 8;
    const pureCtx = pureCvs.getContext('2d');
    const pureData = pureCtx.createImageData(8, 8);
    
    const imgData = tempCtx.getImageData(0, 0, img.width, img.height).data;
    const blockSize = img.width / 8;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const sx = Math.floor((x * blockSize) + (blockSize / 2));
        const sy = Math.floor((y * blockSize) + (blockSize / 2));
        const sIdx = (sy * img.width + sx) * 4;
        const dIdx = (y * 8 + x) * 4;

        pureData.data[dIdx]   = imgData[sIdx];
        pureData.data[dIdx+1] = imgData[sIdx+1];
        pureData.data[dIdx+2] = imgData[sIdx+2];
        pureData.data[dIdx+3] = imgData[sIdx+3];
      }
    }
    pureCtx.putImageData(pureData, 0, 0);
    applyLaMetricFrameToComponent(pureCvs, idString);
  };
  img.src = url;
}

// extraction image gif ou juste gif
function processLaMetricGIF(buffer, idString) {
  try {
    if (typeof window.GIF === 'undefined') throw new Error("La librairie locale gif-decoder.js n'est pas chargée !");
    const gif = new window.GIF(buffer); const frames = gif.decompressFrames(true);
    const tempCanvas = document.createElement('canvas'); tempCanvas.width = gif.raw.lsd.width; tempCanvas.height = gif.raw.lsd.height;
    const tempCtx = tempCanvas.getContext('2d'); const blockSize = tempCanvas.width / 8; const extractedFrames = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (frame.disposalType === 2) tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      const patchCvs = document.createElement('canvas'); patchCvs.width = frame.dims.width; patchCvs.height = frame.dims.height;
      const patchCtx = patchCvs.getContext('2d'); const patchData = patchCtx.createImageData(frame.dims.width, frame.dims.height);
      patchData.data.set(frame.patch); patchCtx.putImageData(patchData, 0, 0);
      tempCtx.drawImage(patchCvs, frame.dims.left, frame.dims.top);

      const pureCvs = document.createElement('canvas'); pureCvs.width = 8; pureCvs.height = 8;
      const pureCtx = pureCvs.getContext('2d'); const pureData = pureCtx.createImageData(8, 8);
      const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;

      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const sx = Math.floor((x * blockSize) + (blockSize / 2)); const sy = Math.floor((y * blockSize) + (blockSize / 2));
          const sIdx = (sy * tempCanvas.width + sx) * 4; const dIdx = (y * 8 + x) * 4;
          pureData.data[dIdx] = imgData[sIdx]; pureData.data[dIdx+1] = imgData[sIdx+1];
          pureData.data[dIdx+2] = imgData[sIdx+2]; pureData.data[dIdx+3] = imgData[sIdx+3];
        }
      }
      pureCtx.putImageData(pureData, 0, 0); extractedFrames.push(pureCvs);
    }

    injectGifPickerModal(); const modal = document.getElementById('gif-picker-modal');
    const container = document.getElementById('gif-frames-container'); container.innerHTML = '';

    // --- NOUVEAUTÉ : LE BOUTON POUR LE GIF COMPLET ANIMÉ ---
    const blob = new Blob([buffer], { type: 'image/gif' });
    const fullUrl = URL.createObjectURL(blob);
    
    const fullWrapper = document.createElement('div');
    fullWrapper.style.cursor = 'pointer'; 
    fullWrapper.style.border = '2px dashed #ff9800'; 
    fullWrapper.style.padding = '5px'; 
    fullWrapper.style.marginBottom = '15px';
    fullWrapper.style.width = '100%';
    fullWrapper.style.display = 'flex';
    fullWrapper.style.flexDirection = 'column';
    fullWrapper.style.alignItems = 'center';
    fullWrapper.innerHTML = `<div style="color:#ff9800; font-size:12px; margin-bottom:5px; font-weight:bold;">GIF COMPLET (Animé)</div><img src="${fullUrl}" style="width:64px; height:64px; image-rendering:pixelated;">`;
    
    fullWrapper.onclick = () => {
        applyLaMetricFullGifToComponent(fullUrl, buffer, idString);
        modal.style.display = 'none';
    };
    container.appendChild(fullWrapper);
    
    // --- L'ANCIEN SYSTÈME : CHOIX DE FRAME FIXE ---
    const frameTitle = document.createElement('div');
    frameTitle.style.width = '100%'; frameTitle.style.color = '#64ffda'; frameTitle.style.fontSize = '10px'; frameTitle.style.marginBottom = '10px';
    frameTitle.innerText = "OU CHOISIR UNE FRAME FIXE :";
    container.appendChild(frameTitle);

    const framesDiv = document.createElement('div');
    framesDiv.style.display = 'flex'; framesDiv.style.flexWrap = 'wrap'; framesDiv.style.gap = '10px'; framesDiv.style.justifyContent = 'center';
    container.appendChild(framesDiv);

    extractedFrames.forEach((cvs, idx) => {
      const wrapper = document.createElement('div');
      wrapper.style.cursor = 'pointer'; wrapper.style.border = '2px solid transparent'; wrapper.style.padding = '2px'; wrapper.style.transition = 'border 0.2s';
      wrapper.onmouseover = () => wrapper.style.border = '2px solid var(--accent)'; wrapper.onmouseout = () => wrapper.style.border = '2px solid transparent';
      const displayCvs = document.createElement('canvas'); displayCvs.width = 64; displayCvs.height = 64;
      const dCtx = displayCvs.getContext('2d'); dCtx.imageSmoothingEnabled = false; dCtx.drawImage(cvs, 0, 0, 64, 64);
      wrapper.appendChild(displayCvs);
      wrapper.onclick = () => { applyLaMetricFrameToComponent(cvs, `${idString}_f${idx}`); modal.style.display = 'none'; };
      framesDiv.appendChild(wrapper);
    });
    
    modal.style.display = 'block';
  } catch (e) { logDebug("❌ Erreur GIF: " + e.message, "error"); showToast("Erreur de décodage GIF", "error"); }
}


// 4. Injection finale de la frame sélectionnée dans le projet
function applyLaMetricFrameToComponent(canvas8x8, idString) {
  const c = comps.find(x => x.id === selectedId);
  if (!c) return;

  c.type = 'lametric';
  c.filename = `lametric_${idString}.png`;
  c.w = 8; c.h = 8;
  c.lock_ratio = true;
  c.forced_height = 8;

  c.source = canvas8x8.toDataURL("image/png");
  c.preview = c.source;

  // Fini la triche ! Les pixels sont purs, on remet les seuils à zéro (neutre)
  c.black_threshold = 0;
  c.saturation = 100;

  if (c && c.type === 'lametric') applyImageFilters(c.id);
  setTimeout(() => sendToHA(c.preview, c.filename), 50);

  renderCanvas();
  renderProps();
  showToast("✅ Icône appliquée !");
}
// ✅ NEW: appliquer le GIF COMPLET (animé) à un composant LaMetric
// - fullUrl : URL blob (preview)
// - buffer  : ArrayBuffer du gif original
// - idString: id lametric (ex: "1782")
async function applyLaMetricFullGifToComponent(targetUrl, buffer, idString, size = 16) {
  const c = comps.find(x => x.id === selectedId);
  if (!c) return;

  // --- size guard ---
  size = parseInt(size, 10);
  if (![8, 16, 32, 64].includes(size)) size = 16;

  // --- UI preview (blob) ---
  const blob = new Blob([buffer], { type: "image/gif" });
  const blobUrl = URL.createObjectURL(blob);

  // --- component setup ---
  c.type = "lametric";
  c.filename = `lametric_${idString}_${size}.gif`;

  c.w = size;
  c.h = size;
  c.lock_ratio = true;
  c.forced_height = size;

  // Preview OK (blob) / Source debug (http)
  c.preview = blobUrl;
  c.source_url = targetUrl;
  c.source = ""; // neutralise anciens chemins

  // --- upload chain (TMP + PERMANENT) ---
  const reader = new FileReader();
  reader.onload = async () => {
    const b64 = reader.result;

    // 1) TMP (pixoo_media) -> utile pour UI/preview et compat V1
    // (si ton sendToHA V1 gère déjà les GIF, on garde)
    await sendToHA(b64, c.filename, size);
    logDebug(`✅ Upload TMP OK: ${c.filename}`);

    // 2) PERMANENT (pixoo_media_gif) -> base64 resize serveur
    await uploadGifPermanentToHA(b64, c.filename, size);
    logDebug(`✅ Permanent OK: ${c.filename}`);

    renderCanvas();
    renderProps();
    showToast("✅ GIF animé appliqué !");
  };

  reader.readAsDataURL(blob);
}
// Upload d’image locale (file input / drag-drop)
function handleUpload(input) {
  if (!input.files?.[0]) return;

  let c = comps.find(x => x.id === selectedId);
  if (!c) { addComp('image'); c = comps.find(x => x.id === selectedId); }

  showToast("Upload...");

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // Resize max 64 (sans smoothing)
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > 64 || h > 64) {
        const r = Math.min(64 / w, 64 / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }

      const cvs = document.createElement('canvas');
      cvs.width = w; cvs.height = h;
      const ctx = cvs.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      c.type = 'image';
      c.source = cvs.toDataURL("image/png");
      c.preview = c.source;

      c.filename = `upload_${Date.now()}.png`;
      c.w = w; c.h = h;

      // filtres par défaut pour image uploadée
      c.black_threshold = c.black_threshold ?? 0;
      c.saturation = c.saturation ?? 100;

      if (c && c.type === 'lametric') applyImageFilters(c.id);
      setTimeout(() => sendToHA(c.preview, c.filename), 50);

      renderCanvas();
      renderProps();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}
// ----------------------------------------------------------
// AUTO FREEZE (ProUX) : fige toutes les formes/icônes/météo
// ----------------------------------------------------------
function _isUnsupportedForYAML(c) {
  return ['rect', 'round_rect', 'circle', 'icon', 'weather'].includes(c.type);
}

async function freezeAllUnsupportedUX() {
  const list = comps.filter(_isUnsupportedForYAML);

  if (!list.length) {
    showToast("✅ Rien à figer");
    return;
  }

  showToast(`📸 Figer ${list.length} élément(s)…`);

  // On fige du haut vers le bas (z-order) ou l’inverse selon ton souhait.
  // Ici: du bas vers le haut (ordre normal du tableau comps)
  for (const c of list) {
    // sélectionne le composant (freezeCompToLayer utilise selectedId)
    selectedId = c.id;
    renderProps();

    // freeze
    await freezeCompToLayer();

    // petite respiration UI (évite parfois des glitch DOM)
    await new Promise(r => setTimeout(r, 50));
  }

  showToast("✅ Tout est figé !");
}

// Version "guard" : si des shapes existent, on prévient et on stoppe
function warnIfUnsupportedForYAML() {
  const list = comps.filter(_isUnsupportedForYAML);
  if (!list.length) return false;

  console.warn("⚠️ Composants non supportés YAML:", list.map(x => x.type + ":" + x.id));
  showToast("⚠️ Shapes/Icônes/Météo: fige en calque avant export YAML.", "error");
  return true;
}


// ----------------------------------------------------------
// 13) TOAST + CRUD COMPONENTS + Z ORDER
// ----------------------------------------------------------

function showToast(m, t = 'success') {
  logDebug(m);
  const c = document.getElementById('toast-container'); if (!c) return;
  const d = document.createElement('div'); d.className = `toast ${t} show`; d.innerHTML = m;
  c.appendChild(d);
  setTimeout(() => d.remove(), 3000);
}

// Create a new component with defaults
function addComp(t) {
  const id = Date.now();
  let defW = (t === 'icon') ? 16 : 20;
  let defH = (t === 'icon') ? 16 : 10;
  let defC = (t === 'icon') ? 'home' : 'TEXT';

  if (t === 'progress') { defW = 40; defH = 4; }
  if (t === 'text' || t === 'sensor' || t === 'datetime') { defW = 64; defH = 10; }
  if (t === 'image' || t === 'lametric') { defW = 16; defH = 16; }

  const newComp = {
    id, type: t, x: 8, y: 8, w: defW, h: defH,
    color: '#ffffff', font: 'GICKO', content: defC,

    // text gradient options
    grad_active: false, color2: '#ff0000', grad_dir: 'to bottom', grad_angle: 90,
    as_image: false,
    freeze_reprocess: false,
    text_align: 'left',
    line_spacing: 1,

    // YAML image override
    forced_height: 0,

    // RAW image pipeline
    source: null,
    preview: null,
    filename: null,

    // defaults sliders
    black_threshold: 0,
    saturation: 100,

    // progress params
    entity: "",
    min: 0, max: 100,
    bg_color: '#333333',
    conditional_color: false,
    threshold: 50,
    color_low: '#00ff00',
    color_high: '#ff0000',
    // GIF control (multigif mode)
    gif_mode: "animated",   // "animated" ou "frame"
    gif_frame: 0            // index de frame si mode "frame"    
  };

  comps.push(newComp);
  select(id);
}
// ----------------------------------------------------
// Generate multipage
// ----------------------------------------------------

function generateMultiPagesYAMLOnly() {
  let y = "";
  pages.forEach(p => {
    y += `- page_type: components\n`;
    y += `  duration: ${p.duration || 15}\n`;
    y += `  enabled: "${p.enabled_template || "{{ is_state('input_boolean.pixoo_override','on') }}"}"\n`;
    y += `  components:\n`;
    // temporaire: on réutilise TON generatePageYAMLOnly logique en la rendant paramétrable plus tard
    // Ici V1: on “swap” comps le temps de générer
    const oldIndex = currentPageIndex;
    currentPageIndex = pages.indexOf(p);
    syncCompsRef();
    y += generatePageYAMLOnly().split("\n").slice(4).join("\n"); // enlève header duplicate (hack V1)
    y += "\n";
    currentPageIndex = oldIndex;
    syncCompsRef();
  });

  return y.trim();
}


// UPDATE a property of selected component
function upd(k, v, redraw = true) {
  const c = comps.find(x => x.id === selectedId); if (!c) return;

  // numeric cast
  if (['x', 'y', 'w', 'h', 'radius', 'min', 'max', 'threshold', 'grad_angle', 'line_spacing', 'black_threshold', 'saturation', 'forced_height'].includes(k)) {
    v = parseFloat(v);
  }

  c[k] = v;

  // ratio lock
  if (k === 'w' && c.lock_ratio) c.h = c.w;
  if (k === 'h' && c.lock_ratio) c.w = c.h;

  // ✅ SYNC "FORCER YAML H" dès qu'on bouge H
  // (seulement image/lametric)
  if (k === 'h' && (c.type === 'image' || c.type === 'lametric')) {
    c.forced_height = Math.round(c.h);
  }

  renderCanvas();
  if (redraw) { renderProps(); renderLayers(); }
}

function select(id) { selectedId = id; renderCanvas(); renderLayers(); renderProps(); }

function deleteComp() {
  // FIX: On filtre directement dans la mémoire de la page, pas sur le raccourci
  pages[currentPageIndex].comps = pages[currentPageIndex].comps.filter(x => x.id !== selectedId);
  syncCompsRef(); // FIX: On resynchronise
  selectedId = null;
  renderCanvas(); renderLayers(); renderProps();
}

function duplicate() {
  const c = comps.find(x => x.id === selectedId); if (!c) return;
  const cp = JSON.parse(JSON.stringify(c));
  cp.id = Date.now();
  cp.x += 2; cp.y += 2;
  comps.push(cp);
  select(cp.id);
}

// Change Z order (front/back)
function moveZ(id, d) {
  const i = comps.findIndex(x => x.id == id);
  if (d === 1 && i < comps.length - 1) [comps[i], comps[i + 1]] = [comps[i + 1], comps[i]];
  if (d === -1 && i > 0) [comps[i], comps[i - 1]] = [comps[i - 1], comps[i]];
  renderCanvas(); renderLayers();
}



// ----------------------------------------------------------
// 14) UI INJECTION (zoom, lametric modal, page yaml, debug)
// ----------------------------------------------------------

function injectZoomControls() {
  if (!document.getElementById('zoom-controls')) {
    const d = document.createElement('div');
    d.id = 'zoom-controls';
    d.style.display = 'flex';
    d.style.alignItems = 'center';
    d.style.gap = '5px';
    
    d.innerHTML = `
      <div style="width: 15px;"></div> <button class="zoom-btn" onclick="toggleGrid()" title="Grille de pixels">#</button>
      <button class="zoom-btn" onclick="changeZoom(-1)">-</button>
      <button class="zoom-btn" onclick="autoFitZoom()">FIT</button>
      <button class="zoom-btn" onclick="changeZoom(1)">+</button>`;
    document.querySelector('.canvas-area')?.appendChild(d);
  }
}
function injectThemeSliderTop() {
  if (document.getElementById('theme-slider-ui')) return;
  
  // On cible le menu déroulant des pages pour s'insérer juste avant lui
  const pagesSelect = document.getElementById('pages-select');
  if (!pagesSelect) return;

  const container = document.createElement('div');
  container.id = 'theme-slider-ui';
  container.className = 'theme-slider-wrapper';
  
  container.innerHTML = `
    <span id="theme-label" style="width: 75px; text-align: right;">☢️ Fallout</span>
    <input type="range" min="0" max="2" value="0" class="theme-slider" id="theme-slider-input" oninput="updateThemeFromSlider(this.value)">
  `;

  // On l'insère dans la top-bar, juste à gauche de la zone de sélection de pages
  pagesSelect.parentNode.insertBefore(container, pagesSelect);
  
  // Synchronisation initiale du slider avec le thème sauvegardé
  const t = localStorage.getItem('pixoo_theme') || 'fallout';
  const s = document.getElementById('theme-slider-input');
  if (t === 'ha-dark') s.value = 1;
  if (t === 'ha-light') s.value = 2;
  updateThemeFromSlider(s.value);
}

function injectLaMetricModal() {
  if (!document.getElementById('lametric-modal')) {
    const d = document.createElement('div');
    d.id = 'lametric-modal';
    d.className = 'retro-modal-window'; // Nouvelle classe CSS
    d.style.display = 'none'; // Caché par défaut
    
    d.innerHTML = `
      <div class="retro-modal-header" id="lametric-modal-header">
        <span>>_ BIBLIOTHÈQUE LAMETRIC</span>
        <button onclick="document.getElementById('lametric-modal').style.display='none'" title="Fermer">[X]</button>
      </div>
      <div class="retro-modal-content">
        <iframe src="https://developer.lametric.com/icons"></iframe>
      </div>
    `;
    document.body.appendChild(d);

    // Activer le déplacement (Drag & Drop)
    dragElement(d, document.getElementById('lametric-modal-header'));
  }
}
// injecter la liste des icones
function injectMDIModal() {
  if (!document.getElementById('mdi-modal')) {
    const d = document.createElement('div');
    d.id = 'mdi-modal';
    d.className = 'retro-modal-window'; 
    d.style.display = 'none'; 
    // On la décale un peu pour ne pas la superposer parfaitement à LaMetric
    d.style.top = '140px';
    d.style.left = '140px';
    
    d.innerHTML = `
      <div class="retro-modal-header" id="mdi-modal-header">
        <span>>_ BIBLIOTHÈQUE MDI</span>
        <button onclick="document.getElementById('mdi-modal').style.display='none'" title="Fermer">[X]</button>
      </div>
      <div class="retro-modal-content">
        <iframe src="https://pictogrammers.com/library/mdi/"></iframe>
      </div>
    `;
    document.body.appendChild(d);
    dragElement(d, document.getElementById('mdi-modal-header'));
  }
}

// Fonction magique pour rendre une fenêtre déplaçable
function dragElement(elmnt, header) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  header.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function injectDebugConsole() {
  // Si ton HTML contient déjà le bloc debug-console, on ne fait rien.
  // Sinon, tu peux l’injecter ici (optionnel).
}

// Bouton "PAGE YAML" (copie uniquement la page_data:)
function injectPageYamlButton() {
  if (document.getElementById('btn-page-yaml')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-page-yaml';
  btn.className = 'tool-btn';
  btn.textContent = '📄 PAGE YAML';
  btn.style.position = 'fixed';
  btn.style.top = '10px';
  btn.style.left = '50%';
  btn.style.transform = 'translateX(-50%)';
  btn.style.zIndex = '99999';
  btn.style.width = 'auto';
  btn.onclick = copyPageYAML;
  document.body.appendChild(btn);
}

function copyPageYAML() {
  const pageYaml = generatePageYAMLOnly();
  try {
    navigator.clipboard.writeText(pageYaml);
    showToast("PAGE YAML copié !");
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = pageYaml;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast("PAGE YAML copié !");
  }
}



// ----------------------------------------------------------
// 15) ZOOM + DROP
// ----------------------------------------------------------

function autoFitZoom() {
  // On garde un zoom "éditeur" utilisable (drag/resize stable)
  const area = document.querySelector('.board-area');
  if (!area) return;

  // marge interne
  const w = Math.max(64, area.clientWidth - 40);
  const h = Math.max(64, area.clientHeight - 40);

  // IMPORTANT: zoom ENTIER + clamp (jamais < 2)
  const z = Math.floor(Math.min(w / 64, h / 64));

  ZOOM = Math.max(2, Math.min(20, z));  // 2..20
  renderCanvas();
  renderProps();
}



// ----------------------------------------------------------
// 16) YAML GENERATORS (YAML complet + PAGE ONLY)
// ----------------------------------------------------------

function generatePageYAMLOnly() {
  if (warnIfUnsupportedForYAML()) return;
  let y = `- page_type: components\n`;
const page = pages[currentPageIndex];
  y += `  duration: ${page.duration || 15}\n`;
  y += `  enabled: "${page.enabled_template || "{{ is_state('input_boolean.pixoo_override','on') }}"}"\n`;
  y += `  components:\n`;

  comps.forEach(c => {
    // IMAGE
    if (c.type === 'image' || c.type === 'lametric') {
      y += `    - type: image\n`;
      y += `      image_path: ${SAVE_DIR_HA}${c.filename || 'temp.png'}\n`;
      y += `      position:\n        - ${c.use_absolute_position ? 0 : Math.round(c.x)}\n        - ${c.use_absolute_position ? 0 : Math.round(c.y)}\n`;
      if (!c.use_absolute_position) {
        const H = c.forced_height || Math.round(c.h);
        const W = c.forced_height ? Math.round(H * (c.w / c.h)) : Math.round(c.w);
        y += `      height: ${H}\n`;
        y += `      width: ${W}\n`;
      }
      return;
    }

    // PROGRESS => 2 rectangles
    if (c.type === 'progress') {
      let rgbBg = hexToRgb(c.bg_color || "#333333");
      let rgb = hexToRgb(c.color);

      y += `    - type: rectangle\n`;
      y += `      position:\n        - ${Math.round(c.x)}\n        - ${Math.round(c.y)}\n`;
      y += `      size:\n        - ${Math.round(c.w)}\n        - ${Math.round(c.h)}\n`;
      y += `      color:\n        - ${rgbBg[0]}\n        - ${rgbBg[1]}\n        - ${rgbBg[2]}\n`;
      y += `      filled: true\n`;

      y += `    - type: rectangle\n`;
      y += `      position:\n        - ${Math.round(c.x)}\n        - ${Math.round(c.y)}\n`;
      y += `      size_x_template: "{{ ((states('${c.entity}')|float(0) - ${c.min}) / (${c.max} - ${c.min}) * ${Math.round(c.w)}) | int }}"\n`;
      y += `      size_y: ${Math.round(c.h)}\n`;
      y += `      filled: true\n`;

      if (c.conditional_color) {
        let rgbLow = hexToRgb(c.color_low);
        let rgbHigh = hexToRgb(c.color_high);
        y += `      color: "{% if states('${c.entity}')|float(0) < ${c.threshold} %}[${rgbLow[0]},${rgbLow[1]},${rgbLow[2]}]{% else %}[${rgbHigh[0]},${rgbHigh[1]},${rgbHigh[2]}]{% endif %}"\n`;
      } else {
        y += `      color:\n        - ${rgb[0]}\n        - ${rgb[1]}\n        - ${rgb[2]}\n`;
      }
      return;
    }

    // TEXT / SENSOR / DATETIME => text component
    let rgb = hexToRgb(c.color);
    let finalContent = c.content;

    if (c.type === 'sensor') {
      finalContent = `{{ states('${c.entity}') }}`;
      if (c.show_unit) finalContent += ` {{ state_attr('${c.entity}', 'unit_of_measurement') }}`;
    } else if (c.type === 'datetime') {
      finalContent = "{{ now().strftime('%H:%M:%S') }}";
    }

    y += `    - type: text\n`;
    y += `      color:\n        - ${rgb[0]}\n        - ${rgb[1]}\n        - ${rgb[2]}\n`;
    y += `      content: ${finalContent}\n`;
    y += `      font: ${c.font || 'GICKO'}\n`;
    y += `      position:\n        - ${Math.round(c.x)}\n        - ${Math.round(c.y)}\n`;
  });

  return y;
}

function generateYAML() {
  let y = ``; // On génère la liste pure, prête à être collée sous "pages:" dans HA

  pages.forEach(page => {
    const type = page.page_type || 'components';
    // multigif -> export en "gif" côté YAML (on garde le type interne "multigif" en UI)
    const yamlType = (type === 'multigif') ? 'gif' : type;
    y += `- page_type: ${yamlType}\n`;
    y += `  duration: ${page.duration || 15}\n`;
    
    if (page.enabled_template && page.enabled_template !== "") {
      y += `  enabled: "${page.enabled_template}"\n`;
    }

    if (type === 'clock') {
      if (page.config?.clockId) y += `  id: ${page.config.clockId}\n`;
    } 
    else if (type === 'image') {
      if (page.config?.image_path) y += `  image_path: ${page.config.image_path}\n`;
    } 

    else if (type === 'gif' || type === 'multigif') {
      // 🔥 Cas multigif : toujours le fichier cuit
      if (type === 'multigif') {
        // ✅ le vrai fichier final attendu (UI > page > title > fallback)
        const outFile = getMultiGifOutputFileForCurrentPage() || "cuisson_finale.gif";

        y += `  gif_url: http://${HA_LOCAL_IP}/local/pixoo_designer/pixoo_media_gif/${outFile}\n`;

        // --- RECETTE JSON (POUR AUTOMATISATION PYTHON) ---
        let recipe = {
          output_file: outFile,
          background_gif: page.config?.image_path || "",
          static_layer: page.config?.static_layer || "",
          sensors: [],
          animations: []
        };

        (page.comps || []).forEach(c => {
          if (c.type === 'sensor') {
            recipe.sensors.push({
              entity_id: c.entity,
              x: Math.round(c.x), y: Math.round(c.y),
              font: c.font || "GICKO",
              color: c.color || "#ffffff",
              align: c.text_align || "left",
              show_unit: c.show_unit || false
            });
          } else if (c.type === 'image' || c.type === 'lametric') {
            const H = c.forced_height ? Math.round(c.forced_height) : Math.round(c.h);
            const W = c.forced_height ? Math.round(H * (c.w / c.h)) : Math.round(c.w);

            if (!c.filename) {
              if (!_multigifWarnedNoFilename.has(c.id)) {
                _multigifWarnedNoFilename.add(c.id);
                logDebug(`⚠️ MultiGif: composant sans filename ignoré (id=${c.id}, type=${c.type})`, "warn");
              }
            } else {
              recipe.animations.push({
                path: c.filename,
                x: Math.round(c.x),
                y: Math.round(c.y),
                w: W,
                h: H
              });
            }
          }
        });

        y += `\n# --- RECETTE JSON (POUR AUTOMATISATION PYTHON) ---\n`;
        y += `# ${JSON.stringify(recipe)}\n`;
      }
      // 🎞️ Cas gif classique (comportement actuel inchangé)
      else if (page.config?.image_path) {
        let path = page.config.image_path;

        if (path.startsWith("/config/www/")) {
          let url = `http://${HA_LOCAL_IP}` + path.replace("/config/www/", "/local/");
          y += `  gif_url: ${url}\n`;
        } else {
          y += `  gif_url: ${path}\n`;
        }
      }
    }

    
    else if (type === 'weather' || type === 'fuel') {
      
    } 
    else {
      // Components
      if (page.comps && page.comps.length > 0) {
        y += `  components:\n`;
        page.comps.forEach(c => {
          // IMAGE / LAMETRIC
          if (c.type === 'image' || c.type === 'lametric') {
            y += `    - type: image\n`;
            y += `      image_path: ${SAVE_DIR_HA}${c.filename || 'temp.png'}\n`;
            y += `      position: [${c.use_absolute_position ? 0 : Math.round(c.x)}, ${c.use_absolute_position ? 0 : Math.round(c.y)}]\n`;
            if (!c.use_absolute_position) {
              const H = c.forced_height || Math.round(c.h);
              const W = c.forced_height ? Math.round(H * (c.w / c.h)) : Math.round(c.w);
              y += `      height: ${H}\n`;
              y += `      width: ${W}\n`;
            }
          }
          // PROGRESS
          else if (c.type === 'progress') {
            let rgbBg = hexToRgb(c.bg_color || "#333333");
            let rgb = hexToRgb(c.color);
            y += `    - type: rectangle\n`;
            y += `      position: [${Math.round(c.x)}, ${Math.round(c.y)}]\n`;
            y += `      size: [${Math.round(c.w)}, ${Math.round(c.h)}]\n`;
            y += `      color: [${rgbBg[0]}, ${rgbBg[1]}, ${rgbBg[2]}]\n`;
            y += `      filled: true\n`;

            y += `    - type: rectangle\n`;
            y += `      position: [${Math.round(c.x)}, ${Math.round(c.y)}]\n`;
            y += `      size_x_template: "{{ ((states('${c.entity}')|float(0) - ${c.min}) / (${c.max} - ${c.min}) * ${Math.round(c.w)}) | int }}"\n`;
            y += `      size_y: ${Math.round(c.h)}\n`;
            y += `      filled: true\n`;
            if (c.conditional_color) {
              let rgbLow = hexToRgb(c.color_low);
              let rgbHigh = hexToRgb(c.color_high);
              y += `      color: "{% if states('${c.entity}')|float(0) < ${c.threshold} %}[${rgbLow[0]},${rgbLow[1]},${rgbLow[2]}]{% else %}[${rgbHigh[0]},${rgbHigh[1]},${rgbHigh[2]}]{% endif %}"\n`;
            } else {
              y += `      color: [${rgb[0]}, ${rgb[1]}, ${rgb[2]}]\n`;
            }
          }
          // TEXT / SENSOR / DATETIME
          else if (c.type === 'text' || c.type === 'sensor' || c.type === 'datetime') {
            let rgb = hexToRgb(c.color);
            let finalContent = c.content;
            if (c.type === 'sensor') {
              finalContent = `{{ states('${c.entity}') }}`;
              if (c.show_unit) finalContent += ` {{ state_attr('${c.entity}', 'unit_of_measurement') }}`;
            } else if (c.type === 'datetime') {
              finalContent = "{{ now().strftime('%H:%M:%S') }}";
            }
            y += `    - type: text\n`;
            y += `      color: [${rgb[0]}, ${rgb[1]}, ${rgb[2]}]\n`;
            y += `      content: "${finalContent}"\n`;
            y += `      font: ${c.font || 'GICKO'}\n`;
            y += `      position: [${Math.round(c.x)}, ${Math.round(c.y)}]\n`;
          }
        });
      }
    }
  });

  const out = document.getElementById('yaml-output');
  if (out) out.value = y;
}

// ----------------------------------------------------------
// 17A secial gif
// ----------------------------------------------------------

async function downloadAndLinkLaMetricGif() {
  const id = document.getElementById('page-lametric-id').value.trim();
  const size = parseInt(document.getElementById('page-lametric-size').value, 10);
  
  if (!id) {
    showToast("⚠️ Entre un ID LaMetric", "error");
    return;
  }

  const token = localStorage.getItem('ha_token');
  if (!token) { showToast("Token HA manquant", "error"); return; }

  const sourceUrl = `https://developer.lametric.com/content/apps/icon_thumbs/${id}.gif`;
  const filename = `lametric_${id}_${size}.gif`;

  showToast(`📥 Téléchargement LaMetric ${size}x${size}...`);
  logDebug(`Appel pyscript pour télécharger: ${filename}`);

  try {
    // Appel du vrai service Python présent dans ton pixoo_backend.py
    const res = await fetch('/api/services/pyscript/pixoo_download_url', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: sourceUrl,
        filename: filename,
        size: size
      })
    });

    if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);

    showToast("✅ GIF téléchargé en local sur HA !");
    
    // 1. MAJ du chemin pour l'export YAML (Chemin physique absolu /config/www/...)
    updatePageConfig('image_path', `${SAVE_DIR_HA}${filename}`);
    
    // 2. On sauvegarde le nom de fichier pour que le bouton ENVOYER génère l'URL web dynamique
    updatePageConfig('local_filename', filename);

  } catch (e) {
    logDebug("❌ Erreur download: " + e.message, "error");
    showToast("Erreur téléchargement", "error");
  }
}

// ----------------------------------------------------------
// 17) PUSH TO PREVIEW (render composite 64x64 -> upload -> show_message)
// ----------------------------------------------------------
// Objectif: envoyer un “snapshot” composite (64x64) au Pixoo,
// sans dépendre des templates YAML. Donc:
// 1) Render base (text/shapes/progress) en canvas 64x64
// 2) Dessiner par-dessus les images (image/lametric) via c.preview
// 3) Upload vers HA (pyscript)
// 4) Appeler divoom_pixoo.show_message avec une page image plein écran

function _renderCompositeBase64_64x64_syncWithoutImages() {
  const cvs = document.createElement('canvas');
  cvs.width = 64;
  cvs.height = 64;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);

  for (const c of comps) {
    // Skip images here (on les ajoute après en async)
    if (c.type === 'image' || c.type === 'lametric' || c.type === 'sensor') continue;

    if (['text', 'datetime'].includes(c.type)) {      
      let val = c.content || "";

      if (c.type === 'sensor') {
        const ent = haEntities.find(e => e.entity_id === c.entity);
        if (ent) {
          const n = parseFloat(ent.state);
          if (isFinite(n)) val = n.toFixed(c.precision || 0);
          else val = (ent.state ?? '').toString();
          if (c.show_unit) val += " " + (ent.attributes.unit_of_measurement || "");
        } else {
          val = '{VAL}';
        }
      }

      if (c.type === 'datetime') {
        val = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }

      const ls = (isFinite(c.line_spacing) ? c.line_spacing : 1);

      drawWrappedTextPixelPerfect(
        ctx,
        val,
        Math.round(c.x),
        Math.round(c.y),
        64,
        c.color,
        c.font,
        c.text_align || "left",
        c.grad_active ? c.color2 : null,
        c.grad_dir,
        c.grad_angle,
        ls
      );
    }

    else if (c.type === 'progress') {
      // Fond
      ctx.fillStyle = c.bg_color || "#333333";
      ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.round(c.w), Math.round(c.h));

      // Valeur
      let val = 50;
      const ent = haEntities.find(e => e.entity_id === c.entity);
      if (ent && !isNaN(parseFloat(ent.state))) val = parseFloat(ent.state);

      const min = parseFloat(c.min) || 0;
      const max = parseFloat(c.max) || 100;
      const pct = (max - min) === 0 ? 0 : clamp((val - min) / (max - min), 0, 1);

      // Couleur
      if (c.conditional_color) {
        ctx.fillStyle = (val < c.threshold) ? c.color_low : c.color_high;
      } else {
        ctx.fillStyle = c.color || "#ffffff";
      }

      ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.round(c.w * pct), Math.round(c.h));
    }

    else if (['rect', 'round_rect', 'circle'].includes(c.type)) {
      // Simple fill (gradient “canvas” n’est pas indispensable ici)
      const rgb = hexToRgb(c.color || "#ffffff");
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.beginPath();

      if (c.type === 'circle') {
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, 2 * Math.PI);
      } else if (c.type === 'round_rect') {
        const r = c.radius || 3;
        ctx.roundRect(c.x, c.y, c.w, c.h, r);
      } else {
        ctx.rect(c.x, c.y, c.w, c.h);
      }

      if (c.filled) ctx.fill();
      else { ctx.lineWidth = 1; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
    }
  }

  // Nettoyage pixels (blanc 255->254, noir->alpha=0)
  cleanCanvasPixels(ctx, 64, 64);

  return cvs;
}
async function startGifCookerPreview() {
  const token = localStorage.getItem("ha_token");
  if (!token) { 
    showToast("Token HA manquant", "error"); 
    return null; 
  }

  try {
    const page = pages?.[currentPageIndex];
    if (!page || page.page_type !== "multigif") {
      showToast("Pas une page MultiGif", "warn");
      return null;
    }

    // ✅ construit la recette normale
    const recipeObj = buildMultiGifRecipe();

    // ✅ preview isolé PAR PAGE (évite collisions si plusieurs pages ouvertes)
    if (!page.id) page.id = Date.now().toString();
    const previewFile = `__preview_${page.id}.gif`;

    recipeObj.output_file = previewFile;

    logDebug(`🧪 [PREVIEW] Cuisson vers ${previewFile}`);

    const res = await fetch("/api/services/pyscript/pixoo_bake_gif", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipe: JSON.stringify(recipeObj)
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(()=> "");
      logDebug(`❌ [PREVIEW] Erreur cuisson: HTTP ${res.status} ${txt}`, "error");
      showToast("Erreur cuisson preview", "error");
      return null;
    }

    return previewFile;

  } catch (e) {
    logDebug("❌ Exception preview: " + (e?.message || e), "error");
    return null;
  }
}

async function pushPreviewToHA() {
  const token = localStorage.getItem("ha_token");
  if (!token) { showToast("Token HA manquant", "error"); return; }

  // --- NOUVEAU : Ouvre la console de debug automatiquement ---
  const debugConsole = document.getElementById('debug-console');
  if (debugConsole) debugConsole.style.display = 'flex';
  // ---------------------------------------------------------

  try {
    const page = pages[currentPageIndex];
    const type = page.page_type || "components";
    const duration = Number(page.duration || 15);

    showToast(`🚀 Envoie page test '${type.toUpperCase()}' pendant ${duration}s...`);
    logDebug(`========================================`);
    logDebug(`[ENVOI LIVE] Démarrage... Type: ${type.toUpperCase()}, Durée: ${duration}s`);

    // Préparation de la structure JSON de base (avec le enabled !)
    const page_data = {
      page_type: type,
      duration: duration,
      enabled: page.enabled_template || "{{ is_state('input_boolean.pixoo_override','on') }}"
    };

    // Remplissage selon le type

    if (type === "clock") {
      page_data.id = parseInt(page.config?.clockId || 1);
      logDebug(`[ENVOI LIVE] ID Horloge : ${page_data.id}`);
    } 
    else if (type === "image") {
      page_data.image_path = page.config?.image_path || "";
      logDebug(`[ENVOI LIVE] Chemin Image : ${page_data.image_path}`);
    }
    else if (type === "multigif") {
      // ✅ MultiGif : cuisson puis envoi en mode GIF (URL en IP + port)
      logDebug(`[ENVOI LIVE] Mode MultiGif détecté. Lancement de la cuisson automatique...`);
      //
      const previewFile = "__preview_multigif.gif";
      await startGifCookerTest(previewFile);
      if (!previewFile) return;
      // petite attente disque (1.2s) + fallback si besoin
      await new Promise(r => setTimeout(r, 2000));
      page_data.page_type = "gif";
      page_data.gif_url = `http://${HA_LOCAL_IP}/local/pixoo_designer/pixoo_media_gif/${previewFile}?v=${Date.now()}`;
      logDebug(`[ENVOI LIVE] URL du GIF PREVIEW : ${page_data.gif_url}`);
    }
    else if (type === "gif") {
      let path = page.config?.image_path || "";
      if (path.startsWith("/config/www/")) {
        page_data.gif_url = `http://${HA_LOCAL_IP}` + path.replace("/config/www/", "/local/") + `?v=${Date.now()}`;
      } else if (path.startsWith("/local/")) {
        page_data.gif_url = `http://${HA_LOCAL_IP}` + path + `?v=${Date.now()}`;
      } else {
        page_data.gif_url = path;
      }
      logDebug(`[ENVOI LIVE] URL du GIF : ${page_data.gif_url}`);
    } 
    else if (type === "components") {
      // Auto-freeze des shapes/icônes/météo avant envoi
      if (comps.some(_isUnsupportedForYAML)) {
        showToast("📸 Auto-freeze (shapes) avant envoi…");
        logDebug("[ENVOI LIVE] Auto-freeze des formes non supportées en YAML...");
        await freezeAllUnsupportedUX();
      }

      page_data.components = [];
      logDebug(`[ENVOI LIVE] Assemblage de ${comps.length} composant(s)...`);
      
      for (const c of comps) {
        if (c.type === "image" || c.type === "lametric") {
          const H = (c.forced_height ? Math.round(c.forced_height) : Math.round(c.h));
          const W = (c.forced_height ? Math.round(H * (c.w / c.h)) : Math.round(c.w));
          page_data.components.push({
            type: "image",
            image_path: `${SAVE_DIR_HA}${c.filename || "temp.png"}`,
            position: [c.use_absolute_position ? 0 : Math.round(c.x), c.use_absolute_position ? 0 : Math.round(c.y)],
            height: c.use_absolute_position ? undefined : H,
            width: c.use_absolute_position ? undefined : W
          });
        }
        else if (c.type === "progress") {
          const rgbBg = hexToRgb(c.bg_color || "#333333");
          const rgb = hexToRgb(c.color || "#ffffff");
          page_data.components.push({
            type: "rectangle",
            position: [Math.round(c.x), Math.round(c.y)],
            size: [Math.round(c.w), Math.round(c.h)],
            color: [rgbBg[0], rgbBg[1], rgbBg[2]],
            filled: true
          });
          let barColor = [rgb[0], rgb[1], rgb[2]];
          if (c.conditional_color) {
            const rgbLow = hexToRgb(c.color_low || "#00ff00");
            const rgbHigh = hexToRgb(c.color_high || "#ff0000");
            barColor = "{% if states('" + (c.entity || "") + "')|float(0) < " + (c.threshold ?? 50) + " %}[" + rgbLow[0] + "," + rgbLow[1] + "," + rgbLow[2] + "]{% else %}[" + rgbHigh[0] + "," + rgbHigh[1] + "," + rgbHigh[2] + "]{% endif %}";
          }
          page_data.components.push({
            type: "rectangle",
            position: [Math.round(c.x), Math.round(c.y)],
            size_x_template: "{{ ((states('" + (c.entity || "") + "')|float(0) - " + (c.min ?? 0) + ") / (" + (c.max ?? 100) + " - " + (c.min ?? 0) + ") * " + Math.round(c.w) + ") | int }}",
            size_y: Math.round(c.h),
            filled: true,
            color: barColor
          });
        }
        else if (["text", "sensor", "datetime"].includes(c.type)) {
          const rgb = hexToRgb(c.color || "#ffffff");
          let content = (c.content ?? "").toString();
          if (c.type === "sensor") {
            content = "{{ states('" + (c.entity || "") + "') }}";
            if (c.show_unit) content += " {{ state_attr('" + (c.entity || "") + "', 'unit_of_measurement') }}";
          } else if (c.type === "datetime") {
            content = "{{ now().strftime('%H:%M:%S') }}";
          }
          page_data.components.push({
            type: "text",
            color: [rgb[0], rgb[1], rgb[2]],
            content: content,
            font: (c.font || "GICKO"),
            position: [Math.round(c.x), Math.round(c.y)]
          });
        }
      }
    }

    // ✅ Payload REST attendu par /api/services/... : entity_id à plat (pas target)
    const payload = (entity_id) => ({ entity_id, page_data });
    
    // Log hyper verbeux du JSON généré !
    logDebug(`[ENVOI LIVE] Payload JSON généré :<br><pre style="font-size:9px; color:#aaa; margin-top:4px;">${JSON.stringify(payload("sensor.divoom_pixoo_64_current_page"), null, 2)}</pre>`);

    async function callShowMessage(entity_id) {
      logDebug(`[ENVOI LIVE] Appel service HA sur cible : ${entity_id}...`);
      const res = await fetch("/api/services/divoom_pixoo/show_message", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload(entity_id))
      });
      const txt = await res.text().catch(() => "");
      return { ok: res.ok, status: res.status, text: txt };
    }

    let r = await callShowMessage("sensor.divoom_pixoo_64_current_page");
    if (!r.ok) {
      logDebug(`[ENVOI LIVE] ⚠️ Échec sur le sensor (${r.status}). Tentative fallback vers light...`, "warn");
      r = await callShowMessage("light.divoom_pixoo_64_light");
      if (!r.ok) {
        logDebug(`[ENVOI LIVE] ❌ Échec total. Status HTTP: ${r.status}. Réponse: ${r.text}`, "error");
        showToast(`Erreur SEND (${r.status})`, "error");
        return;
      }
    }
    
    logDebug("[ENVOI LIVE] ✅ Succès absolu ! Le Pixoo a accepté la commande.");
    showToast("✅ Page de test envoyée au Pixoo !");
  } catch (e) {
    logDebug("[ENVOI LIVE] ❌ EXCEPTION CRITIQUE : " + (e?.message || e), "error");
    showToast("Erreur SEND", "error");
  }
}
// Activer le Drag & Drop pour le terminal Debug dès que la page est chargée
window.addEventListener('DOMContentLoaded', () => {
  const debugConsole = document.getElementById('debug-console');
  const debugHeader = document.querySelector('.debug-header');
  
  // Si la fenêtre et l'entête existent, on applique notre fonction magique
  if (debugConsole && debugHeader && typeof dragElement === 'function') {
    dragElement(debugConsole, debugHeader);
  }
});
// ----------------------------------------------------------
// 18) BACKUP SUR LE SERVEUR HOME ASSISTANT
// ----------------------------------------------------------
async function backupSurHA() {
  const token = localStorage.getItem('ha_token');
  if (!token) return;
  
  try {
    const res = await fetch('/api/services/shell_command/backup_pixoo', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      logDebug("💾 Backup serveur HA créé avec succès dans /backup/ !");
    } else {
      logDebug("Erreur lors du backup HA", "error");
    }
  } catch (e) {
    logDebug("Erreur de connexion pour le backup", "error");
  }
}
// ----------------------------------------------------------
// LAYERS COLLAPSE / EXPAND
// ----------------------------------------------------------
function setLayersCollapsed(collapsed) {
  const container = document.getElementById('layers-container');
  const icon = document.getElementById('layers-toggle-icon');
  if (!container) return;

  container.classList.toggle('collapsed', !!collapsed);
  if (icon) icon.className = collapsed ? 'mdi mdi-chevron-down' : 'mdi mdi-chevron-up';

  try { localStorage.setItem('pixoo_layers_collapsed', collapsed ? '1' : '0'); } catch(e){}
}

function toggleLayersPanel() {
  const container = document.getElementById('layers-container');
  if (!container) return;
  const collapsed = container.classList.contains('collapsed');
  setLayersCollapsed(!collapsed);
}
// pickermodal
function injectGifPickerModal() {
  if (!document.getElementById('gif-picker-modal')) {
    const d = document.createElement('div');
    d.id = 'gif-picker-modal';
    d.className = 'retro-modal-window';
    d.style.display = 'none';
    d.style.zIndex = '100000'; // Au-dessus du reste
    d.style.width = '400px';
    d.style.height = 'auto';
    d.style.top = '200px';
    d.style.left = '50%';
    d.style.transform = 'translateX(-50%)';
    
    d.innerHTML = `
      <div class="retro-modal-header" id="gif-picker-header">
        <span>>_ SÉLECTION DE FRAME (GIF)</span>
        <button onclick="document.getElementById('gif-picker-modal').style.display='none'" title="Fermer">[X]</button>
      </div>
      <div class="retro-modal-content" style="padding: 15px; background: #222; text-align: center;">
        <div style="color: #64ffda; font-size: 10px; margin-bottom: 10px;">Clique sur la frame à utiliser comme calque fixe :</div>
        <div id="gif-frames-container" style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
          </div>
      </div>
    `;
    document.body.appendChild(d);
    dragElement(d, document.getElementById('gif-picker-header'));
  }
}
// ----------------------------------------------------------
// RESTAURATION DES FONCTIONS PERDUES (Zoom & Drag/Drop)
// ----------------------------------------------------------

// Répare le zoom manuel (+ et -)
function changeZoom(dir) {
  ZOOM = Math.max(2, Math.min(20, ZOOM + dir));
  renderCanvas();
  renderProps();
}

// Répare le glisser-déposer d'images depuis le bureau PC vers le canevas
function dropHandler(e) {
  e.preventDefault();
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    
    // Si c'est bien une image
    if (file.type.startsWith('image/')) {
      // On crée un composant image s'il n'y en a pas de sélectionné
      let c = comps.find(x => x.id === selectedId);
      if (!c || c.type !== 'image') { 
        addComp('image'); 
      }
      // On simule l'upload classique
      handleUpload({ files: [file] });
    }
  }
}
function copyYAML() {
  const ta = document.getElementById('yaml-output');
  if (!ta || !ta.value) return showToast("Rien à copier !", "error");
  ta.select();
  document.execCommand('copy');
  showToast("✅ Code YAML copié !");
}
// =========================================================
// MULTIGIF (V1) - STUB SAFE
// Objectif: éviter "startGifCookerTest is not defined" en prod.
// La vraie implémentation sera greffée ensuite depuis la V2.
// =========================================================
// =========================================================
// MULTIGIF (V1) - MOTEUR DE CUISSON (greffe V2, minimal, safe)
// Dépendances attendues déjà présentes en V1 :
// - sendToHA(base64png, filename)
// - triggerPythonBake(recipeObj)  (si absent: étape 7)
// - _renderCompositeBase64_64x64_syncWithoutImages() (si absent: étape 7)
// - pages / currentPageIndex / logDebug / showToast / generateYAML
// =========================================================
async function startGifCookerTest(forcedOutputFile = "") {
  logDebug("🔥 Démarrage de la cuisson JS + Python...");

  const page = pages[currentPageIndex];
  if (!page) {
    logDebug("❌ MultiGif: page introuvable", "error");
    return false;
  }

  const previewDiv = document.getElementById('gif-frames-preview');
  if (previewDiv) previewDiv.innerHTML = '';

  // =========================================================
  // 1) Génère le calque statique CLEAN (SANS images/lametric)
  // =========================================================
  const overlayCanvas = _renderCompositeBase64_64x64_syncWithoutImages();

  // =========================================================
  // 1.b) Preview VISUEL (avec grille orange)
  // =========================================================
  if (previewDiv) {
    const wrap = document.createElement('div');
    wrap.style.textAlign = 'center';
    wrap.style.margin = 'auto';
    wrap.innerHTML = `<div style="color:#ff9800; font-size:10px; margin-bottom:8px;">CALQUE STATIQUE GÉNÉRÉ</div>`;

    const displayCvs = document.createElement('canvas');
    displayCvs.width = 64;
    displayCvs.height = 64;
    displayCvs.style.border = "1px dashed #ff9800";
    displayCvs.style.background = "repeating-conic-gradient(#333 0% 25%, #111 0% 50%) 50% / 16px 16px";
    displayCvs.style.width = "128px";
    displayCvs.style.height = "128px";
    displayCvs.style.imageRendering = "pixelated";

    const ctx = displayCvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(overlayCanvas, 0, 0);

    wrap.appendChild(displayCvs);
    previewDiv.appendChild(wrap);
  }

  // =========================================================
  // 2) Upload du static_layer vers HA
  // =========================================================
  const b64 = overlayCanvas.toDataURL("image/png");
  const staticFilename = `static_layer_${Date.now()}.png`;
  await sendToHA(b64, staticFilename);

  page.config = page.config || {};
  page.config.static_layer = staticFilename;

  generateYAML();

  // =========================================================
  // 3) Construire la recette pour Python
  // =========================================================
  const recipe = {
    output_file:
      forcedOutputFile ||
      getMultiGifOutputFileForCurrentPage() ||
      "cuisson_finale.gif",

    background_gif: page.config.image_path || "",
    static_layer: staticFilename,
    sensors: [],
    animations: []
  };

  // ✅ CORRECTION CRITIQUE :
  // ne force le nom stable QUE si forcedOutputFile n’est PAS fourni
  if (!forcedOutputFile && page.page_type === "multigif") {
    const stable = getMultiGifOutputFileForCurrentPage();
    if (stable) {
      recipe.output_file = stable;
      logDebug(`🧠 MultiGif output_file forcé: ${stable}`);
    }
  }

  const compsLocal = page.comps || [];

  for (const c of compsLocal) {
    if (c.type === 'sensor') {
      recipe.sensors.push({
        entity_id: c.entity,
        x: Math.round(c.x),
        y: Math.round(c.y),
        font: c.font || "GICKO",
        color: c.color || "#ffffff",
        align: c.text_align || "left",
        show_unit: c.show_unit || false
      });
      continue;
    }

    if (c.type === 'image' || c.type === 'lametric') {

      const H = c.forced_height ? Math.round(c.forced_height) : Math.round(c.h);
      const W = c.forced_height ? Math.round(H * (c.w / c.h)) : Math.round(c.w);

      if (!c.filename) continue;

      recipe.animations.push({
        path: c.filename,
        x: Math.round(c.x),
        y: Math.round(c.y),
        w: W,
        h: H
      });
    }
  }

  // =========================================================
  // 4) Appel Python
  // =========================================================
  if (typeof triggerPythonBake !== 'function') {
    logDebug("❌ triggerPythonBake() manquant.", "error");
    showToast("❌ MultiGif: triggerPythonBake manquant", "error");
    return false;
  }

  return await triggerPythonBake(recipe);
}
async function triggerPythonBake(recipeObj) {
  const token = localStorage.getItem('ha_token');
  if (!token) return false;
  
  showToast("🍳 Cuisson Python en cours...", "info");
  logDebug("Envoi de la recette JSON au Pyscript...");
  
  try {
    logDebug("RECIPE => " + JSON.stringify(recipeObj));
    const res = await fetch('/api/services/pyscript/pixoo_bake_gif', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: JSON.stringify(recipeObj) })
    });
    
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    showToast("✅ Cuisson Python terminée !");
    logDebug("Le Pyscript a terminé la cuisson !");
    return true;
  } catch (e) {
    showToast("❌ Erreur cuisson Python", "error");
    logDebug("❌ Erreur Pyscript : " + e.message, "error");
    return false;
  }
}

// =========================================
// MOTEUR DE CUISSON MULTIGIF (CLEAN STATIC LAYER)
// -> Ce canvas est CELUI QUI EST SAUVÉ (donc AUCUN overlay debug)
// =========================================
function _renderCompositeBase64_64x64_syncWithoutImages() {
  const cvs = document.createElement('canvas');
  cvs.width = 64;
  cvs.height = 64;

  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);

  for (const c of comps) {
    // Si on dessine le sensor ici, le Python écrira par-dessus et créera du ghosting.
    if (c.type === 'image' || c.type === 'lametric' || c.type === 'sensor') continue;

    // --- TEXT / SENSOR / DATETIME ---
    if (['text', 'datetime'].includes(c.type)) {
      let val = (c.content ?? "").toString();

      if (c.type === 'sensor') {
        const ent = haEntities.find(e => e.entity_id === c.entity);
        if (ent) {
          const n = parseFloat(ent.state);
          if (isFinite(n)) val = n.toFixed(c.precision ?? 0);
          else val = (ent.state ?? '').toString();

          if (c.show_unit) val += " " + (ent.attributes?.unit_of_measurement || "");
        } else {
          val = '{VAL}';
        }
      }

      if (c.type === 'datetime') {
        val = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }

      const ls = (isFinite(c.line_spacing) ? c.line_spacing : 1);

      drawWrappedTextPixelPerfect(
        ctx,
        val,
        Math.round(c.x), Math.round(c.y),
        64,
        c.color,
        c.font,
        c.text_align || "left",
        c.grad_active ? c.color2 : null,
        c.grad_dir, c.grad_angle,
        ls
      );
      continue;
    }

    // --- PROGRESS ---
    if (c.type === 'progress') {
      ctx.fillStyle = c.bg_color || "#333333";
      ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.round(c.w), Math.round(c.h));

      let val = 0;
      const ent = haEntities.find(e => e.entity_id === c.entity);
      if (ent && !isNaN(parseFloat(ent.state))) val = parseFloat(ent.state);

      const min = parseFloat(c.min) || 0;
      const max = parseFloat(c.max) || 100;
      const pct = (max - min) === 0 ? 0 : Math.max(0, Math.min(1, (val - min) / (max - min)));

      if (c.conditional_color) {
        ctx.fillStyle = (val < c.threshold) ? c.color_low : c.color_high;
      } else {
        ctx.fillStyle = c.color || "#ffffff";
      }

      ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.round(c.w * pct), Math.round(c.h));
      continue;
    }

    // --- SHAPES ---
    if (['rect', 'round_rect', 'circle'].includes(c.type)) {
      const rgb = hexToRgb(c.color || "#ffffff");
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

      ctx.beginPath();
      if (c.type === 'circle') {
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, 2 * Math.PI);
      } else if (c.type === 'round_rect') {
        const r = c.radius || 3;
        // guard si roundRect absent sur certains navigateurs
        if (ctx.roundRect) ctx.roundRect(c.x, c.y, c.w, c.h, r);
        else ctx.rect(c.x, c.y, c.w, c.h);
      } else {
        ctx.rect(c.x, c.y, c.w, c.h);
      }

      if (c.filled) ctx.fill();
      else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.stroke();
      }
      continue;
    }
  }

  // si tu as cette fonction, garde-la (elle évite des halos/transparences cheloues)
  if (typeof cleanCanvasPixels === 'function') cleanCanvasPixels(ctx, 64, 64);

  return cvs;
}
async function uploadGifPermanentToHA(base64, filename, size=16) {
  const token = localStorage.getItem('ha_token');
  if (!token) return;

  await fetch('/api/services/pyscript/pixoo_upload_gif_permanent_base64', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64_data: base64, filename, size })
  });

  logDebug(`✅ Permanent OK: ${filename}`);
}
//---------------------------------------------------------
// système de pages
//---------------------------------------------------------
function slugifyName(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // retire accents
    .replace(/[^a-z0-9]+/g, "_")                        // tout -> _
    .replace(/^_+|_+$/g, "")                            // trim _
    .replace(/_+/g, "_");                               // compact
}

// appelle ton backend pour sauver la page (recipe + metadata)
async function saveDynamicPage(pageId, recipeObj, forcedOutputFile=null) {
  const token = localStorage.getItem("ha_token");
  if (!token) { showToast("Token HA manquant", "error"); return; }

  const title = (document.getElementById("page-name-input")?.value || "").trim();
  const refreshSec = parseInt(document.getElementById("page-refresh-input")?.value || "60", 10) || 60;

  // ✅ IMPORTANT: si on a déjà "cuit" un fichier, on le réutilise tel quel
  const outputFile = (forcedOutputFile && String(forcedOutputFile).trim())
    ? String(forcedOutputFile).trim()
    : (getMultiGifOutputFileForCurrentPage() || computeOutputFile(pageId));

  recipeObj.output_file = outputFile;

  logDebug(`💾 Save page_id=${pageId} title="${title}" output="${outputFile}" refresh=${refreshSec}s`);

  const res = await fetch("/api/services/pyscript/pixoo_page_save", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      page_id: String(pageId),
      title: title,
      output_file: outputFile,
      refresh_sec: refreshSec,
      enabled: true,
      recipe: JSON.stringify(recipeObj)
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=> "");
    throw new Error(`HTTP ${res.status} ${txt}`);
  }

  showToast(`✅ Page sauvée: ${title || pageId}`, "success");
}

function computeOutputFile(pageId) {
  const page = pages?.[currentPageIndex];

  // 1) priorité à l’output forcé
  let forced = (document.getElementById("page-output-input")?.value || "").trim();
  forced = forced.replace(/\.gif$/i, "");

  // 2) sinon, nom depuis l’UI; si vide, depuis l’objet page
  let title = (document.getElementById("page-name-input")?.value || "").trim();
  if (!title) title = (page?.name || page?.title || "").trim();

  const base = slugifyName(forced || title);
  if (base) return `${base}.gif`;

  // ✅ IMPORTANT: pageId est déjà du type "page_177...."
  // donc fallback = "pageId.gif" (et pas "page_pageId.gif")
  return `${String(pageId)}.gif`;
}
function slugifyName(str) {
  return String(str || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")                        // tout en "_"
    .replace(/^_+|_+$/g, "")                            // trim _
    .slice(0, 64);                                     // limite safe
}

function getMultiGifOutputFileForCurrentPage() {
  const page = pages?.[currentPageIndex];
  if (!page || page.page_type !== "multigif") return "";

  // Assure un id stable
  if (!page.id) page.id = Date.now().toString();

  // 1) Priorité au champ UI (si présent à l’écran)
  const forcedUi = (document.getElementById("page-output-input")?.value || "").trim();
  if (forcedUi) {
    const base = forcedUi.replace(/\.gif$/i, "").trim();
    const slug = slugifyName(base);
    if (slug) return `${slug}.gif`;
  }

  // 2) Sinon priorité à la valeur stockée sur la page
  const forcedPage = (page.output_name || "").trim();
  if (forcedPage) {
    const base = forcedPage.replace(/\.gif$/i, "").trim();
    const slug = slugifyName(base);
    if (slug) return `${slug}.gif`;
  }

  // 3) Sinon nom de page (⚠️ l'UI est source de vérité au moment du publish)
  const uiTitle = (document.getElementById("page-name-input")?.value || "").trim();
  const title = (uiTitle || page.name || "").trim();
  const slugTitle = slugifyName(title);
  if (slugTitle) return `${slugTitle}.gif`;

  // 4) Fallback ultime
  return `page_${page.id}.gif`;
}

function getPreviewOutputFileForCurrentPage() {
  const page = pages?.[currentPageIndex];
  if (page && !page.id) page.id = Date.now().toString();
  const id = page?.id || Date.now().toString();
  return `__preview_${id}.gif`;
  // Variante simple: return "__preview_current.gif";
}
async function startGifCookerProduction() {
  const token = localStorage.getItem("ha_token");
  if (!token) {
    showToast("Token HA manquant", "error");
    return null;
  }

  const page = pages?.[currentPageIndex];
  if (!page || page.page_type !== "multigif") {
    showToast("Pas une page MultiGif", "warn");
    return null;
  }

  // assure un id stable
  if (!page.id) page.id = Date.now().toString();

  // 🔥 nom FINAL stable
  const outputFile =
    getMultiGifOutputFileForCurrentPage() ||
    computeOutputFile(page.id);

  // ✅ construit la recette (upload static_layer inclus)
  const recipeObj = await buildMultiGifRecipeOnly(outputFile);
  recipeObj.output_file = outputFile;

  logDebug(`🔥 [PROD] Cuisson GIF FINAL : ${outputFile}`);

  const res = await fetch("/api/services/pyscript/pixoo_bake_gif", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      recipe: JSON.stringify(recipeObj)
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=> "");
    logDebug(`❌ [PROD] Erreur cuisson: HTTP ${res.status} ${txt}`, "error");
    showToast("Erreur cuisson PROD", "error");
    return null;
  }

  showToast(`✅ GIF PROD mis à jour : ${outputFile}`, "success");
  return outputFile;
}
// ✅ Construit la recette MultiGif (upload static_layer inclus) SANS lancer la cuisson Python
async function buildMultiGifRecipeOnly(forcedOutputFile = "") {
  const page = pages[currentPageIndex];
  if (!page) throw new Error("MultiGif: page introuvable");

  // 1) static layer clean
  const overlayCanvas = _renderCompositeBase64_64x64_syncWithoutImages();

  // 2) upload vers HA
  const b64 = overlayCanvas.toDataURL("image/png");
  const staticFilename = `static_layer_${Date.now()}.png`;
  await sendToHA(b64, staticFilename);

  page.config = page.config || {};
  page.config.static_layer = staticFilename;

  // 3) recette (⚠️ IMPORTANT: on respecte forcedOutputFile si fourni)
  const recipe = {
    output_file: forcedOutputFile || "cuisson_finale.gif",
    background_gif: page.config.image_path || "",
    static_layer: staticFilename,
    sensors: [],
    animations: []
  };

  const compsLocal = page.comps || [];
  for (const c of compsLocal) {
    if (c.type === "sensor") {
      recipe.sensors.push({
        entity_id: c.entity,
        x: Math.round(c.x),
        y: Math.round(c.y),
        font: c.font || "GICKO",
        color: c.color || "#ffffff",
        align: c.text_align || "left",
        show_unit: c.show_unit || false
      });
      continue;
    }

    if (c.type === "image" || c.type === "lametric") {
      const H = c.forced_height ? Math.round(c.forced_height) : Math.round(c.h);
      const W = c.forced_height ? Math.round(H * (c.w / c.h)) : Math.round(c.w);
      if (!c.filename) continue;

      recipe.animations.push({
        path: c.filename,
        x: Math.round(c.x),
        y: Math.round(c.y),
        w: W,
        h: H
      });
    }
  }

  return recipe;
}

function showYamlPublishModal(yamlText) {

  let modal = document.getElementById("pixoo-publish-modal");

  if (!modal) {

    modal = document.createElement("div");
    modal.id = "pixoo-publish-modal";

    modal.style = `
      position:fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background:rgba(0,0,0,0.8);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:99999;
    `;

    modal.innerHTML = `
      <div style="
        background:#111;
        border:1px solid #4af626;
        padding:20px;
        width:420px;
        font-family:monospace;
      ">
        <div style="color:#4af626;margin-bottom:10px;">
          YAML à copier dans l'intégration Pixoo
        </div>

        <textarea id="pixoo-yaml-text"
          style="width:100%;height:120px;background:#000;color:#4af626;">
        </textarea>

        <button onclick="
          navigator.clipboard.writeText(
            document.getElementById('pixoo-yaml-text').value
          );
        ">
        Copier
        </button>

        <button onclick="
          document.getElementById('pixoo-publish-modal').remove()
        ">
        Fermer
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  document.getElementById("pixoo-yaml-text").value = yamlText;
}
async function publishCurrentMultiGifPage() {
  try {

    logDebug("🔥 Publication MultiGif...");

    // 1️⃣ cuisson GIF final
    const file = await startGifCookerProduction();
    if (!file) return;

    // 2️⃣ sauvegarde backend (auto-refresh)
    await saveCurrentMultiGifPageDynamic(file);

    // 3️⃣ construit YAML propre
    const page = pages?.[currentPageIndex];

    const yaml =
`- page_type: gif
  duration: ${page?.duration || 15}
  enabled: "{{ is_state('input_boolean.pixoo_override','on') }}"
  gif_url: http://${HA_LOCAL_IP}/local/pixoo_designer/pixoo_media_gif/${file}`;

    // 4️⃣ affiche modale
    showYamlPublishModal(yaml);

    logDebug("✅ Publication terminée : " + file);
    showToast("✅ Page publiée !");

  }
  catch(e){
    logDebug("❌ Publication erreur: " + (e?.message || e),"error");
    showToast("Erreur publication","error");
  }
}
async function saveCurrentMultiGifPageDynamic() {
  try {
    // Page courante (chez toi c'est plutôt currentPageIndex)
    const page = pages?.[currentPageIndex];
    if (!page) return;

    // ✅ On ne fait ça que pour MultiGif
    if (page.page_type !== "multigif") {
      showToast("⚠️ Pas une page MultiGif", "warn");
      return;
    }

    // 1) Sauvegarde des champs UI -> page
    const nameInput = document.getElementById("page-name-input");
    const outInput  = document.getElementById("page-output-input");
    const refInput  = document.getElementById("page-refresh-input");

    const uiName = (nameInput?.value || "").trim();
    const uiOut  = (outInput?.value || "").trim();
    const uiRef  = parseInt(refInput?.value || "60", 10);

    if (uiName) page.name = uiName;
    page.output_name = uiOut || "";                 // priorité si rempli
    page.refresh_s   = Number.isFinite(uiRef) ? Math.max(10, uiRef) : 60;

    // =========================================================
    // ✅ AJOUT : chemin "SAFE" = on build la recette SANS cuire
    // =========================================================
    if (typeof buildMultiGifRecipeOnly === "function") {
      // ✅ pageId stable (format "page_...")
      let pageId = page.page_id || page.id || page.pageId;
      if (!pageId) pageId = `page_${Date.now()}`;
      page.page_id = pageId; // on persiste

      // output_file final (stable)
      const outputFile = getMultiGifOutputFileForCurrentPage() || computeOutputFile(pageId);

      // build recette sans cuisson
      const recipeObj = await buildMultiGifRecipeOnly(outputFile);

      // sécurité : forcer output_file (au cas où)
      recipeObj.output_file = outputFile;

      // 4) Appel backend
      if (typeof saveDynamicPage !== "function") {
        throw new Error("saveDynamicPage() n'existe pas encore (étape suivante)");
      }

      // ✅ IMPORTANT: on force outputFile au save
      await saveDynamicPage(pageId, recipeObj, outputFile);

      // 5) Feedback UI
      logDebug(`✅ MultiGif dynamic saved: id=${pageId} name=${page.name} output=${outputFile} refresh=${page.refresh_s}s`);
      showToast("✅ Page dynamique sauvegardée !", "success");
      if (typeof generateYAML === "function") generateYAML();
      return; // ✅ on stoppe ici (pas de cuisson)
    }
    // =========================================================
    // ✅ FIN AJOUT
    // =========================================================

    // 2) Construire la recette EXACTEMENT comme ton bouton ENVOYER (MultiGif)
    // -> on réutilise une fonction existante si tu l'as déjà dans ton code
    let recipeObj = null;

    if (typeof buildMultiGifRecipe === "function") {
      recipeObj = await buildMultiGifRecipe();
    } else if (typeof startGifCookerTest === "function") {
      if (!page.id) page.id = Date.now().toString();
      const outFile = getMultiGifOutputFileForCurrentPage() || computeOutputFile(page.id);

      const ok = await startGifCookerTest(outFile);
      if (!ok) throw new Error("Cuisson MultiGif échouée (startGifCookerTest)");

      recipeObj = {
        output_file: outFile,
        background_gif: page.config?.image_path || "",
        static_layer: page.config?.static_layer || "",
        sensors: [],
        animations: []
      };
      (page.comps || []).forEach(c => {
        if (c.type === 'sensor') {
          recipeObj.sensors.push({
            entity_id: c.entity,
            x: Math.round(c.x), y: Math.round(c.y),
            font: c.font || "GICKO",
            color: c.color || "#ffffff",
            align: c.text_align || "left",
            show_unit: c.show_unit || false
          });
        } else if (c.type === 'image' || c.type === 'lametric') {
          const H = c.forced_height ? Math.round(c.forced_height) : Math.round(c.h);
          const W = c.forced_height ? Math.round(H * (c.w / c.h)) : Math.round(c.w);
          if (!c.filename) return;
          recipeObj.animations.push({
            path: c.filename,
            x: Math.round(c.x),
            y: Math.round(c.y),
            w: W,
            h: H
          });
        }
      });
    } else {
      throw new Error("Aucune fonction de build recette MultiGif trouvée (buildMultiGifRecipe/startGifCookerTest)");
    }

    if (page.output_name) {
      const base = page.output_name.replace(/\.gif$/i, "").trim();
      if (base) recipeObj.output_file = `${base}.gif`;
    }

    // ✅ pageId stable (format "page_...")
    let pageId = page.page_id || page.id || page.pageId;
    if (!pageId) pageId = `page_${Date.now()}`;
    page.page_id = pageId;

    if (typeof saveDynamicPage !== "function") {
      throw new Error("saveDynamicPage() n'existe pas encore (étape suivante)");
    }

    // ✅ IMPORTANT: forcer l'outputFile au save
    const outputFile = getMultiGifOutputFileForCurrentPage() || computeOutputFile(pageId);
    recipeObj.output_file = outputFile;
    await saveDynamicPage(pageId, recipeObj, outputFile);

    logDebug(`✅ MultiGif dynamic saved: id=${pageId} name=${page.name} output=${outputFile} refresh=${page.refresh_s}s`);
    showToast("✅ Page dynamique sauvegardée !", "success");
    if (typeof generateYAML === "function") generateYAML();

  } catch (e) {
    logDebug("❌ Save page dynamique: " + (e?.message || e), "error");
    showToast("❌ Erreur save page", "error");
  }
}
