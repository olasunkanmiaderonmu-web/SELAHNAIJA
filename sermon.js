/** Selah Naija - single sermon page. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const view = $("sermon-view");
  const notFound = msg => {
    view.innerHTML = `<div class="empty-state"><i class="bi bi-mic"></i>${msg} <a href="sermons.html">Browse all sermons</a></div>`;
  };
  if (!db) return notFound(escapeHtml(dbProblem));

  const id = new URLSearchParams(location.search).get("id");
  if (!id) return notFound("No sermon was selected.");

  const { data: s, error } = await db.from("sermons")
    .select("*, preachers(id,name,church), categories(name,slug), subcategories(name)")
    .eq("id", id).eq("status", "published").maybeSingle();
  if (error || !s) {
    if (error) console.error(error);
    return notFound("We could not find this sermon. It may have been removed.");
  }

  const preacher = s.preachers?.name || "";
  const church = s.church || s.preachers?.church || "";
  const cover = publicUrl("sermon-covers", s.cover_path);
  const pageUrl = location.href;
  const shareText = `Listen to "${s.title}"${preacher ? " by " + preacher : ""} on Selah Naija`;
  const fmtDate = d => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

  const facts = [
    ["bi-person", "Preacher", preacher],
    ["bi-building", "Church", church],
    ["bi-chat-quote", "Topic", s.topic],
    ["bi-calendar3", "Uploaded", (s.published_at || s.created_at) && fmtDate(s.published_at || s.created_at)],
    ["bi-clock", "Duration", s.duration_seconds && formatDuration(s.duration_seconds)],
    ["bi-file-earmark-music", "Format", s.audio_format.toUpperCase() + (s.file_size_bytes ? " · " + (s.file_size_bytes / 1048576).toFixed(1) + " MB" : "")],
    ["bi-play-circle", "Plays", formatNumber(s.plays)],
    ["bi-download", "Downloads", formatNumber(s.downloads)]
  ].filter(f => f[2]);

  setPageMeta({
    title: `${s.title}${preacher ? " by " + preacher : ""} | Selah Naija`,
    description: (s.description || shareText).slice(0, 160),
    image: cover, url: pageUrl, type: "article"
  });
  $("crumb-title").textContent = s.title;

  view.innerHTML = `
  <div class="row g-4 g-lg-5 align-items-start">
    <div class="col-md-5 col-lg-4">
      <div class="media-cover song-cover">${coverHtml(cover, s.title, "bi-mic")}</div>
    </div>
    <div class="col-md-7 col-lg-8">
      <div class="mb-2">
        ${s.categories?.name ? `<span class="chip me-1">${escapeHtml(s.categories.name)}</span>` : ""}
        ${s.subcategories?.name ? `<span class="chip">${escapeHtml(s.subcategories.name)}</span>` : ""}
      </div>
      <h1 class="h1 mb-1">${escapeHtml(s.title)}</h1>
      <p class="lead mb-3">
        ${s.preachers ? `<a href="preacher.html?id=${encodeURIComponent(s.preachers.id)}" class="text-decoration-none fw-semibold">${escapeHtml(preacher)}</a>` : ""}
        ${church ? `<span class="text-muted"> · ${escapeHtml(church)}</span>` : ""}
      </p>
      <ul class="meta-list">
        ${facts.map(f => `<li><i class="bi ${f[0]}"></i><span class="meta-label">${f[1]}</span><span>${escapeHtml(f[2])}</span></li>`).join("")}
      </ul>
      <div class="d-flex flex-wrap gap-2 my-4">
        <button class="btn btn-gold btn-lg px-4" id="play-main"><i class="bi bi-play-fill me-1"></i>Play</button>
        <button class="btn btn-primary btn-lg px-4" data-download-sermon="${escapeHtml(s.id)}"><i class="bi bi-download me-2"></i>Download ${escapeHtml(s.audio_format.toUpperCase())}</button>
        <div class="dropdown">
          <button class="btn btn-outline-primary btn-lg dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-share me-2"></i>Share</button>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText + " " + pageUrl)}"><i class="bi bi-whatsapp me-2"></i>WhatsApp</a></li>
            <li><a class="dropdown-item" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}"><i class="bi bi-facebook me-2"></i>Facebook</a></li>
            <li><a class="dropdown-item" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}"><i class="bi bi-twitter-x me-2"></i>X</a></li>
            <li><button class="dropdown-item" id="copy-link" type="button"><i class="bi bi-link-45deg me-2"></i>Copy link</button></li>
          </ul>
        </div>
      </div>
      ${s.description ? `<h2 class="h5">About this sermon</h2><p class="pre-line">${escapeHtml(s.description)}</p>` : ""}
            <p class="mt-4 small"><a class="text-muted text-decoration-none" href="report.html?sermon=${encodeURIComponent(s.id)}"><i class="bi bi-flag me-1"></i>Report a problem with this sermon</a></p>
    </div>
  </div>`;

  $("copy-link").addEventListener("click", () => {
    navigator.clipboard.writeText(pageUrl)
      .then(() => showToast("Link copied.", "success"))
      .catch(() => showToast("Could not copy the link.", "danger"));
  });

  // More from this preacher, and related sermons (same topic area, other preachers)
  const base = () => db.from("sermons").select(SERMON_FIELDS).eq("status", "published").neq("id", s.id);
  let relatedQuery = base().order("plays", { ascending: false }).limit(6);
  if (s.subcategory_id) relatedQuery = relatedQuery.eq("subcategory_id", s.subcategory_id);
  else if (s.category_id) relatedQuery = relatedQuery.eq("category_id", s.category_id);
  if (s.preacher_id) relatedQuery = relatedQuery.neq("preacher_id", s.preacher_id);
  const needRelated = s.subcategory_id || s.category_id;

  const [byPreacher, related] = await Promise.all([
    base().eq("preacher_id", s.preacher_id).order("published_at", { ascending: false }).limit(6),
    needRelated ? relatedQuery : Promise.resolve({ data: [] })
  ]);

  const show = (sectionId, gridId, rows) => {
    if (!rows || !rows.length) return;
    $(sectionId).hidden = false;
    renderList($(gridId), rows.map(mapSermon), sermonCard, "bi-mic", "");
  };
  if (preacher) $("preacher-section-title").textContent = `More from ${preacher}`;
  show("preacher-section", "preacher-sermons", byPreacher.data);
  show("related-section", "related-sermons", related.data);

  // Play: this sermon first, then the others listed on the page
  const queueIds = [s.id, ...(byPreacher.data || []).map(r => r.id), ...(related.data || []).map(r => r.id)];
  $("play-main").addEventListener("click", () => Player.playSermonIds(queueIds, s.id));
});