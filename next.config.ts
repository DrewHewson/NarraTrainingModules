import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Course content is read from content/courses/** at request time (see
  // lib/preview-content.ts). Next won't trace those files into the serverless
  // bundle automatically, so /learn and /preview would 404 for content on
  // Vercel. Explicitly include them.
  outputFileTracingIncludes: {
    "/learn/**": ["./content/courses/**"],
    "/preview/**": ["./content/courses/**"],
  },
};

export default nextConfig;
