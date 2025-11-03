
web: gunicorn -k flask_sockets.worker heroku_app:app --workers 2 --threads 2  --limit-request-line 8000 --max-requests 1000 --max-requests-jitter 200




