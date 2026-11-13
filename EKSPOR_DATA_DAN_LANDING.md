# Ekspor data analisis dan revisi landing page

Status: **draf review, belum di-deploy**. Tidak ada data pasien nyata yang diekspor selama pekerjaan ini.

## Menu Ekspor data analisis

Menu tersedia pada akun dosen dan superadmin. Dosen hanya dapat mengambil peserta bimbingannya; superadmin dapat mengambil seluruh peserta aktif pada periode yang dipilih. Endpoint memeriksa setiap ID peserta, peran, dan periode di server. Permintaan mahasiswa atau target di luar penugasan ditolak.

Pilihan ekspor:

- Seluruh peserta bimbingan atau kelompok tertentu.
- Minggu pertama, kedua, atau keduanya.
- **Isian terbaru termasuk draf** (`saved_latest`), atau **kiriman terbaru tiap minggu** (`submission_latest`).
- Semua baris terisi, atau hanya baris dengan 17 instrumen lengkap dan tanpa pertentangan opsi/skor.
- CSV titik koma/desimal koma untuk Excel Indonesia, atau CSV koma/desimal titik untuk perangkat analisis.

Satu baris berarti **satu mahasiswa × satu minggu**, bukan otomatis satu pasien yang berbeda. Kode/inisial lansia dipertahankan sesuai isian. Pasien yang sama mungkin dicatat lebih dari satu mahasiswa atau minggu; aplikasi tidak menggabungkan atau menganggapnya independen secara otomatis.

## Isi CSV

CSV memuat metadata peserta/kelompok/periode, minggu, sumber, revisi dan waktu simpan, serta ID/percobaan/status kiriman jika sumber berupa kiriman. Ketepatan waktu dikodekan 1 terlambat, 0 tepat waktu, kosong jika belum ada tenggat tercatat.

Sepuluh variabel demografi: kode/inisial lansia, usia, jenis kelamin, status perkawinan, pendidikan, pekerjaan terakhir, lama tinggal di panti, tempat tinggal saat ini, riwayat penyakit, dan obat-obatan. Usia yang dapat dibaca sebagai angka valid diekspor sebagai numerik; kolom usia mentah tetap disertakan untuk peninjauan.

Seluruh **131 butir pada 17 instrumen** disertakan dengan skor tersimpan, isian skor mentah, indeks opsi, teks jawaban asli yang tersedia, serta penanda kecocokan opsi dan skor. Setiap instrumen juga memiliki jumlah butir valid, penanda lengkap, dan jumlah skor butir yang hanya dihitung jika seluruh butir valid.

**Skor sudah mengikuti pengkodean aplikasi, termasuk pembalikan skor pada opsi. Jangan membaliknya lagi tanpa memeriksa kamus.** Jumlah skor butir bukan otomatis indeks transformasi WHOQOL atau skor ringkasan standar instrumen lain. Ekspor tidak menambahkan interpretasi klinis atau mengisi hasil normal.

Kamus variabel CSV memuat label setiap kolom, pertanyaan asli, tipe data, pilihan jawaban, dan pemetaan skor dari definisi aplikasi yang sama. Jika data lama hanya menyimpan skor dan tidak menyimpan opsi, pilihan asli tidak ditebak, terutama ketika beberapa pilihan mempunyai skor sama.

## Kualitas data dan keamanan file

- Kosong tetap kosong; angka nol tetap angka nol.
- Skor di luar domain tidak dimasukkan ke kolom skor valid. Nilai sumber tetap tersedia pada kolom mentah, disertai hitungan jawaban tidak valid.
- Opsi asli yang bertentangan dengan skor tetap dipertahankan dan diberi penanda, tanpa koreksi diam-diam.
- CSV menggunakan UTF-8 BOM, CRLF dan pengutipan sel, sehingga koma/titik koma, kutip, karakter Indonesia, serta baris baru tidak menggeser kolom.
- Teks yang dapat dianggap rumus spreadsheet dinetralkan dengan awalan apostrof. Tidak ada formula Excel yang dibuat dari isian mahasiswa.
- Saat mengimpor ke Excel, gunakan **Data → Dari Teks/CSV**, pilih pemisah yang sesuai, dan tetapkan kolom NIM/kode sebagai teks agar angka nol di depan tetap dipertahankan. CSV tidak dapat memaksa tipe kolom Excel seperti berkas XLSX.
- Hanya demografi dan instrumen yang masuk respons ekspor; askep, head-to-toe, absensi, token, dan komentar dosen tidak dimasukkan.

Pengambilan dibatasi lima peserta per permintaan. Daftar peserta ekspor ditetapkan saat proses dimulai; kewenangan diperiksa kembali pada setiap batch. Perubahan akun atau kegagalan batch menghentikan ekspor sebelum file parsial diunduh. Data tidak disimpan ke localStorage atau dipublikasikan pada URL; unduhan dibuat di browser pengguna yang berwenang.

Revisi/waktu sumber dicatat per baris. Ekspor beberapa batch bukan snapshot transaksi tunggal seluruh kelas. Untuk pembakuan data analisis, gunakan sumber kiriman tersimpan dan catat ID/revisinya. Uji endpoint dan beban ekspor nyata masih perlu dilakukan pada staging.

## Landing page PC dan HP

Latar kini didominasi gradasi biru–putih dengan bidang konten terang, bukan putih penuh. Layout hero memakai dua kolom di PC dan satu kolom pada tablet/HP. Grid fitur, sumber belajar, pendampingan dan footer menyesuaikan layar. Navigasi HP menggunakan menu native yang bisa dioperasikan keyboard dan ditutup dengan Escape.

Ukuran dasar teks PC 20 px, deskripsi hero 22 px, judul hero 44–76 px. Pada HP ukuran dasar 20 px, deskripsi 21 px dan judul 44–56 px. Jarak tombol, padding kartu dan ritme antarseksi dirapikan. Zoom tidak dikunci; ukuran minimum tombol dipertahankan.

Ilustrasi lansia menggunakan aset asli **1536 × 1024**. Efek scale yang memperbesar raster dihilangkan; gambar tidak dibuat seolah mempunyai detail tambahan lewat pembesaran buatan. Preview memakai gambar tertanam sehingga tidak bergantung pada path aset lokal. Preferensi reduced motion tetap dihormati.

Pemeriksaan otomatis mencakup struktur responsif, kontras warna utama, navigasi, ukuran sumber gambar dan tautan. Ini belum menggantikan pemeriksaan visual browser nyata pada PC/HP.

## Preview dan build

Paket preview berisi `landing-review-preview.html` dan `review-preview.html`. Buka landing untuk meninjau tampilan, lalu masuk ke dashboard simulasi; pilih **Dosen → Ekspor data analisis**. Data ekspor preview memakai identitas SIMULASI.

Build berurutan: V6, completion, progress, practice-schedule, reminder-delivery, **analysis-export**, review-preview, lalu landing-review. Jalankan `node --test tests/*.test.cjs` setelahnya. File `analysis-schema.js` dan `backend/analysis-schema.ts` dihasilkan dari 17 instrumen dan 10 kolom demografi sumber V6, bukan ditulis ulang secara terpisah.

Tidak ada pengaktifan jadwal praktik, deploy produksi, pengiriman email/WhatsApp, atau ekspor data mahasiswa nyata pada pekerjaan ini. Seluruh contoh CSV dan tes menggunakan data sintetis.
