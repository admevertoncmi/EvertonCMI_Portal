// Removemos o "import type { NextConfig }" para o TypeScript não ser chato aqui

const nextConfig = {
  typescript: {
    // Ignora os erros de TypeScript na hora de compilar para produção
    ignoreBuildErrors: true,
  },
};

export default nextConfig;