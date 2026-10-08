import "./globals.css";
import "./ui-fixes.css";
import "./ameba-preview.css";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authorization";
import { getSession } from "@/lib/auth";
import { PREVIEW_COOKIE, isPreviewEnabled } from "@/lib/designPreview";
import Sidebar from "@/components/Sidebar";
import UiEnhancements from "@/components/UiEnhancements";
import { ReportProvider } from "@/contexts/ReportContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ReportDrawer from "@/components/report/ReportDrawer";

export const metadata = {
  title: "Painel Financeiro OAE",
  description: "Sistema Financeiro - Oliveira Araújo Engenharia",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  // Resolve the current database role rather than trusting a client preference.
  const session = await getSession();
  const user = session?.user?.role === 'ADMIN' ? await getCurrentUser() : null;
  const preview = isPreviewEnabled(user, cookieStore.get(PREVIEW_COOKIE)?.value);
  return (
    <html lang="pt-BR" data-design-preview={preview ? 'ameba' : undefined} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <ReportProvider>
            <UiEnhancements />
            <div className="app-layout">
              <Sidebar canPreview={user?.role === 'ADMIN' && !user.mustChangePass} previewActive={preview} />
              <main className="main-content">{children}</main>
            </div>
            <ReportDrawer />
          </ReportProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
