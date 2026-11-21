/** Selah Naija - one artist profile. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const hero = $("artist-hero");
  const heroMessage = html => {
    hero.innerHTML = `<div class="container"><div class="empty-state text-dark"><i class="bi bi-person-x"></i>${html} <a href="artists.html">See all artists</a></div></div>`;
  };

  if (!db) return heroMessage(escapeHtml(dbProblem));
  const key = new URLSearchParams(location.search).get("id") || new URLSearchParams(location.search).get("slug");
  if (!key) return heroMessage("No artist was selected.");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  const { data: a, error } = await db.from("artists")
    .select("id,name,slug,bio,photo_path,social_links")
    .eq(isUuid ? "id" : "slug", key).maybeSingle();
  if (error) console.error(error);
  if (error || !a) return heroMessage("We could not find this artist.");

  const photo = publicUrl("artist-images", a.photo_path);
  const published = () => db.from("songs").select(SONG_FIELDS).eq("status", "published").eq("artist_id", a.id);

  // ---------- Facts and lists, fetched together ----------
  const [totalRes, popularRes, latestRes, albumRes, catRes] = await Promise.all([
    db.from("songs").select("id", { count: "exact", head: true }).eq("artist_id", a.id).eq("status", "published"),
    published().order("plays", { ascending: false }).order("id").limit(6),
    published().order("published_at", { ascending: false }).order("id").limit(6),
    db.from("albums").select("id,title,cover_path,release_date,songs(count)").eq("artist_id", a.id).order("release_date", { ascending: false }),
    db.from("songs").select("category_id").eq("artist_id", a.id).eq("status", "published").limit(200)
  ]);
  const total = totalRes.count || 0;
  const popular = popularRes.data || [], latest = latestRes.data || [];
  const albums = (albumRes.data || []).filter(al => (al.songs?.[0]?.count ?? 0) > 0);

  // ---------- Social links (only real web addresses are allowed) ----------
  const SOCIALS = {
    website: ["bi-globe", "Website"], facebook: ["bi-facebook", "Facebook"], instagram: ["bi-instagram", "Instagram"],
    x: ["bi-twitter-x", "X"], twitter: ["bi-twitter-x", "X"], youtube: ["bi-youtube", "YouTube"],
    tiktok: ["bi-tiktok", "TikTok"], spotify: ["bi-spotify", "Spotify"], apple_music: ["bi-apple", "Apple Music"],
    audiomack: ["bi-music-note-beamed", "Audiomack"], boomplay: ["bi-music-note-beamed", "Boomplay"]
  };
  const socialHtml = Object.entries(a.social_links || {})
    .filter(([, url]) => typeof url === "string" && /^https?:\/\//i.test(url))
    .map(([k, url]) => {
      const [icon, label] = SOCIALS[k] || ["bi-link-45deg", k];
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer nofollow" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><i class="bi ${icon}"></i></a>`;
    }).join("");

  // ---------- Top of the page ----------
  hero.innerHTML = `
  <div class="container">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-4">
        <li class="breadcrumb-item"><a href="index.html">Home</a></li>
        <li class="breadcrumb-item"><a href="artists.html">Artists</a></li>
        <li class="breadcrumb-item active" aria-current="page">${escapeHtml(a.name)}</li>
      </ol>
    </nav>
    <div class="row g-4 align-items-center">
      <div class="col-md-4 col-lg-3 text-center">
        <div class="artist-photo artist-photo-lg">${coverHtml(photo, a.name, "bi-person-fill")}</div>
      </div>
      <div class="col-md-8 col-lg-9">
        <span class="chip mb-2">Gospel artist</span>
        <h1 class="mb-2">${escapeHtml(a.name)}</h1>
        <div class="meta-stats mb-3">
          <span class="me-4"><i class="bi bi-music-note-list me-1"></i>${total} song${total === 1 ? "" : "s"}</span>
          ${albums.length ? `<span><i class="bi bi-disc me-1"></i>${albums.length} album${albums.length === 1 ? "" : "s"}</span>` : ""}
        </div>
        ${a.bio ? `<p class="pre-line opacity-75">${escapeHtml(a.bio)}</p>` : ""}
        ${socialHtml ? `<div class="social-links mb-3">${socialHtml}</div>` : ""}
        ${popular.length ? `<button class="btn btn-gold btn-lg px-4" id="play-artist"><i class="bi bi-play-fill me-1"></i>Play songs</button>` : ""}
      </div>
    </div>
  </div>`;

  setPageMeta({
    title: `${a.name} - Gospel Music & Songs | Selah Naija`,
    description: (a.bio || `Listen to and download songs by ${a.name} on Selah Naija.`).slice(0, 160),
    image: photo, url: location.href, type: "profile"
  });

  const show = (sectionId, gridId, rows) => {
    $(sectionId).hidden = false;
    renderList($(gridId), rows.map(mapSong), songCard, "bi-music-note-list", "");
  };

  // Few songs: one list. Many songs: popular + latest + a full list with pages.
  if (total > 0) {
    if (total <= 6) {
      $("popular-title").textContent = "Songs";
      show("sec-popular", "popular-songs", popular);
    } else {
      show("sec-popular", "popular-songs", popular);
      show("sec-latest", "latest-songs", latest);
    }
  }

  const playBtn = $("play-artist");
  if (playBtn) playBtn.addEventListener("click", () => {
    const ids = popular.map(s => s.id);
    Player.playSongIds(ids, ids[0]);
  });

  // ---------- Albums (choosing one filters the full list) ----------
  const secAll = $("sec-all"), allGrid = $("all-songs"), pager = $("pager"), sortSel = $("filter-sort");
  const st = { page: 1, sort: "newest", albumId: "" };

  if (albums.length) {
    $("sec-albums").hidden = false;
    $("album-grid").innerHTML = albums.map(al => {
      const n = al.songs?.[0]?.count ?? 0;
      const year = al.release_date ? new Date(al.release_date).getFullYear() + " · " : "";
      return `
      <div class="col-6 col-md-4 col-lg-2">
        <div class="card card-selah h-100">
          <button class="album-btn" data-album="${al.id}" aria-label="Show songs from ${escapeHtml(al.title)}">
            <div class="media-cover">${coverHtml(publicUrl("song-covers", al.cover_path), al.title, "bi-disc")}</div>
            <div class="card-body"><span class="title text-truncate">${escapeHtml(al.title)}</span><div class="meta">${year}${n} song${n === 1 ? "" : "s"}</div></div>
          </button>
        </div>
      </div>`;
    }).join("");
    $("album-grid").addEventListener("click", e => {
      const b = e.target.closest("[data-album]"); if (!b) return;
      st.albumId = b.dataset.album; st.page = 1;
      secAll.hidden = false; loadAll();
      secAll.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // ---------- Full song list with pages ----------
  async function loadAll() {
    const size = CONFIG.PAGE_SIZE || 12, from = (st.page - 1) * size, sort = SORTS[st.sort];
    allGrid.innerHTML = `<div class="col-12 text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading...</div>`;

    let q = db.from("songs").select(SONG_FIELDS, { count: "exact" }).eq("status", "published").eq("artist_id", a.id);
    if (st.albumId) q = q.eq("album_id", st.albumId);
    q = q.order(sort.col, { ascending: sort.asc }).order("id").range(from, from + size - 1);

    const { data, error, count } = await q;
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return loadAll(); }
      console.error(error);
      return renderList(allGrid, [], songCard, "bi-exclamation-triangle", "We could not load the songs. Please refresh the page.");
    }
    renderList(allGrid, (data || []).map(mapSong), songCard, "bi-music-note-list", "No songs here yet.");
    renderPager(pager, st.page, Math.ceil((count || 0) / size), p => { st.page = p; loadAll(); secAll.scrollIntoView({ behavior: "smooth" }); });

    const album = albums.find(x => x.id === st.albumId);
    $("all-title").textContent = album ? album.title : "All songs";
    $("album-filter").innerHTML = album ? `<button class="pill active" id="clear-album">Showing this album · Show all songs ✕</button>` : "";
    const clear = $("clear-album");
    if (clear) clear.addEventListener("click", () => { st.albumId = ""; st.page = 1; if (total <= 6) secAll.hidden = true; else loadAll(); });
  }

  sortSel.innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("");
  sortSel.addEventListener("change", () => { st.sort = sortSel.value; st.page = 1; loadAll(); });
  const wantedAlbum = new URLSearchParams(location.search).get("album");
  if (wantedAlbum && albums.some(x => x.id === wantedAlbum)) { st.albumId = wantedAlbum; secAll.hidden = false; loadAll(); }
  else if (total > 6) { secAll.hidden = false; loadAll(); }

  // ---------- Related artists: others with songs in the same categories ----------
  const catIds = [...new Set((catRes.data || []).map(r => r.category_id).filter(Boolean))];
  let ids = [];
  if (catIds.length) {
    const { data } = await db.from("songs").select("artist_id").in("category_id", catIds)
      .eq("status", "published").neq("artist_id", a.id).limit(100);
    ids = [...new Set((data || []).map(r => r.artist_id))].slice(0, 6);
  }
  let relQuery = db.from("artists").select("id,name,photo_path,songs(count)");
  relQuery = ids.length
    ? relQuery.in("id", ids)
    : relQuery.neq("id", a.id).order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(6);
  const { data: rel } = await relQuery;
  if (rel && rel.length) {
    $("sec-related").hidden = false;
    renderList($("related-artists"),
      rel.map(r => ({ id: r.id, name: r.name, photo_url: publicUrl("artist-images", r.photo_path), song_count: r.songs?.[0]?.count ?? 0 })),
      artistCard, "bi-person-lines-fill", "");
  }
});