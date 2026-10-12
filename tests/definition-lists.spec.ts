import { expect, test } from '@playwright/test';

const source = '<dl class="definitions"><dt>Timeout</dt><dt>Delay</dt><dd>Maximum <strong>wait</strong>.</dd><dd><p>Another description.</p><dl><dt>Nested</dt><dd>Nested description.</dd></dl></dd><dt>Limit</dt><dd><p>See <a href="/more">more</a>.</p></dd></dl>';
for (const format of ['html', 'markdown']) {
  test(`${format} definition lists edit, split terms and retain nested structure and typography`, async ({page}) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Policy').fill(JSON.stringify({keep:['dl']}));
    await page.getByLabel('Policy').blur();
    await page.getByLabel('Content').fill(source);
    const editor = page.locator('.ProseMirror');
    const list = editor.locator('dl.definitions');
    await expect(list.locator(':scope > dt')).toHaveCount(3);
    await expect(list.locator(':scope > dd')).toHaveCount(3);
    await expect(list.locator('dl dt')).toHaveText('Nested');
    await expect(list.locator('[contenteditable="false"]')).toHaveCount(0);
    await expect(list.locator('dt').first()).toHaveCSS('font-weight','500');
    expect(await list.locator('dd').first().evaluate(el=>parseFloat(getComputedStyle(el).paddingInlineStart))).toBeGreaterThan(0);
    await list.locator('dt').first().click({clickCount:3});
    await page.keyboard.type('Timeout edited');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Alias');
    await expect(list.locator(':scope > dt')).toHaveCount(4);
    await expect(list.locator(':scope > dt').nth(1)).toHaveText('Alias');
    await list.locator('dd > p').first().click({clickCount:3});
    await page.keyboard.type('Description edited');
    const saved = await page.getByLabel('Content').inputValue();
    expect(saved).toContain('<dt>Timeout edited</dt><dt>Alias</dt>');
    expect(saved).toContain('<dd><p>Description edited</p></dd>');
    await page.getByLabel('Content').fill('Temporary');
    await page.getByLabel('Content').fill(saved);
    await expect(list.locator(':scope > dt').first()).toHaveText('Timeout edited');
    await expect(list.locator('dl dt')).toHaveText('Nested');
    await expect(list.locator('a')).toHaveAttribute('href','/more');
  });
  test(`${format} definition list policies and sanitization apply to descendants`, async ({page}) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Policy').fill(JSON.stringify({keep:['dl'],drop:['.discard'],strip:['.legacy'],attributes:['onclick']}));
    await page.getByLabel('Policy').blur();
    await page.getByLabel('Content').fill('<dl><dt onclick="window.attack=1">Term</dt><dd><p class="legacy">Plain <b>words</b></p><p class="discard">Gone</p><img src="x" onerror="window.attack=1"></dd></dl>');
    const editor=page.locator('.ProseMirror');
    await expect(editor.locator('dl dt')).toHaveText('Term');
    await expect(editor).toContainText('Plain words');
    await expect(editor).not.toContainText('Gone');
    await expect(editor.locator('[onclick],[onerror],.legacy,.discard,b')).toHaveCount(0);
    expect(await page.evaluate(()=>(window as Window & {attack?:number}).attack)).toBeUndefined();
  });
}
