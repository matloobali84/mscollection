import type { NextConfig } from 'next';
const config: NextConfig = { ...(process.env.STATIC_EXPORT==='1'?{output:'export' as const}:{}), transpilePackages: ['@ms/shared', '@ms/mall-scenes'], devIndicators: false };
export default config;
