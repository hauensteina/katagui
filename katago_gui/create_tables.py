
from pdb import set_trace as BP
from katago_gui import bcrypt

def create_tables(db):
    create_t_user(db)
    create_t_game(db)

def create_t_user(db):
    if db.table_exists( 't_user'):
        return
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
    ) '''
    db.run( sql)

def create_t_game(db):
    if db.table_exists( 't_game'):
        return
    sql = '''
    create table t_game (
    game_hash text not null primary key
    ,owner_email text
    ,handicap integer
    ,komi real
    ,ts_started timestamptz
    ,ts_latest_move timestamptz
    ,g_record text
    ,g_complete_record text
    ) '''
    db.run( sql)
