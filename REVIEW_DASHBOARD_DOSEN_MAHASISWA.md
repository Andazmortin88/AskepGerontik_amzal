# Review revisi dashboard Askep Gerontik

Status: **draf untuk ditinjau, belum dirilis**. Basis produksi: `692cba551a46f6df6688b2fc9f44a7f42b114f43`. Tidak ada migrasi database, deploy Edge Function, merge, ataupun perubahan data mahasiswa pada pekerjaan ini.

## Hasil yang dapat ditinjau

| Area | Mahasiswa | Dosen |
|---|---|---|
| Beranda | Tugas pribadi, kelengkapan minggu 1 dan 2 | Ringkasan seluruh peserta bimbingan |
| Progres | 17 instrumen, askep, tautan ke isian yang kurang | Persentase tiap minggu, rincian kekurangan, waktu penyimpanan terakhir |
| Kiriman | Tinjau lalu kirim satu minggu; kirim ulang setelah diminta revisi | Baca salinan kiriman, beri komentar, minta revisi atau setujui |
| Pengingat | Kotak pengingat dan tanda dibaca | Kirim pengingat dalam aplikasi ke peserta bimbingan, termasuk yang belum login |
| PDF | Alur pembuatan dan arsip sebelumnya dipertahankan | Pembaca PDF dalam halaman dan kolom komentar per berkas |
| Kulit/luka | Terintegrasi pada head-to-toe modul 11 | Terlihat dalam pengkajian dan salinan kiriman |

Warna court blue, putih, dan bright yellow dipertahankan sebagai identitas; bagian atas dashboard dan pita preview menggunakan biru langit sesuai revisi. Narasi SATRIA dihapus dari aplikasi. Tipografi dashboard diperbesar, fokus keyboard diperjelas, tabel dapat digulir pada layar kecil, dan gerak progress bar mengikuti preferensi reduced motion.

## Temuan penting dan perbaikan

1. Dashboard lama memakai navigasi dan konteks portofolio terpilih yang sama untuk dua peran. Draf menyediakan menu dan ringkasan yang berbeda berdasarkan peran dari server.
2. Pemilih peserta lama hanya menampilkan akun yang sudah tertaut Google. Draf menampilkan seluruh roster bimbingan dan tetap dapat memuat portfolio kosong untuk peserta yang belum login.
3. Validasi final lama menerima seluruh instrumen dan narasi minimal meskipun head-to-toe terstruktur serta evaluasi kosong. Aturan bersama browser/server sekarang memeriksa 131 jawaban instrumen, 72 isian head-to-toe, data dasar, setiap baris analisis/rencana, implementasi, dan evaluasi pada setiap minggu.
4. Persentase diturunkan dari isian wajib, bukan jumlah klik, login, atau hitungan kompetensi terverifikasi. Nilai nol instrumen tetap sah. Persentase dibulatkan ke bawah agar isian yang belum lengkap tidak tampil 100%.
5. Status “Belum dikaji” belum memenuhi kelengkapan. “Tidak dapat dinilai/Tidak relevan” dengan alasan dihitung terdokumentasi, tetapi diberi penanda untuk telaah dosen. Kelengkapan administratif tidak membuktikan ketepatan klinis ataupun kompetensi.
6. Kiriman mingguan menyimpan snapshot tetap dan nomor revisi. Guard SQL menggunakan kunci transaksi pemilik yang sama dengan penyimpanan sebelumnya untuk mencegah perubahan minggu yang sedang diperiksa atau sudah disetujui. Minggu lain tetap dapat dikerjakan. Permintaan berulang menggunakan ID operasi dan pemeriksaan revisi.
7. Akses monitoring, kiriman, komentar, dan pengingat dibatasi di API berdasarkan penugasan dosen; identitas mahasiswa berasal dari autentikasi. Persentase dari klien diabaikan. Tabel baru memakai RLS dan tidak diberikan akses langsung kepada anon/authenticated.
8. Salinan kiriman ditampilkan dengan escaping teks. Input berbentuk baris kosong/null tidak boleh melumpuhkan perhitungan monitoring. Pembacaan state untuk monitoring dibatasi lima dokumen per batch dan tidak mengirim isi klinis mentah ke tabel kelas.
9. Menu kulit/luka terpisah dihilangkan dari navigasi baru. Tautan lama diarahkan ke modul 11. Catatan lama tetap tersedia; catatan tanpa atribut minggu tidak dipindahkan otomatis ke minggu tertentu.

## Batasan yang harus diperhatikan

- Bukti pemeriksaan otomatis ada pada `TEST_RESULTS_ROLE_REVIEW.txt`. Ini pengujian Node/VM, API mock, validasi, dan simulasi konkurensi. Bukan uji browser visual maupun audit penetrasi runtime.
- Simulasi 100 pemilik dokumen tidak membuktikan 100 sesi Google yang benar-benar login atau ketahanan Edge Function produksi.
- `backend/weekly-migration.sql` adalah kandidat SQL untuk satu transaksi, **belum dieksekusi pada database mana pun**. Pemeriksaan sintaks, perilaku konkurensi SQL sesungguhnya, grants/RLS, kapasitas, dan rollback harus diuji pada staging.
- Draf API belum dipasang. Aplikasi aktif masih memakai versi sebelumnya; perbaikan validasi ini belum melindungi produksi sampai rilis yang disetujui dilakukan.
- PDF dan persetujuan kiriman mingguan adalah dua objek review berbeda. PDF yang diunggah klien tidak dianggap sebagai bukti bahwa seluruh isinya sama dengan snapshot kiriman. Dosen dapat memeriksa snapshot dan berkas secara terpisah; draf lanjutan sudah mengikat ID/revisi PDF ke snapshot kiriman; lihat JADWAL_JUMAT_DAN_PDF.md. Pengaitan metadata tidak mengesahkan seluruh isi berkas yang dibuat klien.
- Draf lanjutan menyediakan antrean email/WhatsApp dan contoh scheduler. Pengiriman nyata belum diaktifkan; belum ada email/WhatsApp ke mahasiswa. Lihat SETUP_EMAIL_WHATSAPP.md untuk konfigurasi, persetujuan nomor, template, dan batas status pengiriman.
- Preview menggunakan peserta dan temuan simulasi. Pergantian peran pada preview adalah kontrol demonstrasi; aplikasi autentikasi memakai peran server.

## Cara meninjau

1. Buka `review-preview.html`, lalu pilih Mahasiswa atau Dosen pada bagian atas.
2. Pada mahasiswa, minggu 1 contoh sudah lengkap; minggu 2 sengaja belum lengkap. Coba tautan kekurangan dan alur kirim minggu 1.
3. Beralih ke dosen, buka progres dan isian belum lengkap. Contoh berisi 100 peserta simulasi, termasuk yang belum menautkan akun.
4. Buka Periksa kiriman. Ada satu kiriman contoh untuk diuji dengan komentar/revisi. PDF nyata hanya dapat dinilai pada pengujian autentikasi berikutnya.
5. Preview tidak menyimpan perubahan setelah halaman dimuat ulang dan tidak terhubung ke backend produksi.

## Rekomendasi sebelum rilis

Prioritas berikutnya adalah staging dengan dua peran nyata: kirim minggu 1, cegah perubahan minggu 1, lanjutkan minggu 2, minta revisi, kirim ulang, setujui, dan ulangi dengan dua tab/perangkat serta koneksi terputus. Uji pula peserta tanpa login, dosen tanpa penugasan, dosen lain, PDF lama, dan dokumen FINAL lama. Jangan mengganti status FINAL lama secara otomatis.

Setelah itu lakukan review visual desktop/mobile, keyboard, pembesaran 200%, pembaca PDF, serta uji beban backend yang terukur. Tanggal praktik/tenggat kini dapat diatur dosen atau superadmin; belum ada tanggal yang diaktifkan otomatis. Label terlambat dihitung dari waktu server dan tenggat yang dibekukan pada setiap kiriman. Lihat JADWAL_JUMAT_DAN_PDF.md untuk detail filter, pengaturan, dan PDF.

Rekomendasi akademik: persetujuan dosen harus tetap terpisah dari angka kelengkapan. Alasan instrumen/pemeriksaan yang tidak dapat dilakukan harus dinilai pembimbing; jangan mengisi skor atau temuan normal otomatis untuk mengejar 100%.

## Berkas dan urutan build

Jalankan `node build-learning-v6.cjs`, `node build-completion.cjs`, `node build-progress.cjs`, `node build-reminder-delivery.cjs`, lalu `node build-review-preview.cjs`. Jalankan `node --test tests/*.test.cjs` setelahnya.

Untuk staging yang telah disiapkan, kandidat perubahan database berada dalam satu berkas `backend/weekly-migration.sql`. API memerlukan `backend/gerontik-learning-api.ts` dan `backend/progress.ts`. Jangan memasang frontend draf terhadap API produksi lama.

Rujukan kontrol akses: https://supabase.com/docs/guides/database/postgres/row-level-security dan https://supabase.com/docs/guides/api/securing-your-api.
