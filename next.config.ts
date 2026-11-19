import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The synthetic data and the recordings replay plays are read from disk at runtime
  // (paths built from process.cwd(), which the tracer can't follow). Ship them with
  // every server route so a host like Vercel has them. Archives stay out.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*", "./runs/*.json"],
  },
};

export default nextConfig;
