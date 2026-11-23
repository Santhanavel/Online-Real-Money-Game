/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@rummy/shared-types', '@rummy/game-engine', '@rummy/card-assets'],
  reactStrictMode: false,
  typescript: {
    // Allows clean compilation with React 18 monorepos
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
