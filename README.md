Chat Backend API
A REST API for one-to-one and group conversations, built with Node.js,
TypeScript, Express, PostgreSQL, Prisma ORM, and Firebase
Authentication.
Features
- Firebase ID-token verification using Firebase Admin SDK
- User synchronization between Firebase Authentication and PostgreSQL
- Retrieve the authenticated user's profile
- Create direct conversations between two users
- Create group conversations
- List conversations with pagination and participant details
- Send text messages
- Retrieve paginated message history with sender details
- Edit and soft-delete a user's own text messages (if the
  corresponding endpoints have been added)
- PostgreSQL access through Prisma 7 and the PostgreSQL driver adapter
- TypeScript strict typing
Technology Stack
- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma ORM 7
- @prisma/adapter-pg and pg
- Firebase Admin SDK
- dotenv

Project Structure

chat-backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   └── firebase.ts
│   ├── controllers/
│   │   ├── user.controller.ts
│   │   ├── conversation.controller.ts
│   │   └── message.controller.ts
│   ├── middleware/
│   │   └── auth.middleware.ts
│   ├── routes/
│   │   ├── user.routes.ts
│   │   ├── conversation.routes.ts
│   │   └── message.routes.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   ├── conversation.service.ts
│   │   └── message.service.ts
│   ├── app.ts
│   └── server.ts
├── .env
├── prisma.config.ts
├── package.json
└── tsconfig.json

Installation
Clone or open the project, then install dependencies:
npm install
If you are setting up the dependencies from scratch, the main runtime
packages include:
npm install express dotenv firebase-admin @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg
npm install -D prisma@7.10.1 typescript tsx @types/express @types/pg
Keep prisma and @prisma/client on compatible versions. The project
was configured with Prisma 7.10.1.
Environment Variables
Create a .env file in the project root. Do not commit this file.
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/chat_backend?schema=public"

FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="your-service-account-email"
FIREBASE_PRIVATE_KEY="your-service-account-private-key"

# Only needed by the optional local token-generation test script:
FIREBASE_WEB_API_KEY="your-firebase-web-api-key"
TEST_USER_EMAIL="your-test-user@example.com"
TEST_USER_PASSWORD="your-test-user-password"
Replace placeholders with your own values. The PostgreSQL database named
in DATABASE_URL must exist.
Firebase Admin credentials
Get the service-account values from your Firebase project settings.

Prisma Setup
Validate the schema:
npx prisma validate
Generate Prisma Client:
npx prisma generate
Apply the initial migration in development:
npx prisma migrate dev --name init
The Prisma generator output used by this project is:
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

Run the Application
Check the available scripts in package.json. Typical scripts are:
npm run dev
npm run build
npm start
If these scripts are not defined in your project, add scripts
appropriate to your current TypeScript/build setup. The health endpoint
is expected at:
GET /health
Successful response:
{
  "status": "ok"
}
Authentication
Protected endpoints require a Firebase ID token in the HTTP
Authorization header:
Authorization: Bearer <FIREBASE_ID_TOKEN>
The server verifies the token with Firebase Admin. The authenticated
Firebase UID is then used to locate the corresponding PostgreSQL User
record. Do not trust a client-supplied Firebase UID as the authenticated
identity.

To obtain a token for local testing, sign in a test account using
Firebase Authentication. The optional src/get-token.ts helper uses the
Firebase Identity Toolkit sign-in endpoint and requires
FIREBASE_WEB_API_KEY, TEST_USER_EMAIL, and TEST_USER_PASSWORD in
.env:
npx tsx src/get-token.ts
Treat the returned token as a secret and do not commit or publicly share
it.
API Endpoints

Synchronize a user

POST /api/users/sync
Authorization: Bearer <FIREBASE_ID_TOKEN>
No request body is required. The server uses the verified Firebase token
to create or update the local user.

Create a direct conversation

POST /api/conversations/direct
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
{
  "participantUserId": "SECOND_USER_DATABASE_UUID"
}
participantUserId is the other user's PostgreSQL UUID (User.id), not
their Firebase UID. The authenticated user is determined from the
Firebase token.

Create a group conversation

POST /api/conversations/group
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
{
  "name": "Engineering Team",
  "participantIds": [
    "OTHER_USER_DATABASE_UUID"
  ]
}

Send a message

POST /api/conversations/CONVERSATION_UUID/messages
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
{
  "content": "Hello! This is my first chat message."
}

List conversations and message history

GET /api/conversations?page=1&limit=10
GET /api/conversations/CONVERSATION_UUID/messages?page=1&limit=20
Authorization: Bearer <FIREBASE_ID_TOKEN>
