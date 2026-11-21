# Selah Naija: Nigerian Gospel Music and Sermons

A music and sermon streaming and download website. Visitors can listen and download without an account. Only the administrator uploads content. The database is ready for user uploads later.

Built with plain HTML, CSS, JavaScript (ES6), Bootstrap 5, Bootstrap Icons and Supabase (PostgreSQL, Authentication, Storage, Row Level Security).

## Files (all in one folder, no sub-folders)

- Public pages: index.html, music.html, latest.html, song.html, artists.html, artist.html, sermons.html, sermon.html, preacher.html, category.html, playlists.html, playlist.html, search.html, about.html, contact.html, report.html, privacy.html, terms.html, copyright.html, 404.html
- Accounts: login.html, signup.html, forgot-password.html, reset-password.html, account.html
- Admin: admin.html (dashboard), admin-music.html, admin-sermons.html, admin-artists.html, admin-preachers.html, admin-categories.html, admin-homepage.html, admin-users.html, admin-newsletter.html, admin-reports.html, admin-messages.html, admin-settings.html
- Styles: brand.css (colours), style.css (layout)
- Scripts: config.js (Supabase address and public key), supabase.js (connection), utils.js (helpers and cards), layout.js (shared navbar, footer, player bar), player.js (music player and downloads), songs.js, sermon-helpers.js, seo.js, search-suggest.js, site-settings.js, menu.js, auth.js, auth-pages.js, and one script for each page (home.js, music.js, song.js and so on). Admin scripts start with admin-.
- Hosting files: robots.txt, sitemap.xml, vercel.json

## Set-up

1. Create a free Supabase project.
2. Run the SQL blocks in this order (SQL Editor): Phase 2 (tables, security, storage and starting categories), Phase 4, Phase 6, Phase 8A, Phase 8B, Phase 8C, Phase 9.
3. In Authentication > Sign In / Providers > Email, decide whether "Confirm email" is on. For real visitors, turn it on and connect an email sender.
4. In Authentication > URL Configuration, set the Site URL to your website address and add it to the Redirect URLs.
5. Put the Project URL and the publishable key (sb_publishable_...) in config.js. Never put the secret or service_role key in any website file.
6. Create your admin login (Authentication > Users > Add user), then run:
   insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'YOUR_EMAIL';
7. Open index.html with Live Server (VS Code) to run it on your computer.

## Database (main tables)

profiles, user_roles, categories, subcategories, artists, albums, songs, preachers, sermons, playlists, playlist_songs, favorites, listening_history, download_history, newsletter_subscribers, content_submissions, content_reports, contact_messages, website_settings, rate_limits.

Relationships: an artist has many songs and albums; an album has many songs; a category (and subcategory) has many songs and sermons; a preacher has many sermons; a user has many playlists, favourites and history rows; a playlist has many songs. Duplicate favourites and duplicate playlist songs are blocked by primary keys. An artist or preacher with songs or sermons cannot be deleted.

## Storage buckets

- music-files and sermon-files: private. Only published items can be opened, using short-lived links. Only admins can upload or delete. Limit 50 MB per file (free plan).
- song-covers, artist-images, sermon-covers: public images, admin upload only.
- profile-images: public images; each person can only write inside the folder named after their own user id.

## Security

- Row Level Security is on for every table. Visitors can only read published content.
- Only admins can add, change or delete songs, sermons, artists, preachers, categories and settings.
- People can only read and change their own profile, favourites, playlists and history.
- Admin screens ask the database whether you are an admin. Hiding buttons is not the protection; the database rules are.
- Plays, downloads, newsletter sign-ups, reports and contact messages go through database functions with rate limits.
- User uploads are disabled: no policy allows them yet (the content_submissions table is ready for later).
- Run the security smoke test (see the Phase 9 instructions) after every big change.

## Deploying (free)

1. Put the folder contents in a GitHub repository (files at the top level).
2. In Vercel: Add New > Project > import the repository. Framework: Other. No build command.
3. Add the Vercel address to the Supabase Redirect URLs.
4. In Admin > Settings, generate sitemap.xml, put it in the folder, update the Sitemap line in robots.txt, and deploy again.

## Later launch steps (cost money or need a domain)

Custom domain; email sender and "Confirm email"; paid Supabase plan for backups, higher limits and no pausing; protection for bandwidth costs; server-side rendered share previews; lawyer review of the legal pages.