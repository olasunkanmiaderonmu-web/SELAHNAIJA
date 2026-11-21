/** Selah Naija - A-Z artist directory. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const grid = $("artist-grid"), pager = $("pager"), nav = $("letter-nav");
  const spinner = `<div class="col-12 text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading...</div>`;

  if (!db) {
    grid.innerHTML = `<div class="col-12"><div class="empty-state"><i class="bi bi-plug"></i>${escapeHtml(dbProblem)}</div></div>`;
    return;
  }

  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const params = new URLSearchParams(location.search);
  const wanted = (params.get("letter") || "").toUpperCase();
  const st = {
    letter: (wanted === "#" || LETTERS.includes(wanted)) ? wanted : "",
    page: Math.max(1, parseInt(params.get("page"), 10) || 1)
  };

  // Which letters actually have artists (empty letters are greyed out)
  let available = null;
  const letters = await db.rpc("artist_letters");
  if (!letters.error && letters.data) available = new Set(letters.data.map(r => r.letter));
  else if (letters.error) console.warn("artist_letters:", letters.error.message);
  const hasNumbers = !!available && [...available].some(l => /[0-9]/.test(l));

  function paintLetters() {
    const btn = (value, label) => {
      const off = available && value !== "" && value !== "#" && !available.has(value);
      return `<button class="letter-btn ${st.letter === value ? "active" : ""}" data-letter="${value}" ${off ? "disabled" : ""} aria-label="${value ? "Artists starting with " + label : "All artists"}">${label}</button>`;
    };
    nav.innerHTML = btn("", "All") + (hasNumbers ? btn("#", "#") : "") + LETTERS.map(l => btn(l, l)).join("");
  }

  const photoOf = a => publicUrl("artist-images", a.photo_path);
  const card = a => {
    const href = `artist.html?id=${encodeURIComponent(a.id)}`;
    const n = a.songs?.[0]?.count ?? 0;
    return `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="card card-selah artist-dir-card h-100 text-center">
        <div class="card-body p-4 d-flex flex-column">
          <a href="${href}" class="artist-photo" aria-label="${escapeHtml(a.name)}">${coverHtml(photoOf(a), a.name, "bi-person-fill")}</a>
          <a class="title h5 mb-1" href="${href}">${escapeHtml(a.name)}</a>
          <p class="meta line-clamp-2">${escapeHtml(a.bio || "")}</p>
          <div class="meta mb-3"><i class="bi bi-music-note-list me-1"></i>${n} song${n === 1 ? "" : "s"}</div>
          <a class="btn btn-primary btn-sm mt-auto" href="${href}">View Artist</a>
        </div>
      </div>
    </div>`;
  };

  function syncUrl() {
    const p = new URLSearchParams();
    if (st.letter) p.set("letter", st.letter);
    if (st.page > 1) p.set("page", st.page);
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  async function load() {
    grid.innerHTML = spinner;
    $("list-title").textContent = st.letter ? `Artists starting with “${st.letter}”` : "All artists";
    const size = CONFIG.PAGE_SIZE || 12, from = (st.page - 1) * size;

    let q = db.from("artists").select("id,name,bio,photo_path,songs(count)", { count: "exact" });
    if (st.letter === "#") q = q.or([0,1,2,3,4,5,6,7,8,9].map(d => `name.ilike.${d}%`).join(","));
    else if (st.letter) q = q.ilike("name", st.letter + "%");
    q = q.order("name", { ascending: true }).order("id").range(from, from + size - 1);

    const { data, error, count } = await q;
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      return renderList(grid, [], card, "bi-exclamation-triangle", "We could not load the artists. Please refresh the page.");
    }
    renderList(grid, data || [], card, "bi-person-lines-fill",
      st.letter ? `No artists whose names start with “${st.letter}” yet.` : "Artists will appear here once they are added.");
    $("result-count").textContent = count ? `${count} artist${count === 1 ? "" : "s"}` : "";
    renderPager(pager, st.page, Math.ceil((count || 0) / size), p => {
      st.page = p; load(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    syncUrl();
  }

  nav.addEventListener("click", e => {
    const b = e.target.closest("[data-letter]");
    if (!b || b.disabled) return;
    st.letter = b.dataset.letter; st.page = 1; paintLetters(); load();
  });

  paintLetters();
  load();
});