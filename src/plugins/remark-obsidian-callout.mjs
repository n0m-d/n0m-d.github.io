import { visit } from "unist-util-visit";
import { h as hast, s as hastSvg } from "hastscript";

/** @typedef {import('mdast').Root} Root */
/** @typedef {import('mdast').Blockquote} Blockquote */
/** @typedef {import('mdast').Paragraph} Paragraph */
/** @typedef {import('mdast').PhrasingContent} PhrasingContent */

const CALLOUT_RE = /^\[!([^\]]+)\]([+-])?(?:[ \t]+([^\n]*))?(?:\n([\s\S]*))?$/;

/** Lucide-style path data (stroke icons) keyed by Obsidian callout type + aliases. */
const ICONS = {
  note: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z M15 5l4 4",
  abstract:
    "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M8 2h8v4H8z M12 11h4 M12 16h4 M8 11h.01 M8 16h.01",
  summary:
    "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M8 2h8v4H8z M12 11h4 M12 16h4 M8 11h.01 M8 16h.01",
  tldr: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M8 2h8v4H8z M12 11h4 M12 16h4 M8 11h.01 M8 16h.01",
  info: "M12 16v-4 M12 8h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
  todo: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z M9 12l2 2 4-4",
  tip: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  hint: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  important:
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  success: "M20 6 9 17l-5-5",
  check: "M20 6 9 17l-5-5",
  done: "M20 6 9 17l-5-5",
  question:
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01",
  help: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01",
  faq: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01",
  warning:
    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z M12 9v4 M12 17h.01",
  caution:
    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z M12 9v4 M12 17h.01",
  attention:
    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z M12 9v4 M12 17h.01",
  failure: "M18 6 6 18 M6 6l12 12",
  fail: "M18 6 6 18 M6 6l12 12",
  missing: "M18 6 6 18 M6 6l12 12",
  danger: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  error: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  bug: "m8 2 1.88 1.88 M14.12 3.88 16 2 M9 7.13v-1a3 3 0 1 1 6 0v1 M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6 M12 20v-9 M6.53 9C4.6 8.8 3 7.1 3 5 M6 13H2 M3 21c0-2.1 1.7-3.9 3.8-4 M17.47 9c1.93-.2 3.53-1.9 3.53-4 M18 13h4 M20.97 21c0-2.1-1.7-3.9-3.8-4",
  example:
    "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  quote:
    "M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  cite: "M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
};

const FOLD_ICON = "m6 9 6 6 6-6";

/**
 * @param {string} tag
 * @param {Record<string, string | number | boolean | null | undefined>} attrs
 * @param {unknown[]} [children]
 * @returns {Paragraph}
 */
function el(tag, attrs = {}, children = []) {
  const { tagName, properties } = hast(tag, attrs);
  return {
    type: "paragraph",
    data: { hName: tagName, hProperties: properties },
    children: /** @type {PhrasingContent[]} */ (children),
  };
}

/**
 * Build an mdast node that rehype renders as an SVG.
 * @param {string} pathD
 * @param {string} className
 * @returns {Paragraph}
 */
function iconSvg(pathD, className) {
  const path = hastSvg("path", { d: pathD });
  const svg = hastSvg(
    "svg",
    {
      class: className,
      viewBox: "0 0 24 24",
      width: "1em",
      height: "1em",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
    },
    [path],
  );

  return {
    type: "paragraph",
    data: { hName: svg.tagName, hProperties: svg.properties },
    children: [
      {
        type: "paragraph",
        data: { hName: path.tagName, hProperties: path.properties },
        children: [],
      },
    ],
  };
}

/**
 * @param {string} type
 */
function defaultTitle(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * @param {PhrasingContent[]} children
 * @returns {Paragraph | null}
 */
function paragraphFrom(children) {
  if (children.length === 0) return null;
  const cleaned = children.filter(
    (n) => !(n.type === "text" && n.value === ""),
  );
  if (cleaned.length === 0) return null;
  return { type: "paragraph", children: cleaned };
}

/**
 * @param {Blockquote} node
 */
function parseCallout(node) {
  const first = node.children[0];
  if (!first || first.type !== "paragraph" || first.children.length === 0) {
    return null;
  }

  const [head, ...restPhrasing] = first.children;
  if (!head || head.type !== "text") return null;

  const match = head.value.match(CALLOUT_RE);
  if (!match) return null;

  const type = match[1].toLowerCase();
  const fold = match[2] ?? null;
  const sameLineRest = (match[3] ?? "").trim();
  const hasNewline = match[4] !== undefined;
  const afterNewline = match[4] ?? "";

  /** @type {PhrasingContent[]} */
  let titleNodes = [];
  /** @type {Blockquote['children']} */
  let body = [];

  const laterBlocks = node.children.slice(1);

  if (hasNewline) {
    if (sameLineRest) {
      titleNodes = [{ type: "text", value: sameLineRest }];
    }
    const firstBody = paragraphFrom([
      ...(afterNewline ? [{ type: "text", value: afterNewline }] : []),
      ...restPhrasing,
    ]);
    if (firstBody) body.push(firstBody);
    body.push(...laterBlocks);
  } else if (laterBlocks.length > 0) {
    titleNodes = [
      ...(sameLineRest ? [{ type: "text", value: sameLineRest }] : []),
      ...restPhrasing,
    ];
    body = laterBlocks;
  } else if (sameLineRest || restPhrasing.length > 0) {
    const only = paragraphFrom([
      ...(sameLineRest ? [{ type: "text", value: sameLineRest }] : []),
      ...restPhrasing,
    ]);
    if (only) body = [only];
  }

  return { type, fold, titleNodes, body };
}

/**
 * @returns {(tree: Root) => void}
 */
export default function remarkObsidianCallout() {
  return (tree) => {
    visit(tree, "blockquote", (node, index, parent) => {
      if (index == null || !parent) return;

      const parsed = parseCallout(node);
      if (!parsed) return;

      const { type, fold, titleNodes, body } = parsed;
      const isFoldable = fold === "+" || fold === "-";
      const isCollapsed = fold === "-";

      const classes = ["callout"];
      if (isFoldable) classes.push("is-collapsible");
      if (isCollapsed) classes.push("is-collapsed");

      const titleText =
        titleNodes.length > 0
          ? titleNodes
          : [{ type: "text", value: defaultTitle(type) }];

      const iconPath = ICONS[type] ?? ICONS.note;

      /** @type {PhrasingContent[]} */
      const titleRow = [
        /** @type {any} */ (iconSvg(iconPath, "callout-icon")),
        /** @type {any} */ (
          el("span", { class: "callout-title-inner" }, titleText)
        ),
      ];

      if (isFoldable) {
        titleRow.push(
          /** @type {any} */ (iconSvg(FOLD_ICON, "callout-fold")),
        );
      }

      const title = el(
        "p",
        { class: "callout-title", "aria-hidden": "true" },
        titleRow,
      );

      const content = el("div", { class: "callout-content" }, body);

      parent.children[index] = el(
        "aside",
        {
          class: classes.join(" "),
          "data-callout": type,
          "aria-label":
            titleNodes.length > 0
              ? titleNodes
                  .map((n) => (n.type === "text" ? n.value : ""))
                  .join("")
              : defaultTitle(type),
          ...(isFoldable
            ? {
                "data-callout-fold": fold,
                tabindex: 0,
                role: "button",
              }
            : {}),
        },
        [title, content],
      );
    });
  };
}
