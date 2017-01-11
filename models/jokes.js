/*
	MongoDB Joke schema
*/

function make(Schema, mongoose) {
	JokeSchema = new Schema({

		joke: String
	
	});
	return mongoose.model('jokes', ingredientSchema);
	
}
module.exports.make = make;
