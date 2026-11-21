/** Selah Naija - admin: website settings (stored in the website_settings table). */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Admin.init())) return;
  const $ = id => document.getElementById(id);
  const SOCIALS = [["facebook", "Facebook"], ["x", "X (Twitter)"], ["instagram", "Instagram"], ["youtube", "YouTube"], ["tiktok", "TikTok"], ["whatsapp", "WhatsApp channel or chat link"], ["telegram", "Telegram"]];
  $("social-fields").innerHTML = SOCIALS.map(([k, l]) =>
    `<div class="col-md-6"><label class="form-label small mb-1" for="soc-${k}">${l}</label><input type="url" class="form-control" id="soc-${k}" placeholder="https://" maxlength="300"></div>`).join("");

  const formError = msg => { $("form-error").innerHTML = msg ? `<div class="alert alert-danger"></div>` : ""; if (msg) { $("form-error").firstChild.textContent = msg; window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const str = v => (typeof v === "string" ? v : "");
  const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

  const { data, error } = await db.from("website_settings").select("key,value");
  if (error) { console.error(error); return formError("Could not load the settings."); }
  const S = Object.fromEntries((data || []).map(r => [r.key, r.value]));

  $("s-site-name").value = str(S.site_name);
  $("s-tagline").value = str(S.tagline);
  $("s-hero-headline").value = str(S.hero_headline);
  $("s-hero-text").value = str(S.hero_text);
  const ann = obj(S.announcement);
  $("s-ann-on").checked = !!ann.enabled;
  $("s-ann-text").value = str(ann.text);
  $("s-ann-link-text").value = str(ann.link_text);
  $("s-ann-link-url").value = str(ann.link_url);
  const soc = obj(S.social_links);
  SOCIALS.forEach(([k]) => { $("soc-" + k).value = str(soc[k]); });
  const contact = obj(S.contact);
  $("s-email").value = str(contact.email);
  $("s-phone").value = str(contact.phone);

  $("settings-form").addEventListener("submit", async e => {
    e.preventDefault(); formError("");
    const v = id => $(id).value.trim();
    const annText = v("s-ann-text"), linkUrl = v("s-ann-link-url"), linkText = v("s-ann-link-text");
    if ($("s-ann-on").checked && !annText) return formError("Please type the announcement message, or switch the banner off.");
    if (linkUrl && !/^(https?:\/\/\S+|[a-z0-9_-]+\.html(\?\S*)?)$/i.test(linkUrl)) return formError("The banner link must start with https:// or be a page of this website, such as latest.html.");
    if (linkUrl && !linkText) return formError("Please add the text for the banner link.");

    const social = {};
    for (const [k, label] of SOCIALS) {
      const val = v("soc-" + k);
      if (!val) continue;
      if (!/^https?:\/\/\S+$/i.test(val)) return formError(`Please enter a full web address starting with https:// for ${label}.`);
      social[k] = val;
    }
    const email = v("s-email"), phone = v("s-phone");
    if (email && !isValidEmail(email)) return formError("Please enter a valid contact email.");
    if (phone && !/^[0-9+()\-\s]{5,30}$/.test(phone)) return formError("The phone number can only contain digits, spaces, + - and brackets.");

    const now = new Date().toISOString();
    const rows = [
      { key: "site_name",     value: v("s-site-name") },
      { key: "tagline",       value: v("s-tagline") },
      { key: "hero_headline", value: v("s-hero-headline") },
      { key: "hero_text",     value: v("s-hero-text") },
      { key: "announcement",  value: { enabled: $("s-ann-on").checked, text: annText, link_text: linkText, link_url: linkUrl } },
      { key: "social_links",  value: social },
      { key: "contact",       value: { email, phone } }
    ].map(r => ({ ...r, updated_at: now }));

    const btn = e.target.querySelector("button[type=submit]"); Admin.busy(btn, true);
    const res = await db.from("website_settings").upsert(rows, { onConflict: "key" });
    Admin.busy(btn, false);
    if (res.error) { console.error(res.error); return formError("Could not save the settings. " + (res.error.message || "")); }
    showToast("Settings saved. They are live on the website now.", "success");
  });
});