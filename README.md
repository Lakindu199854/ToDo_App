# Task Board

A public board with daily tasks and weekly planning. Tasks can have a planned day, an estimated duration, a due date and time, and notes. The planning tab shows both sets of notes for each Sunday-to-Saturday week. Anyone who opens the site can view and edit both lists and planning notes.

## Preview locally

From the project folder, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [localhost:8000](http://127.0.0.1:8000). When connected to Supabase, the preview uses the same shared data as the published site. With both Supabase settings blank, the app uses a demo that saves changes only in that browser.

## Supabase

The app connects to the [Supabase project](https://supabase.com/dashboard/project/tijjoakptzioaizbyshi). The [daily tasks](supabase/migrations/20261126000000_board.sql), [weekly plans](supabase/migrations/20261126010000_weekly_plans.sql), and [deadline time zones](supabase/migrations/20261126020000_task_time_zones.sql) migrations configure the Data API.

For a fresh project, apply the migrations in order and set the project URL and browser-safe publishable key in [config.js](config.js).

## Dates and times

Lakindu’s tasks use Colombo time, and Milanka’s use Milan time. **Today** shows each list’s local date. Selecting a specific calendar day shows that date for both lists. Timed deadlines show both cities. Date-only deadlines use the calendar date entered in the form. The shared planning week begins Sunday in Colombo.

Existing timed deadlines were entered in Colombo time. When editing one, the form shows the same deadline in the task owner’s local time. The app rejects skipped clock times and uses the later occurrence when a Milan clock time repeats.

## Publish on GitHub Pages

1. Push the project files to your GitHub repository, including `.nojekyll`.
2. In **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, select your branch and **/(root)**, then save. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
3. Open the Pages URL. The board updates when the tab comes into focus and about every 15 seconds while visible.

The Pages URL serves the static app. Supabase stores the shared tasks and planning notes.
