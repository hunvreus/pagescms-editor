import { expect, test } from "@playwright/test";

const imageSource =
  "![](</api/media-preview/pagescms/Test/main/default/src/uploads/something%20new/image%20(1).jpg>)\n\nHELLO";

test("keeps image destinations valid through editing and source round trips", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Source" }).click();
  await page.getByRole("textbox").fill(imageSource);
  await page.getByRole("tab", { name: "Editor" }).click();

  const editor = page.locator(".ProseMirror");
  await expect(editor.locator("img")).toHaveCount(1);
  await editor.press("Enter");
  await editor.pressSequentially("X");
  await expect(editor.locator("img")).toHaveCount(1);

  await page.getByRole("tab", { name: "Source" }).click();
  await expect(page.getByRole("textbox")).toHaveValue(
    "X\n\n![](</api/media-preview/pagescms/Test/main/default/src/uploads/something%20new/image%20(1).jpg>)\n\nHELLO",
  );

  await page.getByRole("tab", { name: "Editor" }).click();
  await expect(page.locator(".ProseMirror img")).toHaveCount(1);
});

test("shows a placeholder only on the active empty paragraph", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Source" }).click();
  await page.getByRole("textbox").fill(imageSource);
  await page.getByRole("tab", { name: "Editor" }).click();

  const editor = page.locator(".ProseMirror");
  await editor.press("Enter");
  await editor.press("Enter");
  await editor.press("Enter");

  await expect(
    editor.locator('.is-empty[data-placeholder="Press \'/\' for commands"]'),
  ).toHaveCount(1);
});

test("opens slash commands without rolling back typed input", async ({ page }) => {
  await page.goto("/");

  const editor = page.locator(".ProseMirror");
  await editor.press("Enter");
  await editor.pressSequentially("/Image");

  await expect(page.getByRole("button", { name: "Image", exact: true })).toBeVisible();
  await expect(editor).toContainText("/Image");
});


test("does not emit content changes when mounting or remounting the editor", async ({ page }) => {
  const original = "![Photo](</photo.png>)\n\nUntouched\n";
  await page.goto("/");
  await page.getByRole("tab", { name: "Source" }).click();
  await page.getByRole("textbox").fill(original);
  await page.getByRole("tab", { name: "Editor" }).click();
  await expect(page.locator(".ProseMirror img")).toHaveCount(1);
  await page.getByRole("tab", { name: "Source" }).click();
  await expect(page.getByRole("textbox")).toHaveValue(original);
  await page.getByRole("tab", { name: "Editor" }).click();
  await expect(page.locator(".ProseMirror img")).toHaveCount(1);
  await page.getByRole("tab", { name: "Source" }).click();
  await expect(page.getByRole("textbox")).toHaveValue(original);
  await page.getByRole("tab", { name: "Editor" }).click();
  await page.locator(".ProseMirror").fill("An actual edit");
  await page.getByRole("tab", { name: "Source" }).click();
  await expect(page.getByRole("textbox")).toHaveValue(/An actual edit/);
});
