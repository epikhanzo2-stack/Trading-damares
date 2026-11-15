DAMARES GILA — PAKET DEPLOY RENDER (UJI PUBLIK)

ISI
- Website pemain dan panel admin
- Panel admin di /admin
- Market simulasi bersama; harga dikendalikan admin
- Akun, saldo, posisi, dan penukaran tersimpan di SQLite lokal

PENTING — STATUS PAKET
Ini paket uji publik, BELUM layak untuk operasional sungguhan/menyimpan data penting.
Render Free memakai filesystem sementara. File SQLite dan sesi dapat hilang saat service restart,
spin down, atau deploy. Render Free juga tidur setelah 15 menit tanpa trafik.
Jangan kumpulkan uang, deposit, data sensitif, atau menjanjikan hadiah nyata.
Untuk peluncuran permanen, database harus dimigrasikan ke PostgreSQL terkelola dan aplikasi
perlu diuji/diamankan lebih lanjut. Harga market adalah simulasi admin, bukan harga pasar riil.

CARA DEPLOY DARI ANDROID
1. Ekstrak ZIP ini di HP. Pastikan file package.json, server.js, folder public, dan render.yaml
   berada di folder utama proyek (bukan di dalam folder tambahan).
2. Buka https://github.com lalu login/buat akun.
3. Tekan + > New repository. Nama: damares-gila. Pilih Private agar kode tidak terbuka umum.
   Tekan Create repository.
4. Di repository, pilih Add file > Upload files. Upload semua isi folder proyek:
   package.json, server.js, render.yaml, .env.example, README, dan folder public.
   Jangan upload folder node_modules atau file .env yang berisi rahasia.
5. Tekan Commit changes.
6. Buka https://render.com lalu daftar/login. Pilih New > Blueprint.
7. Hubungkan GitHub, pilih repository damares-gila, lalu deploy blueprint.
   Jika opsi Blueprint tidak muncul, pilih New > Web Service, pilih repo itu, lalu isi:
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   Instance Type: Free
8. Di halaman service Render > Environment, pastikan:
   ADMIN_USERNAME = admin
   ADMIN_PASSWORD = password admin pilihanmu (isi langsung di Render, jangan di GitHub/chat)
   SESSION_SECRET = string rahasia acak minimal 32 karakter. Jika render.yaml sudah membuat
   nilainya otomatis, jangan diganti dengan teks contoh.
   NODE_ENV = production
   Tekan Save, lalu tunggu deploy selesai.
9. Buka URL berakhiran onrender.com yang muncul di Render.
   Halaman pemain ada di URL utama. Panel admin: tambahkan /admin di belakang URL.
10. Login admin memakai username admin dan password yang kamu masukkan pada langkah 8.

CATATAN PASSWORD
Demi keamanan, password admin tidak ditulis di dalam ZIP/GitHub. Masukkan password yang kamu
pilih langsung ke Environment Variables Render. Jangan kirim password, SESSION_SECRET, atau
screenshot yang menampilkan nilainya kepada siapa pun.

PENGUJIAN
- Buat dua akun pemain percobaan dari dua browser/perangkat.
- Buka /admin, ubah harga market, dan cek perubahan di kedua akun.
- Uji BUY/SELL, tutup posisi, saldo, riwayat, dan permintaan hadiah.
- Jangan gunakan data pribadi. Jangan anggap saldo BRAY sebagai uang sungguhan.

BATASAN RENDER FREE
Service gratis dapat tidur setelah 15 menit tanpa trafik. Saat dibuka lagi, proses bangun bisa
memerlukan waktu. Filesystem lokal bersifat sementara, jadi data SQLite dapat hilang.
Ini tidak menjamin layanan aktif 24 jam dan tidak boleh dipakai untuk layanan yang memerlukan
penyimpanan data permanen.
