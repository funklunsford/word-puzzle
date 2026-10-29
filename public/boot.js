// The stroke colours and motion, set before anything is drawn: the player's choice, else the
// device's (see src/prefs.ts). The look is always dark (Chalk & Charcoal; index.html sets it too, and
// a theme chosen before there was only one is ignored). Loaded by index.html before the page draws; a
// file of its own rather than inline, so the site's content security policy allows only its own
// scripts.
(function () {
  document.documentElement.dataset.theme = 'dark';
  // The stroke colours and less motion (see src/prefs.ts).
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
