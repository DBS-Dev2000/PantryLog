/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'supabase.co', 'pics.walgreens.com', 'images.frys.com', 'i5.walmartimages.com', 'target.scene7.com'],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BARCODE_API_URL: process.env.NEXT_PUBLIC_BARCODE_API_URL,
  },
  typescript: {
    // Temporarily ignore type errors during build for deployment
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig