angular.module('drinkOrderService', [])

	// super simple service
	// each function returns a promise object 
	.factory('DrinkOrders', ['$http',function($http) {
		return {
			get : function() {
				return $http.get('/api/DrinkOrders');
			},
			create : function(drink) {
				console.log("drink is "+drink.name);
				return $http.post('/api/DrinkOrder', drink);
			},
			clearAll: function() {
				return $http.delete('/api/DrinkOrders/clear');
			},
		}
	}]);
