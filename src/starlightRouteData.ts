import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import type { CollectionEntry } from "astro:content";
import { getAppSecPosts, isAppSecId } from "./lib/appsec";
import { getMalwarePosts, isMalwareId } from "./lib/malware";

type Post = CollectionEntry<"docs">;

const toLink = (post?: Post) =>
  post && {
    type: "link" as const,
    label: post.data.title,
    href: `/${post.id}/`,
    isCurrent: false,
    badge: undefined,
    attrs: {},
  };

/**
 * AppSec and Quarantine posts are rendered by Starlight but live outside the Notes
 * sidebar: drop the sidebar and page prev/next through their own section by date.
 */
export const onRequest = defineRouteMiddleware(async (context) => {
  const route = context.locals.starlightRoute;
  const load = isAppSecId(route.id) ? getAppSecPosts : isMalwareId(route.id) ? getMalwarePosts : null;
  if (!load) return;

  route.hasSidebar = false;
  route.sidebar = [];

  const posts = await load();
  const i = posts.findIndex((post) => post.id === route.id);
  route.pagination = { prev: toLink(posts[i + 1]), next: toLink(posts[i - 1]) };
});
