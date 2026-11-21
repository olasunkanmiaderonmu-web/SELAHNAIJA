/** Selah Naija - admin: messages from the Contact page. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const SIZE = 15, st = { page: 1, status: "new" };
  const byId = new Map();
  const modal = new bootstrap.Modal($("msg-modal"));
  const when = d => new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const BADGE = { new: ["New", "text-bg-warning"], read: ["Read", "text-bg-success"], archived: ["Archived", "text-bg-secondary"] };

  async function load() {
    $("msg-rows").innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Loading...</td></tr>`;
    const from = (st.page - 1) * SIZE;
    let q = db.from("contact_messages").select("id,name,email,subject,message,status,created_at", { count: "exact" });
    if (st.status) q = q.eq("status", st.status);
    const { data, error, count } = await q.order("created_at", { ascending: false }).order("id").range(from, from + SIZE - 1);
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      $("msg-rows").innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Could not load the messages. Make sure you ran the Phase 9 SQL.</td></tr>`;
      return;
    }
    byId.clear(); (data || []).forEach(m => byId.set(m.id, m));
    $("msg-count").textContent = count ? `${count} message${count === 1 ? "" : "s"}` : "";
    $("msg-rows").innerHTML = (data || []).length ? data.map(m => {
      const [label, color] = BADGE[m.status] || [m.status, "text-bg-secondary"];
      return `<tr class="${m.status === "new" ? "fw-semibold" : ""}" style="cursor:pointer" data-open="${m.id}">
        <td><div>${escapeHtml(m.name)}</div><div class="meta fw-normal">${escapeHtml(m.email)}</div></td>
        <td class="text-truncate" style="max-width:260px">${escapeHtml(m.subject || "(no subject)")}<div class="meta fw-normal text-truncate">${escapeHtml(m.message.slice(0, 90))}</div></td>
        <td><span class="badge ${color}">${label}</span></td>
        <td class="d-none d-md-table-cell text-muted small fw-normal">${when(m.created_at)}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-danger" data-delete="${m.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </td></tr>`;
    }).join("") : `<tr><td colspan="5" class="text-center text-muted py-4">${st.status === "new" ? "No new messages." : "No messages here."}</td></tr>`;
    renderPager($("pager"), st.page, Math.ceil((count || 0) / SIZE), p => { st.page = p; load(); });
  }

  async function setStatus(id, status) {
    const { error } = await db.from("contact_messages").update({ status }).eq("id", id);
    if (error) { console.error(error); showToast("Could not update the message.", "danger"); return false; }
    return true;
  }

  async function open(m) {
    $("msg-title").textContent = m.subject || "(no subject)";
    $("msg-body").innerHTML = `
      <div class="mb-3"><div class="fw-semibold">${escapeHtml(m.name)} &lt;<a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>&gt;</div><div class="meta">${when(m.created_at)}</div></div>
      <div class="pre-line"></div>`;
    $("msg-body").querySelector(".pre-line").textContent = m.message;
    const reply = `mailto:${encodeURIComponent(m.email).replace(/%40/g, "@")}?subject=${encodeURIComponent("Re: " + (m.subject || "Your message"))}`;
    $("msg-foot").innerHTML = `
      <a class="btn btn-primary" href="${reply}"><i class="bi bi-reply me-1"></i>Reply by email</a>
      <button class="btn btn-outline-secondary" id="msg-archive">${m.status === "archived" ? "Move back to inbox" : "Archive"}</button>
      <button class="btn btn-outline-secondary ms-auto" data-bs-dismiss="modal">Close</button>`;
    $("msg-archive").addEventListener("click", async () => {
      if (await setStatus(m.id, m.status === "archived" ? "read" : "archived")) { modal.hide(); showToast("Updated.", "success"); load(); }
    });
    modal.show();
    if (m.status === "new" && await setStatus(m.id, "read")) { m.status = "read"; load(); }
  }

  $("msg-status").addEventListener("change", e => { st.status = e.target.value; st.page = 1; load(); });
  $("msg-rows").addEventListener("click", async e => {
    const del = e.target.closest("[data-delete]");
    if (del) {
      e.stopPropagation();
      if (!confirm("Delete this message? This cannot be undone.")) return;
      del.disabled = true;
      const { error } = await db.from("contact_messages").delete().eq("id", del.dataset.delete);
      if (error) { del.disabled = false; console.error(error); return showToast("Could not delete the message.", "danger"); }
      showToast("Message deleted.", "success"); return load();
    }
    const row = e.target.closest("[data-open]");
    if (row) open(byId.get(row.dataset.open));
  });

  load();
});