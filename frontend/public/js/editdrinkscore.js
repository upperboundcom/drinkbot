var app = angular.module('drinkbot', ['drinkbotController', 'drinkService', 'ingredientService']);

app.filter("total", function() {
    return function(items, field) {
      var total = 0, i = 0;
      for (i = 0; i < items.length; i++) total += items[i][field];
      return total;
    }
  });
