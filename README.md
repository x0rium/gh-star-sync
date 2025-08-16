# GitHub Star Sync

This project provides a robust backend solution for creating a persistent, local mirror of a user's starred repositories on GitHub. It automatically fetches repository data via the GitHub API and stores it in a relational database, making it easy to query, analyze, or display your starred projects.

**Key Features:**

*   **Periodic Synchronization:** Uses a scheduler (cron job) to automatically keep the local database in sync with your GitHub stars. The schedule is configurable via environment variables.
*   **Rich Data Storage:** Saves essential repository metadata, including description, language, star count, and key dates (created, pushed, starred).
*   **README Fetching:** Includes functionality to download and store the `README.md` content for each repository.
*   **Scalable Architecture:** Built on the powerful and modular NestJS framework.
*   **Type-Safe Database Access:** Leverages Prisma for a modern, type-safe database workflow.
*   **Observability:** Exposes key application metrics in Prometheus format.
*   **Containerized:** Comes with a multi-stage Dockerfile for easy deployment.
*   **CI/CD:** Includes a GitHub Actions workflow for continuous integration.

### Built With

*   [NestJS](https://nestjs.com/)
*   [Prisma](https://www.prisma.io/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [PostgreSQL](https://www.postgresql.org/) (or any other Prisma-supported database)
*   [Docker](https://www.docker.com/)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v22 or newer)
*   [pnpm](https://pnpm.io/)
*   A running PostgreSQL instance (or another database of your choice)
*   [Docker](https://www.docker.com/) (optional, for containerized setup)

### Installation

1.  **Clone the repository**
    ```sh
    git clone https://github.com/x0rium/gh-star-sync.git
    cd gh-star-sync
    ```

2.  **Install dependencies**
    ```sh
    pnpm install
    ```

3.  **Set up environment variables**

    Create a `.env` file in the root of the project by copying the example file:
    ```sh
    cp .env.example .env
    ```
    Now, open the `.env` file and fill in the required values. See the [Environment Variables](#environment-variables) section for a full list.

4.  **Run database migrations**

    This will set up the database schema based on your `prisma/schema.prisma` file.
    ```sh
    pnpm prisma migrate dev
    ```

### Running the Application

```bash
# Development mode with hot-reloading
$ pnpm run start:dev

# Production mode
$ pnpm run build
$ pnpm run start:prod
```

Once running, the application will automatically trigger the synchronization job based on the schedule and feature flags defined in your `.env` file.

### Running with Docker

You can also run the application using Docker.

1.  **Build the Docker image:**
    ```sh
    docker build -t gh-star-sync .
    ```

2.  **Run the Docker container:**
    Make sure to provide the necessary environment variables.
    ```sh
    docker run -p 3000:3000 --env-file ./.env gh-star-sync
    ```

## API Endpoints

*   `GET /health`: Returns the health status of the application.
    ```json
    {
      "status": "ok"
    }
    ```
*   `GET /metrics`: Exposes application metrics in Prometheus format.

## Environment Variables

| Variable              | Description                                                                                                 | Default         |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| `DATABASE_URL`        | Your database connection string.                                                                            |                 |
| `GITHUB_TOKEN`        | Your GitHub Personal Access Token (PAT) with 'repo' scope.                                                  |                 |
| `GITHUB_USERNAME`     | The GitHub username whose stars you want to sync.                                                           |                 |
| `PORT`                | The port the application will listen on.                                                                    | `3000`          |
| `ENABLE_SYNC_ON_BOOT` | Whether to run the synchronization job when the application starts. (`true` or `false`)                       | `true`          |
| `ENABLE_SYNC_CRON`    | Whether to enable the scheduled synchronization job. (`true` or `false`)                                    | `true`          |
| `CRON_SCHEDULE`       | The cron schedule for the synchronization job.                                                              | `*/5 * * * *`   |
| `METRICS_ENABLED`     | Whether to expose the `/metrics` endpoint. (`true` or `false`)                                              | `true`          |

## Running Tests

```bash
# Unit and e2e tests
$ pnpm run test

# Test coverage report
$ pnpm run test:cov
```

## Continuous Integration

This project uses GitHub Actions for CI. The workflow is defined in `.github/workflows/ci.yml`. It automatically runs on every push and pull request to the `main` branch, performing the following checks:

*   Linting
*   Building
*   Running tests

## License

Distributed under the MIT License. See `LICENSE` for more information.
