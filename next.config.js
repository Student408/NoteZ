/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove the 'output: "export"' to allow for dynamic routes
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Add this to enable static and dynamic hybrid rendering
  output: 'standalone',
};

module.exports = nextConfig;