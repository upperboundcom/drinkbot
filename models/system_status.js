/*
	MongoDB System Status schema
*/

function make(Schema, mongoose) {
	systemStatusSchema = new Schema({

		id: Number,
		mode: String,
		status: String,
		message: String,
        twiki_mode: Boolean,
        tts_lang: String,
        tell_jokes: Boolean,
        joke_interval_sec: Number

	});
	return mongoose.model('SystemStatus', systemStatusSchema, 'system_status' );
	
}
module.exports.make = make;
