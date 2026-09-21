"""
Menghasilkan dokumen SOP StreetBarber default (template) sesuai permintaan mentor —
lihat Noted/2026-09-21/Mentoring-Pitching.md poin 6. Ini template siap-unggah lewat
PUT /shop-admin/shops/{shop_id}/sop; tiap toko boleh mengedit isinya sebelum diunggah.

Usage: backend/venv/Scripts/python.exe backend/tools/generate_sop_pdf.py
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

OUT_PATH = Path(__file__).resolve().parent.parent / "db" / "SOP-StreetBarber-PangkasKAKA.pdf"

INK = colors.HexColor("#0F1A2E")
AMBER = colors.HexColor("#F5A524")
AMBER_DARK = colors.HexColor("#C97A08")
DIM = colors.HexColor("#6C7789")
CREAM = colors.HexColor("#FDF0D9")

styles = getSampleStyleSheet()
title_style = ParagraphStyle("SopTitle", parent=styles["Title"], textColor=INK, fontSize=20, leading=24, spaceAfter=2)
subtitle_style = ParagraphStyle("SopSubtitle", parent=styles["Normal"], textColor=DIM, fontSize=10, leading=14)
section_style = ParagraphStyle(
    "SopSection", parent=styles["Heading2"], textColor=colors.white, fontSize=12, leading=15,
    backColor=INK, borderPadding=(6, 8, 6, 8), spaceBefore=14, spaceAfter=8,
)
body_style = ParagraphStyle("SopBody", parent=styles["Normal"], fontSize=10, leading=15, textColor=INK)
bullet_style = ParagraphStyle(
    "SopBullet", parent=body_style, leftIndent=14, bulletIndent=0, spaceAfter=4,
)
note_style = ParagraphStyle("SopNote", parent=styles["Normal"], fontSize=9, leading=13, textColor=DIM, spaceBefore=10)


def bullets(items):
    return [Paragraph(f"•&nbsp;&nbsp;{item}", bullet_style) for item in items]


def build():
    doc = SimpleDocTemplate(
        str(OUT_PATH), pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title="SOP StreetBarber - PangkasKAKA",
    )
    story = []

    story.append(Paragraph("PangkasKAKA", ParagraphStyle("Brand", parent=styles["Normal"], textColor=AMBER_DARK, fontSize=11, fontName="Helvetica-Bold")))
    story.append(Paragraph("Standar Operasional Prosedur (SOP)", title_style))
    story.append(Paragraph("Panduan Perilaku &amp; Kualitas Layanan StreetBarber", subtitle_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.2, color=AMBER, spaceAfter=10))

    story.append(Paragraph(
        "Dokumen ini adalah standar minimum yang wajib dipatuhi setiap StreetBarber yang "
        "tervalidasi oleh barbershop mitra PangkasKAKA saat melayani panggilan potong "
        "rambut ke rumah pelanggan. Barbershop validator dapat menyesuaikan isi dokumen "
        "ini sebelum mengunggahnya lewat dashboard Admin Toko — StreetBarber dapat membaca "
        "versi terbaru langsung dari dashboard mereka, baik sebelum maupun sesudah lulus "
        "validasi.",
        body_style,
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph("I.&nbsp; KEBERSIHAN", section_style))
    story.append(Paragraph(
        "StreetBarber wajib menjaga kebersihan diri dan seluruh peralatan sebelum, selama, "
        "dan sesudah melayani pelanggan.", body_style,
    ))
    story.extend(bullets([
        "Tangan dicuci/disanitasi sebelum menyentuh alat dan sebelum memulai layanan.",
        "Seluruh alat potong (gunting, clipper, silet) dibersihkan dan disterilkan setelah dipakai ke pelanggan sebelumnya.",
        "Pakaian kerja bersih, rapi, dan tidak berbau saat tiba di lokasi pelanggan.",
        "Sisa rambut dan sampah hasil potong dibersihkan dan dibawa pulang — tidak ditinggalkan di rumah pelanggan.",
        "Handuk/cape yang dipakai ke pelanggan wajib bersih dan sekali pakai per pelanggan (dicuci ulang sebelum dipakai lagi).",
    ]))

    story.append(Paragraph("II.&nbsp; KERAPIHAN", section_style))
    story.append(Paragraph(
        "Penampilan dan cara kerja StreetBarber mencerminkan standar profesional "
        "PangkasKAKA, bukan hanya hasil potongan pelanggan.", body_style,
    ))
    story.extend(bullets([
        "Berpenampilan rapi: rambut tertata, kuku pendek dan bersih, seragam/atribut PangkasKAKA (jika ada) dikenakan.",
        "Tas/kotak alat disusun rapi, tidak berantakan saat dibuka di depan pelanggan.",
        "Area kerja sementara di rumah pelanggan (kursi, lantai sekitar) dirapikan kembali seperti semula setelah selesai.",
        "Hasil potongan dirapikan dan dicek ulang bersama pelanggan sebelum sesi dianggap selesai.",
    ]))

    story.append(Paragraph("III.&nbsp; KESOPANAN", section_style))
    story.append(Paragraph(
        "StreetBarber adalah representasi langsung dari barbershop validator dan "
        "PangkasKAKA di hadapan pelanggan.", body_style,
    ))
    story.extend(bullets([
        "Datang tepat waktu sesuai jadwal booking; jika terlambat, wajib menghubungi pelanggan lebih dahulu.",
        "Memberi salam dan memperkenalkan diri saat tiba di lokasi.",
        "Berbicara sopan, tidak menggunakan bahasa kasar, dan menjaga nada suara yang ramah.",
        "Menghormati privasi dan properti rumah pelanggan — tidak mengambil foto/video tanpa izin.",
        "Menerima kritik/permintaan pelanggan terkait gaya potongan dengan sikap terbuka dan profesional.",
    ]))

    story.append(Paragraph("IV.&nbsp; KELENGKAPAN ALAT", section_style))
    story.append(Paragraph(
        "Layanan panggilan ke rumah menuntut StreetBarber membawa semua kebutuhan sendiri "
        "— pelanggan tidak diharapkan menyediakan apa pun.", body_style,
    ))
    story.extend(bullets([
        "Clipper/mesin cukur dengan baterai/daya terisi penuh sebelum berangkat.",
        "Gunting potong dan gunting penipis (thinning scissors) dalam kondisi tajam dan steril.",
        "Sisir, sikat leher, dan cermin kecil untuk menunjukkan hasil ke pelanggan.",
        "Cape/kain penutup badan pelanggan, handuk, dan tisu/kapas.",
        "Alat sanitasi (alkohol/disinfektan) dan alas duduk/lantai portabel bila diperlukan.",
        "Alat cadangan (baterai/mata pisau clipper) untuk mengantisipasi kendala teknis di lokasi.",
    ]))

    story.append(Paragraph("V.&nbsp; INTERAKTIF DENGAN PELANGGAN", section_style))
    story.append(Paragraph(
        "Pengalaman panggilan ke rumah seharusnya terasa personal — StreetBarber "
        "didorong aktif berkomunikasi, bukan bekerja dalam diam.", body_style,
    ))
    story.extend(bullets([
        "Menanyakan gaya potongan yang diinginkan dan preferensi pelanggan sebelum mulai memotong.",
        "Menjelaskan proses secara singkat selama layanan berlangsung (mis. \"Saya rapikan bagian samping dulu ya\").",
        "Memberi rekomendasi gaya/perawatan yang sesuai bentuk wajah atau jenis rambut pelanggan bila diminta.",
        "Menanyakan kepuasan pelanggan terhadap hasil akhir sebelum sesi ditutup.",
        "Mengingatkan pelanggan untuk memberi ulasan/rating di aplikasi PangkasKAKA setelah layanan selesai.",
    ]))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#CBCCC9"), spaceAfter=8))
    story.append(Paragraph("PELANGGARAN &amp; EVALUASI", ParagraphStyle("MiniHead", parent=body_style, fontName="Helvetica-Bold", textColor=INK, fontSize=10.5)))
    story.append(Paragraph(
        "Pelanggaran berulang terhadap poin-poin di atas dapat ditindaklanjuti oleh barbershop "
        "validator maupun tim PangkasKAKA, termasuk peringatan, penangguhan sementara, atau "
        "pencabutan status StreetBarber aktif — sesuai kebijakan internal toko validator.",
        body_style,
    ))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Dokumen ini adalah template awal yang dihasilkan otomatis. Barbershop validator "
        "bertanggung jawab meninjau dan menyesuaikan isinya sebelum diunggah melalui "
        "dashboard Admin Toko (PUT /shop-admin/shops/{shop_id}/sop).",
        note_style,
    ))

    doc.build(story)
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    build()
