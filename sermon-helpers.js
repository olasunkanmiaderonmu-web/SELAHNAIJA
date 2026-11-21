/** Selah Naija - sermon helpers shared by the sermon, preacher and (later) search pages. */

const SERMON_FIELDS = "id,title,topic,cover_path,duration_seconds,plays,downloads,preachers(id,name),categories(name)";

const mapSermon = s => ({
  id: s.id,
  title: s.title,
  cover_url: publicUrl("sermon-covers", s.cover_path),
  preacher_name: s.preachers?.name || "",
  category_name: s.categories?.name,
  duration: s.duration_seconds,
  plays: s.plays,
  downloads: s.downloads
});