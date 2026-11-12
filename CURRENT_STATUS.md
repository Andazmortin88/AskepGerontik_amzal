# Status aktif Askep Gerontik Digital

Diperbarui 12 November 2026 (WIB). Lanjutkan pekerjaan dari checkpoint ini; jangan membangun ulang aplikasi.

## Yang sudah aktif dan diperiksa

- Portal uji: https://andazmortin88.github.io/AskepGerontik_amzal/portal.html
- Login akun: https://andazmortin88.github.io/AskepGerontik_amzal/portal.html?masuk=1
- Alamat root aplikasi lama tetap dipertahankan. Penambahan portal diterbitkan lewat commit 18f5fa379b09267d93f18b05dfdd49ae86ab7bec; GitHub Pages deployment berhasil.
- Backend gerontik-learning-api versi 2 ACTIVE pada proyek Supabase llwedqqzqotrslshfuad. Perbaikan pengulangan penilaian kompetensi sudah terpasang.
- Google OAuth sudah dibuat pada proyek Google Cloud askep-gerontik-digital; client bernama Askep Gerontik Web Login. Secret hanya dimasukkan ke panel penyedia, tidak disimpan di repository atau laporan ini.
- Google provider pada Supabase sudah Enabled; nonce checks tidak dilewati, login tanpa email tidak diizinkan. Site URL menunjuk portal.html; redirect hanya portal.html?masuk=1 dan /?masuk=1 di domain aplikasi yang sama.
- Uji masuk melalui portal -> Google -> Supabase -> dashboard berhasil untuk andazmortin@gmail.com. Server menetapkan Amzal Mortin Andas dengan roles super_admin dan lecturer; dashboard menampilkan kedua peran tersebut.
- Dua pengguna uji Google tersimpan: andazmortin@gmail.com dan indahkeperawatan89@gmail.com. Akun Indah berhak lecturer sesuai konfigurasi backend, tetapi login nyata beliau belum diuji.
- Unduhan Excel 100 dummy melalui menu aplikasi berhasil. Uji pemilih berkas/unggah belum selesai karena alat browser kehilangan keterkaitan tab dengan sesi, bukan karena kesalahan aplikasi yang terbukti.
- Transaksi impor backend dibuat memakai fungsi gerontik_learning_import dengan actor super admin yang sudah login terverifikasi. Batch 3a4d1504-b1ea-4ed6-84d3-3c9f3b20137f menghasilkan tepat 100 peserta pada periode uji-v7; pengulangan batch yang identik tidak menambah peserta.
- Kelompok 1–4 masing-masing 25. Penugasan uji: kelompok 1–2 kepada andazmortin@gmail.com, kelompok 3–4 kepada indahkeperawatan89@gmail.com. Ini data sintetis; email mahasiswa masih kosong dan belum merupakan 100 akun Google.
- Pemeriksaan terakhir: 54 FINAL lama dan 2 draf lama tetap ada. Tidak ada isi dokumen mahasiswa lama yang diedit pada pekerjaan ini.
- 16 uji otomatis lokal lulus (8 handler backend dan 8 sinkronisasi). Ini bukan hasil uji beban 100 pengguna.

## Batas kesiapan yang masih berlaku

Google OAuth masih berstatus Testing, dengan batas pengguna uji yang ditampilkan Google 100. Jangan menyatakan siap 100 mahasiswa ditambah dosen sebelum konfigurasi publikasi/branding dan kebutuhan pengguna Google dituntaskan. Hanya dua email dosen di atas yang telah didaftarkan sebagai test users.

Mahasiswa belum dapat diuji login nyata karena roster dummy belum memiliki email Google dan tidak ada identitas mahasiswa nyata yang disetujui untuk pengujian. Jangan menautkan berdasarkan nama/NIM yang diklaim sendiri atau mengubah peran akun dosen menjadi mahasiswa untuk simulasi.

Belum selesai: unggah Excel dari pemilih berkas ke pratinjau -> konfirmasi -> server; login nyata Indah dan mahasiswa; pemeriksaan mobile/desktop menyeluruh; formulir klinik tertanam, PDF, revisi setelah FINAL/pembukaan ulang, validasi kelengkapan FINAL, konflik versi lintas perangkat, load test 100 pengguna, dan pemulihan cadangan. Frontend masih memakai implementasi pilot yang perlu dituntaskan pada bagian tersebut.

## Sumber dan langkah lanjutan

Main sudah memiliki portal.html, portal.css, portal.js, sync.js, clinical.html, clinical-bridge.js dan legacy.html. Root index.html belum diganti.

Draft PR: https://github.com/Andazmortin88/AskepGerontik_amzal/pull/1. Cabang fix/learning-review-retry juga berisi source backend dan pengujian; dokumen FRONTEND_STATUS.md yang lebih lama di cabang masih mencatat keadaan sebelum OAuth aktif. Gunakan CURRENT_STATUS.md ini sebagai status terbaru.

Pertahankan akun: Amzal Mortin Andas super admin + dosen; Indah Puspitasari dosen. Pertahankan arsip periode lama. Prioritas berikutnya: tuntaskan alur koreksi FINAL dan gerbang kelengkapan, uji frontend publik dengan akun yang benar, lengkapi branding/publikasi OAuth dan roster email, baru lakukan gerbang peluncuran penuh.
