import { test, expect } from '@playwright/test';

const tourPath = '/tester/tour/';
const wikiApi = '**/w/api.php*';
const preciseLocation = { latitude: 29.7382, longitude: -98.1047 };

const goodPlace = {
  query: { pages: {
    '1': { pageid: 1, title: 'Gruene Hall', extract: 'Gruene Hall is a historic dance hall in the Gruene Historic District of New Braunfels, Texas. It opened in the nineteenth century and remains known for live music and Texas culture.' }
  }}
};
const nearby = {
  query: { pages: {
    '2': { pageid: 2, index: 1, title: 'Gruene Historic District', extract: 'The Gruene Historic District preserves historic buildings and cultural sites in New Braunfels, Texas, including destinations associated with local music and commerce.' }
  }}
};

async function mockSpeech(page) {
  await page.addInitScript(() => {
    class TestUtterance { constructor(text){ this.text=text; this.rate=1; this.onstart=null; this.onend=null; } }
    let speaking=false, paused=false, last='';
    const synth = {
      get speaking(){ return speaking; },
      get paused(){ return paused; },
      cancel(){ speaking=false; paused=false; },
      speak(u){ last=u?.text||''; speaking=true; paused=false; u?.onstart?.(); },
      pause(){ if(speaking){ paused=true; } },
      resume(){ if(paused){ paused=false; speaking=true; } },
      __last(){ return last; }
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable:true, value: TestUtterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable:true, value: synth });
  });
}

async function routeWikipedia(page, capture = {}) {
  await page.route(wikiApi, async route => {
    const url = new URL(route.request().url());
    const generator = url.searchParams.get('generator');
    if (generator === 'geosearch') {
      capture.nearbyUrl = url.toString();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nearby) });
    } else {
      capture.namedUrl = url.toString();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(goodPlace) });
    }
  });
}

async function configureLocation(page, context) {
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation(preciseLocation);
  // Playwright WebKit reports synthetic geolocation with accuracy=9999, which
  // exercises TOUR's intentional low-confidence suppression instead of the
  // privacy invariant under test. Pin only accuracy while preserving the exact
  // coordinates so Chromium and WebKit execute the same outbound-coarsening path.
  await page.addInitScript(({ latitude, longitude }) => {
    const makePosition = () => ({
      coords: {
        latitude, longitude, accuracy: 10,
        altitude: null, altitudeAccuracy: null, heading: null, speed: null
      },
      timestamp: Date.now()
    });
    const geo = {
      getCurrentPosition(success){ setTimeout(() => success(makePosition()), 0); },
      watchPosition(success){
        // WebKit can miss a queueMicrotask callback installed from addInitScript
        // during the user-click path. Use a timer so both browser engines receive
        // the synthetic fix after START TOUR returns to the event loop.
        setTimeout(() => success(makePosition()), 0);
        return 1;
      },
      clearWatch(){}
    };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geo });
  }, preciseLocation);
}

test.beforeEach(async ({ page }) => {
  await mockSpeech(page);
});

test('FF-ESC-007 / release identity is neutral and current', async ({ page }) => {
  await page.goto(tourPath);
  await expect(page).toHaveTitle('TOUR General Field Test');
  await expect(page.locator('[data-forge-release="TOUR-FF-RC1"]')).toBeVisible();
  await expect(page.getByText(/wedding/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'CLEAR' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PAUSE' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'RESUME' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'REPEAT LAST STORY' })).toBeVisible();
});

test('FF-ESC-003 / CLEAR removes the full prior entry in one action', async ({ page }) => {
  await page.goto(tourPath);
  const input = page.locator('#placeInput');
  await input.fill('Gruene Hall New Braunfels Texas');
  await page.getByRole('button', { name: 'CLEAR' }).click();
  await expect(input).toHaveValue('');
  await expect(page.locator('#placeStatus')).toContainText('Cleared');
});

test('FF-ESC-002 / known named place returns the named place, not nearby substitution', async ({ page }) => {
  await routeWikipedia(page);
  await page.goto(tourPath);
  await page.locator('#placeInput').fill('Gruene Hall');
  await page.getByRole('button', { name: 'TELL ME ABOUT THIS PLACE' }).click();
  await expect(page.locator('#placeStatus')).toContainText('Found: Gruene Hall');
  const spoken = await page.evaluate(() => window.speechSynthesis.__last());
  expect(spoken).toContain('Gruene Hall');
});

test('FF-ESC-002 / no-match is explicit and does not claim nearby content answers the request', async ({ page }) => {
  await page.route(wikiApi, async route => {
    const url = new URL(route.request().url());
    const body = url.searchParams.get('generator') === 'geosearch' ? nearby : { query: { pages: {} } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(tourPath);
  await page.locator('#placeInput').fill('Imaginary Venue 12345');
  await page.getByRole('button', { name: 'TELL ME ABOUT THIS PLACE' }).click();
  await expect(page.locator('#placeStatus')).toContainText(/couldn't confidently verify|cannot confidently/i);
  const spoken = await page.evaluate(() => window.speechSynthesis.__last());
  expect(spoken).not.toContain('Gruene Historic District');
});

test('FF-ESC-006 / outbound nearby lookup uses coarse location, never precise GPS', async ({ page, context }) => {
  const capture = {};
  await configureLocation(page, context);
  await routeWikipedia(page, capture);
  await page.goto(tourPath);
  await page.getByRole('button', { name: 'START TOUR & ALLOW LOCATION' }).click();
  await expect.poll(() => capture.nearbyUrl || '', { timeout: 10000 }).not.toBe('');
  const url = new URL(capture.nearbyUrl);
  const coord = url.searchParams.get('ggscoord');
  expect(coord).toBe('29.74|-98.1');
  expect(capture.nearbyUrl).not.toContain('29.7382');
  expect(capture.nearbyUrl).not.toContain('-98.1047');
});

test('FF-ESC-004 / narration pause, resume and repeat are functional state transitions', async ({ page }) => {
  await routeWikipedia(page);
  await page.goto(tourPath);
  await page.locator('#placeInput').fill('Gruene Hall');
  await page.getByRole('button', { name: 'TELL ME ABOUT THIS PLACE' }).click();
  await expect(page.locator('#placeStatus')).toContainText('Found: Gruene Hall');
  await expect(page.locator('#narrationStatus')).toContainText('Speaking');
  await page.getByRole('button', { name: 'PAUSE' }).click();
  await expect(page.locator('#narrationStatus')).toContainText('Paused');
  await page.getByRole('button', { name: 'RESUME' }).click();
  await expect(page.locator('#narrationStatus')).toContainText('Speaking');
  const before = await page.evaluate(() => window.speechSynthesis.__last());
  await page.getByRole('button', { name: 'REPEAT LAST STORY' }).click();
  const after = await page.evaluate(() => window.speechSynthesis.__last());
  expect(after).toBe(before);
});

test('FF-ESC-006 / Flight Recorder never persists precise coordinate keys', async ({ page, context }) => {
  await configureLocation(page, context);
  await routeWikipedia(page);
  await page.goto(tourPath);
  await page.getByRole('button', { name: 'START TOUR & ALLOW LOCATION' }).click();
  await expect(page.locator('#gps')).toContainText(/GPS (HIGH|MEDIUM|LOW)/, { timeout: 10000 });
  const raw = await page.evaluate(() => localStorage.getItem('tour.flight.v4') || '[]');
  expect(raw).not.toMatch(/"latitude"|"longitude"|"lat"|"lng"|"coords"/i);
  expect(raw).not.toContain('29.7382');
  expect(raw).not.toContain('-98.1047');
});

test('FF-ESC-008 / service worker is on the current cache generation', async ({ page }) => {
  const response = await page.request.get('/tester/tour/sw.js');
  expect(response.ok()).toBeTruthy();
  const text = await response.text();
  expect(text).toContain('tour-field-v4-ff-rc1');
  expect(text).not.toContain('tour-field-v3');
});
