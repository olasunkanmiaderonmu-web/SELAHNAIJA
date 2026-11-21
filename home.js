/**
 * Selah Naija - homepage logic (Phase 2: live data from Supabase).
 * Visitors only ever receive published content because of the database security rules.
 */

const SONG_FIELDS = "id,title,cover_path,plays,downloads,artists(name),categories(name)";

const mapSong = s => ({
  id: s.id,
  title: s.title,
  cover_url: publicUrl("song-covers", s.cover_path),
  artist_name: s.artists?.name || "",
  category_name: s.categories?.name,
  plays: s.plays,
  downloads: s.downloads
});

const emptyMsg = {
  songs: ["bi-music-note-list", "No songs published yet. New gospel music will appear here soon."],
  artists: ["bi-person-lines-fill", "Artists will appear here once they are added."],
  sermons: ["bi-mic", "No sermons yet. Check back soon for inspiring messages."],
  playlists: ["bi-collection-play", "Playlists are coming soon."]
};
const errorMsg = ["bi-exclamation-triangle", "We could not load this section. Please refresh the page."];

/** Runs a query, then draws the cards (or an empty / error message). */
async function loadSection(elId, query, mapFn, templateFn, empty) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `<div class="col-12 text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading...</div>`;
  const { data, error } = await query;
  if (error) { console.error(elId, error); renderList(el, [], templateFn, ...errorMsg); return; }
  renderList(el, (data || []).map(mapFn), templateFn, ...empty);
}

const songsQuery = () => db.from("songs").select(SONG_FIELDS).eq("status", "published");

function loadTrending(sortBy) {
  return loadSection("trending-songs",
    songsQuery().order(sortBy, { ascending: false }).limit(6),
    mapSong, songCard, emptyMsg.songs);
}

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Not connected yet? Say so clearly ----------
  if (!db) {
    ["featured-songs", "trending-songs", "latest-songs", "popular-artists", "weekly-sermons", "popular-playlists"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div class="col-12"><div class="empty-state"><i class="bi bi-plug"></i>${escapeHtml(dbProblem)}</div></div>`;
    });
  } else {
    // B. Featured
    loadSection("featured-songs",
      songsQuery().eq("is_featured", true).order("published_at", { ascending: false }).limit(6),
      mapSong, songCard, emptyMsg.songs);

    // C. Trending (sort buttons re-query by plays or downloads)
    loadTrending("plays");
    document.querySelectorAll("[data-trend-sort]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-trend-sort]").forEach(b => {
          b.classList.toggle("btn-primary", b === btn);
          b.classList.toggle("btn-outline-primary", b !== btn);
        });
        loadTrending(btn.dataset.trendSort);
      });
    });

    // D. Latest releases
    loadSection("latest-songs",
      songsQuery().order("published_at", { ascending: false }).limit(6),
      mapSong, songCard, emptyMsg.songs);

    // E. Artists (featured artists first, then newest)
    loadSection("popular-artists",
      db.from("artists").select("id,name,photo_path,songs(count)")
        .order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(6),
      a => ({ id: a.id, name: a.name, photo_url: publicUrl("artist-images", a.photo_path), song_count: a.songs?.[0]?.count ?? 0 }),
      artistCard, emptyMsg.artists);

    // F. Sermons
    loadSection("weekly-sermons",
      db.from("sermons").select("id,title,cover_path,duration_seconds,preachers(name),categories(name)")
        .eq("status", "published").order("published_at", { ascending: false }).limit(6),
      s => ({
        id: s.id, title: s.title, cover_url: publicUrl("sermon-covers", s.cover_path),
        preacher_name: s.preachers?.name || "", category_name: s.categories?.name, duration: s.duration_seconds
      }),
      sermonCard, emptyMsg.sermons);

    // G. Playlists (curated by the site)
    loadSection("popular-playlists",
      db.from("playlists").select("id,name,cover_path,playlist_songs(count)")
        .eq("is_curated", true).eq("is_public", true).order("created_at", { ascending: false }).limit(6),
      p => ({ id: p.id, name: p.name, cover_url: publicUrl("song-covers", p.cover_path), song_count: p.playlist_songs?.[0]?.count ?? 0 }),
      playlistCard, emptyMsg.playlists);
  }

   // ---------- H. Newsletter (saved by a checked database function that also limits abuse) ----------
  const form = document.getElementById("newsletter-form");
  const msg = document.getElementById("newsletter-msg");
  const say = (text, ok) => { msg.className = "mt-3 small " + (ok ? "ok" : "err"); msg.textContent = text; };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("newsletter-email").value.trim().toLowerCase();
    if (!isValidEmail(email)) return say("Please enter a valid email address.", false);
    if (!db) return say(dbProblem || "The site is not connected to the database yet.", false);

    const button = form.querySelector("button");
    button.disabled = true;
    const { data, error } = await db.rpc("subscribe_newsletter", { p_email: email });
    button.disabled = false;

    if (error) { console.error(error); return say("Something went wrong. Please try again.", false); }
    if (data === "ok") { form.reset(); return say("Thank you! You are subscribed.", true); }
    if (data === "exists") return say("This email is already subscribed.", true);
    if (data === "limited") return say("Too many attempts. Please try again in a little while.", false);
    say("Please enter a valid email address.", false);
  });
});