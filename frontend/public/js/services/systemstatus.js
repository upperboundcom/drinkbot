angular.module('systemStatusService', [])

	// super simple service
	// each function returns a promise object 
	.factory('SystemStatus', ['$http',function($http) {
		return {
			get : function() {
				return $http.get('/api/SystemStatus');
			},
			update : function(systemStatus) {
				return $http.put('/api/SystemStatus', systemStatus);
			},
		
		}
	}]);
