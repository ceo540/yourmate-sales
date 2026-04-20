import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },
};

export default nextConfig;
