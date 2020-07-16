
-- Create postgres tables for katagui back end
-- Execute with:
-- $ heroku pg:psql postgresql-clean-51283 --app katagui -f create_db.sql
-- AHN, Jul 2020

-- A trivial test table
drop table if exists test cascade;
create table test (
  id     bigserial not null primary key
  ,text  text
);

-- insert some test rows
insert into test(text) values('one');
insert into test(text) values('two');
insert into test(text) values('three');

-- User table
drop table if exists t_user cascade;
create table t_user (
  id bigserial not null primary key
  ,email text
  ,password text
  ,fname text
  ,lname text
  ,json text
);
insert into t_user( email, password, fname, lname, json)
values( 'test@test.com', 'welcome', 'First', 'Last', '{"notes":"test"}');

drop table if exists t_log cascade;
create table t_log (
  id     bigserial not null primary key
  ,level varchar(20)
  ,dtime timestamp
  ,msg   varchar(1000)
);

drop table if exists t_parameters cascade;
create table t_parameters (
  name    varchar(30) not null
  ,value  varchar(1000) default null
);

-- table instead of a file system for heroku
drop table if exists t_textfiles cascade;
create table t_textfiles (
  id        bigserial not null primary key
  ,filename varchar(100)
  ,contents text
);
alter table t_textfiles add constraint uniq_filename unique(filename);

-- endpoint hits with timestamps for performance monitoring
drop table if exists t_endpoint_hits cascade;
create table t_endpoint_hits (
  id        bigserial not null primary key
  ,endpoint varchar(1000)
  ,tstart   timestamp
  ,tend     timestamp
  ,duration double precision
);
create index idx_ep on t_endpoint_hits(tstart);
