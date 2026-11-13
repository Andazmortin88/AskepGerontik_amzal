# Perbaikan preview

Preview sebelumnya gagal karena skrip demo mendeklarasikan kembali variabel global `selected` yang sudah dipakai aplikasi V6. Pemeriksaan sintaks setiap blok secara terpisah tidak mendeteksi benturan antarblok tersebut.

Perbaikan: variabel demo diberi nama tersendiri; data simulasi dilengkapi dengan identitas mahasiswa, container instrumen mentah, dan koleksi aktivitas kosong yang dibutuhkan renderer V6. Pengujian baru mengeksekusi semua blok dalam satu konteks, lalu memeriksa inisialisasi tampilan mahasiswa dan dosen dengan 100 peserta simulasi tanpa koneksi backend produksi.

Ini bukan bukti pengujian visual browser atau pengujian autentikasi/database nyata. Tidak ada deployment produksi.
