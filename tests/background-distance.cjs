const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    for (const width of [1535, 1024]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.PORTFOLIO_URL || 'http://127.0.0.1:5500/');
      await page.waitForTimeout(1800);
      const geometry = await page.evaluate(() => {
        const list = document.querySelector('.background-list');
        const step = list.querySelector('button').offsetHeight;
        return { first: list.getBoundingClientRect().top + ScrollSmoother.get().scrollTop() + step / 2 - innerHeight / 2, step };
      });
      for (const index of [0, 1, 2, 3, 4, 3, 2, 1, 0]) {
        await page.evaluate(y => ScrollSmoother.get().scrollTop(y), geometry.first + index * geometry.step);
        await page.waitForTimeout(650);
        const amount = await page.locator('.background-item').nth(index).evaluate(el => parseFloat(el.style.getPropertyValue('--row-open')));
        assert.ok(amount > .97, `row ${index} not fully open at center: ${amount}`);
        assert.equal(await page.evaluate(() => ScrollSmoother.get().paused()), false);
      }
      const before = await page.evaluate(() => ScrollSmoother.get().scrollTop());
      await page.mouse.wheel(0, 140);
      await page.waitForTimeout(650);
      const after = await page.evaluate(() => ScrollSmoother.get().scrollTop());
      assert.ok(after > before + 100, 'wheel movement was locked');
      await page.mouse.wheel(0, -140);
      await page.waitForTimeout(650);
      assert.ok(await page.evaluate(y => ScrollSmoother.get().scrollTop() < y - 100, after));
      for (const offset of [-.3, .3]) {
        await page.evaluate(y => ScrollSmoother.get().scrollTop(y), geometry.first + geometry.step * offset);
        await page.waitForTimeout(650);
        const state = await page.locator('.background-item').first().evaluate(el => ({
          amount: parseFloat(el.style.getPropertyValue('--row-open')),
          opacity: Number(el.querySelector('.background-panel').style.opacity)
        }));
        assert.equal(state.amount, 1);
        assert.equal(state.opacity, 1);
      }
      await page.evaluate(y => ScrollSmoother.get().scrollTop(y), geometry.first - geometry.step * .7);
      await page.waitForTimeout(650);
      const partial = await page.locator('.background-item').first().evaluate(el => parseFloat(el.style.getPropertyValue('--row-open')));
      assert.ok(partial > .35 && partial < .65, `expected partial reveal, got ${partial}`);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: centered reveal, partial reveal, forward/reverse unrestricted wheel`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
