const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Windows 빌드 최적화: 타임아웃 명시
  staticPageGenerationTimeout: 120,
};

export default nextConfig;
