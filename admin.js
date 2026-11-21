/**
 * Selah Naija - admin shell shared by every admin page:
 * access check, sidebar, top bar, pop-up messages and image helpers.
 * Each admin page calls  if (!(await Admin.init())) return;  before doing anything else.
 */

/** Small pop-up message in the top-right corner. type: dark | success | danger */
function showToast(message, type = "dark") {
  let box = document.getElementById("toast-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast-box";
    box.className = "toast-container position-fixed top-0 end-0 p-3";
    box.style.zIndex = 2000;
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${type} border-0`;
  el.setAttribute("role", "status");
  el.innerHTML = `<div class="d-flex"><div class="toast-body"></div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  el.querySelector(".toast-body").textContent = message;
  box.appendChild(el);
  el.addEventListener("hidden.bs.toast", () => el.remove());
  new bootstrap.Toast(el, { delay: 4000 }).show();
}

const Admin = (() => {
  const $ = id => document.getElementById(id);
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  // built: false = the page arrives in a later part, so the link is greyed out for now
    const NAV = [
    { id: "dashboard",  label: "Dashboard",  icon: "bi-speedometer2",      href: "admin.html",            built: true },
    { id: "music",      label: "Music",      icon: "bi-music-note-list",   href: "admin-music.html",      built: true },
    { id: "sermons",    label: "Sermons",    icon: "bi-mic",               href: "admin-sermons.html",    built: true },
    { id: "artists",    label: "Artists",    icon: "bi-person-lines-fill", href: "admin-artists.html",    built: true },
    { id: "preachers",  label: "Preachers",  icon: "bi-person-badge",      href: "admin-preachers.html",  built: true },
    { id: "categories", label: "Categories", icon: "bi-folder2-open",      href: "admin-categories.html", built: true },
    { id: "homepage",   label: "Homepage",   icon: "bi-house-heart",       href: "admin-homepage.html",   built: true },
    { id: "users",      label: "Users",      icon: "bi-people",            href: "admin-users.html",      built: true },
    { id: "newsletter", label: "Newsletter", icon: "bi-envelope-heart",    href: "admin-newsletter.html", built: true },
    { id: "reports",    label: "Reports",    icon: "bi-flag",              href: "admin-reports.html",    built: true },
    { id: "messages",   label: "Messages",   icon: "bi-chat-dots",         href: "admin-messages.html",   built: true },
    { id: "settings",   label: "Settings",   icon: "bi-gear",              href: "admin-settings.html",   built: true }
  ];
  
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  }

  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Please wait...`; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  /**
   * Checks a chosen picture, shrinks it (so pages load fast) and converts it to WebP/JPEG.
   * Returns { blob, type, ext } ready to upload. Throws an Error with a friendly message.
   */
  async function prepareImage(file, maxPx = 1000) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const extOf = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    if (!allowed.includes(file.type)) throw new Error("Please choose a JPG, PNG or WebP picture.");
    if (file.size > 15 * 1024 * 1024) throw new Error("That picture is too large (15 MB maximum).");
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
      for (const type of ["image/webp", "image/jpeg"]) {
        const blob = await new Promise(r => canvas.toBlob(r, type, 0.85));
        if (blob && blob.type === type && blob.size <= 5 * 1024 * 1024) return { blob, type, ext: extOf[type] };
      }
    } catch (e) { console.warn("Picture could not be resized, using the original:", e); }
    if (file.size > 5 * 1024 * 1024) throw new Error("That picture is too large. Please use one under 5 MB.");
    return { blob: file, type: file.type, ext: extOf[file.type] };
  }

  async function uploadImage(bucket, path, prepared) {
    const { error } = await db.storage.from(bucket).upload(path, prepared.blob, { contentType: prepared.type, cacheControl: "31536000", upsert: false });
    if (error) throw error;
    return path;
  }

  const LOGO = `
    <svg class="logo-icon"><use href="#selah-icon"/></svg>
    <span class="logo-text"><span class="logo-name">Selah</span><span class="logo-sub">ADMIN</span></span>`;

  function renderShell(page) {
    document.body.insertAdjacentHTML("afterbegin", `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <symbol id="selah-icon" viewBox="0 0 100 100">
        <rect x="1.5" y="1.5" width="97" height="97" rx="24" fill="#241044" stroke="#6C35A5" stroke-width="3"/>
        <g fill="#FFFFFF" opacity="0.92">
          <rect x="12" y="40" width="6" height="20" rx="3"/><rect x="22" y="33" width="6" height="34" rx="3"/><rect x="32" y="26" width="6" height="48" rx="3"/>
          <rect x="62" y="26" width="6" height="48" rx="3"/><rect x="72" y="33" width="6" height="34" rx="3"/><rect x="82" y="40" width="6" height="20" rx="3"/>
        </g>
        <g fill="#D6AD55"><rect x="47" y="14" width="6" height="72" rx="3"/><rect x="40" y="32" width="20" height="6" rx="3"/></g>
      </symbol>
    </svg>`);

    $("admin-sidebar").innerHTML = `
      <div class="admin-brand"><a class="logo" href="admin.html">${LOGO}</a></div>
      <nav class="admin-nav" aria-label="Admin">
        ${NAV.map(n => n.built
      ? `<a class="admin-link ${n.id === page ? "active" : ""}" href="${n.href}"><i class="bi ${n.icon}"></i>${n.label}</a>`
      : `<span class="admin-link disabled" title="Coming in the next part"><i class="bi ${n.icon}"></i>${n.label}<span class="badge text-bg-secondary ms-auto">Soon</span></span>`).join("")}
      </nav>
      <div class="admin-foot"><a class="admin-link" href="index.html" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i>View website</a></div>`;

    const user = Auth.user();
    $("admin-top").innerHTML = `
      <button class="btn btn-outline-primary btn-sm admin-burger" id="admin-burger" aria-label="Open menu"><i class="bi bi-list"></i></button>
      <span class="ms-auto d-flex align-items-center gap-3">
        <span class="text-muted small d-none d-sm-inline"><i class="bi bi-shield-check text-success me-1"></i>${escapeHtml(user.email)}</span>
        <button class="btn btn-outline-secondary btn-sm" data-logout><i class="bi bi-box-arrow-right me-1"></i>Log out</button>
      </span>`;

    const sidebar = $("admin-sidebar"), backdrop = $("admin-backdrop");
    const close = () => { sidebar.classList.remove("open"); backdrop.hidden = true; };
    $("admin-burger").addEventListener("click", () => { sidebar.classList.add("open"); backdrop.hidden = false; });
    backdrop.addEventListener("click", close);
    sidebar.addEventListener("click", e => { if (e.target.closest("a")) close(); });
  }

  /** Returns true only for a logged-in administrator. Everyone else sees a message, never the admin screens. */
  async function init() {
    const gate = $("admin-gate"), shell = $("admin-shell");
    const page = document.body.dataset.admin;
    if (!db) { gate.innerHTML = `<div class="empty-state">${escapeHtml(dbProblem)}</div>`; return false; }

    await Auth.ready;
    if (!Auth.user()) {
      const here = (location.pathname.split("/").pop() || "admin.html") + location.search;
      location.replace("login.html?next=" + encodeURIComponent(here));
      return false;
    }
    const { data, error } = await db.rpc("is_admin");        // answered by the database, not by this page
    if (error || data !== true) {
      gate.innerHTML = `
        <div class="admin-denied">
          <i class="bi bi-lock-fill display-4 text-primary"></i>
          <h1 class="h4 mt-3">Administrators only</h1>
          <p class="text-muted">This area is for the site administrator. If you think you should have access, please contact the site owner.</p>
          <a class="btn btn-primary" href="index.html">Back to the website</a>
          <button class="btn btn-outline-secondary ms-2" data-logout>Log out</button>
        </div>`;
      return false;
    }
    renderShell(page);
    gate.hidden = true;
    shell.hidden = false;
    document.addEventListener("auth-changed", () => { if (!Auth.user()) location.replace("login.html"); });
    return true;
  }

    /* ---------- Added in Phase 8B: audio files ---------- */
  const AUDIO_TYPES = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" };
  const MAX_AUDIO = 50 * 1024 * 1024;            // the free Supabase plan accepts files up to 50 MB

  function fmtBytes(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

  /** Checks the chosen audio file. Throws an Error with a friendly message. */
  function audioInfo(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!AUDIO_TYPES[ext]) throw new Error("Please choose an MP3, WAV or M4A audio file.");
    if (file.size < 1024) throw new Error("That file looks empty. Please choose another one.");
    if (file.size > MAX_AUDIO) throw new Error(`This file is ${fmtBytes(file.size)}. The limit is 50 MB. Please compress it first (for example, export the MP3 at 128 kbps).`);
    return { ext, type: AUDIO_TYPES[ext] };
  }

  /** Reads the length of the audio in whole seconds (null if the browser cannot tell). */
  function audioDuration(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file), a = new Audio();
      let finished = false;
      const done = v => { if (finished) return; finished = true; URL.revokeObjectURL(url); resolve(v); };
      a.preload = "metadata";
      a.onloadedmetadata = () => done(isFinite(a.duration) ? Math.round(a.duration) : null);
      a.onerror = () => done(null);
      setTimeout(() => done(null), 8000);
      a.src = url;
    });
  }

  /** Uploads a file to a storage bucket and reports progress (0-100). */
  async function uploadFile(bucket, path, file, contentType, onProgress) {
    const { data } = await db.auth.getSession();
    const token = data.session && data.session.access_token;
    if (!token) throw new Error("Your login has expired. Please log in again.");
    const url = `${SB_URL.replace(/\/$/, "")}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
    const friendly = { 401: "You do not have permission to upload.", 403: "You do not have permission to upload.", 409: "A file with that name already exists.", 413: "The file is too large for your Supabase plan (50 MB on the free plan)." };
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("apikey", SB_KEY);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.setRequestHeader("cache-control", "max-age=31536000");
        xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve()
          : reject(Object.assign(new Error(friendly[xhr.status] || `Upload failed (${xhr.status}).`), { status: xhr.status }));
        xhr.onerror = () => reject(Object.assign(new Error("The connection dropped during the upload."), { status: 0 }));
        xhr.send(file);
      });
    } catch (err) {
      if (friendly[err.status]) throw err;
      console.warn("Direct upload failed, trying the standard method:", err);
      const { error } = await db.storage.from(bucket).upload(path, file, { contentType, cacheControl: "31536000", upsert: false });
      if (error) throw error;
      if (onProgress) onProgress(100);
    }
  }

  return { init, uuid, busy, prepareImage, uploadImage, SLUG_RE, audioInfo, audioDuration, uploadFile, fmtBytes };
})();