// ── Storage helpers ─────────────────────────────────────────────
const STORE_KEY = 'mindpage_entries';

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function save(entries) {
  localStorage.setItem(STORE_KEY, JSON.stringify(entries));
}

// ── State ───────────────────────────────────────────────────────
let entries = load();
let activeId = null;
let saveTimer = null;
let searchQuery = '';

// ── DOM refs ────────────────────────────────────────────────────
const entryList    = document.getElementById('entry-list');
const entryCount   = document.getElementById('entry-count');
const emptyState   = document.getElementById('empty-state');
const editorWrapper= document.getElementById('editor-wrapper');
const titleInput   = document.getElementById('entry-title');
const bodyInput    = document.getElementById('entry-body');
const tagInput     = document.getElementById('tag-input');
const tagsContainer= document.getElementById('tags-container');
const wordCount    = document.getElementById('word-count');
const saveStatus   = document.getElementById('save-status');
const searchInput  = document.getElementById('search');
const toast        = document.getElementById('toast');

 // ── Utilities ───────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function fmt(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
}

function words(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Render sidebar list ─────────────────────────────────────────
function renderList() {
  const q = searchQuery.toLowerCase();
  const filtered = entries.filter(e =>
    !q || e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q) || (e.tags || []).some(t => t.includes(q))
  ).sort((a, b) => new Date(b.created) - new Date(a.created));

  entryList.innerHTML = '';
  entryCount.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;

  if (!filtered.length) {
    entryList.innerHTML = `<p style="padding:1rem;font-size:.78rem;color:var(--ink-faint);font-style:italic;">${q ? 'Nothing matched.' : 'No entries yet.'}</p>`;
    return;
  }

  filtered.forEach(e => {
    const item = document.createElement('div');
    item.className = 'entry-item' + (e.id === activeId ? ' active' : '');
    item.dataset.id = e.id;
    item.innerHTML = `
      <div class="entry-item-date">${fmt(e.created)} ${e.mood || ''}</div>
      <div class="entry-item-title">${e.title || 'Untitled'}</div>
      <div class="entry-item-snippet">${e.body.slice(0, 70) || '…'}</div>
    `;
    item.addEventListener('click', () => openEntry(e.id));
    entryList.appendChild(item);
  });
}

// ── Open entry ──────────────────────────────────────────────────
function openEntry(id) {
  activeId = id;
  const e = entries.find(x => x.id === id);
  if (!e) return;

  emptyState.style.display = 'none';
  editorWrapper.style.display = 'flex';

  titleInput.value = e.title;
  bodyInput.value  = e.body;
  updateWordCount();
  renderTags(e.tags || []);
  renderMoodButtons(e.mood);
  saveStatus.textContent = 'Saved';
  saveStatus.classList.add('saved');

  renderList();
  titleInput.focus();
}

// ── Create entry ────────────────────────────────────────────────
function createEntry() {
  const e = { id: uid(), title: '', body: '', tags: [], mood: '', created: new Date().toISOString() };
  entries.unshift(e);
  save(entries);
  openEntry(e.id);
}

// ── Autosave ─────────────────────────────────────────────────────
function scheduleAutosave() {
  saveStatus.textContent = 'Editing…';
  saveStatus.classList.remove('saved');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(commitSave, 1200);
}

function commitSave() {
  if (!activeId) return;
  const e = entries.find(x => x.id === activeId);
  if (!e) return;
  e.title = titleInput.value;
  e.body  = bodyInput.value;
  save(entries);
  saveStatus.textContent = 'Saved';
  saveStatus.classList.add('saved');
  renderList();
}

// ── Word count ──────────────────────────────────────────────────
function updateWordCount() {
  const w = words(bodyInput.value);
  wordCount.textContent = `${w} word${w !== 1 ? 's' : ''}`;
}

// ── Tags ────────────────────────────────────────────────────────
function renderTags(tags) {
  tagsContainer.innerHTML = '';
  tags.forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${t}<button title="Remove tag" aria-label="Remove ${t}">×</button>`;
    chip.querySelector('button').addEventListener('click', () => removeTag(t));
    tagsContainer.appendChild(chip);
  });
}

function addTag(tag) {
  tag = tag.trim().toLowerCase().replace(/\s+/g, '-');
  if (!tag) return;
  const e = entries.find(x => x.id === activeId);
  if (!e) return;
  if (!e.tags.includes(tag)) {
    e.tags.push(tag);
    save(entries);
    renderTags(e.tags);
    renderList();
  }
}

function removeTag(tag) {
  const e = entries.find(x => x.id === activeId);
  if (!e) return;
  e.tags = e.tags.filter(t => t !== tag);
  save(entries);
  renderTags(e.tags);
}

// ── Mood ────────────────────────────────────────────────────────
function renderMoodButtons(selected) {
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.mood === selected);
  });
}

document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const e = entries.find(x => x.id === activeId);
    if (!e) return;
    const prev = e.mood;
    e.mood = prev === btn.dataset.mood ? '' : btn.dataset.mood;
    save(entries);
    renderMoodButtons(e.mood);
    renderList();
  });
});

// ── Delete ──────────────────────────────────────────────────────
document.getElementById('delete-btn').addEventListener('click', () => {
  if (!activeId) return;
  const e = entries.find(x => x.id === activeId);
  const name = e?.title || 'this entry';
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  entries = entries.filter(x => x.id !== activeId);
  save(entries);
  activeId = null;
  editorWrapper.style.display = 'none';
  emptyState.style.display = 'flex';
  renderList();
  showToast('Entry deleted.');
});

// ── Export ──────────────────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  if (!activeId) return;
  const e = entries.find(x => x.id === activeId);
  if (!e) return;

  // 1. Initialize jsPDF (Note the global namespace structure for version 2.x+)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // 2. Setup layout variables
  const margin = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxLineWidth = pageWidth - (margin * 2);
  let currentY = margin;

  // Helper to check for page overflows and add a new page if needed
  function checkPageOverflow(lineHeight) {
    if (currentY + lineHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin; // Reset to top margin on new page
    }
  }

  // 3. Add Title
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  const titleText = e.title || 'Untitled';
  const titleLines = doc.splitTextToSize(titleText, maxLineWidth);
  titleLines.forEach(line => {
    checkPageOverflow(8);
    doc.text(line, margin, currentY);
    currentY += 8;
  });
  currentY += 4; // Extra spacing after title

  // 4. Add Metadata (Date & Mood)
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100); // Muted gray color
  
  const metaText = `${fmt(e.created)}${e.mood ? '  |  Mood: ' + e.mood : ''}`;
  checkPageOverflow(5);
  doc.text(metaText, margin, currentY);
  currentY += 5;

  // 5. Add Tags (if any exist)
  if (e.tags && e.tags.length > 0) {
    const tagsText = `Tags: ${e.tags.join(', ')}`;
    checkPageOverflow(5);
    doc.text(tagsText, margin, currentY);
    currentY += 5;
  }
  currentY += 10; // Spacing before body text

  // 6. Add Body Text (With Text Wrapping & Multi-page support)
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0); // Back to black

  // Split paragraphs by newline to preserve spacing structure
  const paragraphs = e.body.split('\n');
  
  paragraphs.forEach(paragraph => {
    // If it's an empty line, just add a paragraph break spacing
    if (paragraph.trim() === '') {
      currentY += 5;
      return;
    }

    // Wrap text to fit inside the PDF margins safely
    const bodyLines = doc.splitTextToSize(paragraph, maxLineWidth);
    bodyLines.forEach(line => {
      checkPageOverflow(7);
      doc.text(line, margin, currentY);
      currentY += 7;
    });
  });

  // 7. Trigger the PDF download
  const filename = (e.title || 'mindpage-entry').replace(/\s+/g, '-') + '.pdf';
  doc.save(filename);
  
  showToast('Exported PDF!');
});

// ── Mobile sidebar toggle ────────────────────────────────────────
const sidebar   = document.querySelector('aside');
const backdrop  = document.getElementById('sidebar-backdrop');

function openSidebar() {
  sidebar.classList.add('open');
  backdrop.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  backdrop.classList.remove('visible');
  document.body.style.overflow = '';
}

backdrop.addEventListener('click', closeSidebar);
document.getElementById('mobile-entries-btn').addEventListener('click', openSidebar);
document.getElementById('mobile-new-btn').addEventListener('click', () => {
  createEntry();
  closeSidebar();
});

// Close sidebar when an entry is tapped on mobile
entryList.addEventListener('click', () => {
  if (window.innerWidth <= 640) closeSidebar();
});


//  document.getElementById('export-btn').addEventListener('click', () => {
//    if (!activeId) return;
//    const e = entries.find(x => x.id === activeId);
//    if (!e) return;
//    const text = [
//      `${e.title || 'Untitled'}`,
//      `${fmt(e.created)}${e.mood ? '  ' + e.mood : ''}`,
//      e.tags.length ? `Tags: ${e.tags.join(', ')}` : '',
//      '',
//      e.body
//    ].filter(l => l !== undefined).join('\n');

//    const a = document.createElement('a');
//    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
//    a.download = (e.title || 'mindpage-entry').replace(/\s+/g, '-') + '.txt';
//    a.click();
//    showToast('Exported!');
//  });

// ── Event wiring ────────────────────────────────────────────────
document.getElementById('new-entry-btn').addEventListener('click', createEntry);

titleInput.addEventListener('input', scheduleAutosave);

bodyInput.addEventListener('input', () => {
  updateWordCount();
  scheduleAutosave();
  // Auto-resize
  bodyInput.style.height = 'auto';
  bodyInput.style.height = bodyInput.scrollHeight + 'px';
});

tagInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addTag(tagInput.value);
    tagInput.value = '';
  }
});
tagInput.addEventListener('blur', () => {
  if (tagInput.value.trim()) { addTag(tagInput.value); tagInput.value = ''; }
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderList();
});

// Save before leaving
window.addEventListener('beforeunload', commitSave);

// ── Dark mode ────────────────────────────────────────────────────
const THEME_KEY = 'mindpage_theme';
const themeToggle = document.getElementById('theme-toggle');
const htmlEl = document.documentElement;

function applyTheme(theme) {
  htmlEl.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
  } else {
    // Detect OS preference on first visit
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

themeToggle.addEventListener('click', () => {
  const current = htmlEl.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// Also listen for OS theme changes at runtime
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? 'dark' : 'light');
});

initTheme();

// ── PWA icon + manifest (self-contained, no external files) ─────
const iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 680">
    <rect width="680" height="680" rx="140" fill="#f0f4ff"/>
    <rect x="0" y="340" width="680" height="340" fill="#e8f0fe"/>
    <rect x="0" y="460" width="680" height="220" fill="#d4e4f7"/>
    <rect x="0" y="540" width="680" height="140" fill="#b8d4f0" opacity="0.6"/>
    <ellipse cx="160" cy="180" rx="90" ry="38" fill="#fff" opacity="0.85"/>
    <ellipse cx="220" cy="165" rx="70" ry="32" fill="#fff" opacity="0.9"/>
    <ellipse cx="500" cy="140" rx="75" ry="30" fill="#fff" opacity="0.75"/>
    <ellipse cx="555" cy="128" rx="55" ry="25" fill="#fff" opacity="0.8"/>
    <circle cx="340" cy="200" r="62" fill="#f9c74f"/>
    <circle cx="340" cy="200" r="48" fill="#ffd166"/>
    <line x1="340" y1="118" x2="340" y2="96" stroke="#f9c74f" stroke-width="5" stroke-linecap="round"/>
    <line x1="398" y1="142" x2="412" y2="128" stroke="#f9c74f" stroke-width="5" stroke-linecap="round"/>
    <line x1="422" y1="200" x2="444" y2="200" stroke="#f9c74f" stroke-width="5" stroke-linecap="round"/>
    <line x1="398" y1="258" x2="412" y2="272" stroke="#f9c74f" stroke-width="5" stroke-linecap="round"/>
    <line x1="282" y1="142" x2="268" y2="128" stroke="#f9c74f" stroke-width="5" stroke-linecap="round"/>
    <line x1="258" y1="200" x2="236" y2="200" stroke="#f9c74f" stroke-width="5" stroke-linecap="round"/>
    <line x1="282" y1="258" x2="268" y2="272" stroke="#f9c74f" stroke-width="5" stroke-linecap="round"/>
    <line x1="340" y1="282" x2="340" y2="304" stroke="#f9c74f" stroke-width="5" stroke-linecap="round"/>
    <rect x="148" y="402" width="390" height="248" rx="18" fill="#000" opacity="0.12"/>
    <rect x="140" y="388" width="390" height="248" rx="18" fill="#fffdf8"/>
    <rect x="318" y="388" width="28" height="248" fill="#e8e2d6"/>
    <line x1="168" y1="442" x2="310" y2="442" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="168" y1="470" x2="310" y2="470" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="168" y1="498" x2="310" y2="498" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="168" y1="526" x2="288" y2="526" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="168" y1="554" x2="310" y2="554" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="168" y1="582" x2="258" y2="582" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="354" y1="442" x2="502" y2="442" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="354" y1="470" x2="502" y2="470" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="354" y1="498" x2="482" y2="498" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="354" y1="526" x2="502" y2="526" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="354" y1="554" x2="462" y2="554" stroke="#d0cabb" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="474" y="368" width="14" height="88" rx="7" fill="#4a7c59" transform="rotate(28 474 368)"/>
    <polygon points="488,444 502,437 496,457" fill="#a8c5b0"/>
</svg>`;

const iconDataURL = 'data:image/svg+xml;base64,' + btoa(iconSVG);

// Apple touch icon
document.getElementById('apple-touch-icon').href = iconDataURL;

// Web app manifest as a blob
const manifest = {
name: 'Mindpage',
short_name: 'Mindpage',
description: 'Your quiet daily thought notebook',
start_url: '.',
display: 'standalone',
background_color: '#f0f4ff',
theme_color: '#f0f4ff',
icons: [{ src: iconDataURL, sizes: 'any', type: 'image/svg+xml' }]
};
const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
const manifestURL = URL.createObjectURL(manifestBlob);
const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = manifestURL;
document.head.appendChild(manifestLink);


// ── Boot ────────────────────────────────────────────────────────
renderList();
if (entries.length) openEntry(entries[0].id);