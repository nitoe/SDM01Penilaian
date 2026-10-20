/** Capaian Pembelajaran resmi (Kurikulum Merdeka 2025 + ISMUBA). Teks tidak boleh diubah aplikasi. */
import { ekuivalenMapel } from './tpImport'

export type FaseCp = 'A' | 'B' | 'C'

export interface CapaianResmi {
  mapel: string
  elemen: string
  fase: FaseCp
  /** Teks CP utuh dari dokumen resmi. */
  teks: string
  disiplinSeni?: string
}

export const CAPAIAN_RESMI: CapaianResmi[] = [
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "Pancasila",
    "fase": "A",
    "teks": "Mengenal bendera negara, lagu kebangsaan, simbol dan sila-sila Pancasila dalam lambang negara Garuda Pancasila dan simbol Pancasila beserta sila-sila Pancasila; menerapkan nilai-nilai Pancasila di lingkungan keluarga."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "Pancasila",
    "fase": "B",
    "teks": "Mengidentifikasi makna sila-sila Pancasila, dan penerapannya dalam kehidupan sehari-hari; mengenal karakter para perumus Pancasila; menunjukkan sikap bangga menjadi anak Indonesia yang memiliki bahasa Indonesia sebagai bahasa persatuan di lingkungan sekitar."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "Pancasila",
    "fase": "C",
    "teks": "Memahami kronologi sejarah kelahiran Pancasila; meneladani sikap para perumus Pancasila dan menerapkan di lingkungan masyarakat; menghubungkan sila-sila dalam Pancasila sebagai suatu kesatuan yang utuh; menguraikan makna nilai-nilai Pancasila sebagai dasar negara, dan pandangan hidup bangsa."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "UUD 1945",
    "fase": "A",
    "teks": "Mengenal aturan di lingkungan keluarga; menunjukkan dan menceritakan sikap mematuhi aturan di lingkungan keluarga."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "UUD 1945",
    "fase": "B",
    "teks": "Mengidentifikasi dan melaksanakan aturan di sekolah dan lingkungan tempat tinggal; mengidentifikasi dan menerapkan hak yang didapat dan kewajiban sebagai anggota keluarga dan sebagai warga sekolah."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "UUD 1945",
    "fase": "C",
    "teks": "Mengimplementasikan bentuk-bentuk norma, hak, dan kewajiban dalam kedudukannya sebagai warga negara; mengenal Pembukaan Undang-Undang Dasar Negara Republik Indonesia tahun 1945; mempraktikkan musyawarah untuk membuat kesepakatan dan aturan bersama, serta menerapkannya dalam lingkungan keluarga dan sekolah."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "Bhinneka Tunggal Ika",
    "fase": "A",
    "teks": "Mengenal semboyan Bhinneka Tunggal Ika; mengidentifikasi dan menghargai identitas dirinya sesuai dengan jenis kelamin, hobi, bahasa, serta agama dan kepercayaan di lingkungan sekitar."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "Bhinneka Tunggal Ika",
    "fase": "B",
    "teks": "Membedakan dan menghargai identitas, keluarga, dan teman-temannya sesuai budaya, suku bangsa, bahasa, agama dan kepercayaannya di lingkungan sekitar."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "Bhinneka Tunggal Ika",
    "fase": "C",
    "teks": "Menyajikan hasil identifikasi sikap menghormati, menjaga, dan melestarikan keberagaman budaya sesuai semboyan dalam bingkai Bhinneka Tunggal Ika di lingkungan sekitar."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "Negara Kesatuan Republik Indonesia",
    "fase": "A",
    "teks": "Mengenal karakteristik lingkungan tempat tinggal dan sekolah, sebagai bagian dari wilayah Negara Kesatuan Republik Indonesia; menceritakan dan mempraktikkan bekerja sama menjaga lingkungan sekitar dalam keberagaman."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "Negara Kesatuan Republik Indonesia",
    "fase": "B",
    "teks": "Mengidentifikasi lingkungan tempat tinggal (RT, RW, desa atau kelurahan, dan kecamatan) sebagai bagian dari wilayah Negara Kesatuan Republik Indonesia; menunjukkan perilaku bekerja sama dalam berbagai bentuk keberagaman suku bangsa, sosial, dan budaya di Indonesia yang terikat persatuan dan kesatuan di lingkungan sekitar."
  },
  {
    "mapel": "Pendidikan Pancasila",
    "elemen": "Negara Kesatuan Republik Indonesia",
    "fase": "C",
    "teks": "Mengenal wilayahnya dalam konteks kabupaten/kota, dan provinsi sebagai bagian dari wilayah Negara Kesatuan Republik Indonesia; menunjukkan perilaku gotong royong untuk menjaga persatuan di lingkungan sekolah dan sekitar sebagai wujud bela negara."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Menyimak",
    "fase": "A",
    "teks": "Memahami informasi dari teks nonsastra berbentuk teks aural (teks yang dibacakan dan/atau didengarkan) berupa percakapan yang berkaitan dengan diri, keluarga, dan/atau lingkungan sekitar; dan memahami pesan teks sastra berbentuk teks aural."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Menyimak",
    "fase": "B",
    "teks": "Memahami ide pokok suatu informasi dari teks nonsastra berbentuk teks aural (teks yang dibacakan dan/atau didengarkan); dan memahami isi teks sastra berbentuk teks aural."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Menyimak",
    "fase": "C",
    "teks": "Menganalisis informasi dari teks nonsastra berbentuk teks aural (teks yang dibacakan dan/atau didengarkan); dan menganalisis isi teks sastra berbentuk teks aural."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Membaca dan Memirsa",
    "fase": "A",
    "teks": "Membaca kata-kata sederhana dengan fasih dari bacaan dan/atau tayangan yang dipirsa tentang diri, keluarga, kesehatan, dan/atau lingkungan sekitar; dan memahami isi bacaan dan/atau tayangan yang dipirsa."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Membaca dan Memirsa",
    "fase": "B",
    "teks": "Membaca kata-kata baru dengan fasih dari bacaan dan/atau tayangan yang dipirsa; dan memahami ide pokok, ide pendukung, pesan, dan informasi dalam teks sastra dan nonsastra berbentuk cetak dan/atau elektronik."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Membaca dan Memirsa",
    "fase": "C",
    "teks": "Membaca kata-kata dengan berbagai pola kombinasi huruf dengan fasih dari bacaan dan/atau tayangan yang dipirsa; dan menganalisis informasi serta nilai-nilai dalam teks sastra dan nonsastra berwujud teks visual dan/atau audiovisual."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Berbicara dan Mempresentasikan",
    "fase": "A",
    "teks": "Merespons dengan bertanya tentang sesuatu, menjawab, dan menanggapi komentar orang lain (teman, pendidik, dan/atau orang dewasa) dengan baik dan santun dalam suatu percakapan; mengungkapkan perasaan dan gagasan secara lisan dengan atau tanpa bantuan gambar; dan menceritakan kembali isi berbagai tipe teks yang dibaca, dipirsa, atau didengar."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Berbicara dan Mempresentasikan",
    "fase": "B",
    "teks": "Menyajikan pendapat dengan pilihan kata dan sikap tubuh/gestur yang sesuai, menggunakan volume dan intonasi yang tepat sesuai konteks; menanggapi diskusi sesuai tata cara; dan menceritakan kembali isi dan/atau informasi dari berbagai tipe teks yang dibaca, dipirsa, atau didengar."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Berbicara dan Mempresentasikan",
    "fase": "C",
    "teks": "Mempresentasikan gagasan dari berbagai tipe teks dengan efektif dan santun; dan menyampaikan perasaan berdasarkan fakta, imajinasi (dari diri sendiri dan orang lain) secara indah dan menarik dalam bentuk teks sastra dengan penggunaan kosakata secara kreatif."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Menulis",
    "fase": "A",
    "teks": "Menulis permulaan dengan benar di atas kertas dan/atau melalui media digital; mengembangkan tulisan tangan yang semakin baik; dan menulis berbagai tipe teks sederhana tentang diri, keluarga, dan/atau lingkungan sekitar dengan beberapa kalimat sederhana."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Menulis",
    "fase": "B",
    "teks": "Menulis berbagai tipe teks sederhana dengan rangkaian kalimat yang beragam; dan menggunakan kaidah kebahasaan dan kosakata baru yang memiliki makna denotatif untuk menulis teks sesuai dengan konteks."
  },
  {
    "mapel": "Bahasa Indonesia",
    "elemen": "Menulis",
    "fase": "C",
    "teks": "Menulis berbagai tipe teks sederhana berdasarkan gagasan, hasil pengamatan, pengalaman, dan/atau imajinasi dengan rangkaian kalimat kompleks secara kreatif, menarik, dan/atau indah; dan menggunakan kaidah kebahasaan dan kosakata baru yang memiliki makna denotatif dan konotatif."
  },
  {
    "mapel": "Matematika",
    "elemen": "Bilangan",
    "fase": "A",
    "teks": "Menunjukkan pemahaman dan memiliki intuisi bilangan (number sense) pada bilangan cacah sampai 100; membaca, menulis, menentukan nilai tempat, membandingkan, mengurutkan, serta melakukan komposisi dan dekomposisi bilangan; melakukan operasi penjumlahan dan pengurangan menggunakan benda-benda konkret yang banyaknya sampai 20; dan menunjukkan pemahaman pecahan sebagai bagian dari keseluruhan melalui konteks membagi sebuah benda atau kumpulan benda sama banyak (pecahan yang diperkenalkan adalah setengah dan seperempat)."
  },
  {
    "mapel": "Matematika",
    "elemen": "Bilangan",
    "fase": "B",
    "teks": "Memiliki pemahaman dan intuisi bilangan (number sense) pada bilangan cacah sampai 10.000; membaca, menulis, membandingkan, dan mengurutkan bilangan; menentukan dan menggunakan nilai tempat; melakukan komposisi dan dekomposisi bilangan cacah sampai 10.000. Murid dapat melakukan dan menyelesaikan masalah operasi bilangan penjumlahan dan pengurangan bilangan cacah sampai 1.000; melakukan dan menyelesaikan masalah operasi perkalian dan pembagian bilangan cacah sampai 100 dengan bantuan benda konkret, gambar dan simbol; mengenal kelipatan dan faktor. Murid dapat melakukan perbandingan dan pengurutan pecahan dengan pembilang satu dan antar pecahan dengan penyebut yang sama; mengenal dan dapat menerapkan pecahan senilai, memiliki intuisi pecahan dan desimal, serta dapat menentukan pecahan sebagai desimal dan persen."
  },
  {
    "mapel": "Matematika",
    "elemen": "Bilangan",
    "fase": "C",
    "teks": "Menunjukkan pemahaman dan intuisi bilangan (number sense) pada bilangan cacah sampai 1.000.000; membaca, menulis, menentukan nilai tempat, membandingkan, mengurutkan, melakukan komposisi dan dekomposisi bilangan; menyelesaikan masalah yang berkaitan dengan uang; melakukan operasi penjumlahan, pengurangan, perkalian, dan pembagian bilangan cacah sampai 100.000; serta menyelesaikan masalah yang berkaitan dengan KPK dan FPB. Murid dapat membandingkan dan mengurutkan berbagai pecahan termasuk pecahan campuran, melakukan operasi penjumlahan dan pengurangan pecahan, serta melakukan operasi perkalian dan pembagian pecahan dengan bilangan asli; mengubah pecahan menjadi berbagai bentuk pecahan lain, serta membandingkan dan mengurutkan bilangan desimal (satu angka di belakang koma)."
  },
  {
    "mapel": "Matematika",
    "elemen": "Aljabar",
    "fase": "A",
    "teks": "Menunjukan pemahaman makna simbol matematika \"=\" dalam suatu kalimat matematika yang terkait dengan penjumlahan dan pengurangan bilangan cacah sampai 20 menggunakan gambar. Murid dapat mengenali, meniru, dan melanjutkan pola bukan bilangan (misalnya, gambar, warna, bunyi/suara)."
  },
  {
    "mapel": "Matematika",
    "elemen": "Aljabar",
    "fase": "B",
    "teks": "Menemukan nilai yang tidak diketahui dalam kalimat matematika yang melibatkan penjumlahan dan pengurangan pada bilangan cacah sampai 100, dengan menggunakan sifat-sifat bilangan dan operasinya. Murid dapat mengidentifikasi, meniru, dan mengembangkan pola gambar atau objek sederhana dan pola bilangan membesar dan mengecil yang dapat melibatkan penjumlahan dan pengurangan pada bilangan cacah sampai 100."
  },
  {
    "mapel": "Matematika",
    "elemen": "Aljabar",
    "fase": "C",
    "teks": "Menemukan nilai yang belum diketahui dalam kalimat matematika yang melibatkan penjumlahan, pengurangan, perkalian, dan pembagian pada bilangan cacah sampai 1.000 dengan menggunakan sifat-sifat bilangan dan operasinya. Murid dapat mengidentifikasi, meniru, dan mengembangkan pola bilangan membesar dan mengecil yang melibatkan perkalian dan pembagian; bernalar secara proporsional untuk menyelesaikan masalah sehari-hari dengan rasio satuan; menggunakan operasi perkalian dan pembagian dalam menyelesaikan masalah sehari-hari yang terkait dengan proporsi."
  },
  {
    "mapel": "Matematika",
    "elemen": "Pengukuran",
    "fase": "A",
    "teks": "Membandingkan panjang dan berat benda secara langsung, dan membandingkan durasi waktu; mengukur dan mengestimasi panjang dan berat benda menggunakan satuan tidak baku."
  },
  {
    "mapel": "Matematika",
    "elemen": "Pengukuran",
    "fase": "B",
    "teks": "Mengukur panjang dan berat benda menggunakan satuan baku; menentukan hubungan antar-satuan baku panjang (cm, m) dan antar-satuan berat (g, kg); serta mengukur dan mengestimasi luas dan volume menggunakan satuan tidak baku dan satuan baku berupa bilangan cacah."
  },
  {
    "mapel": "Matematika",
    "elemen": "Pengukuran",
    "fase": "C",
    "teks": "Menentukan keliling dan luas berbagai bentuk bangun datar (segitiga, segiempat, dan segi banyak) serta gabungannya; menghitung durasi waktu dan mengukur besar sudut pada bangun datar atau yang dibentuk dari dua garis berpotongan."
  },
  {
    "mapel": "Matematika",
    "elemen": "Geometri",
    "fase": "A",
    "teks": "Mengenal berbagai bangun datar (segitiga, segiempat, segi banyak, lingkaran) dan bangun ruang (balok, kubus, kerucut, dan bola); melakukan komposisi (penyusunan) dan dekomposisi (penguraian) suatu bangun datar (segitiga, segiempat, dan segi banyak); dan menentukan posisi benda terhadap benda lain (kanan, kiri, depan, belakang, bawah, atas)."
  },
  {
    "mapel": "Matematika",
    "elemen": "Geometri",
    "fase": "B",
    "teks": "Mendeskripsikan ciri berbagai bentuk bangun datar (segiempat, segitiga, segi banyak); menyusun (komposisi) dan mengurai (dekomposisi) berbagai bangun datar dengan lebih dari satu cara jika memungkinkan."
  },
  {
    "mapel": "Matematika",
    "elemen": "Geometri",
    "fase": "C",
    "teks": "Mengkonstruksi dan mengurai bangun ruang (kubus, balok, dan gabungannya) dan mengenali visualisasi spasial (bagian depan, atas, dan samping); membandingkan karakteristik antar bangun datar dan antar bangun ruang; serta menentukan lokasi pada peta yang menggunakan sistem berpetak."
  },
  {
    "mapel": "Matematika",
    "elemen": "Analisis Data dan Peluang",
    "fase": "A",
    "teks": "Mengurutkan, menyortir, mengelompokkan, membandingkan, dan menyajikan data dari banyak benda dengan menggunakan turus dan piktogram paling banyak 4 kategori."
  },
  {
    "mapel": "Matematika",
    "elemen": "Analisis Data dan Peluang",
    "fase": "B",
    "teks": "Mengurutkan, membandingkan, menyajikan, menganalisis dan menginterpretasi data dalam bentuk tabel, diagram gambar, piktogram, dan diagram batang (skala satu satuan)."
  },
  {
    "mapel": "Matematika",
    "elemen": "Analisis Data dan Peluang",
    "fase": "C",
    "teks": "Mengurutkan, membandingkan, menyajikan, dan menganalisis data banyak benda dan data hasil pengukuran dalam bentuk gambar, piktogram, diagram batang, dan tabel frekuensi untuk mendapatkan informasi; menentukan kejadian dengan kemungkinan yang lebih besar atau lebih kecil dalam suatu percobaan acak."
  },
  {
    "mapel": "IPAS",
    "elemen": "Pemahaman IPAS",
    "fase": "B",
    "teks": "Menjelaskan bentuk dan fungsi pancaindra; menganalisis siklus hidup makhluk hidup dan upaya pelestariannya; menghasilkan solusi untuk masalah yang berkaitan dengan pelestarian sumber daya alam sebagai upaya mitigasi perubahan iklim; menyimpulkan proses perubahan wujud zat; menjelaskan sumber dan bentuk energi, serta proses perubahan bentuk energi dalam kehidupan sehari-hari; membedakan jenis gaya dan pengaruhnya terhadap arah, gerak, dan bentuk benda; menjelaskan peran, tugas, dan tanggung jawab serta interaksi sosial yang terjadi di sekitar tempat tinggal dan sekolah; mengenali letak kabupaten/kota dan provinsi tempat tinggalnya dengan menggunakan peta konvensional/digital; mengklasifikasikan ragam bentang alam dan keterkaitannya dengan profesi masyarakat, ragam budaya serta upaya untuk melestarikannya; menganalisis sejarah masyarakat di lingkungan tempat tinggal; menjelaskan nilai mata uang dan fungsinya, serta cara mengelola keuangan secara bijak."
  },
  {
    "mapel": "IPAS",
    "elemen": "Pemahaman IPAS",
    "fase": "C",
    "teks": "Merefleksikan sistem organ tubuh manusia yang dikaitkan dengan cara menjaga kesehatan tubuhnya; menganalisis hubungan antar komponen biotik dan abiotik, serta pengaruhnya terhadap ekosistem; menjelaskan fenomena gelombang bunyi dan cahaya dalam kehidupan sehari-hari; menghasilkan upaya penghematan energi, serta pemanfaatan sumber energi alternatif dari sumber daya yang ada di sekitarnya sebagai upaya mitigasi perubahan iklim; menjelaskan sistem tata surya, serta kaitannya dengan rotasi dan revolusi bumi; menjelaskan letak dan kondisi geografis negara Indonesia dengan menggunakan peta konvensional/digital; meninjau sejarah perjuangan para pahlawan di lingkungan sekitar tempat tinggalnya; menemukan keragaman budaya nasional dalam konteks kebhinekaan berdasarkan pemahaman terhadap nilai-nilai kearifan lokal yang berlaku di wilayah tempat tinggal; serta menerapkan kegiatan ekonomi masyarakat di lingkungan sekitar."
  },
  {
    "mapel": "IPAS",
    "elemen": "Keterampilan Proses",
    "fase": "B",
    "teks": "Mengamati\nMurid mengamati fenomena dan peristiwa secara sederhana dan dapat mencatat hasil pengamatannya.\nMempertanyakan dan Memprediksi\nSecara mandiri, murid mengajukan pertanyaan tentang hal-hal yang ingin diketahui saat melakukan pengamatan dan membuat prediksi berdasarkan pengetahuan yang dimiliki sebelumnya.\nMerencanakan dan Melakukan Penyelidikan\nDengan panduan pendidik, murid membuat rencana dan melakukan langkah-langkah operasional untuk menjawab pertanyaan yang diajukan. Murid melakukan observasi menggunakan alat bantu pengukuran sederhana.\nMemproses, Menganalisis Data dan Informasi\nDengan panduan pendidik, murid mengorganisasikan data dalam bentuk turus dan diagram gambar untuk menyajikan dan mengidentifikasi pola. Murid membandingkan antara hasil pengamatan dengan prediksi dan memberikan penjelasan.\nMengevaluasi dan Refleksi\nMurid melakukan refleksi terhadap penyelidikan yang sudah dilakukan.\nMengomunikasikan Hasil\nMurid mengomunikasikan hasil penyelidikan secara lisan dan tertulis dalam berbagai media."
  },
  {
    "mapel": "IPAS",
    "elemen": "Keterampilan Proses",
    "fase": "C",
    "teks": "Mengamati\nMurid mengamati fenomena dan peristiwa secara sederhana, mencatat hasil pengamatannya, serta mencari persamaan dan perbedaannya.\nMempertanyakan dan Memprediksi\nDengan panduan pendidik, murid mengidentifikasi pertanyaan yang dapat diselidiki secara ilmiah dan membuat prediksinya.\nMerencanakan dan Melakukan Penyelidikan\nSecara mandiri, murid merencanakan dan melakukan langkah-langkah operasional untuk menjawab pertanyaan yang diajukan. Murid melakukan observasi menggunakan alat bantu pengukuran sederhana.\nMemproses serta Menganalisis Data dan Informasi\nMurid mengolah data dalam bentuk tabel dan grafik, serta menjelaskan hasil pengamatan dan pola atau hubungan pada data. Murid membandingkan data dengan prediksi dan memberikan alasan berdasarkan bukti.\nMengevaluasi dan Refleksi\nMelakukan refleksi dan memberikan saran perbaikan terhadap penyelidikan yang sudah dilakukan.\nMengomunikasikan Hasil\nMurid mengomunikasikan hasil penyelidikan secara utuh yang ditunjang dengan argumen dalam berbagai media."
  },
  {
    "mapel": "Bahasa Inggris",
    "elemen": "Menyimak – Berbicara",
    "fase": "A",
    "teks": "Peserta didik mampu mengenali dan merespons kosakata serta ungkapan sederhana dalam konteks kehidupan sehari-hari melalui kegiatan mendengarkan, meniru, dan mengucapkan kembali secara verbal maupun nonverbal."
  },
  {
    "mapel": "Bahasa Inggris",
    "elemen": "Menyimak – Berbicara",
    "fase": "B",
    "teks": "Memahami dan merespon teks lisan atau teks multimodal sederhana tentang kehidupan sehari-hari baik secara verbal atau non-verbal sesuai konteks.\n(Understand and respond to simple oral or multimodal texts about everyday life verbally or non-verbally in line with its context.)"
  },
  {
    "mapel": "Bahasa Inggris",
    "elemen": "Menyimak – Berbicara",
    "fase": "C",
    "teks": "Memahami alur informasi teks secara keseluruhan dan merespon teks lisan atau teks multimodal sederhana tentang topik sehari-hari secara lisan dengan kalimat pendek dan sederhana sesuai konteks.\n(Understand the entire flow of information and respond to simple oral or multimodal texts about everyday topics using short and simple sentences verbally in line with its context.)"
  },
  {
    "mapel": "Bahasa Inggris",
    "elemen": "Membaca – Memirsa",
    "fase": "A",
    "teks": "Peserta didik mampu mengenali huruf dan bunyi dasar alfabet dalam Bahasa Inggris, memahami makna kata sederhana dari gambar atau teks pendek, serta meresponsnya secara verbal atau nonverbal sesuai konteks."
  },
  {
    "mapel": "Bahasa Inggris",
    "elemen": "Membaca – Memirsa",
    "fase": "B",
    "teks": "Memahami teks tulis pendek sederhana atau teks multimodal tentang kehidupan sehari-hari dan meresponsnya secara verbal atau non-verbal sesuai konteks.\n(Understand simple short texts or multimodal texts about everyday life and respond to them verbally or non-verbally in line with its context.)"
  },
  {
    "mapel": "Bahasa Inggris",
    "elemen": "Membaca – Memirsa",
    "fase": "C",
    "teks": "Memahami alur informasi secara keseluruhan, gagasan utama dan informasi rinci dari beragam teks pendek atau teks multimodal tentang topik sehari-hari dan meresponnya sesuai konteks.\n(Understand the entire flow of information, main ideas and details from a variety of short texts or multimodal texts about everyday topics and respond in line with its context.)"
  },
  {
    "mapel": "Bahasa Inggris",
    "elemen": "Menulis – Mempresentasikan",
    "fase": "A",
    "teks": "Peserta didik mampu meniru dan menuliskan huruf serta kata sederhana dalam Bahasa Inggris dengan benar, serta mengomunikasikan gagasan dasar tentang diri, keluarga, dan lingkungan sekitar melalui media tulisan, gambar, atau karya sederhana."
  },
  {
    "mapel": "Bahasa Inggris",
    "elemen": "Menulis – Mempresentasikan",
    "fase": "B",
    "teks": "Mengomunikasikan gagasan tentang topik sehari-hari dalam teks tulis pendek atau teks multimodal sesuai konteks.\n(Communicate their ideas on everyday life topics in simple written or multimodal texts in line with its context.)"
  },
  {
    "mapel": "Bahasa Inggris",
    "elemen": "Menulis – Mempresentasikan",
    "fase": "C",
    "teks": "Mengomunikasikan ide dan pengalamannya melalui berbagai jenis teks tulis sederhana atau teks multimodal tentang topik sehari-hari sesuai konteks.\n(Communicate their ideas and experiences through various types of simple written texts or multimodal texts about everyday topics in line with its context.)"
  },
  {
    "mapel": "PJOK",
    "elemen": "Terampil Bergerak",
    "fase": "A",
    "teks": "Mempraktikkan keterampilan gerak fundamental dan menerapkannya dalam berbagai situasi gerak yang berbeda; mengeksplorasi berbagai strategi gerak; dan mengeksplorasi berbagai konsep gerak serta menyimpulkan efektivitasnya."
  },
  {
    "mapel": "PJOK",
    "elemen": "Terampil Bergerak",
    "fase": "B",
    "teks": "Menghaluskan keterampilan gerak fundamental dan menerapkannya dalam situasi gerak yang baru; menyesuaikan strategi gerak untuk mendapatkan capaian keterampilan gerak; dan memperagakan berbagai konsep gerak yang dapat diterapkan dalam rangkaian gerak."
  },
  {
    "mapel": "PJOK",
    "elemen": "Terampil Bergerak",
    "fase": "C",
    "teks": "Menyesuaikan keterampilan gerak melintasi berbagai situasi gerak; mentransfer strategi gerak yang sudah dikuasai ke dalam berbagai situasi gerak yang berbeda; dan menginvestigasi berbagai konsep gerak yang dapat diterapkan untuk meningkatkan capaian keterampilan gerak."
  },
  {
    "mapel": "PJOK",
    "elemen": "Belajar Melalui Gerak",
    "fase": "A",
    "teks": "Menaati peraturan untuk menumbuhkan fair play di dalam berbagai aktivitas jasmani; menerapkan strategi kolaborasi ketika berpartisipasi dalam aktivitas jasmani."
  },
  {
    "mapel": "PJOK",
    "elemen": "Belajar Melalui Gerak",
    "fase": "B",
    "teks": "Menerapkan strategi gerak sederhana dan memecahkan masalah gerak; menerapkan peraturan untuk menumbuhkan fair play di dalam berbagai aktivitas jasmani; dan berpartisipasi secara positif dalam kelompok atau tim di dalam berbagai aktivitas jasmani."
  },
  {
    "mapel": "PJOK",
    "elemen": "Belajar Melalui Gerak",
    "fase": "C",
    "teks": "Menguji efektivitas penerapan strategi gerak dalam berbagai situasi gerak; merancang peraturan alternatif dan modifikasi permainan untuk mendukung fair play dan partisipasi inklusif; dan menjalankan berbagai peran untuk mencapai keberhasilan kelompok atau tim di dalam berbagai aktivitas jasmani."
  },
  {
    "mapel": "PJOK",
    "elemen": "Bergaya Hidup Aktif",
    "fase": "A",
    "teks": "Berpartisipasi di dalam berbagai aktivitas jasmani dan mengidentifikasi manfaatnya."
  },
  {
    "mapel": "PJOK",
    "elemen": "Bergaya Hidup Aktif",
    "fase": "B",
    "teks": "Berpartisipasi dalam berbagai aktivitas jasmani dan mengenali faktor-faktor yang menyebabkan aktivitas jasmani menyenangkan."
  },
  {
    "mapel": "PJOK",
    "elemen": "Bergaya Hidup Aktif",
    "fase": "C",
    "teks": "Berpartisipasi dalam aktivitas jasmani dan menjelaskan pengaruh aktivitas jasmani yang teratur terhadap kesehatan; mengidentifikasi rekomendasi aktivitas jasmani serta pencegahan perilaku sedenter."
  },
  {
    "mapel": "PJOK",
    "elemen": "Memilih Hidup yang Menyehatkan",
    "fase": "A",
    "teks": "Mengenali gaya hidup aktif dan sehat; mengenali manfaat komponen makanan bergizi seimbang; serta mengenali situasi dan potensi yang berisiko terhadap kesehatan dan keselamatan serta strategi mencari bantuan kepada orang dewasa terpercaya."
  },
  {
    "mapel": "PJOK",
    "elemen": "Memilih Hidup yang Menyehatkan",
    "fase": "B",
    "teks": "Mengenali risiko kesehatan akibat gaya hidup dan berbagai aktivitas jasmani untuk pencegahannya; mengidentifikasi pola makan sehat dan bergizi seimbang sesuai rekomendasi kesehatan untuk menunjang aktivitas sehari-hari; dan mempraktikkan penanganan cedera ringan sesuai pemahaman tentang prinsip pertolongan pertama."
  },
  {
    "mapel": "PJOK",
    "elemen": "Memilih Hidup yang Menyehatkan",
    "fase": "C",
    "teks": "Mengidentifikasi dan menghubungkan antara gaya hidup, risiko kesehatan, dan aktivitas pencegahannya sesuai rekomendasi otoritas kesehatan; menjelaskan pola makan sehat untuk menunjang aktivitas jasmani berdasarkan informasi kandungan gizi pada makanan; dan mempraktikkan penanganan cedera sedang sesuai pemahaman tentang prinsip pertolongan pertama."
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "A",
    "teks": "Mengenali unsur-unsur musik (nada dan irama) menggunakan anggota tubuh maupun alat musik.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "B",
    "teks": "Mengenali nada dan pola irama menggunakan anggota tubuh maupun alat musik.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "C",
    "teks": "Mengenali dan menerapkan unsur-unsur musik (nada, irama dan melodi) menggunakan alat musik ritmis dan melodis serta menunjukkan tingkat kepekaan akan unsur-unsur musik dengan menggunakan alat musik ritmis dan melodis.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "A",
    "teks": "Melakukan umpan balik mengenai praktik bermain musik diri sendiri atau orang lain menggunakan bahasa sehari-hari.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "B",
    "teks": "Melakukan umpan balik mengenai praktik bermusik diri sendiri atau orang lain menggunakan istilah musik.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "C",
    "teks": "Melakukan umpan balik mengenai karya dan kemampuan bermusik diri sendiri atau orang lain menggunakan istilah musik yang tepat.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "A",
    "teks": "Menirukan pola irama dan nada menggunakan alat musik ritmis atau melodis; mengenali ragam alat musik dan bunyi yang dihasilkan; mengenali cara memainkan dan membersihkan instrumen/alat musik.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "B",
    "teks": "Menirukan pola irama dan melodi menggunakan alat musik ritmis atau melodis; menyebutkan karakteristik ragam alat musik dan bunyi yang dihasilkan; mengetahui cara memainkan dan merawat alat musik.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "C",
    "teks": "Mengeksplorasi variasi pola irama, tempo dan melodi dengan alat musik ritmis dan melodis menggunakan notasi musik dan teknik dasar yang telah dipelajari; menemukan alternatif untuk menghasilkan bunyi musik sederhana melalui eksplorasi material yang tersedia di lingkungan sekitar dan menerapkan cara memainkan dan merawat alat musik dengan teknik yang tepat sesuai dengan spesifikasi bahan alat musik.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "A",
    "teks": "Membuat pola irama menggunakan anggota tubuh atau alat musik ritmis yang tersedia di lingkungan sekitar.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "B",
    "teks": "Membuat bunyi menggunakan anggota tubuh atau alat musik ritmis dan melodis yang tersedia di lingkungan sekitar.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "C",
    "teks": "Membuat dan mengembangkan pola irama menggunakan anggota tubuh atau alat musik ritmis yang tersedia berdasarkan nilai kearifan lokal daerahnya.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "A",
    "teks": "Menunjukkan ekspresi senang dalam kegiatan bermusik.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "B",
    "teks": "Menunjukkan minat dalam kegiatan bermusik.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "C",
    "teks": "Menunjukkan minat dan rasa ingin tahu dalam kegiatan bermusik.",
    "disiplinSeni": "Seni Musik"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "A",
    "teks": "Mengenali dan menyebutkan unsur-unsur rupa dalam benda-benda di sekitar/karya seni rupa.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "B",
    "teks": "Mengidentifikasi unsur rupa dan prinsip desain dalam benda-benda di sekitar/karya seni rupa.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "C",
    "teks": "Menjelaskan unsur rupa dan prinsip desain dalam benda-benda di sekitar/karya seni rupa.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "A",
    "teks": "Merefleksikan dan mengapresiasi karya diri sendiri.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "B",
    "teks": "Merefleksikan dan mengapresiasi karya diri sendiri dan teman sekelas menggunakan kosa kata seni rupa yang sesuai.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "C",
    "teks": "Merefleksikan dan mengapresiasi karya diri sendiri dan teman sekelas menggunakan kosa kata seni rupa yang sesuai.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "A",
    "teks": "Mengenali dan menguji coba alat dan/atau bahan yang dimiliki.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "B",
    "teks": "Mengenali dan menguji coba alat dan/atau bahan yang dimiliki serta prosedur penggunaannya.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "C",
    "teks": "Mengenali dan menguji coba variasi teknik penggunaan alat dan/atau bahan.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "A",
    "teks": "Membuat karya seni rupa berdasarkan pengalaman dan hasil pengamatan terhadap lingkungan sekitar.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "B",
    "teks": "Membuat karya seni rupa berdasarkan pengalaman dan hasil pengamatan terhadap lingkungan sekitar.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "C",
    "teks": "Membuat karya seni rupa berdasarkan pengalaman dan/atau hasil pengamatan terhadap lingkungan sekitar melalui pengembangan imajinasi.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "A",
    "teks": "Menghasilkan karya seni rupa yang berdampak pada perasaan dirinya.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "B",
    "teks": "Menghasilkan karya seni rupa yang berdampak pada perasaan atau mewakili harapannya.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "C",
    "teks": "Menghasilkan karya seni rupa yang mewakili minatnya.",
    "disiplinSeni": "Seni Rupa"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "A",
    "teks": "Mengenal bentuk tari sebagai media komunikasi serta mengembangkan kesadaran diri dalam bereksplorasi unsur utama tari meliputi gerak, ruang, tenaga, waktu, gerak di tempat dan gerak berpindah.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "B",
    "teks": "Mengamati bentuk penyajian tari berdasarkan latar belakang serta mengeksplorasi unsur utama tari sesuai level gerak, dan perubahan arah hadap.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "C",
    "teks": "Mengamati berbagai bentuk tari tradisi yang dapat digunakan untuk mengekspresikan diri melalui unsur pendukung tari.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "A",
    "teks": "Mengidentifikasi unsur utama tari meliputi gerak, ruang, tenaga, waktu, gerak di tempat dan gerak berpindah, serta mengemukakan pencapaian diri secara lisan, tulisan, dan kinestetik.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "B",
    "teks": "Mengamati bentuk penyajian tari berdasarkan latar belakang serta mengeksplorasi unsur utama tari sesuai level gerak, dan perubahan arah hadap.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "C",
    "teks": "Mengidentifikasi unsur pendukung tari dalam tari tradisi serta menghargai hasil pencapaian diri dengan mempertimbangkan pendapat orang lain.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "A",
    "teks": "Meragakan hasil gerak berdasarkan etika sebagai penampil dan penonton dengan keyakinan dan percaya diri saat mengekspresikan ide, perasaan kepada penonton atau lingkungan sekitar.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "B",
    "teks": "Meragakan hasil tari dengan bekerja secara kooperatif untuk mengembangkan kemampuan bekerja sama dan saling menghargai demi tercapainya tujuan bersama.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "C",
    "teks": "Meragakan hasil rangkaian gerak tari menggunakan unsur pendukung tari dengan menunjukan kerja sama dan berperan aktif dalam kelompok.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "A",
    "teks": "Mengembangkan unsur utama tari (gerak, ruang, waktu, dan tenaga), gerak di tempat, dan gerak berpindah untuk membuat gerak sederhana yang memiliki kesatuan gerak yang indah.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "B",
    "teks": "Mengembangkan gerak dengan unsur utama tari, level, dan perubahan arah hadap.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "C",
    "teks": "Meragakan hasil rangkaian gerak tari menggunakan unsur pendukung tari dengan menunjukan kerja sama dan berperan aktif dalam kelompok.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "A",
    "teks": "Menerima proses pembelajaran sehingga tumbuh rasa ingin tahu dan dapat menunjukkan antusiasme yang berdampak pada kemampuan diri dalam menyelesaikan aktivitas pembelajaran tari.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "B",
    "teks": "Menerima proses pembelajaran sehingga tumbuh rasa ingin tahu dan dapat menunjukkan usaha yang berdampak pada kemampuan diri dalam menyelesaikan aktivitas pembelajaran tari.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "C",
    "teks": "Menanggapi kejadian-kejadian di lingkungan sekitar melalui tari yang disajikan kepada penonton atau masyarakat sekitar.",
    "disiplinSeni": "Seni Tari"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "A",
    "teks": "Mengamati, merespons, meniru gerak tubuh dan suara sebagai media untuk mengomunikasikan emosi.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "B",
    "teks": "Mengenal teknik dasar akting (pemeranan) melalui proses meniru (mimesis), mengenal gerak tubuh, suara/vokal sesuai tokoh/peran atau perilaku objek sekitar.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Mengalami",
    "fase": "C",
    "teks": "Melakukan permainan peran berkelompok, seperti improvisasi untuk melatih aksi dan reaksi dalam mengelaborasi cerita atau tokoh dan melakukan pengenalan karakter melalui pengamatan kebiasaan tokoh yang diperankan.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "A",
    "teks": "Mengenali pengalaman dan emosi selama proses berseni teater serta menceritakan sebuah karya dengan kosakata sehari-hari.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "B",
    "teks": "Mengenali lingkungan sekitarnya dan pengalaman dalam bermain teater.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Merefleksikan",
    "fase": "C",
    "teks": "Menceritakan pendapatnya tentang sebuah cerita sederhana (penokohan, perwatakan).",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "A",
    "teks": "Mengenal jenis-jenis properti/alat bantu yang dapat mendukung cerita/permainan peran.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "B",
    "teks": "Menggunakan properti yang sesuai dengan tokoh yang diperankan.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berpikir dan Bekerja Artistik",
    "fase": "C",
    "teks": "Mengidentifikasi properti sederhana berdasarkan cerita yang akan dimainkan.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "A",
    "teks": "Mengeksplorasi beragam peran mengenai tokoh di sekitar atau rekaan, dan memainkan sebuah lakon pertunjukan.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "B",
    "teks": "Mengamati berbagai peran, mengenal tokoh di sekitar, dan memainkan sebuah lakon dalam cerita.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Menciptakan",
    "fase": "C",
    "teks": "Mengenal dan memainkan ragam peran dari cerita sederhana berdasarkan hasil pengamatan.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "A",
    "teks": "Memainkan gerak dan lagu sesuai arahan dari pendidik.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "B",
    "teks": "Mengenal bentuk lakon dalam bermain teater.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Seni Budaya",
    "elemen": "Berdampak",
    "fase": "C",
    "teks": "Memerankan lakon secara individu maupun berkelompok berdasarkan minat, pengamatan, dan pengalaman.",
    "disiplinSeni": "Seni Teater"
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Sosiolinguistik",
    "fase": "A",
    "teks": "Mengenal keberadaan bahasa Sunda dalam kehidupan sehari-hari di lingkungan sekitar."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Sosiolinguistik",
    "fase": "B",
    "teks": "Membedakan situasi formal dan non-formal yang memerlukan penggunaan bahasa Sunda halus."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Sosiolinguistik",
    "fase": "C",
    "teks": "Menerapkan prinsip kesantunan berbahasa (unggah-ungguh) dalam berbagai konteks komunikasi."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Kosakata",
    "fase": "A",
    "teks": "Mengenal kosakata Sunda dasar terkait identitas diri, keluarga, dan lingkungan terdekat."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Kosakata",
    "fase": "B",
    "teks": "Menguasai kosakata Sunda halus untuk kebutuhan komunikasi sehari-hari di sekolah dan masyarakat."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Kosakata",
    "fase": "C",
    "teks": "Mengembangkan kosakata Sunda halus untuk topik yang lebih kompleks dan konteks yang beragam."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Kompetensi Pragmatik",
    "fase": "A",
    "teks": "Meniru dan merespons ungkapan kesantunan dasar dalam interaksi sederhana."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Kompetensi Pragmatik",
    "fase": "B",
    "teks": "Memahami dan merespons percakapan pendek dengan ungkapan yang sesuai konteks sosial."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Kompetensi Pragmatik",
    "fase": "C",
    "teks": "Berpartisipasi aktif dalam percakapan terpandu dengan memperhatikan norma kesantunan."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Apresiasi Budaya",
    "fase": "A",
    "teks": "Mengenal keberagaman budaya Sunda melalui pengalaman langsung di lingkungan sekitar."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Apresiasi Budaya",
    "fase": "B",
    "teks": "Menghargai nilai-nilai kearifan lokal Sunda dalam kehidupan sehari-hari."
  },
  {
    "mapel": "Bahasa Sunda",
    "elemen": "Apresiasi Budaya",
    "fase": "C",
    "teks": "Merefleksikan nilai-nilai budaya Sunda dan keterkaitannya dengan kehidupan modern."
  },
  {
    "mapel": "Koding dan Kecerdasan Artifisial",
    "elemen": "Berpikir Komputasional",
    "fase": "C",
    "teks": "Peserta didik memahami permasalahan sederhana dalam kehidupan sehari-hari; mampu menerapkan pemecahan masalah secara sistematis; mampu menuliskan instruksi logis dan terstruktur menggunakan sekumpulan kosakata atau simbol."
  },
  {
    "mapel": "Koding dan Kecerdasan Artifisial",
    "elemen": "Literasi Digital",
    "fase": "C",
    "teks": "Peserta didik mampu memahami konsep dasar, manfaat, dan dampak teknologi digital, memahami sistem komputer tingkat pradasar, menerapkan pengamanan informasi pribadi dalam komunikasi daring, memanfaatkan internet, dan memproduksi serta mendiseminasi konten digital dalam bentuk teks dan gambar."
  },
  {
    "mapel": "Koding dan Kecerdasan Artifisial",
    "elemen": "Literasi dan Etika Kecerdasan Artifisial (KA)",
    "fase": "C",
    "teks": "Peserta didik mampu memahami konsep KA sederhana, manfaat dan dampak KA pada kehidupan sehari-hari, prinsip bahwa KA dikembangkan untuk meningkatkan kesejahteraan manusia dan tidak boleh merugikan manusia, mengetahui perbedaan manusia dan komputer dalam melakukan penginderaan, dan mengetahui perbedaan antara mesin cerdas dan mesin non-cerdas. Peserta didik mampu memahami etika dasar penggunaan KA seperti empati dan tidak menyakiti orang lain."
  },
  {
    "mapel": "Koding dan Kecerdasan Artifisial",
    "elemen": "Pemanfaatan dan Pengembangan Kecerdasan Artifisial",
    "fase": "C",
    "teks": "Peserta didik mampu menyimulasikan secara sederhana kerja KA saat mengenali pola, mengklasifikasi benda konkret berdasarkan sifatnya, dan mengetahui bagaimana prediksi sistem KA dipengaruhi input benda konkret."
  },
  {
    "mapel": "Informatika",
    "elemen": "Teknologi Informasi dan Komunikasi (TIK)",
    "fase": "A",
    "teks": "Mengenali perangkat TIK di sekitar dan menggunakan secara aman untuk berkomunikasi, belajar, dan berkarya sederhana."
  },
  {
    "mapel": "Informatika",
    "elemen": "Teknologi Informasi dan Komunikasi (TIK)",
    "fase": "B",
    "teks": "Memanfaatkan perangkat TIK seperti komputer, tablet, atau gawai untuk mengetik, menggambar, berhitung, dan menyajikan informasi dengan praktik baik (ergonomi, keamanan data, dan etika)."
  },
  {
    "mapel": "Informatika",
    "elemen": "Teknologi Informasi dan Komunikasi (TIK)",
    "fase": "C",
    "teks": "Menggunakan berbagai fitur sederhana aplikasi pengolah kata, gambar, dan data; serta membaca dan memahami makna file digital."
  },
  {
    "mapel": "Informatika",
    "elemen": "Sistem Komputer (SK)",
    "fase": "A",
    "teks": "Mengenali bahwa komputer tersusun dari beberapa bagian (input, proses, output) dan dapat ditemukan dalam perangkat sehari-hari."
  },
  {
    "mapel": "Informatika",
    "elemen": "Sistem Komputer (SK)",
    "fase": "B",
    "teks": "Menyebutkan dan menjelaskan fungsi dasar perangkat sistem komputer di sekitarnya (misal: CPU, monitor, printer)."
  },
  {
    "mapel": "Informatika",
    "elemen": "Sistem Komputer (SK)",
    "fase": "C",
    "teks": "Mengenali dan menggunakan lebih banyak perangkat sistem komputer serta memahami konsep sederhana integrasi komponen dalam sistem."
  },
  {
    "mapel": "Informatika",
    "elemen": "Jaringan Komputer dan Internet (JKI)",
    "fase": "A",
    "teks": "Mengenali sinyal telepon seluler dan Wi-Fi serta memahami keberadaannya."
  },
  {
    "mapel": "Informatika",
    "elemen": "Jaringan Komputer dan Internet (JKI)",
    "fase": "B",
    "teks": "Menggunakan jaringan lokal (bluetooth, Wi-Fi) dengan memperhatikan aspek keamanan dasar saat berkomunikasi."
  },
  {
    "mapel": "Informatika",
    "elemen": "Jaringan Komputer dan Internet (JKI)",
    "fase": "C",
    "teks": "Memahami manfaat dan risiko penggunaan jaringan internet serta menerapkan perilaku aman saat daring."
  },
  {
    "mapel": "Informatika",
    "elemen": "Dampak Sosial Informatika (DSI)",
    "fase": "A",
    "teks": "Mengenali manfaat penggunaan TIK dan perilaku yang aman serta sopan di dunia digital."
  },
  {
    "mapel": "Informatika",
    "elemen": "Dampak Sosial Informatika (DSI)",
    "fase": "B",
    "teks": "Memahami pentingnya etika, keamanan, dan keselamatan saat menggunakan TIK di sekolah dan rumah."
  },
  {
    "mapel": "Informatika",
    "elemen": "Dampak Sosial Informatika (DSI)",
    "fase": "C",
    "teks": "Menjelaskan manfaat dan ancaman TIK terhadap kehidupan serta refleksi penggunaan teknologi secara bertanggung jawab."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Al-Qur'an dan Hadis",
    "fase": "A",
    "teks": "Mengenal huruf hijaiyah dan harakatnya, melafalkan makharijul huruf, mengenal huruf hijaiyah bersambung, serta kemampuan membaca, menulis, menghafal, mengartikan surah al-Fatihah, surah-surah pendek Al-Quran, dan hadis kebersihan."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Al-Qur'an dan Hadis",
    "fase": "B",
    "teks": "Membaca, menulis, menghafal, mengartikan, dan menjelaskan pesan pokok surah-surah pendek Al-Quran serta mengenal hadis tentang hubungan kewajiban shalat dengan berbuat baik terhadap sesama."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Al-Qur'an dan Hadis",
    "fase": "C",
    "teks": "Membaca, menulis, menghafal, mengartikan dan memahami surah-surah pendek dan Al-Qur'an tentang keragaman dan hadis terkait."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Akidah",
    "fase": "A",
    "teks": "Memahami rukun iman, nama-nama Allah yang agung (asmaul husna), dan malaikat serta tugas yang diembannya."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Akidah",
    "fase": "B",
    "teks": "Memahami nama-nama Allah yang agung (asmaul husna), kitab-kitab Allah, serta nabi dan rasul Allah."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Akidah",
    "fase": "C",
    "teks": "Memahami nama-nama Allah yang agung (asmaul husna), hari akhir, serta qada dan qadar Allah."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Akhlak",
    "fase": "A",
    "teks": "Memahami akhlak terhadap Allah Swt. dengan menyucikan dan memuji-Nya dan akhlak terhadap diri sendiri."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Akhlak",
    "fase": "B",
    "teks": "Memahami akhlak terhadap Allah Swt., dengan berbaik sangka kepada-Nya dan akhlak terhadap orang tua, keluarga, dan guru."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Akhlak",
    "fase": "C",
    "teks": "Memahami akhlak terhadap Allah Swt. dengan berdoa dan bertawakal kepada-Nya, akhlak terhadap teman, tetangga, non muslim, hewan, dan tumbuhan."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Fikih",
    "fase": "A",
    "teks": "Mengenal rukun Islam dan kalimah syahadatain, menerapkan tata cara bersuci, salat fardu, azan, ikamah, zikir dan berdoa setelah salat."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Fikih",
    "fase": "B",
    "teks": "Memahami tata cara puasa, salat jumat dan salat sunah, balig, dan tanggung jawab yang menyertainya (taklif)."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Fikih",
    "fase": "C",
    "teks": "Memahami puasa sunah, zakat, infak, sedekah, hadiah, dan makanan dan minuman yang halal dan haram."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Tarikh",
    "fase": "A",
    "teks": "Memahami kisah beberapa nabi dan rasul."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Tarikh",
    "fase": "B",
    "teks": "Memahami kisah Nabi Muhammad saw. sebelum dan sesudah menjadi rasul periode Makkah."
  },
  {
    "mapel": "Al-Islam",
    "elemen": "Tarikh",
    "fase": "C",
    "teks": "Memahami kisah Nabi Muhammad saw. pada periode Madinah serta kisah al-khulafā al-rāsyidūn."
  },
  {
    "mapel": "Kemuhammadiyahan",
    "elemen": "Manhaj",
    "fase": "B",
    "teks": "Memahami janji pelajar Muhammadiyah."
  },
  {
    "mapel": "Kemuhammadiyahan",
    "elemen": "Manhaj",
    "fase": "C",
    "teks": "Memahami karakter pelajar Muhammadiyah berkemajuan."
  },
  {
    "mapel": "Kemuhammadiyahan",
    "elemen": "Sejarah",
    "fase": "B",
    "teks": "Mengenal sosok pendiri Muhammadiyah dan Aisyiyah."
  },
  {
    "mapel": "Kemuhammadiyahan",
    "elemen": "Sejarah",
    "fase": "C",
    "teks": "Memahami sejarah berdirinya Muhammadiyah dan 'Aisyiyah, serta organisasi otonom Muhammadiyah lainnya."
  },
  {
    "mapel": "Kemuhammadiyahan",
    "elemen": "Organisasi",
    "fase": "B",
    "teks": "Memahami lagu sang surya, mars 'Aisyiyah, lambang Muhammadiyah dan 'Aisyiyah."
  },
  {
    "mapel": "Kemuhammadiyahan",
    "elemen": "Organisasi",
    "fase": "C",
    "teks": "Memahami lagu dan lambang organisasi otonom Muhammadiyah."
  },
  {
    "mapel": "Kemuhammadiyahan",
    "elemen": "Amal Usaha",
    "fase": "B",
    "teks": "Memahami diri sebagai warga Muhammadiyah di sekolah."
  },
  {
    "mapel": "Kemuhammadiyahan",
    "elemen": "Amal Usaha",
    "fase": "C",
    "teks": "Memahami amal usaha Muhammadiyah dan Aisyiyah di lingkungan rumah dan sekolah."
  },
  {
    "mapel": "Bahasa Arab",
    "elemen": "Menyimak",
    "fase": "B",
    "teks": "Memahami pengucapan kosa kata sederhana terkait dengan identitas, tempat, dan benda kongkrit di lingkungan keluarga dan sekolah."
  },
  {
    "mapel": "Bahasa Arab",
    "elemen": "Menyimak",
    "fase": "C",
    "teks": "Memahami pengucapan ungkapan sapaan, pertanyaan dan jawaban sederhana serta frasa keterangan tempat serta pengucapan pesan dan informasi berunsur frasa bilangan nominal dan ordinal."
  },
  {
    "mapel": "Bahasa Arab",
    "elemen": "Berbicara",
    "fase": "B",
    "teks": "Mengucapkan kosa kata sederhana terkait dengan identitas, tempat, dan benda kongkrit di lingkungan keluarga dan sekolah."
  },
  {
    "mapel": "Bahasa Arab",
    "elemen": "Berbicara",
    "fase": "C",
    "teks": "Mengucapkan ungkapan sapaan, pertanyaan dan jawaban sederhana serta frasa keterangan tempat serta pengucapan pesan dan informasi berunsur frasa bilangan nominal dan ordinal."
  },
  {
    "mapel": "Bahasa Arab",
    "elemen": "Membaca",
    "fase": "B",
    "teks": "Membaca dan memahami kosa kata sederhana terkait dengan identitas, tempat, dan benda kongkrit di lingkungan keluarga dan sekolah."
  },
  {
    "mapel": "Bahasa Arab",
    "elemen": "Membaca",
    "fase": "C",
    "teks": "Membaca dan memahami ungkapan sapaan, pertanyaan dan jawaban sederhana serta frasa keterangan tempat serta pengucapan pesan dan informasi berunsur frasa bilangan nominal dan ordinal."
  },
  {
    "mapel": "Bahasa Arab",
    "elemen": "Menulis",
    "fase": "B",
    "teks": "Menulis kosa kata sederhana terkait dengan identitas, tempat, dan benda kongkrit di lingkungan keluarga dan sekolah sesuai dengan kaidah."
  },
  {
    "mapel": "Bahasa Arab",
    "elemen": "Menulis",
    "fase": "C",
    "teks": "Menulis ungkapan sapaan, pertanyaan dan jawaban sederhana serta frasa keterangan tempat serta pengucapan pesan dan informasi berunsur frasa bilangan nominal dan ordinal sesuai dengan kaidah."
  }
]

/**
 * Ambil CP resmi untuk mapel + fase.
 * Nama mapel dicocokkan lewat ekuivalenMapel agar alias tetap ketemu, contoh:
 * - "Ilmu Pengetahuan Alam dan Sosial" ↔ "IPAS"
 * - "Pendidikan Jasmani, Olahraga, dan Kesehatan" ↔ "PJOK"
 * Teks CAPAIAN_RESMI tetap memakai nama kanonik di file (IPAS, PJOK, …).
 */
export function capaianUntuk(mapel: string, fase: string, disiplinSeni?: string): CapaianResmi[] {
  return CAPAIAN_RESMI.filter((c) => {
    if (!ekuivalenMapel(c.mapel, mapel) || c.fase !== fase) return false
    if (ekuivalenMapel(c.mapel, 'Seni Budaya') || ekuivalenMapel(mapel, 'Seni Budaya')) {
      return !disiplinSeni || c.disiplinSeni === disiplinSeni
    }
    return true
  })
}
