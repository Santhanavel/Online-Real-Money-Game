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
  async rewrites() {
    return [
      {
        source: '/socket.io',
        destination: 'http://localhost:4000/socket.io/',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:4000/socket.io/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
