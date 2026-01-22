"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
    for (let i = 1; i <= 10; i++) {
        await prisma.room.upsert({
            where: { id: i },
            update: {},
            create: {
                id: i,
                name: `Room ${i}`,
            },
        });
    }
    console.log('Database seeded successfully with 10 rooms!');
}
main()
    .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map