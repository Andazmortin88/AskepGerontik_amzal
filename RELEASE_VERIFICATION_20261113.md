# Pemeriksaan rilis Askep Gerontik - 13 November 2026

Rilis mempertahankan portofolio dan arsip lama. Dashboard V6 dibedakan menurut peran resmi dari server. Publikasi dilakukan melalui PR #2 setelah gerbang pengujian lulus; status merge dan deployment GitHub merupakan catatan publikasi definitif.

## Perubahan yang diterbitkan

- Mahasiswa: identitas, 17 instrumen, interpretasi, head-to-toe termasuk kulit/luka, askep, kiriman mingguan, komentar/pengingat, logbook, kompetensi, refleksi, kehadiran, PDF dan sumber belajar. Status lengkap tidak menggantikan penilaian dosen.
- Dosen: ringkasan seluruh peserta bimbingan, progres setiap minggu, rincian isian belum lengkap, kiriman dan permintaan revisi, PDF/komentar, pengingat, pengaturan jadwal dan ekspor penelitian.
- Kiriman merupakan snapshot tersimpan. Minggu yang dikirim terkunci sampai dosen meminta revisi; mahasiswa tetap dapat melanjutkan minggu lainnya. PDF kiriman terikat pada pemilik, minggu, ID kiriman dan revisi sumber.
- Jadwal dua minggu dimulai hari Senin. Tenggat Jumat pukul 23:59 WIB; pengiriman terlambat tetap diterima dan diberi status. Jadwal baru tidak menulis ulang riwayat tenggat kiriman lama. Dosen/superadmin perlu menetapkan tanggal praktik sebenarnya.
- Ekspor CSV mengikuti penugasan dosen. Satu baris per peserta/minggu, memuat 10 variabel demografi dan 131 butir dari 17 instrumen beserta metadata, jawaban asli yang tersedia, skor dan kelengkapan. Kamus mencakup 868 kolom. Kosong tidak diubah menjadi nol; formula spreadsheet dinetralkan. Isian askep dan kehadiran tidak ikut diekspor.
- Landing menggunakan gradasi biru-putih, aksen bright yellow, tulisan utama lebih besar, menu HP, ilustrasi lansia 1536 x 1024, animasi yang bisa dijeda dan penghormatan terhadap reduced motion. Header dashboard biru langit. Tautan SOP, video dan UKOM tersedia.

## Bukti pemeriksaan

| Pemeriksaan | Hasil dan batas |
| --- | --- |
| 143 tes Node/VM/API | Lulus. Validasi seluruh instrumen/H2T/askep, kontrol peran, CAS/retry, cache akun, XSS, CSV, jadwal, PDF dan pengingat |
| 100 akun bersamaan | Lulus dengan transport dan autentikasi sintetis; membuktikan isolasi state klien, bukan kapasitas login Google atau beban produksi |
| Database nyata | Delapan kelompok pemeriksaan lulus: CAS/isolation; otorisasi dan atomicity jadwal; snapshot, terlambat dan kunci per minggu; review/revisi; ikatan PDF; FINAL lama; antrean/consent/lease; penolakan akses langsung anon/authenticated |
| Integritas data | Seluruh fixture database di-rollback. Jumlah dan fingerprint 1 dokumen, 100 roster, 4 profil, dan 3 arsip PDF identik sebelum/sesudah tes |
| Browser Chromium | 18 menu mahasiswa dan 11 menu dosen dibuka; dashboard desktop/HP, pengiriman/kunci isian dan unduh CSV dosen diperiksa dengan sesi/API sintetis |
| Landing | Lebar 320, 390, 768, 1024 dan 1440; tidak meluber secara horizontal, font dasar minimal 20px dan gambar berhasil dimuat |
| PDF | Dibuat dengan pdfMake 0.2.10 dan font sebenarnya; isi 17 instrumen serta pembatasan minggu diperiksa terpisah dari definisi PDF |
| Endpoint kandidat nyata | Tanpa token 401; Origin asing 403; metode GET 405. API memverifikasi identitas Google dan peran pada server |

Bukti browser dan log dapat dilihat pada [Release QA](https://github.com/Andazmortin88/AskepGerontik_amzal/actions/workflows/release-qa.yml). Semua screenshot, PDF dan CSV CI berisi data SIMULASI. Tidak ada token Google, cookie pengguna atau data pasien nyata yang dimasukkan ke CI.

## Batas operasional yang masih berlaku

1. **Email/WhatsApp otomatis belum aktif.** Belum ada pengirim email terverifikasi dan WhatsApp Business API/template. Worker/cron pengiriman tidak diaktifkan. Pengingat di aplikasi tersedia; jangan menganggapnya telah masuk ke email/WhatsApp.
2. **Daftar peserta masih 100 data uji.** Superadmin perlu mengimpor daftar resmi dan menetapkan penugasan serta tanggal mulai sebelum praktik sebenarnya. Tidak ada tanggal praktik atau tenggat yang ditebak otomatis.
3. **Belum ada uji 100 login Google nyata serentak atau load test backend berskala tersebut.** Login nyata dua peran pernah dilakukan pada rilis sebelumnya. Uji browser rilis ini memakai sesi sintetis; pelaksanaan kelas besar perlu pilot bertahap dan pemantauan.
4. **Video Remotion karakter Andaz belum selesai.** Landing saat ini memakai ilustrasi lansia dan gerak CSS. Ini tidak diklaim sebagai hasil render Remotion atau karakter yang diminta.
5. Advisor Supabase masih mencatat perlindungan kata sandi bocor belum aktif. Alur aplikasi hanya menerima identitas Google terverifikasi. [Penjelasan pengaturan](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Tabel service-only memakai RLS tanpa policy klien dan grant klien dicabut, sebagaimana diuji dengan anon/authenticated.

## Migrasi dan pemulihan

Migrasi additive `learning_weekly_deadlines_pdf_and_reminder_foundation` telah diterapkan dan diuji. Salinan SQL ada di `backend/release-20261113.sql`; menjalankan tes `tests/release-database.sql` memerlukan penggantian fixture `__STATE__` dan sesi pengujian terkontrol. Jangan menjalankan template mentah atau membuat peserta palsu di produksi.

Backend rilis memakai `gerontik-learning-api.ts`, `progress.ts`, `analysis-schema.ts` dan modul ESM `practice-schedule.ts`. Helper JS browser tetap terpisah. Database tidak perlu dihapus untuk rollback frontend/API. Baseline sebelum rilis adalah commit `692cba551a46f6df6688b2fc9f44a7f42b114f43` dan Edge Function versi 5; pertahankan kiriman/arsip baru bila mengembalikan kode. Jangan menghapus tabel atau menimpa state mahasiswa sebagai langkah pemulihan.