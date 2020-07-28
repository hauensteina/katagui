
from pdb import set_trace as BP
from katago_gui import bcrypt

def create_tables(db):
    create_t_user(db)

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
    ) '''
    db.run( sql)

    # Insert a test user
    phash = bcrypt.generate_password_hash( 'welcome').decode('utf-8')
    db.insert( 't_user',
               [{
                   'username':'tester'
                   ,'email':'tester@test.com'
                   ,'password':phash
                   ,'fname':'Joe'
                   ,'lname':'Schmoe'
               }])
