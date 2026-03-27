# Security Policy

## Supported Versions

This project should always be deployed with the latest stable code from `main`.

## Reporting a Security Issue

If you discover a security issue, do not share it publicly.

Please report it privately to the project maintainer and include:

- A short description of the issue
- The affected page or API route
- Steps to reproduce
- Any proof-of-concept request or screenshot

## Security Principles

- Never commit secrets to GitHub
- Never expose MongoDB credentials in frontend code
- Never use `localhost` values in production Vercel environment variables
- Never hardcode JWT secrets in source files
- Never trust client-side role checks alone for authorization

## Required Environment Variables

### Frontend

```env
VITE_API_URL=https://your-backend-domain.vercel.app
VITE_APP_URL=https://your-frontend-domain.vercel.app
```

### Backend

```env
CLIENT_URL=https://your-frontend-domain.vercel.app
FRONTEND_URL=https://your-frontend-domain.vercel.app
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_random_secret
REQUEST_BODY_LIMIT=10mb
```

## Authentication and Session Safety

- Use strong, unique passwords for all admin accounts
- Rotate JWT secrets if they are ever exposed
- Keep token storage limited to what is required by the application
- Clear tokens on logout
- Verify user roles on the backend for protected routes

## Certificate Verification Safety

- Certificates should be verified through the backend API, not by trusting frontend state
- Certificate URLs should use the live deployed frontend domain
- Regenerate certificates after changing deployment URLs
- Do not reuse old localhost-based certificate links in production

## Database Safety

- Restrict MongoDB Atlas access to only trusted IP rules or secure connection settings
- Use a dedicated database user with the least privileges needed
- Back up production data regularly
- Avoid storing unnecessary personal data

## File Upload Safety

- Accept only the expected spreadsheet formats
- Validate uploaded file type and structure before processing
- Keep upload size limits in place
- Reject malformed rows rather than importing partial bad data

## Deployment Safety

- Deploy frontend and backend as separate Vercel projects
- Set environment variables in the correct project only
- Redeploy after any environment variable change
- Verify production URLs after each deployment

## Hardening Checklist

- [ ] Rotate the JWT secret regularly
- [ ] Confirm frontend and backend use live Vercel URLs
- [ ] Remove any localhost URLs from production config
- [ ] Verify CORS is limited to the production frontend origin
- [ ] Keep MongoDB credentials private
- [ ] Review uploaded file handling before enabling new file types

## Notes

This security guide is intended to keep CertiFlow safe for production use.  
If the project grows, this file should be updated alongside the authentication and deployment flow.
