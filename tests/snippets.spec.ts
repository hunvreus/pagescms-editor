import { expect, test } from "@playwright/test";
const alert = '<div class="alert"><svg class="lucide lucide-info" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg><h2>Heads up!</h2><section>You can add components and dependencies to your app.</section><footer><a href="/enable" class="btn" data-variant="outline">Enable</a></footer></div>';
for (const format of ["markdown", "html"] as const) {
  test(`${format} snippets insert full Basecoat HTML and survive editing and reload`, async ({page}) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Policy').fill(JSON.stringify({keep:['div.alert','div.alert section','div.alert footer'],attributes:['data-variant']}));
    await page.getByLabel('Policy').blur();
    await page.getByLabel('Snippets').fill(JSON.stringify([{label:'Alert',source:alert}]));
    await page.getByLabel('Snippets').blur();
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('/alert');
    await page.getByRole('button',{name:'Alert',exact:true}).click();
    await expect(editor.locator('div.alert > svg path')).toHaveCount(2);
    await expect(editor.locator('div.alert > h2')).toHaveText('Heads up!');
    await expect(editor.locator('footer a')).toHaveAttribute('data-variant','outline');
    await editor.locator('h2').click({clickCount:3});
    await page.keyboard.type('Heads up! edited');
    await expect(editor.locator('h2')).toHaveText('Heads up! edited');
    const source = await page.getByLabel('Content').inputValue();
    expect(source).toContain('<div class="alert">');
    expect(source).toContain('<section><p>You can add components and dependencies to your app.</p></section>');
    expect(source).not.toContain('&lt;div');
    await page.getByLabel('Content').fill(source + '\n\nTail');
    await expect(editor.locator('div.alert > svg path')).toHaveCount(2);
    await expect(editor.locator('h2')).toHaveText('Heads up! edited');
  });
  test(`${format} explicit snippet formats, filtering, security and undo`, async ({page}) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Snippets').fill(JSON.stringify([
      {label:'Markdown example',format:'markdown',source:'## Heading\n\n**Bold**'},
      {label:'Unsafe HTML',format:'html',source:'<div class="callout"><p onclick="window.attack=1">Safe</p><div class="legacy">Plain <b>words</b></div><p class="discard">Gone</p><script>window.attack=1</script><img src="x" onerror="window.attack=1"></div>'}
    ]));
    await page.getByLabel('Snippets').blur();
    const editor = page.locator('.ProseMirror');
    await editor.click(); await page.keyboard.type('/markdown'); await page.keyboard.press('Enter');
    await expect(editor.locator('h2')).toHaveText('Heading');
    await expect(editor.locator('strong')).toHaveText('Bold');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(editor.locator('h2')).toHaveCount(0);
    await page.getByLabel('Content').fill('');
    await editor.click(); await page.keyboard.type('/unsafe'); await page.keyboard.press('Enter');
    await expect(editor).toContainText('Plain words');
    await expect(editor).not.toContainText('Gone');
    await expect(editor.locator('script,[onclick],[onerror],.legacy,.discard,b')).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & {attack?:number}).attack)).toBeUndefined();
  });
}
