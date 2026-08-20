# Decodex Demo Logins

All accounts use the password **`password123`**.

| Role | Email | What it shows |
|------|-------|---------------|
| **Teacher** | `teacher@decodex.com` | Teacher Dashboard with class-wide analytics, Student Detail view with error breakdowns and drill history |
| **Student** | `demostudent@decodex.com` | Student Dashboard with 2 completed reading sessions, Results page with annotated errors, and personalized drills |
| **Parent** | `parent@decodex.com` | Parent view with pre-granted consent for the demo student (no email verification needed) |

> **Invite code** for the demo student (used in consent KBV flow): `DEMO01`
>
> **Date of birth**: `2017-03-22`

## Seeded Data at a Glance

- 2 completed reading sessions ("The Cat in the Tree" and "A Trip to the Moon")
- 9 classified errors across REV, SUB, OMI, and INS categories
- Error profiles with aggregated stats (WPM, error rate)
- 3 practice drills (Sight Word Practice, Visual Discrimination)
- Pre-consented parent → student link

No OpenAI key, Redis queue, or worker process is needed — the data is already in the database.
