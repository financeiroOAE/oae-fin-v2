import "./globals.css";
import "./ui-fixes.css";
import "./ameba-preview.css";
import { cookies } from "next/headers";
import { getCurrentUser, toSafeUser } from "@/lib/authorization";
import { getSession } from "@/lib/auth";
import { PREVIEW_COOKIE, isPreviewEnabled } from "@/lib/designPreview";
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

const PREVIEW_SURFACE_BOOTSTRAP = "try{var s=localStorage.getItem('oae_design_preview_surface');document.documentElement.setAttribute('data-preview-surface',s==='dark'?'dark':'light')}catch(e){}";

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  // Resolve o usuário no servidor para que menus restritos não apareçam com atraso.
  const session = await getSession();
  const currentUser = session?.user ? await getCurrentUser() : null;
  const safeUser = toSafeUser(currentUser);
  const preview = isPreviewEnabled(currentUser, cookieStore.get(PREVIEW_COOKIE)?.value);
  return (
    <html lang="pt-BR" data-design-preview={preview ? 'ameba' : undefined} suppressHydrationWarning>
      <head>{preview && <script dangerouslySetInnerHTML={{ __html: PREVIEW_SURFACE_BOOTSTRAP }} />}</head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <ReportProvider>
            <UiEnhancements />
            <FinancialSnapshotWatcher enabled={Boolean(safeUser)} />
            <div className="app-layout">
              <Sidebar initialUser={safeUser} canPreview={currentUser?.role === 'ADMIN' && !currentUser.mustChangePass} previewActive={preview} />
              <main className="main-content">{children}</main>
            </div>
            <ReportDrawer />
          </ReportProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
