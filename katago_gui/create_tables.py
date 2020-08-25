
from pdb import set_trace as BP
from katago_gui import bcrypt

def create_tables(db):
    create_t_user(db)
    create_t_game(db)
    create_v_games_24hours(db)

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
    ,game_record text
    ) '''
    db.run( sql)

def create_v_games_24hours(db):
    if db.table_exists( 'v_games_24hours'): return
    sql = '''
    create view v_games_24hours as
    with t as (
    select
       g.game_hash game_hash, u.game_hash as uhash, g.ts_latest_move, g.username
       ,g.handicap, g.komi, g.game_record
       ,extract( epoch from now() - g.ts_latest_move) as idle_secs
       ,case when u.game_hash is not null then 1 else 0 end as active
       ,case when extract( epoch from now() - g.ts_latest_move) > 10 * 60 then 1 else 0 end as old
    from
       t_game g left outer join t_user u
       on g.game_hash = u.game_hash
    where
       g.username is not null
       and g.username not like 'guest*'
       and g.ts_latest_move is not null
       and extract( epoch from now() - g.ts_latest_move) < 3600 * 24
    )
    select
    *,
    case when active > 0 and not old > 0 then 1 else 0 end as live
    from t
    order by idle_secs
    '''
    db.run( sql)
