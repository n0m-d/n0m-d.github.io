export type ToolLanguage =
  | 'TypeScript'
  | 'JavaScript'
  | 'Python'
  | 'Rust'
  | 'MDX'
  | 'Markdown'
  | 'Astro'
  | 'Shell'
  | 'Go';

export interface Tool {
  /** Repository slug shown as v0iid/{name} */
  name: string;
  /** Short description under the title */
  description: string;
  /** GitHub repository URL */
  github: string;
  /** Primary language for filtering */
  language: ToolLanguage;
  /** Topic tags (also used for topic filter chips) */
  topics: string[];
  /** Publication date (ISO YYYY-MM-DD) */
  publishedAt: string;
  /** public | private */
  visibility: 'public' | 'private';
  /** Optional license badge */
  license?: string;
  /** Whether the tool is archived */
  archived?: boolean;
  /** Search keywords beyond name/description */
  keywords?: string[];
}

export const GITHUB_OWNER = 'n0m-d';

export const LANG_COLORS: Record<ToolLanguage, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Rust: '#dea584',
  MDX: '#fcb32c',
  Markdown: '#083fa1',
  Astro: '#ff5d01',
  Shell: '#89e051',
  Go: '#00ADD8',
};

export const tools: Tool[] = [
  {
    name: 'Luhn-Ruxcon-SQLi',
    description:
      'Boolean-based blind SQL injection via Luhn-valid credit card payloads',
    github: 'https://github.com/n0m-d/Luhn-Ruxcon-SQLi',
    language: 'Python',
    topics: ['pentesterlab', 'capture-the-flag', 'sql-injection'],
    publishedAt: '2026-05-03',
    visibility: 'public',
    keywords: ['pentesterlab', 'capture-the-flag', 'sql-injection'],
  },
  {
    name: 'EnumSMTPGo',
    description:
      'A SMTP user enumeration tool written in Go. This tool helps in identifying valid email addresses on an SMTP server by analyzing the server\'s response to RCPT, VRFY and EXPN commands.',
    github: 'https://github.com/n0m-d/EnumSMTPGo',
    language: 'Go',
    topics: ['smtp', 'enumeration', 'poc', 'go'],
    publishedAt: '2025-12-17',
    visibility: 'private',
    keywords: ['smtp', 'enumeration', 'poc', 'go'],
  },
  {
    name: 'CVE-2021-40438-POC',
    description:
      'CVE-2021-40438 - SSRF Exploit',
    github: 'https://github.com/n0m-d/CVE-2021-40438-POC',
    language: 'Python',
    topics: ['cve', 'ssrf', 'poc'],
    publishedAt: '2026-06-10',
    visibility: 'public',
    keywords: ['cve', 'ssrf', 'poc'],
  },
  {
    name: 'CVE-2018-0114 Proof of Concept',
    description:
      'To generate a JWT with the claim "admin", run the following command in the project directory',
    github: 'https://github.com/n0m-d/CVE-2021-40438-POC',
    language: 'Python',
    topics: ['cve', 'jwt', 'poc','go'],
    publishedAt: '2025-08-14',
    visibility: 'public',
    keywords: ['cve', 'jwt', 'poc', 'go'],
  },
  {
    name: 'JWE-PTLab',
    description:
      'Python script for the PentesterLab JWE exercise - exploits JWE vulnerabilities to gain admin access.',
    github: 'https://github.com/n0m-d/JWE-PTLab',
    language: 'Python',
    topics: ['pentesterlab', 'capture-the-flag', 'jwt'],
    publishedAt: '2026-05-06',
    visibility: 'public',
    keywords: ['pentesterlab', 'capture-the-flag', 'jwt'],
  },
];

export function getTools(): Tool[] {
  return [...tools].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function formatPublishedAt(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00`));
}

export function getToolSearchText(tool: Tool): string {
  return [
    tool.name,
    tool.description,
    tool.language,
    tool.license ?? '',
    tool.visibility,
    tool.publishedAt,
    formatPublishedAt(tool.publishedAt),
    ...tool.topics,
    ...(tool.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

export function getLanguages(): ToolLanguage[] {
  return [...new Set(tools.map((t) => t.language))].sort();
}

export function getLanguageCounts(): Record<string, number> {
  return Object.fromEntries(
    getLanguages().map((lang) => [lang, tools.filter((t) => t.language === lang).length])
  );
}

export function getTopics(): string[] {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    for (const topic of tool.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([topic]) => topic);
}

export function getLangColor(lang: ToolLanguage): string {
  return LANG_COLORS[lang] ?? '#8b949e';
}
