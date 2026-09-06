const { test, expect } = require('@playwright/test');

async function openApp(page) {
  await page.goto('/tester/freezerflow-lifefit/');
  await expect(page.getByRole('heading', { name: 'FreezerFlow LifeFit' })).toBeVisible();
}

async function selectTab(page, name) {
  await page.getByRole('button', { name }).click();
}

test('neutral demo produces one primary meal and safe leftover reheat guidance', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Load neutral demo' }).click();
  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await expect(page.locator('#decisionCard')).toContainText('Restaurant leftovers');
  await expect(page.locator('#decisionCard')).toContainText('165°F');
  await expect(page.locator('#decisionCard')).toContainText('MAKE NOW');
  await expect(page.locator('#decisionCard').getByRole('button', { name: 'Ate it / liked it' })).toHaveCount(1);
});

test('disallowed stovetop inventory fails closed', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => localStorage.setItem('freezerflow_lifefit_mvp_v1', JSON.stringify({
    profile:{methods:['microwave','air-fryer'],skill:2,effort:2,cleanup:2,household:1,lifeMode:'Solo routine',goal:'balanced'},
    items:[{id:1,name:'Skillet pasta kit',role:'complete',loc:'Freezer',servings:1,method:'stovetop',skill:2,effort:2,cleanup:2,age:2,opened:false,leftover:false,preference:70,health:60}],
    feedback:[],processedTokens:[],lastAction:null
  })));
  await page.reload();
  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await expect(page.locator('#decisionCard')).toContainText('No eligible meal');
});

test('low-confidence inferred inventory cannot drive decision until one-tap confirmation', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Save LifeFit profile' }).click();
  await selectTab(page, /2 · Inventory/);
  await page.getByLabel('Item name').fill('Salmon fillet');
  await page.getByLabel('Best simple method').selectOption('air-fryer');
  await page.getByLabel(/Added by scan/).check();
  await page.getByRole('button', { name: 'Add item' }).click();
  await expect(page.locator('#inventoryList')).toContainText('NEEDS CONFIRMATION');

  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await expect(page.locator('#decisionCard')).toContainText('No eligible meal');

  await selectTab(page, /2 · Inventory/);
  await page.getByRole('button', { name: 'Still here' }).click();
  await expect(page.locator('#inventoryList')).not.toContainText('NEEDS CONFIRMATION');

  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await expect(page.locator('#decisionCard')).toContainText('Salmon fillet');
  await expect(page.locator('#decisionCard')).toContainText('145°F');
});

test('meal completion updates inventory and undo restores it', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Load neutral demo' }).click();
  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await page.getByRole('button', { name: 'Ate it / liked it' }).click();

  await selectTab(page, /2 · Inventory/);
  await expect(page.locator('#inventoryList')).not.toContainText('Restaurant leftovers');
  await expect(page.locator('#inventoryList')).toContainText('2 serving(s)');

  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await page.getByRole('button', { name: 'Undo last update' }).click();
  await selectTab(page, /2 · Inventory/);
  await expect(page.locator('#inventoryList')).toContainText('Restaurant leftovers');
});

test('large spacious mode is a real UI state and build identity is visible', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#buildId')).toContainText('Build identity:');
  await page.getByRole('button', { name: 'Large / spacious view' }).click();
  await expect(page.locator('body')).toHaveClass(/spacious/);
});

test('almost-there meal exposes one specific shopping gap and no duplicate gap when side exists', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => localStorage.setItem('freezerflow_lifefit_mvp_v1', JSON.stringify({
    profile:{methods:['air-fryer','microwave'],skill:2,effort:2,cleanup:2,household:1,lifeMode:'Solo routine',goal:'balanced'},
    items:[{id:1,name:'Salmon fillet',role:'protein',loc:'Freezer',servings:2,method:'air-fryer',skill:2,effort:2,cleanup:1,age:1,opened:false,leftover:false,preference:80,health:80}],
    feedback:[],quickMeals:[],processedTokens:[],lastAction:null
  })));
  await page.reload();
  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await expect(page.locator('#decisionCard')).toContainText('ALMOST THERE — simple vegetable or salad.');

  await selectTab(page, /2 · Inventory/);
  await page.getByLabel('Item name').fill('Broccoli');
  await page.getByLabel('Meal role').selectOption('side');
  await page.getByLabel('Best simple method').selectOption('microwave');
  await page.getByLabel('Required kitchen confidence').selectOption('1');
  await page.getByLabel('Required effort').selectOption('1');
  await page.getByLabel('Required cleanup').selectOption('1');
  await page.getByRole('button', { name: 'Add item' }).click();
  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await expect(page.locator('#decisionCard')).toContainText('MAKE NOW — no shopping required.');
  await expect(page.locator('#decisionCard')).not.toContainText('simple vegetable or salad');
});

test('recommended meal can be saved as a persistent user Quick Meal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Load neutral demo' }).click();
  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await page.getByRole('button', { name: 'Save to Quick Meals' }).click();
  await selectTab(page, /4 · Quick Meals/);
  await expect(page.locator('#quickMealList')).toContainText('Restaurant leftovers');
  await page.reload();
  await selectTab(page, /4 · Quick Meals/);
  await expect(page.locator('#quickMealList')).toContainText('Restaurant leftovers');
});

test('local backup restores profile inventory and Quick Meals after local data loss', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Load neutral demo' }).click();
  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await page.getByRole('button', { name: 'Save to Quick Meals' }).click();

  await selectTab(page, /2 · Inventory/);
  await page.getByRole('button', { name: 'Create backup' }).click();
  const backup = await page.getByLabel('FreezerFlow backup data').inputValue();
  expect(backup).toContain('Salmon fillet');
  expect(backup).toContain('quickMeals');

  await page.evaluate(() => localStorage.removeItem('freezerflow_lifefit_mvp_v1'));
  await page.reload();
  await selectTab(page, /2 · Inventory/);
  await page.getByLabel('FreezerFlow backup data').fill(backup);
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.locator('#inventoryList')).toContainText('Salmon fillet');
  await selectTab(page, /4 · Quick Meals/);
  await expect(page.locator('#quickMealList')).toContainText('Restaurant leftovers');
});

test('cooking extra portions deducts actual ingredients and creates only the true leftovers', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => localStorage.setItem('freezerflow_lifefit_mvp_v1', JSON.stringify({
    profile:{methods:['air-fryer','microwave'],skill:2,effort:2,cleanup:2,household:1,lifeMode:'Solo routine',goal:'balanced'},
    items:[
      {id:1,name:'Salmon fillet',role:'protein',loc:'Freezer',servings:3,method:'air-fryer',skill:2,effort:2,cleanup:1,age:1,opened:false,leftover:false,preference:85,health:80},
      {id:2,name:'Broccoli',role:'side',loc:'Freezer',servings:3,method:'microwave',skill:1,effort:1,cleanup:1,age:1,opened:false,leftover:false,preference:75,health:85}
    ],
    feedback:[],quickMeals:[],processedTokens:[],lastAction:null
  })));
  await page.reload();
  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await page.getByLabel('Prepare portions').selectOption('3');
  await page.getByRole('button', { name: 'Ate it / liked it' }).click();

  await selectTab(page, /2 · Inventory/);
  await expect(page.locator('#inventoryList')).not.toContainText('Salmon fillet');
  await expect(page.locator('#inventoryList')).not.toContainText('Broccoli');
  await expect(page.locator('#inventoryList')).toContainText('Salmon fillet + Broccoli leftovers');
  await expect(page.locator('#inventoryList')).toContainText('2 serving(s)');

  await selectTab(page, /3 · Best Meal/);
  await page.getByRole('button', { name: 'Tell me what to eat next' }).click();
  await expect(page.locator('#decisionCard')).toContainText('165°F');
});

