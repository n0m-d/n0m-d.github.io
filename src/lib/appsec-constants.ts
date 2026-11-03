/** Plain constants shared by the content schema and AppSec UI (no astro:content imports). */
export const APPSEC_ROOT = "appsec";
export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export const KINDS = ["review", "article"] as const;

export type Severity = (typeof SEVERITIES)[number];
export type Kind = (typeof KINDS)[number];

/**
 * Everything the UI needs per post type. To add a type: add it to KINDS, then here.
 * - label:  kicker / breadcrumb text
 * - tab:    filter tab on /appsec/
 * - noun:   featured link ("Read the …")
 * - folder: posts under appsec/<folder>/ get this type unless frontmatter sets `appsec.kind`
 */
export const KIND_META: Record<Kind, { label: string; tab: string; noun: string; folder: string }> = {
  review: { label: "Code review", tab: "Code reviews", noun: "review", folder: "code-review" },
  article: { label: "Article", tab: "Articles", noun: "article", folder: "articles" },
};

export const KIND_LABEL: Record<Kind, string> = Object.fromEntries(
  KINDS.map((k) => [k, KIND_META[k].label])
) as Record<Kind, string>;
