/** Selah Naija - music library and latest releases (filter, sort, pages). */
document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("song-grid");
  const pager = document.getElementById("pager");
  const countEl = document.getElementById("result-count");
  const catSel = document.getElementById("filter-category");
  const sortSel = document.getElementById("filter-sort");
  const defaultSort = document.body.dataset.sort || "newest";
  const spinner = `<div class="col-12 text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading...</div>`;

  if (!db) {
    grid.innerHTML = `<div class="col-12"><div class="empty-state"><i class="bi bi-plug"></i>${escapeHtml(dbProblem)}</div></div>`;
    return;
  }

  // Filters
  sortSel.innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("");
  const { data: catData } = await db.from("categories").select("id,name,slug").neq("applies_to", "sermon").order("sort_order");
  const cats = catData || [];
  catSel.innerHTML = `<option value="">All categories</option>` + cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  const params = new URLSearchParams(location.search);
  const st = {
    page: Math.max(1, parseInt(params.get("page"), 10) || 1),
    sort: SORTS[params.get("sort")] ? params.get("sort") : defaultSort,
    catId: (cats.find(c => c.slug === params.get("cat")) || {}).id || ""
  };
  catSel.value = st.catId;
  sortSel.value = st.sort;

  function syncUrl() {
    const p = new URLSearchParams();
    const cat = cats.find(c => c.id === st.catId);
    if (cat) p.set("cat", cat.slug);
    if (st.sort !== defaultSort) p.set("sort", st.sort);
    if (st.page > 1) p.set("page", st.page);
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  async function load() {
    grid.innerHTML = spinner;
    const size = CONFIG.PAGE_SIZE || 12;
    const from = (st.page - 1) * size;
    const sort = SORTS[st.sort];

    let q = db.from("songs").select(SONG_FIELDS, { count: "exact" }).eq("status", "published");
    if (st.catId) q = q.eq("category_id", st.catId);
    q = q.order(sort.col, { ascending: sort.asc }).order("id").range(from, from + size - 1);

    const { data, error, count } = await q;
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }   // page number too high
      console.error(error);
      renderList(grid, [], songCard, "bi-exclamation-triangle", "We could not load the songs. Please refresh the page.");
      return;
    }
    renderList(grid, (data || []).map(mapSong), songCard, "bi-music-note-list",
      st.catId ? "No songs in this category yet." : "No songs published yet. New gospel music will appear here soon.");
    countEl.textContent = count ? `${count} song${count === 1 ? "" : "s"}` : "";
    renderPager(pager, st.page, Math.ceil((count || 0) / size), p => {
      st.page = p; syncUrl(); load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    syncUrl();
  }

  catSel.addEventListener("change", () => { st.catId = catSel.value; st.page = 1; load(); });
  sortSel.addEventListener("change", () => { st.sort = sortSel.value; st.page = 1; load(); });
  load();
});