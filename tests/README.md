# Section 03 interaction checks

Start the local portfolio server on port 5500, install Playwright in your test environment, then run:

```sh
node tests/background-distance.cjs
node tests/background-handoff.cjs
```

Optional environment variables: `PORTFOLIO_URL`, `PLAYWRIGHT_MODULE` (module path), and `CHROMIUM_PATH` (browser executable).

- `background-distance`: fully open rows at viewport center, partial expansion at intermediate distances, and unrestricted forward/reverse wheel travel. Replaces the retired row-lock tests.
- `background-handoff`: physical mouse-coordinate clicks immediately after alternating wheel inputs, without Playwright's automatic wait for stable elements. Samples the selected row each frame to detect backward corrections and verifies final centering.

These are interaction/geometry checks, not a guarantee of identical perceived smoothness on every mouse, trackpad, or machine.
