/** Selah Naija - admin: users, roles, suspension and activity. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const SIZE = 15, st = { page: 1, q: "" };
  const me = Auth.user().id;
  const byId = new Map();
  let roleUser = null;
  const rolesModal = new bootstrap.Modal($("roles-modal")), activityModal = new bootstrap.Modal($("activity-modal"));
  const date = d => d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Never";
  const dateTime = d => new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const LABEL = { admin: "Admin", moderator: "Moderator", artist: "Artist" };
  const COLOR = { admin: "text-bg-primary", moderator: "text-bg-warning", artist: "text-bg-info" };

  async function load() {
    $("user-rows").innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Loading...</td></tr>`;
    const { data, error } = await db.rpc("admin_list_users", { p_search: st.q, p_limit: SIZE, p_offset: (st.page - 1) * SIZE });
    if (error) {
      console.error(error);
      $("user-rows").innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Could not load the users. Make sure you ran the Phase 8C SQL (Step 1).</td></tr>`;
      return;
    }
    const total = data.length ? Number(data[0].total_count) : 0;
    if (!data.length && st.page > 1) { st.page = 1; return load(); }
    byId.clear(); data.forEach(u => byId.set(u.id, u));
    $("user-count").textContent = total ? `${total} user${total === 1 ? "" : "s"}` : "";
    $("user-rows").innerHTML = data.length ? data.map(u => {
      const name = u.full_name || "";
      const initial = (name || u.email || "?").charAt(0).toUpperCase();
      const roles = (u.roles || []).filter(r => LABEL[r]).map(r => `<span class="badge ${COLOR[r]}">${LABEL[r]}</span>`).join(" ") || `<span class="text-muted small">Member</span>`;
      const mine = u.id === me;
      return `<tr>
        <td><div class="d-flex align-items-center gap-2">
          <span class="nav-avatar nav-initial" style="width:36px;height:36px;font-size:1rem">${escapeHtml(initial)}</span>
          <div class="min-w-0"><div class="fw-semibold">${escapeHtml(name || "(no name)")} ${mine ? `<span class="badge text-bg-light">You</span>` : ""}</div><div class="meta">${escapeHtml(u.email || "")}</div></div></div></td>
        <td>${roles}</td>
        <td>${u.is_active ? `<span class="badge text-bg-success">Active</span>` : `<span class="badge text-bg-danger">Suspended</span>`}</td>
        <td class="d-none d-lg-table-cell">${date(u.created_at)}<div class="meta">Last sign-in: ${date(u.last_sign_in_at)}</div></td>
        <td class="d-none d-xl-table-cell meta">${u.favourites} favourites · ${u.playlists} playlists<br>${u.downloads} downloads · ${u.plays} plays</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-secondary" data-activity="${u.id}" title="Activity" aria-label="Activity"><i class="bi bi-activity"></i></button>
          <button class="btn btn-sm btn-outline-primary" data-roles="${u.id}" title="Roles" aria-label="Roles"><i class="bi bi-shield-check"></i></button>
          <button class="btn btn-sm ${u.is_active ? "btn-outline-danger" : "btn-outline-success"}" data-active="${u.id}" ${mine ? "disabled" : ""} title="${u.is_active ? "Suspend" : "Reactivate"}" aria-label="${u.is_active ? "Suspend" : "Reactivate"}"><i class="bi ${u.is_active ? "bi-slash-circle" : "bi-check-circle"}"></i></button>
        </td></tr>`;
    }).join("") : `<tr><td colspan="6" class="text-center text-muted py-4">${st.q ? "No users match your search." : "No users yet."}</td></tr>`;
    renderPager($("pager"), st.page, Math.ceil(total / SIZE), p => { st.page = p; load(); });
  }

  let timer;
  $("user-search").addEventListener("input", e => { clearTimeout(timer); timer = setTimeout(() => { st.q = e.target.value.trim(); st.page = 1; load(); }, 300); });

  // ---------- Buttons ----------
  $("user-rows").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;

    if (b.dataset.roles) {
      roleUser = byId.get(b.dataset.roles);
      $("roles-who").textContent = `${roleUser.full_name || roleUser.email} (${roleUser.email})`;
      document.querySelectorAll("[data-role]").forEach(sw => { sw.checked = (roleUser.roles || []).includes(sw.dataset.role); });
      return rolesModal.show();
    }

    if (b.dataset.active) {
      const u = byId.get(b.dataset.active), suspend = u.is_active;
      if (!confirm(suspend
        ? `Suspend ${u.email}?\n\nThey will be logged out and will not be able to log in until you reactivate the account. Their data is kept.`
        : `Reactivate ${u.email}?`)) return;
      b.disabled = true;
      const { error } = await db.rpc("admin_set_user_active", { p_user: u.id, p_active: !suspend });
      if (error) { b.disabled = false; console.error(error); return showToast(error.message || "Could not change the account.", "danger"); }
      showToast(suspend ? "Account suspended." : "Account reactivated.", "success");
      return load();
    }

    if (b.dataset.activity) {
      const u = byId.get(b.dataset.activity);
      $("activity-title").textContent = u.full_name || u.email;
      $("activity-body").innerHTML = `<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>Loading...</div>`;
      activityModal.show();
      const { data, error } = await db.rpc("admin_user_activity", { p_user: u.id });
      if (error || !data) { console.error(error); $("activity-body").innerHTML = `<div class="alert alert-warning">Could not load the activity.</div>`; return; }
      const list = (rows, empty) => rows.length
        ? `<ul class="list-group list-group-flush">${rows.map(r => `<li class="list-group-item d-flex justify-content-between gap-2 px-0"><span class="text-truncate"><i class="bi ${r.kind === "song" ? "bi-music-note-beamed" : "bi-mic"} text-primary me-2"></i>${escapeHtml(r.title || "(removed)")}</span><span class="meta text-nowrap">${dateTime(r.at)}</span></li>`).join("")}</ul>`
        : `<div class="text-muted small">${empty}</div>`;
      $("activity-body").innerHTML = `
        <div class="row g-4">
          <div class="col-md-6"><h3 class="h6 text-uppercase text-muted">Recently played</h3>${list(data.recent_plays || [], "Nothing played yet.")}</div>
          <div class="col-md-6"><h3 class="h6 text-uppercase text-muted">Recent downloads</h3>${list(data.recent_downloads || [], "No downloads yet.")}</div>
          <div class="col-12"><h3 class="h6 text-uppercase text-muted">Playlists</h3>
            ${(data.playlists || []).length ? (data.playlists).map(p => `<span class="chip me-1">${escapeHtml(p.name)} · ${p.is_public ? "public" : "private"}</span>`).join("") : `<div class="text-muted small">No playlists.</div>`}</div>
        </div>`;
    }
  });

  // ---------- Roles ----------
  $("roles-modal").addEventListener("change", async e => {
    const sw = e.target.closest("[data-role]"); if (!sw || !roleUser) return;
    const role = sw.dataset.role, grant = sw.checked;
    if (role === "admin" && grant && !confirm("Make this person an admin?\n\nAdmins have full control of the website, its content and its users.")) { sw.checked = false; return; }
    sw.disabled = true;
    const { error } = await db.rpc("admin_set_user_role", { p_user: roleUser.id, p_role: role, p_grant: grant });
    sw.disabled = false;
    if (error) { sw.checked = !grant; console.error(error); return showToast(error.message || "Could not change the role.", "danger"); }
    showToast("Role updated.", "success");
    load();
  });

  load();
});