
web: gunicorn -k flask_sockets.worker heroku_app:app -w 1 --limit-request-line 8000 --error-logfile - --log-file - --capture-output


