(function () {
'use strict';

angular
  .module('flugel.components.tokenManagement', [])
  .directive('fgTokenManagement', fgTokenManagementDirective);

  function fgTokenManagementDirective() {
    return {
      retrict: 'E',
      scope: {
      },
      controller: tokenManagementCtrl,
      controllerAs: 'demo',
      templateUrl: 'src/components/tokenManagement/tokenManagement.html'
    };
  }

  tokenManagementCtrl.$inject = ['$scope', '$element','$attrs', '$interval', '$mdDialog',
                                '$cookies', '$window', 'Token', 'Config', 'Login', 'Activity', 'socket'];
  function tokenManagementCtrl($scope, $element, $attrs, $interval, $mdDialog, $cookies,
                                $window, Token, Config, Login, Activity, socket) {
    var stopTime,
        callTime,
        availableTime,
        room;

    var adviserInfo = {};

    var self = this;

    self.hidden = false;
    self.direction = 'up';
    self.onlyRead = $attrs.onlyRead === 'true' ? true : false;
    self.stateAttention = 0; // 0 = available, 1 = calling, 2 = in attention
    self.tokenToBeTaken = {};
    self.tokenInAttention = {};
    self.items = [
        {name: "Nuevo servicio", icon: "fa-plus", direction: "left" },
        {name: "Tranferir turno", icon: "fa-exchange", direction: "left" },
        {name: "Terminar turno", icon: "fa-power-off", direction: "left", btnColor: "md-warn"}
    ];

    $scope.attentionTime = "00:00:00";
    $scope.waitTime = "00:00:00";
    $scope.callTime = "00:00:00";
    $scope.availableTime = "00:00:00";
    $scope.stateName = ['Disponible', 'Llamando...'];
    $scope.visibleTooltip = true;
    $scope.activity = {};

    $scope.takeToken = takeToken;
    $scope.tokenAction = tokenAction;
    $scope.editService = editService;
    $scope.closeAttention = closeAttention;

    inicializeAttending();

    window.onbeforeunload = function (e) {
        var time = 1;
        let msg = `Si ciera la ventana el turno se cerrará en ${time} minuto(s)`;
        if (self.tokenInAttention._id) return msg;
        return null;
    };

    // valida que se esté atendiendo un turno
    function inicializeAttending() {
        getAdviserInfo()
        .then(() => {
            return checkIfAttending();
        })
        .then(isNoAttending => {
            return callToken(isNoAttending);
        })
        .then(tokens => {
            if (tokens.length) {
                getPendingToken(tokens[0]);
            }else{
                available();
            }
        })
        .catch(() => {}); // attending
    }

    function getAdviserInfo(callback) {
        return new Promise((resolve, reject) => {
            Login.login.get(session => {
                if (session.login) {
                    room = session.userData.circleList.branchOffices[0].posCode;
                    inicializeSocket(room);
                    adviserInfo = {
                          adviserName: session.userData.name,
                          adviserLastName: session.userData.lastName,
                          adviserId: session.userData.idUser,
                          adviserEmail: session.userData.email
                    };
                    Activity.activity.get(adviserInfo, data => {
                        $scope.activity = data;
                        resolve();
                    });
                }
            });
        });
    }

    function checkIfAttending(){
      return new Promise((resolve, reject) => {
          Token.tokens.query({state: 2}, data => {
              if (data.length) {
                  // Cambiar esto ******* del receiverAdviser
                  self.tokenInAttention =  _.find(data, obj => {
                        return  obj.token.receiverAdviser.adviserId === adviserInfo.adviserId;
                    }) || {};
                  // ¿soy el que está atendiendo el turno?
                  if (_.size(self.tokenInAttention)) {
                      self.stateAttention = 2;
                      $scope.waitTime = diffTime(self.tokenInAttention.token.infoToken.logCreationToken, 
                                                    self.tokenInAttention.token.infoToken.logCalledToken);
                      $scope.callTime = diffTime(self.tokenInAttention.token.infoToken.logCalledToken, 
                                                    self.tokenInAttention.token.infoToken.logAtentionToken);
                      stopTime = $interval(callAtInterval, 200, false);
                      resolve(false);
                  }
              }
              resolve(true);
          });
      });
    }

    function inicializeSocket() {
        socket.on('newToken', data => {
            console.log(data);
            if (!data.availableUser) return;
            if (self.stateAttention === 0 && adviserInfo.adviserId === data.availableUser.adviserId) {
                getPendingToken(data.token);
            }
        });
        socket.on('resultService', data => {
            self.tokenInAttention = data;
            $mdDialog.hide();
        });
    }

    function callAtInterval() {
        $scope.attentionTime = diffTime(self.tokenInAttention.token.infoToken.logAtentionToken, false);
    }

    function diffTime(iniTime, endTime) {
        var momentIniTime = iniTime ? moment(iniTime): moment();
        var momentEndTime = endTime ? moment(endTime) : moment();
        return moment.utc(momentEndTime.diff(momentIniTime)).format("HH:mm:ss");
    }

    function available() {
        self.stateAttention = 0; // 0 = pending, 1 = calling, 2 = in attention, 3 = closed, 4 = abandoned, 5 = canceled
        self.tokenToBeTaken = {};
        self.tokenInAttention = {};
         // *** Punto 1 ***
        setEventActivity('3', 'disponible', function (data) {
              var activityStartTime = _.last($scope.activity.activity).activityStartTime;
              $interval.cancel(availableTime);
              availableTime = $interval(function () {
                  $scope.availableTime = diffTime(activityStartTime, false);
              }, 200, false);
        });
    }

    function setEventActivity(eventCode, eventName, callback) {
        // valida si existe actividad
        if (!$scope.activity._id) { $window.location = '#/select'; return; }

        var eventCodeBefore = _.last($scope.activity.activity).activityEvent.eventCode;
        if (eventCodeBefore !== eventCode) {
            var activity = {idActivity: $scope.activity._id, eventCode: eventCode, eventName: eventName};
            Activity.activity.update(activity, function (data) {
                $scope.activity = data;
                if (callback) return callback(data);
            });
        }
        if (callback) return callback(null);
    }

    /* ¿Hay turnos Disponibles? no --> available();
    ¿Habia algun asesor Disponible al momento de la creación de un turno? si --> available(), no --> llama
    ¿soy yo el asesor que va a atender? no --> available(), si --> llama */
    function callToken(isNoAttending = true) {
        return new Promise ((resolve, reject) => {
            if (!isNoAttending) return reject();
            Token.tokens.query({state: 0, room: room}, function (data) {
                if (data.length && (!data[0].token.receiverAdviser || 
                                    data[0].token.receiverAdviser.adviserId === adviserInfo.adviserId)) {
                    resolve(data);
                }else {
                    resolve([]);
                }
            });
        });
    }

    function callToken2(isAttending = false) {
        if (isAttending) return;
        Token.tokens.query({state: 0, room: room}, function (data) {
            if (data.length && !data[0].token.receiverAdviser) return getPendingToken(data[0]);
            if (data.length && data[0].token.receiverAdviser.adviserId === adviserInfo.adviserId) return getPendingToken(data[0]);
            available();
        });
    }

    function getPendingToken(token) {
        $interval.cancel(availableTime);
        var id = {id : token._id};

        // turno que ya se está llamando...
        if (token.token.infoToken.logCalledToken) {
            setTokenToBeTaken(token);
        }else{
            // Nuevo turno a llamar
            Token.callToken.update(id, adviserInfo, function (tokenCalled) {
                setEventActivity('1', 'llamando'); // *** Punto 2 *** (update calling )Pending
                setTokenToBeTaken(tokenCalled);
            });
        }
        // Llama turno.
        function setTokenToBeTaken(token) {
            console.log(token);
            self.stateAttention = 1;
            self.tokenToBeTaken = token.token;
            self.tokenToBeTaken.id = token._id;
            callTime = $interval(function() {
                $scope.callTime = diffTime(token.token.infoToken.logCalledToken, false);
                let minute = parseInt($scope.callTime[4]);
                if ($scope.callTime !== '23:59:59' && !isNaN(minute) && minute >= 2) { //tiempo en minutos
                    Token.abandoningToken.update({id: token._id}, function (data) {
                        $interval.cancel(callTime);
                        callToken2();
                    });
                }
            }, 200, false);
        }
    }

    function takeToken() {
        var id = {id : self.tokenToBeTaken.id};
        console.log(adviserInfo);
        Token.takeToken.update(id, adviserInfo, function (data) {
            // *** Punto 3 (update attendToken) ***
            setEventActivity('2', 'en atención');
            self.stateAttention = 2;
            self.tokenInAttention = data;
            $scope.waitTime = diffTime(self.tokenInAttention.token.infoToken.logCreationToken,
                                        self.tokenInAttention.token.infoToken.logCalledToken);
            $scope.callTime = diffTime(self.tokenInAttention.token.infoToken.logCalledToken,
                                        self.tokenInAttention.token.infoToken.logAtentionToken);
            stopTime = $interval(callAtInterval, 200);
            $interval.cancel(callTime);
            initService();
        });
    }

    function closeToken() {
      var confirm = $mdDialog.confirm()
          .title('¿Desea teminar el turno?')
          .ariaLabel('End token')
          .ok('Terminar')
          .cancel('Continuar');
       $mdDialog.show(confirm).then(function() {
           var id = {id: self.tokenInAttention._id};
           console.log(id);
           Token.closeToken.update(id, function (data) {
               $interval.cancel(stopTime);
               callToken2();
           });

       }, function() {

       });
    }

    function tokenAction(sw) {
        // closeToken
        if (sw === 0) {
            newService();
        }else if (sw === 2) {
            closeToken();
        }
    }

    function showDialog(locals, fnSuccess, fnError){
        fnSuccess =  fnSuccess || function () {return undefined;};
        fnError =  fnError || function () {return undefined;};
        $mdDialog.show({
            controller: servicesCtrl,
            controllerAs: 'demo',
            templateUrl:  'src/components/tokenManagement/serviceList.html',
            parent: angular.element(document.body),
            clickOutsideToClose: false,
            targetEvent: null,
            locals: locals
        }).then(fnSuccess, fnError);
    }

    function newService() {
        var locals = {
            tokenData: {token: self.tokenInAttention},
            mode: 'insert'
        };
        showDialog(locals);
    }

    function initService() {
        var locals = {
            tokenData: {token: self.tokenInAttention},
            mode: 'initInsert'
        };
        showDialog(locals);
    }

    function editService(idToken, service) {
        $scope.visibleTooltip = false;
        var locals =  {
            tokenData: {token: self.tokenInAttention, service: service},
            mode: 'edit'
        };
        function fnSuccess() {
          $scope.visibleTooltip = true;
        }

        showDialog(locals, fnSuccess);
    }

    function closeAttention() {
        setEventActivity('10', 'cerrado', function (data) {
            socket.emit('closeAttention');
            $window.location = '#/select'; return;
        });
    }

    servicesCtrl.$inject = ['$scope', 'Token', '$mdDialog', 'Config', 'tokenData', 'mode', 'socket'];
    function servicesCtrl($scope, Token, $mdDialog, Config, tokenData, mode, socket) {
        var self = this;
        self.services = [];
        self.mode = mode;
        $scope.selectedService = '';
        //console.log(tokenData.service);
        if (mode === 'edit') {
            $scope.selectedService = tokenData.service.serviceId;
        }else if (mode === 'insert') {
            $scope.selectedService = '';
            console.log(tokenData.token.token.motivoVisita);
        }else if (mode === 'initInsert') {
            $scope.selectedService = tokenData.token.token.motivoVisita.serviceId;
        }

        Token.services.query(function (data) {
            self.services = data;
            //console.log(data);
        });

        $scope.cancel = function() {
             $mdDialog.cancel();
         };

        $scope.choosePurposeVisit = function(ev, serviceData){
            //console.log(serviceData);
            $scope.selectedService = serviceData.service.serviceId;
            //console.log($scope.selectedService);
        };

        $scope.goBackStep = function () {
            $scope.selectedService = '';
            $scope.searchText = '';
        };

        $scope.insertService = function (serviceData, subService) {
            var service = _.clone(serviceData.service);
            service.subServices = [subService];

            if (mode === 'insert'  || mode === 'initInsert') {
                socket.emit('insertService', {id: tokenData.token._id, service: service});
            }else if (mode === 'edit') {
                //console.log(tokenData.service); //servicio actual del turno
                socket.emit('updateSubservice', {
                  idToken: tokenData.token._id,
                  idService: tokenData.service._id,
                  subServices: service.subServices
                });
            }

        };
    }

  }
})();
