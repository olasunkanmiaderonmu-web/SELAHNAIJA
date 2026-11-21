/** Selah Naija - one playlist: play it, and (for its owner) rename, reorder by removing, share or delete it. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const view = $("playlist-view");
  const notFound = msg => { view.innerHTML = `<div class="empty-state"><i class="bi bi-collection-play"></i>${msg} <a href="playlists.html">Browse playlists</a></div>`; };
  if (!db) return notFound(escapeHtml(dbProblem));

  const id = new URLSearchParams(location.search).get("id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "")) return notFound("No playlist was selected.");

  await Auth.ready;
  const { data: p, error } = await db.from("playlists")
    .select("id,name,description,is_public,is_curated,owner_id, playlist_songs(position, songs(id,title,cover_path,duration_seconds,audio_format,artists(name)))")
    .eq("id", id).maybeSingle();
  if (error) console.error(error);
  if (error || !p) return notFound("We could not find this playlist. It may be private or removed. If it is yours, please log in first.");

  const me = Auth.user();
  const mine = !!me && p.owner_id === me.id;
  let items = (p.playlist_songs || []).filter(x => x.songs).sort((a, b) => a.position - b.position).map(x => x.songs);

  setPageMeta({ title: `${p.name} | Selah Naija`, description: (p.description || `A gospel playlist on Selah Naija.`).slice(0, 160), url: location.href });
  $("crumb-title").textContent = p.name;

  const row = (s, i) => `
    <div class="track-row">
      <span class="track-num">${i + 1}</span>
      <button class="track-play" data-play-song="${escapeHtml(s.id)}" aria-label="Play ${escapeHtml(s.title)}"><i class="bi bi-play-fill"></i></button>
      <div class="track-cover">${coverHtml(publicUrl("song-covers", s.cover_path), s.title, "bi-music-note-beamed")}</div>
      <div class="track-info"><a class="title text-truncate" href="song.html?id=${encodeURIComponent(s.id)}">${escapeHtml(s.title)}</a>
        <div class="meta text-truncate">${escapeHtml(s.artists?.name || "")}</div></div>
      <span class="meta d-none d-sm-inline">${s.duration_seconds ? formatDuration(s.duration_seconds) : ""}</span>
      <button class="btn btn-sm btn-outline-primary" data-fav-song="${escapeHtml(s.id)}" aria-label="Add to favourites"><i class="bi bi-heart"></i></button>
      <button class="btn btn-sm btn-outline-primary" data-download-song="${escapeHtml(s.id)}" aria-label="Download"><i class="bi bi-download"></i></button>
      ${mine ? `<button class="btn btn-sm btn-outline-danger" data-remove="${escapeHtml(s.id)}" aria-label="Remove from playlist"><i class="bi bi-x-lg"></i></button>` : ""}
    </div>`;

  function paint() {
    const total = items.reduce((n, s) => n + (s.duration_seconds || 0), 0);
    view.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        <div class="mb-2">
          ${p.is_curated ? `<span class="chip me-1">Curated</span>` : ""}
          <span class="chip">${p.is_public ? "Public" : "Private"}</span>
        </div>
        <h1 class="h2 mb-1">${escapeHtml(p.name)}</h1>
        ${p.description ? `<p class="text-muted mb-1">${escapeHtml(p.description)}</p>` : ""}
        <div class="meta">${items.length} song${items.length === 1 ? "" : "s"}${total ? " · " + Math.round(total / 60) + " min" : ""}</div>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-gold" id="play-all" ${items.length ? "" : "disabled"}><i class="bi bi-play-fill me-1"></i>Play all</button>
        ${p.is_public ? `<button class="btn btn-outline-primary" id="copy-link"><i class="bi bi-link-45deg me-1"></i>Copy link</button>` : ""}
        ${mine ? `<button class="btn btn-outline-primary" data-bs-toggle="collapse" data-bs-target="#edit-box"><i class="bi bi-pencil me-1"></i>Edit</button>` : ""}
      </div>
    </div>

    ${mine ? `
    <div class="collapse mb-4" id="edit-box"><div class="card card-selah"><div class="card-body">
      <form id="edit-form" novalidate>
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label" for="edit-name">Name</label><input class="form-control" id="edit-name" maxlength="80" value="${escapeHtml(p.name)}" required></div>
          <div class="col-md-6"><label class="form-label" for="edit-desc">Description (optional)</label><input class="form-control" id="edit-desc" maxlength="300" value="${escapeHtml(p.description || "")}"></div>
        </div>
        <div class="form-check form-switch my-3"><input class="form-check-input" type="checkbox" id="edit-public" ${p.is_public ? "checked" : ""}><label class="form-check-label" for="edit-public">Public (anyone with the link can see it)</label></div>
        <div class="d-flex gap-2"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-outline-danger ms-auto" type="button" id="delete-playlist"><i class="bi bi-trash me-1"></i>Delete playlist</button></div>
      </form>
    </div></div></div>` : ""}

    ${items.length
      ? `<div class="track-list" data-queue>${items.map(row).join("")}</div>`
      : `<div class="empty-state"><i class="bi bi-music-note-list"></i>${mine ? "This playlist is empty. Use the + button on any song to add it here." : "This playlist has no songs yet."}</div>`}`;

    if (typeof Player !== "undefined") Player.refreshButtons();
    const ids = items.map(s => s.id);
    const playAll = $("play-all"); if (playAll) playAll.addEventListener("click", () => Player.playSongIds(ids, ids[0]));
    const copy = $("copy-link"); if (copy) copy.addEventListener("click", () => navigator.clipboard.writeText(location.href).then(() => showToast("Link copied.", "success")).catch(() => showToast("Could not copy the link.", "danger")));

    const form = $("edit-form");
    if (form) {
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const name = $("edit-name").value.trim(), description = $("edit-desc").value.trim();
        if (!name || name.length > 80) return showToast("Please enter a name (up to 80 letters).", "danger");
        const { error } = await db.from("playlists").update({ name, description: description || null, is_public: $("edit-public").checked }).eq("id", p.id);
        if (error) { console.error(error); return showToast("Could not save your changes.", "danger"); }
        Object.assign(p, { name, description: description || null, is_public: $("edit-public").checked });
        $("crumb-title").textContent = name; showToast("Playlist saved.", "success"); paint();
      });
      $("delete-playlist").addEventListener("click", async () => {
        if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
        const { error } = await db.from("playlists").delete().eq("id", p.id);
        if (error) { console.error(error); return showToast("Could not delete the playlist.", "danger"); }
        location.href = "account.html#playlists";
      });
    }
  }

  view.addEventListener("click", async e => {
    const b = e.target.closest("[data-remove]"); if (!b) return;
    b.disabled = true;
    const { error } = await db.from("playlist_songs").delete().eq("playlist_id", p.id).eq("song_id", b.dataset.remove);
    if (error) { b.disabled = false; console.error(error); return showToast("Could not remove the song.", "danger"); }
    items = items.filter(s => s.id !== b.dataset.remove);
    showToast("Removed from playlist.", "success"); paint();
  });

  paint();
});