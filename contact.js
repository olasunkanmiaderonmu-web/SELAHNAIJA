/** Selah Naija - contact page: shows contact details and sends messages through a checked database function. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const say = (text, type = "danger") => { $("contact-msg").innerHTML = `<div class="alert alert-${type}" role="alert"></div>`; $("contact-msg").firstChild.textContent = text; };
  if (!db) return say(dbProblem);

  // ---------- Contact details saved in Admin > Settings ----------
  const { data } = await db.from("website_settings").select("key,value").in("key", ["contact", "social_links"]);
  const S = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const contact = obj(S.contact), social = obj(S.social_links);
  const items = [];
  if (typeof contact.email === "string" && isValidEmail(contact.email)) items.push(`<li><i class="bi bi-envelope"></i><a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></li>`);
  if (typeof contact.phone === "string" && /^[0-9+()\-\s]{5,30}$/.test(contact.phone)) items.push(`<li><i class="bi bi-telephone"></i><a href="tel:${escapeHtml(contact.phone.replace(/[^0-9+]/g, ""))}">${escapeHtml(contact.phone)}</a></li>`);
  if (typeof social.whatsapp === "string" && /^https?:\/\/\S+$/i.test(social.whatsapp)) items.push(`<li><i class="bi bi-whatsapp"></i><a href="${escapeHtml(social.whatsapp)}" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></li>`);
  $("contact-info").innerHTML = items.length ? items.join("") : `<li class="text-muted"><i class="bi bi-chat-dots"></i>Please use the form. We read every message.</li>`;

  // ---------- Fill in the name and email of a logged-in person ----------
  const { data: sess } = await db.auth.getSession();
  if (sess.session) {
    $("c-email").value = sess.session.user.email || "";
    const n = sess.session.user.user_metadata && sess.session.user.user_metadata.full_name;
    if (n) $("c-name").value = n;
  }

  $("c-message").addEventListener("input", e => { $("msg-count").textContent = e.target.value.length; });

  $("contact-form").addEventListener("submit", async e => {
    e.preventDefault(); $("contact-msg").innerHTML = "";
    if ($("c-website").value) return;                                           // hidden field filled in: a bot
    const name = $("c-name").value.trim(), email = $("c-email").value.trim(), subject = $("c-subject").value.trim(), message = $("c-message").value.trim();
    if (name.length < 2) return say("Please enter your name.");
    if (!isValidEmail(email)) return say("Please enter a valid email address.");
    if (message.length < 10) return say("Please write a message of at least 10 letters.");

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    const { data: result, error } = await db.rpc("submit_contact", { p_name: name, p_email: email, p_subject: subject, p_message: message });
    btn.disabled = false;
    if (error) { console.error(error); return say("We could not send your message right now. Please try again later."); }
    if (result === "limited") return say("You have sent several messages recently. Please try again in a little while.", "warning");
    if (result !== "ok") return say("Please check your details and try again.");
    e.target.hidden = true;
    say("Thank you. Your message has been sent and we will reply by email.", "success");
  });
});