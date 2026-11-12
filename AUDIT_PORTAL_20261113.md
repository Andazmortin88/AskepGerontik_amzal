# Audit fungsional portal Askep Gerontik

13 November 2026 WIB. Melanjutkan implementasi yang ada pada main 47cbe672ae9af0addebfca11ee022a08eb676ba0. Ini audit parsial dengan bukti dan batas pengujian, bukan sertifikasi keamanan atau kelulusan peluncuran 100 mahasiswa.

## Keputusan kesiapan

**Belum lulus peluncuran penuh untuk 100 mahasiswa.** Simulasi sinkronisasi lokal berhasil, tetapi login mahasiswa nyata, perjalanan browser mahasiswa-ke-dosen dan beban layanan produksi belum diuji. Roster dummy belum tertaut akun Google. Jangan menyamakan simulasi dengan autentikasi Google nyata.

## Pengujian yang dijalankan

Perintah: `node --test tests/*.test.cjs` dari direktori aplikasi. Node 24.22.1.

| Bukti | Hasil | Batas |
| --- | --- | --- |
| Seluruh pengujian otomatis | 53 lulus, 0 gagal | VM Node dan transport simulasi, bukan browser nyata |
| 100 pengguna serentak | Puncak 100 panggilan transport bersamaan; 100 simpan; 100 dokumen; 100 pembacaan ulang cocok | SyncDocument asli, transport dan penyimpanan server dalam memori; autentikasi diganti; 0 permintaan produksi; 0 login Google |
| Dua perangkat, satu dokumen | Satu simpan berhasil; versi usang ditolak; kedua salinan tetap teridentifikasi | Server CAS disimulasikan |
| 17 instrumen, 131 item, dua minggu | Setiap item dihilangkan bergiliran dan terdeteksi; skor nol sah diterima | Uji kelengkapan, bukan validasi psikometrik, lisensi atau ketepatan interpretasi klinis |
| Ulasan dosen | Lokasi, waktu, catatan tampil pada renderer; retry penilaian kompetensi konsisten; revisi usang ditolak | Fungsi renderer dan handler diuji terisolasi; belum perjalanan browser/data nyata |
| Menu penautan akun produksi | Halaman tampil: belum ada akun menunggu penautan | Sesi super admin yang sudah tersedia; bukan akun mahasiswa |
| Pemeriksaan terdahulu | Google pemilik berhasil; 100 roster/4 kelompok; pencarian peserta, arsip kosong, tampilan desktop/mobile | Tidak dihitung sebagai pengujian baru atau bukti 100 login |

Durasi uji lokal tidak dipakai untuk mengestimasi latensi, throughput, SLA, CPU, kuota atau kemampuan Supabase produksi.

## Masalah yang diperbaiki pada audit ini

| Prioritas | Temuan | Perbaikan dan bukti |
| --- | --- | --- |
| P1 | Menyimpan/berpindah menu dapat melewati timeout penangkapan formulir tanpa kegagalan eksplisit | Capture mendaftarkan listener sebelum meminta state, menolak setelah timeout; navigasi mempertahankan formulir saat gagal; uji timeout lulus |
| P1 | Mengosongkan pemeriksaan fisik, diagnosis atau implementasi mengembalikan teks lama | Capture menggunakan nilai kosong sebagai perubahan sah; uji tiga isian lulus |
| P1 | TUG 250 detik diubah otomatis menjadi 180 tanpa konfirmasi | Nilai di luar rentang ditolak dengan pesan; nilai tersimpan sebelumnya dipertahankan; 17,5 diterima; uji lulus. Ini tidak memperluas rentang klinis |
| P1 | Kontrol hanya-baca tidak diterapkan kembali setelah render instrumen/asuhan | Proteksi diterapkan ulang pada pergantian render; input numerik juga dinonaktifkan; kontrol mutasi asuhan dibatasi; uji wrapper lulus. Belum uji browser lintas seluruh modal |
| P2 | Lokasi praktik tidak ditampilkan ke dosen walaupun diisi mahasiswa | Renderer menampilkan Wisma/lokasi; uji catatan kehadiran lulus |
| P2 | Preferensi pengurangan gerakan hanya berlaku pada sebagian elemen formulir lama | Aturan reduced-motion untuk animasi/transisi seluruh formulir tertanam |
| P2 | Placeholder demografi meminta nama lengkap sementara portal menganjurkan kode kasus | Placeholder diganti menjadi kode kasus; nama field data lama dipertahankan |

Materi/instrumen, data arsip, peran dosen dan konfigurasi OAuth tidak diganti. Root aplikasi lama tidak digantikan oleh portal.

## Cakupan menu dan isian mahasiswa

| Menu/bagian | Isian dan integrasi yang ditelaah | Status dan pekerjaan tersisa |
| --- | --- | --- |
| Dashboard saya | Identitas roster, hitungan kegiatan, status sinkronisasi, konflik/cadangan | Sumber dan uji sinkronisasi; belum browser mahasiswa nyata |
| Demografi minggu 1/2 | Nama/kode kasus, usia, jenis kelamin, status kawin, pendidikan, pekerjaan, lama tinggal, tempat tinggal, riwayat penyakit, obat; tersimpan di clinicalState.demografi | Capture sumber ditelaah. Validasi usia dan konsistensi tanda wajib masih perlu dipertegas; lama tinggal bertanda wajib di UI tetapi belum menjadi syarat FINAL |
| Instrumen minggu 1/2 | Barthel, Lawton, MNA-SF, FRAIL, SARC-F, TUG, AMT, GDS-15, WHOQOL-OLD, ULS-8, GAD-7, NRS, SQS, DSSI-11, MSPSS, 4AT, SPPB | 131 item dicek kelengkapannya di kedua minggu. Scoring/interpretasi klinis belum divalidasi ulang terhadap pedoman primer |
| Pengkajian/asuhan | Pemeriksaan fisik, analisis data/masalah/etiologi, diagnosis/SDKI, tujuan/SLKI, SIKI dan implementasi; dosen membuka salinan hanya-baca | Pengosongan teks diperbaiki. Tabel contenteditable, modal SDKI/SLKI/SIKI dan cetak perlu uji browser nyata |
| Logbook | Tanggal, lokasi, keterampilan, peran, pembimbing, tindakan/hasil, refleksi; diajukan dan ditinjau | Renderer dan jalur review ditelaah; 10 catatan bersubstansi menjadi syarat FINAL; belum input-to-database-to-lecturer nyata |
| Bukti kompetensi | DOPS/mini-CEX/EBN, tanggal/lokasi/peran/pembimbing/hasil/refleksi; rubrik, tanggal observasi, N/A, hasil dan umpan balik dosen | Retry dan revisi diuji. mini-CEX masih berbagi rubrik dasar DOPS; perlu penilaian kesesuaian akademik |
| Refleksi mingguan | Minggu, pengalaman/perubahan pemahaman dan rencana | Dua minggu wajib; duplikat dibatasi UI. Koreksi hanya menambah teks, belum mengedit isian asal |
| Kehadiran | Tanggal, lokasi, shift, hadir/izin/sakit, masuk/keluar, alasan; review dosen | Lokasi kini tampil. Validasi hari praktik masih Senin-Jumat dan perlu konfigurasi sesuai jadwal resmi; bukan bukti presensi objektif |
| Arsip PDF | Upload maksimal 15 MB, revisi dokumen, daftar/buka PDF dan review | Belum E2E unggah, unduh bertanda tangan, retry dan review produksi; bukan bukti seluruh menu lulus |
| FINAL/koreksi | Kelengkapan dua minggu, 10 logbook, 2 refleksi; buka koreksi dosen dengan alasan dan expectedRevision | Uji kelengkapan otomatis dan transaksi reopen terdahulu tersedia; belum perjalanan browser mahasiswa/dosen |

## Hambatan dan rekomendasi yang masih terbuka

1. **P1 — Uji identitas nyata:** perlukan minimal dua akun mahasiswa uji yang memang boleh digunakan dan login dosen Indah. Pemilik akun mengendalikan login/OTP. Jangan meminta atau menyimpan kata sandi. Uji Google 100 akun memerlukan peserta nyata; simpan hanya hasil agregat pengujian.
2. **P1 — Penerimaan integrasi:** masukkan nilai unik pada setiap bagian mahasiswa A dan B, tunggu status tersimpan, reload, periksa melalui masing-masing dosen sesuai penugasan, minta revisi, kirim perbaikan, FINAL dan buka koreksi. Cocokkan seluruh field, bukan hanya hitungan dashboard.
3. **P1 — Mekanisme koreksi:** logbook/refleksi/kehadiran/kompetensi saat ini hanya menambahkan teks perbaikan. Mahasiswa belum dapat memperbaiki tanggal, waktu atau field asal melalui form edit. Sediakan edit berversi dengan riwayat agar koreksi data benar-benar dapat ditinjau.
4. **P1 — Kesesuaian klinis:** FINAL mewajibkan semua 17 instrumen di kedua minggu. Belum ada status tidak dapat diperiksa/kontraindikasi dengan alasan dan persetujuan dosen. Jangan mendorong pengisian angka fiktif untuk meloloskan FINAL; tetapkan alur pengecualian akademik yang dapat diaudit.
5. **P1 — Audit keamanan:** pemindaian standar Codex Security tidak dapat dimulai karena alat start/penyimpanan scan tidak tersedia. Tidak dibuat laporan scan kanonis atau klaim tanpa celah. Sepuluh uji handler yang ada (termasuk penolakan akses/role/origin dan retry) lulus, tetapi bukan pentest. Cakupan API lama, seluruh SQL/RLS/storage, ketahanan upload dan dependensi masih memerlukan audit keamanan tersendiri.
6. **P1 — Beban produksi:** uji auth/session refresh, cold start Edge Function, penyimpanan nyata, koneksi Postgres, RLS, 429/timeout, PDF dan pemulihan pada lingkungan uji terisolasi. Ukur error rate, p50/p95/p99 dan konsistensi data, tanpa memakai data pasien nyata.
7. **P2 — Navigasi asinkron:** beberapa renderer menulis workspace setelah await tanpa penanda navigasi terpisah. Pergantian menu cepat dalam akun sama masih perlu pengujian balapan respons; penjagaan pergantian akun yang sudah ada tidak otomatis menyelesaikan ini.
8. **P2 — Keandalan PDF:** pengunggahan memakai jalur fetch tersendiri; audit retry/idempotensi, sesi berubah, halaman berganti, network terputus, dan pagination gagal belum selesai.
9. **P2 — Validasi dan kelengkapan:** validasi usia numerik/rentang, trim teks wajib, duplikasi catatan, periode/tanggal praktik, keterampilan dan lampiran harus konsisten di UI/backend. Kelengkapan tidak membuktikan mutu isi.
10. **P2 — Aksesibilitas:** option-chip instrumen masih span dengan klik, belum kontrol keyboard semantik; banyak label formulir lama belum terhubung ke id input. Perlu uji keyboard/screen reader/fokus setelah navigasi dan pesan gagal.

## Desain, UI/UX, kesan generik dan motion

- Portal menggunakan warna krem/hijau/navy, hierarki kartu dan tombol yang konsisten; tampilan administratif yang diperiksa tidak memerlukan dekorasi tambahan. Sebutan “premium” atau “bebas AI slop” bukan ukuran teruji.
- Copy landing seperti “Tumbuh sebagai ners” dan ilustrasi kartu bertumpuk cenderung generik. Prioritaskan periode, progres isian, tugas dosen dan status simpan yang nyata; hindari menambah angka keberhasilan atau testimoni rekaan.
- Form klinik lama memiliki gaya biru, chip rapat dan tabel panjang di dalam iframe. Perbedaan gaya serta gulir bersarang belum selesai; perlu penyatuan bertahap setelah fungsi tervalidasi. Jangan merombak materi klinis untuk menyamakan tampilan.
- Teks mikro 10–12 piksel perlu diperbesar untuk pemakaian panjang/ponsel. Sidebar mobile bergulir horizontal perlu indikator menu aktif dan fokus yang jelas.
- Perhitungan statis pasangan token CSS: muted/putih 4,89:1; muted/kertas 4,54:1; hijau/putih 6,16:1; badge hijau/mint 5,30:1; teks peringatan/latar badge 5,11:1. Ini bukan audit seluruh keadaan hover, fokus, disabled, iframe atau seluruh WCAG.
- Portal sudah membatasi gerak pada hover singkat dan mendukung reduced-motion; pada audit ini dukungan tersebut diperluas ke formulir klinik. Tidak ada alasan menambah motion grafis yang mengganggu pembacaan atau memasukkan data.

## Urutan penerimaan berikutnya

Selesaikan koreksi data dan pengecualian instrumen; uji dua mahasiswa dan dosen nyata; uji seluruh tabel/modal/cetak/PDF; jalankan audit keamanan yang tersedia; kemudian uji beban produksi terisolasi 100 pengguna. Rilis penuh hanya setelah bukti pengujian tersebut tersedia.
