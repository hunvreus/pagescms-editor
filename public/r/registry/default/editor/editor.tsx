import { type HTMLAttributes, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Markdown } from "@tiptap/markdown";
import {
  Bold,
  Columns3,
  Check,
  ChevronDownIcon,
  Code,
  Minus,
  Plus,
  RemoveFormatting,
  Rows3,
  Table as TableIcon,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline as UnderlineIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SlashCommands from "./slash-command/commands";

export type EditorFormat = "html" | "markdown";

type EditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  format?: EditorFormat;
  className?: string;
  editorClassName?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "className">;

type ToggleAction = {
  label: string;
  icon: LucideIcon;
  isActive: () => boolean;
  run: () => void;
  toggle: true;
};

type PlainAction = {
  label: string;
  icon: LucideIcon;
  run: () => void;
  toggle?: false;
};

type MenuAction = ToggleAction | PlainAction;

type IconButtonOptions = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled: boolean;
  toggle?: boolean;
  pressed?: boolean;
  className?: string;
};

type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "codeBlock";

const blockOptions: Array<{ value: BlockType; label: string }> = [
  { value: "paragraph", label: "Text" },
  { value: "heading1", label: "Heading 1" },
  { value: "heading2", label: "Heading 2" },
  { value: "heading3", label: "Heading 3" },
  { value: "bulletList", label: "Bulleted list" },
  { value: "orderedList", label: "Numbered list" },
  { value: "blockquote", label: "Quote" },
  { value: "codeBlock", label: "Code block" },
];

export function Editor({
  value = "",
  onChange = () => undefined,
  disabled = false,
  format = "html",
  className,
  editorClassName,
  ...props
}: EditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showTableActions, setShowTableActions] = useState(false);
  const [showAltInput, setShowAltInput] = useState(false);
  const [isInTable, setIsInTable] = useState(false);
  const [isOnImage, setIsOnImage] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageAltText, setImageAltText] = useState("");
  const bubbleMenuRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const tiptapSurfaceClass = cn(
    "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm",
    editorClassName,
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        enableClickSelection: true,
        HTMLAttributes: {
          rel: null,
          target: null,
        },
      }),
      Image,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Markdown,
      SlashCommands,
    ],
    content: value || (format === "markdown" ? "" : "<p></p>"),
    contentType: format,
    editorProps: {
      attributes: {
        class: tiptapSurfaceClass,
      },
    },
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(format === "markdown" ? nextEditor.getMarkdown() : nextEditor.getHTML());
    },
  });

  const activeState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) {
        return {
          blockType: "paragraph" as BlockType,
          bold: false,
          italic: false,
          underline: false,
          strike: false,
          code: false,
          link: false,
        };
      }

      const blockType: BlockType = currentEditor.isActive("heading", { level: 1 })
        ? "heading1"
        : currentEditor.isActive("heading", { level: 2 })
          ? "heading2"
          : currentEditor.isActive("heading", { level: 3 })
            ? "heading3"
            : currentEditor.isActive("bulletList")
              ? "bulletList"
              : currentEditor.isActive("orderedList")
                ? "orderedList"
                : currentEditor.isActive("blockquote")
                  ? "blockquote"
                  : currentEditor.isActive("codeBlock")
                    ? "codeBlock"
                    : "paragraph";

      return {
        blockType,
        bold: currentEditor.isActive("bold"),
        italic: currentEditor.isActive("italic"),
        underline: currentEditor.isActive("underline"),
        strike: currentEditor.isActive("strike"),
        code: currentEditor.isActive("code"),
        link: currentEditor.isActive("link"),
      };
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = format === "markdown" ? editor.getMarkdown() : editor.getHTML();
    const hasChanged =
      format === "markdown" ? value.trimEnd() !== current.trimEnd() : value !== current;
    if (hasChanged) {
      editor.commands.setContent(value || (format === "markdown" ? "" : "<p></p>"), {
        emitUpdate: false,
        contentType: format,
      });
    }
  }, [editor, value, format]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled, false);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: tiptapSurfaceClass,
        },
      },
    });
  }, [editor, tiptapSurfaceClass]);

  useEffect(() => {
    if ((!showLinkInput && !showTableActions && !showAltInput) || !editor) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const insideBubble = bubbleMenuRef.current?.contains(target) ?? false;
      if (!insideBubble) {
        setShowLinkInput(false);
        setShowTableActions(false);
        setShowAltInput(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [showLinkInput, showTableActions, showAltInput, editor]);

  useEffect(() => {
    if (!showLinkInput) return;
    const frameId = requestAnimationFrame(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frameId);
  }, [showLinkInput]);

  useEffect(() => {
    if (!editor) return;

    const updateTableContext = () => {
      const nextIsInTable =
        editor.isActive("table") ||
        editor.isActive("tableRow") ||
        editor.isActive("tableHeader") ||
        editor.isActive("tableCell");
      const nextIsOnImage = editor.isActive("image");

      setIsInTable(nextIsInTable);
      if (!nextIsInTable) setShowTableActions(false);
      setIsOnImage(nextIsOnImage);
      if (!nextIsOnImage) setShowAltInput(false);
    };

    updateTableContext();
    editor.on("selectionUpdate", updateTableContext);
    editor.on("transaction", updateTableContext);

    return () => {
      editor.off("selectionUpdate", updateTableContext);
      editor.off("transaction", updateTableContext);
    };
  }, [editor]);

  if (!editor) return null;

  const setBlockType = (next: BlockType) => {
    const chain = editor.chain().focus();

    switch (next) {
      case "paragraph":
        chain.setParagraph().run();
        break;
      case "heading1":
        chain.setHeading({ level: 1 }).run();
        break;
      case "heading2":
        chain.setHeading({ level: 2 }).run();
        break;
      case "heading3":
        chain.setHeading({ level: 3 }).run();
        break;
      case "bulletList":
        chain.toggleBulletList().run();
        break;
      case "orderedList":
        chain.toggleOrderedList().run();
        break;
      case "blockquote":
        chain.toggleBlockquote().run();
        break;
      case "codeBlock":
        chain.toggleCodeBlock().run();
        break;
      default:
        break;
    }
  };

  const inlineActions: MenuAction[] = [
    {
      label: "Bold",
      icon: Bold,
      isActive: () => activeState.bold,
      run: () => editor.chain().focus().toggleBold().run(),
      toggle: true,
    },
    {
      label: "Italic",
      icon: Italic,
      isActive: () => activeState.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
      toggle: true,
    },
    {
      label: "Underline",
      icon: UnderlineIcon,
      isActive: () => activeState.underline,
      run: () => editor.chain().focus().toggleUnderline().run(),
      toggle: true,
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      isActive: () => activeState.strike,
      run: () => editor.chain().focus().toggleStrike().run(),
      toggle: true,
    },
    {
      label: "Code",
      icon: Code,
      isActive: () => activeState.code,
      run: () => editor.chain().focus().toggleCode().run(),
      toggle: true,
    },
    {
      label: "Remove formatting",
      icon: RemoveFormatting,
      run: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    },
  ];

  const openLinkInput = () => {
    if (showLinkInput) {
      setShowLinkInput(false);
      return;
    }
    setLinkUrl(editor.isActive("link") ? (editor.getAttributes("link").href as string) || "" : "");
    setShowLinkInput(true);
    setShowTableActions(false);
    setShowAltInput(false);
  };

  const toggleTableActions = () => {
    if (!isInTable) return;
    setShowTableActions((current) => !current);
    setShowLinkInput(false);
    setShowAltInput(false);
  };

  const toggleAltInput = () => {
    if (!isOnImage) return;
    if (showAltInput) {
      setShowAltInput(false);
      return;
    }
    const alt = editor.getAttributes("image").alt;
    setImageAltText(typeof alt === "string" ? alt : "");
    setShowAltInput(true);
    setShowLinkInput(false);
    setShowTableActions(false);
  };

  const applyLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
    setShowLinkInput(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setShowLinkInput(false);
    setLinkUrl("");
  };

  const confirmOrRemoveLink = () => {
    const trimmed = linkUrl.trim();
    if (trimmed || editor.isActive("link")) {
      removeLink();
      return;
    }

    setShowLinkInput(false);
  };

  const applyImageAlt = () => {
    if (!isOnImage) return;
    const trimmed = imageAltText.trim();
    editor
      .chain()
      .focus()
      .updateAttributes("image", {
        alt: trimmed || null,
      })
      .run();
    setShowAltInput(false);
  };

  const clearImageAlt = () => {
    if (!isOnImage) return;
    editor.chain().focus().updateAttributes("image", { alt: null }).run();
    setImageAltText("");
    setShowAltInput(false);
  };

  const addRow = () => editor.chain().focus().addRowAfter().run();
  const removeRow = () => editor.chain().focus().deleteRow().run();
  const addColumn = () => editor.chain().focus().addColumnAfter().run();
  const removeColumn = () => editor.chain().focus().deleteColumn().run();

  const toolbarButtonClass =
    "inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
  const toolbarToggleButtonClass = `${toolbarButtonClass} aria-pressed:bg-accent aria-pressed:text-accent-foreground`;
  const toolbarInputClass =
    "border-input bg-background text-foreground h-7 rounded-md border px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

  const renderIconButton = ({
    label,
    icon: Icon,
    onClick,
    disabled,
    toggle = false,
    pressed = false,
    className,
  }: IconButtonOptions) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={toggle ? pressed : undefined}
      className={`${toggle ? toolbarToggleButtonClass : toolbarButtonClass}${className ? ` ${className}` : ""}`}
      title={label}
    >
      <Icon className="size-4" />
    </button>
  );
  return (
    <div {...props} className={cn("cn-editor", className)}>
      <BubbleMenu
        pluginKey="editor-bubble"
        ref={bubbleMenuRef}
        editor={editor}
        className="z-50 w-fit max-w-[95vw] text-popover-foreground outline-hidden"
        options={{
          placement: "top",
          offset: 10,
          flip: { padding: 8 },
          shift: { padding: 8 },
        }}
        shouldShow={({ editor: bubbleEditor, from, to, view, element }) => {
          const hasEditorFocus = view.hasFocus() || element.contains(document.activeElement);
          if (!hasEditorFocus) return false;
          return showLinkInput || showTableActions || showAltInput || (!bubbleEditor.state.selection.empty && from !== to);
        }}
      >
        <div className="flex flex-col gap-1">
          <div className="border-border bg-popover flex flex-nowrap items-center gap-0.5 overflow-x-auto rounded-md border p-1 shadow-sm whitespace-nowrap">
            <div className="group/native-select relative w-fit">
              <select
                id="block-style"
                value={activeState.blockType}
                onChange={(event) => setBlockType(event.target.value as BlockType)}
                disabled={disabled}
                aria-label="Block style"
                className="h-7 w-full appearance-none rounded-md border border-transparent bg-transparent px-2 pr-5.5 text-sm shadow-none outline-none hover:bg-accent focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {blockOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 opacity-50"
                aria-hidden="true"
              />
            </div>
            {inlineActions.map((action) =>
              renderIconButton({
                label: action.label,
                icon: action.icon,
                onClick: action.run,
                disabled,
                toggle: Boolean(action.toggle),
                pressed: action.toggle ? action.isActive() : false,
              }),
            )}
            {renderIconButton({
              label: "Link",
              icon: LinkIcon,
              onClick: openLinkInput,
              disabled,
              toggle: true,
              pressed: showLinkInput || activeState.link,
            })}
            {isOnImage ? (
              <button
                type="button"
                aria-label="Image alt text"
                title="Image alt text"
                aria-pressed={showAltInput}
                onClick={toggleAltInput}
                disabled={disabled}
                className={`${toolbarToggleButtonClass} size-7 text-xs`}
              >
                ALT
              </button>
            ) : null}
            {isInTable
              ? renderIconButton({
                  label: "Table",
                  icon: TableIcon,
                  onClick: toggleTableActions,
                  disabled,
                  toggle: true,
                  pressed: showTableActions,
                })
              : null}
          </div>
          {showLinkInput ? (
            <div
              data-state="open"
              className="border-border bg-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-1 flex flex-nowrap items-center gap-0.5 overflow-x-auto rounded-md border p-1 shadow-sm duration-200 whitespace-nowrap"
            >
              <input
                id="link-url"
                ref={linkInputRef}
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                }}
                disabled={disabled}
                className={`${toolbarInputClass} min-w-56 flex-1`}
              />
              {renderIconButton({
                label: "Set link",
                icon: Check,
                onClick: applyLink,
                disabled: disabled || !linkUrl.trim(),
              })}
              {renderIconButton({
                label: "Remove link",
                icon: X,
                onClick: confirmOrRemoveLink,
                disabled,
                className: "ml-auto",
              })}
            </div>
          ) : null}
          {showAltInput && isOnImage ? (
            <div
              data-state="open"
              className="border-border bg-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-1 flex flex-nowrap items-center gap-0.5 overflow-x-auto rounded-md border p-1 shadow-sm duration-200 whitespace-nowrap"
            >
              <input
                id="image-alt"
                type="text"
                placeholder="Describe image"
                value={imageAltText}
                onChange={(event) => setImageAltText(event.target.value)}
                disabled={disabled}
                className={`${toolbarInputClass} min-w-56 flex-1`}
              />
              {renderIconButton({
                label: "Save alt text",
                icon: Check,
                onClick: applyImageAlt,
                disabled,
              })}
              {renderIconButton({
                label: "Remove alt text",
                icon: X,
                onClick: clearImageAlt,
                disabled,
                className: "ml-auto",
              })}
            </div>
          ) : null}
          {showTableActions && isInTable ? (
            <div
              data-state="open"
              className="border-border bg-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-1 inline-flex w-fit flex-nowrap items-center gap-1 overflow-x-auto self-end rounded-md border p-1 shadow-sm duration-200 whitespace-nowrap"
            >
              <span className="text-sm ml-1 text-muted-foreground">Rows:</span>
              {renderIconButton({
                label: "Add row",
                icon: Plus,
                onClick: addRow,
                disabled,
              })}
              {renderIconButton({
                label: "Remove row",
                icon: Minus,
                onClick: removeRow,
                disabled,
              })}
              <span className="bg-border mx-0.5 h-4 w-px" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Columns:</span>
              {renderIconButton({
                label: "Add column",
                icon: Plus,
                onClick: addColumn,
                disabled,
              })}
              {renderIconButton({
                label: "Remove column",
                icon: Minus,
                onClick: removeColumn,
                disabled,
              })}
            </div>
          ) : null}
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
