(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !('IntersectionObserver' in window)) return;
  const selectors = ['.hero-nav-list a', '.hero-eyebrow', '.hero-greeting', '.hero-name', '.hero-copy', '.hero-wordmark',
    '#what-i-do .section-kicker', '#what-i-do .section-title', '#what-i-do .section-intro',
    '#experience .section-kicker', '#experience .section-title', '#tools .section-kicker', '#tools .section-title',
    '#projects .section-kicker', '#projects .section-title', '#projects .section-intro'];
  const records = new Map();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let ready = !document.body.classList.contains('is-loading');
  const finish = record => {
    cancelAnimationFrame(record.frame);
    record.overlay.remove();
    record.source.replaceWith(...record.source.childNodes);
    record.host.classList.remove('has-text-reveal');
    records.delete(record.host);
  };
  const play = record => {
    if (record.started || !ready) return;
    record.started = true;
    observer.unobserve(record.host);
    const start = performance.now();
    if (record.host.classList.contains('hero-wordmark')) {
      let lettersMeasured = 0;
      const bounds = record.host.getBoundingClientRect();
      const scale = bounds.width / record.host.offsetWidth || 1;
      const letters = [...record.text].map(char => {
        const letter = document.createElement('span');
        letter.textContent = char;
        letter.style.opacity = '0';
        letter.style.position = 'absolute';
        const range = document.createRange();
        range.setStart(record.source.firstChild, lettersMeasured);
        range.setEnd(record.source.firstChild, lettersMeasured + 1);
        const glyph = range.getBoundingClientRect();
        letter.style.left = (glyph.left - bounds.left) / scale + 'px';
        letter.style.top = '0';
        letter.style.width = glyph.width / scale + 'px';
        lettersMeasured += 1;
        record.overlay.append(letter);
        return letter;
      });
      const reveal = now => {
        const elapsed = now - start - 200;
        if (preference.matches || elapsed >= 900) { finish(record); return; }
        letters.forEach((letter, index) => {
          const progress = Math.max(0, Math.min(1, (elapsed - index * 55) / 420));
          letter.style.opacity = String(progress * progress * (3 - 2 * progress));
          letter.style.filter = 'blur(' + ((1 - progress) * 4).toFixed(2) + 'px)';
          // A brief substitution while faint; the final letter settles early.
          letter.textContent = progress > 0.18 && progress < 0.42
            ? alphabet[(index * 7 + 11) % alphabet.length]
            : record.text[index];
        });
        record.frame = requestAnimationFrame(reveal);
      };
      record.frame = requestAnimationFrame(reveal);
      return;
    }
    // Reserve one rendered glyph slot per source character, including spaces.
    // Measuring source ranges preserves kerning and responsive line wrapping.
    const bounds = record.overlay.getBoundingClientRect();
    const scale = bounds.width / record.overlay.offsetWidth || 1;
    const walker = document.createTreeWalker(record.source, NodeFilter.SHOW_TEXT);
    const glyphs = [];
    let node;
    while ((node = walker.nextNode())) {
      for (let offset = 0; offset < node.length; offset += 1) {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
        const rect = range.getBoundingClientRect();
        const letter = document.createElement('span');
        letter.textContent = node.data[offset];
        Object.assign(letter.style, {
          position: 'absolute', left: (rect.left - bounds.left) / scale + 'px',
          top: (rect.top - bounds.top) / scale + 'px',
          width: rect.width / scale + 'px', whiteSpace: 'pre', textAlign: 'left',
          opacity: '0'
        });
        record.overlay.append(letter);
        // Align the glyph's actual font box, not its line-height box.
        const probe = document.createRange();
        probe.selectNodeContents(letter);
        const measured = probe.getBoundingClientRect();
        letter.style.top = (rect.top - bounds.top - (measured.top - rect.top)) / scale + 'px';
        glyphs.push(letter);
      }
    }
    const duration = Math.min(1100, 500 + record.text.length * 5);
    let previousTick = -1;
    const frame = now => {
      const progress = Math.min(1, (now - start) / duration);
      if (progress === 1 || preference.matches) { finish(record); return; }
      const tick = Math.floor((now - start) / 50);
      if (tick !== previousTick) {
        previousTick = tick;
        const edge = progress * (record.text.length + 4);
        glyphs.forEach((letter, index) => {
          const char = record.text[index];
          const revealed = index <= edge;
          letter.style.opacity = revealed ? '1' : '0';
          const characters = /[0-9]/.test(char) ? '0123456789'
            : /[a-z]/.test(char) ? 'abcdefghijklmnopqrstuvwxyz'
            : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          letter.textContent = !/[A-Za-z0-9]/.test(char) || index < edge - 3 || !revealed
            ? char : characters[Math.floor(Math.random() * characters.length)];
        });
      }
      record.frame = requestAnimationFrame(frame);
    };
    record.frame = requestAnimationFrame(frame);
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const record = records.get(entry.target);
      if (!record) return;
      record.visible = entry.isIntersecting;
      if (record.visible) play(record);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll(selectors.join(',')).forEach(host => {
    const source = document.createElement('span');
    source.className = 'text-reveal-source';
    const overlay = document.createElement('span');
    overlay.className = 'text-reveal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    const text = host.textContent;
    while (host.firstChild) source.append(host.firstChild);
    host.append(source, overlay);
    host.classList.add('has-text-reveal');
    const record = { host, source, overlay, text, started: false, visible: false, frame: 0 };
    records.set(host, record);
    observer.observe(host);
    host.addEventListener('focus', () => {
      if (records.has(host)) { observer.unobserve(host); finish(record); }
    }, { once: true });
  });
  document.addEventListener('loader:complete', () => {
    ready = true;
    records.forEach(record => { if (record.visible) play(record); });
  }, { once: true });
  window.addEventListener('resize', () => {
    [...records.values()].filter(record => record.started).forEach(finish);
  });
  preference.addEventListener('change', () => {
    if (!preference.matches) return;
    observer.disconnect();
    [...records.values()].forEach(finish);
  });
})();