# insightO Backend

TypeScript + Express backend for the insightO Enterprise EdTech SaaS platform.

## Stack

- Node.js + TypeScript
- Express.js
- MongoDB + Mongoose
- Zod validation
- JWT authentication + bcryptjs
- Nodemailer (OTP/email workflows)
- Helmet, CORS, Morgan, Dotenv

## Project Structure

```text
backend/
  src/
    config/        # Environment, DB, and app-level configuration
    controllers/   # HTTP handlers
    middlewares/   # Auth, validation, and error middleware
    models/        # Mongoose schemas and models
    routes/        # Express route modules
    services/      # Business logic and external integrations
    utils/         # Shared helper utilities
```

## Weekly Switch Workflow

1. Pull latest `main`.
2. Run `npm install` in this directory.
3. Add/update `.env` values for the week environment.
4. Implement feature slices as:
   - `routes` -> `controllers` -> `services` -> `models`
5. Validate requests with Zod schemas in middleware or route-level validators.
6. Keep controller layer thin and business logic inside services.

## Local Setup

```bash
npm install
```

Generated tooling includes:

- `tsconfig.json` with strict mode enabled
- ESLint + Prettier dependencies installed for code quality
- `ts-node-dev` available for development runtime scripts
