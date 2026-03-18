# Shadow Room

An incognito chatroom app with:

- throwaway aliases
- room-based invites
- in-memory message storage only
- no login flow and no database

## Run it

```bash
node server.js
```

Then open `http://localhost:3000`.

## Incognito behavior

- Rooms are created on demand.
- Messages live only in server memory.
- Empty rooms are removed shortly after everyone leaves.
- Restarting the server wipes every room and message.

## Deploy it

This app is ready for Node hosts that run a long-lived server process, such as Render or Railway.

- Start command: `node server.js`
- Port: provided by the host via `PORT`
- Host binding: `0.0.0.0`

Important:

- Rooms and messages are stored only in memory.
- A restart or redeploy clears all chat history.
- If you later scale to multiple app instances, you will need shared storage for room state.
