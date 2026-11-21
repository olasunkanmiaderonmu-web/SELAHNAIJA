/**
 * Selah Naija - accounts: session, navbar account menu, favourites, add-to-playlist.
 * Loaded by layout.js on inner pages, and by a script tag on index.html, the account pages and the admin pages.
 * Everything is inside one guard so loading it twice does no harm.
 */
window.Auth = window.Auth || (function () {
  if (typeof db === "undefined" || !db) return { ready: Promise.resolve(), user: () => null, profile: () => null, isAdmin: () => false, safeNext: () => "account.html", requireLogin: () => false, openPicker() {}, logout() {}, reload: async () => {} };

  const state = { user: null, profile: null, favs: new Set(), isAdmin: false };
  let loaded = false, last = "", firstDone;
  const ready = new Promise(res => { firstDone = res; });
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const say = (m, t) => { if (typeof showToast === "function") showToast(m, t); };

  /** Only plain page names from this site are allowed as a "go back to" address. */
  function safeNext(fallback = "account.html") {
    const n = new URLSearchParams(location.search).get("next") || "";
    return /^[a-z0-9_-]+\.html(\?[^#\s]*)?(#[a-z0-9_-]*)?$/i.test(n) ? n : fallback;
  }

  function requireLogin(reason) {
    if (state.user) return true;
    say(`Please log in to ${reason}.`, "dark");
    const here = (location.pathname.split("/").pop() || "index.html") + location.search + location.hash;
    setTimeout(() => { location.href = "login.html?next=" + encodeURIComponent(here); }, 900);
    return false;
  }

  const displayName = () => (state.profile?.full_name || state.user?.email?.split("@")[0] || "Account");
  const avatarUrl = () => publicUrl("profile-images", state.profile?.avatar_url);

  /* ---------- Navbar: Login / Sign Up become an account menu ---------- */
  function renderNav() {
    const nav = document.getElementById("mainNav");
    if (!nav || !state.user) return;
    const name = displayName(), pic = avatarUrl();
    const avatar = pic ? `<img src="${esc(pic)}" alt="" class="nav-avatar">` : `<span class="nav-avatar nav-initial">${esc(name.charAt(0).toUpperCase())}</span>`;
    const t = document.createElement("template");
    t.innerHTML = `
    <div class="dropdown" id="account-menu">
      <button class="btn btn-outline-light btn-sm dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">${avatar}<span class="nav-name">${esc(name)}</span></button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><a class="dropdown-item" href="account.html#profile"><i class="bi bi-person me-2"></i>My account</a></li>
        <li><a class="dropdown-item" href="account.html#favourites"><i class="bi bi-heart me-2"></i>Favourites</a></li>
        <li><a class="dropdown-item" href="account.html#playlists"><i class="bi bi-collection-play me-2"></i>My playlists</a></li>
        <li><a class="dropdown-item" href="account.html#recent"><i class="bi bi-clock-history me-2"></i>Recently played</a></li>
        <li><a class="dropdown-item" href="account.html#downloads"><i class="bi bi-download me-2"></i>Downloads</a></li>
        ${state.isAdmin ? `<li><a class="dropdown-item" href="admin.html"><i class="bi bi-speedometer2 me-2"></i>Admin dashboard</a></li>` : ""}
        <li><hr class="dropdown-divider"></li>
        <li><button class="dropdown-item" type="button" data-logout><i class="bi bi-box-arrow-right me-2"></i>Log out</button></li>
      </ul>
    </div>`;
    const node = t.content.firstElementChild;
    const existing = document.getElementById("account-menu");
    const login = nav.querySelector('a[href="login.html"]'), signup = nav.querySelector('a[href="signup.html"]');
    if (existing) existing.replaceWith(node);
    else if (login) login.replaceWith(node);
    if (signup) signup.remove();
  }

  /* ---------- Favourite hearts on every page ---------- */
  function paintFavs() {
    document.querySelectorAll("[data-fav-song]").forEach(b => {
      const on = state.favs.has(b.dataset.favSong);
      b.classList.toggle("is-fav", on);
      const i = b.querySelector("i");
      if (i) i.className = "bi " + (on ? "bi-heart-fill" : "bi-heart");
      b.setAttribute("aria-label", on ? "Remove from favourites" : "Add to favourites");
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  async function toggleFav(id, btn) {
    if (!requireLogin("save favourites")) return;
    btn.disabled = true;
    const has = state.favs.has(id);
    const { error } = has
      ? await db.from("favorites").delete().eq("user_id", state.user.id).eq("song_id", id)
      : await db.from("favorites").insert({ user_id: state.user.id, song_id: id });
    btn.disabled = false;
    if (error && error.code !== "23505") { console.error(error); return say("Sorry, that did not work. Please try again.", "danger"); }
    if (has) state.favs.delete(id); else state.favs.add(id);
    paintFavs();
    say(has ? "Removed from favourites." : "Saved to your favourites.", "success");
    document.dispatchEvent(new CustomEvent("favorites-changed", { detail: { id, on: !has } }));
  }

  /* ---------- "Add to playlist" pop-up ---------- */
  function ensureModal() {
    let el = document.getElementById("playlist-modal");
    if (el) return el;
    document.body.insertAdjacentHTML("beforeend", `
    <div class="modal fade" id="playlist-modal" tabindex="-1" aria-labelledby="pl-title" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
        <div class="modal-header"><h2 class="modal-title h5" id="pl-title">Add to playlist</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
        <div class="modal-body">
          <div id="pl-list" class="list-group mb-3"></div>
          <form id="pl-new" class="input-group">
            <input class="form-control" id="pl-name" maxlength="80" placeholder="New playlist name" aria-label="New playlist name" required>
            <button class="btn btn-primary" type="submit">Create &amp; add</button>
          </form>
        </div>
      </div></div>
    </div>`);
    el = document.getElementById("playlist-modal");

    el.querySelector("#pl-list").addEventListener("click", async e => {
      const b = e.target.closest("[data-pl]"); if (!b) return;
      b.disabled = true;
      const ok = await addToPlaylist(b.dataset.pl, el.dataset.song, b.dataset.name);
      b.disabled = false;
      if (ok) bootstrap.Modal.getOrCreateInstance(el).hide();
    });
    el.querySelector("#pl-new").addEventListener("submit", async e => {
      e.preventDefault();
      const input = el.querySelector("#pl-name"), name = input.value.trim();
      if (!name || name.length > 80) return;
      const { data, error } = await db.from("playlists").insert({ owner_id: state.user.id, name, is_public: false }).select("id").single();
      if (error || !data) { console.error(error); return say("Could not create the playlist.", "danger"); }
      input.value = "";
      if (await addToPlaylist(data.id, el.dataset.song, name)) bootstrap.Modal.getOrCreateInstance(el).hide();
    });
    return el;
  }

  async function addToPlaylist(playlistId, songId, name) {
    const { data: lastRow } = await db.from("playlist_songs").select("position").eq("playlist_id", playlistId).order("position", { ascending: false }).limit(1);
    const position = (lastRow && lastRow[0] ? lastRow[0].position : -1) + 1;
    const { error } = await db.from("playlist_songs").insert({ playlist_id: playlistId, song_id: songId, position });
    if (error) {
      if (error.code === "23505") { say("This song is already in that playlist.", "dark"); return false; }
      console.error(error); say("Could not add the song. Please try again.", "danger"); return false;
    }
    say(`Added to “${name}”.`, "success");
    document.dispatchEvent(new CustomEvent("playlists-changed"));
    return true;
  }

  async function openPicker(songId) {
    if (!requireLogin("add songs to playlists")) return;
    const el = ensureModal(), list = el.querySelector("#pl-list");
    el.dataset.song = songId;
    list.innerHTML = `<div class="text-muted small p-2">Loading...</div>`;
    bootstrap.Modal.getOrCreateInstance(el).show();
    const { data, error } = await db.from("playlists").select("id,name,playlist_songs(count)")
      .eq("owner_id", state.user.id).order("created_at", { ascending: false });
    if (error) { console.error(error); list.innerHTML = `<div class="text-danger small p-2">Could not load your playlists.</div>`; return; }
    list.innerHTML = (data || []).length
      ? data.map(p => `<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" data-pl="${p.id}" data-name="${esc(p.name)}">
          <span class="text-truncate">${esc(p.name)}</span><span class="badge text-bg-light">${p.playlist_songs?.[0]?.count ?? 0}</span></button>`).join("")
      : `<div class="text-muted small p-2">You have no playlists yet. Create your first one below.</div>`;
  }

  async function logout() {
    await db.auth.signOut();
    location.href = "index.html";
  }

  /* ---------- Loading the signed-in person ---------- */
  async function loadUser(session) {
    state.user = session?.user || null;
    state.profile = null;
    state.favs = new Set();
    state.isAdmin = false;
    try {
      if (state.user) {
        const uid = state.user.id;
        const [p, f, a] = await Promise.all([
          db.from("profiles").select("full_name,avatar_url,is_active").eq("id", uid).maybeSingle(),
          db.from("favorites").select("song_id").eq("user_id", uid),
          db.rpc("is_admin")
        ]);
        state.profile = p.data || null;
        state.favs = new Set((f.data || []).map(r => r.song_id));
        state.isAdmin = a.data === true;
        if (state.profile && state.profile.is_active === false) {          // suspended by an admin
          await db.auth.signOut();
          state.user = null; state.profile = null; state.favs = new Set(); state.isAdmin = false;
          say("This account has been deactivated. Please contact us.", "danger");
        }
      }
    } catch (err) {
      console.error("Could not load the account details:", err);           // the page keeps working
    } finally {
      loaded = true;
      renderNav();
      paintFavs();
      firstDone();
      document.dispatchEvent(new CustomEvent("auth-changed"));
    }
  }

  db.auth.onAuthStateChange((event, session) => {
    const id = session?.user?.id || "";
    if (loaded && id === last && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")) return;
    last = id;
    setTimeout(() => loadUser(session), 0);        // never call the database inside this callback directly
  });
  setTimeout(async () => {                         // safety net if no start-up event arrived
    if (!loaded) { const { data } = await db.auth.getSession(); last = data.session?.user?.id || ""; loadUser(data.session); }
  }, 1500);

  document.addEventListener("click", e => {
    const fav = e.target.closest("[data-fav-song]");
    if (fav) { e.preventDefault(); toggleFav(fav.dataset.favSong, fav); return; }
    const pl = e.target.closest("[data-playlist-song]");
    if (pl) { e.preventDefault(); openPicker(pl.dataset.playlistSong); return; }
    if (e.target.closest("[data-logout]")) { e.preventDefault(); logout(); }
  });

  // Cards that appear later (loaded from the database) get the right heart state
  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(paintFavs, 100); })
    .observe(document.body, { childList: true, subtree: true });

  return {
    ready, safeNext, requireLogin, openPicker, logout,
    user: () => state.user,
    profile: () => state.profile,
    isAdmin: () => state.isAdmin,
    reload: async () => { const { data } = await db.auth.getSession(); await loadUser(data.session); }
  };
})();