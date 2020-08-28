
delete from t_user where username like 'guest_%' and extract(epoch from now() - ts_last_seen)/3600  > 24;


