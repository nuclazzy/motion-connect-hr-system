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
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups', // Google OAuth2 팝업 허용
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless', // 크로스 오리진 리소스 허용
          },
        ],
      },
    ]
  },
};

module.exports = nextConfig;