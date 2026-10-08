// Randomized ambient highlights; no timers or scroll listeners needed.
(() => {
  const content = document.getElementById('smooth-content');
  if (!content) return;
  fetch('assets/images/background-lattice-light.svg').then(response => {
    if (!response.ok) throw new Error('Pattern unavailable');
    return response.text();
  }).then(source => {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
    const ns = 'http://www.w3.org/2000/svg';
    const shuffle = values => {
      const result = [...values];
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };
    // Disjoint, randomly assigned territories prevent overlapping highlights.
    const cells = shuffle(Array.from({ length: 16 }, (_, i) => `${i % 4 * 144} ${Math.floor(i / 4) * 144}`));
    const makeRoute = pool => {
      for (let attempt = 0; attempt < 128; attempt += 1) {
        const route = Array.from({ length: 4 }, () => shuffle(pool)).flat();
        // Check the loop boundary too: no reuse within the previous four visits.
        if (route.every((cell, i) => [1, 2, 3, 4].every(gap =>
          cell !== route[(i - gap + route.length) % route.length]))) return route;
      }
      const order = shuffle(pool);
      return Array.from({ length: 4 }, () => order).flat();
    };
    svg.querySelectorAll('svg > g').forEach((group, index) => {
      const duration = 3.5 + Math.random() * 2;
      group.setAttribute('stroke-dasharray', '26 74');
      group.querySelectorAll('animate').forEach(animation => {
        animation.setAttribute('dur', duration + 's');
      });
      // Change tile locations only between faded-out passes.
      const positions = makeRoute(cells.slice(index * 8, index * 8 + 8));
      const movement = document.createElementNS(ns, 'animateTransform');
      movement.setAttribute('attributeName', 'transform');
      movement.setAttribute('type', 'translate');
      movement.setAttribute('calcMode', 'discrete');
      movement.setAttribute('values', positions.join(';'));
      movement.setAttribute('dur', duration * positions.length + 's');
      movement.setAttribute('repeatCount', 'indefinite');
      group.append(movement);
      group.querySelectorAll('use').forEach(use => {
        use.setAttribute('x', '0'); use.setAttribute('y', '0');
      });
      // Share a start phase so relocation occurs at opacity zero.
      group.querySelectorAll('animate').forEach(animation => animation.setAttribute('begin', '0s'));
      const opacity = group.querySelector('animate[attributeName="opacity"]');
      opacity.setAttribute('values', `0;${index ? '.12' : '.16'};${index ? '.12' : '.16'};0;0`);
      opacity.setAttribute('keyTimes', '0;.12;.72;.9;1');
    });
    content.style.setProperty('--ambient-lattice', 'url("data:image/svg+xml,' +
      encodeURIComponent(new XMLSerializer().serializeToString(svg)) + '")');
  }).catch(() => { /* The local static/animated background remains available. */ });
})();
