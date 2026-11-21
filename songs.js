/** Selah Naija - song helpers shared by the music, latest, song, category and artist pages. */

const SONG_FIELDS = "id,title,cover_path,plays,downloads,artists(name),categories(name)";

const mapSong = s => ({
  id: s.id,
  title: s.title,
  cover_url: publicUrl("song-covers", s.cover_path),
  artist_name: s.artists?.name || "",
  category_name: s.categories?.name,
  plays: s.plays,
  downloads: s.downloads
});

const SORTS = {
  newest:    { label: "Newest first",    col: "published_at", asc: false },
  popular:   { label: "Most played",     col: "plays",        asc: false },
  downloads: { label: "Most downloaded", col: "downloads",    asc: false },
  az:        { label: "Title A-Z",       col: "title",        asc: true  }
};

/** Draws Previous / 1 2 3 / Next buttons. goTo(pageNumber) is called when one is clicked. */
function renderPager(el, page, totalPages, goTo) {
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ""; return; }
  const start = Math.max(1, page - 2), end = Math.min(totalPages, page + 2);
  const item = (p, label, disabled, active) =>
    `<li class="page-item ${disabled ? "disabled" : ""} ${active ? "active" : ""}"><button class="page-link" data-page="${p}">${label}</button></li>`;
  let html = item(page - 1, "Previous", page === 1);
  if (start > 1) html += item(1, "1") + (start > 2 ? `<li class="page-item disabled"><span class="page-link">…</span></li>` : "");
  for (let p = start; p <= end; p++) html += item(p, p, false, p === page);
  if (end < totalPages) html += (end < totalPages - 1 ? `<li class="page-item disabled"><span class="page-link">…</span></li>` : "") + item(totalPages, totalPages);
  html += item(page + 1, "Next", page === totalPages);
  el.innerHTML = `<ul class="pagination justify-content-center flex-wrap">${html}</ul>`;
  el.onclick = e => {
    const b = e.target.closest("[data-page]");
    if (b && !b.parentElement.classList.contains("disabled")) goTo(parseInt(b.dataset.page, 10));
  };
}