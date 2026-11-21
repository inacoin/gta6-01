[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/inacoin/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/inacoin/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Costa Verde — Kejahatan Terbuka

Game kejahatan dunia terbuka 2D top-down orisinal untuk bounty [make.fun gta6-01](https://make.fun/bounty/gta6-01): curi mobil, kabur dari polisi, dan selesaikan 8 misi di kota pantai Costa Verde. Jalankan dengan `node serve.ts` lalu buka http://localhost:8080, atau bangun entry dengan `MAKEFUN_OUTPUT_DIR=out node main.ts`.

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
  Las Colinas, Playa Verde, Parque Central), gedung, taman, plaza, pantai
  dengan palem dan payung, dermaga kayu dan perahu, kontainer di pelabuhan,
  zebra cross, dan lampu jalan. Seed yang sama selalu membangun kota yang sama.
- **Jalan kaki + mengemudi** — fisika mobil arcade (akselerasi, belok ikut
  kecepatan, rem tangan), 7 model mobil dari Burro sampai Flecha, plus taksi
  kuning dan truk boks Camion. Mobil polisi berkedip merah-biru; lampu depan
  menyala di malam hari.
- **Lalu lintas & pejalan kaki** — mobil lalu lintas mengikuti jalan dan belok
  di persimpangan, pejalan kaki berjalan di trotoar dan kabur saat ada tembakan.
- **Curi mobil** — mobil parkir dan mobil lalu lintas (sopirnya kabur).
  Mobil misi (Flecha panas, taksi) selalu diprioritaskan saat menekan E.
- **Wanted** — kejahatan yang disaksikan menaikkan panas 0–5 bintang; polisi
  jalan kaki mengejar dan menangkap, mobil patroli menabrak (dengan jeda antar
  tabrakan), dan di bintang 4–5 helikopter polisi mengorbit di atasmu dan
  membuat panasmu tak kunjung dingin. Sembunyi dan panasnya mendingin.
- **8 misi berantai** — cerita dari fixer Doña Carmen: antar paket, curi mobil
  panas, kabur dari kejaran, baku tembak di dermaga, bersih-bersih gudang,
  perampokan Banco Verde, jadi sopir taksi (antar penumpang ke hotel dalam
  75 detik, ada bonus kecepatan), dan balapan jalanan 3 gerbang dengan bonus
  rekor waktu. Misi berwaktu bisa gagal dan diulang dengan N.
- **Kolektibel** — 8 paket tersembunyi Carmen di pinggir jalan seisi kota,
  masing-masing $150, terlacak di HUD dan minimap.
- **Combat** — pistol dengan bidikan mouse, geng Los Halcones yang menembak
  balik, nyawa, armor, dan pickup amunisi / nyawa / uang.
- **HUD + minimap** — bar nyawa & armor, uang, bintang wanted, jam, nama
  distrik, banner misi, timer misi berwaktu, jarak objektif, progres misi dan
  paket, speedometer, dan minimap live dengan blip (termasuk laut, paket,
  helikopter, dan panah arah pemain).
- **Save** — localStorage, autosave tiap misi selesai dan tiap 30 detik,
  lanjutkan dari layar judul; WASTED / BUSTED respawn di rumah sakit dan
  kantor polisi.
- **Suara** — semua disintesis live dengan WebAudio: dengung mesin, sirene,
  tembakan, pickup, dan loop musik prosedural. Tanpa file audio.

## Struktur

- `game/` — game yang dimainkan: `index.html`, `style.css`, `src/*.js`
  (`main.js` boot & loop, `sim.js` simulasi, `city.js` kota prosedural,
  `missions.js` cerita, `draw.js` gambar & HUD, `sound.js` suara synth,
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
