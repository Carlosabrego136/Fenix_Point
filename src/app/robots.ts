import type { MetadataRoute } from 'next';

// Todo el sitio es privado: se pide a los buscadores que no lo indexen.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
