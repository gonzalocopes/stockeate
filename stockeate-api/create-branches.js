// Script para crear sucursales de prueba
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Crear sucursales de prueba
  const branch1 = await prisma.branch.create({
    data: {
      name: 'Sucursal Centro',
    },
  });

  const branch2 = await prisma.branch.create({
    data: {
      name: 'Sucursal Norte',
    },
  });

  console.log('Sucursales creadas:');
  console.log('- ', branch1.name, '(ID:', branch1.id, ')');
  console.log('- ', branch2.name, '(ID:', branch2.id, ')');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
