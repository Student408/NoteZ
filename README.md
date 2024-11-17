# Note Taking App with Next.js and Supabase

A modern note-taking application built with Next.js 13+ (App Router), Supabase, and GitHub Authentication. Features include real-time markdown editing, dark mode support, and automatic saving.

## Features

- 🔐 GitHub Authentication
- 📝 Rich Text Editor with Markdown support
- 🌓 Dark/Light mode
- 💾 Auto-saving
- 🔍 Note search functionality
- ⚡ Real-time updates
- 📱 Responsive design

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18.x or later
- npm or yarn
- Git

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Student408/NoteZ.git
cd <NoteZ>
```

### 2. Install Dependencies

```shellscript
 npm installnpm install
# or
yarn install

```

### 3. Supabase Setup

1. Create a new project on [Supabase](https://supabase.com)
2. Create a new table called `notes` with the following schema:

```sql
 create table notes (create table notes (
  id uuid default uuid_generate_v4() primary key,
  title text,
  content text,
  user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

```


3. Set up Row Level Security (RLS) policies:

```sql
 alter table notes enable row level security;alter table notes enable row level security;

create policy "Users can read own notes" on notes
  for select using (auth.uid() = user_id);

create policy "Users can create own notes" on notes
  for insert with check (auth.uid() = user_id);

create policy "Users can update own notes" on notes
  for update using (auth.uid() = user_id);

create policy "Users can delete own notes" on notes
  for delete using (auth.uid() = user_id);

```




### 4. GitHub OAuth Setup

1. Go to GitHub Settings > Developer Settings > OAuth Apps
2. Create a new OAuth application
3. Set the Homepage URL to your application URL (e.g., `http://localhost:3000`)
4. Set the Authorization callback URL to your Supabase URL:

```plaintext
 https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callbackhttps://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback

```




### 5. Environment Variables

Create a `.env.local` file in the root directory:

```plaintext
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

```

### 6. Run the Development Server

```shellscript
 npm run dev
# or
yarn dev

```




## Deployment

1. Push your code to GitHub
2. Create a new project on Vercel
3. Connect your GitHub repository
4. Add the environment variables
5. Deploy!


## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## License

This project is licensed under the MIT License - see the LICENSE file for details.

