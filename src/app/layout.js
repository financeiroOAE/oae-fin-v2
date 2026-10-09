import "./globals.css";
import "./ui-fixes.css";
import { getCurrentUser, toSafeUser } from "@/lib/authorization";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import UiEnhancements from "@/components/UiEnhancements";
import { ReportProvider } from "@/contexts/ReportContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ReportDrawer from "@/components/report/ReportDrawer";
import FinancialSnapshotWatcher from "@/components/FinancialSnapshotWatcher";

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
  // Resolve o usuário no servidor para que menus restritos não apareçam com atraso.
  const session = await getSession();
  const currentUser = session?.user ? await getCurrentUser() : null;
  const safeUser = toSafeUser(currentUser);
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <ReportProvider>
            <UiEnhancements />
            <FinancialSnapshotWatcher enabled={Boolean(safeUser)} />
            <div className="app-layout">
              <Sidebar initialUser={safeUser} />
              <main className="main-content">{children}</main>
            </div>
            <ReportDrawer />
          </ReportProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
