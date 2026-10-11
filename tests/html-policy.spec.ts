import { expect, test } from "@playwright/test";

async function load(page: import("@playwright/test").Page, source: string) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Source" }).click();
  await page.getByRole("textbox").fill(source);
  await page.getByRole("tab", { name: "Editor" }).click();
  return page.locator(".ProseMirror");
}

async function output(page: import("@playwright/test").Page) {
  await page.getByRole("tab", { name: "Source" }).click();
  return page.getByRole("textbox").inputValue();
}

test("edits nested permitted containers and preserves their HTML in Markdown", async ({ page }) => {
  const editor = await load(page, '<div class="callout"><h2>Title</h2><div class="callout"><p>Description <strong>bold</strong></p></div></div>\n\nTail');
  await expect(editor.locator("div.callout")).toHaveCount(2);
  await editor.locator("h2").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  let source = await output(page);
  expect(source).toContain('<div class="callout"><h2>Title edited</h2>');
  expect(source).toContain('<div class="callout"><p>Description <strong>bold</strong></p></div>');
  await page.getByRole("tab", { name: "Editor" }).click();
  await expect(editor.locator("div.callout")).toHaveCount(2);
  await expect(editor.locator("h2")).toHaveText("Title edited");
  source = await output(page);
  expect(source).toContain("Tail");
});

test("filters nested HTML and distinguishes strip from drop", async ({ page }) => {
  const editor = await load(page, '<div class="callout"><p>Start</p><div class="legacy">Hello <strong>world</strong>!</div><p class="discard">Delete me</p><p>End</p></div>');
  await expect(editor).toContainText("Hello world!");
  await expect(editor).not.toContainText("Delete me");
  await expect(editor.locator("strong")).toHaveCount(0);
  await editor.locator("p").first().click();
  await page.keyboard.type("Edit ");
  const source = await output(page);
  expect(source).toContain("Hello world!");
  expect(source).not.toContain("legacy");
  expect(source).not.toContain("Delete me");
});

test("supports details surrounding Markdown and keeps summary editable", async ({ page }) => {
  const editor = await load(page, '<details>\n<summary>More</summary>\n\n## Heading\n\nSome **bold** text.\n\n</details>\n\nTail');
  await expect(editor.locator("details")).toHaveCount(1);
  await expect(editor.locator("summary")).toHaveText("More");
  await editor.locator("summary").click();
  await expect(editor.locator("details h2")).toHaveText("Heading");
  await editor.locator("details h2").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  const source = await output(page);
  expect(source).toContain("<details>");
  expect(source).toContain("<h2>Heading edited</h2>");
  expect(source).toContain("<strong>bold</strong>");
  await page.getByRole("tab", { name: "Editor" }).click();
  await expect(editor.locator("details")).toHaveCount(1);
});

test("preserves inline HTML, components and comments through editing", async ({ page }) => {
  const editor = await load(page, 'Hello <span class="badge">new <strong>bold</strong></span> <Badge type="info" text="New" />.\n\n<!-- Keep this comment -->\n\nTail');
  expect(await editor.locator("span.badge").allTextContents()).toEqual(["new ", "bold"]);
  await expect(editor.locator("[data-editor-html-source]")).toHaveCount(2);
  await editor.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  const source = await output(page);
  expect(source).toContain('<span class="badge">');
  expect(source).toContain('<Badge type="info" text="New" />');
  expect(source).toContain("<!-- Keep this comment -->");
  await page.getByRole("tab", { name: "Editor" }).click();
  expect(await editor.locator("span.badge").allTextContents()).toEqual(["new ", "bold"]);
  await expect(editor.locator("[data-editor-html-source]")).toHaveCount(2);
});

test("sanitizes kept descendants, inline HTML and pasted HTML", async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { attacked: number }).attacked = 0; });
  const editor = await load(page, '<div class="callout" onclick="window.attacked++" style="position:fixed"><p>Safe</p><img src="/missing.png" onerror="window.attacked++"><a href="javascript:window.attacked++">bad link</a><script>window.attacked++</script><iframe srcdoc="<script>parent.attacked++</script>"></iframe></div>\n\n<span class="badge" onmouseover="window.attacked++">inline</span>');
  await expect(editor.locator("div.callout")).toHaveCount(1);
  expect(await editor.locator("[onclick], [onerror], [onmouseover], [style], script, iframe").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { attacked: number }).attacked)).toBe(0);
  await editor.locator("p").first().click();
  await editor.evaluate(element => {
    const data = new DataTransfer();
    data.setData("text/html", '<div class="callout" onclick="window.attacked++"><p>Pasted<img src="/missing2.png" onerror="window.attacked++"></p></div>');
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    element.dispatchEvent(event);
  });
  await expect(editor).toContainText("Pasted");
  const source = await output(page);
  expect(source).not.toMatch(/onerror|onclick|onmouseover|javascript:|<script|<iframe|style=/i);
  expect(await page.evaluate(() => (window as unknown as { attacked: number }).attacked)).toBe(0);
});

test("keeps editable HTML containers and attributes in HTML output", async ({ page }) => {
  await page.goto("/tests/html-policy.html");
  const input = page.getByRole("textbox", { name: "Content" });
  await input.fill('<div class="callout" data-kind="note"><h2>Title</h2><p>Description</p></div>');
  const editor = page.locator(".ProseMirror");
  await expect(editor.locator("div.callout")).toHaveAttribute("data-kind", "note");
  await editor.locator("h2").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  await expect(input).toHaveValue(/^<div class="callout" data-kind="note"><h2>Title edited<\/h2><p>Description<\/p><\/div>(?:<p><\/p>)?$/);
  // Changing the source exercises the external-value path, not just initial parsing.
  await input.fill('<div class="callout"><p>Changed <img src="/bad.png" onerror="window.attacked=1"></p></div>');
  await expect(editor).toContainText("Changed");
  await expect(editor.locator("[onerror]")).toHaveCount(0);
});

test("renders retained unsupported HTML safely and serializes it as HTML", async ({ page }) => {
  await page.goto("/tests/html-policy.html");
  const input = page.getByRole("textbox", { name: "Content" });
  await input.fill('<figure class="callout"><figcaption>A caption</figcaption></figure><p>Tail</p>');
  const editor = page.locator(".ProseMirror");
  await expect(editor.locator("figure")).toHaveText("A caption");
  await editor.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  await expect(input).toHaveValue('<figure class="callout"><figcaption>A caption</figcaption></figure><p>Tail edited</p>');
});

test("cannot enable scripts, events or styles through permissive attributes", async ({ page }) => {
  await page.goto("/tests/html-policy.html");
  await page.getByRole("button", { name: "Permissive policy" }).click();
  const input = page.getByRole("textbox", { name: "Content" });
  await input.fill('<div onclick="window.attacked=1" style="position:fixed"><p>Safe</p><img src="/bad.png" onerror="window.attacked=1"><a href="javascript:window.attacked=1">Link</a><script>window.attacked=1</script></div>');
  const editor = page.locator(".ProseMirror");
  await expect(editor).toContainText("Safe");
  await expect(editor.locator("[onclick], [onerror], [style], script, iframe")).toHaveCount(0);
  await editor.locator("p").first().click();
  await page.keyboard.type("Edited ");
  expect(await input.inputValue()).not.toMatch(/onclick|onerror|style=|javascript:|<script/i);
  expect(await page.evaluate(() => (window as unknown as { attacked?: number }).attacked)).toBeUndefined();
});

test("does not mistake uppercase HTML for framework components", async ({ page }) => {
  const editor = await load(page, '<DIV class="callout" onclick="window.attacked=1"><p>Safe</p><SCRIPT>window.attacked=1</SCRIPT><IMG src="/bad.png" onerror="window.attacked=1"></DIV>\n\nTail');
  await expect(editor.locator("div.callout")).toHaveCount(1);
  await expect(editor.locator("[data-editor-html-source]")).toHaveCount(0);
  await expect(editor.locator("[onclick], [onerror], script")).toHaveCount(0);
  await editor.locator("p").last().click();
  await page.keyboard.type("Edit ");
  expect(await output(page)).not.toMatch(/onclick|onerror|<script/i);
});

test("preserves unsupported syntax nested in a container as visible source", async ({ page }) => {
  const original = '<div class="callout"><p>Text <Badge text="New" /></p><!-- Nested comment --></div>';
  const editor = await load(page, original + "\n\nTail");
  await expect(editor.locator("[data-editor-html-source]")).toHaveText(original);
  await editor.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type("Edit ");
  expect(await output(page)).toContain(original);
});

test("source editing cannot bypass safe output", async ({ page }) => {
  const editor = await load(page, '<Badge text="New" />\n\nTail');
  page.once("dialog", dialog => dialog.accept('<img src="/bad.png" onerror="window.attacked=1">'));
  await editor.locator("[data-editor-html-source]").dblclick();
  const source = await output(page);
  expect(source).toContain('```html\n<img src="/bad.png" onerror="window.attacked=1">\n```');
  await page.getByRole("tab", { name: "Editor" }).click();
  await expect(editor.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { attacked?: number }).attacked)).toBeUndefined();
});

test("keeps inline HTML in its paragraph without introducing block boundaries", async ({ page }) => {
  const editor = await load(page, 'Hello <span class="badge">new</span> world.\n\nTail');
  await expect(editor.locator("p").first()).toHaveText("Hello new world.");
  await expect(editor.locator("p")).toHaveCount(2);
  await editor.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  const source = await output(page);
  expect(source).toContain('Hello <span class="badge">new</span> world.');
});

test("parses original Markdown in containers without double-escaping or double-parsing", async ({ page }) => {
  const editor = await load(page, '<div class="callout">\n\n> Quote\n\n```js\na < b && c\n```\n\n<span class="badge">\\*literal\\*</span>\n\n</div>\n\nTail');
  await expect(editor.locator("blockquote")).toHaveText("Quote");
  await expect(editor.locator("pre code")).toHaveText("a < b && c");
  await expect(editor.locator("span.badge")).toHaveText("*literal*");
  await expect(editor.locator("span.badge em")).toHaveCount(0);
  await editor.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  const source = await output(page);
  expect(source).toContain("<blockquote><p>Quote</p></blockquote>");
  expect(source).toContain("a &lt; b &amp;&amp; c");
  await page.getByRole("tab", { name: "Editor" }).click();
  await expect(editor.locator("pre code")).toHaveText("a < b && c");
});

test("escapes HTML-looking plain text in Markdown output", async ({ page }) => {
  const editor = await load(page, '&lt;img src=x onerror=window.attacked=1&gt;\n\nTail');
  await expect(editor.locator("img")).toHaveCount(0);
  await editor.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  const source = await output(page);
  expect(source).not.toContain("<img");
  await page.getByRole("tab", { name: "Editor" }).click();
  await expect(editor).toContainText('<img src=x onerror=window.attacked=1>');
  await expect(editor.locator("img")).toHaveCount(0);
});

test("class-selector keeps do not require a duplicate class permission", async ({ page }) => {
  await page.goto("/tests/html-policy.html");
  const input = page.getByRole("textbox", { name: "Content" });
  await input.fill('<div class="callout extra" id="note"><p>Text</p></div>');
  const editor = page.locator(".ProseMirror");
  await expect(editor.locator("div.callout")).toHaveAttribute("id", "note");
  await editor.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  await expect(input).toHaveValue(/class="callout extra" id="note"/);
});

test("preserves Video component syntax despite its native HTML name collision", async ({ page }) => {
  const editor = await load(page, 'Before <Video id="abcdef" /> after.\n\nTail');
  await expect(editor.locator("[data-editor-html-source]")).toHaveText('<Video id="abcdef" />');
  await editor.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  expect(await output(page)).toContain('Before <Video id="abcdef" /> after.');
});

for (const format of ['html', 'markdown'] as const) {
  test(`${format}: nested lists, tables, links and Unicode survive repeated edits`, async ({ page }) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    const input = page.getByRole('textbox', { name: 'Content', exact: true });
    await input.fill('<div class="callout" id="outer"><h2>你好 &amp; café</h2><ul><li><p>First <em>item</em></p><ul><li><p>Nested</p></li></ul></li></ul><table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table><p><a href="https://example.com/?a=1&amp;b=2">Link</a></p><div class="callout"><p>Inner</p></div></div>\n\n<p>Tail</p>');
    const editor = page.locator('.ProseMirror');
    for (let cycle = 0; cycle < 3; cycle++) {
      await expect(editor.locator('div.callout')).toHaveCount(2);
      await expect(editor.locator('h2')).toHaveText('你好 & café' + ' edited'.repeat(cycle));
      await expect(editor.locator('li li')).toHaveText('Nested');
      await expect(editor.locator('table td')).toHaveCount(2);
      await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com/?a=1&b=2');
      await editor.locator('h2').click();
      if (!await page.evaluate(() => window.getSelection()?.isCollapsed)) await page.keyboard.press('ArrowRight');
      await page.keyboard.press('End');
      await page.keyboard.type(' edited');
      await expect(editor.locator('h2')).toHaveText('你好 & café' + ' edited'.repeat(cycle + 1));
      await expect(input).toHaveValue(new RegExp('你好 &amp; café' + ' edited'.repeat(cycle + 1)));
      const saved = await input.inputValue();
      await input.fill('Temporary');
      await expect(editor).toContainText('Temporary');
      await input.fill(saved);
      await expect(editor.locator('h2')).toHaveText('你好 & café' + ' edited'.repeat(cycle + 1));
    }
    await expect(editor.locator('h2')).toHaveText('你好 & café edited edited edited');
    expect(await input.inputValue()).toContain('id="outer"');
  });

  test(`${format}: selector precedence and descendant rules use the original tree`, async ({ page }) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Policy').fill(JSON.stringify({keep:['div[data-kind="note"]', 'span'], strip:['.plain', '.both'], drop:['.remove', '.both', 'div > p:nth-child(2)'], attributes:['data-kind']}));
    await page.getByLabel('Policy').press('Tab');
    const input = page.getByRole('textbox', { name: 'Content', exact: true });
    await input.fill('<div data-kind="note" data-secret="no"><p class="remove">First</p><p>Second</p><p>Third</p><span class="plain">Plain <strong>bold</strong><i class="remove">Hidden</i></span><span class="both">Gone</span></div>\n\n<p>Tail</p>');
    const editor = page.locator('.ProseMirror');
    await expect(editor).toContainText('Third');
    await expect(editor).toContainText('Plain bold');
    await expect(editor).not.toContainText(/First|Second|Hidden|Gone/);
    await expect(editor.locator('strong')).toHaveCount(0);
    await expect(editor.locator('[data-secret]')).toHaveCount(0);
    await editor.locator('p').last().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' edited');
    expect(await input.inputValue()).toContain('data-kind="note"');
    expect(await input.inputValue()).not.toMatch(/First|Second|Hidden|Gone|data-secret/);
  });

  test(`${format}: pasted text stays text while pasted HTML is filtered`, async ({ page }) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Content', {exact:true}).fill('Start');
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await editor.evaluate(element => {
      const data = new DataTransfer();
      data.setData('text/plain', '<img onerror="window.attack=1">');
      const event = new ClipboardEvent('paste', {bubbles:true, cancelable:true});
      Object.defineProperty(event, 'clipboardData', {value:data});
      element.dispatchEvent(event);
    });
    await expect(editor).toContainText('<img onerror="window.attack=1">');
    await expect(editor.locator('img')).toHaveCount(0);
    await editor.evaluate(element => {
      const data = new DataTransfer();
      data.setData('text/html', '<div class="callout"><p>Pasted <strong>bold</strong></p><p class="discard">Delete</p><div class="legacy">Plain <em>words</em></div></div>');
      const event = new ClipboardEvent('paste', {bubbles:true, cancelable:true});
      Object.defineProperty(event, 'clipboardData', {value:data});
      element.dispatchEvent(event);
    });
    await expect(editor).toContainText('Pasted bold');
    await expect(editor.locator('div.callout')).toHaveCount(1);
    await expect(editor).not.toContainText('Delete');
    await expect(editor.locator('em')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as {attack?:number}).attack)).toBeUndefined();
  });
}

const attacks = [
  '<a href="jav&#x61;script:window.attack=1">Link</a><img src="x" onerror="window.attack=1">',
  '<svg><a xlink:href="javascript:window.attack=1">SVG</a></svg><math><mtext><img src=x onerror="window.attack=1"></mtext></math>',
  '<iframe srcdoc="<script>parent.attack=1</script>"></iframe><object data="javascript:window.attack=1"></object><embed src="data:text/html,test">',
  '<base href="https://evil.example"><meta http-equiv="refresh" content="0;url=https://evil.example"><style>body{display:none}</style>',
  '<span is="danger-widget" data-editor-html-source="spoof" style="background:url(https://evil.example)">Text</span><a href="java\nscript:window.attack=1">Link</a>',
];
for (const [index, payload] of attacks.entries()) {
  test(`attack corpus ${index + 1}: loading, editing and reparsing never activates unsafe HTML`, async ({page}) => {
    const editor = await load(page, `<div class="callout"><p>Safe</p>${payload}</div>\n\nTail`);
    await expect(editor.locator('script,svg,math,iframe,object,embed,base,meta,style,[onerror],[is],[style]')).toHaveCount(0);
    await expect(editor.locator('[data-editor-html-source]')).toHaveCount(0);
    await editor.locator('p').last().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' edited');
    const saved = await output(page);
    expect(saved).not.toMatch(/javascript:|onerror=|<svg|<math|<iframe|<object|<embed|<base|<meta|<style|data-editor-html-source|\sis=/i);
    await page.getByRole('tab', {name:'Editor'}).click();
    expect(await page.evaluate(() => (window as unknown as {attack?:number}).attack)).toBeUndefined();
  });
}

test('invalid selectors are ignored without breaking valid rules', async ({page}) => {
  await page.goto('/tests/html-policy.html');
  await page.getByLabel('Policy').fill(JSON.stringify({keep:['[', 'div.callout'], drop:[':broken(', '.discard']}));
  await page.getByLabel('Policy').press('Tab');
  await page.getByLabel('Content',{exact:true}).fill('<div class="callout"><p>Visible</p><p class="discard">Gone</p></div>');
  await expect(page.locator('.ProseMirror div.callout')).toHaveText('Visible');
});

for (const markup of ['<div class="callout"><p>Unclosed', '<div class="callout"><h2>Title</h2><p>One</div></p><p>Tail</p>', '<div class="callout" title="a > b"><p>A &amp; B &lt; C</p></div>']) {
  test(`malformed or quoted HTML remains usable: ${markup}`, async ({page}) => {
    const errors:string[]=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/tests/html-policy.html');
    const input=page.getByLabel('Content',{exact:true});
    await input.fill(markup);
    const editor=page.locator('.ProseMirror');
    await expect(editor).not.toBeEmpty();
    await editor.locator('p').last().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' edited');
    const saved=await input.inputValue();
    expect(saved).toContain('edited');
    await input.fill('reset');
    await input.fill(saved);
    await expect(editor).toContainText('edited');
    expect(errors).toEqual([]);
  });
}

test('source dialog cancellation and undo preserve original components', async ({page}) => {
  const editor = await load(page, '<Badge text="Original" />\n\nTail');
  page.once('dialog', dialog => dialog.dismiss());
  await editor.locator('[data-editor-html-source]').dblclick();
  await expect(editor.locator('[data-editor-html-source]')).toHaveText('<Badge text="Original" />');
  page.once('dialog', dialog => dialog.accept('<Badge text="Changed" />'));
  await editor.locator('[data-editor-html-source]').dblclick();
  await expect(editor.locator('[data-editor-html-source]')).toHaveText('<Badge text="Changed" />');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(editor.locator('[data-editor-html-source]')).toHaveText('<Badge text="Original" />');
  expect(await output(page)).toContain('<Badge text="Original" />');
});


test('focus and editability changes do not rewrite untouched Markdown ending in a source node', async ({page}) => {
  await page.goto('/tests/html-policy.html');
  await page.getByLabel('Format').selectOption('markdown');
  const input=page.getByLabel('Content',{exact:true});
  const original='<div class="callout">\n\n**Original spacing**\n\n</div>\n\n<!-- comment -->\n\n<Video id="abc" />\n';
  await input.fill(original);
  const editor=page.locator('.ProseMirror');
  await expect(editor.locator('strong')).toHaveText('Original spacing');
  await editor.locator('strong').click();
  await page.getByRole('button',{name:'Toggle disabled'}).click();
  await expect(editor).toHaveAttribute('contenteditable','false');
  await expect(input).toHaveValue(original);
  await page.getByRole('button',{name:'Toggle disabled'}).click();
  await expect(editor).toHaveAttribute('contenteditable','true');
  await expect(input).toHaveValue(original);
  await editor.locator('strong').click();
  await page.keyboard.type(' changed');
  await expect(input).not.toHaveValue(original);
  await expect(input).toHaveValue(/changed/);
});

test('details editor-only open state never changes saved HTML on focus or toggling', async ({page}) => {
  await page.goto('/tests/html-policy.html');
  const input=page.getByLabel('Content',{exact:true});
  await input.fill('<details><summary>More</summary><p>Text</p></details>');
  const editor=page.locator('.ProseMirror');
  await editor.locator('summary').click();
  await expect(editor.locator('details')).toHaveAttribute('open','');
  await expect(input).toHaveValue('<details><summary>More</summary><p>Text</p></details>');
  await editor.locator('p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' changed');
  await expect(input).toHaveValue(/Text changed/);
  expect(await input.inputValue()).not.toContain('open=');
});


test('multiple editors use independent Markdown parsers and policies', async ({page}) => {
  await page.goto('/tests/html-policy.html');
  await page.getByLabel('Format').selectOption('markdown');
  await page.getByRole('button',{name:'Add second editor'}).click();
  const content=page.getByLabel('Content',{exact:true});
  const second=page.getByLabel('Second content');
  await content.fill('<div class="callout"><p>First retained</p></div>\n\nTail one');
  await second.fill('<div class="callout"><p>Should vanish</p></div>\n\n<div class="second"><p>Second retained</p></div>\n\nTail two');
  const editors=page.locator('.ProseMirror');
  await expect(editors.nth(0).locator('div.callout')).toHaveText('First retained');
  await expect(editors.nth(1)).not.toContainText('Should vanish');
  await expect(editors.nth(1).locator('div.second')).toHaveText('Second retained');
  for(const [index,input] of [content,second].entries()) {
    await editors.nth(index).locator('p').last().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' changed');
    await expect(input).toHaveValue(/changed/);
  }
  expect(await content.inputValue()).toContain('<div class="callout">');
  expect(await second.inputValue()).toContain('<div class="second">');
  expect(await second.inputValue()).not.toContain('Should vanish');
});

for (const format of ['html','markdown'] as const) {
  test(`${format}: positional drop rules run once when loading a retained atomic fragment`, async ({page}) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Policy').fill(JSON.stringify({keep:['figure'],drop:['figure > p:first-child']}));
    await page.getByLabel('Policy').press('Tab');
    const input=page.getByLabel('Content',{exact:true});
    await input.fill('<figure><p>Remove</p><p>Second</p><p>Third</p></figure>\n\n<p>Tail</p>');
    const editor=page.locator('.ProseMirror');
    await expect(editor.locator('figure')).toHaveText('SecondThird');
    await editor.locator('p').last().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' edited');
    expect(await input.inputValue()).toContain('<figure><p>Second</p><p>Third</p></figure>');
  });
}

for (const format of ['html','markdown'] as const) {
  test(`${format}: paste as plain text ignores permitted HTML wrappers`, async ({page}) => {
    await page.goto('/tests/html-policy.html');
    await page.getByLabel('Format').selectOption(format);
    await page.getByLabel('Content',{exact:true}).fill('Start');
    const editor=page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.down('Shift');
    await editor.evaluate(element=>{
      const data=new DataTransfer();
      const html='<div class="callout"><p>Plain</p></div>';
      data.setData('text/html',html);
      data.setData('text/plain',html);
      const event=new ClipboardEvent('paste',{bubbles:true,cancelable:true});
      Object.defineProperty(event,'clipboardData',{value:data});
      element.dispatchEvent(event);
    });
    await page.keyboard.up('Shift');
    await expect(editor.locator('div.callout')).toHaveCount(0);
    await expect(editor).toContainText('<div class="callout"><p>Plain</p></div>');
  });
}
