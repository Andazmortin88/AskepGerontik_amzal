# Jadwal praktik, kiriman terlambat, dan PDF

Status: **draf review; belum diterapkan ke aplikasi/database produksi**.

## Keputusan pengguna

- Praktik dua minggu; setiap minggu lima hari Senin–Jumat.
- Batas pengiriman setiap Jumat. Implementasi memakai pukul 23.59 WIB (akhir Jumat).
- Setelah tenggat, mahasiswa tetap dapat mengirim tugas yang lengkap. Kiriman diberi label **Terlambat mengirimkan**, terpisah dari keputusan review dosen.
- Tanggal praktik diatur kemudian melalui akun dosen/superadmin. **Tidak ada tanggal aktif yang dibuat sekarang**, karena belum ada praktik baru yang dijadwalkan.
- WhatsApp Business API belum tersedia. Opsi WhatsApp dinonaktifkan bila layanan belum terhubung; email diprioritaskan. Belum ada email atau WhatsApp nyata yang dikirim.

## Pengaturan dosen dan superadmin

Tombol **Atur jadwal praktik** tersedia pada ringkasan/monitoring dosen. Dosen memilih kelompok dari peserta bimbingannya atau seluruh peserta bimbingan yang tampil pada tabel, tanggal Senin pertama, aktivasi jadwal, dan batas hari kerja tanpa penyimpanan untuk penanda tidak aktif. Superadmin dapat mengatur semua peserta yang menjadi cakupannya.

Backend memeriksa target peserta berdasarkan penugasan, bukan label kelompok yang dikirim klien. Penyimpanan jadwal mengunci dan memeriksa seluruh revisi target sebelum memperbarui baris mana pun. Dua pengajar tidak boleh diam-diam menimpa jadwal dari tampilan lama.

Minggu pertama berakhir Jumat pertama; minggu kedua Jumat berikutnya. Tidak ada pembatasan pengiriman setelah tanggal tersebut. Ketepatan waktu diambil dari jam database saat menerima kiriman, bukan jam perangkat atau nilai `is_late` dari klien. Setiap kiriman menyimpan tenggat dan versi jadwal yang berlaku pada waktu itu. Perubahan jadwal setelahnya tidak mengganti label historis. Kiriman lama tanpa tenggat tidak diberi label terlambat secara retroaktif.

Pengiriman ulang setelah revisi menghasilkan percobaan baru dengan waktu/tenggatnya sendiri; percobaan awal dan labelnya tetap dipertahankan. Label terlambat pada kiriman perbaikan tidak menghapus bukti bahwa kiriman awal mungkin tepat waktu.

## Filter monitoring

Filter tersedia untuk semua peserta, belum mulai, tidak aktif sesuai jadwal, lewat tenggat tetapi belum mengirim, dan terlambat mengirimkan; pencarian nama/NIM tetap tersedia.

Penanda tidak aktif memakai hari kerja lengkap tanpa penyimpanan, melewati Sabtu/Minggu, dan tidak aktif sebelum jadwal dimulai atau ketika jadwal belum ditetapkan. Nilai awal tiga hari kerja dapat diatur dosen (1–10). Aktivitas yang diukur adalah perubahan tersimpan, bukan sekadar login. Ini indikator tindak lanjut, bukan penetapan nilai atau ketidakhadiran.

## PDF dari versi kiriman

Mahasiswa membuat PDF melalui tombol **Buat & arsipkan PDF kiriman** pada kiriman mingguan tersimpan. PDF disusun dari snapshot minggu tersebut, menyertakan ID kiriman, percobaan, revisi dokumen, waktu diterima, tenggat, dan ketepatan waktu. Identitas/demografi, jawaban 17 instrumen, head-to-toe, dan askep berasal dari minggu yang sama. Pilihan jawaban asli dicetak jika indeks pilihan tersimpan; aplikasi tidak menebak pilihan berbeda yang memiliki skor sama.

Mahasiswa dapat melanjutkan minggu kedua tanpa mengubah sumber PDF minggu pertama. API unggah mensyaratkan ID kiriman milik mahasiswa dan revisi sumber yang cocok, bukan revisi draft terbaru. Trigger database menolak tautan pemilik/periode/revisi yang tidak cocok dan mencegah perubahan pengaitan setelahnya.

PDF lama dipertahankan dengan label arsip lama yang belum terikat; tidak ditautkan otomatis. Review PDF tetap menjadi review berkas, terpisah dari persetujuan tugas mingguan. Pengaitan ID/revisi ini bukan tanda tangan digital atau pemeriksaan server atas seluruh isi PDF; data snapshot tetap menjadi rujukan dosen. Pembuatan PDF aktual di browser dan alur storage masih harus diuji di staging.

Pada dashboard baru, pengiriman dilakukan per minggu agar tenggat dan sumber PDF tercatat. Finalisasi portofolio utuh melalui jalur kompatibilitas lama bukan pengganti kiriman mingguan dan tidak diberi label tepat waktu secara otomatis. Dokumen FINAL lama tidak dibuka atau diubah otomatis; pembukaan koreksi tetap harus dilakukan dosen bila diperlukan.

## Pengujian dan pemasangan staging

Hasil tes Node/VM/API mock ada di `TEST_RESULTS_ROLE_REVIEW.txt`. Pemeriksaan SQL baca-saja telah mengonfirmasi bahwa Jumat 20 November 2026 pukul 23.59.59,999 WIB sama dengan 16.59.59,999 UTC, dan Sabtu pukul 00.00 WIB berada setelah tenggat. Tanggal tersebut hanya contoh uji, bukan jadwal praktik yang diaktifkan.

SQL baru belum dieksekusi. Urutan kandidat staging setelah SQL mingguan/pengingat sebelumnya:

1. `backend/friday-deadlines.sql` — jadwal peserta, tenggat, dan pencatatan waktu kiriman.
2. `backend/pdf-submission-binding.sql` — pengaitan PDF dan guard sumber.
3. API draf beserta `backend/progress.ts` dan `backend/practice-schedule.js`, lalu frontend versi yang sesuai.

Build: `node build-practice-schedule.cjs`, `node build-learning-v6.cjs`, `node build-completion.cjs`, `node build-progress.cjs`, `node build-reminder-delivery.cjs`, `node build-review-preview.cjs`, lalu `node --test tests/*.test.cjs`.

Uji staging wajib mencakup Jumat tepat batas, Sabtu setelah batas, perubahan jadwal bersamaan dengan kiriman, revisi/perubahan jadwal historis, dosen lain, mahasiswa tanpa jadwal, PDF minggu pertama sesudah draft minggu kedua berubah, kegagalan unggah, dan arsip PDF lama. Belum ada deploy, perubahan jadwal nyata, atau pengiriman pesan ke mahasiswa.
