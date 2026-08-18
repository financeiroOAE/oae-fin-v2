const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (!adminExists) {
    const temporaryPassword = process.env.ADMIN_TEMP_PASSWORD;
    if (!temporaryPassword || temporaryPassword.length < 12) {
      throw new Error('ADMIN_TEMP_PASSWORD deve estar configurada com pelo menos 12 caracteres para criar o admin inicial.');
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        role: 'ADMIN',
        mustChangePass: true,
      },
    });

    console.log('Usuário admin criado com sucesso.');
    console.log('Username: admin');
    console.log('Troca de senha obrigatória no primeiro acesso.');
  } else {
    console.log('Usuário admin já existe.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
