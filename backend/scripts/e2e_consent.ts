import request from 'supertest';
import app from '../src/server';
import { query } from '../src/db';
import dotenv from 'dotenv';
import path from 'path';

// Force load the real .env file to use the provided GMAIL credentials
dotenv.config({ path: path.join(__dirname, '../.env') });

const PARENT_EMAIL = 'ashmeetsingh.talwar1@gmail.com';
const PARENT_PASSWORD = 'Password123!';
const INVITE_CODE = 'DEMO01';
const DOB_CORRECT = '2017-03-22';
const DOB_INCORRECT = '2007-09-04';

async function runTest() {
  console.log('=== STARTING E2E CONSENT FLOW TEST ===');

  // 1. Cleanup old test data
  await query('DELETE FROM parent_student_links WHERE parent_id IN (SELECT id FROM users WHERE email = $1)', [PARENT_EMAIL]);
  await query('DELETE FROM users WHERE email = $1', [PARENT_EMAIL]);

  // 2. Register new parent
  console.log(`\n1. Registering parent account: ${PARENT_EMAIL}`);
  const regRes = await request(app).post('/api/v1/auth/register/parent').send({
    email: PARENT_EMAIL,
    password: PARENT_PASSWORD,
    display_name: 'Test Parent'
  });

  if (regRes.status !== 201) {
    console.error('Registration failed:', regRes.body);
    process.exit(1);
  }
  const token = regRes.headers['set-cookie'][0].split(';')[0].split('=')[1];
  console.log('✅ Registered successfully.');

  // 3. Link student
  console.log(`\n2. Linking student with invite code: ${INVITE_CODE}`);
  const linkRes = await request(app)
    .post('/api/v1/consent/link')
    .set('Cookie', `token=${token}`)
    .send({ invite_code: INVITE_CODE });

  if (linkRes.status !== 201) {
    console.error('Link failed:', linkRes.body);
    process.exit(1);
  }

  console.log('✅ Link API returned 201.');
  console.log('Link API Response:', linkRes.body);

  // 4. Verify DB state (consent_granted = false)
  const dbCheck = await query(
    `SELECT consent_granted FROM parent_student_links l JOIN users p ON p.id = l.parent_id WHERE p.email = $1`,
    [PARENT_EMAIL]
  );
  console.log(`\n3. Database state check:`);
  console.log(`   consent_granted = ${dbCheck.rows[0].consent_granted}`);
  if (dbCheck.rows[0].consent_granted !== false) {
    console.error('❌ FATAL: consent_granted is not false!');
    process.exit(1);
  }

  // 5. Allow time for async email to send and check logs
  console.log('\n4. Waiting 3 seconds for Nodemailer to send the email...');
  await new Promise(r => setTimeout(r, 3000));

  // 6. Get the token from DB
  const tokenCheck = await query(
    `SELECT token FROM consent_tokens t JOIN users p ON p.id = t.parent_id WHERE p.email = $1 ORDER BY t.created_at DESC LIMIT 1`,
    [PARENT_EMAIL]
  );

  if (tokenCheck.rows.length === 0) {
    console.error('❌ FATAL: No consent token found in DB.');
    process.exit(1);
  }

  const consentToken = tokenCheck.rows[0].token;
  console.log(`\n5. Found 48-hour consent token in DB: ${consentToken}`);
  console.log(`   Email link would be: http://localhost:5173/consent/${consentToken}`);

  // 7. Validate token (GET)
  const getRes = await request(app).get(`/api/v1/consent/${consentToken}`);
  console.log(`\n6. Validating token via GET /api/v1/consent/:token`);
  console.log(`   API Response status: ${getRes.status}`);
  console.log(`   Student Name exposed: ${getRes.body.student?.display_name}`);

  // 8. Submit WRONG DOB (2007-09-04)
  console.log(`\n7. Submitting WRONG date of birth (${DOB_INCORRECT})...`);
  const wrongRes = await request(app)
    .post(`/api/v1/consent/${consentToken}/confirm`)
    .send({ date_of_birth: DOB_INCORRECT, agree: true });

  console.log(`   API Response status: ${wrongRes.status}`);
  console.log(`   Error: ${wrongRes.body.error?.code} - ${wrongRes.body.error?.message}`);
  console.log(`   Attempts remaining: ${wrongRes.body.error?.details?.attempts_remaining}`);

  // 9. Submit CORRECT DOB (2017-03-22)
  console.log(`\n8. Submitting CORRECT date of birth (${DOB_CORRECT})...`);
  const correctRes = await request(app)
    .post(`/api/v1/consent/${consentToken}/confirm`)
    .send({ date_of_birth: DOB_CORRECT, agree: true });

  console.log(`   API Response status: ${correctRes.status}`);
  console.log(`   API Response body:`, correctRes.body);

  // 10. Verify final DB state
  const finalCheck = await query(
    `SELECT consent_granted, consent_date, consent_ip FROM parent_student_links l JOIN users p ON p.id = l.parent_id WHERE p.email = $1`,
    [PARENT_EMAIL]
  );
  console.log(`\n9. Final Database state check:`);
  console.log(`   consent_granted = ${finalCheck.rows[0].consent_granted}`);
  console.log(`   consent_date = ${finalCheck.rows[0].consent_date}`);
  console.log(`   consent_ip = ${finalCheck.rows[0].consent_ip}`);

  process.exit(0);
}

runTest().catch(console.error);
