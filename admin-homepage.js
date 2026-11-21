/** Selah Naija - admin: featured content and the Song of the Day. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const today = new Date().toLocaleDateString("en-CA");        // YYYY-MM-DD
  const clean = s => s.replace(/[%_,()*\\"]/g, " ").trim();

  /** Type-to-find box. search(q) returns rows; label(row) is the text shown; onPick(row) is called when one is chosen. */
  function picker(input, list, search, label, onPick) {
    let timer, rows = new Map();
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = clean(input.value);
      if (q.length < 2) { list.hidden = true; return; }
      timer = setTimeout(async () => {
        const found = await search(q);
        rows = new Map(found.map(r => [r.id, r]));
        list.innerHTML = found.length
          ? found.map(r => `<button type="button" class="list-group-item list-group-item-action" data-id="${r.id}">${label(r)}</button>`).join("")
          : `<div class="list-group-item text-muted small">No matches</div>`;
        list.hidden = false;
      }, 250);
    });
    list.addEventListener("click", e => {
      const b = e.target.closest("[data-id]"); if (!b) return;
      list.hidden = true; input.value = "";
      onPick(rows.get(b.dataset.id));
    });
    document.addEventListener("click", e => { if (!list.contains(e.target) && e.target !== input) list.hidden = true; });
  }

  // ---------- Featured lists (songs, sermons, artists) ----------
  function featureList({ table, items, search, listEl, itemsEl, select, line, searchSelect, searchFilter, empty }) {
    async function render() {
      itemsEl.innerHTML = `<div class="text-muted small">Loading...</div>`;
      const { data, error } = await db.from(table).select(select).eq("is_featured", true).order("created_at", { ascending: false }).limit(50);
      if (error) { console.error(error); itemsEl.innerHTML = `<div class="text-danger small">Could not load.</div>`; return; }
      itemsEl.innerHTML = (data || []).length
        ? `<ul class="list-group list-group-flush">${data.map(r => `
            <li class="list-group-item d-flex justify-content-between align-items-center gap-2 px-0">
              <div class="text-truncate">${line(r)}</div>
              <button class="btn btn-sm btn-outline-danger flex-shrink-0" data-remove="${r.id}" aria-label="Remove from featured" title="Remove"><i class="bi bi-x-lg"></i></button>
            </li>`).join("")}</ul>`
        : `<div class="text-muted small">${empty}</div>`;
    }
    itemsEl.addEventListener("click", async e => {
      const b = e.target.closest("[data-remove]"); if (!b) return;
      b.disabled = true;
      const { error } = await db.from(table).update({ is_featured: false }).eq("id", b.dataset.remove);
      if (error) { b.disabled = false; console.error(error); return showToast("Could not remove it.", "danger"); }
      showToast("Removed from featured.", "success"); render();
    });
    picker(search, listEl,
      async q => { const { data } = await searchFilter(db.from(table).select(searchSelect), q).limit(8); return data || []; },
      line,
      async row => {
        const { error } = await db.from(table).update({ is_featured: true }).eq("id", row.id);
        if (error) { console.error(error); return showToast("Could not feature it.", "danger"); }
        showToast("Added to featured.", "success"); render();
      });
    render();
  }

  const songLine = r => `<span class="fw-semibold">${escapeHtml(r.title)}</span> <span class="meta">${escapeHtml(r.artists?.name || "")}</span> ${r.status && r.status !== "published" ? `<span class="badge text-bg-secondary">Draft</span>` : ""}`;
  const sermonLine = r => `<span class="fw-semibold">${escapeHtml(r.title)}</span> <span class="meta">${escapeHtml(r.preachers?.name || "")}</span> ${r.status && r.status !== "published" ? `<span class="badge text-bg-secondary">Draft</span>` : ""}`;

  featureList({
    table: "songs", search: $("fs-search"), listEl: $("fs-list"), itemsEl: $("fs-items"),
    select: "id,title,status,artists(name)", searchSelect: "id,title,artists(name)",
    searchFilter: (q, t) => q.eq("status", "published").ilike("title", `%${t}%`).order("plays", { ascending: false }),
    line: songLine, empty: "No featured songs yet. Search above to add some."
  });
  featureList({
    table: "sermons", search: $("fm-search"), listEl: $("fm-list"), itemsEl: $("fm-items"),
    select: "id,title,status,preachers(name)", searchSelect: "id,title,preachers(name)",
    searchFilter: (q, t) => q.eq("status", "published").ilike("title", `%${t}%`).order("plays", { ascending: false }),
    line: sermonLine, empty: "No featured sermons yet. Search above to add some."
  });
  featureList({
    table: "artists", search: $("fa-search"), listEl: $("fa-list"), itemsEl: $("fa-items"),
    select: "id,name", searchSelect: "id,name",
    searchFilter: (q, t) => q.ilike("name", `%${t}%`).order("name"),
    line: r => `<span class="fw-semibold">${escapeHtml(r.name)}</span>`, empty: "No featured artists yet. Search above to add some."
  });

  // ---------- Song of the Day ----------
  let chosen = null;
  $("sotd-date").value = today; $("sotd-date").min = today;

  picker($("sotd-search"), $("sotd-list"),
    async q => { const { data } = await db.from("songs").select("id,title,artists(name)").eq("status", "published").ilike("title", `%${q}%`).order("plays", { ascending: false }).limit(8); return data || []; },
    songLine,
    row => { chosen = row; $("sotd-chosen").innerHTML = `Selected: <strong>${escapeHtml(row.title)}</strong> ${escapeHtml(row.artists?.name || "")}`; $("sotd-add").disabled = false; });

  async function renderSchedule() {
    const box = $("sotd-schedule");
    const { data, error } = await db.from("songs").select("id,title,status,featured_date,artists(name)").gte("featured_date", today).order("featured_date").limit(60);
    if (error) { console.error(error); box.innerHTML = `<div class="text-danger small">Could not load the schedule.</div>`; return; }
    box.innerHTML = (data || []).length
      ? `<h3 class="h6 text-uppercase text-muted">Scheduled</h3><ul class="list-group list-group-flush">${data.map(r => `
          <li class="list-group-item d-flex justify-content-between align-items-center gap-2 px-0">
            <div class="text-truncate"><span class="badge ${r.featured_date === today ? "text-bg-warning" : "text-bg-light"} me-2">${r.featured_date === today ? "Today" : new Date(r.featured_date + "T00:00:00").toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}</span>${songLine(r)}</div>
            <button class="btn btn-sm btn-outline-danger flex-shrink-0" data-unschedule="${r.id}" aria-label="Remove from schedule" title="Remove"><i class="bi bi-x-lg"></i></button>
          </li>`).join("")}</ul>`
      : `<div class="text-muted small">Nothing scheduled. Pick a song and a date above.</div>`;
  }

  $("sotd-add").addEventListener("click", async e => {
    const date = $("sotd-date").value;
    if (!chosen) return showToast("Please choose a song first.", "dark");
    if (!date || date < today) return showToast("Please choose today or a future date.", "danger");
    const btn = e.currentTarget; Admin.busy(btn, true);
    const { error } = await db.from("songs").update({ featured_date: date }).eq("id", chosen.id);
    Admin.busy(btn, false);
    if (error) { console.error(error); return showToast("Could not schedule the song.", "danger"); }
    showToast("Scheduled.", "success");
    chosen = null; $("sotd-chosen").textContent = ""; $("sotd-add").disabled = true;
    renderSchedule();
  });
  $("sotd-schedule").addEventListener("click", async e => {
    const b = e.target.closest("[data-unschedule]"); if (!b) return;
    b.disabled = true;
    const { error } = await db.from("songs").update({ featured_date: null }).eq("id", b.dataset.unschedule);
    if (error) { b.disabled = false; console.error(error); return showToast("Could not remove it.", "danger"); }
    showToast("Removed from the schedule.", "success"); renderSchedule();
  });
  renderSchedule();
});