var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Drink = require('../../models/drinks.js').make(Schema, mongoose);
var DrinkOrder = require('../../models/drink_orders.js').make(Schema, mongoose);
var Ingredient = require('../../models/ingredients.js').make(Schema, mongoose);
var SystemStatus = require('../../models/system_status.js').make(Schema, mongoose);


function getDrinks(res){
	Drink.find().sort({name:1}).exec(function(err, drinks) {
	// if there is an error retrieving, send the error. nothing after res.send(err) will execute
		if (err)
			res.send(err)
		res.json(drinks); // return all todos in JSON format
	});
};

function getDrinkOrders(res) {

	DrinkOrder.find().sort({createTimestamp:-1}).exec(function(err, orders) {
		if (err) {
			res.send(err);
		}
		res.json(orders);
	});
}

function getIngredients(res) {
	Ingredient.find().sort({pumpName:1}).exec(function(err, ingredients) {

		if (err) {
			res.send(err);
	
		}
		res.json(ingredients);
	});
	
}

function clearDrinkOrders(res) {

	DrinkOrder.remove(function (err, removed) {
		if (err) {
			res.send(err);
		}
		else {
			console.log(removed + " records removed.");	
			getDrinkOrders(res);

		}
	});

}

function getSystemStatus(res) {
	

	SystemStatus.findOne({id:1},function(err, systemStatus) {
		if(err) {
			res.send(err);
		}
		res.json(systemStatus);
	});

}

module.exports = function(app) {

	// get all drinks
	app.get('/api/Drinks', function(req, res) {
		// use mongoose to get all drinks in the database
		getDrinks(res);
	
	});

	// get drink orders

	app.get('/api/DrinkOrders', function(req, res) {

		getDrinkOrders(res);
	});
	// create order
	app.post('/api/DrinkOrder', function(req,res) {
		console.log(req);
		DrinkOrder.create({
			drinkId: req.body._id,
			drinkName: req.body.name,
			status: "New"
		}, function(err, order) {
			if (err) {
				res.send(err);
			}
			getDrinkOrders(res);
		});
	});

	
	// gets ingredients
	app.get('/api/Ingredients', function(req, res) {

		getIngredients(res);
	});

	app.post('/api/Drink',function (req,res) {

		console.log(req);
		// call Drink.create
                Drink.create({
			name: req.body.name,
			ingredients: req.body.ingredients
		}, function (err) {
			if (err) {
				res.send(err);
			}
			res.end();
		});
	});

	// update a drink

	app.put('/api/Drink/:_id',function (req, res) {

		Drink.findById(req.params._id,function (err, drink) {

			drink.name = req.body.name;
			drink.ingredients = req.body.ingredients;

			drink.save(getDrinks(res));
		});

	});
	// Gets System status

	app.get('/api/SystemStatus', function(req, res) {

		getSystemStatus(res);

	});

	
	// update the system status
	app.put('/api/SystemStatus',function(req,res) {

		SystemStatus.findOne({id:1}, function(err, systemStatus) {

			systemStatus.mode= req.body.mode;
			systemStatus.message= req.body.message;
			systemStatus.twiki_mode = req.body.twiki_mode;
			systemStatus.tts_lang = req.body.tts_lang;
			systemStatus.tell_jokes = req.body.tell_jokes;
			systemStatus.joke_interval_sec = req.body.joke_interval_sec;
            systemStatus.save();
			return res.send(systemStatus);
		});
		console.log(res);
		
	});

	// delete a drink

	app.delete('/api/Drink/:_id', function (req,res) {


		Drink.findByIdAndRemove(req.params._id, function(err, drink) {
			
			if (err) {
				res.json(err);
			}
			else {
				res.end()
			}

		});


	});

	// clears drink orders

	app.delete('/api/DrinkOrders/clear', function (req, res) {

		clearDrinkOrders(res);
	});

	//update an ingredient ..mainly for toggling individual start/stop pump commands

	app.put('/api/Ingredient/:pumpName', function(req, res) {

		Ingredient.findOne({pumpName: req.params.pumpName}, function(err, ingredient) {
			if (ingredient.command=="Start") {
				ingredient.command="Stop";
			}

			else {
				ingredient.command="Start";
			}
			ingredient.save();
			return res.send(ingredient);
		});
	});
	// application -------------------------------------------------------------
	app.get('*', function(req, res) {
		res.sendfile('./public/index.html'); // load the single view file (angular will handle the page changes on the front-end)
	});
}
