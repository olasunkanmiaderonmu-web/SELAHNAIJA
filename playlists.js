/** Selah Naija - list of curated public playlists. */
document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("playlist-grid");
  if (!db) { grid.innerHTML = `<div class="col-12"><div class="empty-state"><i class="bi bi-plug"></i>${escapeHtml(dbProblem)}</div></div>`; return; }
  grid.innerHTML = `<div class="col-12 text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading...</div>`;
  const { data, error } = await db.from("playlists").select("id,name,cover_path,playlist_songs(count)")
    .eq("is_curated", true).eq("is_public", true).order("created_at", { ascending: false }).limit(48);
  if (error) { console.error(error); return renderList(grid, [], playlistCard, "bi-exclamation-triangle", "We could not load the playlists. Please refresh the page."); }
  renderList(grid, (data || []).map(p => ({ id: p.id, name: p.name, cover_url: publicUrl("song-covers", p.cover_path), song_count: p.playlist_songs?.[0]?.count ?? 0 })),
    playlistCard, "bi-collection-play", "Playlists are coming soon.");
});