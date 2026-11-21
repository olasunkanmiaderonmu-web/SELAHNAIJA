/** Selah Naija - admin overview: live totals, top songs and recent uploads. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat("en").format(n || 0);
  const when = d => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  // ---------- Totals (counted by the database) ----------
  const { data: s, error } = await db.rpc("admin_dashboard");
  if (error || !s) {
    console.error(error);
    $("stat-cards").innerHTML = `<div class="col-12"><div class="alert alert-warning">Could not load the totals. Make sure you ran the Phase 8 SQL (Step 1), then refresh.</div></div>`;
  } else {
    const cards = [
      ["bi-music-note-list", "Songs",              fmt(s.songs),      `${fmt(s.published_songs)} published`],
      ["bi-mic",             "Sermons",            fmt(s.sermons),    `${fmt(s.published_sermons)} published`],
      ["bi-person-lines-fill","Artists",           fmt(s.artists),    `${fmt(s.preachers)} preachers`],
      ["bi-people",          "Registered users",   fmt(s.users),      "with accounts"],
      ["bi-download",        "Total downloads",    fmt(s.downloads),  "songs and sermons"],
      ["bi-play-circle",     "Total plays",        fmt(s.plays),      "songs and sermons"],
      ["bi-envelope-heart",  "Newsletter",         fmt(s.subscribers),"subscribers"],
      ["bi-flag",            "Open reports",       fmt(s.open_reports), s.open_reports ? "need your attention" : "all clear"]
    ];
    $("stat-cards").innerHTML = cards.map(([icon, label, value, sub]) => `
      <div class="col-6 col-xl-3">
        <div class="card admin-card stat-card h-100"><div class="card-body">
          <div class="stat-icon"><i class="bi ${icon}"></i></div>
          <div class="stat-value">${value}</div>
          <div class="stat-label">${label}</div>
          <div class="meta">${sub}</div>
        </div></div>
      </div>`).join("");
  }

  // ---------- Lists ----------
  const songFields = "id,title,plays,downloads,status,artists(name)";
  const [topDl, topPlay, recentSongs, recentSermons] = await Promise.all([
    db.from("songs").select(songFields).order("downloads", { ascending: false }).limit(5),
    db.from("songs").select(songFields).order("plays", { ascending: false }).limit(5),
    db.from("songs").select("id,title,status,created_at,artists(name)").order("created_at", { ascending: false }).limit(8),
    db.from("sermons").select("id,title,status,created_at,preachers(name)").order("created_at", { ascending: false }).limit(8)
  ]);

  const badge = st => `<span class="badge ${st === "published" ? "text-bg-success" : "text-bg-secondary"}">${escapeHtml(st)}</span>`;
  const rankList = (res, key) => {
    const rows = res.data || [];
    if (res.error) { console.error(res.error); return `<div class="text-muted small">Could not load.</div>`; }
    if (!rows.length || !rows.some(r => r[key] > 0)) return `<div class="text-muted small">Nothing to show yet.</div>`;
    return `<ol class="list-group list-group-numbered list-group-flush">${rows.filter(r => r[key] > 0).map(r => `
      <li class="list-group-item d-flex justify-content-between align-items-start gap-2">
        <div class="me-auto text-truncate"><div class="fw-semibold text-truncate">${escapeHtml(r.title)}</div><div class="meta">${escapeHtml(r.artists?.name || "")} ${r.status !== "published" ? badge(r.status) : ""}</div></div>
        <span class="badge text-bg-light">${fmt(r[key])}</span>
      </li>`).join("")}</ol>`;
  };
  $("top-downloads").innerHTML = rankList(topDl, "downloads");
  $("top-plays").innerHTML = rankList(topPlay, "plays");

  const merged = [
    ...(recentSongs.data || []).map(r => ({ ...r, kind: "song", by: r.artists?.name })),
    ...(recentSermons.data || []).map(r => ({ ...r, kind: "sermon", by: r.preachers?.name }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

  $("recent-uploads").innerHTML = merged.length ? `
    <div class="table-responsive"><table class="table table-sm align-middle mb-0"><tbody>${merged.map(r => `
      <tr>
        <td style="width:2rem"><i class="bi ${r.kind === "song" ? "bi-music-note-beamed" : "bi-mic"} text-primary"></i></td>
        <td class="fw-semibold">${r.status === "published"
            ? `<a class="text-decoration-none" href="${r.kind}.html?id=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a>`
            : escapeHtml(r.title)}</td>
        <td class="text-muted">${escapeHtml(r.by || "")}</td>
        <td>${badge(r.status)}</td>
        <td class="text-muted text-end">${when(r.created_at)}</td>
      </tr>`).join("")}</tbody></table></div>`
    : `<div class="text-muted small">No uploads yet. Songs and sermons you upload will appear here.</div>`;
});