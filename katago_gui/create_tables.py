
from pdb import set_trace as BP
from katago_gui import bcrypt

def create_tables(db):
    create_t_user(db)
    create_t_game(db)
    create_v_games_24hours(db)
    create_v_games_no_zobrist(db)
    create_v_recent_users(db)
    create_v_registered(db)
    create_v_guests(db)

def create_t_user(db):
    if db.table_exists( 't_user'): return
    sql = '''
    create table t_user (
    id bigserial not null primary key
    ,username text
    ,email text
    ,password text
    ,fname text
    ,lname text
    ,ts_created timestamptz
    ,ts_last_seen timestamptz
    ,email_verified boolean
    ,lang text
    ,game_hash text
    ,move_count integer not null default 0
    ,self_move_count integer not null default 0
    ,watch_game_hash text
    ) '''
    db.run( sql)

def create_t_game(db):
    if db.table_exists( 't_game'): return
    sql = '''
    create table t_game (
    game_hash text not null primary key
    ,username text
    ,handicap integer
    ,komi real
    ,ts_started timestamptz
    ,ts_latest_move timestamptz
    ,client_timestamp bigint
    ,game_record text
    ,zobrist text
    ,ts_zobrist timestamptz
    ,ip_addr text
    ) '''
    db.run( sql)

def create_v_games_24hours(db):
    if db.table_exists( 'v_games_24hours'): return
    sql = """
    create view v_games_24hours as
    with obs_by_game as (
      select
        watch_game_hash, count(*) as n_obs
      from
       t_user
      where
        watch_game_hash is not null
      group by watch_game_hash
    ),
    games  as (
    select
       g.game_hash game_hash, u.game_hash as uhash, g.ts_latest_move, g.username
       ,g.handicap, g.komi, g.game_record
       ,coalesce( o.n_obs, 0) as n_obs
       ,extract( epoch from now() - g.ts_latest_move) as idle_secs
       ,case when u.game_hash is not null then 1 else 0 end as active
       ,case when extract( epoch from now() - g.ts_latest_move) > 10 * 60 then 1 else 0 end as old
    from
       t_game g
          left outer join t_user u
       on g.game_hash = u.game_hash
          left outer join obs_by_game o
       on g.game_hash = o.watch_game_hash
    where
       g.username is not null
       and g.game_record is not NULL
       and not g.game_record = ''
       and g.ts_latest_move is not null
       and extract( epoch from now() - g.ts_latest_move) < 3600 * 24
    )
    select
    *,
    case when active > 0 and not old > 0 then 1 else 0 end as live
    from games
    order by idle_secs
    """
    db.run( sql)

def create_v_games_no_zobrist(db):
    if db.table_exists( 'v_games_no_zobrist'): return
    sql = """
    create view v_games_no_zobrist as
    WITH games AS (
    SELECT g.game_hash,
    COALESCE(date_part('epoch'::text, (g.ts_zobrist - g.ts_latest_move)), ('-300'::integer)::double precision) AS age
    FROM t_game g
    WHERE ((g.game_record IS NOT NULL) AND (NOT (g.game_record = ''::text)))
    )
    SELECT games.game_hash,
    games.age
    FROM games
    WHERE (games.age <= ('-300'::integer)::double precision)
    """
    db.run(sql)

def create_v_recent_users(db):
    if db.table_exists( 'v_recent_users'): return
    sql = """
    create view v_recent_users as
    select t_user.username,
    t_user.email,
    (now() - t_user.ts_last_seen) AS t_idle
    FROM t_user
    ORDER BY (now() - t_user.ts_last_seen)
    """
    db.run(sql)

def create_v_registered(db):
    if db.table_exists( 'v_registered'): return
    sql = """
    create view v_registered as
    SELECT t_user.username,
    t_user.email,
    t_user.ts_created,
    t_user.email_verified,
    (now() - t_user.ts_last_seen) AS t_idle
    FROM t_user
    WHERE (t_user.username !~~ 'guest_%'::text)
    ORDER BY (now() - t_user.ts_last_seen)
    """
    db.run(sql)

def create_v_guests(db):
    if db.table_exists( 'v_guests'): return
    sql = """
    create view v_guests as
    SELECT t_user.username,
    t_user.email,
    t_user.ts_created,
    (now() - t_user.ts_last_seen) AS t_idle
    FROM t_user
    WHERE (t_user.username ~~ 'guest_%'::text)
    ORDER BY (now() - t_user.ts_last_seen)
    """
    db.run(sql)
