# Pengingat dosen melalui email dan WhatsApp

Status: **draf, belum diaktifkan dan belum mengirim pesan nyata**. Menu aplikasi yang telah disetujui dipertahankan. Narasi evaluasi SATRIA dihapus; header dashboard dan pita preview memakai biru langit `#87ceeb` dengan teks gelap `#132c54`.

## Perilaku draf

Dosen menulis satu pesan, memilih minggu dan kanal email/WhatsApp, lalu menyimpan pengingat. Pengingat dalam aplikasi serta antrean per kanal dibuat dalam satu transaksi. Pengiriman server berjalan terpisah sehingga mahasiswa tidak perlu sedang membuka aplikasi. Tujuan pesan berasal dari roster/kontak mahasiswa; dosen tidak dapat menyisipkan alamat lain melalui payload API.

Mahasiswa dapat mengatur email dan nomor WhatsApp melalui Komentar & pengingat → Atur email & WhatsApp. Nomor Indonesia berawalan 08 dinormalisasi menjadi +62. WhatsApp memerlukan persetujuan mahasiswa; pencabutan izin atau perubahan nomor diperiksa ulang sebelum pengiriman. Pengingat tanpa kontak/izin memiliki status terblokir dan harus diperiksa dosen.

Status yang ditampilkan: antrean, sedang diproses, menunggu percobaan ulang, diterima layanan, belum dapat dikirim, gagal, dan perlu diperiksa. **Diterima layanan bukan bukti sudah sampai/dibaca.** Webhook provider untuk konfirmasi delivered/read belum diimplementasikan; jangan menampilkan tanda sudah dibaca berdasarkan respons API pengiriman.

## Kebutuhan aktivasi

| Kanal | Yang perlu disediakan |
|---|---|
| Email | Akun Resend atau penyedia setara, domain pengirim terverifikasi, alamat pengirim institusi/aplikasi. Jangan memakai alamat Gmail sebagai pengirim terverifikasi domain secara sembarang. |
| WhatsApp | WhatsApp Business Platform/Cloud API, nomor pengirim, token server, template pengingat yang disetujui, nomor mahasiswa dan persetujuan menerima pengingat. |
| Server | Staging, tabel/kontrol akses yang diuji, worker, token scheduler, serta pengaturan jadwal. |

Tidak ada akun berbayar yang dibuat, biaya layanan yang disetujui, atau kunci yang diminta melalui chat. Rahasia disimpan pada pengaturan server, bukan di HTML/GitHub.

Variabel server:

```
REMINDER_SEND_ENABLED=false
RESEND_API_KEY=<atur di server>
REMINDER_EMAIL_FROM=<nama dan alamat domain terverifikasi>
WHATSAPP_ACCESS_TOKEN=<atur di server>
WHATSAPP_PHONE_NUMBER_ID=<nomor ID pengirim>
WHATSAPP_REMINDER_TEMPLATE=<nama template disetujui>
WHATSAPP_GRAPH_VERSION=<versi API yang telah diverifikasi>
WHATSAPP_TEMPLATE_LANGUAGE=id
REMINDER_WORKER_TOKEN=<rahasia acak minimal 32 karakter>
```

`REMINDER_SEND_ENABLED` tetap false sampai uji pengiriman yang berwenang selesai. Alur uji harus memakai penerima yang telah ditetapkan; pekerjaan ini tidak mengirim email/WhatsApp ke mahasiswa.

## Kontrak template WhatsApp

Adapter mengirim template body dengan tiga parameter berurutan: nama mahasiswa, nomor minggu, dan teks dosen. Template yang diajukan harus cocok dengan kontrak ini. Contoh naskah untuk diajukan, **belum disetujui Meta**:

> Halo {{1}}, ada pengingat tugas Askep Gerontik minggu {{2}} dari dosen pembimbing: {{3}}. Silakan periksa tugas di aplikasi Askep Gerontik. Hubungi dosen pembimbing untuk bantuan atau ubah preferensi pengingat melalui akun mahasiswa.

Keputusan kategori/persetujuan template ditentukan oleh penyedia. Tautan aplikasi tetap tidak membawa nama pasien, data pengkajian, token login atau identitas klinis. Pesan dosen harus sebatas pengingat pembelajaran, tanpa data pasien.

## Urutan staging

1. Jalankan build V6, completion, progress, reminder-delivery, dan review-preview. Jalankan seluruh tes lokal.
2. Pada database staging, uji `weekly-migration.sql`, lalu `reminder-delivery.sql`. Tidak ada SQL ini yang telah dijalankan pada produksi.
3. Pasang API draf dengan kontrol autentikasi sebelumnya tetap berlaku. Pasang worker `backend/reminder-worker.ts` dengan pendamping `backend/reminder-delivery.js`. Worker memakai token scheduler sendiri; permintaan browser/student token ditolak. Jika JWT gateway dinonaktifkan untuk token kustom ini, pemeriksaan bearer di worker wajib tetap aktif.
4. Isi konfigurasi layanan melalui secrets server. Pastikan domain email serta template WhatsApp benar-benar siap.
5. Uji antrean/idempotensi, dua worker bersamaan, opt-out, nomor hilang, kontak berubah, provider menolak, timeout, serta kegagalan pencatatan sesudah pengiriman. Pengujian SQL/worker nyata ini belum dilakukan.
6. Setelah lolos, Vault menyimpan `gerontik_reminder_worker_url` dan `gerontik_reminder_worker_token`; contoh jadwal setiap menit ada di `backend/reminder-cron.sql`. Jangan menjadwalkan file tersebut sebelum staging/aktivasi disetujui.

Antrean menggunakan lease dan `FOR UPDATE SKIP LOCKED`. Email memakai idempotency key yang sama pada retry, dibatasi dalam jendela provider. WhatsApp dengan hasil jaringan yang tidak pasti ditandai perlu diperiksa, agar worker tidak mengulang tanpa mengetahui hasil sebelumnya. Tidak ada jaminan exactly-once untuk WhatsApp. Maksimal enam percobaan dan jeda meningkat; pengingat manual ke peserta yang sama dibatasi satu per menit per dosen.

Antrean berstatus blocked tidak diaktifkan ulang otomatis ketika konfigurasi/kontak diperbaiki. Dosen perlu memeriksa status dan mengirim pengingat baru bila masih diperlukan. Histori tidak ditulis ulang seolah pesan lama telah terkirim.

## Rekomendasi sebelum rilis

- Tentukan tenggat tiap minggu agar status terlambat berdasarkan tanggal yang benar.
- Sediakan filter belum mulai/tidak ada aktivitas tersimpan untuk tindak lanjut dosen.
- Ikat PDF ke ID dan revisi kiriman mingguan sebelum menganggap review berkas sebagai persetujuan tugas yang sama.
- Tambahkan webhook terverifikasi jika dibutuhkan bukti delivered/read. Saat ini status accepted hanya menyatakan provider menerima permintaan.

Rujukan primer: https://resend.com/docs/dashboard/emails/idempotency-keys ; https://resend.com/docs/api-reference/emails/send-email ; https://business.whatsapp.com/policy ; https://supabase.com/docs/guides/functions/schedule-functions .
