npm install
```

## Application Structure

The application has three main entry points:

1. Backend Entry (`server/index.ts`):
   - Express server setup
   - API route handling
   - Database connections
   - OpenSCAD integration

2. Frontend Entry (`client/index.html`):
   - Main HTML template
   - Loads the React application
   - Contains viewport and meta settings

3. React Entry (`client/src/main.tsx`):
   - React application initialization
   - Component and routing setup
   - State management

## Database Setup

1. Create a PostgreSQL database for the application

2. Set up your environment variables by creating a `.env` file:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/your_database_name
PORT=5000  # Or your preferred port
```

3. Run the database migration:
```bash
npm run db:push
```

## Running the Application

1. Start the development server:
```bash
npm run dev