(() => {
  const hero = document.querySelector('.hero');
  const layers = document.querySelectorAll('[data-hero-layer]');
  const loader = document.querySelector('.site-loader');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loaderStartedAt = performance.now();
  const minimumLoaderDuration = 300;
  const loaderFailsafeDuration = 8000;
  const loaderExitDuration = 250;
  let parallaxReady = false;

  const releaseLoader = () => {
    if (!loader || loader.hidden) {
      return;
    }

    loader.hidden = true;
    document.body.classList.remove('is-loading');
    document.dispatchEvent(new Event('loader:complete'));
  };

  const wait = (duration) => new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });

  const waitForImage = (image) => new Promise((resolve) => {
    const finish = () => {
      if (typeof image.decode === 'function') {
        image.decode().catch(() => {}).finally(resolve);
      } else {
        resolve();
      }
    };

    if (image.complete) {
      finish();
      return;
    }

    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', resolve, { once: true });
  });

  const waitForCriticalReadiness = () => {
    const pageReady = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
    const fontsReady = document.fonts?.ready?.catch(() => {}) ?? Promise.resolve();
    const heroMediaReady = Promise.all([...document.querySelectorAll('.hero-media img')].map(waitForImage));

    return Promise.all([pageReady, fontsReady, heroMediaReady]);
  };

  const beginLoaderExit = () => {
    if (!loader || loader.hidden || loader.classList.contains('is-exiting')) {
      return;
    }

    loader.classList.add('is-exiting');
    window.setTimeout(releaseLoader, loaderExitDuration);
  };

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

  const enableParallaxAfterHeroEntrance = () => {
    window.setTimeout(() => {
      parallaxReady = true;
    }, 1050);
  };

  if (loader) {
    const readiness = waitForCriticalReadiness();
    const readinessWithFailsafe = Promise.race([readiness, wait(loaderFailsafeDuration)]);

    if (reduced) {
      readinessWithFailsafe.finally(beginLoaderExit);
    } else {
      readinessWithFailsafe
        .then(() => wait(Math.max(0, minimumLoaderDuration - (performance.now() - loaderStartedAt))))
        .then(beginLoaderExit);
    }

    document.addEventListener('loader:complete', enableParallaxAfterHeroEntrance, { once: true });
  } else {
    enableParallaxAfterHeroEntrance();
  }

  const accordionItems = [...document.querySelectorAll('.background-item')];
  accordionItems.forEach((item) => {
    const trigger = item.querySelector('.background-trigger');
    const panel = item.querySelector('.background-panel');
    const cue = item.querySelector('.background-cue');

    trigger?.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');

      accordionItems.forEach((other) => {
        const otherTrigger = other.querySelector('.background-trigger');
        const otherPanel = other.querySelector('.background-panel');
        const otherCue = other.querySelector('.background-cue');
        other.classList.remove('is-open');
        otherTrigger?.setAttribute('aria-expanded', 'false');
        if (otherPanel) otherPanel.hidden = true;
        if (otherCue) otherCue.textContent = '+';
      });

      if (willOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        if (panel) panel.hidden = false;
        if (cue) cue.textContent = '−';
      }
    });
  });

  const toolsSection = document.querySelector('.tools-section');
  const toolWheel = document.querySelector('[data-tool-wheel]');
  const toolCopy = document.querySelector('.tool-copy');
  const toolLabel = document.querySelector('[data-tool-label]');
  const toolBody = document.querySelector('[data-tool-copy]');
  const toolButtons = [...document.querySelectorAll('[data-tool-index]')];
  const tools = [
    { label: 'WORK WITH AI', copy: 'I use several AI tools through VS Code and command-line apps. I connect their work by hand with my own Ryos system, so each one can help where it works best.' },
    { label: 'AUTOMATE TASKS', copy: 'I use n8n, scripts, and connected tools to handle repeated steps and move information between apps with less manual work.' },
    { label: 'BUILD & TEST', copy: 'I build in VS Code, use GitHub and CLI tools, then check the result in browsers and by using it like a real person.' },
    { label: 'ORGANIZE WORK', copy: 'I use Google Drive, Docs, Sheets, and the rest of Google Workspace to keep files, notes, and project work easy to find.' },
    { label: 'REACH PEOPLE', copy: 'I use AI and everyday media tools to research ideas, shape messages, and create marketing images, videos, and other content.' },
    { label: 'DESIGN IDEAS', copy: 'I use Figma to plan layouts, test ideas, and turn rough concepts into clear screens before I build them.' }
  ];
  let activeTool = -1;

  const setActiveTool = (index) => {
    if (!toolWheel || index === activeTool || !tools[index]) return;
    activeTool = index;
    toolWheel.dataset.active = String(index);
    toolWheel.style.setProperty('--wheel-rotation', `${index * 60}deg`);
    toolButtons.forEach((button, buttonIndex) => button.classList.toggle('is-active', buttonIndex === index));
    toolCopy?.classList.add('is-changing');
    window.setTimeout(() => {
      if (toolLabel) toolLabel.textContent = tools[index].label;
      if (toolBody) toolBody.textContent = tools[index].copy;
      toolCopy?.classList.remove('is-changing');
    }, reduced ? 0 : 140);
  };

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTool(Number(button.dataset.toolIndex)));
  });
  setActiveTool(0);

  let toolsFrame = 0;
  const updateToolFromScroll = () => {
    toolsFrame = 0;
    if (!toolsSection || window.innerWidth <= 760) return;
    const rect = toolsSection.getBoundingClientRect();
    const range = Math.max(1, rect.height - window.innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / range));
    setActiveTool(Math.min(5, Math.round(progress * 5)));
  };
  window.addEventListener('scroll', () => {
    if (!toolsFrame) toolsFrame = window.requestAnimationFrame(updateToolFromScroll);
  }, { passive: true });
  updateToolFromScroll();

  const observedSections = [...document.querySelectorAll('section[id]')];
  const navLinks = [...document.querySelectorAll('.hero-nav a[href^="#"]')];
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`));
    }, { rootMargin: '-25% 0px -55%', threshold: [0, 0.2, 0.5] });
    observedSections.forEach((section) => sectionObserver.observe(section));
  }
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
