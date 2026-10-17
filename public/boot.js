// The theme (light or dark), the stroke colours and motion, set before anything is drawn: the
// player's choice, else the device's (see src/theme.ts, src/prefs.ts). Loaded by index.html before
// the page draws; a file of its own rather than inline, so the site's content security policy allows
// only its own scripts.
(function () {
  var choice = 'system';
  try {
    choice = localStorage.getItem('strokes:theme') || 'system';
  } catch (e) {}
  var dark = choice === 'dark' || (choice !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // The stroke colours and less motion, likewise (see src/prefs.ts).
  var prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem('strokes:prefs') || '{}') || {};
  } catch (e) {}
  // (A palette src/styles.css doesn't know leaves the strokes Earth's.)
  document.documentElement.dataset.palette = typeof prefs.palette === 'string' ? prefs.palette : 'earth';
  var motion = prefs.motion || 'system';
  var less = motion === 'less' || (motion !== 'full' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.documentElement.dataset.motion = less ? 'less' : 'full';
})();
