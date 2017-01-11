/* 
    Back-end for the drinkot
*/

var events = require("events");
var eventEmitter  = new events.EventEmitter();
var exec = require("child_process").exec;
var os = require('os');


var networkInterfaces = os.networkInterfaces();
var Drinkbot = require("./modules/drinkbot.js");

var drinkbot = new Drinkbot();

// Audio stuff

var soundFilePath = "/home/pi/projects/nodeapps/drinkbot/audio/";


var pumps  =    {   'pump0':
                        {'pin':24},
                    'pump1':
                        {'pin':23},
                    'pump2':
                        {'pin':25},
                    'pump3':
                        {'pin':12},
                    'pump4':
                        {'pin':18},
                    'pump5':
                        {'pin':26}
                };

drinkbot.setupPumps(pumps);
drinkbot.setupCupSwitch(13);
drinkbot.setupShutdownButton(21);


drinkbot.on("cupSwitchUp", missingCup);
drinkbot.on("cupSwitchDown", gotCup);

drinkbot.on("shutdownButtonDown", shutdownPressed);

eventEmitter.on("setReady", setReady);
eventEmitter.on("foundOrder", makeDrink);
eventEmitter.on("makeDrinkDone",drinkFinished); 
eventEmitter.on("drinkAborted", abortDrink);
eventEmitter.on("maintenanceModeOn", turnOnMaintMode);
eventEmitter.on("maintenanceModeOff", turnOffMaintMode);

var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/drinkbot');

var db = mongoose.connection;

var Schema =mongoose.Schema;
var Drink = require ('./models/drinks.js').make(Schema,mongoose);
var DrinkOrder = require ('./models/drink_orders.js').make(Schema,mongoose);
var Ingredient = require ('./models/ingredients.js').make(Schema,mongoose);
var SystemStatus = require ('./models/system_status.js').make(Schema,mongoose);

var Joke = require('./models/jokes.js').make(Schema, mongoose);


db.on('error',console.error.bind(console,'connection error'));


/// Constants

const secsPerOunce = 20;
// System states

const INIT = 0;
const MAKING_DRINK = 1;
const RUNNING_PUMP = 2;
const POLLING_ORDERS = 3;
const DRINK_ABORTED = 4;
const WAITING_FOR_CUP = 5;
const PENDING_SHUTDOWN = 6;
const IDLE = 7;

// current state variables

var currentState = INIT;
var currentOrder;
var numPumpsRunning = 0; // Number of pumps how running.
var pumpTimeouts = [];

// Polling
var orderPollInterval;
var orderPollIntervalSec = 3; // Polling interval time in seconds
var togglePumpsCheckIntervalSec = 3; // Polling for toggling individual pumps on demand

// system status 
var systemStatusInterval;
var togglePumpsInterval;
var previousSystemStatus, systemStatus;
var boredInterval, maintenanceModeIndicatorInterval, jokeInterval;

var systemStatusCheckIntervalSec = 1000; // ms to check the system status
var pendingShutdownTimeout = 10000; // ms to stay in shutdown pending mode

// Maint mode
var togglePumpsCheckIntervalSec = 1000; // ms to check pump statuses when in maintenance mode


db.once("open", function(callback) {

    refreshSettings(function() {
		startup();
	});
    console.log("Connected to database");
    clearOrders();
    function clearOrders() {

        console.log("Clearing orders marked as New or Making");

        DrinkOrder.remove({ $or: [ {status:"New"}, {status:"Making"} ]   }, function(err) {
            if (err) {
                console.log(err);
            }
        });

    }
	
});



function getJoke(callback) {
	Joke.count().exec(function(err, count) {
			
			var random = Math.floor(Math.random() * count);
			
			Joke.findOne().skip(random).exec(function(err, result) {

				result = result.toObject();
				console.log("joke: "+result.joke);
				callback(result.joke);
			});
		
		});
	
}

function setJokeInterval() {

	jokeInterval = setInterval(function() {
		getJoke(function(joke) {
			drinkbot.say(joke);	
		});
		
	}, drinkbot.joke_interval_sec*1000);
}


function refreshSettings(callback) {
	SystemStatus.findOne({id:1}, function(err, systemStatus) {

		drinkbot.twikiMode = systemStatus.twiki_mode;
		drinkbot.ttsLanguage = systemStatus.tts_lang;
		drinkbot.joke_interval_sec = systemStatus.joke_interval_sec;
		drinkbot.tell_jokes = systemStatus.tell_jokes;
		
		if (callback!=null) {
			callback();
		}
	});
}

function startup() {
    

	
    drinkbot.cycleLEDs(200, function() {
        resetSystemStatus(function() {
        if (drinkbot.cupSwitch.readSync() == 0) {
             eventEmitter.emit("setReady");
         }

        else {
            drinkbot.emit("cupSwitchUp");

        }

            drinkbot.playFile(soundFilePath+'allsystemsgo.mp3', function (error, stdout, stderr) {
                if (error != null) {
                    console.log(error);
                }
                var ip = networkInterfaces['wlan0'][0]['address'];
                console.log('IP address is '+ip);
                drinkbot.say ('My IP address is '+ip + ".  Again, that is "+ip, function() {
					
					    if (drinkbot.tell_jokes == true ) {
								setJokeInterval();
						}
						
					    systemStatusInterval = setInterval(checkSystemStatus,systemStatusCheckIntervalSec );
					    
					
				});
            
             });

        });

    });
}

// Fires when an order is found

function makeDrink(drink,order) {

    currentState = MAKING_DRINK;
    clearInterval(orderPollInterval);
    
    clearInterval(boredInterval);

	clearJokeInterval();
    drinkbot.stopReadyLED();
    drinkbot.blinkPumpingLED(200);
    
    var txt = "Now making a "+order.drinkName;

    console.log(txt);
    drinkbot.say (txt);
    currentOrder = order;
    order.status = "Making";

    order.save();

    SystemStatus.findOne({id:1}, function(err, systemStatus) {
        systemStatus.status="Pumping";
        systemStatus.message = "Making a "+order.drinkName;
        systemStatus.save();

    });

    numPumpsRunning = drink.ingredients.length; // Because # of ingredients = number of pumps
    console.log(drink);

    //iterate through ingredient objects and activate the pumps
    var ingredients = drink.ingredients;

    for (var i=0;i<numPumpsRunning;i++) {

        var pump = {};
        pump.pumpName = ingredients[i].pumpName;
        pump.ingredientName = ingredients[i].ingredientName;
        console.log("Found "+ingredients[i].ingredientName);
        var durationMS = ingredients[i].amountOz * 1000 * secsPerOunce;

        console.log("Will pump for "+durationMS+" ms to give "+ingredients[i].amountOz+" oz");
        pumpMS(pump,ingredients[i].delayMS,durationMS,order); // activate the pump
     }
    
}

// fires when the shutdown button is pressed.

function shutdownPressed() {

    if (currentState != PENDING_SHUTDOWN) {
        var secs =  pendingShutdownTimeout / 1000;
        drinkbot.say("Press again within "+secs+" seconds to confirm shutdown");
        iv = setInterval(function() {

            drinkbot.cycleLEDs(100);
        },400);

        currentState = PENDING_SHUTDOWN;
        to = setTimeout(function () {

            drinkbot.say("Shutdown is cancelled"); 
            resetSystemStatus();
            clearInterval(iv);
        },pendingShutdownTimeout);
    }

    else {
        clearInterval(iv);
        clearInterval(jokeInterval);
        clearTimeout(to);
        drinkbot.playFile(soundFilePath+'goingdown.mp3', function() {
            drinkbot.cleanup();
            console.log('Shutting down');
            exec("shutdown -h now");
            
        });


    }
}

// Fires when a drink order is aborted

function abortDrink() {

    var txt = "Where did the cup go? " +currentOrder.drinkName + " aborted.";

    console.log(txt);
    drinkbot.say (txt);
    currentOrder.status = "Aborted";
    currentState=WAITING_FOR_CUP;

    drinkbot.stopPumpingLED();

    currentOrder.save();
    stopAllPumps();
    
    
    drinkbot.emit("cupSwitchUp");
}


function startPump(pump) {

    console.log("Starting pump "+pump.ingredientName);
    clearJokeInterval();
    
    drinkbot.startPump(pump.pumpName);
    // find the ingredient for this pump and update the status
    Ingredient.findOne({ingredientName: pump.ingredientName}, function(err, ingredient) {
        ingredient.status="Pumping";
        ingredient.save();
    });

}

function stopPump(pump) {

    console.log("Stopping pump "+pump.ingredientName);

    drinkbot.stopPump(pump.pumpName);
    // find the ingredient for this pump and update the status
    
    Ingredient.findOne({ingredientName: pump.ingredientName}, function(err, ingredient) {
        ingredient.status="Idle";
        ingredient.save();
    });

}

// Fires when a drink is done being made

function drinkFinished() {

    drinkbot.stopPumpingLED();

    var txt = "Finished making a "+currentOrder.drinkName + ". Please replace the cup.";

    console.log(txt);
    
    drinkbot.say(txt, function() {
        drinkbot.playFile(soundFilePath+'wantsomemore.mp3', function (error, stdout, stderr) {

			
            if (error != null) {
				console.log(error);
            }
        });
    });
    
    
    currentOrder.status="Done";
    currentOrder.save();
    currentState = WAITING_FOR_CUP;
    drinkbot.emit("cupSwitchUp"); // Since we need to replace the cup after a drink is done.

    numPumpsRunning = 0;  
   

}


// Searches for an order
function findOrder() {
    console.log("Looking for orders...");


    DrinkOrder.findOne({status: "New"}).sort({createTimestamp: 1}).limit(1).exec(function(err, order) {
    
    if (err) {
        console.log("Error: "+err);
    }
    if (order == null) {
        console.log("Nothing yet...");
        return;
    }
    else {
        console.log("Got an order for "+order);

        Drink.findOne({_id: order.drinkId}, function(err, drink) {
            if (err) {
                console.log(err);
            }
            if (drink != null) {

                clearInterval(orderPollInterval); // Dont look for orders while we are making a drink
                    eventEmitter.emit("foundOrder", drink,order);
            }

        });
    }
   });
}


function setReady() {
    console.log("Ready!");
    drinkbot.readyLEDOn();
    
    // Sets up order polling
    clearInterval(orderPollInterval);
    clearInterval(togglePumpsInterval);

     // Start polling again for either drinks or maintenance pump requests
     SystemStatus.findOne({id:1}, function(err, systemStatus) {
        systemStatus.status="Idle";
        switch (systemStatus.mode) {

            case 'drinks':
               currentState = POLLING_ORDERS;

               orderPollInterval = setInterval(findOrder,orderPollIntervalSec*1000);
               systemStatus.message = "Waiting for drink orders";
               break;
            case 'maintenance':
            
                togglePumpsInterval = setInterval(togglePumps, 3000);//togglePumpsCheckIntervalSec*1000);
                systemStatus.message = "In maintenance mode.";
                break;
            default:
                console.log("Not sure what to do now..."); // oh crap

        }
        systemStatus.save();

    });


    clearInterval(boredInterval);

    boredInterval = setInterval(function() {
                        drinkbot.say ("Will someone order a drink? I'm getting bored here.", function() {
                                
							drinkbot.playFile(soundFilePath+"20secondstocomply.mp3", function() {
								setTimeout(function() {
									drinkbot.say("Ha ha just kidding");
                                        }, 17000);
                                });
                                
                            })
                    }
                    , 240000);
    
}


function gotCup() {
    drinkbot.stopNeedCupLED();
    console.log("Got a cup!")
    eventEmitter.emit("setReady");
}

function missingCup() {
    clearInterval(boredInterval);
    if (currentState === MAKING_DRINK) {
        eventEmitter.emit("drinkAborted");
    }
    else if (currentState === RUNNING_PUMP) {
        stopAllPumps();
    }
    else {

        currentState=WAITING_FOR_CUP;
        

    }
	var conditions = {id:1}
	, update  = {$set: {status: 'Replace the cup', message: 'Please replace the cup'}}
	, options= {multi:true};


	SystemStatus.update(conditions, update, options, function (err, num) {
		
		if (err) {
			console.log(err);
		}

		
	});
    drinkbot.stopReadyLED();

    drinkbot.stopNeedCupLED()  // Ensure we don't set up more of these than we need
    clearInterval(orderPollInterval);
    console.log("Replace the cup");
    drinkbot.blinkNeedCupLED(200);
    
}


process.on('SIGINT', stopBackend);
process.on('SIGTERM', stopBackend);

function stopBackend() {

    clearInterval(orderPollInterval);
	clearJokeInterval();
    drinkbot.say ("The backend was stopped.", function() {
        drinkbot.cleanup();
        process.exit();
    
    });

}

// Pumps on given pump for some durationMS ms with a delay of delayMS
function pumpMS(pump,delayMS, durationMS,order) {
    console.log("pump:" + JSON.stringify(pump));

    console.log("Delaying pump "+pump.ingredientName+" for "+delayMS+" ms");

    console.log("Pumps running: "+numPumpsRunning);
            
    pumpTimeouts.push(setTimeout(function() {
    
    console.log("Pumping on "+pump.ingredientName +"("+pump.pumpName+") for "+durationMS+" ms");
    startPump(pump);
    
    pumpTimeouts.push(setTimeout(function () {
        stopPump(pump);
        numPumpsRunning--;
        console.log("Pumps running: "+numPumpsRunning);
        if (numPumpsRunning == 0) {
            eventEmitter.emit("makeDrinkDone",order);
        }
    }
                ,durationMS));
            },delayMS));
}


// Stops all pumps

function stopAllPumps(callback) {

    var text = "Stopping all pumps.";
    console.log(text);

    // Clear any pumping timeouts

    for (var i=0; i<pumpTimeouts.length; i++) {
        clearTimeout(pumpTimeouts[i]);
    }
    pumpTimeouts = [];

    
    Ingredient.find({}, function(err, ingredients) {
        for (var i = 0 ; i<ingredients.length; i++) {
            //var pump = getPump(ingredients[i].pumpName);
            var pump = {};
            pump.pumpName = ingredients[i].pumpName;
            pump.ingredientName=ingredients[i].ingredientName;

            stopPump(pump);
        }
        if (callback != null) {
            callback();
        }

     });
	currentState = IDLE;
    numPumpsRunning = 0;
}



function turnOnMaintMode() {


    var txt = "Maintenance mode is on. Please replace the cup.";
    
    drinkbot.blinkMaintenanceModeLED(200);    

    refreshSettings( function() {
		drinkbot.say (txt);
	});
    console.log(txt);
    clearInterval(orderPollInterval);
    clearInterval(boredInterval);
	

    SystemStatus.update({id:1}, {$set: {status:'Idle', mode :'maintenance', message:'In maintenance mode'}},{multi:true}, function(err, num) {
		drinkbot.emit("cupSwitchUp"); // because the cup should be replaced
	});
    
}


function turnOffMaintMode() {

    var txt = "Maintenance mode is off. Please replace the cup.";
    console.log(txt);
    clearInterval(togglePumpsInterval);
    drinkbot.say(txt);
    resetSystemStatus();
    stopAllPumps();
    drinkbot.emit("cupSwitchUp");
    
    drinkbot.stopMaintenanceModeLED();
    
}

function clearJokeInterval(){

		clearTimeout(jokeInterval);
		jokeInterval = null;
}

// Polls the system status and emits an event if the status changes

function checkSystemStatus() {

    SystemStatus.findOne({id:1}, function(err, systemStatus) {

        drinkbot.joke_interval_sec = systemStatus.joke_interval_sec;
		drinkbot.tell_jokes = systemStatus.tell_jokes;
		
		if (drinkbot.tell_jokes == true) {
		
			if (drinkbot.is_pumping==false ) {
				
				if (jokeInterval == null) {
						setJokeInterval();
						console.log("i will tell jokes now!");
				}
				
			}
			else {
				clearJokeInterval();
				console.log("i will NOT tell jokes");
			}
			
		}
		else {
			clearJokeInterval();
		}
		
        if (previousSystemStatus.twiki_mode != systemStatus.twiki_mode) {
			
			
			refreshSettings(function() {
				if (drinkbot.twikiMode) {
					drinkbot.say("Tweekee mode is on");
				}
				else {
					drinkbot.say("Tweekee mode is off");
				}
				
				
			});
		}
		if (previousSystemStatus.tts_lang != systemStatus.tts_lang) {
			
			
			refreshSettings(function() {
				drinkbot.say("Text to speech voice updated");
			});
		}
        if (previousSystemStatus.mode != systemStatus.mode) {

            switch(systemStatus.mode) {

                case 'drinks':
                    eventEmitter.emit("maintenanceModeOff");
                    break;
              case 'maintenance':
                    eventEmitter.emit("maintenanceModeOn");
                    break;
                default:
                    console.log("unknown mode: "+systemStatus.mode);
                    break;
            }
           
        }
		
		if (previousSystemStatus.tell_jokes != systemStatus.tell_jokes) {
		
			switch (systemStatus.tell_jokes) {
			
				case true:
					drinkbot.say("I'll tell jokes every "+ systemStatus.joke_interval_sec +' seconds', function() {
						
					});
					break;
				case false:
					drinkbot.say("I'll stop telling jokes");
					clearJokeInterval();
					break;
			}
			
		}

		if (previousSystemStatus.joke_interval_sec != systemStatus.joke_interval_sec) {
			
				clearJokeInterval(); // so it gets reset on next interval
		}
		
		previousSystemStatus = systemStatus;
    });
}


// Resets the global system status indicators
function resetSystemStatus(callback) {

    currentState = IDLE;
    SystemStatus.findOne({id:1}, function(err, systemStatus) {
        console.log("Resetting global system status messages");
        systemStatus.status="Idle";
        systemStatus.mode="drinks";
        systemStatus.message = "Waiting for drink orders";
        systemStatus.twiki_mode  = drinkbot.twikiMode;
        systemStatus.tts_lang = drinkbot.ttsLanguage;
        systemStatus.tell_jokes = drinkbot.tell_jokes;
        systemStatus.joke_interval_sec = drinkbot.joke_interval_sec;
        systemStatus.save();

        previousSystemStatus = systemStatus;
        console.log("Resetting pump statuses");
        Ingredient.find({}, function(err, ingredients) {

            for (var i=0; i<ingredients.length; i++ ) {
                ingredients[i].status="Idle";
                ingredients[i].command="Stop";
                ingredients[i].save();
            }
            if (callback!=null) {
               callback();
            }
        });
    });
}

// toggles pumps on and off depending on their status. For use with maintenance mode

function togglePumps() {
    console.log("Checking pump statuses, toggling on or off");
    Ingredient.find({}, function(err, ingredients) {

        for (var i = 0; i<ingredients.length; i++) {
            //var pump = getPump(ingredients[i].pumpName);
            var pump = {};
            pump.pumpName = ingredients[i].pumpName;
            pump.ingredientName = ingredients[i].ingredientName;
            
            if (ingredients[i].status=="Idle" && ingredients[i].command == "Start") {

                startPump(pump);
                drinkbot.say ("Pumping "+ingredients[i].ingredientName+" on "+ingredients[i].pumpName);
            }

            if (ingredients[i].status=="Pumping" && ingredients[i].command == "Stop") {

               stopPump(pump);
                drinkbot.say ("Stopping "+ingredients[i].ingredientName+" on "+ingredients[i].pumpName);

            }
        }
    });
}

