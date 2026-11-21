/** Selah Naija - one preacher profile with their sermons. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const hero = $("preacher-hero");
  const heroMessage = html => {
    hero.innerHTML = `<div class="container"><div class="empty-state text-dark"><i class="bi bi-person-x"></i>${html} <a href="sermons.html">Browse sermons</a></div></div>`;
  };

  if (!db) return heroMessage(escapeHtml(dbProblem));
  const params = new URLSearchParams(location.search);
  const key = params.get("id") || params.get("slug");
  if (!key) return heroMessage("No preacher was selected.");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  const { data: p, error } = await db.from("preachers")
    .select("id,name,slug,church,bio,photo_path").eq(isUuid ? "id" : "slug", key).maybeSingle();
  if (error) console.error(error);
  if (error || !p) return heroMessage("We could not find this preacher.");

  const photo = publicUrl("artist-images", p.photo_path);     // preacher photos use the artist-images bucket
  const { count } = await db.from("sermons").select("id", { count: "exact", head: true })
    .eq("preacher_id", p.id).eq("status", "published");
  const total = count || 0;

  hero.innerHTML = `
  <div class="container">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-4">
        <li class="breadcrumb-item"><a href="index.html">Home</a></li>
        <li class="breadcrumb-item"><a href="sermons.html">Sermons</a></li>
        <li class="breadcrumb-item active" aria-current="page">${escapeHtml(p.name)}</li>
      </ol>
    </nav>
    <div class="row g-4 align-items-center">
      <div class="col-md-4 col-lg-3 text-center">
        <div class="artist-photo artist-photo-lg">${coverHtml(photo, p.name, "bi-person-fill")}</div>
      </div>
      <div class="col-md-8 col-lg-9">
        <span class="chip mb-2">Preacher</span>
        <h1 class="mb-2">${escapeHtml(p.name)}</h1>
        <div class="meta-stats mb-3">
          <span class="me-4"><i class="bi bi-mic me-1"></i>${total} sermon${total === 1 ? "" : "s"}</span>
          ${p.church ? `<span><i class="bi bi-building me-1"></i>${escapeHtml(p.church)}</span>` : ""}
        </div>
        ${p.bio ? `<p class="pre-line opacity-75">${escapeHtml(p.bio)}</p>` : ""}
        <button class="btn btn-gold btn-lg px-4" id="play-preacher" hidden><i class="bi bi-play-fill me-1"></i>Play sermons</button>
      </div>
    </div>
  </div>`;

  setPageMeta({
    title: `${p.name} - Sermons | Selah Naija`,
    description: (p.bio || `Listen to and download sermons by ${p.name} on Selah Naija.`).slice(0, 160),
    image: photo, url: location.href, type: "profile"
  });

  // ---------- Sermons list with sort and pages ----------
  const grid = $("sermon-grid"), pager = $("pager"), sortSel = $("filter-sort");
  const st = { page: 1, sort: "newest" };
  let pageIds = [];
  if (total === 0) {
    $("sec-sermons").hidden = false;
    $("list-title").textContent = "Sermons";
    return renderList(grid, [], sermonCard, "bi-mic", "No sermons from this preacher yet.");
  }
  $("sec-sermons").hidden = false;
  $("list-title").textContent = `Sermons by ${p.name}`;

  async function load() {
    const size = CONFIG.PAGE_SIZE || 12, from = (st.page - 1) * size, sort = SORTS[st.sort];
    grid.innerHTML = `<div class="col-12 text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading...</div>`;
    const { data, error, count } = await db.from("sermons").select(SERMON_FIELDS, { count: "exact" })
      .eq("status", "published").eq("preacher_id", p.id)
      .order(sort.col, { ascending: sort.asc }).order("id").range(from, from + size - 1);
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      return renderList(grid, [], sermonCard, "bi-exclamation-triangle", "We could not load the sermons. Please refresh the page.");
    }
    pageIds = (data || []).map(r => r.id);
    $("play-preacher").hidden = !pageIds.length;
    renderList(grid, (data || []).map(mapSermon), sermonCard, "bi-mic", "No sermons here yet.");
    renderPager(pager, st.page, Math.ceil((count || 0) / size), n => {
      st.page = n; load(); $("sec-sermons").scrollIntoView({ behavior: "smooth" });
    });
  }

  sortSel.innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("");
  sortSel.addEventListener("change", () => { st.sort = sortSel.value; st.page = 1; load(); });
  $("play-preacher").addEventListener("click", () => { if (pageIds.length) Player.playSermonIds(pageIds, pageIds[0]); });
  load();
});