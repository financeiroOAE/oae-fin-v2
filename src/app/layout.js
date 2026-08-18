import "./globals.css";
import "./ui-fixes.css";
import Sidebar from "@/components/Sidebar";
import UiEnhancements from "@/components/UiEnhancements";
import { ReportProvider } from "@/contexts/ReportContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ReportDrawer from "@/components/report/ReportDrawer";

export const metadata = {
  title: "Painel Financeiro OAE",
  description: "Sistema Financeiro - Oliveira Araújo Engenharia",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <ReportProvider>
            <UiEnhancements />
            <div className="app-layout">
              <Sidebar />
              <main className="main-content">{children}</main>
            </div>
            <ReportDrawer />
          </ReportProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
