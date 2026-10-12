# 🏋️ UrExercise

Aplikasi web responsif untuk manajemen latihan harian (*Workout To-Do List & Weekly Planner*), kalender riwayat (*Calendar History*), dan stopwatch khusus **Static Apnea** (*CO2 & O2 Tables*) dengan penyimpanan **SQLite lokal** & dukungan penuh **Docker**.

---

## ✨ Fitur Utama

1. **Jam Digital Real-Time & Kalender**:
   - Jam digital aktif (HH:MM:SS) lengkap dengan hari dan tanggal Indonesia di header.
   - Dark Mode bawaan (*high-contrast*, hemat baterai, cocok untuk sesi latihan & apnea).
2. **Workout To-Do & Tracker Harian**:
   - Otomatis mendeteksi hari aktif (Senin – Minggu).
   - Checklist interaktif per set untuk setiap latihan yang terjadwal.
   - Tombol **"Selesaikan Latihan & Simpan ke Kalender"** untuk mencatat riwayat ke SQLite.
3. **Mode Edit & Grouping (Rencana & Bank Latihan)**:
   - **Bank Latihan**: Tambah, ubah, dan hapus latihan dengan kategori (Chest, Back, Legs, Core, Cardio, dll.), target set, repetisi, dan tips/catatan.
   - **Jadwal Mingguan**: Pilih hari (Senin s/d Minggu), atur nama rutinitas (misal: *Push Day*, *Leg Day*, *Rest Day*), dan pilih kumpulan gerakan dari bank latihan.
4. **Kalender & Riwayat (History)**:
   - Tampilan kalender bulanan interaktif.
   - Indikator visual badge latihan:
     - 🏋️ = Sesi Workout Gym / Olahraga selesai.
     - ⏱️ = Sesi Latihan Static Apnea selesai.
   - Klik tanggal mana pun untuk melihat rincian latihan yang dikerjakan pada hari itu.
5. **Static Apnea Tools (CO2 / O2 / Custom Progression)**:
   - **Terpisah dari workout to-do** khusus untuk latihan tahan napas freediving / static apnea.
   - **Preset CO2 Table**: Durasi *Hold* tetap konstan, waktu *Recovery/Rest* semakin berkurang di tiap putaran.
   - **Preset O2 Table**: Waktu *Recovery/Rest* tetap konstan, durasi *Hold* bertambah di tiap putaran.
   - **Progression Table Builder**: Lo bisa buat dan simpan preset tabel baru sendiri seiring progres tahan napas lo meningkat.
   - **Audio & Visual Cue**: Suara bip countdown 3-2-1 dan nada pergantian fase (*Web Audio API*), warna kontras layar (*Hold* vs *Rest*), dan mode layar penuh (*Fullscreen*).
   - **Simpan ke History**: Setelah latihan apnea selesai, langsung ada opsi catat ke kalender history.
6. **Stopwatch Standar**:
   - Stopwatch independen dengan presisi milidetik dan fitur pencatatan putaran (*Lap splits*).

---

## 🚀 Cara Menjalankan

### Cara 1: Menggunakan Docker (Rekomendasi)

Cukup jalankan satu perintah:

```bash
docker compose up -d --build
```

Aplikasi langsung aktif di: **`http://localhost:3000`**

Database SQLite tersimpan secara persisten di folder `./data/exercise.sqlite` di komputer lo.

Untuk menghentikan:
```bash
docker compose down
```

---

### Cara 2: Menjalankan Langsung dengan Node.js (Tanpa Docker)

Pastikan Node.js (v22+ atau v26) sudah terpasang:

```bash
# 1. Install dependensi
npm install

# 2. Build frontend
npm run build

# 3. Jalankan server (Backend Express + SQLite + Frontend di port 3000)
npm start
```

Buka browser di: **`http://localhost:3000`**

Untuk mode development (dengan Hot Reload Vite):
```bash
# Terminal 1: Backend API
npm run dev:server

# Terminal 2: Vite Dev Server
npm run dev
```

---

## 🗄️ Struktur Database SQLite

Database disimpan di `./data/exercise.sqlite` dengan tabel:
- `exercises`: Bank gerakan latihan (nama, kategori, default sets, default reps, notes).
- `routine_days`: Rutinitas harian untuk siklus mingguan (0: Minggu s/d 6: Sabtu).
- `routine_exercises`: Relasi gerakan yang dimasukkan ke hari tertentu beserta target sets/reps.
- `workout_logs`: Riwayat sesi latihan yang diselesaikan per tanggal kalender.
- `apnea_presets`: Pengaturan tabel apnea yang bisa lo buat dan kembangkan seiring waktu.
- `apnea_logs`: Riwayat sesi static apnea yang diselesaikan (total rounds, akumulasi hold time).
