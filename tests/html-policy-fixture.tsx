import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Editor, type EditorSnippet, type EditorFormat, type MarkdownHtmlPolicy } from "../src/components/ui/editor";
import "../src/index.css";

function Fixture() {
  const [snippets, setSnippets] = useState<EditorSnippet[]>([]);
  const [delayed, setDelayed] = useState(false);
  const change = (next: string) => { if (delayed) setTimeout(() => setValue(next), 40); else setValue(next); };
  const [disabled, setDisabled] = useState(false);
  const [secondValue, setSecondValue] = useState('');
  const [second, setSecond] = useState(false);
  const [value, setValue] = useState("");
  const [format, setFormat] = useState<EditorFormat>("html");
  const [policy, setPolicy] = useState<MarkdownHtmlPolicy>({
    keep: ["div.callout", "details", "summary", "span.badge", "figure", "mark"],
    strip: [".legacy"], drop: [".discard"], attributes: ["data-kind"],
  });
  return <>
    <select aria-label="Format" value={format} onChange={event => setFormat(event.target.value as EditorFormat)}>
      <option value="html">HTML</option><option value="markdown">Markdown</option>
    </select>
    <button onClick={() => setPolicy({ keep: ["div", "span", "figure", "mark"], attributes: ["class", "onclick", "onerror", "style", "srcdoc", "href"] })}>Permissive policy</button>
    <textarea aria-label="Policy" defaultValue={JSON.stringify(policy)} onBlur={event => setPolicy(JSON.parse(event.target.value) as MarkdownHtmlPolicy)} />
    <button onClick={() => setDelayed(current => !current)}>Delay echoes</button>
    <button onClick={() => setDisabled(current => !current)}>Toggle disabled</button>
    <textarea aria-label="Snippets" defaultValue="[]" onBlur={event => setSnippets(JSON.parse(event.target.value) as EditorSnippet[])} />
    <Editor snippets={snippets} disabled={disabled} key={JSON.stringify(policy)} value={value} onChange={change} format={format} markdownHtml={policy} />
    <button onClick={() => setSecond(true)}>Add second editor</button>
    {second && <><Editor value={secondValue} onChange={setSecondValue} format={format} markdownHtml={{keep:['div.second'], drop:['.callout']}} /><textarea aria-label="Second content" value={secondValue} onChange={event => setSecondValue(event.target.value)} /></>}
    <textarea aria-label="Content" value={value} onChange={event => setValue(event.target.value)} />
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
