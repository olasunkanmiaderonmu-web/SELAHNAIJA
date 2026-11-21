/** Selah Naija - small reusable helpers and card templates. */

const escapeHtml = (v = "") =>
  String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const slugify = s => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const formatNumber = n => new Intl.NumberFormat("en", { notation: "compact" }).format(n || 0);

const formatDuration = secs => {
  secs = Math.round(secs || 0);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
};

const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/** Shows cards, or a friendly empty state when there is nothing to show. */
function renderList(el, items, templateFn, emptyIcon, emptyText) {
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = `<div class="col-12"><div class="empty-state"><i class="bi ${emptyIcon}"></i>${escapeHtml(emptyText)}</div></div>`;
    return;
  }
  el.innerHTML = items.map(templateFn).join("");
}

const coverHtml = (url, alt, icon) =>
  url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy">` : `<i class="bi ${icon}"></i>`;

/* ---- Card templates (data comes from Supabase in Phase 2) ---- */
const songCard = s => `
  <div class="col-6 col-md-4 col-lg-3 col-xl-2">
    <div class="card card-selah h-100">
      <div class="media-cover">${coverHtml(s.cover_url, s.title, "bi-music-note-beamed")}
        <button class="play-overlay" data-play-song="${escapeHtml(s.id)}" aria-label="Play ${escapeHtml(s.title)}"><i class="bi bi-play-fill"></i></button>
      </div>
      <div class="card-body">
        <a class="title text-truncate" href="song.html?id=${encodeURIComponent(s.id)}">${escapeHtml(s.title)}</a>
        <div class="meta text-truncate">${escapeHtml(s.artist_name)}</div>
        <div class="d-flex justify-content-between align-items-center mt-2">
          <span class="chip">${escapeHtml(s.category_name || "Gospel")}</span>
          <span class="meta"><i class="bi bi-play"></i> ${formatNumber(s.plays)} <i class="bi bi-download ms-1"></i> ${formatNumber(s.downloads)}</span>
        </div>
        <div class="d-flex gap-1 mt-2">
          <button class="btn btn-sm btn-primary flex-grow-1" data-download-song="${escapeHtml(s.id)}"><i class="bi bi-download me-1"></i>Download</button>
          <button class="btn btn-sm btn-outline-primary" data-fav-song="${escapeHtml(s.id)}" aria-label="Add to favourites"><i class="bi bi-heart"></i></button>
          <button class="btn btn-sm btn-outline-primary" data-playlist-song="${escapeHtml(s.id)}" aria-label="Add to playlist"><i class="bi bi-plus-lg"></i></button>
        </div>      </div>
    </div>
  </div>`;

const sermonCard = s => `
  <div class="col-12 col-md-6 col-lg-4">
    <div class="card card-selah h-100"><div class="card-body d-flex gap-3">
      <div class="media-cover flex-shrink-0" style="width:96px;font-size:1.8rem">${coverHtml(s.cover_url, s.title, "bi-mic")}</div>
      <div class="min-w-0">
        <a class="title" href="sermon.html?id=${encodeURIComponent(s.id)}">${escapeHtml(s.title)}</a>
        <div class="meta">${escapeHtml(s.preacher_name)}</div>
        <div class="mt-1"><span class="chip">${escapeHtml(s.category_name || "Sermon")}</span> <span class="meta ms-1"><i class="bi bi-clock"></i> ${formatDuration(s.duration)}</span></div>
        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-sm btn-primary" data-play-sermon="${escapeHtml(s.id)}"><i class="bi bi-play-fill"></i> Play</button>
          <button class="btn btn-sm btn-outline-primary" data-download-sermon="${escapeHtml(s.id)}" aria-label="Download sermon"><i class="bi bi-download"></i></button>
        </div>
      </div>
    </div></div>
  </div>`;

const artistCard = a => `
  <div class="col-6 col-md-4 col-lg-2">
    <a href="artist.html?id=${encodeURIComponent(a.id)}" class="card card-selah artist-card text-decoration-none h-100">
      <div class="artist-photo">${coverHtml(a.photo_url, a.name, "bi-person-fill")}</div>
      <div class="title">${escapeHtml(a.name)}</div>
      <div class="meta">${formatNumber(a.song_count)} songs</div>
    </a>
  </div>`;

const playlistCard = p => `
  <div class="col-6 col-md-4 col-lg-2">
    <div class="card card-selah h-100">
      <div class="media-cover">${coverHtml(p.cover_url, p.name, "bi-collection-play")}</div>
      <div class="card-body"><a class="title" href="playlist.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>
      <div class="meta">${formatNumber(p.song_count)} songs</div></div>
    </div>
  </div>`;

/* ---- Runs on every page ---- */
document.addEventListener("DOMContentLoaded", () => {
  // Every search form sends the visitor to the search results page
  document.querySelectorAll("[data-search-form]").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const q = form.querySelector("input[name=q]").value.trim();
      if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    });
  });
  // Footer year
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
});