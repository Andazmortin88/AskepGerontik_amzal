# Integrasi frontend Askep Gerontik

12 November 2026 (WIB). Status: integrasi pengembangan; belum siap diluncurkan.

Landing page: portal.html. Dashboard mahasiswa, dosen, dan super admin memakai portal.js, portal.css dan sync.js. Formulir klinik dari index.html lama dipertahankan pada clinical.html dan disambungkan ke penyimpanan portofolio melalui clinical-bridge.js. Arsip aplikasi lama dipertahankan sebagai legacy.html. index.html pada main belum diganti.

Fitur: Google OAuth PKCE, peran dari server, dashboard berdasarkan penugasan, pengkajian dua minggu dan 17 instrumen lama, logbook/refleksi/kehadiran/bukti kompetensi, review rubrik dosen, impor Excel dengan pratinjau dan pemeriksaan formula/NIM teks/duplikasi, penugasan pembimbing, penautan akun terverifikasi, unggah dan tinjauan PDF privat, antrean simpan per akun, konflik versi dan salinan lokal.

Validasi: 8 uji handler backend dan 8 uji sinkronisasi lokal lulus. Pemeriksaan sintaks portal.js dan sync.js lulus. Pengujian browser belum selesai: browser pengujian tidak dapat mengakses server localhost; penggunaan browser Windows kemudian dihentikan karena URL aktif tidak dapat dipastikan dengan aman. Tidak ada uji login Google nyata, uji end-to-end atau uji beban 100 pengguna pada sesi ini.

Hambatan autentikasi telah diperiksa langsung pada Supabase Dashboard: Google Disabled; Client IDs dan Client Secret kosong. Kredensial harus dimasukkan oleh pemilik pada panel penyedia, bukan pada chat/source code. Callback: https://llwedqqzqotrslshfuad.supabase.co/auth/v1/callback. Redirect aplikasi yang perlu diizinkan setelah penentuan URL publik: https://andazmortin88.github.io/AskepGerontik_amzal/?masuk=1 atau URL portal.html yang benar-benar diterbitkan. Periksa juga Google Cloud audience/test users sesuai status aplikasi.

Pekerjaan tersisa sebelum rilis: aktifkan Google OAuth; uji bootstrap kedua akun dosen yang disetujui; impor/penautan peserta; uji akun mahasiswa lintas kepemilikan; selesaikan browser desktop/mobile; verifikasi alur cetak PDF, pengajuan revisi setelah FINAL/pembukaan ulang, kelengkapan finalisasi, penanganan konflik, dan perilaku login saat provider tidak aktif; lalu uji beban dan pemulihan sesuai audit sebelumnya. Jangan menyebut versi ini telah lulus seluruh gerbang kesiapan.

Jalankan pengujian lokal: node --test tests/learning-api.test.cjs tests/sync.test.cjs. Server fixture lokal: node tests/preview-server.cjs. Fixture hanya untuk pengujian UI dan menggunakan identitas sintetis; tidak terhubung ke data produksi. Jangan menyebarkan fixture sebagai login produksi.
