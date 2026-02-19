/**
 * Mellojoy Sniper — クラウド対応サーバー (Render / Railway)
 * Node.js 標準モジュールのみ・外部パッケージ不要
 *
 * Render デプロイ後: https://あなたのアプリ名.onrender.com
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = process.env.PORT || 3000;
const MELLOJOY_HOST = 'www.mellojoyjapan.com';

// ── CORS ──
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, data) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ── Shopify JSON API プロキシ ──
function proxyProduct(handle, res) {
  const opts = {
    hostname: MELLOJOY_HOST,
    path: `/products/${encodeURIComponent(handle)}.js`,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'application/json',
      'Accept-Language': 'ja,en;q=0.9',
      'Referer': `https://${MELLOJOY_HOST}/`,
    }
  };

  const req = https.request(opts, shopifyRes => {
    let body = '';
    shopifyRes.on('data', c => body += c);
    shopifyRes.on('end', () => {
      try {
        const d = JSON.parse(body);
        const variants = d.variants || [];
        const avail = variants.filter(v => v.available);
        json(res, 200, {
          id: d.id,
          title: d.title,
          handle: d.handle,
          price_display: `¥${(d.price / 100).toLocaleString('ja-JP')}`,
          image: d.featured_image ? `https:${d.featured_image}` : null,
          url: `https://${MELLOJOY_HOST}/products/${d.handle}`,
          available: avail.length > 0,
          available_count: avail.length,
          available_variants: avail.map(v => ({
            id: v.id,
            title: v.title,
            cart_url: `https://${MELLOJOY_HOST}/cart/add?id=${v.id}&quantity=1&return_to=/cart`,
          })),
          checked_at: new Date().toISOString(),
        });
        if (avail.length > 0) console.log(`🟢 在庫あり: ${d.title} (${avail.length}種)`);
      } catch (e) {
        json(res, 502, { error: 'Parse error' });
      }
    });
  });
  req.on('error', e => json(res, 500, { error: e.message }));
  req.setTimeout(8000, () => { req.destroy(); json(res, 504, { error: 'Timeout' }); });
  req.end();
}

// ── 静的ファイル配信 ──
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

function serveFile(filePath, res) {
  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    const headers = { 'Content-Type': mime };
    if (ext === '.html') headers['Cache-Control'] = 'no-cache';
    else headers['Cache-Control'] = 'public, max-age=86400';
    res.writeHead(200, headers);
    res.end(data);
  });
}

// ── メインサーバー ──
const server = http.createServer((req, res) => {
  const { pathname, query: qs } = url.parse(req.url, true);

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // /api/product
  if (pathname === '/api/product') {
    if (!qs.handle) { json(res, 400, { error: 'handle required' }); return; }
    proxyProduct(qs.handle, res);
    return;
  }

  // /api/health
  if (pathname === '/api/health') {
    json(res, 200, {
      ok: true,
      server: 'Mellojoy Sniper Cloud',
      version: '3.0',
      env: process.env.RENDER ? 'render' : 'local',
      time: new Date().toISOString(),
    });
    return;
  }

  // 静的ファイル
  const filePath = path.join(__dirname, 'public',
    pathname === '/' ? 'index.html' : pathname);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(filePath, res);
  } else {
    serveFile(path.join(__dirname, 'public', 'index.html'), res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🎯 Mellojoy Sniper 起動`);
  console.log(`  📡 PORT: ${PORT}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`  🌐 URL: ${process.env.RENDER_EXTERNAL_URL}`);
  }
  console.log('');
});

server.on('error', err => { console.error(err); process.exit(1); });
