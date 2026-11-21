/** Selah Naija - single song page. */
document.addEventListener("DOMContentLoaded", async () => {
  const view = document.getElementById("song-view");
  const notFound = msg => {
    view.innerHTML = `<div class="empty-state"><i class="bi bi-music-note-list"></i>${msg} <a href="music.html">Browse all music</a></div>`;
  };
  if (!db) return notFound(escapeHtml(dbProblem));

  const id = new URLSearchParams(location.search).get("id");
  if (!id) return notFound("No song was selected.");

  const { data: s, error } = await db.from("songs")
    .select("*, artists(id,name), albums(title), categories(name,slug), subcategories(name)")
    .eq("id", id).eq("status", "published").maybeSingle();
  if (error || !s) {
    if (error) console.error(error);
    return notFound("We could not find this song. It may have been removed.");
  }

  const artist = s.artists?.name || "";
  const cover = publicUrl("song-covers", s.cover_path);
  const pageUrl = location.href;
  const shareText = `Listen to "${s.title}"${artist ? " by " + artist : ""} on Selah Naija`;
  const fmtDate = d => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
  const fmtFormat = () => s.audio_format.toUpperCase() + (s.file_size_bytes ? " · " + (s.file_size_bytes / 1048576).toFixed(1) + " MB" : "");

  const facts = [
    ["bi-disc", "Album", s.albums?.title],
    ["bi-calendar3", "Released", s.release_date && fmtDate(s.release_date)],
    ["bi-clock", "Duration", s.duration_seconds && formatDuration(s.duration_seconds)],
    ["bi-file-earmark-music", "Format", s.audio_format && fmtFormat()],
    ["bi-play-circle", "Plays", formatNumber(s.plays)],
    ["bi-download", "Downloads", formatNumber(s.downloads)]
  ].filter(f => f[2]);

  // Page title and social-sharing details
  document.title = `${s.title}${artist ? " by " + artist : ""} | Selah Naija`;
  const setMeta = (attr, key, value) => {
    let m = document.querySelector(`meta[${attr}="${key}"]`);
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); document.head.appendChild(m); }
    m.setAttribute("content", value);
  };
  const desc = (s.description || shareText).slice(0, 160);
  setMeta("name", "description", desc);
  setMeta("property", "og:title", document.title);
  setMeta("property", "og:description", desc);
  setMeta("property", "og:url", pageUrl);
  setMeta("property", "og:type", "music.song");
  if (cover) setMeta("property", "og:image", cover);
  document.getElementById("crumb-title").textContent = s.title;

  view.innerHTML = `
  <div class="row g-4 g-lg-5 align-items-start">
    <div class="col-md-5 col-lg-4">
      <div class="media-cover song-cover">${coverHtml(cover, s.title, "bi-music-note-beamed")}</div>
    </div>
    <div class="col-md-7 col-lg-8">
      <div class="mb-2">
        ${s.categories?.name ? `<span class="chip me-1">${escapeHtml(s.categories.name)}</span>` : ""}
        ${s.subcategories?.name ? `<span class="chip">${escapeHtml(s.subcategories.name)}</span>` : ""}
      </div>
      <h1 class="h1 mb-1">${escapeHtml(s.title)}</h1>
      <p class="lead mb-3">
        <a href="artist.html?id=${encodeURIComponent(s.artists?.id || "")}" class="text-decoration-none fw-semibold">${escapeHtml(artist)}</a>
        ${s.featured_artist ? `<span class="text-muted"> feat. ${escapeHtml(s.featured_artist)}</span>` : ""}
      </p>
      <ul class="meta-list">
        ${facts.map(f => `<li><i class="bi ${f[0]}"></i><span class="meta-label">${f[1]}</span><span>${escapeHtml(f[2])}</span></li>`).join("")}
      </ul>
      <div class="d-flex flex-wrap gap-2 my-4">
        <button class="btn btn-gold btn-lg px-4" id="play-main"><i class="bi bi-play-fill me-1"></i>Play</button>
        <button class="btn btn-primary btn-lg px-4" data-download-song="${escapeHtml(s.id)}"><i class="bi bi-download me-2"></i>Download ${escapeHtml(s.audio_format.toUpperCase())}</button>
                <button class="btn btn-outline-primary btn-lg" data-fav-song="${escapeHtml(s.id)}" aria-label="Add to favourites"><i class="bi bi-heart"></i></button>
        <button class="btn btn-outline-primary btn-lg" data-playlist-song="${escapeHtml(s.id)}" aria-label="Add to playlist"><i class="bi bi-plus-lg"></i></button>
        <div class="dropdown">
          <button class="btn btn-outline-primary btn-lg dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-share me-2"></i>Share</button>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText + " " + pageUrl)}"><i class="bi bi-whatsapp me-2"></i>WhatsApp</a></li>
            <li><a class="dropdown-item" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}"><i class="bi bi-facebook me-2"></i>Facebook</a></li>
            <li><a class="dropdown-item" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}"><i class="bi bi-twitter-x me-2"></i>X</a></li>
            <li><button class="dropdown-item" id="copy-link" type="button"><i class="bi bi-link-45deg me-2"></i>Copy link</button></li>
          </ul>
        </div>
      </div>
      ${s.description ? `<h2 class="h5">About this song</h2><p class="pre-line">${escapeHtml(s.description)}</p>` : ""}
            <p class="mt-4 small"><a class="text-muted text-decoration-none" href="report.html?song=${encodeURIComponent(s.id)}"><i class="bi bi-flag me-1"></i>Report a problem with this song</a></p>
      ${s.lyrics ? `
        <button class="btn btn-outline-primary btn-sm" data-bs-toggle="collapse" data-bs-target="#lyrics" aria-expanded="false">Show / hide lyrics</button>
        <div class="collapse mt-3" id="lyrics"><div class="card card-selah"><div class="card-body pre-line">${escapeHtml(s.lyrics)}</div></div></div>` : ""}
    </div>
  </div>`;

  document.getElementById("copy-link").addEventListener("click", () => {
    navigator.clipboard.writeText(pageUrl)
      .then(() => showToast("Link copied.", "success"))
      .catch(() => showToast("Could not copy the link.", "danger"));
  });

  // More songs: same artist, and similar songs from other artists in the same category
  const base = () => db.from("songs").select(SONG_FIELDS).eq("status", "published").neq("id", s.id);
  const [byArtist, similar] = await Promise.all([
    base().eq("artist_id", s.artist_id).order("plays", { ascending: false }).limit(6),
    s.category_id
      ? base().eq("category_id", s.category_id).neq("artist_id", s.artist_id).order("plays", { ascending: false }).limit(6)
      : Promise.resolve({ data: [] })
  ]);

  const show = (sectionId, gridId, rows) => {
    if (!rows || !rows.length) return;
    document.getElementById(sectionId).hidden = false;
    renderList(document.getElementById(gridId), rows.map(mapSong), songCard, "bi-music-note-list", "");
  };
  show("artist-section", "artist-songs", byArtist.data);
  show("related-section", "related-songs", similar.data);

  // The Play button plays this song, then continues with the songs listed below it
  const queueIds = [s.id, ...(byArtist.data || []).map(r => r.id), ...(similar.data || []).map(r => r.id)];
  document.getElementById("play-main").addEventListener("click", () => Player.playSongIds(queueIds, s.id));
});