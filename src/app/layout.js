import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ReportProvider } from "@/contexts/ReportContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ReportDrawer from "@/components/report/ReportDrawer"; // We will create this
import ThemeInitializer from "@/components/ThemeInitializer";

export const metadata = {
  title: "Painel Financeiro OAE",
  description: "Sistema Financeiro - Oliveira Araújo Engenharia",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeInitializer />
        <ThemeProvider>
        <ReportProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
          <ReportDrawer />
        </ReportProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
