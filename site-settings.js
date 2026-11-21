/**
 * Selah Naija - applies the settings saved in the admin dashboard to the public website:
 * announcement banner, footer social links, site name, contact details, homepage text and the Song of the Day.
 * Also adds the "skip to main content" link. Loaded by layout.js on inner pages and by a script tag on index.html.
 * If anything fails, the page stays as it is.
 */
(async function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const str = v => (typeof v === "string" ? v.trim() : "");
  const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const safeUrl = u => /^(https?:\/\/\S+|[a-z0-9_-]+\.html(\?\S*)?)$/i.test(u || "");

  // ---------- Accessibility: skip link ----------
  const main = document.querySelector("main");
  if (main && !document.querySelector(".skip-link")) {
    if (!main.id) main.id = "main";
    main.setAttribute("tabindex", "-1");
    const skip = document.createElement("a");
    skip.className = "skip-link"; skip.href = "#" + main.id; skip.textContent = "Skip to main content";
    document.body.insertAdjacentElement("afterbegin", skip);
  }

  if (typeof db === "undefined" || !db) return;
  const { data, error } = await db.from("website_settings").select("key,value");
  if (error || !data) return;
  const S = Object.fromEntries(data.map(r => [r.key, r.value]));
  const name = str(S.site_name) || "Selah Naija";

  // ---------- Site name and contact details on legal and about pages ----------
  document.querySelectorAll("[data-site-name]").forEach(el => { el.textContent = name; });
  const contact = obj(S.contact), email = str(contact.email);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    document.querySelectorAll("[data-site-email]").forEach(el => { el.textContent = email; el.href = "mailto:" + email; });
  }

  // ---------- Announcement banner ----------
  const a = obj(S.announcement), text = str(a.text);
  if (a.enabled && text) {
    const key = "ann:" + text;
    let hidden = false;
    try { hidden = sessionStorage.getItem(key) === "1"; } catch (e) {}
    if (!hidden) {
      const link = safeUrl(a.link_url) && str(a.link_text)
        ? ` <a href="${esc(a.link_url)}" ${/^https?:/i.test(a.link_url) ? 'target="_blank" rel="noopener noreferrer"' : ""}>${esc(a.link_text)}</a>` : "";
      const bar = document.createElement("div");
      bar.className = "site-announcement";
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", "Announcement");
      bar.innerHTML = `<i class="bi bi-megaphone-fill"></i><span>${esc(text)}${link}</span><button type="button" aria-label="Dismiss announcement">&times;</button>`;
      bar.querySelector("button").addEventListener("click", () => { bar.remove(); try { sessionStorage.setItem(key, "1"); } catch (e) {} });
      document.body.insertAdjacentElement("afterbegin", bar);
    }
  }

  // ---------- Footer: social links and copyright ----------
  const ICONS = { facebook: ["bi-facebook", "Facebook"], x: ["bi-twitter-x", "X"], instagram: ["bi-instagram", "Instagram"], youtube: ["bi-youtube", "YouTube"], tiktok: ["bi-tiktok", "TikTok"], whatsapp: ["bi-whatsapp", "WhatsApp"], telegram: ["bi-telegram", "Telegram"] };
  const social = obj(S.social_links);
  const links = Object.entries(ICONS).filter(([k]) => /^https?:\/\/\S+$/i.test(str(social[k])));
  const box = document.querySelector(".footer-selah .social");
  if (box) {
    if (links.length) box.innerHTML = links.map(([k, [icon, label]]) => `<a href="${esc(social[k])}" target="_blank" rel="noopener noreferrer" aria-label="${label}"><i class="bi ${icon}"></i></a>`).join("");
    else box.remove();                                   // no dead links when nothing is set
  }
  const copy = document.querySelector(".footer-selah .copy");
  if (copy) copy.innerHTML = `&copy; ${new Date().getFullYear()} ${esc(name)}. All music and sermons are shared with permission of their owners.`;

  // ---------- Homepage only ----------
  const featured = document.getElementById("featured-songs");
  if (!featured) return;

  const hero = document.querySelector(".hero");
  if (hero) {
    const h1 = hero.querySelector("h1"), lead = hero.querySelector("p.lead"), badge = hero.querySelector(".badge-gold");
    if (h1 && str(S.hero_headline)) h1.textContent = str(S.hero_headline);
    if (lead && str(S.hero_text)) lead.textContent = str(S.hero_text);
    if (badge && str(S.tagline)) badge.innerHTML = `<i class="bi bi-music-note-beamed me-1"></i> ${esc(str(S.tagline))}`;
  }

  // Song of the Day: songs the admin scheduled for today
  const today = new Date().toLocaleDateString("en-CA");
  const { data: songs } = await db.from("songs")
    .select("id,title,cover_path,plays,downloads,artists(name),categories(name)")
    .eq("status", "published").eq("featured_date", today).limit(3);
  if (songs && songs.length && typeof songCard === "function") {
    const section = document.createElement("section");
    section.className = "section sotd";
    section.innerHTML = `<div class="container"><div class="section-head"><div><h2><i class="bi bi-sun text-warning me-2"></i>Song of the Day</h2><p class="text-muted mb-0">Today's pick for you.</p></div></div><div class="row g-4" id="song-of-day"></div></div>`;
    featured.closest("section").insertAdjacentElement("beforebegin", section);
    section.querySelector("#song-of-day").innerHTML = songs.map(s => songCard({
      id: s.id, title: s.title, cover_url: publicUrl("song-covers", s.cover_path),
      artist_name: s.artists?.name || "", category_name: s.categories?.name, plays: s.plays, downloads: s.downloads
    })).join("");
  }
})();