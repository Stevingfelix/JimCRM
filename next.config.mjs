/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse v2 loads pdfjs-dist (ESM) which webpack can't bundle for
    // RSC — externalize so it's required at runtime instead. @react-pdf
    // similarly needs to stay external.
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "@react-pdf/renderer"],
  },
};

export default nextConfig;
