/** Selah Naija - admin: builds sitemap.xml from the published content, so search engines can find every page. */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("sm-generate");
  if (!btn) return;
  const $ = id => document.getElementById(id);
  const say = (text, type = "muted") => { $("sm-result").className = `meta mt-2 text-${type}`; $("sm-result").textContent = text; };
  try { $("sm-base").value = localStorage.getItem("selah_site_url") || ""; } catch (e) {}

  const xml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  async function all(table, select, filter) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      let q = db.from(table).select(select);
      if (filter) q = filter(q);
      const { data, error } = await q.order("id").range(from, from + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }

  btn.addEventListener("click", async () => {
    const base = $("sm-base").value.trim().replace(/\/+$/, "");
    if (!/^https?:\/\/[^\s/]+$/i.test(base)) return say("Please type your website address, for example https://selah-naija.vercel.app", "danger");
    if (/localhost|127\.0\.0\.1/i.test(base)) return say("Please use your live website address, not localhost.", "danger");
    try { localStorage.setItem("selah_site_url", base); } catch (e) {}

    Admin.busy(btn, true); say("Building the sitemap...");
    try {
      const urls = [];
      const add = (path, lastmod, priority) => urls.push({ loc: `${base}/${path}`, lastmod: lastmod ? String(lastmod).slice(0, 10) : null, priority });

      [["index.html", 1.0], ["music.html", 0.9], ["latest.html", 0.9], ["artists.html", 0.8], ["sermons.html", 0.8], ["playlists.html", 0.7],
       ["category.html", 0.6], ["about.html", 0.4], ["contact.html", 0.4], ["privacy.html", 0.3], ["terms.html", 0.3], ["copyright.html", 0.3]]
        .forEach(([p, pr]) => add(p, null, pr));

      const cats = await all("categories", "slug,subcategories(slug)");
      cats.forEach(c => { add(`category.html?cat=${c.slug}`, null, 0.6); (c.subcategories || []).forEach(s => add(`category.html?cat=${c.slug}&sub=${s.slug}`, null, 0.5)); });
      (await all("artists", "id,created_at")).forEach(a => add(`artist.html?id=${a.id}`, a.created_at, 0.7));
      (await all("preachers", "id,created_at")).forEach(p => add(`preacher.html?id=${p.id}`, p.created_at, 0.6));
      (await all("songs", "id,updated_at", q => q.eq("status", "published"))).forEach(s => add(`song.html?id=${s.id}`, s.updated_at, 0.8));
      (await all("sermons", "id,updated_at", q => q.eq("status", "published"))).forEach(s => add(`sermon.html?id=${s.id}`, s.updated_at, 0.7));
      (await all("playlists", "id,created_at", q => q.eq("is_public", true).eq("is_curated", true))).forEach(p => add(`playlist.html?id=${p.id}`, p.created_at, 0.5));

      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map(u => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority.toFixed(1)}</priority></url>`).join("\n") + `\n</urlset>\n`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([body], { type: "application/xml" }));
      a.download = "sitemap.xml";
      document.body.appendChild(a); a.click(); a.remove();
      say(`Done: ${urls.length} pages. Save the downloaded sitemap.xml in your main folder next to index.html, then deploy again.`, "success");
    } catch (err) { console.error(err); say("Could not build the sitemap. Please try again.", "danger"); }
    finally { Admin.busy(btn, false); }
  });
});