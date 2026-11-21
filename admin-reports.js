/** Selah Naija - admin: review reports from visitors. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const SIZE = 15, st = { page: 1, status: "open", reason: "" };
  const byId = new Map();
  const when = d => new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const REASON = { broken_download: "Broken download", wrong_information: "Wrong information", inappropriate: "Inappropriate", copyright: "Copyright concern", other: "Other" };
  const REASON_COLOR = { broken_download: "text-bg-warning", wrong_information: "text-bg-info", inappropriate: "text-bg-danger", copyright: "text-bg-danger", other: "text-bg-secondary" };
  const STATUS = { open: ["Open", "text-bg-warning"], resolved: ["Resolved", "text-bg-success"], dismissed: ["Dismissed", "text-bg-secondary"] };

  async function load() {
    $("rep-rows").innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Loading...</td></tr>`;
    const from = (st.page - 1) * SIZE;
    let q = db.from("content_reports")
      .select("id,reason,details,status,created_at,reporter_id,song_id,sermon_id,songs(id,title,status,artists(name)),sermons(id,title,status,preachers(name))", { count: "exact" });
    if (st.status) q = q.eq("status", st.status);
    if (st.reason) q = q.eq("reason", st.reason);
    const { data, error, count } = await q.order("created_at", { ascending: false }).order("id").range(from, from + SIZE - 1);
    if (error) {
      if (error.code === "PGRST103" && st.page > 1) { st.page = 1; return load(); }
      console.error(error);
      $("rep-rows").innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Could not load the reports.</td></tr>`;
      return;
    }
    byId.clear(); (data || []).forEach(r => byId.set(r.id, r));
    $("rep-count").textContent = count ? `${count} report${count === 1 ? "" : "s"}` : "";
    $("rep-rows").innerHTML = (data || []).length ? data.map(r => {
      const item = r.songs || r.sermons, kind = r.songs ? "song" : "sermon";
      const by = r.songs ? r.songs.artists?.name : r.sermons?.preachers?.name;
      const live = item && item.status === "published";
      const about = item
        ? `<i class="bi ${kind === "song" ? "bi-music-note-beamed" : "bi-mic"} text-primary me-1"></i><span class="fw-semibold">${escapeHtml(item.title)}</span><div class="meta">${escapeHtml(by || "")} ${live ? "" : `<span class="badge text-bg-secondary">Hidden</span>`}</div>`
        : `<span class="text-muted">General report${r.song_id || r.sermon_id ? " (content was deleted)" : ""}</span>`;
      const [stLabel, stColor] = STATUS[r.status] || [r.status, "text-bg-secondary"];
      return `<tr>
        <td>${about}</td>
        <td><span class="badge ${REASON_COLOR[r.reason] || "text-bg-secondary"}">${REASON[r.reason] || r.reason}</span></td>
        <td class="d-none d-lg-table-cell small" style="max-width:280px">${r.details ? `<span class="line-clamp-2" title="${escapeHtml(r.details)}">${escapeHtml(r.details)}</span>` : `<span class="text-muted">—</span>`}<div class="meta">${r.reporter_id ? "From a member" : "From a visitor"}</div></td>
        <td><span class="badge ${stColor}">${stLabel}</span></td>
        <td class="d-none d-md-table-cell text-muted small">${when(r.created_at)}</td>
        <td class="text-end text-nowrap">
          ${live ? `<a class="btn btn-sm btn-outline-secondary" href="${kind}.html?id=${encodeURIComponent(item.id)}" target="_blank" rel="noopener" title="View on the website" aria-label="View on the website"><i class="bi bi-eye"></i></a>
                    <button class="btn btn-sm btn-outline-warning" data-unpublish="${r.id}" title="Unpublish this ${kind}" aria-label="Unpublish this ${kind}"><i class="bi bi-eye-slash"></i></button>` : ""}
          ${r.status === "open"
            ? `<button class="btn btn-sm btn-outline-success" data-set="${r.id}|resolved" title="Mark as resolved" aria-label="Mark as resolved"><i class="bi bi-check2-circle"></i></button>
               <button class="btn btn-sm btn-outline-secondary" data-set="${r.id}|dismissed" title="Dismiss" aria-label="Dismiss"><i class="bi bi-x-circle"></i></button>`
            : `<button class="btn btn-sm btn-outline-primary" data-set="${r.id}|open" title="Reopen" aria-label="Reopen"><i class="bi bi-arrow-counterclockwise"></i></button>`}
        </td></tr>`;
    }).join("") : `<tr><td colspan="6" class="text-center text-muted py-4">${st.status === "open" && !st.reason ? "No open reports. Everything looks good." : "No reports match these filters."}</td></tr>`;
    renderPager($("pager"), st.page, Math.ceil((count || 0) / SIZE), p => { st.page = p; load(); });
  }

  $("rep-status").addEventListener("change", e => { st.status = e.target.value; st.page = 1; load(); });
  $("rep-reason").addEventListener("change", e => { st.reason = e.target.value; st.page = 1; load(); });

  $("rep-rows").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;

    if (b.dataset.set) {
      const [id, status] = b.dataset.set.split("|"); b.disabled = true;
      const { error } = await db.from("content_reports").update({ status }).eq("id", id);
      if (error) { b.disabled = false; console.error(error); return showToast("Could not update the report.", "danger"); }
      showToast(status === "open" ? "Report reopened." : status === "resolved" ? "Marked as resolved." : "Report dismissed.", "success");
      return load();
    }

    if (b.dataset.unpublish) {
      const r = byId.get(b.dataset.unpublish), item = r.songs || r.sermons, table = r.songs ? "songs" : "sermons";
      if (!confirm(`Unpublish “${item.title}”?\n\nIt is hidden from the website straight away. You can publish it again later from the Music or Sermons page.`)) return;
      b.disabled = true;
      const { error } = await db.from(table).update({ status: "draft" }).eq("id", item.id);
      if (error) { b.disabled = false; console.error(error); return showToast("Could not unpublish it.", "danger"); }
      showToast("Unpublished. It is no longer visible on the website.", "success");
      load();
    }
  });

  load();
});