# CarePoint backend security setup

## One-time additive migration

Back up the database first. Apply `migrations/001_auth_and_notifications.sql` once to the existing clinic database. It does not drop or reset existing clinic tables. It extends the existing `users` and `appointments` tables and creates session, audit, notification, assignment, and nursing-observation tables.

The migration is intentionally not run automatically by the API. On Windows, from the repository root, apply it with a MySQL client after verifying the selected database:

```powershell
Get-Content -Raw backend\migrations\001_auth_and_notifications.sql | mysql --host=localhost --user=clinic_user -p clinic_management
```

The unified staff directory is an additive follow-up migration. It adds staff profile fields, a no-permissions `other_staff` login role, and preserves existing doctor IDs and relationships. Back up and verify the target database before applying it:

```powershell
Get-Content -Raw backend\migrations\002_staff_directory.sql | mysql --host=localhost --user=clinic_user -p clinic_management
```

The `/api/staff` directory and administrator Staff page require migration `002_staff_directory.sql`. Staff is the single employee-management page; access is restricted to administrators. Existing clinician records remain in the legacy `doctors` table because appointments and clinical records reference those IDs. They are displayed and managed through Staff, and linked clinician logins appear as one directory entry rather than a duplicate. Do not delete or rename the legacy table/records.

For the current rollout, authentication, staff, patients, consultations, prescriptions, pharmacy medicines, and laboratory orders are mounted. Other clinic APIs remain in the codebase but return 404 until intentionally re-enabled.

## Doctor consultations

The consultation API requires migration `003_consultations.sql`. It creates a new table with foreign keys to the existing `patients` and `doctors` tables; it does not alter existing clinic records. Back up and verify the intended database before applying this additive migration:

```powershell
Get-Content -Raw backend\migrations\003_consultations.sql | mysql --host=localhost --user=clinic_user -p clinic_management
```

Doctors can create consultations only for patients assigned through an appointment or patient assignment, and can only read their own consultations for patients they can access. Administrators have read-only consultation access, consistent with the existing medical-record API policy. Consultation creation is restricted to doctors, and every consultation read or creation is audited.

Substitute the database host, username, and name from your local backend environment. Do not paste credentials into source control or chat.

## Prescriptions and laboratory orders

Back up the intended database and verify that migrations `001` through `003` have already been applied. Migration `004_prescription_laboratory_orders.sql` extends the existing `prescriptions` table and reuses the existing `prescription_dispensings` history table. It backfills existing prescription rows into `prescription_order_items`, then creates the missing laboratory catalogue, order, item, and event tables. It does not drop existing tables or patient data.

Run the complete migration file from the repository root, in order, once:

```powershell
Get-Content -Raw backend\migrations\004_prescription_laboratory_orders.sql | mysql --host=localhost --user=clinic_user -p clinic_management
```

If any part of migration `004` was previously run and stopped with an error, do not rerun the whole file blindly: MySQL commits DDL statements individually. First inspect the current schema and resolve any already-created objects or altered columns. The API does not run migrations automatically.

Doctors create prescription orders against assigned patients and optional consultations. Pharmacy staff accept and dispense them; dispensing updates medicine stock and is recorded in the existing dispensing history. Laboratory orders use the database-backed `laboratory_test_catalogue` seeded with initial test names. Lab staff accept orders, move each test through sample collection and testing, and finalize results. Doctors only see orders/results for patients they remain authorized to access; laboratory staff are scoped to their department and unassigned general-laboratory orders. Pharmacy and laboratory endpoints are separated by role.

## How staff get into their dashboards

Everyone uses the same CarePoint staff sign-in page. Do not add a public registration form or let staff choose their own role at login: the administrator assigns each account its role, and the API loads that role from the database when the user signs in.

1. Back up the intended database and apply migrations `001_auth_and_notifications.sql` and `002_staff_directory.sql` above.
2. Create the first administrator once. From the repository root, run this in PowerShell. It prompts for the administrator details, hides the password while typing, and removes the temporary environment values when it finishes:

   ```powershell
   $env:CAREPOINT_CREATE_INITIAL_ADMIN = "YES"
   $env:INITIAL_ADMIN_NAME = Read-Host "Administrator full name"
   $env:INITIAL_ADMIN_EMAIL = Read-Host "Administrator email"
   $securePassword = Read-Host "Initial password (12-128 characters)" -AsSecureString
   $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
   try {
     $env:INITIAL_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
     npm --prefix backend run bootstrap-admin
   }
   finally {
     [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
     Remove-Item Env:CAREPOINT_CREATE_INITIAL_ADMIN -ErrorAction SilentlyContinue
     Remove-Item Env:INITIAL_ADMIN_NAME -ErrorAction SilentlyContinue
     Remove-Item Env:INITIAL_ADMIN_EMAIL -ErrorAction SilentlyContinue
     Remove-Item Env:INITIAL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
     Remove-Variable securePassword,passwordPointer -ErrorAction SilentlyContinue
   }
   ```

   This command creates only an administrator account; it does not create any staff accounts or modify clinic records. The bootstrap intentionally refuses to run if an active administrator already exists.
3. Start the backend and frontend as described below. Sign in at the frontend using the administrator email and password.
4. In the Administrator dashboard, open **Staff accounts** and create an individual account for each receptionist, doctor, nurse, laboratory staff member, pharmacist, and accountant. Assign the correct role and required department or doctor record. Give each person their own initial password privately.
5. Every staff member then signs in at the same page using their own email and password. The backend determines their role, the frontend opens the matching dashboard, and the API rejects actions outside that role's permissions. If a user cannot sign in, an administrator can reset that account's password in **Staff accounts**.

If the initial bootstrap reports that an active administrator already exists, do not try to create another one with the bootstrap command. Sign in with that administrator or use the documented password reset procedure below.

## Environment

Configure these values in the ignored `backend/.env` file:

```dotenv
JWT_SECRET=replace-with-at-least-32-random-characters
FRONTEND_ORIGIN=http://localhost:5173
```

Generate a secret locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

The server refuses to start with a missing or short JWT secret. Staff sessions use an HttpOnly cookie and are revocable in the database. The frontend sends a same-origin request marker for cookie-authenticated writes.
The built-in login rate limit is held in process memory; deployments with multiple API workers should also enforce a shared rate limit at the gateway. In non-production mode the API permits Vite loopback origins on ports 5173-5199, so its automatic next-port selection still works. Production requests are restricted to `FRONTEND_ORIGIN`.

## Initial administrator

After the migration, if there is no active administrator, explicitly set `CAREPOINT_CREATE_INITIAL_ADMIN=YES`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` (12-128 characters) in the backend process environment and run `npm --prefix backend run bootstrap-admin`. It refuses to create a second active administrator. Remove these variables immediately after use. Do not set them as persistent production defaults.

Staff accounts are created by administrators through the protected staff screen or API. Passwords are stored as bcrypt hashes.

If an existing active administrator cannot log in because its legacy password is not a bcrypt hash, reset it locally after applying the migration. Stop the API, set `CAREPOINT_RESET_ADMIN=YES`, `RESET_ADMIN_EMAIL`, and `RESET_ADMIN_PASSWORD` only for the command, then run:

```powershell
npm --prefix backend run reset-admin-password
```

The script only resets the password of an existing active administrator, hashes the new password, revokes that account's sessions, and writes an audit record. Remove the reset variables immediately afterward.

## Run

From the repository root, use two terminals:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

`FRONTEND_ORIGIN` must match the actual Vite origin. SMS sending is not enabled; appointment notifications are stored as in-app delivery records. Patient notifications are marked unavailable until a patient portal/account exists; the system does not claim they were delivered.
For local development the frontend already defaults to `http://localhost:5000/api`. If the backend is hosted elsewhere, set `VITE_API_URL` in the frontend environment to the backend API base URL (including `/api`) and set the backend `FRONTEND_ORIGIN` to the exact frontend origin.

Run backend checks and frontend quality checks from the repository root:

```powershell
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

The automated backend tests use fictional inputs and do not read or modify clinic records. Database integration checks require a separate, migrated test database; do not point them at the configured clinic database.
