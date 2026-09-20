# PPL Tracker — CS50x Final Project

## Video Demo

https://youtu.be/7KNwVESkKgk

## Description

PPL Tracker is a full-stack fitness tracking web app built as my CS50x final project. It lets users log Push, Pull, and Legs workout sessions, track progress over time, and automatically detect when a lift has plateaued — flagging exercises where weight hasn't increased in 3 or more sessions and suggesting it's time to progress.

## Features

- **User authentication** — register, log in, and log out securely with hashed passwords and session management
- **Workout logging** — log Push, Pull, or Legs sessions with multiple exercises, sets, reps, and weight
- **Dashboard** — view full workout history filtered by day type (Push / Pull / Legs / All)
- **Plateau detection** — automatically flags any exercise that hasn't seen a weight increase in 3 consecutive sessions and suggests progression

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (hosted on Neon)
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Auth:** express-session, bcryptjs

## Project Structure

fitness-tracker/
├── db/
│ ├── db.js # PostgreSQL connection pool using DATABASE_URL
│ └── schema.sql # All table definitions (users, workouts, exercises, sets)
├── public/
│ ├── index.html # Login / Register page
│ ├── dashboard.html # Workout history and plateau alerts
│ ├── log.html # Log a new workout session
│ ├── css/ # Stylesheets
│ └── js/ # Frontend JavaScript (auth, dashboard, log)
├── scripts/ # Database migration scripts
├── server.js # Express server, all API routes
├── package.json
└── .env # Environment variables (not committed)

## How to Run Locally

1. Clone the repo

2. Run `npm install`

3. Create a `.env` file with:
   DATABASE_URL=your_neon_connection_string
   PORT=8080

4. Run the database migration:
   node scripts/migrate.js

5. Start the server:
   npm run dev

6. Open `http://127.0.0.1:8080` in your browser

## Design Decisions

- **Neon (cloud PostgreSQL)** was chosen over a local database to keep setup simple and the app portable
- **Vanilla JS** was used intentionally to keep the frontend simple and demonstrate core DOM and fetch API skills without hiding them behind a framework
- **Session-based auth** with bcrypt hashing keeps user credentials secure
- **Plateau detection** compares the max weight logged per exercise across the last 3 sessions — if it never increases, the exercise is flagged on the dashboard

## Author

Harish Kumar — B.Tech Artificial Intelligence & Data Science, 2026
