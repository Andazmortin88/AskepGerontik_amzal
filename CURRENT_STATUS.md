# Status aktif Askep Gerontik - 13 November 2026

Lanjutkan dari rilis ini. Jangan membangun ulang atau menimpa data mahasiswa.

- Frontend V6 diterbitkan melalui PR #2: dashboard mahasiswa 18 menu dan dosen 11 menu, monitoring mingguan, isian belum lengkap, pengiriman/revisi, PDF dan ekspor analisis CSV.
- Backend `gerontik-learning-api` versi **6 ACTIVE**, bundle SHA-256 `f4c5e3b4effe0605e4b22cf8dc375524a2c47802d125006cf5fa2dd516ab9dc7`, sama dengan kandidat yang diuji.
- Database: migrasi additive `learning_weekly_deadlines_pdf_and_reminder_foundation` sudah diterapkan. Delapan kelompok uji nyata berhasil dan seluruh fixture di-rollback. Dokumen, roster, profil dan PDF lama tetap sama.
- Verifikasi kode fungsional: commit `a6113c66636e3f6fb76808b622c3cd3f8ed2ad83`, Release QA run **43442139625** lulus. 143 tes, 18/11 menu Chromium PC/HP, landing 320-1440, PDF asli dan teksnya, unduh CSV dan penolakan akses anonim/Origin asing.
- URL aplikasi: https://andazmortin88.github.io/AskepGerontik_amzal/portal.html
- Status publikasi frontend definitif: https://github.com/Andazmortin88/AskepGerontik_amzal/pull/2 dan deployment GitHub Pages untuk commit merge tersebut.
- Rincian hasil/batas: [RELEASE_VERIFICATION_20261113.md](RELEASE_VERIFICATION_20261113.md).

## Pengaturan sebelum praktik sebenarnya

Roster masih 100 peserta dummy, periode `uji-v7`. Dua akun uji sudah tertaut. Superadmin Amzal/Andaz dan dosen Indah tetap mengikuti peran server. Impor daftar resmi serta atur penugasan dan tanggal mulai melalui akun dosen/superadmin. Tidak ada tanggal praktik yang diaktifkan otomatis.

Tenggat Jumat 23:59 WIB. Kiriman terlambat tetap diterima dengan label, dan riwayat tenggat tidak dihitung ulang ketika jadwal diubah. Persetujuan dosen berbeda dengan persentase kelengkapan.

Pengingat di aplikasi tersedia. Email/WhatsApp otomatis **belum aktif**: pengirim email terverifikasi, kredensial dan template WhatsApp belum tersedia. Jangan mengaktifkan worker/cron atau menyatakan pesan sudah terkirim sebelum konfigurasi dan uji pengiriman yang disetujui.

Belum ada uji 100 login Google nyata bersamaan/load test produksi. Uji 100 akun menggunakan transport sintetis. Lakukan pilot bertahap sebelum kelas besar. Video Remotion karakter Andaz belum dirender; landing memakai ilustrasi lansia dan gerak CSS.

Baseline rollback: frontend commit `692cba551a46f6df6688b2fc9f44a7f42b114f43`, Edge versi 5. Pertahankan seluruh data dan tabel baru saat rollback kode.