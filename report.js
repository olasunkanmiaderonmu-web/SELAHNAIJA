/** Selah Naija - public "Report a problem" form (sent through a checked, rate-limited database function). */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const say = (text, type = "danger") => { $("report-msg").innerHTML = `<div class="alert alert-${type}" role="alert"></div>`; $("report-msg").firstChild.textContent = text; };
  if (!db) return say(dbProblem);

  const params = new URLSearchParams(location.search);
  const songId = UUID.test(params.get("song") || "") ? params.get("song") : null;
  const sermonId = !songId && UUID.test(params.get("sermon") || "") ? params.get("sermon") : null;
  let title = "";

  // Show which song or sermon is being reported
  if (songId || sermonId) {
    const { data } = songId
      ? await db.from("songs").select("title,artists(name)").eq("id", songId).eq("status", "published").maybeSingle()
      : await db.from("sermons").select("title,preachers(name)").eq("id", sermonId).eq("status", "published").maybeSingle();
    if (data) {
      title = data.title;
      const by = songId ? data.artists?.name : data.preachers?.name;
      $("report-about").hidden = false;
      $("report-about").innerHTML = `<i class="bi ${songId ? "bi-music-note-beamed" : "bi-mic"} text-primary me-2"></i>You are reporting: <strong></strong> ${by ? "by " : ""}<span></span>`;
      $("report-about").querySelector("strong").textContent = title;
      $("report-about").querySelector("span").textContent = by || "";
    }
  }
  const aboutContent = !!title;
  if (!aboutContent) $("details-hint").textContent = "(please describe the problem and the page it is on)";

  $("report-details").addEventListener("input", e => { $("details-count").textContent = e.target.value.length; });

  $("report-form").addEventListener("submit", async e => {
    e.preventDefault(); $("report-msg").innerHTML = "";
    if ($("report-website").value) return;                                   // hidden field filled in: a bot
    const reason = $("report-reason").value, details = $("report-details").value.trim();
    if (!aboutContent && details.length < 10) return say("Please describe the problem (at least 10 letters) so we know what to look at.");
    if (reason === "copyright" && details.length < 10) return say("For copyright concerns, please tell us who you are and how to contact you.");

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    const { data, error } = await db.rpc("submit_report", {
      p_song: aboutContent ? songId : null, p_sermon: aboutContent ? sermonId : null,
      p_reason: reason, p_details: details || null
    });
    btn.disabled = false;
    if (error) { console.error(error); return say("We could not send your report right now. Please try again later."); }
    if (data === "limited") return say("You have sent several reports recently. Please try again in a little while.", "warning");
    if (data !== "ok") return say("Please check your report and try again.");
    $("report-form").hidden = true;
    say("Thank you. Your report has been sent and we will look into it.", "success");
  });
});