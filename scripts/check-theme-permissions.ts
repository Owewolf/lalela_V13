import 'dotenv/config';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';

async function main() {
  const admin = await prisma.communityMember.findFirst({
    where: { role: { in: ['ADMIN', 'OWNER'] } },
    select: { communityId: true, userId: true },
  });
  const member = await prisma.communityMember.findFirst({
    where: { role: 'MEMBER' },
    select: { communityId: true, userId: true },
  });
  const secret = process.env.JWT_SECRET;

  if (!admin || !member || !secret) {
    console.log(JSON.stringify({ ok: false, reason: 'missing_test_data', hasAdmin: !!admin, hasMember: !!member, hasSecret: !!secret }, null, 2));
    return;
  }

  const body = JSON.stringify({
    name: 'Role Test Theme',
    primaryColor: '#0d3d47',
    secondaryColor: '#9c4421',
    backgroundColor: '#fff8f0',
    surfaceColor: '#efeeeb',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    borderRadius: '16px',
    fontFamily: 'System',
  });
  const url = 'http://127.0.0.1:4000/api/themes/community/' + admin.communityId;
  const adminToken = jwt.sign({ userId: admin.userId, email: 'test-admin@lalela.local' }, secret, { expiresIn: '1h' });
  const memberToken = jwt.sign({ userId: member.userId, email: 'test-member@lalela.local' }, secret, { expiresIn: '1h' });

  const adminRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
    body,
  });
  const memberRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + memberToken },
    body,
  });

  console.log(JSON.stringify({
    ok: adminRes.ok && memberRes.status === 403,
    adminStatus: adminRes.status,
    memberStatus: memberRes.status,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
