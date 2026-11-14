const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Log all console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`PAGE ERROR: ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`PAGE EXCEPTION: ${error.message}`);
  });

  console.log('Navigating to login...');
  await page.goto('http://localhost:5175/login');

  await page.fill('input[type="email"]', 'admin@clearmind.ph');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');

  console.log('Waiting for navigation...');
  await page.waitForNavigation();

  console.log('Going to assessments...');
  await page.goto('http://localhost:5175/psychometrician/assessments');

  // Wait for the table/directory to load
  await page.waitForTimeout(3000);

  console.log('Clicking the FO-03 Caregiver Checklist View Form button...');
  // Find a button that opens FO-03
  // Since we don't know the exact selector, we'll look for "View Form" or "Administer"
  const buttons = await page.locator('button:has-text("View Form"), button:has-text("Answer")');
  if (await buttons.count() > 0) {
    await buttons.first().click();
  } else {
    console.log('No buttons found to open an assessment.');
  }

  await page.waitForTimeout(2000);

  console.log('Clicking Yes in FO-03...');
  const yesButton = await page.locator('button:has-text("Yes")').first();
  if (await yesButton.count() > 0) {
    await yesButton.click();
  } else {
    console.log('No Yes button found');
  }

  await page.waitForTimeout(2000);

  console.log('Clicking Guardian in FO-03...');
  const guardianButton = await page.locator('button:has-text("Guardian")').first();
  if (await guardianButton.count() > 0) {
    await guardianButton.click();
  } else {
    console.log('No Guardian button found');
  }

  await page.waitForTimeout(2000);

  console.log('Done.');
  await browser.close();
})();
