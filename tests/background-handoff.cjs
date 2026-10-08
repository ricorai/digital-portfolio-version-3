const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1535, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.PORTFOLIO_URL || 'http://127.0.0.1:5500/');
    await page.waitForTimeout(1800);
    await page.evaluate(() => {
      window.handoffAudit = [];
      document.addEventListener('click', event => {
        const row = event.target.closest('.background-trigger');
        if (!row) return;
        const samples = [];
        handoffAudit.push(samples);
        const until = performance.now() + 650;
        const sample = () => {
          const rect = row.getBoundingClientRect();
          samples.push(rect.top + rect.height / 2);
          if (performance.now() < until) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, true);
      ScrollSmoother.get().scrollTo('.background-list', false, 'top 480px');
    });
    await page.waitForTimeout(300);
    for (let round = 0; round < 12; round++) {
      for (const delta of [220, -190, 160]) {
        await page.mouse.wheel(0, delta);
        await page.waitForTimeout(35);
      }
      // Real coordinates: unlike locator.click(), do not wait for motion to stop.
      const rect = await page.locator('.background-trigger').nth(round % 3).boundingBox();
      await page.mouse.click(rect.x + rect.width * .85, rect.y + rect.height / 2);
      await page.waitForTimeout(720);
    }
    const results = await page.evaluate(() => handoffAudit.map(samples => {
      const direction = Math.sign(samples.at(-1) - samples[0]);
      return {
        error: Math.abs(samples.at(-1) - innerHeight / 2),
        reversals: samples.slice(1).filter((value, i) => (value - samples[i]) * direction < -1).length
      };
    }));
    console.log(JSON.stringify(results));
    assert.equal(results.length, 12);
    assert.ok(results.every(result => result.error < 2 && result.reversals === 0));
    assert.deepEqual(errors, []);
    console.log('PASS 12 direct scroll-reversal-to-click handoffs; no backwards corrections');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
