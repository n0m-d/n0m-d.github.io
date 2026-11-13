import { z } from "astro/zod";
import { docsLoader, i18nLoader } from "@astrojs/starlight/loaders";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";
import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { KINDS, SEVERITIES } from "./lib/appsec-constants";
import { MW_CLASSES, MW_KINDS, THREAT_LEVELS } from "./lib/malware-constants";


const ctaSection = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "src/content/sections",
  }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    enable: z.boolean().optional(),
    fill_button: z.object({
      label: z.string().optional(),
      link: z.string().optional(),
      enable: z.boolean().optional(),
    }),
    outline_button: z.object({
      label: z.string().optional(),
      link: z.string().optional(),
      enable: z.boolean().optional(),
    }),
  }),
});

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // Optional metadata for AppSec posts (see content/docs/appsec/**/_*-template.mdx).
        appsec: z
          .object({
            kind: z.enum(KINDS).optional(),
            severity: z.enum(SEVERITIES).optional(),
            target: z.string().optional(),
            language: z.string().optional(),
            affected: z.string().optional(),
            fixed: z.string().optional(),
            cwe: z.array(z.union([z.string(), z.number()])).default([]),
            tags: z.array(z.string()).default([]),
            date: z.coerce.date().optional(),
          })
          .optional(),
        // Optional metadata for Quarantine posts (see content/docs/malware/**/_*-template.mdx).
        malware: z
          .object({
            kind: z.enum(MW_KINDS).optional(),
            threat: z.enum(THREAT_LEVELS).optional(),
            family: z.string().optional(),
            class: z.enum(MW_CLASSES).optional(),
            platform: z.string().optional(),
            sha256: z.string().optional(),
            first_seen: z.coerce.date().optional(),
            attack: z.array(z.string()).default([]),
            tags: z.array(z.string()).default([]),
            date: z.coerce.date().optional(),
          })
          .optional(),
      }),
    }),
  }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  ctaSection,
};
