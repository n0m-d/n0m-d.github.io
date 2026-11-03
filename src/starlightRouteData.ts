import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import { getAppSecPosts, isAppSecId, type AppSecPost } from "./lib/appsec";

const toLink = (post?: AppSecPost) =>
  post && {
    type: "link" as const,
    label: post.data.title,
    href: `/${post.id}/`,
    isCurrent: false,
    badge: undefined,
    attrs: {},
  };

/**
 * AppSec posts are rendered by Starlight but live outside the Notes sidebar:
 * drop the sidebar and page prev/next through AppSec posts by date instead.
 */
export const onRequest = defineRouteMiddleware(async (context) => {
  const route = context.locals.starlightRoute;
  if (!isAppSecId(route.id)) return;

  route.hasSidebar = false;
  route.sidebar = [];

  const posts = await getAppSecPosts();
  const i = posts.findIndex((post) => post.id === route.id);
  route.pagination = { prev: toLink(posts[i + 1]), next: toLink(posts[i - 1]) };
});
