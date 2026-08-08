# STANDARD OPERATING PROCEDURE (SOP) & PANDUAN IMPLEMENTASI
## EDUPULSE SMART ATTENDANCE (UJI COBA REAL 2 BULAN)

Dokumen ini disusun sebagai panduan resmi bagi sekolah, panitia pelaksana, wali kelas, dan operator dalam mengimplementasikan, menguji, dan mengoperasikan aplikasi **EduPulse** selama masa uji coba 2 bulan untuk tingkat Kelas 7 (350 siswa).

---

## DAFTAR ISI
1. **Pendahuluan & Konsep EduPulse**
2. **Kebutuhan Perangkat & Infrastruktur**
3. **Tahap 1: Persiapan & Import Massal Data Siswa (Minggu 1 - Hari 1-2)**
4. **Tahap 2: Registrasi Wajah AI Massal (Minggu 1 - Hari 3-5)**
5. **Tahap 3: Pelaksanaan Absensi Harian (Minggu 2 - Selesai)**
6. **Tahap 4: Rekapitulasi & Tindak Lanjut Medis/Wali Murid**
7. **Prosedur Akhir Tahun / Semester: Kenaikan Kelas Massal**
8. **Panduan Troubleshooting & Mitigasi Kendala Lapangan**

---

## 1. PENDAHULUAN & KONSEP EDUPULSE
EduPulse adalah sistem absensi pintar sekolah berbasis AI (Face Recognition) yang terintegrasi dengan data rekam medis digital sederhana siswa dan pelaporan cepat ke wali murid. 
Aplikasi ini dilengkapi dengan **Mode Offline Cerdas**. Jika jaringan internet/Supabase sekolah terputus, data absensi dan registrasi wajah tetap tersimpan dengan aman di penyimpanan lokal perangkat (Local Storage/IndexedDB) dan akan tersinkronisasi otomatis saat internet kembali stabil.

---

## 2. KEBUTUHAN PERANGKAT & INFRASTRUKTUR
Untuk kelancaran uji coba selama 2 bulan, pastikan spesifikasi minimum berikut terpenuhi:

*   **Tablet / Smartphone (Stasiun Absensi Utama):**
    *   Sistem Operasi: Android 8.0 (Oreo) ke atas atau iOS 13+.
    *   Kamera Depan: Minimal 8 MP (memiliki pencahayaan otomatis yang baik).
    *   RAM: Minimal 3 GB (rekomendasi 4 GB atau lebih agar proses deteksi wajah AI cepat & responsif).
    *   Layar: Minimal 6 inci (Tablet 8-10 inci sangat direkomendasikan untuk diletakkan di gerbang atau lobi sekolah).
*   **Akses Browser & PWA:**
    *   Gunakan browser **Google Chrome** (Android) atau **Safari** (iOS) versi terbaru.
    *   Sangat direkomendasikan untuk **Menginstal EduPulse sebagai PWA** (klik tombol *"Instal Sekarang"* pada banner atas browser) agar aplikasi berjalan di layar penuh, tanpa bar alamat browser, dan performa deteksi kamera lebih stabil.
*   **Dudukan (Stand/Kiosk):**
    *   Tripod atau holder dinding yang kokoh untuk meletakkan tablet di posisi setinggi rata-rata wajah siswa (sekitar 130–150 cm dari lantai).
*   **Pencahayaan:**
    *   Letakkan stasiun absensi di area yang terang namun **tidak terpapar sinar matahari langsung dari belakang siswa (avoid backlight)**.

---

## 3. TAHAP 1: PERSIAPAN & IMPORT MASSAL DATA SISWA
Sebelum mendaftarkan wajah, data profil siswa harus dimasukkan terlebih dahulu agar wajah yang didaftarkan memiliki identitas yang tepat.

```
[Siapkan File Excel] ──> [Masuk Menu Siswa] ──> [Klik Import Excel] ──> [Unggah & Validasi]
```

### Prosedur Kerja:
1.  **Format Template Excel:**
    *   Siapkan file Excel (`.xlsx`) dengan kolom-kolom berikut secara berurutan:
        1.  `NISN` (Nomor Induk Siswa Nasional - unik)
        2.  `Nama Lengkap`
        3.  `Kelas` (Contoh: `7A`, `7B`, `7C`)
        4.  `Jenis Kelamin` (`L` atau `P`)
        5.  `No HP Wali Murid` (Format WhatsApp aktif: `08xxxxxxxxxx` atau `628xxxxxxxxxx`)
2.  **Proses Unggah:**
    *   Masuk ke halaman **Siswa (Students)** di EduPulse.
    *   Klik tombol **"Import Excel"**.
    *   Pilih file yang sudah disiapkan, periksa pratinjau data, kemudian klik **"Simpan Data"**.
3.  **Verifikasi:**
    *   Pastikan jumlah siswa yang berhasil masuk sesuai dengan total database (misalnya 350 siswa). Gunakan filter kelas untuk memverifikasi per kelas.

---

## 4. TAHAP 2: REGISTRASI WAJAH AI MASSAL
Mendaftarkan 350 siswa adalah tahap yang paling krusial. EduPulse telah dilengkapi dengan fitur optimalisasi pendaftaran massal untuk menghindari kendala *"Wajah Mirip/Duplikat"*.

### Pengaturan Kamera & Keamanan Wajah:
*   **Posisi Siswa:** Siswa berdiri tegak, pandangan lurus ke arah kamera depan tablet, ekspresi wajah netral (tidak tersenyum lebar/cemberut), dan kacamata/masker dilepas sementara.
*   **Pencahayaan:** Pastikan tidak ada bayangan gelap di satu sisi wajah.

### Prosedur Registrasi Massal yang Efisien:
1.  Buka menu **Siswa (Students)**.
2.  Klik ikon **Kamera** pada baris siswa yang ingin didaftarkan.
3.  **Trik Registrasi Cepat (Untuk 350 Siswa):**
    *   Pada modal pendaftaran wajah, terdapat opsi **"Proteksi Duplikasi Wajah"**.
    *   **Saat Registrasi Massal:** Nonaktifkan opsi ini (uncheck/hilangkan centang) untuk mempercepat proses pendaftaran dari siswa ke siswa berikutnya tanpa interupsi pencocokan database 350 wajah.
    *   **Kapan diaktifkan?** Opsi ini diaktifkan kembali setelah semua pendaftaran selesai untuk menjaga keamanan dan akurasi harian.
4.  Posisikan wajah siswa di dalam lingkaran panduan kamera.
5.  Tunggu hingga indikator berwarna hijau dan muncul pesan *"Wajah Terdeteksi"*.
6.  Klik **"Ambil Foto & Daftarkan"**.
7.  Sistem akan menyimpan deskriptor wajah (AI Face Vector) secara otomatis. Lanjutkan ke siswa berikutnya.

*Catatan: Rata-rata pendaftaran per siswa membutuhkan waktu kurang dari 15 detik jika data nama sudah siap.*

---

## 5. TAHAP 3: PELAKSANAAN ABSENSI HARIAN
Stasiun absensi diletakkan di gerbang utama atau lobi sekolah setiap pagi hari mulai pukul **06.30 - 07.30**.

```
[Siswa Datang] ──> [Menghadap Tablet/Kamera] ──> [AI Scan (1 Detik)] ──> [Muncul Status Absen & Suara]
```

### Prosedur Pelaksanaan:
1.  **Persiapan Stasiun Absensi (Petugas OSIS / Piket):**
    *   Nyalakan tablet, buka aplikasi EduPulse (PWA).
    *   Masuk ke halaman **Absensi (Attendance / Dashboard Scan Wajah)**.
    *   Pastikan kamera aktif dan mengarah ke posisi berdiri siswa.
2.  **Alur Absensi Siswa:**
    *   Siswa mengantre dengan tertib berjarak 1 meter dari stasiun.
    *   Siswa berdiri di titik pemindaian selama 1-2 detik.
    *   Sistem AI mendeteksi wajah, mencocokkannya dengan database, dan langsung memutar suara konfirmasi (misalnya: *"Terima kasih, [Nama Siswa], Absen Masuk Berhasil!"*).
    *   Status kehadiran otomatis tercatat sebagai **Hadir**.
3.  **Siswa Lambat / Terlambat:**
    *   Sistem secara otomatis mengkategorikan kehadiran sebagai **Terlambat** berdasarkan batas jam masuk sekolah yang telah dikonfigurasi di pengaturan aplikasi.

---

## 6. TAHAP 4: REKAPITULASI & TINDAK LANJUT MEDIS
Keunggulan EduPulse adalah integrasi langsung antara kehadiran harian dan kondisi kesehatan siswa.

1.  **Rekap Wali Kelas (Setiap Jam 08.00):**
    *   Wali kelas membuka halaman dashboard admin.
    *   Melihat siapa saja siswa yang tidak hadir tanpa keterangan (Alpha).
    *   Menghubungi nomor WhatsApp wali murid yang tertera langsung dengan sekali klik.
2.  **Laporan Rekam Medis Ringkas (Dari UKS/Guru Piket):**
    *   Jika selama sekolah ada siswa yang sakit/izin pulang, Guru Piket/Petugas UKS dapat memperbarui status kehadiran siswa tersebut di halaman **Kehadiran** menjadi **Sakit** atau **Izin**.
    *   Petugas dapat menuliskan rekam medis singkat (misalnya: *"Siswa pusing, diberikan parasetamol, dijemput orang tua pukul 10.00"*).
    *   Data ini akan tersimpan permanen di riwayat kesehatan siswa tersebut untuk referensi masa depan.

---

## 7. PROSEDUR AKHIR TAHUN / SEMESTER: KENAIKAN KELAS MASSAL
Ketika semester baru atau tahun ajaran baru dimulai, Anda tidak perlu menghapus 350 siswa tersebut lalu mengimpor ulang melalui Excel. Cukup gunakan tombol **Naik Kelas Massal** yang sudah disediakan di halaman Siswa.

```
[Klik Tombol "Naik Kelas Massal"] ──> [Pilih Kelas Asal (Misal: 7A)] ──> [Ketik Kelas Tujuan (Misal: 8A)] ──> [Proses Selesai]
```

### Keuntungan Metode Ini:
*   **Wajah AI Tetap Tersimpan:** Siswa tidak perlu mengantre ulang untuk mendaftarkan wajah mereka lagi di kelas baru!
*   **Riwayat Terjaga:** Riwayat absensi semester lalu tetap terikat pada ID siswa tersebut dengan aman.
*   **Sangat Cepat:** Memindahkan satu kelas berisi 35-40 siswa hanya membutuhkan waktu kurang dari 3 detik.

---

## 8. PANDUAN TROUBLESHOOTING & MITIGASI KENDALA
Berikut adalah kendala umum di lapangan dan solusi penanganannya:

| Kendala Lapangan | Penyebab | Solusi & Tindakan |
| :--- | :--- | :--- |
| **Koneksi Internet Sekolah Mati / Drop** | Gangguan provider atau mati lampu | **Tetap tenang.** EduPulse akan otomatis mendeteksi koneksi terputus dan beralih ke *Offline LocalDB Mode*. Absensi tetap berjalan normal menggunakan database lokal tablet. Jangan tutup browser/aplikasi hingga internet menyala kembali agar data tersinkronisasi otomatis ke Supabase. |
| **Wajah Siswa Tidak Terdeteksi oleh AI** | Backlight, pencahayaan minim, atau wajah terhalang | 1. Pastikan posisi stasiun absensi tidak membelakangi jendela/sumber cahaya terang (backlight).<br>2. Minta siswa merapikan rambut yang menutupi dahi/mata dan melepas masker/kacamata hitam.<br>3. Bersihkan lensa kamera tablet dari debu/sidik jari. |
| **Muncul Notifikasi Kemiripan / Duplikat saat Registrasi** | Nilai kecocokan wajah terlalu mirip dengan siswa lain | 1. Ambil foto ulang dengan posisi wajah siswa tegak lurus dan pencahayaan yang lebih merata.<br>2. Pada kondisi darurat registrasi massal, hilangkan centang pada opsi **"Proteksi Duplikasi Wajah"** di modal kamera untuk membypass pengecekan kemiripan sementara. |
| **Aplikasi Terasa Lambat Setelah Digunakan 1 Jam** | Cache RAM tablet penuh | Lakukan refresh halaman aplikasi (Tarik layar ke bawah atau klik reload), atau tutup aplikasi PWA dari multitasking lalu buka kembali untuk mengosongkan memori RAM. |
| **Data Absensi Tidak Update di HP Wali Kelas** | Sinkronisasi tertunda | Pastikan tablet absensi utama telah terhubung ke internet yang stabil untuk mengirim sisa data offline harian ke server cloud Supabase. |

---

*Disusun dengan penuh perhatian untuk meningkatkan kedisiplinan dan digitalisasi ekosistem sekolah Anda.*
**Tim Pengembang EduPulse & AI Assistant**
