import { test, expect } from '@playwright/test';

const path = '/tester/buypoint/';

test('unified first-time journey exposes every supported input without old Fairsight fields', async ({ page }) => {
  await page.goto(path);
  await expect(page).toHaveTitle('BuyPoint Unified Concept Test');
  await expect(page.locator('[data-buy-point-release="BUYPOINT-UNIFIED-RC2"]')).toBeVisible();
  for (const name of ['Type','Photo','Barcode','Voice','URL']) await expect(page.getByRole('button',{name:new RegExp(name,'i')})).toBeVisible();
  await expect(page.getByText(/price you see/i)).toHaveCount(0);
  await expect(page.getByText(/store or website/i)).toHaveCount(0);
  await expect(page.getByText(/recent normal price, if known/i)).toHaveCount(0);
});

test('known product resolves exact quantity, normalized offers and system BuyPoint', async ({ page }) => {
  await page.goto(path);
  await page.getByRole('button',{name:'FIND MY BUYPOINT'}).click();
  await expect(page.getByText('EXACT MATCH')).toBeVisible();
  await expect(page.getByText(/750 mL · Italy/)).toBeVisible();
  await expect(page.locator('#verdict')).toHaveText(/BUY|WAIT|WATCH/);
  await expect(page.locator('#recommended')).toHaveText('$10.69');
  await expect(page.getByText(/normalized to 750 mL/i)).toBeVisible();
  await expect(page.getByText(/shipping and coupon effects are not silently assumed/i)).toBeVisible();
});

test('unknown product fails closed instead of forcing manual research', async ({ page }) => {
  await page.goto(path);
  await page.locator('#query').fill('Unrecognized product 987654');
  await page.getByRole('button',{name:'FIND MY BUYPOINT'}).click();
  await expect(page.locator('#entryStatus')).toContainText(/No verified exact match/);
  await expect(page.locator('#result')).toHaveClass(/hidden/);
});

test('saved item and watch intent persist in My BuyPoint', async ({ page }) => {
  await page.goto(path);
  await page.getByRole('button',{name:'FIND MY BUYPOINT'}).click();
  page.on('dialog', d=>d.accept());
  await page.getByRole('button',{name:'WATCH PRICE & STOCK'}).click();
  await expect(page.locator('#savedCount')).toHaveText('1');
  await page.getByRole('button',{name:/My BuyPoint/}).click();
  await expect(page.getByText(/Price & stock watch requested/)).toBeVisible();
});

test('mobile viewport preserves primary flow and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(path);
  await expect(page.getByRole('button',{name:'FIND MY BUYPOINT'})).toBeVisible();
  const overflow = await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});


test('isolated provider result replaces the dated fixture and preserves evidence fields', async ({ page }) => {
  await page.addInitScript(() => { window.BUYPOINT_PROVIDER_URL = 'https://provider.example'; });
  await page.route('https://provider.example/api/buypoint/resolve', async route => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const posted = request.postDataJSON();
    expect(posted.input.type).toBe('text');
    await route.fulfill({
      status: 200,
      headers: {'access-control-allow-origin':'*','content-type':'application/json'},
      body: JSON.stringify({
        release:'BUYPOINT-PROVIDER-RC1',
        result:{
          status:'matched',
          product:{name:'Example Coffee',brand:'Example',variant:'Dark roast',quantity_value:12,quantity_unit:'oz',gtin:'000123'},
          offers:[{retailer:'Evidence Store',price:8.49,currency:'USD',package_quantity:'12 oz',unit_price:0.7075,shipping:'Free pickup',coupon:'None evidenced',availability:'In stock',source_url:'https://retailer.example/item',observed_at:'2026-09-04',confidence:'high'}],
          recommended_buy_price:8,
          guidance:'WATCH',
          reason:'The current cited offer is above the recommended price.',
          back_in_stock_supported:false,
          limitations:[]
        },
        sources:['https://retailer.example/item']
      })
    });
  });
  await page.goto(path);
  await page.locator('#query').fill('Example Coffee 12 oz');
  await page.getByRole('button',{name:'FIND MY BUYPOINT'}).click();
  await expect(page.locator('#productName')).toHaveText('Example Coffee');
  await expect(page.locator('#recommended')).toHaveText('$8.00');
  await expect(page.locator('#verdict')).toHaveText('WATCH');
  await expect(page.locator('#providerNotice')).toContainText('LIVE private-provider result');
  await expect(page.getByText('Evidence Store')).toBeVisible();
});

test('live provider failure does not fall back to a fixture answer', async ({ page }) => {
  await page.addInitScript(() => { window.BUYPOINT_PROVIDER_URL = 'https://provider.example'; });
  await page.route('https://provider.example/api/buypoint/resolve', route => route.fulfill({
    status:503,
    headers:{'access-control-allow-origin':'*','content-type':'application/json'},
    body:JSON.stringify({error:'provider_not_configured'})
  }));
  await page.goto(path);
  await page.getByRole('button',{name:'FIND MY BUYPOINT'}).click();
  await expect(page.locator('#entryStatus')).toContainText(/provider_not_configured/);
  await expect(page.locator('#result')).toHaveClass(/hidden/);
});
