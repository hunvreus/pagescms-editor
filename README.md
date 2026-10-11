# Editor

`Editor` is a format-aware TipTap component (`HTML` or `Markdown`) with:
- Bubble menu formatting controls
- Slash commands
- Links, images (including ALT editing), and tables

Mounting the editor or changing `disabled` does not emit `onChange`; content changes do.

Component export:
- `Editor` from `src/components/ui/editor.tsx`

## Local Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run registry:build
```

`npm run build` now:
- builds client assets
- builds SSR entry
- prerenders `/` into `dist/index.html`

## Styling Model

- Uses shadcn-style Tailwind utility classes and semantic tokens.
- Uses local shadcn component files where needed (`button`, `tabs`).
- Demo/base styles live in `src/index.css`.

## Registry

Registry source:
- `registry.json`
- `registry/default/editor/*`

Build registry artifacts:

```bash
npm run registry:build
```

Generated files:
- `public/r/registry.json`
- `public/r/editor.json`

## Install In Another Project

Install this component directly from GitHub:

```bash
npx shadcn@latest add https://editor.pagescms.org/r/editor.json
```

## Basic Usage

```tsx
import { useState } from "react";
import { Editor } from "@/components/ui/editor";

export function Example() {
  const [value, setValue] = useState("");

  return (
    <Editor
      value={value}
      onChange={setValue}
    />
  );
}
```

Notes:
- Default `format` is `"html"`.
- `format` supports `"markdown"` and `"html"`.
- `className` applies classes to the root wrapper (`cn-editor`).
- `editorClassName` applies classes to the WYSIWYG surface only.

## HTML policy

`markdownHtml` uses CSS selectors to control HTML in Markdown and HTML modes:

```tsx
<Editor
  format="markdown"
  value={value}
  onChange={setValue}
  markdownHtml={{
    keep: ["div.callout", "details", "summary", "span.badge", "figure"],
    strip: ["div.legacy-wrapper"],
    drop: [".discard"],
    attributes: ["data-kind"],
  }}
/>
```

- `keep` retains matching supported wrappers. `div`, `section`, `article`, `aside`,
  `details`, and `summary` contain editable editor content; retained `span` elements
  are editable marks. Other permitted browser HTML, such as `figure`, is displayed
  as an atomic fragment; double-click it to edit its HTML.
- `strip` replaces a matching element and its descendants with plain text, losing
  nested formatting. Descendants matching `drop` are removed before extracting text.
- `drop` removes a matching element and its contents.
- `attributes` permits additional attributes on retained wrappers/fragments, such
  as `data-kind`. Classes, IDs, and standard link, image, table, list, and details
  attributes are already permitted. Class preservation keeps every class value;
  selectors choose elements, not attribute values.

Precedence is `drop`, then `strip`, then `keep`, then normal Tiptap parsing.
Rules apply to nested elements as well as roots. Scripts, event handlers, inline
styles, unsafe URLs, frames, MathML, and form controls remain forbidden,
including when explicitly matched by `keep`. HTML source, clipboard input, rendered
fragments, and edited fragment output are sanitized with DOMPurify. Source mode
remains a source editor: switching modes alone does not rewrite the stored value;
policy-filtered output is emitted when editing the visual editor.

Controlled values may arrive asynchronously: acknowledgments of earlier emitted
edits do not replace newer typing. Explicit external replacements still reload
the editor content.

Static SVG icons are supported by default in HTML and Markdown, without an extra
option or `keep` selector. Drawing elements and SVG attributes such as `viewBox`,
`fill`, and `stroke` survive. Scripts, events, embedded HTML, animation, links,
external resources, and unsupported SVG elements are removed even with permissive
attribute configuration. Icons are rendered fragments with double-click source
editing. SVG support is for static artwork, not interactive SVG applications.

In Markdown, retained containers serialize their entire contents as HTML. Markdown
inside an explicitly kept container is parsed into supported editor content; output
normalizes that content to HTML. Inline Markdown inside retained spans is supported.
Whitespace, attribute order, and wrapper boundaries can normalize during editing.

HTML comments and unknown capitalized component syntax such as `<Badge text="New" />`
are preserved in Markdown as visible, selectable source items. Double-click to edit
their source. A fragment containing nested comments or components falls back to a
source item for the whole fragment; its interior is not visually editable. These
opaque items are source rather than editable HTML, so nested selector rules are not
applied inside them. Root `strip`/`drop` rules still apply. Source containing unsafe
browser HTML exports as a code literal. HTML-mode source items serialize as escaped
code, not executable components. Shortcode/MDX expression parsing, snippets, embeds,
arbitrary extensions, and custom CSS are outside this implementation.

Selector rules run when content enters the visual editor. Rendering and saving do not apply them again. Prefer class or attribute selectors for stable policies: positional selectors can match different children when filtered content is reopened.

The policy is supplied when mounting the editor. Remount when changing its rules.

## Image Workflows

`Editor` supports both pre-uploaded URLs and local file uploads.

- Slash image selector:
  - Return `{ kind: "url", src }` from `onRequestImage` if the image is already uploaded.
  - Return `{ kind: "file", file }` from `onRequestImage` to run optimistic upload flow.
- Paste/drop:
  - Enable with `enableImagePasteDrop`.
  - Provide `onUploadImage` to upload files and return final `{ src }`.
  - Optional fallback with `imageFallback="data-url"` for base64 insertion.
- Swap behavior:
  - The editor preloads the final uploaded URL before replacing the temporary `blob:` preview.
  - If preload fails or times out, the editor keeps the temporary preview and marks the image with an upload error state.
- Pending uploads:
  - Use `onPendingUploadsChange` to disable autosave/publish while uploads are in progress.

## Implement Your Own Source Toggle

`Editor` is intentionally focused on rich-text editing. If you need a source view, keep a single shared `value` state and switch between `Editor` and your own text input.

```tsx
import { useState } from "react";
import { Editor } from "@/components/ui/editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type View = "editor" | "source";

export function EditorWithSourceToggle() {
  const [view, setView] = useState<View>("editor");
  const [value, setValue] = useState("");

  return (
    <Tabs value={view} onValueChange={(next) => setView(next as View)} className="w-full">
      <TabsList>
        <TabsTrigger value="editor">Editor</TabsTrigger>
        <TabsTrigger value="source">Source</TabsTrigger>
      </TabsList>
      <TabsContent value="editor">
        <Editor
          value={value}
          onChange={setValue}
          format="markdown"
        />
      </TabsContent>
      <TabsContent value="source">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-64 font-mono"
        />
      </TabsContent>
    </Tabs>
  );
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | `""` | Current editor content. |
| `onChange` | `(value: string) => void` | - | Called whenever content changes. |
| `format` | `"markdown" \| "html"` | `"html"` | Parsing and output format. |
| `disabled` | `boolean` | `false` | Disables editing and toolbar actions. |
| `enableImages` | `boolean` | `true` | Enables image-related behaviors (slash command and image actions). |
| `enableImagePasteDrop` | `boolean` | `false` | Enables image file paste and drag/drop insertion. |
| `onRequestImage` | `(ctx) => { kind: "url", src, alt?, title? } \| { kind: "file", file, alt?, title? } \| null \| Promise<...>` | - | Called by Image slash command. Return a URL result for already-uploaded images or a file result for local upload flow. |
| `onUploadImage` | `(file, ctx) => { src, alt?, title? } \| null \| Promise<...>` | - | Upload hook for local files (paste/drop/slash file). |
| `imageFallback` | `"data-url" \| "prompt-url" \| "none"` | `"prompt-url"` | Fallback when no callback inserts an image. |
| `maxImageBytes` | `number` | `1000000` | Max file size used by `"data-url"` fallback. |
| `onPendingUploadsChange` | `(count: number) => void` | - | Receives pending optimistic upload count. |
| `markdownHtml` | `{ keep?: string[]; strip?: string[]; drop?: string[]; attributes?: string[] }` | - | Controls HTML retention, filtering, and attributes using CSS selectors. |
| `className` | `string` | - | Extra classes for the root wrapper (`cn-editor`). |
| `editorClassName` | `string` | - | Extra classes for the WYSIWYG surface. |
| `...props` | `HTMLAttributes<HTMLDivElement>` | - | Forwarded to the root container. |

## Deploy (Cloudflare Pages)

Use Git integration with these settings:
- Framework preset: `None`
- Root directory: `editor`
- Build command: `npm run build`
- Build output directory: `dist`

This deploys the prerendered static HTML + hydrated React demo.

### Keeping registry consumers aligned

Edit `registry/default/editor/html-policy.ts`, then distribute and verify the exact
module used by the demo and Pages CMS:

```sh
npm run sync:html-policy -- ../pagescms
npm run check:html-policy -- ../pagescms
npm run registry:build
```

The CMS adapter and media behavior stay outside this module. The sync command does
not overwrite the CMS editor entry or its local integration changes.

## Browser tests

Install the test browsers with `npx playwright install chromium firefox webkit`, then run `npm test`. The suite runs against Chromium, Firefox, and WebKit. To run one browser, use `npm test -- --project=chromium`.

HTML policy tests cover both HTML and Markdown output, repeated edit/reopen cycles, nested content, selector precedence, attribute filtering, clipboard input, malformed markup, source editing and undo, and malicious HTML. The strict consumer check is `npm run fixture:strict`.

### Snippets

Pass `snippets={[{ label: "Alert", source: '<div class="alert"><h2>Heads up!</h2><section>Your message.</section></div>' }]}` to the editor. Snippets appear in the slash menu and can be searched by label. Their source is parsed, rather than inserted as escaped text, using the field format by default; optional `format: "html" | "markdown"` overrides the input format. Output still uses the editor format. HTML policy and sanitization apply as usual: a snippet does not implicitly keep its wrappers. Insertion replaces the slash query and can be undone. Snippets are unavailable inside table cells.
