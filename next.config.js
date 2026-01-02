/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  // Exclude undici from bundling (it's a Node.js internal)
  serverExternalPackages: ['undici'],
}

module.exports = nextConfig

