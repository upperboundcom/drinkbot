angular.module('ingredientService', [])

	// super simple service
	// each function returns a promise object 
	.factory('Ingredients', ['$http',function($http) {
		return {
			get : function() {
				return $http.get('/api/Ingredients');
			},
			update : function(pumpName) {
				console.log("pump is "+pumpName);
				return $http.put('/api/Ingredient/'+pumpName);
			},
		
		}
	}]);
