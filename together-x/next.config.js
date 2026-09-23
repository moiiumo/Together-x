/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true }, // Cloudflare Pages doesn't support next/image optimization API
};

module.exports = nextConfig;
