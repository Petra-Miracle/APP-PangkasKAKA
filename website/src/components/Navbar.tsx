"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import HistoryIcon from "@mui/icons-material/History";
import { useAuth } from "@/lib/auth";

const PAGES = [
  { href: "/", label: "Beranda" },
  { href: "/jelajahi", label: "Jelajahi Barber" },
  { href: "/ai-scan", label: "AI Face Scan" },
  { href: "/#cara-kerja", label: "Cara Kerja" },
  { href: "/#tentang", label: "Tentang" },
];

// Halaman auth pakai layout split-screen sendiri (lihat masuk/lupa-password
// page.tsx) — navbar global akan menimpa panel dekoratifnya, jadi disembunyikan di sini.
const CHROMELESS_ROUTES = ["/masuk", "/lupa-password"];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [navTheme, setNavTheme] = React.useState<"light" | "dark" | "transparent">("transparent");

  const [anchorElNav, setAnchorElNav] = React.useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElNav(event.currentTarget);
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElUser(event.currentTarget);
  const handleCloseNavMenu = () => setAnchorElNav(null);
  const handleCloseUserMenu = () => setAnchorElUser(null);

  const handleLogout = () => {
    handleCloseUserMenu();
    logout();
    router.push("/");
  };

  React.useEffect(() => {
    if (pathname !== "/") return;

    // Setiap section beri tahu tema navbar-nya sendiri lewat data-nav-theme
    // ("transparent" di Hero, "dark" di CTA navy, dst). Section tanpa atribut
    // (mis. Akses Cepat, Statistik) otomatis jatuh ke fallback "light" saat
    // tidak ada section lain yang sedang melewati garis deteksi.
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-theme]"));
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        const theme = visible?.target.getAttribute("data-nav-theme") as
          | "light"
          | "dark"
          | "transparent"
          | null;
        setNavTheme(theme ?? "light");
      },
      { rootMargin: "-72px 0px -65% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  if (CHROMELESS_ROUTES.includes(pathname)) return null;

  const effectiveNavTheme = pathname === "/" ? navTheme : "light";

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor:
          effectiveNavTheme === "dark"
            ? "rgba(15, 26, 46, 0.96)"
            : effectiveNavTheme === "transparent"
              ? "transparent"
              : "rgba(247, 243, 236, 0.94)",
        backdropFilter: effectiveNavTheme === "transparent" ? "none" : "blur(8px)",
        borderBottom: "1px solid",
        borderColor:
          effectiveNavTheme === "dark"
            ? "rgba(255, 255, 255, 0.14)"
            : effectiveNavTheme === "transparent"
              ? "transparent"
              : "#e7e1d6",
        color: effectiveNavTheme === "dark" ? "#ffffff" : "#0f1a2e",
        transition: "background-color 220ms ease, color 220ms ease, border-color 220ms ease, backdrop-filter 220ms ease",
      }}
    >
      <Box sx={{ maxWidth: "1152px", mx: "auto", width: "100%", px: { xs: 2, lg: 5 } }}>
        <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 } }}>
          {/* Logo — selalu tampil */}
          <Box
            component={Link}
            href="/"
            sx={{ display: "flex", alignItems: "center", gap: 1.2, textDecoration: "none", color: "inherit", mr: 2 }}
          >
            <Image src="/logo.jpeg" alt="PangkasKAKA" width={34} height={34} style={{ borderRadius: 8, objectFit: "cover" }} priority />
            <Typography
              noWrap
              sx={{
                display: { xs: "none", sm: "flex" },
                fontFamily: "var(--font-jakarta)",
                fontWeight: 800,
                fontSize: "1.2rem",
                color: "inherit",
              }}
            >
              PangkasKAKA
            </Typography>
          </Box>

          {/* Menu mobile (hamburger) */}
          <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="buka menu navigasi"
              aria-controls="menu-navigasi"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-navigasi"
              anchorEl={anchorElNav}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              transformOrigin={{ vertical: "top", horizontal: "left" }}
              keepMounted
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: "block", md: "none" } }}
            >
              {PAGES.map((page) => (
                <MenuItem
                  key={page.href}
                  component={Link}
                  href={page.href}
                  onClick={handleCloseNavMenu}
                  aria-current={pathname === page.href ? "page" : undefined}
                >
                  <Typography sx={{ textAlign: "center", fontWeight: pathname === page.href ? 700 : 500 }}>
                    {page.label}
                  </Typography>
                </MenuItem>
              ))}
              {!loading && !user && (
                <>
                  <Divider />
                  <MenuItem component={Link} href="/masuk" onClick={handleCloseNavMenu}>
                    <Typography sx={{ textAlign: "center", fontWeight: 700 }}>Masuk</Typography>
                  </MenuItem>
                </>
              )}
            </Menu>
          </Box>

          {/* Link navigasi desktop */}
          <Box sx={{ flexGrow: 1, display: { xs: "none", md: "flex" }, gap: 0.5 }}>
            {PAGES.map((page) => (
              <Button
                key={page.href}
                component={Link}
                href={page.href}
                aria-current={pathname === page.href ? "page" : undefined}
                sx={{
                  color: "inherit",
                  fontWeight: pathname === page.href ? 700 : 500,
                  textTransform: "none",
                  fontSize: "0.875rem",
                  opacity: pathname === page.href ? 1 : 0.75,
                }}
              >
                {page.label}
              </Button>
            ))}
          </Box>

          {/* Aksi kanan: akun + CTA booking */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {!loading && user ? (
              <>
                <Tooltip title="Akun saya">
                  <IconButton onClick={handleOpenUserMenu} aria-label="Akun saya" sx={{ p: 0.4, border: "1px solid #cbccc9" }}>
                    <Avatar sx={{ width: 30, height: 30, bgcolor: "#c97a08", fontSize: "0.8rem", fontWeight: 700 }}>
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu
                  id="menu-akun"
                  anchorEl={anchorElUser}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                  keepMounted
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                  sx={{ mt: "8px" }}
                >
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>{user.name}</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{user.email}</Typography>
                  </Box>
                  <Divider />
                  <MenuItem component={Link} href="/akun" onClick={handleCloseUserMenu}>
                    <PersonIcon fontSize="small" sx={{ mr: 1.5 }} /> Akun Saya
                  </MenuItem>
                  <MenuItem component={Link} href="/riwayat" onClick={handleCloseUserMenu}>
                    <HistoryIcon fontSize="small" sx={{ mr: 1.5 }} /> Riwayat Pemesanan
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={handleLogout} sx={{ color: "#d6382b" }}>
                    <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} /> Keluar
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button
                component={Link}
                href="/masuk"
                sx={{ display: { xs: "none", sm: "inline-flex" }, color: "inherit", fontWeight: 700, textTransform: "none", fontSize: "0.875rem", opacity: 0.82 }}
              >
                Masuk
              </Button>
            )}

            <Button
              component={Link}
              href="/jelajahi"
              variant="contained"
              disableElevation
              sx={{
                bgcolor: "#f5a524",
                color: "#0f1a2e",
                fontWeight: 700,
                textTransform: "none",
                fontSize: "0.875rem",
                borderRadius: "8px",
                px: 2.5,
                "&:hover": { bgcolor: "#c97a08", color: "#fff" },
              }}
            >
              Mulai Booking
            </Button>
          </Box>
        </Toolbar>
      </Box>
    </AppBar>
  );
}
