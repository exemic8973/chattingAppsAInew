/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['simple-peer'],
  experimental: {
    serverActions: {}
  }
}

module.exports = nextConfig