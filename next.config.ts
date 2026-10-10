import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: "/login", permanent: false }];
  },
  cacheComponents: true,
  experimental: {
    // As telas são renderizadas no cliente depois do login (Supabase Auth);
    // só valida navegação instantânea onde um segmento pedir explicitamente.
    instantInsights: { validationLevel: "manual-warning" },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
