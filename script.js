(() => {
  const hero = document.querySelector('.hero');
  const layers = document.querySelectorAll('[data-hero-layer]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let parallaxReady = false;

  const fitHeroToViewport = () => {
    if (!hero || window.matchMedia('(max-width: 900px)').matches) {
      return;
    }

    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1000);
    hero.style.setProperty('--hero-scale', scale.toFixed(4));
  };

  const blocksZoomShortcut = (event) => {
    if (!event.ctrlKey && !event.metaKey) {
      return false;
    }

    return event.key === '+' || event.key === '=' || event.key === '-' || event.key === '0';
  };

  document.addEventListener('keydown', (event) => {
    if (blocksZoomShortcut(event)) {
      event.preventDefault();
    }
  }, true);

  document.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  }, { capture: true, passive: false });

  fitHeroToViewport();
  window.addEventListener('resize', fitHeroToViewport);

  window.setTimeout(() => {
    parallaxReady = true;
  }, 1050);

  if (!hero || layers.length === 0 || reduced) {
    return;
  }

  const factors = { ring: 8, disc: 16 };

  layers.forEach((layer) => {
    layer.addEventListener('animationend', () => {
      layer.style.animation = 'none';
    }, { once: true });
  });

  hero.addEventListener('mousemove', (event) => {
    if (!parallaxReady) {
      return;
    }

    const rect = hero.getBoundingClientRect();
    const dx = (event.clientX - rect.left) / rect.width - 0.5;
    const dy = (event.clientY - rect.top) / rect.height - 0.5;

    layers.forEach((layer) => {
      const factor = factors[layer.getAttribute('data-hero-layer')] || 10;
      layer.style.transition = 'none';
      layer.style.transform =
        `translate(${(dx * factor).toFixed(1)}px, ${(dy * factor).toFixed(1)}px)`;
    });
  });

  hero.addEventListener('mouseleave', () => {
    if (!parallaxReady) {
      return;
    }

    layers.forEach((layer) => {
      layer.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
      layer.style.transform = '';
    });
  });
})();
