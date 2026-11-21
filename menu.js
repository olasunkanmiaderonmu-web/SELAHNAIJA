/**
 * Selah Naija - fills the Categories mega-menu from the database,
 * so categories created in the admin dashboard appear in the menu automatically.
 * If anything fails, the menu already on the page stays as it is.
 */
(async function () {
  if (typeof db === "undefined" || !db) return;
  const row = document.querySelector(".mega-menu .row");
  if (!row) return;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const { data, error } = await db.from("categories")
    .select("name,slug,sort_order,subcategories(name,slug,sort_order)").order("sort_order");
  if (error || !data || !data.length) return;

  row.innerHTML = data.map(c => {
    const subs = (c.subcategories || []).sort((a, b) => a.sort_order - b.sort_order);
    return `<div class="col">
      <a class="mega-title" href="category.html?cat=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>
      ${subs.map(s => `<a class="mega-link" href="category.html?cat=${encodeURIComponent(c.slug)}&amp;sub=${encodeURIComponent(s.slug)}">${esc(s.name)}</a>`).join("")}
    </div>`;
  }).join("");
})();