/**
 * Selah Naija - live search suggestions for every search box.
 * Loaded by layout.js on inner pages and by index.html on the homepage.
 */
(function () {
  if (typeof db === "undefined" || !db) return;

  const ICONS  = { song: "bi-music-note-beamed", artist: "bi-person", album: "bi-disc", sermon: "bi-mic", preacher: "bi-person-badge", category: "bi-folder2" };
  const LABELS = { song: "Song", artist: "Artist", album: "Album", sermon: "Sermon", preacher: "Preacher", category: "Category" };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function hrefOf(r) {
    const id = encodeURIComponent(r.id);
    switch (r.kind) {
      case "song":     return `song.html?id=${id}`;
      case "artist":   return `artist.html?id=${id}`;
      case "album":    return `artist.html?id=${encodeURIComponent(r.extra)}&album=${id}`;
      case "sermon":   return `sermon.html?id=${id}`;
      case "preacher": return `preacher.html?id=${id}`;
      case "category": {
        const [cat, sub] = String(r.extra || "").split("|");
        return `category.html?cat=${encodeURIComponent(cat)}` + (sub ? `&sub=${encodeURIComponent(sub)}` : "");
      }
      default: return "search.html";
    }
  }

  function attach(input) {
    if (input.dataset.suggestReady) return;
    const form = input.closest("form");
    if (!form) return;
    input.dataset.suggestReady = "1";
    input.setAttribute("autocomplete", "off");
    form.style.position = "relative";

    const box = document.createElement("div");
    box.className = "suggest-box";
    box.setAttribute("role", "listbox");
    box.hidden = true;
    form.appendChild(box);

    let timer = 0, seq = 0, links = [], active = -1;
    const hide = () => { box.hidden = true; active = -1; };
    const setActive = i => { links.forEach((a, n) => a.classList.toggle("active", n === i)); active = i; };

    function render(rows, q) {
      const seeAll = `<a class="suggest-item suggest-all" href="search.html?q=${encodeURIComponent(q)}"><i class="bi bi-search"></i><span>See all results for “${esc(q)}”</span></a>`;
      const body = rows.length
        ? rows.map(r => `
          <a class="suggest-item" role="option" href="${esc(hrefOf(r))}">
            <i class="bi ${ICONS[r.kind] || "bi-search"}"></i>
            <span class="suggest-text"><span class="suggest-label">${esc(r.label)}</span>${r.sublabel ? `<span class="suggest-sub">${esc(r.sublabel)}</span>` : ""}</span>
            <span class="suggest-kind">${LABELS[r.kind] || ""}</span>
          </a>`).join("")
        : `<div class="suggest-empty">No quick matches. Press Enter to search.</div>`;
      box.innerHTML = body + seeAll;
      links = [...box.querySelectorAll("a.suggest-item")];
      active = -1;
      box.hidden = false;
    }

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { seq++; return hide(); }
      timer = setTimeout(async () => {
        const my = ++seq;
        const { data, error } = await db.rpc("search_suggestions", { q });
        if (my !== seq) return;                       // a newer search already started
        if (error) { console.warn("search_suggestions:", error.message); return hide(); }
        render(data || [], q);
      }, 250);
    });

    input.addEventListener("keydown", e => {
      if (box.hidden || !links.length) return;
      if (e.key === "ArrowDown")      { e.preventDefault(); setActive((active + 1) % links.length); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); setActive(active <= 0 ? links.length - 1 : active - 1); }
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); location.href = links[active].href; }
      else if (e.key === "Escape")    { hide(); }
    });
    input.addEventListener("focus", () => { if (links.length && input.value.trim().length >= 2) box.hidden = false; });
    box.addEventListener("mousedown", e => e.preventDefault());       // keeps the click from closing the box first
    form.addEventListener("submit", hide);
    document.addEventListener("click", e => { if (!form.contains(e.target)) hide(); });
  }

  function start() {
    document.querySelectorAll("[data-search-form] input[name=q], input[data-suggest]").forEach(attach);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();