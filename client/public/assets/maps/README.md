# Map Sprite Assets

Place per-map sprite files in these folders:

- `default_room/`
- `portfolio_lounge/`
- `research_studio/`

Expected filenames for each map folder:

- `map.png`
- `player.png`
- `remote-player.png`
- `table.png`
- `whiteboard.png`
- `notebook.png`
- `door.png`

The client now resolves sprite URLs automatically from `/assets/maps/<map_name>/...` based on the room environment file name.
