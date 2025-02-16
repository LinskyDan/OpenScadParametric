# Mortise Template Generator

A web application for generating precise OpenSCAD mortise templates with advanced customization and visualization capabilities.

## System Requirements

- Node.js v20 or later
- PostgreSQL 15 or later
- OpenSCAD (latest stable version)
- Modern web browser with WebGL support

## Installation

1. Clone the repository to your local machine

2. Install OpenSCAD
   - Linux: `sudo apt-get install openscad`
   - macOS: `brew install openscad`
   - Windows: Download from https://openscad.org/downloads.html

3. Install project dependencies:
```bash
npm install
```

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
```

2. Access the application in your browser at `http://localhost:5000`

## Features

- Imperial and metric measurement support
- Real-time 3D preview of templates
- Customizable mortise dimensions
- STL file generation for 3D printing
- Fraction display for imperial measurements
- Edge position customization

## Configuration

The application uses the following default values:
- Default template thickness: 1/4 inch
- Default edge height: 1/2 inch
- Default edge thickness: 3/8 inch

## Development

- Frontend: React with Vite
- Backend: Express.js
- Database: PostgreSQL with Drizzle ORM
- 3D Generation: OpenSCAD
- UI Components: shadcn/ui
