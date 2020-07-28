
delete from t_user where username like 'guest_%' and extract(hour from now() - ts_last_seen)  > 24;
