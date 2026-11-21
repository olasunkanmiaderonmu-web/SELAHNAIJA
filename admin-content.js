/** Selah Naija - admin: music and sermon management. One shared script; the page says which one it is. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const KIND = document.body.dataset.kind;                 // "song" or "sermon"
  const SONG = KIND === "song";
  const CFG = SONG
    ? { table: "songs", person: "artists", personCol: "artist_id", audioBucket: "music-files", coverBucket: "song-covers",
        personLabel: "artist", noun: "song", publicPage: "song.html", catKinds: ["music", "both"] }
    : { table: "sermons", person: "preachers", personCol: "preacher_id", audioBucket: "sermon-files", coverBucket: "sermon-covers",
        personLabel: "preacher", noun: "sermon", publicPage: "sermon.html", catKinds: ["sermon", "both"] };
  const FIELDS = SONG
    ? "id,title,slug,artist_id,featured_artist,album_id,category_id,subcategory_id,release_date,description,lyrics,cover_path,audio_path,audio_format,duration_seconds,file_size_bytes,plays,downloads,status,is_featured,featured_date,created_at,artists(name),categories(name),albums(title)"
    : "id,title,slug,preacher_id,church,topic,category_id,subcategory_id,description,cover_path,audio_path,audio_format,duration_seconds,file_size_bytes,plays,downloads,status,is_featured,created_at,preachers(name),categories(name)";

  const SIZE = 15;
  const st = { page: 1, q: "", status: "", cat: "" };
  const byId = new Map();
  let people = [], cats = [];
  let editing = null, pendingCover = null, removeCover = false, audioFile = null, audioMeta = null, slugTouched = false;

  const modal = new bootstrap.Modal($("content-modal")), statsModal = new bootstrap.Modal($("stats-modal"));
  const when = d => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  const likeEsc = s => s.replace(/[\\%_]/g, m => "\\" + m);
  const formError = msg => { $("form-error").innerHTML = msg ? `<div class="alert alert-danger py-2"></div>` : ""; if (msg) { $("form-error").firstChild.textContent = msg; $("form-error").scrollIntoView({ block: "nearest" }); } };
  const setProgress = (label, pct) => {
    $("upload-progress").hidden = false;
    $("upload-label").textContent = label;
    $("upload-bar").style.width = pct + "%";
    $("upload-bar").textContent = pct + "%";
  };
  const mmss = s => (s || s === 0) ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";

  // ---------- Lookups: artists/preachers and categories ----------
  function fillPeople(selected = "") {
    $("c-person").innerHTML = `<option value="">Choose ${CFG.personLabel}...</option>` +
      people.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    $("c-person").value = selected;
  }
  function fillSubs(catId, selected = "") {
    const c = cats.find(x => x.id === catId);
    const subs = (c?.subcategories || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    $("c-subcategory").innerHTML = `<option value="">None</option>` + subs.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    $("c-subcategory").value = subs.some(s => s.id === selected) ? selected : "";
    $("c-subcategory").disabled = !subs.length;
  }
  async function loadLookups() {
    const [p, c] = await Promise.all([
      db.from(CFG.person).select(SONG ? "id,name" : "id,name,church").order("name").limit(1000),
      db.from("categories").select("id,name,applies_to,subcategories(id,name,sort_order)").in("applies_to", CFG.catKinds).order("sort_order")
    ]);
    if (p.error || c.error) console.error(p.error || c.error);
    people = p.data || []; cats = c.data || [];
    const opts = cats.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
    $("filter-category").innerHTML = `<option value="">All categories</option>` + opts;
    $("c-category").innerHTML = `<option value="">No category</option>` + opts;
    fillPeople(); fillSubs("");
  }

  async function loadAlbums() {
    if (!SONG) return;
    const a = $("c-person").value;
    if (!a) { $("album-list").innerHTML = ""; return; }
    const { data } = await db.from("albums").select("title").eq("artist_id", a).order("title");
    $("album-list").innerHTML = (data || []).map(x => `<option value="${escapeHtml(x.title)}">`).join("");
  }

  // ---------- List ----------
  const thumb = r => {
    const url = publicUrl(CFG.coverBucket, r.cover_path);
    return url ? `<img src="${escapeHtml(url)}" alt="" class="admin-thumb admin-thumb-sq">` : `<span class="admin-thumb admin-thumb-sq admin-thumb-empty"><i class="bi ${SONG ? "bi-music-note-beamed" : "bi-mic"}"></i></span>`;
  };
  const badge = s => `<span class="badge ${s === "published" ? "text-bg-success" : "text-bg-secondary"}">${s === "published" ? "Published" : "Draft"}</span>`;

  async function load() {
    $("rows").innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Loading...</td></tr>`;
    const from = (st.page - 1) * SIZE;
    let q = db.from(CFG.table).select(FIELDS, { count: "exact" });
    if (st.status) q = q.eq("status", st.status);
    if (st.cat) q = q.eq("category_id", st.cat);
    if (st.q) {
      const { data: pr } = await db.from(CFG.person).select("id").ilike("name", `%${st.q}%`).limit(50);
      const ids = (pr || []).map(r => r.id);
      q = q.or([`title.ilike.*${st.q}*`, ids.length ? `${CFG.personCol}.in.(${ids.join(",")})` : null].filter(Boolean).join(","));
    }
    const { data, error, count } = await q.order("created_at", { ascending: false }).order("id").range(from, from + SIZE - 1);
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      $("rows").innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Could not load the list.</td></tr>`;
      return;
    }
    byId.clear(); (data || []).forEach(r => byId.set(r.id, r));
    $("count").textContent = count ? `${count} ${CFG.noun}${count === 1 ? "" : "s"}` : "";
    $("rows").innerHTML = (data || []).length ? data.map(r => {
      const by = SONG ? r.artists?.name : r.preachers?.name;
      const pub = r.status === "published";
      return `<tr>
        <td>${thumb(r)}</td>
        <td><div class="fw-semibold">${escapeHtml(r.title)} ${r.is_featured ? `<i class="bi bi-star-fill text-warning" title="Featured"></i>` : ""}</div><div class="meta">${escapeHtml(by || "")}</div></td>
        <td class="d-none d-lg-table-cell">${escapeHtml(r.categories?.name || "—")}</td>
        <td>${badge(r.status)}</td>
        <td class="d-none d-md-table-cell text-nowrap"><i class="bi bi-play-circle me-1"></i>${formatNumber(r.plays)} <i class="bi bi-download ms-2 me-1"></i>${formatNumber(r.downloads)}</td>
        <td class="d-none d-xl-table-cell text-muted">${when(r.created_at)}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-secondary" data-stats="${r.id}" title="Statistics" aria-label="Statistics"><i class="bi bi-bar-chart-line"></i></button>
          ${pub ? `<a class="btn btn-sm btn-outline-secondary" href="${CFG.publicPage}?id=${encodeURIComponent(r.id)}" target="_blank" rel="noopener" title="View on the website" aria-label="View on the website"><i class="bi bi-eye"></i></a>` : ""}
          <button class="btn btn-sm ${pub ? "btn-outline-warning" : "btn-outline-success"}" data-toggle="${r.id}" title="${pub ? "Unpublish" : "Publish"}" aria-label="${pub ? "Unpublish" : "Publish"}"><i class="bi ${pub ? "bi-eye-slash" : "bi-check2-circle"}"></i></button>
          <button class="btn btn-sm btn-outline-primary" data-edit="${r.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-delete="${r.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </td></tr>`;
    }).join("") : `<tr><td colspan="7" class="text-center text-muted py-4">${(st.q || st.status || st.cat) ? "Nothing matches your filters." : `No ${CFG.noun}s yet. Click “Upload ${CFG.noun}” to add the first one.`}</td></tr>`;
    renderPager($("pager"), st.page, Math.ceil((count || 0) / SIZE), p => { st.page = p; load(); });
  }

  let timer;
  $("search").addEventListener("input", e => { clearTimeout(timer); timer = setTimeout(() => { st.q = e.target.value.replace(/[%_,()*\\"]/g, " ").trim(); st.page = 1; load(); }, 300); });
  $("filter-status").addEventListener("change", e => { st.status = e.target.value; st.page = 1; load(); });
  $("filter-category").addEventListener("change", e => { st.cat = e.target.value; st.page = 1; load(); });

  // ---------- Form ----------
  function setCoverPreview(url) {
    $("cover-preview").innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Cover preview">` : `<i class="bi ${SONG ? "bi-music-note-beamed" : "bi-mic"}"></i>`;
    $("cover-remove").hidden = !url;
  }

  async function openForm(r) {
    editing = r || null; pendingCover = null; removeCover = false; audioFile = null; audioMeta = null; slugTouched = !!r;
    formError(""); $("upload-progress").hidden = true; $("new-person-row").hidden = true; $("new-person-name").value = "";
    $("modal-title").textContent = r ? `Edit ${CFG.noun}` : `Upload ${CFG.noun}`;
    $("c-title").value = r ? r.title : "";
    $("c-slug").value = r ? r.slug : "";
    fillPeople(r ? r[CFG.personCol] : "");
    $("c-category").value = r?.category_id || "";
    fillSubs(r?.category_id || "", r?.subcategory_id || "");
    $("c-description").value = r?.description || "";
    $("c-status").value = r?.status || "draft";
    $("c-featured").checked = !!r?.is_featured;
    $("c-audio").value = ""; $("c-cover").value = "";
    $("c-duration").value = r?.duration_seconds ?? "";
    $("audio-info").textContent = r ? `Current file: ${r.audio_format.toUpperCase()}${r.file_size_bytes ? " · " + Admin.fmtBytes(r.file_size_bytes) : ""}${r.duration_seconds ? " · " + mmss(r.duration_seconds) : ""}. Choose a new file only if you want to replace it.` : "MP3, WAV or M4A, up to 50 MB.";
    $("audio-preview").hidden = true; $("audio-preview").removeAttribute("src");
    setCoverPreview(r ? publicUrl(CFG.coverBucket, r.cover_path) : null);
    if (SONG) {
      $("c-featured-artist").value = r?.featured_artist || "";
      $("c-album").value = r?.albums?.title || "";
      $("c-release").value = r?.release_date || "";
      $("c-lyrics").value = r?.lyrics || "";
      $("c-featured-date").value = r?.featured_date || "";
      loadAlbums();
    } else {
      $("c-church").value = r?.church || "";
      $("c-topic").value = r?.topic || "";
    }
    modal.show();
    if (r) {                                                   // let the admin listen to the stored file
      const { data } = await db.storage.from(CFG.audioBucket).createSignedUrl(r.audio_path, 900);
      if (data && editing && editing.id === r.id) { $("audio-preview").src = data.signedUrl; $("audio-preview").hidden = false; }
    }
  }

  $("add-content").addEventListener("click", () => openForm(null));
  $("c-title").addEventListener("input", () => { if (!slugTouched) $("c-slug").value = slugify($("c-title").value); });
  $("c-slug").addEventListener("input", () => { slugTouched = true; });
  $("c-category").addEventListener("change", e => fillSubs(e.target.value));
  $("c-person").addEventListener("change", () => {
    loadAlbums();
    if (!SONG && !$("c-church").value.trim()) { const p = people.find(x => x.id === $("c-person").value); if (p?.church) $("c-church").value = p.church; }
  });

  $("c-audio").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const info = Admin.audioInfo(file);
      const duration = await Admin.audioDuration(file);
      audioFile = file; audioMeta = { ...info, duration };
      if (duration) $("c-duration").value = duration;
      $("audio-info").textContent = `${file.name} · ${Admin.fmtBytes(file.size)}${duration ? " · " + mmss(duration) : ""}`;
      formError("");
    } catch (err) { audioFile = null; audioMeta = null; e.target.value = ""; formError(err.message); }
  });

  $("c-cover").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    try { pendingCover = await Admin.prepareImage(file, 1000); removeCover = false; setCoverPreview(URL.createObjectURL(pendingCover.blob)); formError(""); }
    catch (err) { pendingCover = null; e.target.value = ""; formError(err.message); }
  });
  $("cover-remove").addEventListener("click", () => { pendingCover = null; removeCover = true; $("c-cover").value = ""; setCoverPreview(null); });

  // Add a brand new artist / preacher without leaving the form
  $("new-person-toggle").addEventListener("click", () => { $("new-person-row").hidden = !$("new-person-row").hidden; if (!$("new-person-row").hidden) $("new-person-name").focus(); });
  $("new-person-save").addEventListener("click", async () => {
    const name = $("new-person-name").value.trim();
    if (name.length < 2 || name.length > 120) return formError(`Please enter the new ${CFG.personLabel}'s name (2 to 120 letters).`);
    const id = Admin.uuid(), base = slugify(name) || CFG.personLabel;
    const btn = $("new-person-save"); Admin.busy(btn, true);
    let res = await db.from(CFG.person).insert({ id, name, slug: base });
    if (res.error && res.error.code === "23505") res = await db.from(CFG.person).insert({ id, name, slug: base + "-" + Math.random().toString(36).slice(2, 5) });
    Admin.busy(btn, false);
    if (res.error) { console.error(res.error); return formError(`Could not add the ${CFG.personLabel}.`); }
    people.push({ id, name }); people.sort((a, b) => a.name.localeCompare(b.name));
    fillPeople(id); loadAlbums();
    $("new-person-row").hidden = true; $("new-person-name").value = ""; formError("");
    showToast(`${name} added.`, "success");
  });

  async function resolveAlbum(artistId, title, releaseDate) {
    title = title.trim();
    if (!title) return null;
    const found = await db.from("albums").select("id").eq("artist_id", artistId).ilike("title", likeEsc(title)).limit(1);
    if (found.data && found.data[0]) return found.data[0].id;
    const made = await db.from("albums").insert({ title, artist_id: artistId, release_date: releaseDate || null }).select("id").single();
    if (made.error) throw made.error;
    return made.data.id;
  }

  $("content-form").addEventListener("submit", async e => {
    e.preventDefault(); formError("");
    const title = $("c-title").value.trim();
    let slug = $("c-slug").value.trim().toLowerCase() || slugify(title);
    const person = $("c-person").value, desc = $("c-description").value.trim();
    const duration = parseInt($("c-duration").value, 10);
    if (title.length < 2 || title.length > 200) return formError(`Please enter a title (2 to 200 letters).`);
    if (!Admin.SLUG_RE.test(slug)) return formError("The web address can only use lowercase letters, numbers and dashes.");
    if (!person) return formError(`Please choose the ${CFG.personLabel}, or add a new one.`);
    if (!editing && !audioFile) return formError("Please choose the audio file to upload.");
    if (desc.length > 3000) return formError("The description is too long (3000 characters maximum).");
    if ($("c-duration").value && (isNaN(duration) || duration < 0 || duration > 86400)) return formError("The duration must be a number of seconds.");

    let extra;
    if (SONG) {
      const fa = $("c-featured-artist").value.trim(), lyrics = $("c-lyrics").value.trim(), album = $("c-album").value.trim();
      if (fa.length > 200) return formError("The featured artist text is too long.");
      if (album.length > 200) return formError("The album name is too long.");
      if (lyrics.length > 20000) return formError("The lyrics are too long (20000 characters maximum).");
      extra = { fa, lyrics, album, release: $("c-release").value || null, fdate: $("c-featured-date").value || null };
    } else {
      const church = $("c-church").value.trim(), topic = $("c-topic").value.trim();
      if (church.length > 120 || topic.length > 120) return formError("The church and topic must be 120 letters or fewer.");
      extra = { church, topic };
    }

    const btn = e.target.querySelector("button[type=submit]");
    Admin.busy(btn, true);
    const id = editing ? editing.id : Admin.uuid();
    let audio_path = editing?.audio_path, audio_format = editing?.audio_format, file_size = editing?.file_size_bytes ?? null;
    let cover_path = editing?.cover_path || null, newAudio = null, newCover = null, oldAudio = null, oldCover = null;
    try {
      if (audioFile) {
        newAudio = `${id}/audio-${Date.now()}.${audioMeta.ext}`;
        setProgress("Uploading audio...", 0);
        await Admin.uploadFile(CFG.audioBucket, newAudio, audioFile, audioMeta.type, pct => setProgress("Uploading audio...", pct));
        oldAudio = editing?.audio_path; audio_path = newAudio; audio_format = audioMeta.ext; file_size = audioFile.size;
      }
      if (pendingCover) {
        setProgress("Uploading cover...", 100);
        newCover = `${id}/cover-${Date.now()}.${pendingCover.ext}`;
        await Admin.uploadImage(CFG.coverBucket, newCover, pendingCover);
        oldCover = cover_path; cover_path = newCover;
      } else if (removeCover && cover_path) { oldCover = cover_path; cover_path = null; }

      setProgress("Saving...", 100);
      const common = {
        title, slug, description: desc || null,
        category_id: $("c-category").value || null, subcategory_id: $("c-subcategory").value || null,
        cover_path, audio_path, audio_format, duration_seconds: isNaN(duration) ? null : duration, file_size_bytes: file_size,
        status: $("c-status").value, is_featured: $("c-featured").checked
      };
      const payload = SONG
        ? { ...common, artist_id: person, featured_artist: extra.fa || null, album_id: await resolveAlbum(person, extra.album, extra.release),
            release_date: extra.release, lyrics: extra.lyrics || null, featured_date: extra.fdate }
        : { ...common, preacher_id: person, church: extra.church || null, topic: extra.topic || null };

      const save = () => editing ? db.from(CFG.table).update(payload).eq("id", id) : db.from(CFG.table).insert({ id, ...payload });
      let res = await save();
      if (res.error && res.error.code === "23505" && !editing && !slugTouched) {
        payload.slug = slug + "-" + Math.random().toString(36).slice(2, 5);
        res = await save();
      }
      if (res.error) {
        if (newAudio) await db.storage.from(CFG.audioBucket).remove([newAudio]);
        if (newCover) await db.storage.from(CFG.coverBucket).remove([newCover]);
        throw res.error;
      }
      if (oldAudio) db.storage.from(CFG.audioBucket).remove([oldAudio]);
      if (oldCover) db.storage.from(CFG.coverBucket).remove([oldCover]);
      modal.hide();
      showToast(editing ? `${CFG.noun[0].toUpperCase() + CFG.noun.slice(1)} saved.` : `${CFG.noun[0].toUpperCase() + CFG.noun.slice(1)} uploaded${payload.status === "published" ? " and published." : " as a draft."}`, "success");
      load();
    } catch (err) {
      console.error(err);
      if (newAudio && !err.code) db.storage.from(CFG.audioBucket).remove([newAudio]);        // an upload that did not finish
      formError(err.code === "23505" ? "Another item already uses that web address. Please change it."
        : /row-level security|permission/i.test(err.message || "") ? "You do not have permission to do this."
        : "Could not save. " + (err.message || ""));
      $("upload-progress").hidden = true;
    } finally { Admin.busy(btn, false); }
  });

  // ---------- Statistics ----------
  async function showStats(r) {
    $("stats-title").textContent = r.title;
    $("stats-body").innerHTML = `<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>Loading...</div>`;
    statsModal.show();
    const { data, error } = await db.rpc("admin_content_stats", { p_kind: KIND, p_id: r.id });
    if (error || !data) { console.error(error); $("stats-body").innerHTML = `<div class="alert alert-warning">Could not load the statistics. Make sure you ran the Phase 8B SQL (Step 1).</div>`; return; }
    const tiles = [["Plays", data.plays], ["Downloads", data.downloads], ["Downloads, last 7 days", data.downloads_7d], ["Downloads, last 30 days", data.downloads_30d], ["Downloads by members", data.member_downloads]];
    if (SONG) tiles.push(["Saved as favourite", data.favourites], ["In playlists", data.in_playlists]);
    const daily = data.daily || [], max = Math.max(1, ...daily.map(d => d.n));
    $("stats-body").innerHTML = `
      <div class="row g-2 mb-4">${tiles.map(([l, v]) => `<div class="col-6 col-md-4"><div class="stat-tile"><div class="stat-value">${formatNumber(v)}</div><div class="meta">${l}</div></div></div>`).join("")}</div>
      <h3 class="h6 text-uppercase text-muted">Downloads per day, last 14 days</h3>
      <div class="daily-chart" role="img" aria-label="Downloads per day">${daily.map(d => `
        <div class="daily-col" title="${new Date(d.day).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}: ${d.n}">
          <span class="daily-n">${d.n || ""}</span><div class="daily-bar" style="height:${Math.round(d.n / max * 100)}%"></div>
          <span class="daily-day">${new Date(d.day).getDate()}</span></div>`).join("")}</div>
      <p class="meta mt-3 mb-0">Plays and downloads include visitors without accounts. “Downloads by members” counts only people who were logged in.</p>`;
  }

  // ---------- Row buttons ----------
  $("rows").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.edit)  return openForm(byId.get(b.dataset.edit));
    if (b.dataset.stats) return showStats(byId.get(b.dataset.stats));

    if (b.dataset.toggle) {
      const r = byId.get(b.dataset.toggle), next = r.status === "published" ? "draft" : "published";
      b.disabled = true;
      const { error } = await db.from(CFG.table).update({ status: next }).eq("id", r.id);
      if (error) { b.disabled = false; console.error(error); return showToast("Could not change the status.", "danger"); }
      showToast(next === "published" ? "Published. It is now live on the website." : "Unpublished. It is hidden from the website.", "success");
      return load();
    }

    if (b.dataset.delete) {
      const r = byId.get(b.dataset.delete);
      if (!confirm(`Delete “${r.title}”?\n\nIts audio file and cover picture are deleted too, and it disappears from favourites, playlists and history. This cannot be undone.\n\n(To just hide it, use Unpublish instead.)`)) return;
      b.disabled = true;
      const { error } = await db.from(CFG.table).delete().eq("id", r.id);
      if (error) { b.disabled = false; console.error(error); return showToast("Could not delete it.", "danger"); }
      db.storage.from(CFG.audioBucket).remove([r.audio_path]);
      if (r.cover_path) db.storage.from(CFG.coverBucket).remove([r.cover_path]);
      showToast("Deleted, together with its files.", "success");
      load();
    }
  });

  await loadLookups();
  load();
  if (new URLSearchParams(location.search).get("new") === "1") openForm(null);
});