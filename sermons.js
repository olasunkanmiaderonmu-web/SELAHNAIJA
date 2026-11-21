/** Selah Naija - sermon library: search, category filter, sorting, pages. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const grid = $("sermon-grid"), pager = $("pager"), sortSel = $("filter-sort"), catSel = $("filter-category"), searchInput = $("search-input");
  const spinner = `<div class="col-12 text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading...</div>`;

  if (!db) {
    grid.innerHTML = `<div class="col-12"><div class="empty-state"><i class="bi bi-plug"></i>${escapeHtml(dbProblem)}</div></div>`;
    return;
  }

  // ---------- Preachers strip ----------
  (async () => {
    const { data } = await db.from("preachers").select("id,name,photo_path,sermons(count)").order("name").limit(40);
    const list = (data || []).filter(p => (p.sermons?.[0]?.count ?? 0) > 0).slice(0, 12);
    if (!list.length) return;
    $("preacher-wrap").hidden = false;
    $("preacher-strip").innerHTML = list.map(p => `
      <a class="preacher-chip" href="preacher.html?id=${encodeURIComponent(p.id)}">
        <span class="avatar">${coverHtml(publicUrl("artist-images", p.photo_path), p.name, "bi-person-fill")}</span>${escapeHtml(p.name)}
      </a>`).join("");
  })();

  // ---------- Category filter (sermon categories and their subcategories) ----------
  const { data: catData } = await db.from("categories")
    .select("id,name,slug,applies_to,subcategories(id,name,slug,sort_order)")
    .in("applies_to", ["sermon", "both"]).order("sort_order");
  const cats = (catData || []).map(c => ({ ...c, subs: (c.subcategories || []).sort((a, b) => a.sort_order - b.sort_order) }));

  catSel.innerHTML = `<option value="">All categories</option>` + cats.map(c => c.subs.length
    ? `<optgroup label="${escapeHtml(c.name)}"><option value="c:${c.id}">All ${escapeHtml(c.name)}</option>${c.subs.map(s => `<option value="s:${s.id}">${escapeHtml(s.name)}</option>`).join("")}</optgroup>`
    : `<option value="c:${c.id}">${escapeHtml(c.name)}</option>`).join("");
  sortSel.innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("");

  // ---------- Start from the address bar (?q= ?cat= ?sub= ?sort= ?page=) ----------
  const params = new URLSearchParams(location.search);
  const startFilter = () => {
    const sub = params.get("sub"), cat = params.get("cat");
    for (const c of cats) {
      const s = sub && c.subs.find(x => x.slug === sub && (!cat || c.slug === cat));
      if (s) return "s:" + s.id;
    }
    const c = cats.find(x => x.slug === cat);
    return c ? "c:" + c.id : "";
  };
  const st = {
    q: (params.get("q") || "").trim(),
    filter: startFilter(),
    sort: SORTS[params.get("sort")] ? params.get("sort") : "newest",
    page: Math.max(1, parseInt(params.get("page"), 10) || 1)
  };
  searchInput.value = st.q;
  catSel.value = st.filter;
  sortSel.value = st.sort;

  function syncUrl() {
    const p = new URLSearchParams();
    if (st.q) p.set("q", st.q);
    if (st.filter) {
      const id = st.filter.slice(2);
      for (const c of cats) {
        if (st.filter[0] === "c" && c.id === id) { p.set("cat", c.slug); break; }
        const s = st.filter[0] === "s" && c.subs.find(x => x.id === id);
        if (s) { p.set("cat", c.slug); p.set("sub", s.slug); break; }
      }
    }
    if (st.sort !== "newest") p.set("sort", st.sort);
    if (st.page > 1) p.set("page", st.page);
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  async function load() {
    grid.innerHTML = spinner;
    const size = CONFIG.PAGE_SIZE || 12, from = (st.page - 1) * size, sort = SORTS[st.sort];

    let q = db.from("sermons").select(SERMON_FIELDS, { count: "exact" }).eq("status", "published");
    if (st.filter.startsWith("s:")) q = q.eq("subcategory_id", st.filter.slice(2));
    else if (st.filter.startsWith("c:")) q = q.eq("category_id", st.filter.slice(2));

    // Search: title OR topic OR preacher name
    const text = st.q.replace(/[%,()*\\"]/g, " ").trim();
    if (text) {
      const { data: pr } = await db.from("preachers").select("id").ilike("name", `%${text}%`).limit(50);
      const ids = (pr || []).map(p => p.id);
      const parts = [`title.ilike.*${text}*`, `topic.ilike.*${text}*`];
      if (ids.length) parts.push(`preacher_id.in.(${ids.join(",")})`);
      q = q.or(parts.join(","));
    }

    q = q.order(sort.col, { ascending: sort.asc }).order("id").range(from, from + size - 1);
    const { data, error, count } = await q;
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      return renderList(grid, [], sermonCard, "bi-exclamation-triangle", "We could not load the sermons. Please refresh the page.");
    }
    renderList(grid, (data || []).map(mapSermon), sermonCard, "bi-mic",
      text ? `No sermons found for “${text}”. Try another preacher, topic or title.` : "No sermons yet. Check back soon for inspiring messages.");
    $("result-count").textContent = count ? `${count} sermon${count === 1 ? "" : "s"}${text ? ` for “${text}”` : ""}` : "";
    renderPager(pager, st.page, Math.ceil((count || 0) / size), p => {
      st.page = p; syncUrl(); load(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    syncUrl();
  }

  $("search-form").addEventListener("submit", e => { e.preventDefault(); st.q = searchInput.value.trim(); st.page = 1; load(); });
  catSel.addEventListener("change", () => { st.filter = catSel.value; st.page = 1; load(); });
  sortSel.addEventListener("change", () => { st.sort = sortSel.value; st.page = 1; load(); });
  load();
});