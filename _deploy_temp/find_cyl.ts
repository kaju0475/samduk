const { db } = require('./lib/db');

async function findValidCyl() {
    await db.reload();
    const cyl = db.cylinders.find(c => c.status === '실병' && c.currentHolderId === '삼덕공장');
    if (cyl) {
        console.log(`FOUND_CYL: ${cyl.serialNumber}`);
    } else {
        const anyCyl = db.cylinders[0];
        console.log(`ANY_CYL: ${anyCyl?.serialNumber} (Status: ${anyCyl?.status}, Holder: ${anyCyl?.currentHolderId})`);
    }
}

findValidCyl();
