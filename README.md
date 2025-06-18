AU FHIR Test Data Search
A containerized web application to search and view FHIR test data from the hl7au/au-fhir-test-data repository, with features to contribute new test data and raise issues.
Features

Search FHIR resources by resource type, ID, or profile.
View detailed JSON representations of resources.
Contribute new FHIR test data, creating pull requests in the repository.
Raise issues, creating GitHub issues with structured details.
GitHub OAuth for user authentication.

Project Structure
au-fhir-search/
├── frontend/
│   ├── Dockerfile  # Docker config for frontend
│   ├── index.html  # React frontend
│   └── nginx.conf  # Nginx configuration
├── backend/
│   ├── Dockerfile  # Docker config for backend
│   ├── server.js  # Express server
│   └── package.json  # Backend dependencies
├── docker-compose.yml  # Orchestrates containers
├── .env  # Environment variables
└── README.md  # Documentation

Prerequisites

Docker
Docker Compose
GitHub account
GitHub personal access token with repo scope
GitHub OAuth app credentials

Setup
1. Clone the Repository
git clone <your-repository-url>
cd au-fhir-search

2. Configure Environment Variables
Create a .env file in the root directory:
GITHUB_TOKEN=your_personal_access_token
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret


Generate a personal access token at https://github.com/settings/tokens with repo scope.
Create a GitHub OAuth app at https://github.com/settings/developers, setting the callback URL to http://localhost:3000/api/auth/github/callback (update for production).

3. Build and Run Containers
docker-compose up --build


Access the frontend at http://localhost:8080.
The backend runs at http://localhost:3000 (primarily for API calls).

4. Stop Containers
docker-compose down

Usage

Search: Enter a resource type, ID, or profile in the search bar to filter resources.
View: Click a resource to view its JSON details.
Contribute: Log in with GitHub, paste FHIR JSON, and submit to create a pull request.
Raise Issue: Log in with GitHub, enter issue details, and submit to create a GitHub issue.

Deployment

Local Development: Use docker-compose up as described.
Production:
Deploy to a cloud provider (e.g., AWS ECS, Kubernetes).
Update BACKEND_API_URL in docker-compose.yml to the backend’s public URL.
Update the OAuth callback URL in server.js and GitHub OAuth app settings.
Use a reverse proxy (e.g., Nginx, Traefik) for HTTPS.



Notes

The FHIR validation in server.js is simplified; use a library like HAPI FHIR for production.
Adjust the resources path in server.js based on the au-fhir-test-data repository structure.
Implement rate-limiting and caching for GitHub API calls in production.
Secure the .env file and use a secrets manager in production.

License
MIT
