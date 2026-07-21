"""
Seed script untuk membuat akun owner + barbershop dari data Excel Kupang.
Dipanggil via endpoint /api/seed/kupang-shops (admin only).
"""
import re
import random
from typing import List, Dict

# Bounding box Kota Kupang (approx: -10.10 to -10.22 lat, 123.55 to 123.68 lng)
KUPANG_LAT_MIN, KUPANG_LAT_MAX = -10.22, -10.10
KUPANG_LNG_MIN, KUPANG_LNG_MAX = 123.55, 123.68

# Common Indonesian names for auto-generation
OWNER_FIRST = ["Adi", "Budi", "Cindra", "Deni", "Eko", "Fandi", "Gilbert", "Hendra", "Indra", "Jefri",
                "Kevin", "Lukas", "Marcel", "Nando", "Oscar", "Petrus", "Rico", "Samuel", "Toni", "Ucok",
                "Vincent", "Willy", "Yohanes", "Andre", "Beni", "Carlos", "Daud", "Ferdi", "Ganda", "Harry",
                "Ivan", "Julius", "Kris", "Lambert", "Mario", "Nathan", "Otto", "Paulus", "Quintus", "Rendi",
                "Silvester", "Timo", "Umar", "Viktor", "Wesley", "Xaverius", "Yosua", "Zeta", "Alfons", "Berto"]
OWNER_LAST  = ["Tuka", "Nalle", "Baba", "Manu", "Lay", "Kase", "Doko", "Bere", "Radja", "Boimau",
                "Meko", "Bakker", "Sakan", "Halla", "Riwu", "Foenay", "Adoe", "Nubatonis", "Fanggidae", "Ndoen",
                "Lopez", "Manafe", "Bara", "Ledoh", "Selan", "Amtaran", "Bau", "Dako", "Ero", "Feka",
                "Gero", "Halena", "Ipa", "Jaka", "Kolo", "Lele", "Mesak", "Nifu", "Oematan", "Pello",
                "Riu", "Suan", "Tefa", "Uly", "Waty", "Ximenes", "Yosef", "Zonge", "Rihi", "Sabaria"]

# Data barbershops (extracted from Excel via analyzer — 120 shops)
SHOPS: List[Dict] = [
    {"name": "A2 Barbershop", "addr": "Jl. VM27+HP6, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Aboni Barbershop", "addr": "Kota Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "ACF Barbershop", "addr": "Jl. Taebenu No.1, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Aidens Barbershop", "addr": "Jl. TDM V, Kupang", "cat": "Salon Rambut"},
    {"name": "Amran Barbershop", "addr": "Jl. Lakbanu No.32, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Anasta Barbershop", "addr": "RJVC+V75, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Angga Angelos (GB Barbershop)", "addr": "Jl. Sikib RT.17/RW.06, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Atoin Meto Barbershop", "addr": "Jl. Kelinci No.238, Kupang", "cat": "Salon Rambut"},
    {"name": "B&W Barbershop", "addr": "Jl. Bajawa No.30, Kupang", "cat": "Salon Rambut"},
    {"name": "Bang Ji Barbershop", "addr": "Jl. P. Kemerdekaan III No.7, Kupang", "cat": "Salon Rambut"},
    {"name": "Barber Shop BNB", "addr": "Jl. Oeleta Raya 003, Kupang", "cat": "Salon Rambut"},
    {"name": "Barbershop Dua Lontar", "addr": "Jl. Dua Lontar, Kupang", "cat": "Salon Rambut"},
    {"name": "Barbershop 46", "addr": "Jl. Bhakti Karang, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Barbershop AR46", "addr": "Jl. Fetor Foenay, Kupang", "cat": "Toko Peralatan Pangkas Rambut"},
    {"name": "Barbershop Barondang", "addr": "RHH4+C6C, Kupang", "cat": "Pembangunan Perumahan"},
    {"name": "Barbershop Bh41ra", "addr": "Kota Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Barbershop Champen", "addr": "RJCF+Q6P, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Barbershop Gimbo", "addr": "Jl. Anggur, Kupang", "cat": "Salon Rambut"},
    {"name": "Barbershop Kenan", "addr": "Jl. Farmasi, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Barbershop Kumis Gang", "addr": "Jl. Hati Mulia VI No.9, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Barbershop Lusi", "addr": "Jl. Amabi, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Barbershop Mr. Breewok", "addr": "Jl. Sahabat, Kupang", "cat": "Penata Rambut"},
    {"name": "Barbershop Pa De", "addr": "Jl. TDM II, Kupang", "cat": "Salon Rambut"},
    {"name": "Barbershop PJKR Universitas San Pedro", "addr": "Jl. Farmasi No.32, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Barbershop S.I.D", "addr": "Jl. Jenderal Sudirman No.47, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Barbershop Trabas", "addr": "Jl. Farmasi, Kupang", "cat": "Salon Rambut"},
    {"name": "Barbershop ZM", "addr": "RHQM+344, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Barbershop88 Ebufu", "addr": "RJFC+RG6, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Black Barbershop", "addr": "Jl. Pahlawan No.15, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Black Red Barbershop", "addr": "Jl. Jend. Soeharto, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Blessed Barbershop", "addr": "Jl. Soverdi, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Boss Kici Barbershop", "addr": "RHPG+JP8, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "BosQiano Barber", "addr": "Jl. Farmasi Gang IV, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Boxx Barbershop", "addr": "Jl. Bumi I, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Brader's Barbershop", "addr": "Jl. Pemuda, Kupang", "cat": "Salon Rambut"},
    {"name": "Brooklyn Barbershop", "addr": "Jl. Bhakti Karya, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Cfk Barbershop", "addr": "Kota Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Coral Barbershop", "addr": "Jl. Tompello No.31B, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Coral Barbershop Perumnas", "addr": "Jl. Bhakti Karang, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "D Ganteng Barbershop", "addr": "RHJR+39F, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Daeng Barbershop", "addr": "Jl. TDM II, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "David Barbershop", "addr": "Jl. Pahlawan, Kupang", "cat": "Salon Rambut"},
    {"name": "DiZett Barbershop", "addr": "RJP9+WH7, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "El Nino Barbershop", "addr": "RJXM+2P6, Kupang", "cat": "Kantor Perusahaan"},
    {"name": "ElArJu Barbershop & Online Shop", "addr": "Jl. Alfons Nisnoni, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Eleven Barbershop", "addr": "Jl. Farmasi No.12, Kupang", "cat": "Salon Rambut"},
    {"name": "Etho Barbershop", "addr": "Jl. Soverdi, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "FanRel Barbershop", "addr": "Jl. Bhakti Besi No.01, Kupang", "cat": "Salon Rambut"},
    {"name": "Forah Barbershop", "addr": "Jl. Prof. Dr. Herman Johanes No.88, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Freedombarber's", "addr": "Jl. HTI Maulafa, Kupang", "cat": "Salon Rambut"},
    {"name": "Fries Barbershop", "addr": "Jl. W.J. Lalamentik, Kupang", "cat": "Hotel"},
    {"name": "Grem's Barbershop", "addr": "Jl. Sumatera, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Gaul Barbershop", "addr": "Jl. Perintis Kemerdekaan I, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Gentle-Man Barbershop", "addr": "Jl. Fetor Funay, Kupang", "cat": "Salon Rambut"},
    {"name": "Gentlemen's Barbershop Sumatera", "addr": "Jl. Sumatera, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Good Barbershop", "addr": "Jl. Shopping Centre, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Goots Mini Barbershop", "addr": "Jl. Kesekrom No.4, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Grachio Barbershop", "addr": "Jl. Bajawa, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Grevlin Barbershop", "addr": "RJPF+794, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Growmen Salon", "addr": "Jl. Banteng Mapoli, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Ichat Barbershop", "addr": "Jl. TDM II, Kupang", "cat": "Salon Rambut"},
    {"name": "Icky Barbershop", "addr": "RJJC+P4F, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "J1 Barbershop", "addr": "Jl. Fetor Funay No.8, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Jhian Barbershop", "addr": "Jl. Perintis Kemerdekaan I, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "JM Barbershop 2018", "addr": "Jl. W. Monginsidi III, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Joker Barbershop", "addr": "Jl. Banteng, Kupang", "cat": "Salon Rambut"},
    {"name": "JR Barbershop", "addr": "Jl. Frans Seda, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Kairos Barbershop", "addr": "Jl. Swakarya II, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Keluar-Keluar Ganteng Barbershop", "addr": "Kota Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Key Barbershop", "addr": "Jl. Perintis Kemerdekaan I No.5, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "King Barber Shop HR Koroh", "addr": "Jl. H.R. Koroh No.168, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "King Barbershop WJ Lalamentik", "addr": "Jl. W.J. Lalamentik, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Koe Barbershop", "addr": "Jl. Dua Lontar, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Koe Barbershop Bumi I", "addr": "Jl. Bumi I, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Lapan Lapan Barbershop Cabang Oebufu", "addr": "Jl. W.J. Lalamentik No.117, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Lapan Lapan Barbershop Cabang Merdeka", "addr": "Jl. Merdeka, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Lapanlapan Barbershop", "addr": "Jl. Shopping Centre No.33, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "LC Barbershop", "addr": "Jl. Prof. Dr. Herman Johanes, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Locker Barbershop", "addr": "Jl. W.J. Lalamentik No.66, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Lordez Barbershop", "addr": "99QC+287, Kupang", "cat": "Salon Rambut"},
    {"name": "Luxury Barbershop", "addr": "Jl. Nangka No.38, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Manliest Barbershop", "addr": "Jl. Gunung Mutis No.31, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Manliest Barbershop Oebufu", "addr": "Jl. W.J. Lalamentik, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Manliest Barbershop Pasir Panjang", "addr": "Jl. Terusan Timor Raya No.120 A, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Manoah Barbershop Cab. Kelapa Lima", "addr": "Jl. Perintis Kemerdekaan, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Max Salon", "addr": "Jl. W.J. Lalamentik, Kupang", "cat": "Salon Rambut"},
    {"name": "ML Barbershop", "addr": "Jl. Samratulangi No.3, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "MMS Barbershop", "addr": "Jl. K. H. Ahmad Dahlan No.19, Kupang", "cat": "Toko Peralatan Pangkas Rambut"},
    {"name": "Mr. Seven's Barbershop", "addr": "Jl. Palapa No.25, Kupang", "cat": "Salon Rambut"},
    {"name": "Namas Hair Salon", "addr": "Jl. Frans Seda No.16, Kupang", "cat": "Salon Rambut"},
    {"name": "Nio X Barbershop", "addr": "Jl. Noelmina No.2, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Obed Barbershop", "addr": "Jl. Bhakti Karang No.88x, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Panda Barbershop", "addr": "Jl. W. Monginsidi III No.6, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Pangkas Rambut & Toko Perabot", "addr": "Jl. H.R. Koroh RT.027/RW.011, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Pangkas Rambut FM", "addr": "Jl. W.J. Lalamentik No.47, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Pangkas Rambut Victory", "addr": "Jl. Jend. Soeharto, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Papa2G Barbershop", "addr": "Jl. Terusan Timor Raya No.10, Kupang", "cat": "Salon Rambut"},
    {"name": "Peak Barbershop and Beauty Salon", "addr": "Jl. Perintis Kemerdekaan I, Kupang", "cat": "Salon Kecantikan"},
    {"name": "PJR Barbershop", "addr": "RJR8+W76, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Regiano Nalle Barbershop", "addr": "Jl. Kamboja, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Redix Barbershop", "addr": "Jl. Yos Sudarso, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Rock & Roll Barbershop", "addr": "Jl. Samratulangi, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Ropesjo Barbershop", "addr": "Jl. Swakarya II, Kupang", "cat": "Kantor Perusahaan"},
    {"name": "Shuffah Barbershop", "addr": "Jl. Pahlawan, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Shunan Barbershop", "addr": "Kota Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "S.N. Barbershop", "addr": "Jl. TPU Liliba, Kupang", "cat": "Salon Rambut"},
    {"name": "Squad Barbershop", "addr": "Jl. Samratulangi, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Starsbox Barbershop Kupang", "addr": "Jl. Monginsidi III Blok A, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Tabas Barbershop", "addr": "RJPX+PP9, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Texan Barbershop", "addr": "Jl. Perintis Kemerdekaan I No.1, Kupang", "cat": "Toko Peralatan Pangkas Rambut"},
    {"name": "The Barberock's", "addr": "Jl. Cak Doko No.37, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "The Lexcut", "addr": "Jl. Tompello No.16, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "The Lucky Barbershop", "addr": "Jl. Bund. PU TDM II, Kupang", "cat": "Salon Rambut"},
    {"name": "Timoer Barbershop", "addr": "Jl. Amabi, Kupang", "cat": "Salon Rambut"},
    {"name": "Titox Barbershop", "addr": "Jl. Pendidikan II No.3, Kupang", "cat": "Salon Rambut"},
    {"name": "To'o Barbershop", "addr": "Jl. Taebenu, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Triple-D Barbershop", "addr": "Jl. Samratulangi, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "Unfamous Barbershop", "addr": "Jl. Bunda Hati Kudus, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "War Barbershop", "addr": "Rss Oesapa Blok J No 7, Kupang", "cat": "Tempat Cukur Rambut"},
    {"name": "YTP Barbershop", "addr": "Lili Camplong, Kupang", "cat": "Tempat Cukur Rambut"},
]

# Default service pricing template
DEFAULT_SERVICES = [
    {"name": "Potong Rambut Klasik", "duration": 30, "price": 35000},
    {"name": "Potong + Cuci", "duration": 45, "price": 50000},
    {"name": "Potong + Cukur + Pijat", "duration": 60, "price": 85000},
]

DEFAULT_SCHEDULE = [
    {"day_name": d, "open_time": "09:00", "close_time": "21:00", "is_closed": False}
    for d in ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
] + [{"day_name": "Minggu", "open_time": "10:00", "close_time": "20:00", "is_closed": False}]

SHOP_IMAGES = [
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800",
    "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800",
    "https://images.unsplash.com/photo-1521490683030-e02a90a1a3f2?w=800",
    "https://images.unsplash.com/photo-1521117554860-1a92e04b1c92?w=800",
    "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800",
    "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800",
]


def slugify(name: str) -> str:
    """Convert shop name to safe email-local & password base."""
    s = re.sub(r"[^a-zA-Z0-9]+", "", name).lower()
    return s[:24] or "shop"


def make_email(name: str, idx: int) -> str:
    slug = slugify(name)
    return f"owner.{slug}{idx:03d}@pangkaskaka.id"


def make_password(name: str) -> str:
    """Format: NamaTokoTanpaSpasi@123"""
    clean = re.sub(r"[^a-zA-Z0-9]+", "", name)
    return f"{clean[:16]}@123"


def make_owner_name(idx: int) -> str:
    first = OWNER_FIRST[idx % len(OWNER_FIRST)]
    last = OWNER_LAST[(idx * 7) % len(OWNER_LAST)]
    return f"{first} {last}"


def make_phone(idx: int) -> str:
    return f"0813{5000000 + idx * 3719:07d}"


def make_coords(idx: int):
    """Deterministic pseudo-random coords within Kupang bounding box."""
    random.seed(idx * 31 + 7)
    lat = KUPANG_LAT_MIN + random.random() * (KUPANG_LAT_MAX - KUPANG_LAT_MIN)
    lng = KUPANG_LNG_MIN + random.random() * (KUPANG_LNG_MAX - KUPANG_LNG_MIN)
    return round(lat, 6), round(lng, 6)


def build_seed_records():
    """Return list of (profile, shop, services, schedule, barbers) tuples."""
    records = []
    for i, s in enumerate(SHOPS):
        owner_name = make_owner_name(i)
        email = make_email(s["name"], i)
        password = make_password(s["name"])
        phone = make_phone(i)
        lat, lng = make_coords(i)
        img = SHOP_IMAGES[i % len(SHOP_IMAGES)]

        # Random rating 3.8 - 4.8
        random.seed(i * 13 + 3)
        rating = round(3.8 + random.random() * 1.0, 1)
        reviews = random.randint(15, 220)

        records.append({
            "shop_name": s["name"],
            "owner_name": owner_name,
            "email": email,
            "password": password,
            "phone": phone,
            "addr": s["addr"],
            "lat": lat, "lng": lng,
            "cat": s["cat"],
            "img": img,
            "rating": rating,
            "reviews": reviews,
        })
    return records
