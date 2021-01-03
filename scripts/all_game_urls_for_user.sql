
-- Dump all games by one player
-- AHN, Jan 2021

select
  ts_started,
  handicap,
  'https://katagui.herokuapp.com/watch_game?live=0&game_hash=' || game_hash as url
from
  t_game
where
  username = 'dfs'
order by 1
;
