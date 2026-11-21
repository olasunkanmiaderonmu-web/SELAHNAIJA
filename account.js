/** Selah Naija - account page: profile, favourites, playlists, recently played, download history. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const spinner = `<div class="col-12 text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading...</div>`;
  const when = d => new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const oops = el => renderList(el, [], songCard, "bi-exclamation-triangle", "We could not load this. Please refresh the page.");

  if (!db) { $("fav-grid").innerHTML = `<div class="col-12"><div class="empty-state">${escapeHtml(dbProblem)}</div></div>`; return; }

  await Auth.ready;
  const user = Auth.user();
  if (!user) { location.replace("login.html?next=" + encodeURIComponent("account.html" + location.hash)); return; }

  const TABS = ["profile", "favourites", "playlists", "recent", "downloads"];
  let current = "profile";

  // ---------- Tabs ----------
  function show(tab, push = true) {
    if (!TABS.includes(tab)) tab = "profile";
    current = tab;
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== tab; });
    if (push) history.replaceState(null, "", "#" + tab);
    ({ profile: paintProfile, favourites: loadFavs, playlists: loadPlaylists, recent: loadRecent, downloads: loadDownloads })[tab]();
  }
  $("acc-tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); });
  window.addEventListener("hashchange", () => show(location.hash.slice(1), false));

  // ---------- Profile ----------
  function paintProfile() {
    const p = Auth.profile();
    const name = p?.full_name || "";
    $("acc-hello").textContent = `Hello, ${name || user.email.split("@")[0]}.`;
    $("acc-name").value = name;
    $("acc-email").value = user.email;
    const pic = publicUrl("profile-images", p?.avatar_url);
    $("acc-avatar").innerHTML = pic ? `<img src="${escapeHtml(pic)}" alt="Your picture">` : escapeHtml((name || user.email).charAt(0).toUpperCase());
  }

  $("acc-profile-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("acc-name").value.trim();
    if (name.length < 2 || name.length > 80) return showToast("Please enter your name (2 to 80 letters).", "danger");
    const { error } = await db.from("profiles").update({ full_name: name }).eq("id", user.id);
    if (error) { console.error(error); return showToast("Could not save your profile.", "danger"); }
    await db.auth.updateUser({ data: { full_name: name } });
    await Auth.reload(); paintProfile();
    showToast("Profile saved.", "success");
  });

  $("acc-avatar-input").addEventListener("change", async e => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
    if (!ext) return showToast("Please choose a JPG, PNG or WebP picture.", "danger");
    if (file.size > 2 * 1024 * 1024) return showToast("That picture is too big. The limit is 2 MB.", "danger");
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;               // each person only writes inside their own folder
    const up = await db.storage.from("profile-images").upload(path, file, { contentType: file.type });
    if (up.error) { console.error(up.error); return showToast("Could not upload the picture.", "danger"); }
    const old = Auth.profile()?.avatar_url;
    const { error } = await db.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    if (error) { console.error(error); return showToast("Could not save the picture.", "danger"); }
    if (old) db.storage.from("profile-images").remove([old]);
    await Auth.reload(); paintProfile();
    showToast("Profile picture updated.", "success");
  });

  $("acc-password-form").addEventListener("submit", async e => {
    e.preventDefault();
    const pw = $("acc-pw").value, pw2 = $("acc-pw2").value;
    if (pw.length < 8) return showToast("Your password must be at least 8 characters.", "danger");
    if (pw !== pw2) return showToast("The two passwords do not match.", "danger");
    const { error } = await db.auth.updateUser({ password: pw });
    if (error) { console.error(error); return showToast("Could not change the password. Try logging in again first.", "danger"); }
    e.target.reset();
    showToast("Password updated.", "success");
  });

  // ---------- Favourites ----------
  async function loadFavs() {
    const el = $("fav-grid"); el.innerHTML = spinner;
    const { data, error } = await db.from("favorites")
      .select("created_at, songs(id,title,cover_path,plays,downloads,artists(name),categories(name))")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) { console.error(error); return oops(el); }
    const songs = (data || []).map(r => r.songs).filter(Boolean);
    renderList(el, songs.map(mapSong), songCard, "bi-heart", "No favourites yet. Tap the heart on any song to save it here.");
  }
  document.addEventListener("favorites-changed", () => { if (current === "favourites") loadFavs(); });

  // ---------- Playlists ----------
  async function loadPlaylists() {
    const el = $("playlist-grid"); el.innerHTML = spinner;
    const { data, error } = await db.from("playlists").select("id,name,is_public,playlist_songs(count)")
      .eq("owner_id", user.id).order("created_at", { ascending: false });
    if (error) { console.error(error); return oops(el); }
    renderList(el, data || [], p => `
      <div class="col-6 col-md-4 col-lg-3">
        <a href="playlist.html?id=${encodeURIComponent(p.id)}" class="card card-selah h-100 text-decoration-none">
          <div class="media-cover" style="border-radius:1rem 1rem 0 0"><i class="bi bi-collection-play"></i></div>
          <div class="card-body"><span class="title text-truncate">${escapeHtml(p.name)}</span>
            <div class="meta">${p.playlist_songs?.[0]?.count ?? 0} songs · ${p.is_public ? "Public" : "Private"}</div></div>
        </a>
      </div>`, "bi-collection-play", "You have no playlists yet. Create your first one above, or use the + button on any song.");
  }
  document.addEventListener("playlists-changed", () => { if (current === "playlists") loadPlaylists(); });

  $("new-playlist-form").addEventListener("submit", async e => {
    e.preventDefault();
    const input = $("new-playlist-name"), name = input.value.trim();
    if (!name || name.length > 80) return;
    const { error } = await db.from("playlists").insert({ owner_id: user.id, name, is_public: false });
    if (error) { console.error(error); return showToast("Could not create the playlist.", "danger"); }
    input.value = ""; showToast("Playlist created.", "success"); loadPlaylists();
  });

  // ---------- Recently played ----------
  async function loadRecent() {
    $("recent-empty").innerHTML = `<div class="text-center text-muted py-5">Loading...</div>`;
    const { data, error } = await db.from("listening_history")
      .select("played_at, song_id, sermon_id, songs(id,title,cover_path,plays,downloads,artists(name),categories(name)), sermons(id,title,topic,cover_path,duration_seconds,plays,downloads,preachers(id,name),categories(name))")
      .eq("user_id", user.id).order("played_at", { ascending: false }).limit(100);
    if (error) { console.error(error); $("recent-empty").innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>We could not load your history.</div>`; return; }
    const seen = new Set(), songs = [], sermons = [];
    (data || []).forEach(r => {
      const item = r.songs || r.sermons; if (!item || seen.has(item.id)) return;
      seen.add(item.id); (r.songs ? songs : sermons).push(item);
    });
    $("recent-songs-wrap").hidden = !songs.length;
    $("recent-sermons-wrap").hidden = !sermons.length;
    renderList($("recent-songs"), songs.slice(0, 24).map(mapSong), songCard, "bi-music-note", "");
    renderList($("recent-sermons"), sermons.slice(0, 24).map(mapSermon), sermonCard, "bi-mic", "");
    $("clear-recent").hidden = !(songs.length || sermons.length);
    $("recent-empty").innerHTML = (songs.length || sermons.length) ? "" :
      `<div class="empty-state"><i class="bi bi-clock-history"></i>Nothing played yet. Songs and sermons you listen to while logged in appear here.</div>`;
  }
  $("clear-recent").addEventListener("click", async () => {
    if (!confirm("Clear your recently played list?")) return;
    const { error } = await db.from("listening_history").delete().eq("user_id", user.id);
    if (error) { console.error(error); return showToast("Could not clear your history.", "danger"); }
    showToast("History cleared.", "success"); loadRecent();
  });

  // ---------- Download history ----------
  async function loadDownloads() {
    const el = $("download-list");
    el.innerHTML = `<div class="text-center text-muted py-5">Loading...</div>`;
    const { data, error } = await db.from("download_history")
      .select("downloaded_at, songs(id,title,audio_format,artists(name)), sermons(id,title,audio_format,preachers(name))")
      .eq("user_id", user.id).order("downloaded_at", { ascending: false }).limit(100);
    if (error) { console.error(error); el.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>We could not load your downloads.</div>`; return; }
    const rows = (data || []).filter(r => r.songs || r.sermons);
    if (!rows.length) { el.innerHTML = `<div class="empty-state"><i class="bi bi-download"></i>No downloads yet. Songs and sermons you download while logged in are listed here.</div>`; return; }
    el.innerHTML = `
    <div class="table-responsive"><table class="table align-middle">
      <thead><tr><th>Title</th><th>By</th><th class="d-none d-md-table-cell">Downloaded</th><th></th></tr></thead>
      <tbody>${rows.map(r => {
        const song = !!r.songs, it = r.songs || r.sermons;
        const by = song ? it.artists?.name : it.preachers?.name;
        const link = `${song ? "song" : "sermon"}.html?id=${encodeURIComponent(it.id)}`;
        const attr = song ? "data-download-song" : "data-download-sermon";
        return `<tr>
          <td><i class="bi ${song ? "bi-music-note-beamed" : "bi-mic"} text-primary me-2"></i><a href="${link}" class="fw-semibold text-decoration-none">${escapeHtml(it.title)}</a></td>
          <td>${escapeHtml(by || "")}</td>
          <td class="d-none d-md-table-cell text-muted">${when(r.downloaded_at)}</td>
          <td class="text-end"><button class="btn btn-sm btn-primary" ${attr}="${escapeHtml(it.id)}"><i class="bi bi-download me-1"></i>${escapeHtml(it.audio_format.toUpperCase())}</button></td>
        </tr>`;
      }).join("")}</tbody></table></div>`;
  }

  show(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "profile", false);
});