
# FocusFlow Deployment Guide for Manus

This guide provides step-by-step instructions for deploying the migrated FocusFlow application (frontend and backend) to the Manus platform.

## 1. Prerequisites

Before you begin, ensure you have the following:

- A Manus account with deployment privileges.
- The `manus-cli` command-line tool installed and authenticated.
- The complete migrated FocusFlow project source code.
- The backend running on `localhost:3001` for local testing.

## 2. Backend Deployment

The backend is a standard Node.js application with Prisma. It can be deployed as a service on Manus.

### Step 2.1: Prepare the Backend Code

1.  Navigate to the `focusflow-backend` directory.
2.  Ensure your `prisma/schema.prisma` file is configured to use a production-ready database (e.g., PostgreSQL or MySQL). For this guide, we will assume a managed Manus database.

### Step 2.2: Configure Environment Variables

Create a `.env` file in the `focusflow-backend` root with the following variables:

```
# .env
DATABASE_URL="your_manus_database_url"
JWT_SECRET="your_strong_jwt_secret"
PORT=3001
```

### Step 2.3: Deploy to Manus

1.  **Initialize a Manus project:**

    ```bash
    manus init
    ```

2.  **Deploy the service:**

    ```bash
    manus deploy
    ```

3.  **Note the backend URL** provided after deployment. It will be something like `https://focusflow-backend-your-username.manus.app`.

## 3. Frontend Deployment

The frontend is a static React application built with Vite.

### Step 3.1: Configure Production API URL

1.  Navigate to the `focusflow-frontend` directory (or the root of the project).
2.  Create a file named `.env.production` in the `client` directory.
3.  Add the backend URL to this file:

    ```
    # client/.env.production
    VITE_API_BASE_URL="https://focusflow-backend-your-username.manus.app/api"
    ```

    Replace the URL with the one you noted in Step 2.3.

### Step 3.2: Build the Frontend

Run the build command from the root directory:

```bash
pnpm build
```

This will create a `dist` directory with the production-ready static files.

### Step 3.3: Deploy to Manus

1.  **Initialize a Manus project** in the root directory (if you haven't already).

2.  **Deploy the static site:**

    ```bash
    manus deploy-static --dir=dist/public
    ```

3.  **Note the frontend URL** provided after deployment.

## 4. Final Steps

- **Verify Deployment**: Open the frontend URL in your browser. All features should work as expected, with data being fetched from your deployed backend.
- **Troubleshooting**: If you encounter issues, check the service logs for both the frontend and backend using the `manus logs` command.
