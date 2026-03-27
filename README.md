# CertiFlow

CertiFlow is a certificate verification system for admins and students. Admins can import student records, generate certificates, and publish verification links. Students can search certificate IDs, scan QR codes, and download certificate PDFs.

## Features

- Admin and student authentication
- Excel-based student import
- Certificate generation with downloadable PDF
- QR code verification on certificates and PDFs
- Certificate lookup by certificate ID
- Mobile-friendly dashboard and verification flow
- Separate frontend and backend deployment on Vercel

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express
- Database: MongoDB Atlas
- PDF generation: jsPDF
- QR generation: qrcode
- Deployment: Vercel

## Project Structure

```text
Certificate Verification System/
  backend/
  frontend/
  README.md
```

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/certificate-verification-system.git
cd certificate-verification-system
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
CLIENT_URL=https://your-frontend-domain.vercel.app
FRONTEND_URL=https://your-frontend-domain.vercel.app
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
REQUEST_BODY_LIMIT=10mb
```

Run backend:

```bash
npm run start
```

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=https://your-backend-domain.vercel.app
VITE_APP_URL=https://your-frontend-domain.vercel.app
```

Run frontend:

```bash
npm run dev
```

## Vercel Deployment

This project is deployed as two separate Vercel apps.

### Frontend Vercel env vars

```env
VITE_API_URL=https://your-backend-domain.vercel.app
VITE_APP_URL=https://your-frontend-domain.vercel.app
```

### Backend Vercel env vars

```env
CLIENT_URL=https://your-frontend-domain.vercel.app
FRONTEND_URL=https://your-frontend-domain.vercel.app
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
REQUEST_BODY_LIMIT=10mb
```

## How It Works

1. Admin signs in and uploads student data through an Excel file.
2. Backend saves student and certificate records in MongoDB.
3. Certificate pages are generated with a public verification URL.
4. QR codes on the certificate page and in the PDF point to the live verification link.
5. Students or employers scan the QR code or enter the certificate ID to verify the record.

## Notes

- Regenerate certificates after changing deployment URLs or environment variables.
- Do not use `localhost` in deployed Vercel environment variables.
- The backend and frontend must point to the correct live URLs for login, signup, and verification to work.

## License

This project is for educational and portfolio use unless you add a separate license.
