# Email Workflow Assistant - Lead Manager

A Next.js application for managing cold outreach leads and generating personalized follow-up emails. Built with Next.js 16, React 19, Tailwind CSS 4, and shadcn/ui.

## Features

- **Lead Management** - Add, edit, delete, and search leads with detailed profiles
- **Action Center** - Prioritized view of overdue, today's, tomorrow's, and inactive follow-ups
- **Email Generator** - Generate personalized email templates for each outreach layer (L1-L5+)
- **Pipeline View** - Visual funnel showing leads at each stage of the outreach process
- **CSV Import/Export** - Bulk import leads from CSV and export your lead database
- **Dark Mode** - Beautiful dark theme optimized for extended use

## Outreach Layers

| Layer | Name | Timing | Description |
|-------|------|--------|-------------|
| L1 | First Contact | Day 0 | Cold outreach - short introduction, personalized observation |
| L2 | Follow-up | +2 days | Reminder of previous message, stronger value angle |
| L3 | Strong Follow-up | +4-5 days | Clearer urgency, stronger persuasion |
| L4 | Break-up Email | +7-10 days | Polite exit message, keeps door open |
| L5+ | Final Persuasion | Long gap | Strongest attempt, emotional or value-driven closing |

## Prerequisites

- Node.js 18+ 
- PostgreSQL database (Neon recommended - https://neon.tech)

## Setup

### 1. Clone and Install

```bash
cd email-shuffle-workflow
npm install
```

### 2. Database Setup

Create a PostgreSQL database (Neon is recommended for serverless) and run the SQL script:

```bash
# Using psql
psql "your-database-url" < scripts/setup-database.sql

# Or run the SQL in the Neon SQL editor
# Copy the contents of scripts/setup-database.sql and execute
```

### 3. Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL="postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Add Leads** - Click "Add Lead" to add new prospects with their details
2. **Action Center** - The default view shows prioritized actions (overdue, today, tomorrow)
3. **Generate Emails** - Click on a lead, go to "Email Generator" tab, select the layer, and copy the personalized email
4. **Track Progress** - Mark emails as sent to automatically advance leads through layers
5. **Import/Export** - Use the Import/Export buttons to bulk manage leads via CSV

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: PostgreSQL via Neon (serverless)
- **State Management**: SWR for data fetching
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
# Email-Shuffle
