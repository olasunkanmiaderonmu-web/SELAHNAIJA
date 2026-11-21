/** Selah Naija - admin: categories and subcategories. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const APPLIES = { music: "Music", sermon: "Sermons", both: "Music & sermons" };
  const catModal = new bootstrap.Modal($("cat-modal")), subModal = new bootstrap.Modal($("sub-modal"));
  const cats = new Map();
  let editingCat = null, catSlugTouched = false, editingSub = null, subParent = null, subSlugTouched = false;

  const showErr = (id, msg) => { $(id).innerHTML = msg ? `<div class="alert alert-danger py-2"></div>` : ""; if (msg) $(id).firstChild.textContent = msg; };
  const count = (row, key) => row[key]?.[0]?.count ?? 0;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  // ---------- List ----------
  async function load() {
    $("cat-list").innerHTML = `<div class="text-center text-muted py-5">Loading...</div>`;
    const { data, error } = await db.from("categories")
      .select("id,name,slug,applies_to,description,sort_order,songs(count),sermons(count),subcategories(id,name,slug,sort_order,songs(count),sermons(count))")
      .order("sort_order").order("name");
    if (error) { console.error(error); $("cat-list").innerHTML = `<div class="alert alert-danger">Could not load the categories.</div>`; return; }
    cats.clear(); (data || []).forEach(c => cats.set(c.id, c));
    if (!data.length) { $("cat-list").innerHTML = `<div class="empty-state"><i class="bi bi-folder2"></i>No categories yet. Click “Add category”.</div>`; return; }

    $("cat-list").innerHTML = data.map(c => {
      const subs = (c.subcategories || []).sort((a, b) => a.sort_order - b.sort_order);
      return `
      <div class="card admin-card mb-3"><div class="card-body">
        <div class="d-flex flex-wrap align-items-start gap-2">
          <div class="flex-grow-1">
            <h2 class="h5 mb-1">${escapeHtml(c.name)} <span class="chip">${APPLIES[c.applies_to] || c.applies_to}</span></h2>
            <div class="meta">/${escapeHtml(c.slug)} · ${plural(count(c, "songs"), "song")} · ${plural(count(c, "sermons"), "sermon")} · order ${c.sort_order}</div>
            ${c.description ? `<div class="small text-muted mt-1">${escapeHtml(c.description)}</div>` : ""}
          </div>
          <div class="text-nowrap">
            <a class="btn btn-sm btn-outline-secondary" href="category.html?cat=${encodeURIComponent(c.slug)}" target="_blank" rel="noopener" aria-label="View public page" title="View public page"><i class="bi bi-eye"></i></a>
            <button class="btn btn-sm btn-outline-primary" data-add-sub="${c.id}"><i class="bi bi-plus-lg me-1"></i>Subcategory</button>
            <button class="btn btn-sm btn-outline-primary" data-edit-cat="${c.id}" aria-label="Edit category" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-del-cat="${c.id}" aria-label="Delete category" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        ${subs.length ? `<ul class="list-group list-group-flush mt-3">${subs.map(s => `
          <li class="list-group-item d-flex flex-wrap align-items-center gap-2 px-0">
            <div class="flex-grow-1"><span class="fw-semibold">${escapeHtml(s.name)}</span>
              <span class="meta ms-2">/${escapeHtml(s.slug)} · ${plural(count(s, "songs"), "song")} · ${plural(count(s, "sermons"), "sermon")}</span></div>
            <div class="text-nowrap">
              <button class="btn btn-sm btn-outline-primary" data-edit-sub="${c.id}|${s.id}" aria-label="Edit subcategory" title="Edit"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-del-sub="${c.id}|${s.id}" aria-label="Delete subcategory" title="Delete"><i class="bi bi-trash"></i></button>
            </div>
          </li>`).join("")}</ul>` : `<div class="meta mt-3">No subcategories yet.</div>`}
      </div></div>`;
    }).join("");
  }

  // ---------- Category form ----------
  function openCat(c) {
    editingCat = c || null; catSlugTouched = !!c; showErr("cat-error", "");
    $("cat-modal-title").textContent = c ? "Edit category" : "Add category";
    $("c-name").value = c ? c.name : "";
    $("c-slug").value = c ? c.slug : "";
    $("c-applies").value = c ? c.applies_to : "music";
    $("c-desc").value = c?.description || "";
    $("c-order").value = c ? c.sort_order : ([...cats.values()].reduce((m, x) => Math.max(m, x.sort_order), 0) + 1);
    $("c-slug-warning").hidden = !c;
    catModal.show();
  }
  $("add-category").addEventListener("click", () => openCat(null));
  $("c-name").addEventListener("input", () => { if (!catSlugTouched) $("c-slug").value = slugify($("c-name").value); });
  $("c-slug").addEventListener("input", () => { catSlugTouched = true; });

  $("cat-form").addEventListener("submit", async e => {
    e.preventDefault(); showErr("cat-error", "");
    const name = $("c-name").value.trim();
    const slug = $("c-slug").value.trim().toLowerCase() || slugify(name);
    const desc = $("c-desc").value.trim(), order = parseInt($("c-order").value, 10);
    if (name.length < 2 || name.length > 60) return showErr("cat-error", "Please enter a name (2 to 60 letters).");
    if (!Admin.SLUG_RE.test(slug)) return showErr("cat-error", "The web address can only use lowercase letters, numbers and dashes.");
    if (isNaN(order) || order < 0 || order > 999) return showErr("cat-error", "The order must be a number from 0 to 999.");
    const payload = { name, slug, applies_to: $("c-applies").value, description: desc || null, sort_order: order };
    const btn = e.target.querySelector("button[type=submit]"); Admin.busy(btn, true);
    const { error } = editingCat ? await db.from("categories").update(payload).eq("id", editingCat.id) : await db.from("categories").insert(payload);
    Admin.busy(btn, false);
    if (error) {
      console.error(error);
      return showErr("cat-error", error.code === "23505" ? "Another category already uses that web address." : "Could not save the category.");
    }
    catModal.hide(); showToast(editingCat ? "Category saved." : "Category added.", "success"); load();
  });

  // ---------- Subcategory form ----------
  function openSub(parent, s) {
    subParent = parent; editingSub = s || null; subSlugTouched = !!s; showErr("sub-error", "");
    $("sub-modal-title").textContent = s ? "Edit subcategory" : "Add subcategory";
    $("sub-parent").textContent = `In category: ${parent.name}`;
    $("s-name").value = s ? s.name : "";
    $("s-slug").value = s ? s.slug : "";
    $("s-order").value = s ? s.sort_order : ((parent.subcategories || []).reduce((m, x) => Math.max(m, x.sort_order), 0) + 1);
    $("s-slug-warning").hidden = !s;
    subModal.show();
  }
  $("s-name").addEventListener("input", () => { if (!subSlugTouched) $("s-slug").value = slugify($("s-name").value); });
  $("s-slug").addEventListener("input", () => { subSlugTouched = true; });

  $("sub-form").addEventListener("submit", async e => {
    e.preventDefault(); showErr("sub-error", "");
    const name = $("s-name").value.trim();
    const slug = $("s-slug").value.trim().toLowerCase() || slugify(name);
    const order = parseInt($("s-order").value, 10);
    if (name.length < 2 || name.length > 60) return showErr("sub-error", "Please enter a name (2 to 60 letters).");
    if (!Admin.SLUG_RE.test(slug)) return showErr("sub-error", "The web address can only use lowercase letters, numbers and dashes.");
    if (isNaN(order) || order < 0 || order > 999) return showErr("sub-error", "The order must be a number from 0 to 999.");
    const payload = { category_id: subParent.id, name, slug, sort_order: order };
    const btn = e.target.querySelector("button[type=submit]"); Admin.busy(btn, true);
    const { error } = editingSub ? await db.from("subcategories").update(payload).eq("id", editingSub.id) : await db.from("subcategories").insert(payload);
    Admin.busy(btn, false);
    if (error) {
      console.error(error);
      return showErr("sub-error", error.code === "23505" ? "This category already has a subcategory with that web address." : "Could not save the subcategory.");
    }
    subModal.hide(); showToast(editingSub ? "Subcategory saved." : "Subcategory added.", "success"); load();
  });

  // ---------- Buttons ----------
  $("cat-list").addEventListener("click", async e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.editCat) return openCat(cats.get(t.dataset.editCat));
    if (t.dataset.addSub) return openSub(cats.get(t.dataset.addSub), null);
    if (t.dataset.editSub) { const [c, s] = t.dataset.editSub.split("|"); const cat = cats.get(c); return openSub(cat, cat.subcategories.find(x => x.id === s)); }

    if (t.dataset.delCat) {
      const c = cats.get(t.dataset.delCat);
      const subs = (c.subcategories || []).length;
      if (!confirm(`Delete the category “${c.name}”?\n\n• ${plural(subs, "subcategory")} will be deleted\n• ${plural(count(c, "songs"), "song")} and ${plural(count(c, "sermons"), "sermon")} will be left with no category\n\nThis cannot be undone.`)) return;
      t.disabled = true;
      const { error } = await db.from("categories").delete().eq("id", c.id);
      if (error) { t.disabled = false; console.error(error); return showToast("Could not delete the category.", "danger"); }
      showToast("Category deleted.", "success"); load();
    }
    if (t.dataset.delSub) {
      const [cid, sid] = t.dataset.delSub.split("|");
      const s = cats.get(cid).subcategories.find(x => x.id === sid);
      if (!confirm(`Delete the subcategory “${s.name}”?\n\n${plural(count(s, "songs"), "song")} and ${plural(count(s, "sermons"), "sermon")} will keep their main category but lose this subcategory.`)) return;
      t.disabled = true;
      const { error } = await db.from("subcategories").delete().eq("id", sid);
      if (error) { t.disabled = false; console.error(error); return showToast("Could not delete the subcategory.", "danger"); }
      showToast("Subcategory deleted.", "success"); load();
    }
  });

  load();
});