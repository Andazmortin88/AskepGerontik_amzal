# Status aktif Askep Gerontik Digital

Diperbarui 13 November 2026 (WIB). Lanjutkan pekerjaan dari checkpoint ini; jangan membangun ulang aplikasi.

## Yang sudah aktif dan diperiksa

- Portal uji: https://andazmortin88.github.io/AskepGerontik_amzal/portal.html
- Login akun: https://andazmortin88.github.io/AskepGerontik_amzal/portal.html?masuk=1
- Alamat root aplikasi lama tetap dipertahankan. Penambahan portal diterbitkan lewat commit 18f5fa379b09267d93f18b05dfdd49ae86ab7bec; GitHub Pages deployment berhasil.
- Backend gerontik-learning-api versi 3 ACTIVE pada proyek Supabase llwedqqzqotrslshfuad. Perbaikan pengulangan penilaian kompetensi sudah terpasang.
- Google OAuth sudah dibuat pada proyek Google Cloud askep-gerontik-digital; client bernama Askep Gerontik Web Login. Secret hanya dimasukkan ke panel penyedia, tidak disimpan di repository atau laporan ini.
- Google provider pada Supabase sudah Enabled; nonce checks tidak dilewati, login tanpa email tidak diizinkan. Site URL menunjuk portal.html; redirect hanya portal.html?masuk=1 dan /?masuk=1 di domain aplikasi yang sama.
- Uji masuk melalui portal -> Google -> Supabase -> dashboard berhasil untuk andazmortin@gmail.com. Server menetapkan Amzal Mortin Andas dengan roles super_admin dan lecturer; dashboard menampilkan kedua peran tersebut.
- Sebelum publikasi OAuth, dua pengguna uji Google telah disimpan: andazmortin@gmail.com dan indahkeperawatan89@gmail.com. Akun Indah berhak lecturer sesuai konfigurasi backend, tetapi login nyata beliau belum diuji.
- Unduhan Excel 100 dummy melalui menu aplikasi berhasil. Uji pemilih berkas/unggah belum selesai karena alat browser kehilangan keterkaitan tab dengan sesi, bukan karena kesalahan aplikasi yang terbukti.
- Transaksi impor backend dibuat memakai fungsi gerontik_learning_import dengan actor super admin yang sudah login terverifikasi. Batch 3a4d1504-b1ea-4ed6-84d3-3c9f3b20137f menghasilkan tepat 100 peserta pada periode uji-v7; pengulangan batch yang identik tidak menambah peserta.
- Kelompok 1–4 masing-masing 25. Penugasan uji: kelompok 1–2 kepada andazmortin@gmail.com, kelompok 3–4 kepada indahkeperawatan89@gmail.com. Ini data sintetis; email mahasiswa masih kosong dan belum merupakan 100 akun Google.
- Pemeriksaan terakhir: 54 FINAL lama dan 2 draf lama tetap ada. Tidak ada isi dokumen mahasiswa lama yang diedit pada pekerjaan ini.
- 29 uji otomatis lokal lulus (10 handler backend, 10 sinkronisasi, 5 kelengkapan dan 4 penggantian sesi akun). Ini bukan hasil uji beban 100 pengguna.

## Batas kesiapan yang masih berlaku

Google OAuth sudah berstatus In production sejak 13 November 2026, setelah persetujuan eksplisit pengguna. Pembatasan login pada daftar dua email uji sudah dilepas. Ini bukan pernyataan bahwa seluruh aplikasi atau beban 100 mahasiswa telah lulus pengujian.

Mahasiswa belum dapat diuji login nyata karena roster dummy belum memiliki email Google dan tidak ada identitas mahasiswa nyata yang disetujui untuk pengujian. Jangan menautkan berdasarkan nama/NIM yang diklaim sendiri atau mengubah peran akun dosen menjadi mahasiswa untuk simulasi.

Belum selesai: unggah Excel dari pemilih berkas ke pratinjau -> konfirmasi -> server; login nyata Indah dan mahasiswa; pemeriksaan mobile/desktop menyeluruh; formulir klinik tertanam, PDF, uji browser untuk koreksi FINAL dan kelengkapan, konflik versi lintas perangkat, load test 100 pengguna, dan pemulihan cadangan. Frontend masih memakai implementasi pilot yang perlu dituntaskan pada bagian tersebut.

## Sumber dan langkah lanjutan

Main sudah memiliki portal.html, portal.css, portal.js, sync.js, clinical.html, clinical-bridge.js dan legacy.html. Root index.html belum diganti.

Draft PR: https://github.com/Andazmortin88/AskepGerontik_amzal/pull/1. Cabang fix/learning-review-retry juga berisi source backend dan pengujian; dokumen FRONTEND_STATUS.md yang lebih lama di cabang masih mencatat keadaan sebelum OAuth aktif. Gunakan CURRENT_STATUS.md ini sebagai status terbaru.

Pertahankan akun: Amzal Mortin Andas super admin + dosen; Indah Puspitasari dosen. Pertahankan arsip periode lama. Prioritas berikutnya: uji end-to-end koreksi FINAL dan gerbang kelengkapan, uji frontend publik dengan akun yang benar, lengkapi branding/publikasi OAuth dan roster email, baru lakukan gerbang peluncuran penuh.

## Pembaruan lanjutan: koreksi FINAL

Backend versi 3 memeriksa kelengkapan pengkajian dua minggu berdasarkan 17 definisi instrumen yang dipertahankan dari aplikasi lama, analisis/rencana/implementasi asuhan, sepuluh logbook dan dua refleksi mingguan. Frontend menampilkan persyaratan yang sama. Dosen yang berwenang dapat membuka kembali dokumen FINAL dengan alasan tercatat dan expectedRevision; mahasiswa tetap tidak berwenang membuka sendiri. Snapshot FINAL dipertahankan dan revisi DRAFT baru dibuat.

Fungsi gerontik_learning_reopen hanya dapat dipanggil service_role. Uji transaksi nyata pada data sintetis memeriksa penolakan actor tak berwenang, perubahan status/revisi, retry idempotent, penolakan reason berbeda pada operationId sama, keutuhan state, retensi snapshot dan penolakan save usang. Seluruh data uji transaksi di-rollback dan pemeriksaan setelahnya menemukan nol baris periode _audit_reopen_20261112. Roster uji tetap 100; arsip lama tetap 54 FINAL dan 2 draf. UI alur koreksi belum diuji menggunakan mahasiswa nyata.

## Lanjutan 13 November 2026: pemulihan antrean dan sesi akun

Tidak membangun ulang aplikasi. Deployment versi backend 3 sebelumnya telah berhasil. Pemeriksaan agregat tetap menunjukkan roster 100, profil Google 1, dokumen pembelajaran baru 0, arsip lama 54 FINAL dan 2 draf.

Perbaikan frontend: konflik 409 saat mengulang antrean lama kini membuka pemulihan konflik beserta unduhan salinan lokal, bukan terus menghalangi pemuatan akun. Isian baru ditolak ketika pengiriman FINAL masih menunggu kepastian. Permintaan API kini memeriksa generasi sesi sebelum dikirim dan setelah respons diterima, sehingga permintaan lama dibatalkan saat akun berubah. Empat uji sesi dan sepuluh uji sinkronisasi termasuk dalam total 29 uji lokal yang lulus.

Browser: dashboard memuat 100 peserta/4 kelompok; daftar bimbingan berisi 100 baris dan pencarian UJI0100 menghasilkan peserta Uji 100 pada kelompok 4. Menu tinjauan tanpa peserta terpilih menunjukkan permintaan pemilihan yang sesuai; arsip PDF menunjukkan kosong, bukan data akun lain. Halaman manajemen peserta diperiksa pada viewport 375x812 dan 1440x1000; lebar dokumen sama dengan area tampilan setelah scrollbar (360/1425 piksel), tanpa overflow halaman. Ukuran browser dikembalikan setelah pengujian.

Halaman privacy.html ditambahkan untuk menjelaskan data Google, portofolio, peran, penyimpanan, layanan pihak ketiga dan kontak pengelola berdasarkan implementasi. Tautannya ditambahkan pada portal dan halaman masuk. Publikasi OAuth, email Google mahasiswa, uji login nyata Indah/mahasiswa, unggah Excel lewat pemilih berkas, PDF end-to-end, beban 100 pengguna serta pemulihan cadangan tetap merupakan pekerjaan tersisa; pemeriksaan ini tidak menggantikannya.

## Publikasi Google Login — 13 November 2026

Pengguna menyetujui perubahan mode publikasi. Tombol Publish app dan Confirm dijalankan pada proyek askep-gerontik-digital. Halaman Audience kemudian menampilkan Publishing status: In production dan tombol Back to testing. Tidak menambah scope atau mengubah peran aplikasi. Tautan homepage dan privacy.html telah tersimpan di Branding.

Akun Google di luar dua email uji dapat memulai login. Akun yang belum cocok dengan roster tetap pending tanpa akses portofolio mahasiswa lain; super admin memverifikasi dan menautkan identitas melalui alur yang sudah ada. Roster dummy masih belum memiliki email Google. Uji nyata mahasiswa/Indah dan uji beban 100 pengguna tetap belum dilakukan. Jangan mengulang pembuatan OAuth, mengganti secret, atau mengembalikan mode Testing ketika melanjutkan pekerjaan.
