/**
 * Crée (ou réinitialise le mot de passe d') un compte du tableau de bord.
 *
 *   npm run admin:create -- <identifiant> <mot de passe>
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './password';

async function main(): Promise<void> {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage : npm run admin:create -- <identifiant> <mot de passe>');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('Le mot de passe doit faire au moins 10 caractères.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.adminUser.upsert({
      where: { username },
      create: { username, passwordHash },
      update: { passwordHash },
    });
    console.log(`Compte admin "${user.username}" prêt.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
