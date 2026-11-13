# Audit menu dan preview landing premium — 13 November 2026 WIB

## Hasil
Melanjutkan main af38dadad43bb02e8ee94db3fea48785be46f4c1. Rilis resource/preview 88fa8b14a3119e0b6a7b6eae1c5c2dd1499e654b sudah berhasil GitHub Pages.

- UKOM diarahkan ke https://ukom.nursinggeniuscare.co.id/ sesuai pengguna. Situs berhasil dibuka dan dikenali sebagai UKOM Health Pro. Tautan tidak mengirim token Google/Supabase aplikasi Askep dan tidak mengklaim sinkronisasi akun/nilai UKOM.
- Dashboard V6 memiliki tautan UKOM di navigasi.
- Tautan pengkajian/asuhan/kompetensi/SOP/video membuka menu tujuannya setelah bootstrap akun. Tujuan tersimpan sementara bila belum masuk; hanya ID menu internal yang diizinkan. Tidak menerima URL luar sebagai tujuan login.
- Preview desain: landing-v6-premium.html. Landing portal utama belum diganti karena karakter/Remotion belum selesai. Preview ini menggunakan ilustrasi alur dan gerak CSS singkat, **bukan render Remotion atau karakter final**.

## Browser nyata: mahasiswa dan dosen
Akun mahasiswa UJI0001 dan akun dosen Amzal digunakan bergantian melalui login Google yang sudah tersedia. Tidak meminta atau membaca password/OTP. Ini bukan uji dua akun terisolasi serentak.

Semua menu berikut dibuka pada kedua peran dan judulnya tampil:
1. Beranda belajar
2. Dashboard
3. Identitas & demografi
4. 17 instrumen asli
5. Ringkasan hasil instrumen
6. Pengkajian head-to-toe
7. Asuhan keperawatan
8. Laporan lengkap / PDF
9. SOP lansia & dewasa
10. Video pembelajaran
11. 149 SDKI–SLKI–SIKI
12. Logbook kompetensi
13. Form kompetensi
14. Refleksi mingguan
15. Daftar hadir
16. Pengkajian kulit & luka
17. Review pembimbing
18. Target & penilaian
19. Arsip PDF privat

Hasil:
- Tidak ada galat konsol pada dua penelusuran menu.
- Field mahasiswa pada identitas, instrumen, head-to-toe, asuhan, kompetensi, refleksi, kehadiran dan kulit/luka tidak dapat diedit dari akun dosen.
- Halaman Form kompetensi menampilkan dua formulir review; Review pembimbing menampilkan 13 formulir review sesuai pengajuan uji. Tidak mengirim penilaian klinis tambahan.
- Field pencarian SOP/katalog/logbook dibedakan dari isian mahasiswa saat mengecek disabled.
- Pada penelusuran mahasiswa tidak ditemukan input/textarea/select yang terlihat tanpa label atau aria-label dalam halaman yang terbuka.
- Semua 14 modul head-to-toe diperiksa pada minggu 1 dan minggu 2: masing-masing 72 field dengan status/temuan/catatan, tanpa ID ganda dan tanpa kontrol data-hfield yang kehilangan label. Ini audit tampilan/struktur, **bukan uji penulisan individual seluruh 144 field kedua minggu**.
- Akses langsung #sop berhasil membuka SOP pada mahasiswa; setelah berpindah akun Google dosen, tujuan SOP juga pulih.
- Data uji tetap tersedia. Checkpoint browser dosen terakhir: revisi 41. Pergantian minggu memicu simpan metadata otomatis; tidak memasukkan ulang temuan pasien.

## Landing page premium
Nama tampak pada heading utama: Askep Gerontik Terintegrasi.
Tema: putih gading, navy, aksen emas tipis. Isi konkret: pengkajian, dokumentasi dua minggu, portofolio, SOP, video, UKOM, ruang mahasiswa/dosen.
- Dua tombol UKOM memakai URL yang diberikan, tab baru dan noopener/noreferrer.
- CTA masuk tetap memakai autentikasi portal yang ada.
- Tidak memakai testimoni, jumlah pengguna atau klaim hasil buatan.
- Desktop 1440 px: dokumen 1425 px, tidak melampaui viewport. Ponsel 375 px: dokumen 360 px, tidak melampaui viewport.
- 78 elemen teks tampak diperiksa memakai warna computed style dan latar opaque terdekat: tidak ada kegagalan rasio 4,5:1 teks biasa / 3:1 teks besar pada elemen yang diuji. Bukan sertifikasi WCAG lengkap; belum meliputi semua keadaan hover, fokus, pembaca layar atau semua perangkat.
- Kontrol jeda awal mengubah aria-pressed dengan benar. Ditemukan kebutuhan memutar ulang animasi singkat setelah selesai; script diperbaiki untuk memakai kontrol Web Animations dan tombol Putar ulang. Perbaikan script telah diperiksa sintaksnya; perjalanan tombol versi terakhir masih perlu pemeriksaan browser.
- prefers-reduced-motion menyediakan tampilan statis; script menyembunyikan kontrol animasi pada preferensi tersebut.
- Viewport override dikembalikan setelah audit.

## Pengujian otomatis
node --test tests/*.test.cjs: 64 lulus, 0 gagal setelah perubahan rute/UKOM. Ketiga script yang diubah berhasil diparse sebelum rilis resource. Tes tetap mencakup komponen tiruan; 100 pengguna yang lulus pada audit sebelumnya memakai transport lokal, bukan 100 Google login atau beban produksi.

## Hambatan karakter dan Remotion
Pengguna memilih Andaz Health Presenter Explains Geriatric Care(1).gif dan hanya ingin tulisan latar diganti menjadi Askep Gerontik.
- Aset teridentifikasi, GIF 772473 byte. Pembacaan piksel tidak tersedia, dan pengambilan berkas melalui jalur transfer gagal. File lokal belum berhasil diperoleh; tidak menilai atau mengubah wajah/gerakan berdasarkan tebakan.
- Pemasangan Remotion 4.0.502 gagal karena pembuatan symlink ditolak perangkat, baik pada store bawaan maupun store di workspace dengan hoisted/copy. Tidak menonaktifkan perlindungan perangkat.
- Belum ada video/GIF hasil edit, frame QA, atau render Remotion. Jangan menyebut preview CSS sebagai hasil Remotion.
- Perlu berkas GIF/MP4/PNG yang dapat dibaca dari lokasi lokal yang diberikan pengguna atau transfer yang kembali bekerja, serta lingkungan renderer yang dapat memasang dependensi.
- Setelah aset tersedia: periksa frame awal/tengah/akhir dan metadata; tentukan area teks latar yang aman; ganti hanya tulisan menjadi Askep Gerontik; pertahankan wajah, busana dan animasi; render ringan tanpa suara otomatis; sediakan poster statis dan kontrol gerak; periksa hasil lalu integrasikan ke portal utama.

## Pekerjaan penerimaan yang tetap terbuka
Login mahasiswa kedua/Indah, isolasi sesi serentak, beban 100 akun produksi, pentest menyeluruh, pemutaran kedua video sumber, verifikasi akademik katalog/rubrik dan pengujian semua field individual belum selesai. Audit menu yang lulus tidak membuktikan seluruh konten klinis benar atau seluruh skenario bebas bug.

