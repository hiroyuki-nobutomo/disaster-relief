/** @type {import('next').NextConfig} */
const nextConfig = {
  // 親ディレクトリの stray な package-lock.json を誤検出しないよう、ルートを明示
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
