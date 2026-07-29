import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

const SECURITY_HEADERS = {
  'Content-Security-Policy': `${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
}

const REQUIRED_PRODUCTION_URLS = ['VITE_BASE_URL', 'VITE_LIVEKIT_URL']
const OPTIONAL_PRODUCTION_URLS = [
  'VITE_HUB_URL',
  'VITE_PRESENCE_HUB_URL',
  'VITE_NOTIFICATION_HUB_URL',
  'VITE_VOICE_SERVER_URL',
  'VITE_VERSION_LINK',
]

function validateProductionEnvironment(env) {
  const errors = []

  for (const key of REQUIRED_PRODUCTION_URLS) {
    if (!env[key]) errors.push(`${key} üretim derlemesinde zorunludur.`)
  }

  for (const key of [...REQUIRED_PRODUCTION_URLS, ...OPTIONAL_PRODUCTION_URLS]) {
    if (!env[key]) continue
    try {
      const url = new URL(env[key])
      const expectedProtocol = key === 'VITE_LIVEKIT_URL' ? 'wss:' : 'https:'
      if (url.protocol !== expectedProtocol) {
        errors.push(`${key} ${expectedProtocol}// ile başlamalıdır.`)
      }
      if (url.username || url.password) {
        errors.push(`${key} kullanıcı adı veya parola içeremez.`)
      }
    } catch {
      errors.push(`${key} geçerli bir URL olmalıdır.`)
    }
  }

  if (env.VITE_MOCKING === 'true') {
    errors.push('VITE_MOCKING üretim derlemesinde true olamaz.')
  }

  const suspiciousPublicKeys = Object.keys(env).filter(
    (key) => key.startsWith('VITE_') && /(SECRET|PASSWORD|PRIVATE|ACCESS_TOKEN|REFRESH_TOKEN)/i.test(key)
  )
  if (suspiciousPublicKeys.length) {
    errors.push(`${suspiciousPublicKeys.join(', ')} Vite istemci paketine gömülecek; gizli değerler VITE_ öneki kullanamaz.`)
  }

  if (errors.length) {
    throw new Error(`Güvensiz web üretim yapılandırması:\n- ${errors.join('\n- ')}`)
  }
}

function securityMetaPlugin() {
  return {
    name: 'voxify-security-meta',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: CONTENT_SECURITY_POLICY,
        },
        injectTo: 'head-prepend',
      }],
    },
    async writeBundle(options) {
      const outputDirectory = resolve(import.meta.dirname, options.dir || 'dist')
      await Promise.all([
        rm(resolve(outputDirectory, 'mockServiceWorker.js'), { force: true }),
        rm(resolve(outputDirectory, '.DS_Store'), { force: true }),
      ])
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const isProductionBuild = command === 'build' && mode === 'production'
  if (isProductionBuild) {
    validateProductionEnvironment(loadEnv(mode, import.meta.dirname, ''))
  }

  return {
    plugins: [react(), isProductionBuild && securityMetaPlugin()].filter(Boolean),
    build: {
      sourcemap: false,
    },
    esbuild: isProductionBuild ? { drop: ['console', 'debugger'] } : undefined,
    server: {
      strictPort: true,
    },
    preview: {
      headers: SECURITY_HEADERS,
    },
  }
})
