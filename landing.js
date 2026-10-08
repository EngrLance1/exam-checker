// landing.js — the only script on the landing page. It shows the pinned "Open SagotScan" bar on phones once the hero button
// has scrolled out of view, and hides it again near the final call to action. Without JavaScript the bar is simply always shown.
(function () {
  var bar = document.getElementById("stickyCta");
  var hero = document.getElementById("heroCta");
  var final = document.getElementById("finalCta");
  if (!bar || !hero || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js");
  var heroVisible = true, finalVisible = false;
  function update() { bar.classList.toggle("show", !heroVisible && !finalVisible); }
  new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; update(); }).observe(hero);
  if (final) new IntersectionObserver(function (e) { finalVisible = e[0].isIntersecting; update(); }, { rootMargin: "0px 0px 120px 0px" }).observe(final);
})();
