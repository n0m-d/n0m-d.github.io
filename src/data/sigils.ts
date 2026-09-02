import type { ImageMetadata } from 'astro';
import cwee from '../assets/cwee.png';
import ascp from '../assets/ascp.png';
import casa from '../assets/casa.png';
import acp from '../assets/acp.png';

export type Sigil = {
  code: string;
  name: string;
  issuer: string;
  href?: string;
  art: ImageMetadata;
};

/** Drop a badge in `src/assets` and add a row here. */
export const sigils: Sigil[] = [
  {
    code: 'CWEE',
    name: 'Certified Web Exploitation Expert',
    issuer: 'Hack The Box',
    href: 'https://academy.hackthebox.com/preview/certifications/htb-certified-web-exploitation-expert',
    art: cwee,
  },
  {
    code: 'ASCP',
    name: 'API Security Certified Professional',
    issuer: 'APIsec University',
    art: ascp,
  },
  {
    code: 'CASA',
    name: 'Certified API Security Analyst',
    issuer: 'APIsec University',
    art: casa,
  },
  {
    code: 'ACP',
    name: 'API Certified Professional',
    issuer: 'APIsec University',
    art: acp,
  },
];
