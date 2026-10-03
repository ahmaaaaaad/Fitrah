// The Revival prototype: a second entry page with its own build output.
//   npm run dev:revival    -> http://localhost:5173/revival.html
//   npm run build:revival  -> dist-revival/ (static; runs from any folder or host)
// The dev server also serves POST /api/dalil: with ANTHROPIC_API_KEY set it asks
// the model through the same prompt and validation as the client; without a key
// it answers 503 and Dalil uses its reviewed answers.
import { defineConfig } from 'vite';
import { buildPrompt, validate } from './src/revival/dalil/prompt.js';

function dalilRoute() {
  return {
    name: 'dalil-route',
    transformIndexHtml: { order: 'pre', handler: (html, ctx) => (ctx.server ? html.replace('</head>', '    <meta name="fitrah-dalil-api" content="./api/dalil" />\n  </head>') : html) },
    configureServer(server) {
      server.middlewares.use('/api/dalil', async (req, res) => {
        const send = (code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
        if (req.method !== 'POST') return send(405, { error: 'method' });
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) return send(503, { error: 'no key configured' });
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (raw.length > 4000) return send(413, { error: 'too large' }); }
        try {
          const { question, context, lang } = JSON.parse(raw);
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({ model: process.env.DALIL_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: buildPrompt(question, context, lang) }] }),
            signal: AbortSignal.timeout(5500),
          });
          if (!r.ok) return send(502, { error: `upstream ${r.status}` });
          const data = await r.json();
          const text = data.content?.map((c) => c.text || '').join('') || '';
          const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
          const why = validate(json);
          if (why) return send(422, { error: why });
          return send(200, json);
        } catch (e) {
          return send(500, { error: String(e.message || e) });
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [dalilRoute()],
  server: { host: true, fs: { allow: ['..'] } },
  build: {
    target: 'es2020',
    outDir: 'dist-revival',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: 'revival.html',
      output: { inlineDynamicImports: true, entryFileNames: 'revival.js', assetFileNames: '[name][extname]' },
    },
  },
});
