/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    // Supabase 폴더를 빌드에서 제외
    serverComponentsExternalPackages: ['supabase']
  },
  webpack: (config) => {
    // supabase 폴더를 빌드에서 제외
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/supabase/**']
    }
    return config
  }
};

module.exports = nextConfig;