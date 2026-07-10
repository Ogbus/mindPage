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

// ── Boot ────────────────────────────────────────────────────────
renderList();
if (entries.length) openEntry(entries[0].id);