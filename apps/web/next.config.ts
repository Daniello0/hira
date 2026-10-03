import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@hira/contracts'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
