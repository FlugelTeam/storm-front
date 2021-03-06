(function () {
'use strict';

angular
  .module('flugel.components.keyboard', [])
  .directive('fgKeyboard', fgKeyboardDirective);

  function fgKeyboardDirective() {
    return {
      retrict: 'E',
      scope: {
        keyboardNumber: "=keyboardnumber"
      },
      controller: keyboardCtrl,
      templateUrl: 'src/components/keyboard/keyboard.html'
    };
  }
  keyboardCtrl.$inject = ['$scope', '$element', '$attrs', '$rootScope'];
  function keyboardCtrl($scope, $element, $attrs, $rootScope) {
    // Máximo numero de degitos aceptados (deberia cambiarse por una ReGex)
    let maxNumber = 10;
    let minNumber = 4;

    $scope.keyboard = "";
    $scope.keyboardNumber = "";

    $scope.addNumber = function (number) {
        $scope.keyboardNumber = $scope.keyboardNumber + number;
    };
    $scope.setNumber = function () {
        $scope.keyboard = $scope.keyboardNumber;

        if ($scope.keyboard.length >= minNumber && $scope.keyboard.length <= maxNumber) {
            $rootScope.$broadcast('submitKeyboard', $scope.keyboard);
        }else{
            alert('No es un número válido');
        }
    };
    $scope.clearKeyboard = function () {
        $scope.keyboardNumber = $scope.keyboardNumber.slice(0,-1);
        // $scope.keyboard = "";
        // $scope.keyboardNumber = "";
    };
  }
})();
