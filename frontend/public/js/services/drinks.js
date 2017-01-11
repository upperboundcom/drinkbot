angular.module('drinkService', [])

	// super simple service
	// each function returns a promise object 
	.factory('Drinks', ['$http',function($http) {
		return {
			get : function() {
				return $http.get('/api/Drinks');
			},
			create : function(drinkData) {
				return $http.post('/api/Drink', drinkData);
			},
			update: function(drinkData) {
				return $http.put('/api/Drink/'+drinkData._id,drinkData);
			},
			remove: function(drinkData) {
				console.log("data: "+drinkData);
				return $http.delete('/api/Drink/'+drinkData);
			},
		}
	}]);
