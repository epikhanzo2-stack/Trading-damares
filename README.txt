DAMARES GILA ONLINE — PAKET AWAL SIAP DIPASANG
================================================

ISI FITUR
- Pendaftaran dan login pemain.
- Satu market bersama untuk semua pemain (Socket.IO).
- Chart candlestick.
- Saldo awal 10.000 BRAY untuk tiap akun.
- Posisi BUY/SELL, lot, tutup posisi, P/L, riwayat.
- Panel admin di /admin untuk mengatur harga, arah, speed, pause, gerakan dan lonjakan.
- Permintaan hadiah DANA Rp500, DANA Rp1.000, dan T-shirt; alur verifikasi admin.
- Data pemain, posisi, dan histori disimpan di SQLite.

PENTING
Ini adalah MVP/starter yang perlu diuji sebelum dipakai publik. Ini bukan situs yang sudah online.
Tidak ada deposit atau pembelian poin. Poin adalah virtual. Market simulasi dikendalikan admin,
bukan harga pasar sungguhan. Hadiah tunduk pada verifikasi dan ketersediaan admin.
Rumus P/L sederhana: perubahan harga x lot. Tidak ada margin, leverage, likuidasi atau spread MT5.

PERSIAPAN SERVER (Ubuntu 22.04/24.04)
1. Pasang Node.js 20 atau lebih baru.
2. Upload dan ekstrak ZIP ke folder server, misalnya /opt/damares-gila.
3. Jalankan: npm install
4. Salin .env.example menjadi .env.
5. Buat hash password admin di komputer/server:
   node -e "console.log(require('bcryptjs').hashSync('PASSWORD_ADMIN_KAMU',12))"
   Ganti PASSWORD_ADMIN_KAMU dengan password kuat pilihanmu secara lokal. Jangan kirim ke siapa pun.
6. Tempel hasil hash ke ADMIN_PASSWORD_HASH di .env.
7. Isi SESSION_SECRET dengan string acak panjang minimal 32 karakter.
8. Pastikan NODE_ENV=production dan PORT=3000.
9. Jalankan: npm start
10. Buka port 3000 di firewall server untuk tes. Untuk publik, pasang domain + HTTPS reverse proxy (Nginx/Caddy).

AKSES
- Pemain: https://DOMAIN-KAMU/
- Admin: https://DOMAIN-KAMU/admin

KEAMANAN DAN OPERASIONAL SEBELUM PUBLIK
- Wajib HTTPS; jangan gunakan HTTP untuk akun publik.
- Buat backup berkala untuk damares-gila.sqlite dan sessions.sqlite.
- Jalankan proses dengan systemd/PM2 agar otomatis hidup kembali.
- Batasi akses /admin dengan password kuat; jangan bagikan file .env.
- Uji multi-user, transaksi serentak, pemulihan backup, dan permintaan hadiah.
- Untuk server gratis, periksa ketentuan dan batas pemakaian provider; gratis tidak dijamin selalu tersedia.

CATATAN TEKNIS
- Market berjalan selama proses Node.js di server aktif, bukan ketika semua browser tertutup.
- Jika server mati, market berhenti sampai proses hidup kembali. Untuk operasi 24/7, server harus tetap menyala.
- Library chart dimuat dari CDN, sehingga browser perlu internet.
- Untuk produksi skala besar, pertimbangkan PostgreSQL, CSRF protection, audit log, monitoring,
  validasi tambahan, pengelolaan sesi dan backup yang lebih kuat.
