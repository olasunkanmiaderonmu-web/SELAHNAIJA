/** Selah Naija - admin: add, edit and delete preachers. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const BUCKET = "artist-images";           // preacher photos share the artist photo bucket
  const SIZE = 15;
  const modal = new bootstrap.Modal($("preacher-modal"));
  const st = { page: 1, q: "" };
  const byId = new Map();
  let editing = null, pending = null, removePhoto = false, slugTouched = false;

  const formError = msg => { $("form-error").innerHTML = msg ? `<div class="alert alert-danger py-2"></div>` : ""; if (msg) $("form-error").firstChild.textContent = msg; };
  const thumb = p => {
    const url = publicUrl(BUCKET, p.photo_path);
    return url ? `<img src="${escapeHtml(url)}" alt="" class="admin-thumb">` : `<span class="admin-thumb admin-thumb-empty"><i class="bi bi-person-fill"></i></span>`;
  };

  async function load() {
    $("preacher-rows").innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Loading...</td></tr>`;
    const from = (st.page - 1) * SIZE;
    let q = db.from("preachers").select("id,name,slug,church,bio,photo_path,created_at,sermons(count)", { count: "exact" });
    if (st.q) q = q.ilike("name", `%${st.q}%`);
    const { data, error, count } = await q.order("name").order("id").range(from, from + SIZE - 1);
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      $("preacher-rows").innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Could not load the preachers.</td></tr>`;
      return;
    }
    byId.clear(); (data || []).forEach(p => byId.set(p.id, p));
    $("preacher-count").textContent = count ? `${count} preacher${count === 1 ? "" : "s"}` : "";
    $("preacher-rows").innerHTML = (data || []).length ? data.map(p => `
      <tr>
        <td>${thumb(p)}</td>
        <td><div class="fw-semibold">${escapeHtml(p.name)}</div><div class="meta">/${escapeHtml(p.slug)}</div></td>
        <td class="d-none d-md-table-cell text-muted">${escapeHtml(p.church || "—")}</td>
        <td>${p.sermons?.[0]?.count ?? 0}</td>
        <td class="text-end text-nowrap">
          <a class="btn btn-sm btn-outline-secondary" href="preacher.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" title="View public page" aria-label="View public page"><i class="bi bi-eye"></i></a>
          <button class="btn btn-sm btn-outline-primary" data-edit="${p.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-delete="${p.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </td></tr>`).join("")
      : `<tr><td colspan="5" class="text-center text-muted py-4">${st.q ? "No preachers match your search." : "No preachers yet. Click “Add preacher” to create the first one."}</td></tr>`;
    renderPager($("pager"), st.page, Math.ceil((count || 0) / SIZE), p => { st.page = p; load(); });
  }

  let timer;
  $("preacher-search").addEventListener("input", e => {
    clearTimeout(timer);
    timer = setTimeout(() => { st.q = e.target.value.replace(/[%_,()*\\]/g, " ").trim(); st.page = 1; load(); }, 300);
  });

  function setPreview(url) {
    $("p-photo-preview").innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Preview">` : `<i class="bi bi-person-fill"></i>`;
    $("p-photo-remove").hidden = !url;
  }

  function openForm(p) {
    editing = p || null; pending = null; removePhoto = false; slugTouched = !!p;
    formError("");
    $("preacher-modal-title").textContent = p ? "Edit preacher" : "Add preacher";
    $("p-name").value = p ? p.name : "";
    $("p-slug").value = p ? p.slug : "";
    $("p-church").value = p?.church || "";
    $("p-bio").value = p?.bio || "";
    $("p-photo").value = "";
    setPreview(p ? publicUrl(BUCKET, p.photo_path) : null);
    modal.show();
  }
  $("add-preacher").addEventListener("click", () => openForm(null));
  $("p-name").addEventListener("input", () => { if (!slugTouched) $("p-slug").value = slugify($("p-name").value); });
  $("p-slug").addEventListener("input", () => { slugTouched = true; });

  $("p-photo").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    try { pending = await Admin.prepareImage(file, 800); removePhoto = false; setPreview(URL.createObjectURL(pending.blob)); formError(""); }
    catch (err) { pending = null; e.target.value = ""; formError(err.message); }
  });
  $("p-photo-remove").addEventListener("click", () => { pending = null; removePhoto = true; $("p-photo").value = ""; setPreview(null); });

  $("preacher-form").addEventListener("submit", async e => {
    e.preventDefault(); formError("");
    const name = $("p-name").value.trim();
    const slug = $("p-slug").value.trim().toLowerCase() || slugify(name);
    const church = $("p-church").value.trim(), bio = $("p-bio").value.trim();
    if (name.length < 2 || name.length > 120) return formError("Please enter the preacher's name (2 to 120 letters).");
    if (!Admin.SLUG_RE.test(slug)) return formError("The web address can only use lowercase letters, numbers and dashes.");
    if (church.length > 120) return formError("The church name is too long.");
    if (bio.length > 2000) return formError("The biography is too long (2000 characters maximum).");

    const btn = e.target.querySelector("button[type=submit]");
    Admin.busy(btn, true);
    const id = editing ? editing.id : Admin.uuid();
    let photo_path = editing ? editing.photo_path : null, oldPath = null, newPath = null;
    try {
      if (pending) {
        newPath = `preachers/${id}/photo-${Date.now()}.${pending.ext}`;
        await Admin.uploadImage(BUCKET, newPath, pending);
        oldPath = photo_path; photo_path = newPath;
      } else if (removePhoto && photo_path) { oldPath = photo_path; photo_path = null; }

      const payload = { name, slug, church: church || null, bio: bio || null, photo_path };
      const save = () => editing ? db.from("preachers").update(payload).eq("id", id) : db.from("preachers").insert({ id, ...payload });
      let res = await save();
      if (res.error && res.error.code === "23505" && !editing && !slugTouched) {
        payload.slug = slug + "-" + Math.random().toString(36).slice(2, 5);
        res = await save();
      }
      if (res.error) { if (newPath) await db.storage.from(BUCKET).remove([newPath]); throw res.error; }
      if (oldPath) db.storage.from(BUCKET).remove([oldPath]);
      modal.hide();
      showToast(editing ? "Preacher saved." : "Preacher added.", "success");
      load();
    } catch (err) {
      console.error(err);
      formError(err.code === "23505" ? "Another preacher already uses that web address. Please change it."
        : /row-level security/i.test(err.message || "") ? "You do not have permission to do this."
        : "Could not save the preacher. " + (err.message || ""));
    } finally { Admin.busy(btn, false); }
  });

  $("preacher-rows").addEventListener("click", async e => {
    const ed = e.target.closest("[data-edit]");
    if (ed) return openForm(byId.get(ed.dataset.edit));
    const del = e.target.closest("[data-delete]");
    if (!del) return;
    const p = byId.get(del.dataset.delete); if (!p) return;
    const n = p.sermons?.[0]?.count ?? 0;
    if (n > 0) return showToast(`${p.name} still has ${n} sermon${n === 1 ? "" : "s"}. Delete or move those sermons first.`, "danger");
    if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    del.disabled = true;
    const { error } = await db.from("preachers").delete().eq("id", p.id);
    if (error) {
      del.disabled = false; console.error(error);
      return showToast(error.code === "23503" ? "This preacher still has sermons. Delete or move them first." : "Could not delete the preacher.", "danger");
    }
    if (p.photo_path) db.storage.from(BUCKET).remove([p.photo_path]);
    showToast("Preacher deleted.", "success");
    load();
  });

  load();
  if (new URLSearchParams(location.search).get("new") === "1") openForm(null);
});