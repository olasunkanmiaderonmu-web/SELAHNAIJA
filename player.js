/**
 * Selah Naija - persistent music player + downloads (songs AND sermons).
 * One <audio> element only, so only one track can play at a time.
 * Playback state is kept in sessionStorage so the player is restored on the next page.
 * Load this AFTER supabase.js and utils.js (and after layout.js on inner pages).
 */

/** Small pop-up message in the top-right corner. type: dark | success | danger */
function showToast(message, type = "dark") {
  let box = document.getElementById("toast-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast-box";
    box.className = "toast-container position-fixed top-0 end-0 p-3";
    box.style.zIndex = 2000;
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${type} border-0`;
  el.setAttribute("role", "status");
  el.innerHTML = `<div class="d-flex"><div class="toast-body"></div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  el.querySelector(".toast-body").textContent = message;
  box.appendChild(el);
  el.addEventListener("hidden.bs.toast", () => el.remove());
  new bootstrap.Toast(el, { delay: 3500 }).show();
}

const Player = (() => {
  const audio = new Audio();
  audio.preload = "metadata";

  const STORE = "selah_player";
  // A track is { id, kind: "song" | "sermon", title, artist (or preacher), cover, path }
  const state = { queue: [], index: -1, shuffle: false, repeat: "off", counted: null };
  const urlCache = {};
  let loadToken = 0, dragging = false, lastSave = 0, retried = false;

  const el = id => document.getElementById(id);
  const fmt = secs => (isFinite(secs) ? formatDuration(secs) : "0:00");
  const current = () => state.queue[state.index] || null;
  const keyOf = t => `${t.kind}:${t.id}`;
  const bucketOf = t => (t.kind === "sermon" ? "sermon-files" : "music-files");

  /* ---------- Private, short-lived link for an audio file ---------- */
  async function getUrl(track) {
    const k = keyOf(track);
    const hit = urlCache[k];
    if (hit && hit.expires > Date.now()) return hit.url;
    const { data, error } = await db.storage.from(bucketOf(track)).createSignedUrl(track.path, 3600);
    if (error || !data) { console.error(error); return null; }
    urlCache[k] = { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 };
    return data.signedUrl;
  }

  /* ---------- Screen updates ---------- */
  function refreshButtons() {
    const playBtn = el("btn-play");
    if (playBtn) {
      playBtn.innerHTML = audio.paused ? '<i class="bi bi-play-fill"></i>' : '<i class="bi bi-pause-fill"></i>';
      playBtn.setAttribute("aria-label", audio.paused ? "Play" : "Pause");
    }
    const cur = current();
    document.querySelectorAll("[data-play-song],[data-play-sermon]").forEach(b => {
      const kind = b.hasAttribute("data-play-sermon") ? "sermon" : "song";
      const id = kind === "sermon" ? b.dataset.playSermon : b.dataset.playSong;
      const isCur = !!cur && cur.kind === kind && cur.id === id;
      b.classList.toggle("is-current", isCur);
      const i = b.querySelector("i");
      if (i) i.className = "bi " + (isCur && !audio.paused ? "bi-pause-fill" : "bi-play-fill");
    });
  }

  function updateInfo() {
    const t = current();
    el("player-title").textContent = t ? t.title : "Nothing playing";
    el("player-artist").textContent = t ? t.artist : "Choose a song or sermon to begin";
    el("player-cover").innerHTML = t && t.cover
      ? `<img src="${escapeHtml(t.cover)}" alt="">` : `<i class="bi bi-music-note-beamed"></i>`;
    if ("mediaSession" in navigator && t) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: t.artist, artwork: t.cover ? [{ src: t.cover }] : []
      });
    }
    refreshButtons();
  }

  function syncModeButtons() {
    el("btn-shuffle").classList.toggle("active", state.shuffle);
    const r = el("btn-repeat");
    r.classList.toggle("active", state.repeat !== "off");
    r.innerHTML = `<i class="bi ${state.repeat === "one" ? "bi-repeat-1" : "bi-repeat"}"></i>`;
  }

  function syncVolumeIcon() {
    const lvl = audio.muted || audio.volume === 0 ? "mute" : audio.volume < 0.5 ? "down" : "up";
    el("btn-mute").innerHTML = `<i class="bi bi-volume-${lvl}-fill"></i>`;
  }

  /* ---------- Remember the player between pages ---------- */
  function persist() {
    lastSave = Date.now();
    try {
      sessionStorage.setItem(STORE, JSON.stringify({
        queue: state.queue, index: state.index, shuffle: state.shuffle, repeat: state.repeat,
        counted: state.counted, time: audio.currentTime || 0, playing: !audio.paused
      }));
    } catch (e) { /* storage unavailable: ignore */ }
  }

  function restore() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) || "null");
      if (!saved || !Array.isArray(saved.queue) || !saved.queue[saved.index]) return;
      Object.assign(state, {
        queue: saved.queue.map(t => ({ kind: "song", ...t })),     // older saved tracks were songs
        index: saved.index, shuffle: !!saved.shuffle,
        repeat: saved.repeat || "off", counted: saved.counted || null
      });
      syncModeButtons();
      updateInfo();
      if (db) load(state.index, { autoplay: !!saved.playing, startAt: saved.time || 0, restoring: true });
    } catch (e) { /* ignore a broken saved state */ }
  }

  /* ---------- Loading and controls ---------- */
  async function load(i, opts = {}) {
    const { autoplay = true, startAt = 0, restoring = false, isRetry = false } = opts;
    const t = state.queue[i];
    if (!t) return;
    if (!db) return showToast(dbProblem, "danger");
    const token = ++loadToken;
    state.index = i;
    if (!restoring) state.counted = null;
    if (!isRetry) retried = false;
    updateInfo();

    const url = await getUrl(t);
    if (token !== loadToken) return;               // another track was chosen meanwhile
    if (!url) return showToast("Sorry, this cannot be played right now.", "danger");

    audio.src = url;
    if (startAt > 0) audio.addEventListener("loadedmetadata", () => { audio.currentTime = startAt; }, { once: true });
    if (autoplay) {
      try { await audio.play(); }
      catch (e) { console.warn("Autoplay was blocked by the browser:", e.message); }
    }
    refreshButtons();
    persist();
  }

  function toggle() {
    if (!current()) return showToast("Choose a song or sermon to play first.");
    if (!audio.src) return load(state.index);
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }

  function next(auto = false) {
    if (!state.queue.length) return;
    if (auto && state.repeat === "one") {
      state.counted = null;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    let i;
    if (state.shuffle && state.queue.length > 1) {
      do { i = Math.floor(Math.random() * state.queue.length); } while (i === state.index);
    } else {
      i = state.index + 1;
      if (i >= state.queue.length) {
        if (state.repeat === "all" || !auto) i = 0;
        else { audio.pause(); audio.currentTime = 0; refreshButtons(); return; }   // end of the queue
      }
    }
    load(i);
  }

  function prev() {
    if (!state.queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    load(state.index > 0 ? state.index - 1 : state.queue.length - 1);
  }

  /* ---------- Getting tracks ---------- */
  async function fetchTracks(kind, ids) {
    const sermon = kind === "sermon";
    const { data, error } = await db.from(sermon ? "sermons" : "songs")
      .select(sermon ? "id,title,cover_path,audio_path,preachers(name)" : "id,title,cover_path,audio_path,artists(name)")
      .in("id", ids).eq("status", "published");
    if (error) { console.error(error); return []; }
    const byId = Object.fromEntries((data || []).map(s => [s.id, s]));
    return ids.filter(id => byId[id]).map(id => {
      const s = byId[id];
      return {
        id: s.id, kind, title: s.title,
        artist: (sermon ? s.preachers?.name : s.artists?.name) || "",
        cover: publicUrl(sermon ? "sermon-covers" : "song-covers", s.cover_path),
        path: s.audio_path
      };
    });
  }

  /** Plays startId, with the other ids lined up after it as the queue. */
  async function playIds(kind, ids, startId) {
    if (!db) return showToast(dbProblem, "danger");
    const cur = current();
    if (cur && cur.kind === kind && cur.id === startId && audio.src) return toggle();
    const unique = [...new Set([...ids, startId])];
    const tracks = await fetchTracks(kind, unique);
    const start = tracks.findIndex(t => t.id === startId);
    if (start < 0) return showToast("This is not available right now.", "danger");
    state.queue = tracks;
    load(start);
  }

  /* ---------- Real file download ---------- */
  async function downloadItem(kind, id, btn) {
    if (!db) return showToast(dbProblem, "danger");
    const sermon = kind === "sermon";
    if (btn) btn.disabled = true;
    try {
      const { data: s, error } = await db.from(sermon ? "sermons" : "songs")
        .select(sermon ? "id,title,audio_path,audio_format,preachers(name)" : "id,title,audio_path,audio_format,artists(name)")
        .eq("id", id).eq("status", "published").single();
      if (error || !s) throw error || new Error("Not found");

      const who = sermon ? s.preachers?.name : s.artists?.name;
      const name = `${who ? who + " - " : ""}${s.title}.${s.audio_format}`.replace(/[\\/:*?"<>|]+/g, "");
      const { data, error: linkError } = await db.storage
        .from(sermon ? "sermon-files" : "music-files").createSignedUrl(s.audio_path, 300, { download: name });
      if (linkError || !data) throw linkError || new Error("No link");

      const counted = await db.rpc("record_download", sermon ? { p_sermon_id: s.id } : { p_song_id: s.id });
      if (counted.error) console.warn("Could not record the download:", counted.error.message);

      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Your download has started.", "success");
    } catch (err) {
      console.error(err);
      showToast("Sorry, this download is not available right now.", "danger");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ---------- Start-up ---------- */
  function init() {
    if (!el("btn-play")) return;                      // page has no player bar
    document.querySelectorAll(".player-bar [disabled]").forEach(x => x.removeAttribute("disabled"));
    document.querySelector(".player-bar").insertAdjacentHTML("afterbegin", '<div class="mini-progress"><div id="mini-bar"></div></div>');
    el("progress").max = 1000;

    let vol = 0.8;
    try { const v = parseFloat(localStorage.getItem("selah_volume")); if (!isNaN(v)) vol = v; } catch (e) {}
    audio.volume = vol;
    el("volume").value = Math.round(vol * 100);
    syncVolumeIcon();
    syncModeButtons();

    el("btn-play").addEventListener("click", toggle);
    el("btn-next").addEventListener("click", () => next(false));
    el("btn-prev").addEventListener("click", prev);
    el("btn-shuffle").addEventListener("click", () => { state.shuffle = !state.shuffle; syncModeButtons(); persist(); });
    el("btn-repeat").addEventListener("click", () => {
      state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
      syncModeButtons(); persist();
    });
    el("btn-mute").addEventListener("click", () => { audio.muted = !audio.muted; syncVolumeIcon(); });
    el("volume").addEventListener("input", e => {
      audio.volume = e.target.value / 100;
      audio.muted = false;
      syncVolumeIcon();
      try { localStorage.setItem("selah_volume", audio.volume); } catch (err) {}
    });

    const progress = el("progress");
    progress.addEventListener("input", () => {
      dragging = true;
      if (isFinite(audio.duration)) el("time-current").textContent = fmt(progress.value / 1000 * audio.duration);
    });
    progress.addEventListener("change", () => {
      if (isFinite(audio.duration)) audio.currentTime = progress.value / 1000 * audio.duration;
      dragging = false;
    });

    audio.addEventListener("loadedmetadata", () => { el("time-total").textContent = fmt(audio.duration); });
    audio.addEventListener("timeupdate", () => {
      const d = audio.duration, c = audio.currentTime;
      el("time-current").textContent = fmt(c);
      if (isFinite(d) && d > 0) {
        if (!dragging) progress.value = Math.round(c / d * 1000);
        el("mini-bar").style.width = (c / d * 100) + "%";
      }
      if (Date.now() - lastSave > 1000) persist();
    });
    audio.addEventListener("play", refreshButtons);
    audio.addEventListener("pause", () => { refreshButtons(); persist(); });
    audio.addEventListener("playing", () => {
      refreshButtons();
      const t = current();
      if (t && state.counted !== keyOf(t)) {            // count one play per listen
        state.counted = keyOf(t);
        db.rpc("record_play", t.kind === "sermon" ? { p_sermon_id: t.id } : { p_song_id: t.id })
          .then(r => { if (r.error) console.warn(r.error.message); });
      }
    });
    audio.addEventListener("ended", () => next(true));
    audio.addEventListener("error", () => {
      const t = current();
      if (!t || !audio.src) return;
      if (!retried) {                                   // the private link may have expired: get a new one once
        retried = true;
        delete urlCache[keyOf(t)];
        load(state.index, { autoplay: true, startAt: audio.currentTime || 0, isRetry: true });
      } else {
        showToast("This could not be played. Please try again.", "danger");
      }
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", toggle);
      navigator.mediaSession.setActionHandler("pause", toggle);
      navigator.mediaSession.setActionHandler("previoustrack", prev);
      navigator.mediaSession.setActionHandler("nexttrack", () => next(false));
    }
    window.addEventListener("pagehide", persist);

    /* Any card or button on any page can start a song, a sermon or a download */
    document.addEventListener("click", e => {
      const song = e.target.closest("[data-play-song]");
      const sermon = e.target.closest("[data-play-sermon]");
      if (song || sermon) {
        e.preventDefault();
        const btn = song || sermon, kind = song ? "song" : "sermon";
        const attr = song ? "data-play-song" : "data-play-sermon";
        const box = btn.closest("[data-queue]") || btn.closest(".row") || document;
        const ids = [...new Set([...box.querySelectorAll(`[${attr}]`)].map(b => b.getAttribute(attr)))];
        playIds(kind, ids, btn.getAttribute(attr));
        return;
      }
      const dlSong = e.target.closest("[data-download-song]");
      if (dlSong) { e.preventDefault(); downloadItem("song", dlSong.dataset.downloadSong, dlSong); return; }
      const dlSermon = e.target.closest("[data-download-sermon]");
      if (dlSermon) { e.preventDefault(); downloadItem("sermon", dlSermon.dataset.downloadSermon, dlSermon); }
    });

    /* Cards that appear later (after loading from the database) get the right play/pause icon */
    let timer;
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(refreshButtons, 100); })
      .observe(document.body, { childList: true, subtree: true });

    restore();
  }

  document.addEventListener("DOMContentLoaded", init);
  return {
    playSongIds:   (ids, startId) => playIds("song", ids, startId),
    playSermonIds: (ids, startId) => playIds("sermon", ids, startId),
    downloadSong:  (id, btn) => downloadItem("song", id, btn),
    downloadSermon:(id, btn) => downloadItem("sermon", id, btn),
    toggle, refreshButtons
  };
})();