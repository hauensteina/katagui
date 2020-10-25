
A front end to play against KataGo via a REST API, ready to deploy to Heroku.
================================================================================

Try it at https://katagui.herokuapp.com .

The REST API for the AI back end is at https://github.com/hauensteina/katago-server .

What exactly does this do
-----------------------------

KataGui has all the basic features of a complete Go Server, similar to OGS or some such, with the notable difference that you don't play other people. It is meant to help you study using KataGo, without the need for expensive hardware. You can watch other people and study and chat with them, or search for games via Sgf upload to catch people who use KataGui to cheat on another server.

The design goal is simplicity and ease of use on mobile devices. We want power without features.

You can use it from any device that has a web browser. Personally, I mostly use it from a tablet, which feels a lot like an intelligent Go board if you are using KataGui.

The technology behind KataGui is the usual mess: A Postgres database, Websockets and Redis, REST API calls, Javascript, Python, and an additional back end server running the AI, which is obviously written in C++. It runs on Heroku, and the instructions below should be sufficient to run it inside your own Heroku project, if you are persistent.

You will need a back end server running KataGo. There is a basic one at https://my-katago.herokuapp.com, with a 10 block network and 8 playouts. If you want to set up your own, follow the steps [here](https://github.com/hauensteina/katago-server). Look at the file `__init__.py` to see where the server URL is configured.


How to get KataGui to run on Heroku
--------------------------------------

Heroku is a platform which allows you to easily deploy a web app in a serverless, scalable way.
And best of all, if you do not have a lot of traffic, it is totally free.

The instructions below work on a Mac or in a Linux environment. If you are on Windows, it is probably easiest to just get yourself a [Ubuntu VM ](https://brb.nci.nih.gov/seqtools/installUbuntu.html).

Get a Heroku login at https://heroku.com .

Install the Heroku CLI. Instructions can be found [here](https://devcenter.heroku.com/articles/heroku-cli) .

Open a terminal window and log into Heroku:

```
$ heroku login -i
```

Create a new Heroku project with

```
$ mkdir my-katagui
$ cd my-katagui
$ git init
$ heroku apps:create my-katagui
```

You have to change the name `my-katagui` to something less generic to
avoid name collisions.

To get the code from github, let's add a second remote repo `github` to pull from:

`$ git remote add github https://github.com/hauensteina/katago-gui.git`

Then pull the code for the project to your local file system:

`$ git pull github master`

Make sure you are on python 3:

```
$ python --version
Python 3.7.1
```

Make a virtual environment to manage our package dependencies:

`$ python -m venv venv`

Activate the venv:

`$ source ./venv/bin/activate`

Install the postgres addon:

`$ heroku addons:create heroku-postgresql:hobby-dev`

Postgres is a relational database, which means it uses SQL as query language.
KataGui uses it to store users, logins, games, etc.
It is initially empty. Tables will automatically be created on app startup.

Install the Redis To Go addon:

`$ heroku addons:create redistogo:nano`

We use Redis channels to push messages to game observers when the game position changes.

Now that Postgres and Redis exist, we need to make sure we locally know how to access them in the cloud. The easiest way to set the necessary environment variables is to get their values from Heroku:

`$ heroku config > .env`

The format of that output is not quite what we need. Edit `.env` to look like this:

```
$ vi .env
# Use vi as best as you can
$ cat .env

export DATABASE_URL=postgres://epaotthtelivhp:e52af25836a477b22e3b418b870b688b8615aa5704225b6e7923f9fa5802fbe9@ec2-107-20-104-234.compute-1.amazonaws.com:5432/dcs3pjc3lov71m
export REDISTOGO_URL=redis://redistogo:d320d3e67a6c50998be36022a98c4185@scat.redistogo.com:10501/

```

Notice that .env has two lines only, and we had to insert the `export` keyword and the `=` assignments.
Make sure there are no spaces around the `=` .

Install the necessary python packages:

```
$ pip install --upgrade pip
$ pip install -r requirements.txt
```

Let's give it a spin locally:

```
$ source .env; ./venv/bin/gunicorn -k flask_sockets.worker heroku_app:app -w 1 -b 0.0.0.0:8000 --reload --timeout 1000 
[2020-10-23 14:40:23 -0700] [90807] [INFO] Starting gunicorn 19.9.0
[2020-10-23 14:40:23 -0700] [90807] [INFO] Listening at: http://0.0.0.0:8000 (90807)
[2020-10-23 14:40:23 -0700] [90807] [INFO] Using worker: flask_sockets.worker
[2020-10-23 14:40:23 -0700] [90810] [INFO] Booting worker with pid: 90810
```

Open a browser, type `http://127.0.0.1:8000` in the address bar.

With any luck, you will see a Go board. Now if you click play, you will hopefully get a move out of the
demo KataGo server at https://my-katago-server.herokuapp.com, which is described
[here](https://github.com/hauensteina/katago-server).

Now show it to the world:

```
$ git add -u
$ git commit -m 'push to heroku'
$ git push heroku master
$ heroku logs -t --app my-katagui
...
2020-10-23T22:37:13.762732+00:00 heroku[web.1]: State changed from starting to up
2020-10-23T22:37:18.000000+00:00 app[api]: Build succeeded
```

Point your browser at `https://my-katagui.herokuapp.com`.


Most things will work, except anything requiring email, like registering non-guest accounts.
If you have a working SMTP account somewhere other than gmail (they will block login attempts by flask_mail),
you can set the environment variables KATAGUI_EMAIL_USER and KATAGUI_EMAIL_PASS in the my-katagui Heroku project
to make user registration work, too.

If you got here, congratulations. Drop me a note at hauensteina@gmail.com.

=== The End ===
