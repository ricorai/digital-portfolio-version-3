(function () {
  var hero = document.querySelector('.hero');
  var layers = document.querySelectorAll('[data-hero-layer]');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fitHeroToViewport() {
    if (!hero || window.matchMedia('(max-width: 900px)').matches) {
      return;
    }

    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1000);
    hero.style.setProperty('--hero-scale', scale.toFixed(4));
  }

  function blocksZoomShortcut(event) {
    if (!event.ctrlKey && !event.metaKey) {
      return false;
    }

    return event.key === '+' || event.key === '=' || event.key === '-' || event.key === '0';
  }

  document.addEventListener('keydown', function (event) {
    if (blocksZoomShortcut(event)) {
      event.preventDefault();
    }
  }, true);

  document.addEventListener('wheel', function (event) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  }, { capture: true, passive: false });

  fitHeroToViewport();
  window.addEventListener('resize', fitHeroToViewport);

  if (!hero || layers.length === 0 || reduced) {
    return;
  }

  var factors = { ring: 8, disc: 16 };

  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    var dx = (e.clientX - rect.left) / rect.width - 0.5;
    var dy = (e.clientY - rect.top) / rect.height - 0.5;

    layers.forEach(function (el) {
      var f = factors[el.getAttribute('data-hero-layer')] || 10;
      el.style.transform =
        'translate(' + (dx * f).toFixed(1) + 'px,' + (dy * f).toFixed(1) + 'px)';
    });
  });

  hero.addEventListener('mouseleave', function () {
    layers.forEach(function (el) {
      el.style.transform = '';
    });
  });
})();
