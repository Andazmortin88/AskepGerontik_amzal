# Status aktif Askep Gerontik Digital

Diperbarui 13 November 2026 WIB. **Lanjutkan dari implementasi ini, jangan membangun ulang.**

## Checkpoint
- V6 terintegrasi, 18 menu asli + Arsip PDF privat, dashboard mahasiswa/dosen autentik. Login portal mengarahkan ke V6. Portal manajemen tetap di portal.html?masuk=1&classic=1.
- URL rilis: https://andazmortin88.github.io/AskepGerontik_amzal/learning-v6.html?rilis=20261113-v6
- Rilis utama 13f45769df7b6b2791499a1597fafe3a334cbf72 berhasil GitHub Pages. Backend gerontik-learning-api versi 4 aktif.
- Sumber V6 dan tema disimpan di v6-source/; node build-learning-v6.cjs dapat meregenerasi frontend tanpa berkas preview eksternal.
- 64 tes lulus. Detail cakupan dan batas: AUDIT_V6_20261113.md.
- Uji nyata: mahasiswa UJI0001 → kompetensi → simpan/reload → PDF privat → FINAL revisi 34 → dosen membaca/review → buka koreksi revisi 35 → mahasiswa menerima komentar dan mengajukan ulang.
- Dokumen uji terakhir revisi 39 DRAFT, learningVersion 6. Dua catatan head-to-toe berbeda per minggu dan satu catatan kulit tersimpan; narasi fisik lama dipertahankan.
- PDF 267007 byte, revisi sumber 33, review Perlu revisi, review_revision 1. Tetap menjadi arsip versi lama setelah dokumen diperbarui.
- Amzal super admin + dosen; Indah dosen. Roster 100 dummy, periode uji-v7. Dua email mahasiswa uji ditautkan ke UJI0001/UJI0002; baru UJI0001 menjalani login/browser.
- Tidak ada penghapusan/penimpaan arsip klinis lama. Data uji sintetis ditandai AUDIT, bukan nilai kompetensi nyata.

## Keputusan penggunaan
Siap untuk pilot terawasi pada periode uji, belum klaim peluncuran massal 100 Google login. Uji 100 pengguna yang lulus memakai transport/auth tiruan, tanpa panggilan produksi. Google dosen dan mahasiswa diuji bergantian, bukan sesi terisolasi serentak.

## Yang belum selesai
- Login UJI0002 dan Indah, isolasi dua akun serentak, beban produksi 100 pengguna.
- Keamanan menyeluruh, kontras/aksesibilitas dan verifikasi konten klinis resmi.
- Video sumber kedua dan jalur unggah PDF dari pemilih berkas; arsip langsung PDF hasil aplikasi telah berhasil.
- Pemeriksaan individual semua 72 field V6, screenshot visual akhir dan pemuatan ulang terakhir.
- Sambungan perangkat terputus setelah uji mobile 375 × 812. Reset viewport telah dicoba tetapi tidak mendapat konfirmasi; periksa/reset setelah tersambung. Jangan mengaku screenshot akhir tersimpan.
- Jangan merge cabang/PR lama yang bisa menimpa main. Gunakan expected SHA saat update ref.

## Langkah lanjutan
Hubungkan kembali perangkat, buka URL rilis di atas, lanjutkan pengujian tersisa. Dokumen uji dan review sudah berada di Supabase; jangan memasukkan ulang data dari awal. Gunakan AUDIT_V6_20261113.md sebagai bukti penerimaan terbaru. Catatan audit/status lama merupakan riwayat, bukan kondisi terkini.
