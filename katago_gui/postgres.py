"""
' dbutils.py
'
' Andreas Hauenstein
' Created: Jul 15, 2020
'
' A thin layer on top of psycopg2 to run queries
' against a postgres DB
"""

import os, sys
import inspect
from datetime import datetime
from io import StringIO
import psycopg2
import psycopg2.extras
from psycopg2.extensions import STATUS_READY
import traceback

from pdb import set_trace as BP

#==============
class Postgres:
    ''' Class to easily use postgres '''
    conns = {} # Remember the db connections in a class var, for re-use

    def __init__( self, db_url):
        self.db_url = db_url
        self.get_conn()

    def get_conn( self):
        ''' Return connection if good, else make a new one '''
        try:
            if self.db_url in Postgres.conns and Postgres.conns[self.db_url].status == STATUS_READY:
                self.conn = Postgres.conns[self.db_url]
                return self.conn
            else:
                if self.db_url in Postgres.conns:
                    Postgres.conns[self.db_url].close()
                Postgres.conns[self.db_url] = None
                self.conn = psycopg2.connect( self.db_url)
                self.conn.set_isolation_level( psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
                Postgres.conns[self.db_url] = self.conn
        except Exception as e:
            traceback.print_exc(e)
            raise

    def create_tables( self):
        ''' Create some tables we always need. Add more as you see fit. '''
        self.create_t_log()
        self.create_t_parameters()

    def create_t_log( self):
        sql = '''
        create table t_log (
        id     bigserial not null primary key
        ,level varchar(20)
        ,dtime timestamp
        ,msg   varchar(1000)
        ); '''
        self.runWriteQuery( sql)

    def create_t_parameters( self):
        sql = '''
        create table t_parameters (
        name    varchar(30) not null
        ,value  varchar(1000) default null
        ); '''
        self.runWriteQuery( sql)

    def insert( self, table, data, unique_cols=[]):
        '''
        Performs a single, or multiple, insert operation(s) on the given table
        with the given data. The query is handled as a prepared statement so
        multi-inserts are more efficient.
        '''
        self.get_conn()
        num_inserted = 0
        if len(data) == 0: return 0

        columns = "("
        params = ""
        # assume all new rows have the same columns
        for col in data[0].keys():
            columns += str(col) + ","
            params += "%s,"

        # Build the where clause to avoid duplicates
        where = ''
        if unique_cols:
            where = ' where not exists (select 1 from ' + table + ' where '
            first = True
            for ucol in unique_cols:
                if not first:
                    where += ' and '
                else:
                    first = False
                    where += (ucol + ' = %s ')
                    where += ')'

        columns = chop (columns) + ")"
        params = chop (params)

        # the query
        query = "INSERT INTO " + table + " " + columns + " SELECT "\
            + params + where

        # insert all the given data
        curs = self.conn.cursor()
        for row in data:
            try:
                # Pick the unique values
                unique_vals = []
                for ucol in unique_cols:
                    unique_vals = list( row[k] for k in unique_cols)
                curs.execute( query, tuple(row.values()) + tuple(unique_vals))
                num_inserted += 1
                if num_inserted % 100 == 0 :
                    self.conn.commit()
            except Exception as e:
                self.conn.commit()
                self.pexc("%s row: %s",str(e) + str(row))
                curs.close()
        return num_inserted

        self.conn.commit()
        curs.close()
        return num_inserted

    def insert_bulk( self, table, data, unique_cols=[]):
        '''
        Just like insert, except we use the postgres COPY function
        into a temp table to speed things up.
        Returns number of rows inserted on success, 0 on failure
        '''
        self.get_conn()
        if not data:
            self.perr ('no rows to insert')
            return 0

        try:
            # Put the data into a string file-like object, in csv format
            csv = StringIO()
            for row in data:
                # Strip all strings in values() and put them into a semicol del string
                tstr = ";".join ([str(x).strip() for x in row.values()]) + "\n"
                csv.write (tstr)
            # Make a temp table to hold the imported data
            cols = data[0].keys();
            temptable = table + '_bulk'
            self.dropTable( temptable)
            sql = 'create temporary table ' + temptable
            sql += ' as select ' + ",".join(cols) + ' from ' + table + ' where 1=0'
            self.runWriteQuery( sql)

            # Bulk load the stringio into the temp table
            curs = self.conn.cursor()
            csv.seek(0)
            curs.copy_expert("COPY " + temptable + " FROM STDIN WITH NULL AS 'None' DELIMITER ';'", csv)
            self.conn.commit()
            curs.close()

            # Delete duplicates from target table if unique_cols specified
            distinct = ' distinct '
            if unique_cols:
                colstr = ','.join (unique_cols)
                distinct = ' distinct on ( ' + colstr + ' ) '
                self.plog( 'deleting duplicate ' + colstr + ' from ' + table)
                where = ' where (' + colstr + ') in (select ' + colstr + ' from ' + temptable + ')'
                sql = 'delete from ' + table + where
                self.plog( 'delete query: ' + sql)
                n_deleted = self.runWriteQuery( sql)
                if n_deleted > 0:
                    self.perr( 'Deleted %d duplicates in %s' % (n_deleted,table))

            # Insert new rows into target
            sql = 'insert into %s(%s) select %s  * from %s' % (table, ','.join(cols), distinct, temptable)
            self.plog ('insert query: ' + sql)
            return self.runWriteQuery (sql)
        except Exception as e:
            self.pexc(e)
            return 0

    def slurp( self, table, cols=[]):
        ''' Slurp some table columns into list of dicts '''
        self.get_conn()
        rows = None
        columns = ''
        for col in cols:
            columns += col + ','
            columns = chop (columns)
        if columns == '': columns = '*'

        query = 'SELECT ' + columns + ' FROM ' + table + ';'
        curs = self.conn.cursor()
        try:
            curs.execute(query)
            rows = curs.fetchall()
        except Exception as e:
            self.pexc(e,str(row))
            rows = None
        finally:
            curs.close()
        return rows

    def slurp_distinct( self, table, cols=[]):
        ''' Slurp some table columns into list of dicts, without dups '''
        self.get_conn()
        rows = None
        columns = ''
        for col in cols:
            columns += col + ','
            columns = chop (columns)
        if columns == '': columns = '*'

        query = 'SELECT distinct ' + columns + ' FROM ' + table + ';'
        curs = self.conn.cursor()
        try:
            curs.execute(query)
            rows = curs.fetchall()
        except Exception as e:
            self.pexc(e)
            rows = None
        finally:
            curs.close()
        return rows

    def runReadQuery( self, query, args=()):
        ''' Executes an SQL query and returns the rows as a list of tuples '''
        self.get_conn()
        rows = None
        curs = self.conn.cursor()
        try:
            curs.execute (query, args)
            rows = curs.fetchall()
        except Exception as e:
            raise
        finally:
            curs.close()
        return rows

    def runReadQueryIter( self, query, args=()):
        '''
        Executes an SQL query and returns an iterator giving the rows as tuples.
        Useful for large data sets if you don't want to cram them into memory at once.
        '''
        self.get_conn()
        curs = self.conn.cursor()
        try:
            curs.execute (query, args)
            return curs
        except Exception as e:
            raise

    def runReadQueryDict( self, query, args=()):
        '''
        Get SQL output into a list of dicts (one dict per row).
        '''
        self.get_conn()
        rows = None
        curs = self.conn.cursor( cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            curs.execute (query, args)
            rows = curs.fetchall()
        except Exception as e:
            raise
        finally:
            curs.close()
        return rows

    def runReadQueryIterDict( self, query, args=()):
        '''
        Executes an SQL query and returns an iterator giving the rows as dicts.
        Useful for large data sets if you don't want to cram them into memory at once.
        '''
        self.get_conn()
        curs = self.conn.cursor( cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            curs.execute(query, args)
            return curs;
        except Exception as e:
            raise

    def runWriteQuery( self, query, args=()):
        '''
        Executes a custom SQL query which modifies data in the database.

        arguments:
        query - a string representing the SQL query to be executed. %s placeholders for arg values
        args  - a tuple with the arg values

        example:
          runWriteQuery ('insert into tt values(%s,%s)',(13,'tom'))
        returns:
          Number of affected rows
        '''
        self.get_conn()
        curs = self.conn.cursor()
        try:
            curs.execute (query,args)
            self.conn.commit()
            return curs.rowcount
        except Exception as e:
            raise
        finally:
            curs.close()

    def tableExists( self, tabname):
        ''' Return true if table exists, else false '''
        self.get_conn()
        exists_sql = "select * from pg_tables where tablename = '%s'" % tabname
        try:
            return self.runReadQuery( exists_sql,())
        except Exception as e:
            raise

    def dropTable( self, tabname):
        '''  Drop a table, if it exists '''
        try:
            if (self.tableExists(tabname)):
                self.runWriteQuery ('drop table ' + tabname,())
        except Exception as e:
            raise

    def getParm(self, param_name):
        ''' Retrieves the value of a parameter stored in the "t_parameters" table '''
        rows = self.runReadQuery( "select value from t_parameters where name = %s", (param_name,))

        if len(rows) > 0:
            return rows[0][0]
        else:
            return None

    def setParm (self, param_name, param_value):
        '''
        Adds a parameter to the "t_parameter" table and sets it to the given
        value. If the parameter already exists, then the parameter's value is
        updated to reflect the given value.
        '''
        rows = self.runReadQuery ("SELECT * FROM t_parameters where name = %s", (param_name,))
        if rows:
            self.runWriteQuery ("UPDATE t_parameters SET value = %s  WHERE name = %s", (param_value, param_name))
        else:
            self.runWriteQuery ("INSERT INTO t_parameters (name, value) VALUES (%s,%s)", (param_name, param_value))

    def rmParm (self, param_name):
        ''' Removes a parameter from the "t_parameters" table. '''
        self.runWriteQuery ("DELETE FROM t_parameters WHERE name = %s", (param_name,))


    ''' Tracing to t_log '''
    '''-------------------'''

    def pexc( self, e, p_txt=''):
        ''' Trace Exception to Postgres t_log '''
        func = parent_funcname()
        fname = parent_filename()
        exname = type(e).__name__
        exmsg = e.__str__()
        exc_type, exc_obj, exc_tb = sys.exc_info()
        line =  exc_tb.tb_lineno

        if p_txt:
            msg = '%s %s():%d %s %s TXT:%s' % (fname, func, line, str(exname), str(exmsg), p_txt)
        else:
            msg = '%s %s():%d %s %s' % (fname, func, line, str(exname), str(exmsg))
            self.trace( 'EXCEPTION', msg)

    def perr( self, p_msg):
        ''' Trace Error to Postgres t_log '''
        func = parent_funcname()
        fname = parent_filename()
        msg = "%s %s(): %s" % (fname, func, p_msg)
        self.trace( "ERROR",msg)

    def plog( self, p_msg):
        ''' Trace Log msg to Postgres t_log '''
        func = parent_funcname()
        fname = parent_filename()
        msg = '%s %s(): %s' % (fname, func, p_msg)
        self.trace( 'LOG',msg)

    def pstart( self):
        ''' Write function start log to Postgres t_log '''
        func = parent_funcname()
        fname = parent_filename()
        msg = '%s %s()' % (fname, func)
        self.trace( 'START',msg)

    def pend( self):
        ''' Write function end log to Postgres t_log '''
        func = parent_funcname()
        fname = parent_filename()
        msg = '%s %s()' % (fname, func)
        self.trace ('END',msg)

    def trace( self, p_level, p_msg):
        ''' Basic trace function. plog,perr,pexc call this. '''
        now = str(datetime.now())
        # To screen / logfile
        print( '%s %s %s' % (now, p_level, p_msg))
        # To t_log table
        self.insert ('t_log',
                   [{'level':p_level,'msg':p_msg,'dtime':now}])

    @classmethod
    def run_tests( cclass):
        os.system( 'psql -c "drop database test"')
        os.system( 'psql -c "create database test"')
        db_url = 'postgresql://localhost/test'
        db = Postgres( db_url)
        db.create_tables()
        # Create a table
        db.runWriteQuery( 'create table t_test ( val int, txt text );')
        print('')

        # insert
        testnum = 1
        db.runWriteQuery( 'delete from t_test;')
        db.insert( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'uno'},{'val':2,'txt':'two'}], unique_cols=['val'])
        res = db.slurp( 't_test')
        print(res)
        print( 'Test %d passed\n' % testnum) if len( db.slurp( 't_test')) == 2 else  print( '############ Test %d failed' % testnum)
        testnum = 2
        db.runWriteQuery( 'delete from t_test;')
        db.insert( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'uno'},{'val':2,'txt':'two'}])
        res = db.slurp( 't_test')
        print(res)
        print( 'Test %d passed\n' % testnum) if len( db.slurp( 't_test')) == 3 else  print( '############ Test %d failed' % testnum)

        # insert_bulk
        testnum = 3
        db.runWriteQuery( 'delete from t_test;')
        db.insert_bulk( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'uno'},{'val':2,'txt':'two'}], unique_cols=['val'])
        res = db.slurp( 't_test')
        print(res)
        print( 'Test %d passed\n' % testnum) if len( db.slurp( 't_test')) == 2 else  print( '############ Test %d failed' % testnum)
        testnum = 4
        db.runWriteQuery( 'delete from t_test;')
        db.insert_bulk( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'uno'},{'val':2,'txt':'two'}])
        res = db.slurp( 't_test')
        print(res)
        print( 'Test %d passed\n' % testnum) if len( db.slurp( 't_test')) == 3 else  print( '############ Test %d failed' % testnum)

        # slurp
        testnum = 5
        db.runWriteQuery( 'delete from t_test;')
        db.insert( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'one'},{'val':2,'txt':'two'}])
        res = db.slurp( 't_test')
        print(res)
        print( 'Test %d passed\n' % testnum) if len( res) == 3 else  print( '############ Test %d failed' % testnum)

        # slurp_distinct
        testnum = 6
        db.runWriteQuery( 'delete from t_test;')
        db.insert( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'one'},{'val':2,'txt':'two'}])
        res = db.slurp_distinct( 't_test')
        print(res)
        print( 'Test %d passed\n' % testnum) if len( res) == 2 else  print( '############ Test %d failed' % testnum)

        # runReadQuery
        testnum = 7
        db.runWriteQuery( 'delete from t_test;')
        db.insert( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'uno'},{'val':2,'txt':'two'}])
        res = db.runReadQuery( 'select * from t_test where val = %s and txt = %s', [1, 'one'])
        print(res)
        print( 'Test %d passed\n' % testnum) if len( res) == 1 else  print( '############ Test %d failed' % testnum)

        # runReadQueryIter
        testnum = 8
        db.runWriteQuery( 'delete from t_test;')
        db.insert( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'uno'},{'val':2,'txt':'two'}])
        res = list( db.runReadQueryIter( 'select * from t_test where val = %s and txt = %s', [1, 'one']))
        print( res)
        print( 'Test %d passed\n' % testnum) if len(res) == 1 else  print( '############ Test %d failed' % testnum)

        # runReadQueryDict
        testnum = 9
        db.runWriteQuery( 'delete from t_test;')
        db.insert( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'uno'},{'val':2,'txt':'two'}])
        res = db.runReadQueryDict( 'select * from t_test where val = %s and txt = %s', [1, 'one'])
        print( res)
        print( 'Test %d passed\n' % testnum) if len(res) == 1 else  print( '############ Test %d failed' % testnum)

        # runReadQueryIterDict
        testnum = 10
        db.runWriteQuery( 'delete from t_test;')
        db.insert( 't_test', [{'val':1,'txt':'one'},{'val':1,'txt':'uno'},{'val':2,'txt':'two'}])
        res = list(db.runReadQueryDict( 'select * from t_test where val = %s and txt = %s', [1, 'one']))
        print( res)
        print( 'Test %d passed\n' % testnum) if len(res) == 1 else  print( '############ Test %d failed' % testnum)

        # setParm, getParm
        testnum = 11
        db.setParm( 'counter', 42) # int accepted, but strings are better
        res = db.getParm( 'counter') # always returns a string
        print( res)
        print( 'Test %d passed\n' % testnum) if res == '42' else  print( '############ Test %d failed' % testnum)

        # rmParm
        testnum = 12
        db.setParm( 'blub', '13')
        db.rmParm( 'blub')
        res = db.getParm( 'blub')
        print( 'Test %d passed\n' % testnum) if not res else  print( '############ Test %d failed' % testnum)

        # perr
        testnum = 13
        db.runWriteQuery( 'delete from t_log')
        db.perr( 'some error')
        res = db.runReadQuery( 'select * from t_log')
        print( res)
        print( 'Test %d passed\n' % testnum) if len(res) == 1 else  print( '############ Test %d failed' % testnum)

        # plog
        testnum = 14
        db.runWriteQuery( 'delete from t_log')
        db.plog( 'some log')
        res = db.runReadQuery( 'select * from t_log')
        print( res)
        print( 'Test %d passed\n' % testnum) if len(res) == 1 else  print( '############ Test %d failed' % testnum)

        # pstart
        testnum = 15
        db.runWriteQuery( 'delete from t_log')
        db.pstart()
        res = db.runReadQuery( 'select * from t_log')
        print( res)
        print( 'Test %d passed\n' % testnum) if len(res) == 1 else  print( '############ Test %d failed' % testnum)

        # pend
        testnum = 15
        db.runWriteQuery( 'delete from t_log')
        db.pend()
        res = db.runReadQuery( 'select * from t_log')
        print( res)
        print( 'Test %d passed\n' % testnum) if len(res) == 1 else  print( '############ Test %d failed' % testnum)

''' Utility funcs '''
'''---------------'''
def funcname():
    ''' Name of current function '''
    return inspect.stack()[1][3]

def parent_funcname():
    ''' Name of parent function '''
    return inspect.stack()[2][3]

def parent_filename():
    ''' File of parent function '''
    return os.path.basename( inspect.getsourcefile(sys._getframe(2)))

def chop(str):
    ''' Chop last char off a string '''
    return str[0:-1]

if __name__ == '__main__':
    Postgres.run_tests()
