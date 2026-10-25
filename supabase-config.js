'use strict';
/* Konfigurasi Supabase untuk login Google & simpan di cloud.
   Biarkan kosong bila belum dipakai — tombol login tidak akan muncul dan game tetap menyimpan di perangkat.
   anonKey memang boleh terlihat publik; keamanan data diatur oleh Row Level Security (lihat CLOUD-SETUP.md). */
window.SUPABASE_CONFIG = {
  url: 'https://sqrpxtrmasdslkujzgba.supabase.co',
  anonKey: 'sb_publishable_BpY4ZJ_QdG3pCI1AravhHA_0MpRp4fd',   // kunci publik (publishable)
};
