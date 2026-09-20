"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v13-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: "#f5a524", contrastText: "#0f1a2e" },
    secondary: { main: "#c97a08" },
    background: { default: "#f7f3ec", paper: "#ffffff" },
    text: { primary: "#0f1a2e", secondary: "#3a4761" },
    error: { main: "#d6382b" },
    success: { main: "#12915a" },
  },
  typography: {
    fontFamily: "var(--font-jakarta), Arial, Helvetica, sans-serif",
  },
  shape: { borderRadius: 10 },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
