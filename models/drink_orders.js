/*
	MongoDB Drink schema
*/

function make(Schema, mongoose) {
	drinkOrderSchema = new Schema({

		drinkId: String,
		drinkName: String,
		status: String,
		createTimestamp: {type: Date, default:Date.now}

	});
	return mongoose.model('drink_orders', drinkOrderSchema);
	
}
module.exports.make = make;