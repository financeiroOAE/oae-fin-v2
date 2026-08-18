const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (!adminExists) {
    const saltRounds = 10;
    const temporaryPassword = 'OAE_Temp_Pass2026'; // Senha temporária segura
    const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        mustChangePass: true,
      },
    });

    console.log('✅ Usuário admin criado com sucesso.');
    console.log('Username: admin');
    console.log(`Senha temporária: ${temporaryPassword}`);
  } else {
    console.log('ℹ️ Usuário admin já existe.');
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
