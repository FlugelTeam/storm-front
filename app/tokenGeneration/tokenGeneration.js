'use strict';

angular.module('flugel.view1', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'tokenGeneration/tokenGeneration.html',
    controllerAs: 'vc1',
    controller: 'View1Ctrl'
  });
}])
.controller('View1Ctrl', View1Ctrl)
.controller('DialogController', DialogController);

View1Ctrl.$inject = ['$scope', '$mdDialog'];
function View1Ctrl($scope, $mdDialog) {
    var vc1 = this;
    start();

    $scope.goBackStep = goBackStep;
    $scope.nextToDigitName = nextToDigitName;
    $scope.digitName = digitName;
    $scope.choosePurposeVisit = choosePurposeVisit;

    function start() {
        vc1.step = 1;
        vc1.dataCustomer = {id: "", name:"", service:""};
    }

    function goBackStep(step) {
        vc1.step = step;
    };

    function nextToDigitName(val) {
        vc1.dataCustomer.id = val;
        vc1.step = 2;
        console.log(vc1);
    };

    function digitName() {
        vc1.step = 3;
        console.log(vc1);
    };

    function choosePurposeVisit(ev, idService) {
        vc1.dataCustomer.service = idService;
        console.log(vc1);

        $mdDialog.show({
            controller: DialogController,
             templateUrl: 'tokenGeneration/dialog.html',
             parent: angular.element(document.body),
             targetEvent: ev,
             clickOutsideToClose:true,
             locals: { dataCustomer: vc1.dataCustomer }
        })
        .then(function(answer) {
            $scope.status = 'You said the information was "' + answer + '".';
            console.log($scope.status);
            start();
        }, function() {
            $scope.status = 'You cancelled the dialog.';
            console.log($scope.status);
        });
    };


}

DialogController.$inject = ['$scope', '$mdDialog', 'dataCustomer'];
function DialogController($scope, $mdDialog, dataCustomer) {
    console.log(dataCustomer);
    $scope.dataCustomer = dataCustomer;
    $scope.closeDialog = function() {
        $mdDialog.hide();
    };
    $scope.cancel = function() {
        $mdDialog.cancel();
    };
    $scope.answer = function(answer) {
        $mdDialog.hide(answer);
    };
}
