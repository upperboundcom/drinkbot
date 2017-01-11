/*
	MongoDB Ingredient schema
*/

function make(Schema, mongoose) {
	ingredientSchema = new Schema({

		pumpName: String,
		ingredientName: String,
		status: String,
		command: String,
		specific_gravity: Number
	});
	return mongoose.model('ingredients', ingredientSchema);
	
}
module.exports.make = make;
