
def create_tables(db):
    create_t_user(db)

def create_t_user(db):
    if db.tableExists( 't_user'):
        return
    sql = '''
    create table t_user (
    id bigserial not null primary key
    ,email text
    ,password text
    ,fname text
    ,lname text
    ,json text
    ) '''
    db.runWriteQuery( sql)
