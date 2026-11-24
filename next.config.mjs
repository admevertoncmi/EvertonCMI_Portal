// Versão desta publicação: fica gravada no código do navegador e no servidor.
// O aviso "Saiu uma atualização" compara as duas (src/components/AvisoNovaVersao.tsx).
const VERSAO_APP = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || `local-${Date.now()}`

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_VERSAO_APP: VERSAO_APP,
  },
};

export default nextConfig;
