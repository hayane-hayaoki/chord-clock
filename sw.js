/* ===================================================================
   Chord-Clock Service Worker  — オフライン対応
   -------------------------------------------------------------------
   方針: network-first（オンライン時は常に最新を取得しキャッシュ更新、
         オフライン時はキャッシュから返す）。
         → index.html を編集したら、オンラインで一度開けば即反映される。
   設置: index.html と同じフォルダに置くこと。
   更新: index.html を更新したら下の CACHE のバージョンも上げると確実。
=================================================================== */
const CACHE = 'chord-clock-v14';
const ASSETS = ['./', './index.html'];

// インストール: アプリ本体を先読みキャッシュ
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* addAll 失敗時も登録自体は継続 */ })
  );
});

// アクティベート: 古いキャッシュを掃除して即制御開始
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k !== CACHE; })
              .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

// フェッチ: network-first → 失敗したら cache → 最後の砦で index.html
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;            // GET 以外は素通し

  e.respondWith(
    fetch(req)
      .then(function (res) {
        // 同一オリジンの正常レスポンスだけキャッシュ更新
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        // オフライン: キャッシュ → 無ければアプリ本体を返す
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
