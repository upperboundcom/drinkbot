var app = angular.module('drinkbotController', []);

	// inject the Drink service factory into our controller
	app.controller('mainController', ['$scope','$http','Drinks','DrinkOrders',  'SystemStatus', function($scope, $http, Drinks,DrinkOrders, SystemStatus) {
		
		var orderPollInterval;
		var ingredientPollInterval;
		var systemStatusPollInterval;

		$scope.formData = {};
		$scope.loading = true;

		// GET =====================================================================
		// when landing on the page, get all drinks and show them
		// use the service to get all the drinks
		Drinks.get()
			.success(function(data) {
				$scope.drinks = data;
				$scope.loading = false;
			});

		DrinkOrders.get()
			.success(function(data) {

				$scope.drinkorders = data;


			});

			
		getSystemStatus();
		
		systemStatusPollInterval = setInterval(getSystemStatus, 2500);

		function getSystemStatus() {
		        SystemStatus.get()
                        	.success(function(data) {
	                        $scope.systemstatus = data;

                	});
		}

		
		// Clears all drink orders

		$scope.clearDrinkOrders = function() {
			var result = confirm("Are you sure you want to clear the order history?");

			if (!result) {
				return false;
			}

			else {

		                DrinkOrders.clearAll()
                		        .success(function(data) {
                        		DrinkOrders.get()
                                		.success(function(data) {
                                        	$scope.drinkorders = data;
                        		});

		                });

			}
		};
		// CREATE ==================================================================
		// when submitting an order, set it to the node API
		$scope.createDrinkOrder = function(drink) {
			alert("You have selected "+drink.name+". Please ensure a cup is placed in the holder.");

			$scope.loading = true;
			
			
			DrinkOrders.create(drink)
				.success(function(data) {
					$scope.loading=false;
					$scope.drinkorders = data; // updated list of orders

	            // set a timer to refresh the list of orders and status


                 orderPollInterval = setInterval(function() {
                //      console.log("refreshing order list");
                        DrinkOrders.get()
                                .success(function(data) {
                                        $scope.drinkorders = data;

					// If all orders are done then clear the interval since no status will change until
					// an order is placed next
					var numOrders = data.length;
					var i=0;
					while ( i<numOrders) {
						if (data[i].status != "Done") {
							console.log("There are still outstanding orders");
							break;
							
						}
						i++;
					}
					
					if (i == numOrders) {
						// Got through all orders. Everything is Done
						console.log("No more outstanding orders");
						clearInterval(orderPollInterval);
					}
                                });

	                },5000);

				});
		
		};
		
	
	}]);

	app.controller('ingredientController', ['$scope','$http','Ingredients', 'SystemStatus', function($scope, $http, Ingredients, SystemStatus) {
		$scope.loading = true;
		
		// initial pull of ingredient list
		 Ingredients.get()
                                .success(function(data) {
                                        $scope.ingredients = data;
                                        $scope.loading= false;
                 });

		// initial pull of system status

		getSystemStatus();

		var systemStatusPollInterval = setInterval(getSystemStatus, 2000);

		function getSystemStatus() {

	                SystemStatus.get()
                	        .success(function(data) {
                        	$scope.systemstatus = data;
	
        	        });

		}

		// set up an timer to poll for new pump status
		ingredientPollInterval = setInterval(function() {
			Ingredients.get()
				.success(function(data) {
					$scope.ingredients = data;
			});

		},2500);
	}]);


	app.controller('addDrinkController',['$scope','$http','Ingredients','Drinks', function($scope, $http, Ingredients, Drinks) {

		$scope.loading = true;
		$scope.successMsg=false;

                $scope.selectedIngredients = [];
		$scope.saveIngredient  = function (ingredient) {

			// Dont add it if amount is 0
			if (ingredient.amountOz != 0 && ingredient.amountOz != null) {
				// Remove the ingredient if it's already there so we can replace it

				for(var i = $scope.selectedIngredients.length - 1; i >= 0; i--) {
				    if($scope.selectedIngredients[i].ingredientName === ingredient.ingredientName) {
				       $scope.selectedIngredients.splice(i, 1);
			    	    }	
				}			
	
				$scope.selectedIngredients.push(ingredient);
			}

		}

		Ingredients.get()
                        .success(function(data) {
                                $scope.ingredients = data;
                                $scope.loading= false;
				
                });

		$scope.addDrink= function(drinkName,ingredients) {
			//alert("Added "+JSON.stringify(drinkName) + " with " +JSON.stringify($scope.selectedIngredients));

			// Convert form data to a real drink object
			drink = {
				name : drinkName,
				ingredients : []
			};

			for (var i =0 ; i<ingredients.length; i++) {

				// Ensure we're not adding blank ingredients
				if (ingredients[i].amountOz != 0 && ingredients[i].amountOz != null) {

					var ingredient = {
						pumpName: ingredients[i].pumpName,
						ingredientName: ingredients[i].ingredientName,
						amountOz: ingredients[i].amountOz,
						delayMS: ingredients[i].delaySec * 1000
					};
					if (ingredient.delayMs === null) {
						ingredient.delayMS=0;
					}
		
					drink.ingredients.push(ingredient);
				}			
			}



			 Drinks.create(drink)
                                .success(function(data) {
				$scope.successMsg = true;
				
			});
//			alert("adding "+JSON.stringify(drink));
		};

	 }]);


        app.controller('maintenanceController', ['$scope','$http','Ingredients', 'SystemStatus', function($scope, $http, Ingredients, SystemStatus) {
                $scope.loading = true;


		getSystemStatus(getIngredients);

		function getIngredients() {
			console.log("Getting ingredient/pump status");
	                 Ingredients.get()
        	                     .success(function(data) {
                	                        $scope.loading= false;

					 var isDisabled = "false";
					 if ($scope.systemstatus.mode != "maintenance") {
						// disabling the pump buttons if we're in maint mode
						isDisabled= "true";
		
   					 }
                        	        // initialize the command based on what the pump is currently doing

                                  for (var i = 0; i<data.length; i++) {
					
					data[i].isButtonDisabled = isDisabled;
                                        if (data[i].status != "Idle") {
                                                data[i].command="Stop";
                                        }
                                        else {
                                                data[i].command="Start";
                                        }

                                  }

                                        $scope.ingredients = data;

                 });

		}
                // initial pull of system status

		function getSystemStatus(callback) {
			console.log("Getting system status");
                	SystemStatus.get()
                        	.success(function(data) {
        	                $scope.systemstatus = data;
        	                

				if (data.mode == "drinks") {

					$scope.buttonText="Enable Maintenance Mode";
					$scope.modeButtonStyle="DrinkMode";
				}
				else {
					$scope.buttonText="Disable Maintenance Mode";
					$scope.modeButtonStyle="MaintMode";
				}
				if (callback!=null) {
					callback();
				}
                	});
		}
                // set up an timer to poll for new pump status
                ingredientPollInterval = setInterval(getIngredients,2500);

		// set up timer to get the system status


		systemStatusPollInterval = setInterval(getSystemStatus,2500);

		$scope.setMode = function() {
			console.log("Setting mode");
			var newStatus = {
				mode: $scope.systemstatus.mode,
				message: $scope.systemstatus.message,
				status: "Idle",
				twiki_mode: $scope.systemstatus.twiki_mode,
				tts_lang: $scope.systemstatus.tts_lang,
				tell_jokes: $scope.systemstatus.tell_jokes,
				joke_interval_sec: $scope.systemstatus.joke_interval_sec
			};

			switch ($scope.systemstatus.mode) {
				
				case 'drinks':
					// changing to maint mode
					newStatus.mode="maintenance";
					newStatus.message="In maintenance mode.";
					$scope.buttonText="Disable Maintenance Mode";
					$scope.modeButtonStyle="MaintMode";
					break;
				case 'maintenance':
					// changing to drinks mode
					newStatus.mode="drinks";
					newStatus.message="Waiting for drink orders.";
					$scope.buttonText="Enable Maintenance Mode";
					$scope.modeButtonStyle="DrinkMode";
					break;
				default:
					console.log("Not sure what to do here");// ??
			}
			//$scope.$apply();
			// update the database
                        SystemStatus.update(newStatus)
                                .success(function(data) {
							
                        });
			

		};

	       	$scope.togglePump = function(pumpName) {

                	Ingredients.update(pumpName)
				.success(function(data) {

			});
        	};

        }]);

	app.controller('editDrinksController',['$scope','$http','Ingredients','Drinks', function($scope, $http, Ingredients, Drinks) {
	

		$scope.loading = true;
		$scope.editform = false;
		$scope.drinklist = true;
		$scope.deletemessage = false;

                Drinks.get()
                        .success(function(data) {
                                $scope.drinks = data;
                                $scope.loading = false;
                        });

                $scope.selectedIngredients = [];
                $scope.saveIngredient  = function (ingredient) {

                        // Dont add it if amount is 0
                        if (ingredient.amountOz != 0 && ingredient.amountOz != null) {
                                // Remove the ingredient if it's already there so we can replace it

                                for(var i = $scope.selectedIngredients.length - 1; i >= 0; i--) {
                                    if($scope.selectedIngredients[i].ingredientName === ingredient.ingredientName) {
                                       $scope.selectedIngredients.splice(i, 1);
                                    }
                                }

                                $scope.selectedIngredients.push(ingredient);
                        }

                }



		// opens the edit drink form
		$scope.edit = function(drink) {

			$scope.drink = drink;
			$scope.drinkName= drink.name;
			$scope.editform=true;
			$scope.drinklist = false;
	
			$scope.successmessage=false;
			$scope.deletemessage=false;

			drinkingredients = drink.ingredients;

			//alert (JSON.stringify(drinkingredients));
        	        Ingredients.get()
                	        .success(function(data) {

						

					for (var i=0; i<data.length; i++) {
						// set the model based on the drink ingredients

						for (var n=0;n<drinkingredients.length; n++) {
							if (drinkingredients[n].ingredientName == data[i].ingredientName) {
								data[i].amountOz = drinkingredients[n].amountOz;
								data[i].delaySec = drinkingredients[n].delayMS/1000;

							}
						}

					}
					$scope.ingredients = data;
                                	$scope.loading= false;

	                });


		}	
		
		// cancels and edit
		$scope.cancelEdit = function() {
			
			if (confirm("Are you sure you want to cancel?")) {
				$scope.drinklist = true;
				$scope.editform = false;
			}
		
		}

		// delete a drink
		$scope.remove = function(id) {

			if (confirm("Are you sure you want to delete "+$scope.drinkName+"?")) {
				console.log("Removing "+id);
				
				Drinks.remove(id)
                                	.success(function(id) {

                                  	     Drinks.get()
                                                .success(function(data) {
                                        	        $scope.deletemessage = true;
                                	                $scope.drinklist=true;
                                                	$scope.editform= false;
							$scope.drinks = data;

                                             });

                        	});

			}
			else {
				$scope.deletemessage=false;
			}
  			$scope.drinklist=true;
                        $scope.editform= false;

		//	return false;
		}
		// submits a drink update
		$scope.update = function(id, name, ingredients) {

                        // Convert form data to a real drink object
                        drink = {
                                _id: id,
				name : name,
                                ingredients : []
                        };

                        for (var i =0 ; i<ingredients.length; i++) {

                                // Ensure we're not adding blank ingredients
                                if (ingredients[i].amountOz != 0 && ingredients[i].amountOz != null) {

                                        var ingredient = {
                                                pumpName: ingredients[i].pumpName,
                                                ingredientName: ingredients[i].ingredientName,
                                                amountOz: ingredients[i].amountOz,
                                                delayMS: ingredients[i].delaySec * 1000
                                        };
                                        if (ingredient.delayMs === null) {
                                                ingredient.delayMS=0;
                                        }

                                        drink.ingredients.push(ingredient);
                                }
                        }

			    $scope.successmessage = true;
                                $scope.drinklist=true;
                                $scope.editform= false;
			console.log(JSON.stringify(drink));
			
                         Drinks.update(drink)
                                .success(function(data) {

				       Drinks.get()
                                		.success(function(data) {
                                 		$scope.drinks = data;
				        	$scope.successmessage = true;
                                		$scope.drinklist=true;
                                		$scope.editform= false;

                         		});

                        });
			
		}


	}]);
    app.controller('settingsController', ['$scope','$http','SystemStatus', function($scope, $http, SystemStatus) {
        // initial pull of system status

        getSystemStatus(function() {
			$scope.twiki_mode = $scope.systemstatus.twiki_mode;	
			$scope.tts_lang = $scope.systemstatus.tts_lang;
			$scope.tell_jokes = $scope.systemstatus.tell_jokes;
			$scope.joke_interval_sec = $scope.systemstatus.joke_interval_sec;
		});

        var systemStatusPollInterval = setInterval(getSystemStatus, 2000);

        function getSystemStatus(callback) {

                    SystemStatus.get()
                            .success(function(data) {
                            $scope.systemstatus = data;
							if (callback != null) {
								
								callback();
							}
							
                    });
         }

            $scope.updateSettings = function() {
				var newStatus = {
                    mode: $scope.systemstatus.mode,
                    message: $scope.systemstatus.message,
                    status: $scope.systemstatus.status,
                    twiki_mode: $scope.twiki_mode,
                    tts_lang: $scope.tts_lang,
                    tell_jokes: $scope.tell_jokes,
                    joke_interval_sec: $scope.joke_interval_sec
                };
				
                SystemStatus.update(newStatus)
                        .success(function(data) {
								
                });
			};
         
        }]);

