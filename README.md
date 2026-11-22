[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/inacoin/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/inacoin/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Costa Verde — Kejahatan Terbuka

Game kejahatan dunia terbuka 2D top-down orisinal untuk bounty [make.fun gta6-01](https://make.fun/bounty/gta6-01): curi mobil, kabur dari polisi, dan selesaikan 13 misi dalam 3 babak di kota pantai Costa Verde — dari fajar sampai senja, dan saat badai datang. Jalankan dengan `node serve.ts` lalu buka http://localhost:8080, atau bangun entry dengan `MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Main

```sh
node serve.ts
# buka http://localhost:8080
```

WASD gerak / kemudi · SHIFT lari · E curi & keluar mobil · klik mouse tembak ·
R isi peluru · SPACE rem tangan · N mulai misi · H bantuan · M suara · ESC jeda.

## Isi game

- **Kota prosedural** — Costa Verde: grid 12×12 blok dengan 8 distrik bernama
  (El Centro, Barrio Viejo, La Marina, Puerto Norte, Zona Industrial,
  Las Colinas, Playa Verde, Parque Central), gedung bertingkat dengan papan
  nama toko, taman, plaza, pantai dengan palem dan payung, dermaga kayu dan
  perahu, kontainer di pelabuhan, zebra cross, lampu jalan, dan pohon di
  trotoar. Seed yang sama selalu membangun kota yang sama.
- **Siklus siang/malam + cuaca badai** — jam dalam game berjalan satu hari penuh tiap 4
  menit: fajar, siang, senja (golden hour), dan malam. Saat senja langit
  menghangat oranye, bayangan memanjang, jendela menyala kuning, lampu jalan
  menyala, dan lampu depan mobil menyorot jalan; di malam hari helikopter
  menyalakan lampu sorotnya. Jam + fase hari (SIANG/SENJA/MALAM) tampil di HUD.
  Cuaca juga berubah: badai tropis bisa datang kapan saja — hujan deras, jalan
  basah menggelap, awan badai menggantung, dan petir menyambar dengan kilat +
  guntur. Cuaca tampil di HUD (☀ CERAH / 🌧 BADAI).
- **Casino Oro bisa dimasuki + mesin slot** — tekan E di depan pintu emas
  Casino Oro di El Centro untuk masuk ke interior: empat mesin slot, meja
  blackjack dengan NPC, karpet merah dan lampu gantung. Berdiri di dekat mesin
  dan tekan E untuk main slot $25 per putaran (tiga 7 = $500, tiga sama = $125,
  sepasang = $50); saldo berubah beneran dan hasil putaran tampil di layar.
  E di pintu emas untuk keluar.
- **Perahu Lancha bisa dikendarai** — dua perahu Lancha tertambat di laut
  Playa Verde. Tekan E di dekatnya untuk naik, WASD mengemudi di laut dengan
  jejak buih (wake) di belakang, E lagi untuk turun ke pasir.
- **Jalan kaki + mengemudi** — fisika mobil arcade (akselerasi, belok ikut
  kecepatan, rem tangan), 7 model mobil dari Burro sampai Flecha, plus taksi
  kuning dan truk boks Camion. Mobil polisi berkedip merah-biru; lampu depan
  menyala di senja dan malam hari.
- **Lalu lintas & pejalan kaki** — 26 mobil lalu lintas mengikuti jalan dan
  belok di persimpangan, 64 pejalan kaki berjalan di trotoar dan kabur saat
  ada tembakan, plus 64 mobil parkir di pinggir jalan.
- **Curi mobil** — mobil parkir dan mobil lalu lintas (sopirnya kabur).
  Mobil misi (Flecha panas, taksi) selalu diprioritaskan saat menekan E.
- **Wanted** — kejahatan yang disaksikan menaikkan panas 0–5 bintang; polisi
  jalan kaki mengejar dan menangkap, mobil patroli menabrak (dengan jeda antar
  tabrakan), dan di bintang 4–5 helikopter polisi mengorbit di atasmu dan
  membuat panasmu tak kunjung dingin. Sembunyi dan panasnya mendingin.
- **13 misi berantai dalam 3 babak** — cerita dari fixer Doña Carmen:
  Babak 1 "Pendatang" (antar paket, curi mobil panas, kabur dari kejaran,
  baku tembak di dermaga), Babak 2 "Naik Daun" (bersih-bersih gudang,
  perampokan Banco Verde, jadi sopir taksi berwaktu 75 detik, dan balapan
  jalanan 3 gerbang dengan bonus rekor waktu), Babak 3 "El Gran Golpe"
  (balas dendam ke geng, antar informan 90 detik, kumpulkan uang kotor di
  tiga titik kota, dan finale: bobol bank 10 detik, lawan 10 anggota geng,
  kabur naik perahu dari pantai dalam 120 detik — hadiah $10.000 — lalu
  Misi 13 "Huida por Mar": kabur lewat laut naik Lancha dalam 90 detik,
  hadiah $4.000). Misi
  berwaktu bisa gagal dan diulang dengan N. Progres babak + daftar 13 misi
  tampil di HUD dan layar jeda (ESC).
- **Kolektibel** — 8 paket tersembunyi Carmen di pinggir jalan seisi kota,
  masing-masing $150, terlacak di HUD dan minimap.
- **Combat** — pistol dengan bidikan mouse, geng Los Halcones yang menembak
  balik, nyawa, armor, dan pickup amunisi / nyawa / uang.
- **HUD + minimap** — bar nyawa & armor, uang, bintang wanted, jam + fase
  hari, nama distrik, banner misi, timer misi berwaktu, jarak objektif,
  progres babak/misi dan paket, speedometer, dan minimap live dengan blip
  (termasuk laut, paket, helikopter, dan panah arah pemain).
- **Save** — localStorage, autosave tiap misi selesai dan tiap 30 detik,
  lanjutkan dari layar judul; WASTED / BUSTED respawn di rumah sakit dan
  kantor polisi.
- **Suara** — semua disintesis live dengan WebAudio: dengung mesin, sirene,
  tembakan, pickup, guntur petir, bunyi mesin slot, dan loop musik prosedural.
  Tanpa file audio.

## Struktur

- `game/` — game yang dimainkan: `index.html`, `style.css`, `src/*.js`
  (`main.js` boot & loop, `sim.js` simulasi, `city.js` kota prosedural,
  `missions.js` cerita, `draw.js` gambar & HUD, `sound.js` suara synth,
  `weather.js` badai hujan + petir, `casino.js` interior Casino Oro + slot,
  `input.js`, `store.js` simpanan, `shots.js` adegan screenshot,
  `config.js`, `rng.js`)
- `screenshots/` — 4 render asli dari game (lihat `shots.json`)
- `main.ts` — program entry: menyalin `game/` + `screenshots/` ke `/output`
  dan menulis `dossier.json` dengan `vendor/makefun-game.ts`
- `serve.ts` — server statis kecil untuk main lokal
- `tools/` — `shots.mjs` (ambil screenshot via Chromium headless) dan
  `smoke.mjs` (uji otomatis: jalan, curi mobil, misi, wanted, autosave)

## Lisensi

MIT — lihat `LICENSE`.
