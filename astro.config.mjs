import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  devToolbar: { enabled: false },
  vite: {
    server: { strictPort: true },
    preview: { strictPort: true },
    plugins: [{
      name: 'saypay-w1-no-preview-secret-file',
      apply: 'build',
      enforce: 'post',
      // Cloudflare emits a preview-only .dev.vars asset from local .env values.
      // Remove it before writing output so .env remains the only credential file.
      generateBundle: {
        order: 'post',
        handler(_options, bundle) {
          for (const name of Object.keys(bundle)) {
            if (/(^|\/)\.dev\.vars(?:\..*)?$/.test(name)) delete bundle[name];
          }
        },
      },
    }],
  },
});
