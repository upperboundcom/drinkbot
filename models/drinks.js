/*
	MongoDB Drink schema
*/

function make(Schema, mongoose) {
	drinkSchema = new Schema({
		name: String,
		ingredients: [{
			pumpName: String,
			ingredientName: String,
			delayMS: Number,
			amountOz: Number
		}]	
	});
	
	return mongoose.model('Drink',drinkSchema, 'drinks');
}
module.exports.make = make;
