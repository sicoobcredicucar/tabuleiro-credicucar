import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Conecta Reinos | Sicoob Credicucar",
  description: "Jornada de Performance Comercial — ambiente de demonstração",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
