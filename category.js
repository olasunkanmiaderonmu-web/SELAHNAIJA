/** Selah Naija - one category page (songs and/or sermons, with subcategory filters), or the list of all categories. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const spinner = `<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading...</div>`;
  const browse = $("browse-all"), view = $("category-view");

  const SERMON_FIELDS = "id,title,cover_path,duration_seconds,plays,downloads,preachers(name),categories(name)";
  const mapSermon = s => ({
    id: s.id, title: s.title, cover_url: publicUrl("sermon-covers", s.cover_path),
    preacher_name: s.preachers?.name || "", category_name: s.categories?.name, duration: s.duration_seconds
  });

  const message = (icon, html) => {
    view.hidden = true; browse.hidden = false;
    browse.innerHTML = `<div class="empty-state"><i class="bi ${icon}"></i>${html}</div>`;
  };

  if (!db) return message("bi-plug", escapeHtml(dbProblem));

  const params = new URLSearchParams(location.search);
  const slug = params.get("cat");
  if (!slug) return showAll();

  // ---------- One category ----------
  const { data: cat, error } = await db.from("categories")
    .select("id,name,slug,description,applies_to,subcategories(id,name,slug,sort_order)")
    .eq("slug", slug).maybeSingle();
  if (error) console.error(error);
  if (error || !cat) return message("bi-folder-x", `We could not find this category. <a href="category.html">See all categories</a>`);

  const subs = (cat.subcategories || []).sort((a, b) => a.sort_order - b.sort_order);
  const kinds = cat.applies_to === "both" ? ["songs", "sermons"] : [cat.applies_to === "sermon" ? "sermons" : "songs"];
  const st = {
    kind: kinds.includes(params.get("type")) ? params.get("type") : kinds[0],
    sub: (subs.find(s => s.slug === params.get("sub")) || {}).id || "",
    sort: SORTS[params.get("sort")] ? params.get("sort") : "newest",
    page: Math.max(1, parseInt(params.get("page"), 10) || 1)
  };

  const grid = $("content-grid"), pager = $("pager"), pills = $("sub-pills"), tabs = $("kind-tabs"), sortSel = $("filter-sort");
  browse.hidden = true; view.hidden = false;

  const subName = () => (subs.find(s => s.id === st.sub) || {}).name;
  const kindWord = () => (st.kind === "songs" ? "gospel music" : "sermons");

  function paintHeader() {
    const title = subName() ? `${subName()} · ${cat.name}` : cat.name;
    $("cat-title").textContent = subName() || cat.name;
    $("crumb-cat").textContent = cat.name;
    $("cat-desc").textContent = cat.description || `Browse ${cat.name} ${kindWord()} on Selah Naija.`;
    setPageMeta({
      title: `${title} ${st.kind === "songs" ? "Gospel Music" : "Sermons"} | Selah Naija`,
      description: cat.description || `Stream and download ${cat.name} ${kindWord()} on Selah Naija.`
    });
  }

  function paintPills() {
    pills.hidden = !subs.length;
    pills.innerHTML = [`<button class="pill ${st.sub ? "" : "active"}" data-sub="">All</button>`]
      .concat(subs.map(s => `<button class="pill ${st.sub === s.id ? "active" : ""}" data-sub="${s.id}">${escapeHtml(s.name)}</button>`)).join("");
  }

  function paintTabs() {
    tabs.hidden = kinds.length < 2;
    tabs.innerHTML = kinds.map(k =>
      `<button class="pill ${st.kind === k ? "active" : ""}" data-kind="${k}">${k === "songs" ? "Music" : "Sermons"}</button>`).join("");
  }

  function syncUrl() {
    const p = new URLSearchParams({ cat: cat.slug });
    if (st.sub) p.set("sub", subs.find(s => s.id === st.sub).slug);
    if (kinds.length > 1 && st.kind !== kinds[0]) p.set("type", st.kind);
    if (st.sort !== "newest") p.set("sort", st.sort);
    if (st.page > 1) p.set("page", st.page);
    history.replaceState(null, "", location.pathname + "?" + p.toString());
  }

  async function load() {
    paintHeader();
    grid.innerHTML = `<div class="col-12">${spinner}</div>`;
    const songs = st.kind === "songs";
    const size = CONFIG.PAGE_SIZE || 12, from = (st.page - 1) * size, sort = SORTS[st.sort];

    let q = db.from(songs ? "songs" : "sermons")
      .select(songs ? SONG_FIELDS : SERMON_FIELDS, { count: "exact" })
      .eq("status", "published").eq("category_id", cat.id);
    if (st.sub) q = q.eq("subcategory_id", st.sub);
    q = q.order(sort.col, { ascending: sort.asc }).order("id").range(from, from + size - 1);

    const { data, error, count } = await q;
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      return renderList(grid, [], songCard, "bi-exclamation-triangle", "We could not load this page. Please refresh.");
    }
    const emptyText = `No ${songs ? "songs" : "sermons"} in ${subName() || cat.name} yet. Check back soon.`;
    renderList(grid, (data || []).map(songs ? mapSong : mapSermon), songs ? songCard : sermonCard, "bi-music-note-list", emptyText);
    $("result-count").textContent = count ? `${count} ${songs ? "song" : "sermon"}${count === 1 ? "" : "s"}` : "";
    renderPager(pager, st.page, Math.ceil((count || 0) / size), p => {
      st.page = p; load(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    syncUrl();
  }

  sortSel.innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("");
  sortSel.value = st.sort;
  sortSel.addEventListener("change", () => { st.sort = sortSel.value; st.page = 1; load(); });
  pills.addEventListener("click", e => {
    const b = e.target.closest("[data-sub]"); if (!b) return;
    st.sub = b.dataset.sub; st.page = 1; paintPills(); load();
  });
  tabs.addEventListener("click", e => {
    const b = e.target.closest("[data-kind]"); if (!b) return;
    st.kind = b.dataset.kind; st.page = 1; paintTabs(); load();
  });

  paintTabs(); paintPills(); load();

  // ---------- All categories ----------
  async function showAll() {
    browse.innerHTML = spinner;
    const { data, error } = await db.from("categories")
      .select("id,name,slug,description,applies_to,subcategories(name,slug,sort_order)").order("sort_order");
    if (error) { console.error(error); return message("bi-exclamation-triangle", "We could not load the categories. Please refresh the page."); }
    if (!data.length) return message("bi-folder", "No categories yet.");
    browse.innerHTML = `<div class="row g-4">` + data.map(c => `
      <div class="col-md-6 col-lg-4">
        <div class="card card-selah h-100"><div class="card-body p-4">
          <a class="title h4" href="category.html?cat=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a>
          ${c.description ? `<p class="meta">${escapeHtml(c.description)}</p>` : ""}
          <div class="d-flex flex-wrap gap-2 mt-3">
            ${(c.subcategories || []).sort((a, b) => a.sort_order - b.sort_order).map(s =>
              `<a class="chip text-decoration-none" href="category.html?cat=${encodeURIComponent(c.slug)}&amp;sub=${encodeURIComponent(s.slug)}">${escapeHtml(s.name)}</a>`).join("")}
          </div>
        </div></div>
      </div>`).join("") + `</div>`;
  }
});