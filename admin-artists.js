/** Selah Naija - admin: add, edit and delete artists. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const BUCKET = "artist-images";
  const SIZE = 15;
  const SOCIALS = [
    ["website", "Website"], ["facebook", "Facebook"], ["instagram", "Instagram"], ["x", "X (Twitter)"], ["youtube", "YouTube"],
    ["tiktok", "TikTok"], ["spotify", "Spotify"], ["audiomack", "Audiomack"], ["boomplay", "Boomplay"]
  ];
  $("social-fields").innerHTML = SOCIALS.map(([k, l]) =>
    `<div class="col-md-6"><label class="form-label small mb-1" for="soc-${k}">${l}</label><input type="url" class="form-control" id="soc-${k}" placeholder="https://" maxlength="300"></div>`).join("");

  const modal = new bootstrap.Modal($("artist-modal"));
  const st = { page: 1, q: "" };
  const byId = new Map();
  let editing = null, pending = null, removePhoto = false, slugTouched = false;

  const formError = msg => { $("form-error").innerHTML = msg ? `<div class="alert alert-danger py-2"></div>` : ""; if (msg) $("form-error").firstChild.textContent = msg; };
  const when = d => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  const thumb = a => {
    const url = publicUrl(BUCKET, a.photo_path);
    return url ? `<img src="${escapeHtml(url)}" alt="" class="admin-thumb">` : `<span class="admin-thumb admin-thumb-empty"><i class="bi bi-person-fill"></i></span>`;
  };

  // ---------- List ----------
  async function load() {
    $("artist-rows").innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Loading...</td></tr>`;
    const from = (st.page - 1) * SIZE;
    let q = db.from("artists").select("id,name,slug,bio,photo_path,social_links,is_featured,created_at,songs(count)", { count: "exact" });
    if (st.q) q = q.ilike("name", `%${st.q}%`);
    const { data, error, count } = await q.order("name").order("id").range(from, from + SIZE - 1);
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      $("artist-rows").innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Could not load the artists.</td></tr>`;
      return;
    }
    byId.clear(); (data || []).forEach(a => byId.set(a.id, a));
    $("artist-count").textContent = count ? `${count} artist${count === 1 ? "" : "s"}` : "";
    $("artist-rows").innerHTML = (data || []).length ? data.map(a => {
      const n = a.songs?.[0]?.count ?? 0;
      return `<tr>
        <td>${thumb(a)}</td>
        <td><div class="fw-semibold">${escapeHtml(a.name)} ${a.is_featured ? `<i class="bi bi-star-fill text-warning" title="Featured"></i>` : ""}</div><div class="meta">/${escapeHtml(a.slug)}</div></td>
        <td>${n}</td>
        <td class="d-none d-md-table-cell text-muted">${when(a.created_at)}</td>
        <td class="text-end text-nowrap">
          <a class="btn btn-sm btn-outline-secondary" href="artist.html?id=${encodeURIComponent(a.id)}" target="_blank" rel="noopener" title="View public page" aria-label="View public page"><i class="bi bi-eye"></i></a>
          <button class="btn btn-sm btn-outline-primary" data-edit="${a.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-delete="${a.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </td></tr>`;
    }).join("") : `<tr><td colspan="5" class="text-center text-muted py-4">${st.q ? "No artists match your search." : "No artists yet. Click “Add artist” to create the first one."}</td></tr>`;
    renderPager($("pager"), st.page, Math.ceil((count || 0) / SIZE), p => { st.page = p; load(); });
  }

  let timer;
  $("artist-search").addEventListener("input", e => {
    clearTimeout(timer);
    timer = setTimeout(() => { st.q = e.target.value.replace(/[%_,()*\\]/g, " ").trim(); st.page = 1; load(); }, 300);
  });

  // ---------- Form ----------
  function setPreview(url) {
    $("a-photo-preview").innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Preview">` : `<i class="bi bi-person-fill"></i>`;
    $("a-photo-remove").hidden = !url;
  }

  function openForm(a) {
    editing = a || null; pending = null; removePhoto = false; slugTouched = !!a;
    formError("");
    $("artist-modal-title").textContent = a ? "Edit artist" : "Add artist";
    $("a-name").value = a ? a.name : "";
    $("a-slug").value = a ? a.slug : "";
    $("a-bio").value = a?.bio || "";
    $("a-featured").checked = !!a?.is_featured;
    $("a-photo").value = "";
    SOCIALS.forEach(([k]) => { $("soc-" + k).value = (a?.social_links && a.social_links[k]) || ""; });
    setPreview(a ? publicUrl(BUCKET, a.photo_path) : null);
    modal.show();
  }

  $("add-artist").addEventListener("click", () => openForm(null));
  $("a-name").addEventListener("input", () => { if (!slugTouched) $("a-slug").value = slugify($("a-name").value); });
  $("a-slug").addEventListener("input", () => { slugTouched = true; });

  $("a-photo").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      pending = await Admin.prepareImage(file, 800);
      removePhoto = false;
      setPreview(URL.createObjectURL(pending.blob));
      formError("");
    } catch (err) { pending = null; e.target.value = ""; formError(err.message); }
  });
  $("a-photo-remove").addEventListener("click", () => { pending = null; removePhoto = true; $("a-photo").value = ""; setPreview(null); });

  $("artist-form").addEventListener("submit", async e => {
    e.preventDefault(); formError("");
    const name = $("a-name").value.trim();
    let slug = $("a-slug").value.trim().toLowerCase() || slugify(name);
    const bio = $("a-bio").value.trim();
    if (name.length < 2 || name.length > 120) return formError("Please enter the artist's name (2 to 120 letters).");
    if (!Admin.SLUG_RE.test(slug)) return formError("The web address can only use lowercase letters, numbers and dashes.");
    if (bio.length > 2000) return formError("The biography is too long (2000 characters maximum).");

    const social = {};
    for (const [k, label] of SOCIALS) {
      const v = $("soc-" + k).value.trim();
      if (!v) continue;
      if (!/^https?:\/\/\S+$/i.test(v)) return formError(`Please enter a full web address starting with https:// for ${label}.`);
      social[k] = v;
    }

    const btn = e.target.querySelector("button[type=submit]");
    Admin.busy(btn, true);
    const id = editing ? editing.id : Admin.uuid();
    let photo_path = editing ? editing.photo_path : null, oldPath = null, newPath = null;
    try {
      if (pending) {
        newPath = `${id}/photo-${Date.now()}.${pending.ext}`;
        await Admin.uploadImage(BUCKET, newPath, pending);
        oldPath = photo_path; photo_path = newPath;
      } else if (removePhoto && photo_path) { oldPath = photo_path; photo_path = null; }

      const payload = { name, slug, bio: bio || null, photo_path, social_links: social, is_featured: $("a-featured").checked };
      const save = () => editing ? db.from("artists").update(payload).eq("id", id) : db.from("artists").insert({ id, ...payload });
      let res = await save();
      if (res.error && res.error.code === "23505" && !editing && !slugTouched) {      // slug already used: add a short suffix
        payload.slug = slug + "-" + Math.random().toString(36).slice(2, 5);
        res = await save();
      }
      if (res.error) { if (newPath) await db.storage.from(BUCKET).remove([newPath]); throw res.error; }
      if (oldPath) db.storage.from(BUCKET).remove([oldPath]);
      modal.hide();
      showToast(editing ? "Artist saved." : "Artist added.", "success");
      load();
    } catch (err) {
      console.error(err);
      formError(err.code === "23505" ? "Another artist already uses that web address. Please change it."
        : /row-level security/i.test(err.message || "") ? "You do not have permission to do this."
        : "Could not save the artist. " + (err.message || ""));
    } finally { Admin.busy(btn, false); }
  });

  // ---------- Edit and delete buttons ----------
  $("artist-rows").addEventListener("click", async e => {
    const ed = e.target.closest("[data-edit]");
    if (ed) return openForm(byId.get(ed.dataset.edit));
    const del = e.target.closest("[data-delete]");
    if (!del) return;
    const a = byId.get(del.dataset.delete); if (!a) return;
    const n = a.songs?.[0]?.count ?? 0;
    if (n > 0) return showToast(`${a.name} still has ${n} song${n === 1 ? "" : "s"}. Delete or move those songs first.`, "danger");
    if (!confirm(`Delete “${a.name}”?\n\nTheir albums are deleted too. This cannot be undone.`)) return;

    del.disabled = true;
    const albums = await db.from("albums").select("cover_path").eq("artist_id", a.id);
    const { error } = await db.from("artists").delete().eq("id", a.id);
    if (error) {
      del.disabled = false; console.error(error);
      return showToast(error.code === "23503" ? "This artist still has songs. Delete or move them first." : "Could not delete the artist.", "danger");
    }
    if (a.photo_path) db.storage.from(BUCKET).remove([a.photo_path]);
    const covers = (albums.data || []).map(x => x.cover_path).filter(Boolean);
    if (covers.length) db.storage.from("song-covers").remove(covers);
    showToast("Artist deleted.", "success");
    load();
  });

  load();
  if (new URLSearchParams(location.search).get("new") === "1") openForm(null);
});