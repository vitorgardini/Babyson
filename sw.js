// Baby’sOn — service worker restrito: cuida só dos arquivos do próprio app.
// Estratégia: tenta a rede primeiro (pega a versão nova) e usa o cache quando estiver offline.
const CACHE = "babyson-v8";
const ESSENCIAIS = ["./", "./index.html", "./manifest.json"];
const ICONES = ["./icon-180.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
const PERMITIDOS = new Set(
  ESSENCIAIS.concat(ICONES).map((a) => new URL(a, self.location).href)
);

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        // os 3 essenciais precisam entrar; um ícone que faltar não impede a instalação
        c.addAll(ESSENCIAIS).then(() =>
          Promise.all(ICONES.map((i) => c.add(i).catch(() => {})))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nada de fora passa por aqui
  url.search = "";
  url.hash = "";
  const chave = url.href;
  if (!PERMITIDOS.has(chave)) return; // qualquer outro arquivo: o navegador cuida

  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((r) => {
        if (r.ok && r.status === 200) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(chave, copia));
        }
        return r;
      })
      .catch(() =>
        caches.match(chave).then(
          (r) => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())
        )
      )
  );
});
