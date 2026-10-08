(() => {
  const hero = document.querySelector('.hero');
  const loader = document.querySelector('.site-loader');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loaderStartedAt = performance.now();
  const minimumLoaderDuration = 300;
  const loaderFailsafeDuration = 8000;
  const loaderExitDuration = 250;

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
    document.documentElement.style.setProperty('--section-scale', scale.toFixed(4));
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


  }

  const accordionItems = [...document.querySelectorAll('.background-item')];
  const backgroundList = document.querySelector('.background-list');
  const backgroundMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let backgroundFrame = 0;
  let backgroundManual = null;
  let backgroundPan = null;
  let backgroundOwnsScroll = false;
  let backgroundStep = 1;
  let backgroundExtra = 0;
  const backgroundHeights = accordionItems.map(() => 0);
  const backgroundCopyHeights = accordionItems.map(() => 0);
  let backgroundTime = 0;
  const backgroundAmounts = accordionItems.map(() => 0);
  const renderBackground = () => {
    cancelAnimationFrame(backgroundFrame);
    backgroundFrame = 0;
    if (!backgroundList) return;
    const top = backgroundList.getBoundingClientRect().top;
    // Compute the desired layout from top to bottom, independently of the
    // animated heights. This centers the actual row without layout feedback.
    let plannedExpansion = 0;
    const targets = accordionItems.map((item, index) => {
      const center = top + index * backgroundStep + backgroundStep / 2 + plannedExpansion;
      // A reading zone, not a single-pixel peak: fully open near the center,
      // with a gradual falloff outside it so wheel increments cannot miss it.
      const distance = Math.abs(center - innerHeight / 2);
      const proximity = Math.max(0, Math.min(1,
        1 - (distance - backgroundStep * 0.4) / (backgroundStep * 0.6)));
      const target = backgroundManual !== null ? Number(index === backgroundManual)
        : backgroundMotion.matches ? Number(index === 0)
        : proximity * proximity * (3 - 2 * proximity);
      plannedExpansion += backgroundHeights[index] * target;
      return target;
    });
    const now = performance.now();
    const blend = backgroundMotion.matches ? 1
      : 1 - Math.exp(-Math.min(40, backgroundTime ? now - backgroundTime : 16) / 90);
    backgroundTime = now;
    let unsettled = false;
    let total = 0;
    accordionItems.forEach((item, index) => {
      const target = targets[index];
      if (!backgroundPan) {
        backgroundAmounts[index] += (target - backgroundAmounts[index]) * blend;
        if (Math.abs(target - backgroundAmounts[index]) < 0.001) backgroundAmounts[index] = target;
        else unsettled = true;
      }
      const amount = backgroundAmounts[index];
      total += backgroundHeights[index] * amount;
      const panel = item.querySelector('.background-panel');
      item.style.setProperty('--row-open', amount.toFixed(4));
      panel.style.height = (backgroundHeights[index] * amount).toFixed(2) + 'px';
      // Keep the full copy clear of the divider before revealing it. Fade it
      // away before the closing panel becomes shorter than its text.
      const reveal = Math.max(0, Math.min(1,
        (backgroundHeights[index] * amount - backgroundCopyHeights[index] - 16) / 32));
      panel.style.opacity = String(reveal * reveal * (3 - 2 * reveal));
      const open = amount > 0.05;
      item.classList.toggle('is-open', open);
      item.querySelector('.background-trigger').setAttribute('aria-expanded', String(open));
      panel.setAttribute('aria-hidden', String(!open));
      item.querySelector('.background-cue').textContent = amount > 0.5 ? '−' : '+';
    });
    // Preserve the list's total footprint while the first row is still closed.
    backgroundList.style.paddingBottom = Math.max(0, backgroundExtra - total).toFixed(2) + 'px';
    if (unsettled) backgroundFrame = requestAnimationFrame(renderBackground);
    else backgroundTime = 0;
  };
  const scheduleBackground = () => {
    if (!backgroundFrame) backgroundFrame = requestAnimationFrame(renderBackground);
  };
  const measureBackground = () => {
    if (!backgroundList) return;
    // One shared expansion budget keeps total list height constant as rows trade space.
    const gap = parseFloat(getComputedStyle(backgroundList).rowGap) || 0;
    backgroundStep = accordionItems[0].querySelector('.background-trigger').offsetHeight + gap;
    accordionItems.forEach((item, index) => {
      const copy = item.querySelector('.background-panel p');
      const contentHeight = copy.getBoundingClientRect().height - parseFloat(getComputedStyle(copy).paddingBottom);
      // Equal breathing room below every story, independent of line count.
      backgroundCopyHeights[index] = contentHeight;
      backgroundHeights[index] = contentHeight + 64;
    });
    backgroundExtra = Math.max(...backgroundHeights);
    renderBackground();
    window.ScrollTrigger?.refresh();
  };
  if (backgroundList) {
    backgroundList.classList.add('is-scroll-led');
    accordionItems.forEach((item, index) => {
      const button = item.querySelector('.background-trigger');
      const panel = item.querySelector('.background-panel');
      panel.hidden = false;
      panel.id = 'background-detail-' + index;
      button.setAttribute('aria-controls', panel.id);
      button.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch' || event.button !== 0) return;
        // Focus normally scrolls the native document before ScrollSmoother's
        // focus callback runs. During an unfinished scroll those positions differ.
        event.preventDefault();
        // Keep mouse-up/click attached to the pressed row while its geometry is
        // moving. Otherwise a scroll reversal can move another row under mouse-up.
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener('click', () => {
        panBackgroundRow(index);
      });
    });
    measureBackground();
    document.fonts?.ready.then(measureBackground);
    window.addEventListener('resize', measureBackground);
    window.addEventListener('scroll', scheduleBackground, { passive: true });
    backgroundMotion.addEventListener('change', () => {
      backgroundManual = null;
      renderBackground();
    });
  }
  const approachSection = document.querySelector('.what-section');
  const approachCards = [...document.querySelectorAll('.approach-card')];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const backHeadings = ['Find the real problem.', 'Make something useful.', 'Make the work easier.'];

  const flipApproachCard = (card, flipped) => {
    card.style.setProperty('--flip-duration', flipped ? '500ms' : '200ms');
    card.style.setProperty('--flip-easing', flipped ? 'cubic-bezier(.42, 0, .22, 1)' : 'cubic-bezier(.16, 1, .3, 1)');
    card.classList.toggle('is-flipped', flipped);
    card.setAttribute('aria-pressed', String(flipped));
    card.querySelector('.approach-front').setAttribute('aria-hidden', String(flipped));
    card.querySelector('.approach-back').setAttribute('aria-hidden', String(!flipped));
  };

  approachCards.forEach((card, index) => {
    const title = card.querySelector('h3').textContent;
    const description = card.querySelector('p').textContent;
    const rotor = document.createElement('div');
    rotor.className = 'approach-rotor';
    const front = document.createElement('div');
    front.className = 'approach-face approach-front';
    while (card.firstChild) front.append(card.firstChild);
    const back = document.createElement('div');
    back.className = 'approach-face approach-back';
    const copy = document.createElement('div');
    copy.className = 'approach-copy';
    const heading = document.createElement('h3');
    heading.textContent = backHeadings[index];
    const paragraph = document.createElement('p');
    paragraph.textContent = description;
    copy.append(heading, paragraph);
    back.append(copy);
    rotor.append(front, back);
    card.append(rotor);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', title + ': flip card');
    flipApproachCard(card, false);
    const toggle = () => { cancelApproachMotion(); flipApproachCard(card, !card.classList.contains('is-flipped')); };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
  });

  // A single scroll owner: native scroll targets, GSAP visual smoothing.
  // Never fix the body or snap the rendered page to the card anchor.
  let smoother = null;
  let heldAt = null;
  let direction = 0;
  let busyUntil = 0;
  let foldTimers = [];
  let lastWheelAt = -Infinity;
  let pendingEntryDirection = 0;
  let previousNativeY = window.scrollY;
  let wheelDirection = 1;
  const cancelApproachMotion = () => {
    foldTimers.forEach(clearTimeout);
    foldTimers = [];
    busyUntil = 0;
  };
  const releaseApproach = () => {
    heldAt = null;
    pendingEntryDirection = 0;
    cancelApproachMotion();
  };
  const cardAnchor = () => smoother.offset(approachSection.querySelector('.section-inner'), 'center center');
  const canHoldCards = () => smoother &&
    approachSection.querySelector('.section-inner').offsetHeight < innerHeight - 40;
  const advanceCards = (nextDirection) => {
    if (direction !== nextDirection) cancelApproachMotion();
    direction = nextDirection;
    if (performance.now() < busyUntil) return;
    if (direction > 0) {
      const next = approachCards.find(card => !card.classList.contains('is-flipped'));
      if (next) {
        flipApproachCard(next, true);
        busyUntil = performance.now() + 500;
      }
    } else {
      const open = [...approachCards].reverse().filter(card => card.classList.contains('is-flipped'));
      open.forEach((card, index) => {
        if (!index) flipApproachCard(card, false);
        else foldTimers.push(setTimeout(() => flipApproachCard(card, false), index * 200));
      });
      busyUntil = performance.now() + open.length * 200;
    }
  };
  const hasCardsToMove = nextDirection => approachCards.some(card =>
    card.classList.contains('is-flipped') === (nextDirection < 0));
  const enterApproach = (anchor, nextDirection) => {
    heldAt = Math.round(anchor);
    pendingEntryDirection = nextDirection;
    window.scrollTo({ top: heldAt, behavior: 'instant' });
    previousNativeY = heldAt;
  };
  const settleApproach = () => {
    if (!smoother || heldAt === null || !pendingEntryDirection) return;
    // Native scroll can be far ahead of the visible GSAP content.
    // Do not spend the card sequence while the user is still arriving.
    if (Math.abs(smoother.scrollTop() - heldAt) > 2) return;
    const nextDirection = pendingEntryDirection;
    pendingEntryDirection = 0;
    advanceCards(nextDirection);
  };
  // Continuous frame-limited travel, with a gentle valley around section centers.
  let wheelTravel = 0;
  let wheelFrame = 0;
  let wheelTime = 0;
  const clearWheelTravel = () => {
    wheelTravel = 0;
    cancelAnimationFrame(wheelFrame);
    wheelFrame = wheelTime = 0;
  };
  const moveCappedWheel = delta => {
    const movePage = () => window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
    if (!canHoldCards()) { movePage(); return; }
    // Direction still reaches the card controller when travel allowance is empty.
    const nextDirection = Math.sign(delta);
    lastWheelAt = performance.now();
    wheelDirection = nextDirection;
    const anchor = heldAt ?? cardAnchor();
    const y = window.scrollY;
    const visibleY = smoother.scrollTop();
    const crossing = nextDirection > 0 ? Math.min(y, visibleY) <= anchor + 2 && y + delta >= anchor - 2
      : Math.max(y, visibleY) >= anchor - 2 && y + delta <= anchor + 2;
    if (heldAt === null && !hasCardsToMove(nextDirection)) { movePage(); return; }
    if (heldAt === null && !crossing) {
      const approaching = nextDirection > 0 ? y < anchor : y > anchor;
      if (approaching) {
        // Cancel native momentum before it is queued. GSAP still smooths the
        // visible approach, but its target can never travel beyond the stop.

        window.scrollTo({ top: nextDirection > 0 ? Math.min(anchor, y + delta)
          : Math.max(anchor, y + delta), behavior: 'instant' });
      } else { movePage(); }
      return;
    }
    if (nextDirection !== direction) cancelApproachMotion();
    // Once the last animation finishes, this same continuing gesture can leave.
    if (!hasCardsToMove(nextDirection) && performance.now() >= busyUntil) {
      releaseApproach();
      movePage();
      return;
    }

    if (heldAt === null) enterApproach(anchor, nextDirection);
    if (pendingEntryDirection) {
      pendingEntryDirection = nextDirection;
      settleApproach();
      return;
    }
    advanceCards(nextDirection);
  };
  const sectionScrollRate = () => {
    // Normal sections stay brisk. Brake only on approach to an unfinished card sequence.
    if (!canHoldCards() || !hasCardsToMove(Math.sign(wheelTravel))) return innerHeight * 4;
    const distance = Math.abs(cardAnchor() - window.scrollY);
    const fraction = Math.min(1, distance / (innerHeight * 0.22));
    const ease = fraction * fraction * (3 - 2 * fraction);
    return innerHeight * (1.4 + 2.6 * ease);
  };
  const runWheelTravel = now => {
    const seconds = Math.min(0.032, wheelTime ? (now - wheelTime) / 1000 : 1 / 60);
    wheelTime = now;
    const step = Math.sign(wheelTravel) * Math.min(Math.abs(wheelTravel), sectionScrollRate() * seconds);
    wheelTravel -= step;
    if (step) moveCappedWheel(step);
    // Never carry accumulated input through a card hold.
    if (heldAt !== null) wheelTravel = 0;
    if (Math.abs(wheelTravel) > 0.1) wheelFrame = requestAnimationFrame(runWheelTravel);
    else wheelFrame = wheelTime = 0;
  };
  window.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || !event.deltaY || !event.cancelable ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        document.body.classList.contains('is-loading')) return;
    for (let element = event.target instanceof Element ? event.target : null;
         element && element !== document.body && element !== document.documentElement; element = element.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(element).overflowY) &&
          element.scrollHeight > element.clientHeight + 1) return;
    }
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    resumeBackgroundScroll();
    if (heldAt !== null) {
      clearWheelTravel();
      moveCappedWheel(Math.sign(delta));
      return;
    }
    if (Math.sign(delta) !== Math.sign(wheelTravel)) wheelTravel = 0;
    // Keep a small bounded travel buffer; discard excess input rather than queue it.
    const limit = innerHeight * 0.32;
    wheelTravel = Math.max(-limit, Math.min(limit, wheelTravel + delta));
    if (!wheelFrame) wheelFrame = requestAnimationFrame(runWheelTravel);
  }, { passive: false, capture: true });
  window.addEventListener('resize', clearWheelTravel);
  const stopBackgroundPan = () => {
    backgroundPan?.kill();
    backgroundPan = null;
    if (backgroundOwnsScroll) {
      backgroundOwnsScroll = false;
      smoother?.paused(false);
    }
  };
  const panBackgroundRow = index => {
    // Retarget from the current rendered state without briefly returning control
    // to the smoother between two selections.
    backgroundPan?.kill();
    backgroundPan = null;
    backgroundManual = index;
    clearWheelTravel();
    releaseApproach();
    // Sample the painted transform before pausing: on a wheel/ticker boundary
    // the smoother's cached scrollTop can be one render ahead of the DOM.
    const visualY = smoother ? -smoother.content().getBoundingClientRect().top : window.scrollY;
    // A click owns scrolling until it finishes or new user input interrupts it.
    // paused() stops the smoother's catch-up tween, not just our wheel queue.
    if (smoother && !smoother.paused()) {
      smoother.paused(true);
      backgroundOwnsScroll = true;
    }
    // Finish the scroll-to-click handoff before measuring the row. Setting the
    // position flushes ScrollSmoother's outstanding interpolation/update first.
    if (smoother) smoother.scrollTop(visualY);
    cancelAnimationFrame(backgroundFrame);
    backgroundFrame = 0;
    backgroundTime = 0;
    const top = backgroundList.getBoundingClientRect().top + visualY;
    // Use the final row layout, after all preceding rows have closed.
    const destination = Math.max(0, Math.min(
      document.documentElement.scrollHeight - innerHeight,
      top + index * backgroundStep + backgroundStep / 2 - innerHeight * 0.5));
    if (backgroundMotion.matches || !window.gsap) {
      renderBackground();
      window.scrollTo({ top: destination, behavior: 'instant' });
      stopBackgroundPan();
      return;
    }
    const initialAmounts = [...backgroundAmounts];
    const trigger = accordionItems[index].querySelector('.background-trigger');
    const initialRect = trigger.getBoundingClientRect();
    // Resolve the final position once, including borders and fractional row sizes.
    // Feeding live transformed geometry back into ScrollSmoother each frame can
    // race its render tick and produce occasional corrective jumps.
    const precedingHeight = accordionItems.slice(0, index).reduce((sum, item) =>
      sum + item.querySelector('.background-panel').getBoundingClientRect().height, 0);
    const finalY = Math.max(0, Math.min(
      document.documentElement.scrollHeight - innerHeight,
      (smoother ? -smoother.content().getBoundingClientRect().top : window.scrollY)
        + initialRect.top + initialRect.height / 2 - precedingHeight - innerHeight / 2));
    const position = { progress: 0 };
    backgroundPan = gsap.to(position, {
      progress: 1, duration: 0.55, ease: 'power2.inOut',
      onUpdate: () => {
        initialAmounts.forEach((amount, row) => {
          backgroundAmounts[row] = amount + ((row === index ? 1 : 0) - amount) * position.progress;
        });
        renderBackground();
        const nextY = visualY + (finalY - visualY) * position.progress;
        if (smoother) smoother.scrollTop(nextY);
        else window.scrollTo({ top: nextY, behavior: 'instant' });
      },
      onComplete: stopBackgroundPan
    });
  };
  const resumeBackgroundScroll = () => {
    stopBackgroundPan();
    if (!backgroundMotion.matches) backgroundManual = null;
  };
  window.addEventListener('touchstart', resumeBackgroundScroll, { passive: true });
  window.addEventListener('resize', resumeBackgroundScroll);
  document.addEventListener('keydown', event => {
    if (['Escape', 'Tab', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) resumeBackgroundScroll();
  });
  backgroundMotion.addEventListener('change', resumeBackgroundScroll);
  window.addEventListener('blur', clearWheelTravel);
  document.addEventListener('keydown', clearWheelTravel);
  document.addEventListener('click', event => {
    if (event.target.closest('a[href]')) {
      clearWheelTravel();
      resumeBackgroundScroll();
    }
  });
  document.addEventListener('keydown', event => {
    if (['Escape', 'Tab', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      releaseApproach();
      lastWheelAt = -Infinity;
    }
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !smoother) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    releaseApproach();
    lastWheelAt = -Infinity;
    history.pushState(null, '', link.hash);
    smoother.scrollTo(target, true, 'top top');
  });
  window.addEventListener('resize', releaseApproach);

  if (window.gsap && window.ScrollTrigger && window.ScrollSmoother) {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
    gsap.matchMedia().add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      document.documentElement.classList.add('has-scroll-smoother');
      smoother = ScrollSmoother.create({
        wrapper: '#smooth-wrapper', content: '#smooth-content',
        smooth: 0.4, smoothTouch: false, effects: false,
        onFocusIn: (self, event) => event.target.closest('.background-trigger') ? false : undefined,
        onUpdate: () => {
          // The tools copy follows the rendered position, not the target position.
          settleApproach();
          requestToolsUpdate();
          scheduleBackground();
        }
      });
      ScrollTrigger.create({
        trigger: '.tools-section', pin: '.tools-sticky', start: 'top top',
        end: 'bottom bottom', pinSpacing: false, invalidateOnRefresh: true,
        onRefresh: self => {
          // Match the page lattice at entry, then keep that origin while pinned.
          self.pin.style.setProperty('--tools-pattern-y', `${-self.start % 576}px`);
        }
      });
      const refresh = () => ScrollTrigger.refresh();
      document.fonts?.ready.then(refresh);
      window.addEventListener('load', refresh, { once: true });
      document.addEventListener('loader:complete', refresh, { once: true });
      return () => {
        releaseApproach();
        smoother?.kill();
        smoother = null;
        document.documentElement.classList.remove('has-scroll-smoother');
        window.removeEventListener('load', refresh);
        document.removeEventListener('loader:complete', refresh);
      };
    });
  }
  // Touch, reduced motion, and unavailable libraries retain native scrolling.
  // All cards remain operable by click, Enter, or Space.
  let mobileCardFrame = 0;
  window.addEventListener('scroll', () => {
    if (innerWidth > 900 || mobileCardFrame) return;
    mobileCardFrame = requestAnimationFrame(() => {
      mobileCardFrame = 0;
      approachCards.forEach(card => flipApproachCard(card,
        card.getBoundingClientRect().top < innerHeight * 0.35));
    });
  }, { passive: true });
  const toolsSection = document.querySelector('.tools-section');
  const toolWheel = document.querySelector('[data-tool-wheel]');
  let wheelLightAnimations = [];
  const traceWheelSelection = () => {
    wheelLightAnimations.forEach(animation => animation.cancel());
    wheelLightAnimations = [];
    if (motionPreference.matches || !toolWheel) return;
    wheelLightAnimations = [...toolWheel.querySelectorAll('.tool-wheel-light-trail, .tool-wheel-light-tip')]
      .map(line => line.animate([
        { strokeDashoffset: '0', opacity: 0, offset: 0 },
        { opacity: 1, offset: 0.1 },
        { opacity: 1, offset: 0.85 },
        { strokeDashoffset: '-100', opacity: 0, offset: 1 }
      ], { duration: 1800, easing: 'linear', iterations: 1 }));
  };
  motionPreference.addEventListener('change', () => {
    wheelLightAnimations.forEach(animation => animation.cancel());
  });
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
    const changedSelection = activeTool >= 0;
    activeTool = index;
    toolWheel.dataset.active = String(index);
    if (changedSelection) traceWheelSelection();
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

  function requestToolsUpdate() { requestAnimationFrame(() => updateToolFromScroll()); }
  let toolsFrame = 0;
  const updateToolFromScroll = () => {
    toolsFrame = 0;
    if (!toolsSection || window.innerWidth <= 900) return;
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
})();
