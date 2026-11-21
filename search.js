/** Selah Naija - site-wide search results page. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const results = $("results"), pager = $("pager"), input = $("search-input");
  const spinner = `<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Searching...</div>`;

  if (!db) {
    results.innerHTML = `<div class="empty-state"><i class="bi bi-plug"></i>${escapeHtml(dbProblem)}</div>`;
    return;
  }

  const TYPES = [["all", "All"], ["songs", "Songs"], ["artists", "Artists"], ["albums", "Albums"], ["sermons", "Sermons"], ["preachers", "Preachers"]];
  const TITLES = { songs: "Songs", artists: "Artists", albums: "Albums", sermons: "Sermons", preachers: "Preachers" };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // ---------- Starting state from the address bar ----------
  const params = new URLSearchParams(location.search);
  const st = {
    q: (params.get("q") || "").trim().slice(0, 100),
    type: TYPES.some(t => t[0] === params.get("type")) ? params.get("type") : "all",
    cat: params.get("cat") || "",
    artist: UUID.test(params.get("artist") || "") ? params.get("artist") : "",
    sort: SORTS[params.get("sort")] ? params.get("sort") : "popular",
    page: Math.max(1, parseInt(params.get("page"), 10) || 1)
  };

  // ---------- Filter lists ----------
  const [catRes, artRes] = await Promise.all([
    db.from("categories").select("id,name,slug,subcategories(id,name,slug,sort_order)").order("sort_order"),
    db.from("artists").select("id,name").order("name").limit(500)
  ]);
  const cats = catRes.data || [], artistList = artRes.data || [];
  if (!cats.some(c => c.slug === st.cat)) st.cat = "";
  if (!artistList.some(a => a.id === st.artist)) st.artist = "";

  const catSel = $("filter-category"), artSel = $("filter-artist"), sortSel = $("filter-sort");
  catSel.innerHTML = `<option value="">All categories</option>` + cats.map(c => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
  artSel.innerHTML = `<option value="">All artists</option>` + artistList.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  sortSel.innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("");
  catSel.value = st.cat; artSel.value = st.artist; sortSel.value = st.sort; input.value = st.q;

  const catId = () => (cats.find(c => c.slug === st.cat) || {}).id || "";

  // ---------- Query helpers ----------
  let text = "", lastText = null, m = null, runId = 0;
  const cleanText = () => st.q.replace(/[%,()*\\"_]/g, " ").replace(/\s+/g, " ").trim();
  const inList = (col, ids) => (ids.length ? `${col}.in.(${ids.join(",")})` : null);
  const orOf = parts => parts.filter(Boolean).join(",");

  // Finds the artists, albums, preachers and categories whose names match, so songs/sermons/albums
  // can also be found through them (e.g. searching an artist's name finds their songs).
  async function prepare() {
    const like = `%${text}%`;
    const [ar, al, pr] = await Promise.all([
      db.from("artists").select("id").ilike("name", like).limit(50),
      db.from("albums").select("id").ilike("title", like).limit(50),
      db.from("preachers").select("id").ilike("name", like).limit(50)
    ]);
    const needle = text.toLowerCase();
    m = {
      artists: (ar.data || []).map(r => r.id),
      albums: (al.data || []).map(r => r.id),
      preachers: (pr.data || []).map(r => r.id),
      cats: cats.filter(c => c.name.toLowerCase().includes(needle)).map(c => c.id),
      subs: cats.flatMap(c => c.subcategories || []).filter(s => s.name.toLowerCase().includes(needle)).map(s => s.id)
    };
  }

  function sorted(q, type) {
    const s = SORTS[st.sort];
    if (type === "songs" || type === "sermons") q = q.order(s.col, { ascending: s.asc });
    else if (type === "albums") q = st.sort === "newest" ? q.order("release_date", { ascending: false, nullsFirst: false }) : q.order("title");
    else q = st.sort === "newest" ? q.order("created_at", { ascending: false }) : q.order("name");
    return q.order("id");
  }

  const RUN = {
    songs(limit, from) {
      let q = db.from("songs").select(SONG_FIELDS, { count: "exact" }).eq("status", "published")
        .or(orOf([`title.ilike.*${text}*`, `featured_artist.ilike.*${text}*`,
                  inList("artist_id", m.artists), inList("album_id", m.albums),
                  inList("category_id", m.cats), inList("subcategory_id", m.subs)]));
      if (catId()) q = q.eq("category_id", catId());
      if (st.artist) q = q.eq("artist_id", st.artist);
      return sorted(q, "songs").range(from, from + limit - 1);
    },
    artists(limit, from) {
      let q = db.from("artists").select("id,name,photo_path,songs(count)", { count: "exact" }).ilike("name", `%${text}%`);
      if (st.artist) q = q.eq("id", st.artist);
      return sorted(q, "artists").range(from, from + limit - 1);
    },
    albums(limit, from) {
      let q = db.from("albums").select("id,title,cover_path,release_date,artists(id,name),songs!inner(id)", { count: "exact" })
        .or(orOf([`title.ilike.*${text}*`, inList("artist_id", m.artists)]));
      if (st.artist) q = q.eq("artist_id", st.artist);
      return sorted(q, "albums").range(from, from + limit - 1);
    },
    sermons(limit, from) {
      let q = db.from("sermons").select(SERMON_FIELDS, { count: "exact" }).eq("status", "published")
        .or(orOf([`title.ilike.*${text}*`, `topic.ilike.*${text}*`, `church.ilike.*${text}*`,
                  inList("preacher_id", m.preachers), inList("category_id", m.cats), inList("subcategory_id", m.subs)]));
      if (catId()) q = q.eq("category_id", catId());
      return sorted(q, "sermons").range(from, from + limit - 1);
    },
    preachers(limit, from) {
      const q = db.from("preachers").select("id,name,church,photo_path,sermons(count)", { count: "exact" })
        .or(`name.ilike.*${text}*,church.ilike.*${text}*`);
      return sorted(q, "preachers").range(from, from + limit - 1);
    }
  };

  // ---------- Cards ----------
  const albumCard = r => {
    const n = r.songs?.length ?? 0;
    const year = r.release_date ? new Date(r.release_date).getFullYear() + " · " : "";
    return `
    <div class="col-6 col-md-4 col-lg-2">
      <div class="card card-selah h-100">
        <a class="album-link" href="artist.html?id=${encodeURIComponent(r.artists?.id || "")}&amp;album=${encodeURIComponent(r.id)}">
          <div class="media-cover">${coverHtml(publicUrl("song-covers", r.cover_path), r.title, "bi-disc")}</div>
          <div class="card-body"><span class="title text-truncate">${escapeHtml(r.title)}</span>
            <div class="meta text-truncate">${escapeHtml(r.artists?.name || "")}</div>
            <div class="meta">${year}${n} song${n === 1 ? "" : "s"}</div></div>
        </a>
      </div>
    </div>`;
  };
  const preacherCard = r => {
    const n = r.sermons?.[0]?.count ?? 0;
    return `
    <div class="col-6 col-md-4 col-lg-3">
      <a href="preacher.html?id=${encodeURIComponent(r.id)}" class="card card-selah artist-card text-decoration-none h-100">
        <div class="artist-photo">${coverHtml(publicUrl("artist-images", r.photo_path), r.name, "bi-person-fill")}</div>
        <div class="title">${escapeHtml(r.name)}</div>
        ${r.church ? `<div class="meta">${escapeHtml(r.church)}</div>` : ""}
        <div class="meta">${n} sermon${n === 1 ? "" : "s"}</div>
      </a>
    </div>`;
  };
  const CARD = {
    songs: r => songCard(mapSong(r)),
    artists: r => artistCard({ id: r.id, name: r.name, photo_url: publicUrl("artist-images", r.photo_path), song_count: r.songs?.[0]?.count ?? 0 }),
    albums: albumCard,
    sermons: r => sermonCard(mapSermon(r)),
    preachers: preacherCard
  };

  // ---------- Page pieces ----------
  function paintTabs() {
    $("type-tabs").innerHTML = TYPES.map(([k, l]) => `<button class="pill ${st.type === k ? "active" : ""}" data-type="${k}">${l}</button>`).join("");
    $("wrap-cat").hidden = !["all", "songs", "sermons"].includes(st.type);
    $("wrap-artist").hidden = !["all", "songs", "albums"].includes(st.type);
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (st.q) p.set("q", st.q);
    if (st.type !== "all") p.set("type", st.type);
    if (st.cat) p.set("cat", st.cat);
    if (st.artist) p.set("artist", st.artist);
    if (st.sort !== "popular") p.set("sort", st.sort);
    if (st.page > 1) p.set("page", st.page);
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  function categoryHits() {
    const needle = text.toLowerCase(), hits = [];
    cats.forEach(c => {
      if (c.name.toLowerCase().includes(needle)) hits.push({ label: c.name, href: `category.html?cat=${encodeURIComponent(c.slug)}` });
      (c.subcategories || []).forEach(s => {
        if (s.name.toLowerCase().includes(needle))
          hits.push({ label: `${s.name} (${c.name})`, href: `category.html?cat=${encodeURIComponent(c.slug)}&sub=${encodeURIComponent(s.slug)}` });
      });
    });
    return hits;
  }

  function showPrompt() {
    results.innerHTML = `
    <div class="empty-state"><i class="bi bi-search"></i>
      <strong class="d-block mb-1">${st.q ? "Please type at least 2 letters" : "What are you looking for?"}</strong>
      Search for songs, artists, albums, sermons, preachers and topics.
      <div class="pill-row justify-content-center mt-3 mb-0">
        ${cats.map(c => `<a class="pill text-decoration-none" href="category.html?cat=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a>`).join("")}
      </div>
    </div>`;
  }

  function noResults() {
    const filtered = st.cat || st.artist;
    results.innerHTML = `
    <div class="empty-state"><i class="bi bi-search"></i>
      <strong class="d-block mb-1">No results for “${escapeHtml(st.q)}”</strong>
      Check the spelling, try fewer or different words, or browse instead.
      <div class="d-flex flex-wrap gap-2 justify-content-center mt-3">
        ${filtered ? `<button class="btn btn-gold btn-sm" id="reset-filters">Remove filters</button>` : ""}
        <a class="btn btn-primary btn-sm" href="music.html">Browse music</a>
        <a class="btn btn-primary btn-sm" href="sermons.html">Browse sermons</a>
        <a class="btn btn-primary btn-sm" href="artists.html">Artists A–Z</a>
        <a class="btn btn-primary btn-sm" href="category.html">All categories</a>
      </div>
    </div>`;
  }

  // ---------- "All" view: a few of each kind ----------
  async function showAll(my) {
    const kinds = ["songs", "artists", "albums", "sermons", "preachers"];
    const out = await Promise.all(kinds.map(k => RUN[k](6, 0)));
    if (my !== runId) return;
    let html = "", total = 0;
    kinds.forEach((k, i) => {
      const { data, error, count } = out[i];
      if (error) { console.error(k, error); return; }
      if (!data || !data.length) return;
      total += count || data.length;
      html += `
      <section class="mb-5">
        <div class="section-head">
          <h2 class="h4 m-0">${TITLES[k]} <span class="count-badge">${count}</span></h2>
          ${count > data.length ? `<button class="btn btn-link link-more p-0" data-see="${k}">See all ${count} <i class="bi bi-arrow-right"></i></button>` : ""}
        </div>
        <div class="row g-4">${data.map(CARD[k]).join("")}</div>
      </section>`;
    });
    const hits = categoryHits();
    if (hits.length) {
      total += hits.length;
      html = `<section class="mb-5"><div class="section-head"><h2 class="h4 m-0">Categories &amp; topics</h2></div>
        <div class="pill-row">${hits.map(h => `<a class="pill text-decoration-none" href="${escapeHtml(h.href)}">${escapeHtml(h.label)}</a>`).join("")}</div></section>` + html;
    }
    if (!total) return noResults();
    results.innerHTML = html;
  }

  // ---------- One kind of result, with pages ----------
  async function showType(my) {
    const size = CONFIG.PAGE_SIZE || 12, from = (st.page - 1) * size;
    const { data, error, count } = await RUN[st.type](size, from);
    if (my !== runId) return;
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return showType(my); }
      console.error(error);
      results.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>We could not load the results. Please try again.</div>`;
      return;
    }
    if (!data || !data.length) return noResults();
    results.innerHTML = `<p class="text-muted">${count} ${TITLES[st.type].toLowerCase()} for “${escapeHtml(st.q)}”</p>
      <div class="row g-4">${data.map(CARD[st.type]).join("")}</div>`;
    renderPager(pager, st.page, Math.ceil((count || 0) / size), p => {
      st.page = p; syncUrl(); run(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  async function run() {
    const my = ++runId;
    text = cleanText();
    paintTabs(); syncUrl();
    setPageMeta({
      title: st.q ? `Search results for “${st.q}” | Selah Naija` : "Search | Selah Naija",
      description: "Search Nigerian gospel songs, artists, albums, sermons and preachers on Selah Naija."
    });
    pager.innerHTML = "";
    if (text.length < 2) return showPrompt();
    results.innerHTML = spinner;
    if (text !== lastText) { await prepare(); lastText = text; }
    if (my !== runId) return;
    if (st.type === "all") await showAll(my); else await showType(my);
  }

  // ---------- Events ----------
  $("search-form").addEventListener("submit", e => { e.preventDefault(); st.q = input.value.trim().slice(0, 100); st.page = 1; run(); });
  $("type-tabs").addEventListener("click", e => { const b = e.target.closest("[data-type]"); if (b) { st.type = b.dataset.type; st.page = 1; run(); } });
  catSel.addEventListener("change", () => { st.cat = catSel.value; st.page = 1; run(); });
  artSel.addEventListener("change", () => { st.artist = artSel.value; st.page = 1; run(); });
  sortSel.addEventListener("change", () => { st.sort = sortSel.value; st.page = 1; run(); });
  results.addEventListener("click", e => {
    const see = e.target.closest("[data-see]");
    if (see) { st.type = see.dataset.see; st.page = 1; run(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (e.target.closest("#reset-filters")) { st.cat = ""; st.artist = ""; catSel.value = ""; artSel.value = ""; st.page = 1; run(); }
  });

  run();
});