# Drinkbot: A Raspberry Pi-powered Robotic Bartender

This is the nodejs code for the Rasperry Pi-based robotic bartender (which I call drinkbot) described at:

http://upperbound.com/projects/drinkbot/

There are a few other dependencies:

* [MongoDB](http://mongodb.com) (for data storage)
* [pico2wave](http://my-small-projects.blogspot.com/2016/01/raspberry-pi-text-to-speech-pico2wave.html) (for text-to-speech synthesis)
* [mpg123](https://www.mpg123.de/) (for playing MP3 audio files)

## To start the application

Change to the folder where you downloaded the files.

Start the backend:

```
$ sudo node backend.js &
```

Start the web front-end:

```
$ cd frontend
$ node server.js &
```

If you want to start it at boot, you can do the following:
1. Install [forever](https://github.com/foreverjs/forever):

```
$ sudo npm install -g forever
```


2. Add this to your crontab (your paths may be different):

Run:

```
$ crontab -e
```

and then add:

```
@reboot export NODE_PATH=/usr/lib/nodejs:/usr/lib/node_modules:/usr/share/javascript && sudo -E /usr/bin/forever start -o /home/pi/projects/nodeapps/drinkbot/backend.log -e /home/pi/projects/nodeapps/drinkbot/backend.err /home/pi/projects/nodeapps/drinkbot/backend.js
@reboot export NODE_PATH=/usr/lib/nodejs:/usr/lib/node_modules:/usr/share/javascript &&  /usr/bin/forever start -o /home/pi/projects/nodeapps/drinkbot/frontend/server.log -e /home/pi/projects/nodeapps/drinkbot/frontend/server.err /home/pi/projects/nodeapps/drinkbot/frontend/server.js
```

## To do:

* Make some hardcoded values config options
* Move config options to a separate .json file





