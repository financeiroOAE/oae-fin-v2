import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__oaePrisma || new PrismaClient();

// Render executa um processo Node persistente. Reutilizar a mesma instancia evita
// abrir pools de conexao redundantes com o Neon em diferentes rotas/modulos.
globalForPrisma.__oaePrisma = prisma;

export default prisma;
