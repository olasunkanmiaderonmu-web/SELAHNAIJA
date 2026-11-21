/**
 * Selah Naija - shared navbar, footer and player bar for every page
 * EXCEPT index.html (which has its own copy of the same markup).
 * Load this AFTER utils.js.
 */
(function () {
  const NAV = [
    { title: "R&B", slug: "rnb", items: [["Nigerian Gospel R&B","nigerian-gospel-rnb"],["Contemporary Gospel","contemporary-gospel"],["Soul Gospel","soul-gospel"],["Inspirational R&B","inspirational-rnb"]] },
    { title: "Worship", slug: "worship", items: [["Deep Worship","deep-worship"],["Spontaneous Worship","spontaneous-worship"],["Intimate Worship","intimate-worship"],["Contemporary Worship","contemporary-worship"]] },
    { title: "Praise", slug: "praise", items: [["High Praise","high-praise"],["Thanksgiving","thanksgiving"],["Yoruba Praise","yoruba-praise"],["Igbo Praise","igbo-praise"],["English Praise","english-praise"]] },
    { title: "Sermons", slug: "sermons", items: [["Faith","faith"],["Prayer","prayer"],["Holy Spirit","holy-spirit"],["Christian Living","christian-living"],["Spiritual Growth","spiritual-growth"]] },
    { title: "Gospel Rap", slug: "gospel-rap", items: [["Gospel Hip-Hop","gospel-hip-hop"],["Christian Rap","christian-rap"],["Afro Gospel","afro-gospel"],["Gospel Drill","gospel-drill"]] },
    { title: "Instrumental", slug: "instrumental", items: [["Worship Instrumentals","worship-instrumentals"],["Piano Instrumentals","piano-instrumentals"],["Prayer Instrumentals","prayer-instrumentals"],["Background Worship","background-worship"]] }
  ];

  const page = document.body.dataset.page || "";
  const act = p => (page === p ? "active" : "");
  const catHref = (c, sub) => `category.html?cat=${c.slug}` + (sub ? `&amp;sub=${sub}` : "");

  const mega = NAV.map(c => `
    <div class="col">
      <a class="mega-title" href="${catHref(c)}">${escapeHtml(c.title)}</a>
      ${c.items.map(([name, slug]) => `<a class="mega-link" href="${catHref(c, slug)}">${escapeHtml(name)}</a>`).join("")}
    </div>`).join("");

  const logo = `
    <a class="logo" href="index.html" aria-label="Selah Naija home">
      <svg class="logo-icon"><use href="#selah-icon"/></svg>
      <span class="logo-text"><span class="logo-name">Selah</span><span class="logo-sub">NAIJA</span></span>
    </a>`;

  const header = document.getElementById("site-header");
  if (header) {
    header.className = "sticky-top";
    header.innerHTML = `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <symbol id="selah-icon" viewBox="0 0 100 100">
        <rect x="1.5" y="1.5" width="97" height="97" rx="24" fill="#241044" stroke="#6C35A5" stroke-width="3"/>
        <g fill="#FFFFFF" opacity="0.92">
          <rect x="12" y="40" width="6" height="20" rx="3"/><rect x="22" y="33" width="6" height="34" rx="3"/><rect x="32" y="26" width="6" height="48" rx="3"/>
          <rect x="62" y="26" width="6" height="48" rx="3"/><rect x="72" y="33" width="6" height="34" rx="3"/><rect x="82" y="40" width="6" height="20" rx="3"/>
        </g>
        <g fill="#D6AD55"><rect x="47" y="14" width="6" height="72" rx="3"/><rect x="40" y="32" width="20" height="6" rx="3"/></g>
      </symbol>
    </svg>
    <nav class="navbar navbar-expand-xl navbar-dark navbar-selah">
      <div class="container">
        ${logo}
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="mainNav">
          <ul class="navbar-nav mx-xl-auto mb-3 mb-xl-0">
            <li class="nav-item"><a class="nav-link ${act("home")}" href="index.html">Home</a></li>
            <li class="nav-item dropdown position-static">
              <a class="nav-link dropdown-toggle ${act("categories")}" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">Categories</a>
              <div class="dropdown-menu mega-menu">
                <div class="container"><div class="row row-cols-2 row-cols-md-3 row-cols-xl-6 g-4">${mega}</div></div>
              </div>
            </li>
            <li class="nav-item"><a class="nav-link ${act("artists")}" href="artists.html">Artists</a></li>
            <li class="nav-item"><a class="nav-link ${act("latest")}" href="latest.html">Latest Releases</a></li>
            <li class="nav-item"><a class="nav-link ${act("sermons")}" href="sermons.html">Sermons</a></li>
            <li class="nav-item"><a class="nav-link ${act("playlists")}" href="playlists.html">Playlists</a></li>
            <li class="nav-item"><a class="nav-link ${act("about")}" href="about.html">About Us</a></li>
            <li class="nav-item"><a class="nav-link ${act("contact")}" href="contact.html">Contact</a></li>
          </ul>
          <div class="d-flex align-items-center flex-wrap gap-2">
            <button class="btn btn-search" type="button" data-bs-toggle="collapse" data-bs-target="#searchBar" aria-controls="searchBar" aria-expanded="false" aria-label="Search"><i class="bi bi-search"></i></button>
            <a href="login.html" class="btn btn-outline-light btn-sm">Login</a>
            <a href="signup.html" class="btn btn-outline-light btn-sm">Sign Up</a>
            <a href="music.html" class="btn btn-gold btn-sm px-3"><i class="bi bi-play-circle-fill me-1"></i>Listen Now</a>
          </div>
        </div>
      </div>
    </nav>
    <div class="collapse search-strip" id="searchBar">
      <div class="container py-3">
        <form data-search-form role="search">
          <div class="input-group">
            <input type="search" name="q" class="form-control" placeholder="Search songs, artists, albums, sermons, preachers..." aria-label="Search" required>
            <button class="btn btn-gold px-4" type="submit">Search</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.className = "footer-selah pt-5";
    footer.innerHTML = `
    <div class="container">
      <div class="row g-4 pb-4">
        <div class="col-lg-4">
          <div class="mb-3">${logo}</div>
          <p class="small opacity-75">Your home for Nigerian gospel music and inspiring messages. Stream, download and share.</p>
          <div class="social">
            <a href="#" aria-label="Facebook"><i class="bi bi-facebook"></i></a>
            <a href="#" aria-label="X"><i class="bi bi-twitter-x"></i></a>
            <a href="#" aria-label="Instagram"><i class="bi bi-instagram"></i></a>
            <a href="#" aria-label="YouTube"><i class="bi bi-youtube"></i></a>
          </div>
        </div>
        <div class="col-6 col-lg-2"><h6>Discover</h6><ul>
          <li><a href="music.html">Music</a></li><li><a href="artists.html">Artists</a></li>
          <li><a href="sermons.html">Sermons</a></li><li><a href="playlists.html">Playlists</a></li></ul></div>
        <div class="col-6 col-lg-2"><h6>Company</h6><ul>
          <li><a href="about.html">About Us</a></li><li><a href="contact.html">Contact</a></li>
          <li><a href="report.html">Report Content</a></li></ul></div>
        <div class="col-6 col-lg-2"><h6>Legal</h6><ul>
          <li><a href="privacy.html">Privacy Policy</a></li><li><a href="terms.html">Terms of Service</a></li>
          <li><a href="copyright.html">Copyright Notice</a></li></ul></div>
        <div class="col-6 col-lg-2"><h6>Categories</h6><ul>
          <li><a href="category.html?cat=rnb">R&amp;B</a></li><li><a href="category.html?cat=worship">Worship</a></li>
          <li><a href="category.html?cat=praise">Praise</a></li><li><a href="category.html?cat=sermons">Sermons</a></li></ul></div>
      </div>
      <div class="copy py-3 text-center">&copy; <span id="year"></span> Selah Naija. All music and sermons are shared with permission of their owners.</div>
    </div>`;
  }

  const player = document.getElementById("site-player");
  if (player) {
    player.className = "player-bar";
    player.innerHTML = `
    <div class="container">
      <div class="row align-items-center g-2">
        <div class="col-8 col-md-3 d-flex align-items-center gap-2 min-w-0">
          <div class="track-cover" id="player-cover"><i class="bi bi-music-note-beamed"></i></div>
          <div class="min-w-0"><div class="fw-semibold text-truncate" id="player-title">Nothing playing</div>
            <div class="small opacity-75 text-truncate" id="player-artist">Choose a song to begin</div></div>
        </div>
        <div class="col-4 col-md-6 order-md-2">
          <div class="d-flex justify-content-center align-items-center">
            <button class="btn-icon d-none d-sm-inline" id="btn-shuffle" aria-label="Shuffle"><i class="bi bi-shuffle"></i></button>
            <button class="btn-icon" id="btn-prev" aria-label="Previous"><i class="bi bi-skip-start-fill"></i></button>
            <button class="btn-icon btn-play" id="btn-play" aria-label="Play"><i class="bi bi-play-fill"></i></button>
            <button class="btn-icon" id="btn-next" aria-label="Next"><i class="bi bi-skip-end-fill"></i></button>
            <button class="btn-icon d-none d-sm-inline" id="btn-repeat" aria-label="Repeat"><i class="bi bi-repeat"></i></button>
          </div>
          <div class="d-none d-md-flex align-items-center gap-2 small">
            <span id="time-current">0:00</span>
            <input type="range" class="form-range" id="progress" min="0" max="100" value="0" aria-label="Progress">
            <span id="time-total">0:00</span>
          </div>
        </div>
        <div class="col-md-3 order-md-3 d-none d-md-flex justify-content-end align-items-center gap-2">
          <button class="btn-icon" id="btn-mute" aria-label="Mute"><i class="bi bi-volume-up-fill"></i></button>
          <input type="range" class="form-range" id="volume" min="0" max="100" value="80" style="width:100px" aria-label="Volume">
        </div>
      </div>
    </div>`;
  }
})();


/* Search suggestions + account features on every page that uses this file */
["search-suggest.js", "auth.js", "menu.js", "site-settings.js"].forEach(src => {
  const s = document.createElement("script");
  s.src = src;
  document.body.appendChild(s);
});