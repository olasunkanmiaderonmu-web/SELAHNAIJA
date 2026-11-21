/** Selah Naija - admin: newsletter subscribers. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const SIZE = 20, st = { page: 1, q: "", status: "" };
  const byId = new Map();
  const date = d => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  async function totals() {
    const [all, act] = await Promise.all([
      db.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
      db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true)
    ]);
    $("n-total").textContent = formatNumber(all.count);
    $("n-active").textContent = formatNumber(act.count);
  }

  async function load() {
    $("sub-rows").innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Loading...</td></tr>`;
    const from = (st.page - 1) * SIZE;
    let q = db.from("newsletter_subscribers").select("id,email,is_active,subscribed_at", { count: "exact" });
    if (st.q) q = q.ilike("email", `%${st.q}%`);
    if (st.status) q = q.eq("is_active", st.status === "active");
    const { data, error, count } = await q.order("subscribed_at", { ascending: false }).order("id").range(from, from + SIZE - 1);
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      $("sub-rows").innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Could not load the subscribers.</td></tr>`;
      return;
    }
    byId.clear(); (data || []).forEach(s => byId.set(s.id, s));
    $("sub-count").textContent = count ? `${count} shown` : "";
    $("sub-rows").innerHTML = (data || []).length ? data.map(s => `
      <tr>
        <td class="fw-semibold">${escapeHtml(s.email)}</td>
        <td>${s.is_active ? `<span class="badge text-bg-success">Active</span>` : `<span class="badge text-bg-secondary">Unsubscribed</span>`}</td>
        <td class="d-none d-md-table-cell text-muted">${date(s.subscribed_at)}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm ${s.is_active ? "btn-outline-warning" : "btn-outline-success"}" data-toggle="${s.id}" title="${s.is_active ? "Mark as unsubscribed" : "Mark as active"}" aria-label="${s.is_active ? "Mark as unsubscribed" : "Mark as active"}"><i class="bi ${s.is_active ? "bi-bell-slash" : "bi-bell"}"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-delete="${s.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </td></tr>`).join("")
      : `<tr><td colspan="4" class="text-center text-muted py-4">${(st.q || st.status) ? "No subscribers match." : "No subscribers yet. They appear here after visitors use the form on your homepage."}</td></tr>`;
    renderPager($("pager"), st.page, Math.ceil((count || 0) / SIZE), p => { st.page = p; load(); });
  }

  let timer;
  $("sub-search").addEventListener("input", e => { clearTimeout(timer); timer = setTimeout(() => { st.q = e.target.value.replace(/[%_\\]/g, " ").trim(); st.page = 1; load(); }, 300); });
  $("sub-status").addEventListener("change", e => { st.status = e.target.value; st.page = 1; load(); });

  $("sub-rows").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.toggle) {
      const s = byId.get(b.dataset.toggle); b.disabled = true;
      const { error } = await db.from("newsletter_subscribers").update({ is_active: !s.is_active }).eq("id", s.id);
      if (error) { b.disabled = false; console.error(error); return showToast("Could not update the subscriber.", "danger"); }
      showToast(s.is_active ? "Marked as unsubscribed." : "Marked as active.", "success");
      totals(); return load();
    }
    if (b.dataset.delete) {
      const s = byId.get(b.dataset.delete);
      if (!confirm(`Delete ${s.email} from the list? This cannot be undone.`)) return;
      b.disabled = true;
      const { error } = await db.from("newsletter_subscribers").delete().eq("id", s.id);
      if (error) { b.disabled = false; console.error(error); return showToast("Could not delete the subscriber.", "danger"); }
      showToast("Subscriber deleted.", "success");
      totals(); load();
    }
  });

  // ---------- Export and copy (active subscribers only) ----------
  async function allActive() {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("newsletter_subscribers").select("email,subscribed_at").eq("is_active", true).order("subscribed_at").range(from, from + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }
  const safeCell = v => { v = String(v ?? ""); return /^[=+\-@]/.test(v) ? "'" + v : v; };   // stops spreadsheet formula tricks

  $("export-csv").addEventListener("click", async e => {
    const btn = e.currentTarget; Admin.busy(btn, true);
    try {
      const rows = await allActive();
      if (!rows.length) return showToast("There are no active subscribers to export.", "dark");
      const csv = "email,subscribed_at\r\n" + rows.map(r => `"${safeCell(r.email).replace(/"/g, '""')}",${r.subscribed_at}`).join("\r\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = `selah-naija-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      showToast(`Exported ${rows.length} subscriber${rows.length === 1 ? "" : "s"}.`, "success");
    } catch (err) { console.error(err); showToast("Could not export the list.", "danger"); }
    finally { Admin.busy(btn, false); }
  });

  $("copy-emails").addEventListener("click", async e => {
    const btn = e.currentTarget; Admin.busy(btn, true);
    try {
      const rows = await allActive();
      if (!rows.length) return showToast("There are no active subscribers to copy.", "dark");
      await navigator.clipboard.writeText(rows.map(r => r.email).join(", "));
      showToast(`Copied ${rows.length} email${rows.length === 1 ? "" : "s"}. Paste them into the “Bcc” box of your email.`, "success");
    } catch (err) { console.error(err); showToast("Could not copy the emails.", "danger"); }
    finally { Admin.busy(btn, false); }
  });

  totals(); load();
});