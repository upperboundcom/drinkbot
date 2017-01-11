/*
    drinkbot hardware control module
*/

var gpio = require ("onoff").Gpio;
var pico = require('picotts');
var exec = require('child_process').exec;
var events = require('events');
var util = require('util');


Drinkbot = function() {
    var self = this;
    
    var readyIndicatorLED = new gpio(27,'out'); // Green LED
    var needCupIndicatorLED = new gpio (17, 'out'); // Yellow LED
    var pumpingIndicatorLED = new gpio(22,'out'); // Red LED
    var maintenanceModeIndicatorLED = new gpio(4,'out'); // White LED

    // internal intervals for blinking indicators

    var readyIndicatorInterval;
    var needCupIndicatorInterval;
    var pumpingIndicatorInterval;
    var maintenanceModeIndicatorInterval;
    var cupSwitch, shutdownButton;


    self.twikiMode = false;
    self.ttsLanguage = 'en-GB';
    self.tell_jokes = false;
    self.joke_interval_sec=20;
    self.pumps = {};
    self.is_pumping = false;
    self.num_pumps_running =0;
    

    // sets up the shutdown button

    self.setupShutdownButton = function(pin) {

        self.shutdownButton = new gpio(pin, 'in', 'both', {debounceTimeout:90});

        self.shutdownButton.watch(function (err, value) {
            console.log("shutdown button value is "+value);
            if (err) {
                throw err;
            }
            if (value ==1) {
                self.emit("shutdownButtonDown");
            }
            
        });

    }

    // Sets up the cup switch
    self.setupCupSwitch = function(pin) {

        self.cupSwitch = new gpio(pin, 'in','both', {debounceTimeout:90});
        self.cupSwitch.watch(function (err, val) {
            
            console.log('cupswitch value is '+val);
            if (err) {
                throw err;
            }
            if (val == 0) {
                self.emit("cupSwitchDown");
            }
            else {
                self.emit("cupSwitchUp");
            }

        });

    }
    // plays a file
    self.playFile = function(file, callback) {

        exec('mpg123 '+file, callback);
    }

    // Sets up the pump pins

    self.setupPumps = function(pumps) {

        var self = this;

        for (var key in pumps) {
            self.pumps[key] = new gpio(pumps[key].pin, 'out');

        }
    }


    self.cleanup = function() {

        self.stopReadyLED();
        self.stopNeedCupLED();
        self.stopPumpingLED();
        self.stopMaintenanceModeLED();
        self.shutdownButton.unexport();
        self.cupSwitch.unexport();
        self.cupSwitch.unwatchAll();
    }

    // Starts a pump

    self.startPump = function(pumpName) {

        self.pumps[pumpName].writeSync(1);
        self.num_pumps_running++;
        self.is_pumping = true;

    }

    // Stops a pump

    self.stopPump = function(pumpName) {

        // check if it's actually running first before decrementing counters
        if (self.pumps[pumpName].readSync() ==1) {
			self.num_pumps_running--;
			self.pumps[pumpName].writeSync(0);
		}
        if (self.num_pumps_running== 0 ) {
				self.is_pumping = false;
		}
		
    }

    // stops all pumps

    self.stopAllPumps = function() {

        self.num_pumps_running = 0;
        self.is_pumping = false;
    }

    // turns on the ready LED
    self.readyLEDOn = function() {
        readyIndicatorLED.writeSync(1);
    }

    self.needCupLEDOn = function () {

        needCupIndicatorLED.writeSync(1);
    }

    self.pumpingLEDOn = function () {

        pumpingIndicatorLED.writeSync(1);
    }

    self.maintenanceModeLEDOn = function() {
        maintenanceModeIndicatorLED.writeSync(1);
    }

    // turns on and off each indicator LED with delay MS between each
    self.cycleLEDs  = function(delay, callback) {
        self.readyLEDOn();

        setTimeout(function() {
            self.stopReadyLED();

            self.needCupLEDOn();

            setTimeout(function() {
                self.stopNeedCupLED();
                self.pumpingLEDOn();

                setTimeout(function() {

                    self.stopPumpingLED();
                    self.maintenanceModeLEDOn();

                    setTimeout(function() {

                        self.stopMaintenanceModeLED();
                        if (callback != null) {
                            callback();
                        }
                    }, delay);

               }, delay);
            }, delay);
        }, delay);

    }

    // Blinks the ready LED with delay MS between on and off
    self.blinkReadyLED = function(delay) {

        readyIndicatorInterval = setInterval(function() {
                 readyIndicatorLED.writeSync(readyIndicatorLED.readSync() ^ 1);
        }, delay);
    }

    // stops blinking the ready LED

    self.stopReadyLED = function() {

        clearInterval(readyIndicatorInterval);
        readyIndicatorLED.writeSync(0);
    }

    // stops blinking the need cup LED

    self.stopNeedCupLED = function() {

        clearInterval(needCupIndicatorInterval);
        needCupIndicatorLED.writeSync(0);
    }

    // Blinks the need A cup LED with delay MS between on and off
    self.blinkNeedCupLED = function(delay) {

        needCupIndicatorInterval = setInterval(function() {
                needCupIndicatorLED.writeSync(needCupIndicatorLED.readSync() ^ 1);
        }, delay);
    };

    // blinks the pumping indicator LED
    self.blinkPumpingLED = function(delay) {

        pumpingIndicatorInterval = setInterval(function() {
                pumpingIndicatorLED.writeSync(pumpingIndicatorLED.readSync() ^ 1);
        }, delay);
    }

// stops blinking the pumping LED
    self.stopPumpingLED = function() {

        clearInterval(pumpingIndicatorInterval);
        pumpingIndicatorLED.writeSync(0);
    };

    self.blinkMaintenanceModeLED = function(delay) {

        maintenanceModeIndicatorInterval = setInterval(function() {
                maintenanceModeIndicatorLED.writeSync(maintenanceModeIndicatorLED.readSync() ^ 1);
        }, delay);
    }

    self.stopMaintenanceModeLED = function() {

        clearInterval(maintenanceModeIndicatorInterval);
        maintenanceModeIndicatorLED.writeSync(0);
    }


    // text to speech
    self.say = function(text, callback) {

        if (self.twikiMode == true) {
            self.playFile("/home/pi/projects/nodeapps/drinkbot/audio/twiki.mp3", function() {
                    pico.say(text, self.ttsLanguage, callback);
                });
        }
        else {

            pico.say(text, self.ttsLanguage, callback);
        }
    }


}

util.inherits(Drinkbot, events.EventEmitter);
module.exports = Drinkbot;



// Internal counter for the number of pumps running
var numPumpsRunning =0;

