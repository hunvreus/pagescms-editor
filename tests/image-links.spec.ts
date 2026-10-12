import { expect, test } from '@playwright/test';

for (const format of ['html','markdown'] as const) {
  test(`${format} image links add, edit, retain alt text, reopen and remove without navigation`, async ({page}) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    const content = page.getByLabel('Content');
    await content.fill(format === 'html' ? '<img src="/photo.png" alt="Photo">' : '![Photo](/photo.png)');
    const image = page.locator('.ProseMirror img');
    await image.click();
    await page.getByRole('button',{name:'Link',exact:true}).click();
    await page.getByPlaceholder('https://example.com').fill('/target');
    await page.getByRole('button',{name:'Set link',exact:true}).click();
    await expect(content).toHaveValue(format === 'html' ? /href="\/target"/ : /\]\(\/target\)/);
    const saved = await content.inputValue();
    expect(saved).toContain(format === 'html' ? '<a href="/target"><img src="/photo.png" alt="Photo"></a>' : '[![Photo](/photo.png)](/target)');
    await content.fill('Temporary');await expect(page.locator('.ProseMirror')).toHaveText('Temporary');await content.fill(saved);await expect(image).toHaveCount(1);
    await image.click();
    expect(page.url()).toContain('/tests/html-policy.html');
    await page.getByRole('button',{name:'Link',exact:true}).click();
    await expect(page.getByPlaceholder('https://example.com')).toHaveValue('/target');
    await page.getByPlaceholder('https://example.com').fill('https://example.com/new');
    await page.getByRole('button',{name:'Set link',exact:true}).click();
    await expect(content).toHaveValue(/https:\/\/example.com\/new/);
    await image.click();
    await page.getByRole('button',{name:'Image alt text',exact:true}).click();
    await page.getByPlaceholder('Describe image').fill('Photo edited');
    await page.getByRole('button',{name:'Save alt text',exact:true}).click();
    await expect(image).toHaveAttribute('alt','Photo edited');
    await expect(content).toHaveValue(/https:\/\/example.com\/new/);
    await image.click();await page.getByRole('button',{name:'Link',exact:true}).click();
    await page.getByRole('button',{name:'Remove link',exact:true}).click();
    await expect(page.locator('.ProseMirror a')).toHaveCount(0);
    await expect(image).toHaveCount(1);
    const removed = await content.inputValue();
    expect(removed).not.toContain('https://example.com/new');
    await content.fill('Temporary');await expect(page.locator('.ProseMirror')).toHaveText('Temporary');await content.fill(removed);
    await expect(image).toHaveAttribute('alt','Photo edited');
    await expect(page.locator('.ProseMirror a')).toHaveCount(0);
  });
  test(`${format} linked HTML images remain editable even with an explicit keep rule`, async ({page}) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Policy').fill(JSON.stringify({keep:['a'],attributes:['data-variant']}));await page.getByLabel('Policy').blur();
    await page.getByLabel('Content').fill('<a href="/target" title="Destination" class="image-link" data-variant="outline"><img src="/photo.png" alt="Photo" title="Image title"></a>');
    const image=page.locator('.ProseMirror img');
    await image.click();await page.getByRole('button',{name:'Link',exact:true}).click();
    await page.getByPlaceholder('https://example.com').fill('/changed');await page.getByRole('button',{name:'Set link',exact:true}).click();
    await expect(page.getByLabel('Content')).toHaveValue(/href="\/changed"/);
    const saved=await page.getByLabel('Content').inputValue();
    expect(saved).toContain('Destination');expect(saved).toContain('Image title');expect(saved).toContain('class="image-link"');expect(saved).toContain('data-variant="outline"');
    await page.getByLabel('Content').fill('Temporary');await expect(page.locator('.ProseMirror')).toHaveText('Temporary');await page.getByLabel('Content').fill(saved);await expect(image).toHaveCount(1);
    await expect(page.getByLabel('Content')).toHaveValue(/href="\/changed"/);
  });
  test(`${format} unsafe image destinations cannot run on load or toolbar edits`, async ({page}) => {
    await page.goto('/tests/html-policy.html');await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Content').fill(format === 'html' ? '<a href="javascript:window.attack=1"><img src="/photo.png" alt="Photo"></a>' : '[![Photo](/photo.png)](javascript:window.attack=1)');
    await expect(page.locator('.ProseMirror a')).toHaveCount(0);
    const image=page.locator('.ProseMirror img');await expect(image).toHaveCount(1);
    await image.click();await page.getByRole('button',{name:'Link',exact:true}).click();
    await page.getByPlaceholder('https://example.com').fill('javascript:window.attack=1');await page.getByRole('button',{name:'Set link',exact:true}).click();
    await expect(page.locator('.ProseMirror a')).toHaveCount(0);
    expect(await page.evaluate(()=>(window as Window & {attack?:number}).attack)).toBeUndefined();
  });
}

test('Markdown linked images preserve parentheses, escaped alt text and both titles', async ({page}) => {
  await page.goto('/tests/html-policy.html');await page.getByLabel('Format').selectOption('markdown');
  const content=page.getByLabel('Content');
  await content.fill('[![A \\[photo\\]](</photo(1).png> "Image title")](</target(1)> "Link title")');
  const image=page.locator('.ProseMirror img');
  await expect(image).toHaveAttribute('alt','A [photo]');
  await expect(image).toHaveAttribute('title','Image title');
  await image.click();await page.getByRole('button',{name:'Image alt text',exact:true}).click();
  await page.getByPlaceholder('Describe image').fill('Edited [photo]');await page.getByRole('button',{name:'Save alt text',exact:true}).click();
  const saved=await content.inputValue();expect(saved).toContain('"Link title"');expect(saved).toContain('Edited \\[photo\\]');
  await content.fill('Temporary');await expect(page.locator('.ProseMirror')).toHaveText('Temporary');await content.fill(saved);await expect(image).toHaveCount(1);
  await image.click();await page.getByRole('button',{name:'Link',exact:true}).click();
  await expect(page.getByPlaceholder('https://example.com')).toHaveValue('/target(1)');
  await expect(image).toHaveAttribute('alt','Edited [photo]');
});
