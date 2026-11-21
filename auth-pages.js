/** Selah Naija - login, sign-up, forgot-password and reset-password pages. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const msgBox = $("auth-msg");
  const say = (text, type = "danger") => {
    msgBox.innerHTML = `<div class="alert alert-${type}" role="alert"></div>`;
    msgBox.firstChild.textContent = text;
  };
  const busy = (form, on) => {
    const b = form.querySelector("button[type=submit]");
    if (!b) return;
    if (on) { b.dataset.label = b.innerHTML; b.disabled = true; b.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Please wait...`; }
    else { b.disabled = false; if (b.dataset.label) b.innerHTML = b.dataset.label; }
  };
  const friendly = err => {
    const m = (err.message || "").toLowerCase();
    if (m.includes("invalid login")) return "The email or password is not correct.";
    if (m.includes("not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
    if (m.includes("rate limit") || err.status === 429) return "Too many attempts. Please wait a few minutes and try again.";
    if (m.includes("banned") || m.includes("suspended")) return "This account has been suspended. Please contact us.";
    if (m.includes("same password")) return "Please choose a password different from your old one.";
    if (m.includes("weak") || m.includes("at least")) return "That password is too weak. Use at least 8 characters.";
    console.error(err);
    return "Something went wrong. Please try again.";
  };

  // Show / hide password buttons
  document.querySelectorAll("[data-toggle-password]").forEach(btn => btn.addEventListener("click", () => {
    const input = $(btn.dataset.togglePassword);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.innerHTML = `<i class="bi ${show ? "bi-eye-slash" : "bi-eye"}"></i>`;
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  }));

  if (!db) return say(dbProblem);
  const page = new URL(location.href);
  const pageUrl = name => new URL(name, page).href;

  // Already logged in? No need to see log-in or sign-up again
  if ($("login-form") || $("signup-form") || $("forgot-form")) {
    await Auth.ready;
    if (Auth.user()) { location.replace(Auth.safeNext()); return; }
  }

  // ---------- Log in ----------
  const login = $("login-form");
  if (login) login.addEventListener("submit", async e => {
    e.preventDefault(); msgBox.innerHTML = "";
    const email = $("login-email").value.trim(), password = $("login-password").value;
    if (!isValidEmail(email) || !password) return say("Please enter your email and password.");
    busy(login, true);
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) { busy(login, false); return say(friendly(error)); }
    location.href = Auth.safeNext();
  });

  // ---------- Sign up ----------
  const signup = $("signup-form");
  if (signup) signup.addEventListener("submit", async e => {
    e.preventDefault(); msgBox.innerHTML = "";
    const name = $("signup-name").value.trim(), email = $("signup-email").value.trim();
    const pw = $("signup-password").value, pw2 = $("signup-password2").value;
    if (name.length < 2 || name.length > 80) return say("Please enter your name (2 to 80 letters).");
    if (!isValidEmail(email)) return say("Please enter a valid email address.");
    if (pw.length < 8) return say("Your password must be at least 8 characters.");
    if (pw !== pw2) return say("The two passwords do not match.");
    if (!$("signup-terms").checked) return say("Please accept the Terms of Service and Privacy Policy.");
    busy(signup, true);
    const { data, error } = await db.auth.signUp({
      email, password: pw,
      options: { data: { full_name: name }, emailRedirectTo: pageUrl("login.html") }
    });
    busy(signup, false);
    if (error) {
      if ((error.message || "").toLowerCase().includes("already")) return say("An account with this email already exists. Please log in instead.", "warning");
      return say(friendly(error));
    }
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
      return say("An account with this email already exists. Please log in instead.", "warning");
    if (data.session) { location.href = Auth.safeNext(); return; }
    signup.reset();
    say("Account created! Check your email and click the link to confirm it, then log in.", "success");
  });

  // ---------- Forgot password ----------
  const forgot = $("forgot-form");
  if (forgot) forgot.addEventListener("submit", async e => {
    e.preventDefault(); msgBox.innerHTML = "";
    const email = $("forgot-email").value.trim();
    if (!isValidEmail(email)) return say("Please enter a valid email address.");
    busy(forgot, true);
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: pageUrl("reset-password.html") });
    busy(forgot, false);
    if (error) { console.error(error); return say("We could not send the email right now. Please try again in a few minutes."); }
    forgot.reset();
    say("If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).", "success");
  });

  // ---------- Set a new password (page opened from the email link) ----------
  const reset = $("reset-form");
  if (reset) {
    let shown = false;
    const showForm = () => { if (shown) return; shown = true; reset.hidden = false; $("reset-wait").hidden = true; };
    db.auth.onAuthStateChange(event => { if (event === "PASSWORD_RECOVERY") showForm(); });
    setTimeout(async () => {
      if (shown) return;
      const { data } = await db.auth.getSession();
      if (data.session) showForm();
      else { $("reset-wait").hidden = true; say("This link is invalid or has expired. Please request a new one.", "warning"); $("reset-new").hidden = false; }
    }, 2000);

    reset.addEventListener("submit", async e => {
      e.preventDefault(); msgBox.innerHTML = "";
      const pw = $("reset-password").value, pw2 = $("reset-password2").value;
      if (pw.length < 8) return say("Your password must be at least 8 characters.");
      if (pw !== pw2) return say("The two passwords do not match.");
      busy(reset, true);
      const { error } = await db.auth.updateUser({ password: pw });
      busy(reset, false);
      if (error) return say(friendly(error));
      reset.hidden = true;
      say("Your password has been changed. Taking you to your account...", "success");
      setTimeout(() => { location.href = "account.html"; }, 1600);
    });
  }
});