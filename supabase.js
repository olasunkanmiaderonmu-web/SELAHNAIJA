/** Selah Naija - Supabase connection, shared by every page. */

const cfg = (typeof CONFIG !== "undefined") ? CONFIG : null;
const SB_URL = ((cfg && cfg.SUPABASE_URL) || "").trim();
const SB_KEY = ((cfg && (cfg.SUPABASE_KEY || cfg.SUPABASE_ANON_KEY)) || "").trim();

let db = null;
let dbProblem = "";

if (!cfg) {
  dbProblem = "config.js did not load. Check that the file is called config.js and sits next to index.html.";
} else if (typeof window.supabase === "undefined") {
  dbProblem = "The Supabase library did not load. Check your internet connection and the script lines at the bottom of index.html.";
} else if (!SB_URL || SB_URL.startsWith("PASTE")) {
  dbProblem = "config.js has no Project URL. Paste it between the quotes after SUPABASE_URL.";
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SB_URL)) {
  dbProblem = "SUPABASE_URL should look like https://abcd1234.supabase.co (the Project URL, with nothing after .co).";
} else if (!SB_KEY || SB_KEY.startsWith("PASTE")) {
  dbProblem = "config.js has no key. Paste your publishable key between the quotes after SUPABASE_KEY.";
} else {
  try {
    db = window.supabase.createClient(SB_URL, SB_KEY);
  } catch (e) {
    dbProblem = "The Supabase connection failed to start: " + e.message;
  }
}

if (dbProblem) console.error("[Selah Naija] " + dbProblem);

/** Public link for an image stored in one of the image buckets (or null if there is none). */
function publicUrl(bucket, path) {
  if (!db || !path) return null;
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}