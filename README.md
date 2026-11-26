# Lakindu & Milanka — Daily Tasks

A public, shared daily task board for Lakindu and Milanka. The page opens directly to both lists. Tasks can have a planned day, an estimated duration, a due date and time, and notes. Anyone who opens the site can view and edit both lists.

## Preview locally

From the project folder, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [localhost:8000](http://127.0.0.1:8000). When connected to Supabase, the preview uses the same shared data as the published site. With both Supabase settings blank, the app uses a demo that saves changes only in that browser.

## Supabase

The app connects to the [Lakindu and Milanka Daily Tasks project](https://supabase.com/dashboard/project/tijjoakptzioaizbyshi). [The board migration](supabase/migrations/20261126000000_board.sql) defines the task table and grants visitors access through the Data API.

For a fresh project, apply the migration in its SQL Editor and set the project URL and browser-safe publishable key in [config.js](config.js). The default time zone for dates and due times is `Asia/Colombo`.

## Publish on GitHub Pages

1. Push the project files to your GitHub repository, including `.nojekyll`.
2. In **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, select your branch and **/(root)**, then save. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
3. Open the Pages URL. The board updates when the tab comes into focus and about every 15 seconds while visible.

The Pages URL serves the static app. Supabase stores the shared task data.
