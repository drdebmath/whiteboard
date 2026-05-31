# Whiteboard

A local-first personal dashboard for academic tasks, household lists, health habits, reminders, and optional private GitHub Gist sync.

Repository: <https://github.com/drdebmath/whiteboard>

You can use it on the web at <https://drdebmath.github.io/whiteboard/>, or run it locally:

```bash
git clone https://github.com/drdebmath/whiteboard.git
```

## Use

Serve this folder with a static server (required for Gist sync and reliable script loading), then open the app:

```bash
python3 -m http.server 8080
```

Visit `http://localhost:8080/`.

The app stores data in browser local storage by default. Optional Gist sync stores the board as a single JSON file in a private GitHub Gist configured by the user.

## Privacy

The repository starts with an empty board. User data, the display name, and the GitHub token are not hard-coded in the files.

- Board data stays in browser local storage unless Gist sync is configured.
- The display name is stored only in browser local storage.
- The GitHub token is stored only in browser local storage and is sent directly to GitHub's API.
- `.thumbnail` is ignored and should not be committed.
