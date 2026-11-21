/** Selah Naija - sets the page title, social-sharing details and canonical address for pages built from the database. */
function setPageMeta({ title, description, image, url, type = "website" }) {
  const set = (attr, key, value) => {
    if (!value) return;
    let m = document.querySelector(`meta[${attr}="${key}"]`);
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); document.head.appendChild(m); }
    m.setAttribute("content", value);
  };
  const address = url || location.href.split("#")[0];
  if (title) document.title = title;
  set("name", "description", description);
  set("property", "og:title", title);
  set("property", "og:description", description);
  set("property", "og:type", type);
  set("property", "og:url", address);
  set("property", "og:image", image);
  set("name", "twitter:card", image ? "summary_large_image" : "summary");

  let link = document.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
  link.href = address;
}