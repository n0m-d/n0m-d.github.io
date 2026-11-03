import { getCollection, type CollectionEntry } from "astro:content";
import { APPSEC_ROOT, KINDS, KIND_META, type Kind } from "./appsec-constants";

export * from "./appsec-constants";

export type AppSecPost = CollectionEntry<"docs">;
export type AppSecMeta = NonNullable<AppSecPost["data"]["appsec"]>;

export function isAppSecId(id: string): boolean {
  return id.startsWith(`${APPSEC_ROOT}/`);
}

/** Explicit `appsec.kind` wins; then the folder (see KIND_META.folder); otherwise "review". */
export function getKind(post: AppSecPost): Kind {
  const folder = post.id.split("/")[1];
  return (
    post.data.appsec?.kind ??
    KINDS.find((k) => KIND_META[k].folder === folder) ??
    "review"
  );
}

/** All AppSec posts, newest first. Drafts are visible in dev only (same as Starlight). */
export async function getAppSecPosts(): Promise<AppSecPost[]> {
  const posts = await getCollection(
    "docs",
    (e) => isAppSecId(e.id) && !(import.meta.env.PROD && e.data.draft)
  );
  return posts.sort(
    (a, b) =>
      (b.data.appsec?.date?.getTime() ?? 0) - (a.data.appsec?.date?.getTime() ?? 0) ||
      a.data.title.localeCompare(b.data.title)
  );
}

export function cweId(value: string | number): string {
  return String(value).replace(/^cwe-?/i, "");
}

export function cweUrl(value: string | number): string {
  return `https://cwe.mitre.org/data/definitions/${cweId(value)}.html`;
}

export function readingMinutes(body = ""): number {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
