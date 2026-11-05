/** The stand snippet every generated page carries: a page_view on load, and a
 *  click for each link pressed, naming where it goes. */
export const standScript = `<script>
window.stand = (event, params = {}) => {
  // Empty means absent: an id nobody has is a key the node never stores,
  // rather than a blank one every storage-refusing browser shares.
  const hold = (store, key) => {
    try {
      let id = window[store].getItem(key);
      if (!id) { id = crypto.randomUUID(); window[store].setItem(key, id); }
      return id;
    } catch (refused) { return ""; }
  };
  const u = new URL("https://api.q.sbvh.nl/s/Ground/datapixel");
  u.searchParams.set("e", event);
  u.searchParams.set("page", location.pathname);

  // The person, and the sitting. Without the second one a visitor who
  // comes back next week is one visit that lasted a week.
  const who = hold("localStorage", "stand_id");
  if (who) u.searchParams.set("v", who);
  const sitting = hold("sessionStorage", "stand_visit");
  if (sitting) u.searchParams.set("visit", sitting);

  // Your own pages are not a referrer: moving inside the site is the
  // walk, not the way in.
  try {
    if (document.referrer && new URL(document.referrer).hostname !== location.hostname) {
      u.searchParams.set("ref", document.referrer);
    }
  } catch (notAUrl) { /* no referrer worth sending */ }

  const here = new URLSearchParams(location.search);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = here.get(k);
    if (value) u.searchParams.set(k, value);
  }

  // What you pass is what is stored, under the key you passed it with.
  // The node never learns what a key means, so pass what you mean —
  // another analytics tool's params become your records here.
  for (const k in params) u.searchParams.set(k, params[k]);

  // keepalive, so an event fired as the page goes still arrives.
  fetch(u, { method: "GET", mode: "no-cors", keepalive: true }).catch(() => {});
};
stand("page_view");

// A link pressed, anywhere on the page, said with where it goes.
document.addEventListener("click", (e) => {
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (a) stand("click", { href: a.href });
}, true);
</script>`;
