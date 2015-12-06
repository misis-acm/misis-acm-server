/* Services */

angular.module('Qemy.services', [
    'Qemy.i18n'
])
    .provider('Storage', function () {

        this.setPrefix = function (newPrefix) {
            ConfigStorage.prefix(newPrefix);
        };

        this.$get = ['$q', function ($q) {
            var methods = {};
            angular.forEach(['get', 'set', 'remove'], function (methodName) {
                methods[methodName] = function () {
                    var deferred = $q.defer(),
                        args = Array.prototype.slice.call(arguments);

                    args.push(function (result) {
                        deferred.resolve(result);
                    });
                    ConfigStorage[methodName].apply(ConfigStorage, args);

                    return deferred.promise;
                };
            });
            return methods;
        }];
    })

    .service('StorageObserver', ['Storage', function(Storage) {
        var Observer = function Observer(storageKey, callback, params) {
            params = params || {};
            var prevVal,
                looper,
                destroyFlag = params.destroy || false,
                lazyTimeout = params.timeout || 50,
                deleteAfter = params.deleteAfter || false;
            Storage.get(storageKey).then(function(value) {
                prevVal = value;
            });
            looper = setInterval(function() {
                Storage.get(storageKey).then(function(value) {
                    if (prevVal != value) {
                        callback(value, prevVal);
                        if (destroyFlag || deleteAfter) {
                            clearInterval(looper);
                            if (deleteAfter) {
                                Storage.remove(storageKey);
                            }
                        }
                        prevVal = value;
                    }
                });
            }, lazyTimeout);

            function stop(lastInvoke) {
                clearInterval(looper);
                if (lastInvoke) {
                    callback(prevVal);
                }
            }

            return {
                stopWatching: stop
            }
        };

        function startObserver() {
            var args = Array.prototype.slice.call(arguments);
            return Observer.apply(this, args);
        }

        return {
            watch: startObserver
        }
    }])

    .service('UserManager', ['$rootScope', '$q', '$http', function ($rootScope, $q, $http) {
        var curUser = null;

        function getCurrentUser(params) {
            params = params || { cache: true };
            return $q.when(curUser && params.cache ? curUser : getUser()).then(function (result) {
                return result.status ? result.data.user : result;
            });
            function getUser() {
                return $http.get('/api/auth/isAuth').success(function (data) {
                    if (!data.result) {
                        return false;
                    } else if (data.user) {
                        curUser = data.user;
                    }
                    return curUser;
                });
            }
        }

        function logout() {
            return $http.post('/api/auth/logout').success(function (data) {
                curUser = null;
                var defaultAction = true;
                return data && data.result
                    ? data.result : defaultAction;
            });
        }

        return {
            getCurrentUser: getCurrentUser,
            logout: logout
        }
    }])

    .service('SocketService', ['$rootScope', '$q', '$http', function ($rootScope, $q, $http) {
        var socket = io();
        var queue = [];
        var connectCallback = angular.noop;

        var interval = setInterval(function () {
            console.log('Check socket connection...');
            if (socket.connected) {
                connectCallback();
                dispatchQueueEvents();
                clearInterval(interval);
            } else {
                console.log('Not connected. Trying again...');
            }
        }, 500);

        function dispatchQueueEvents() {
            while (queue.length) {
                var event = queue.shift();
                emitEvent(event.name, event.data);
                console.log('Dispatching event:', event);
            }
        }

        function emitEvent(eventName, eventArgs) {
            if (!socket.connected) {
                console.log('Added to queue', eventName, eventArgs);
                return queue.push({
                    name: eventName,
                    data: eventArgs
                });
            }
            socket.emit(eventName, eventArgs);
        }

        function onConnect(callback) {
            if (socket.connected) {
                return callback();
            }
            connectCallback = callback;
        }

        function getSocket() {
            return socket;
        }

        function getIo() {
            return io;
        }

        function joinContest(contestId) {
            emitEvent('join contest', {
                contest_id: contestId
            });
        }

        function leaveContest(contestId) {
            emitEvent('leave contest', {
                contest_id: contestId
            });
        }

        function setListener(eventName, callback) {
            socket.on(eventName, callback);
            return {
                removeListener: removeListener.bind(this, eventName, callback)
            }
        }

        function removeListener(eventName, callback) {
            socket.removeListener(eventName, callback);
        }

        return {
            getSocket: getSocket,
            getIo: getIo,
            joinContest: joinContest,
            leaveContest: leaveContest,
            setListener: setListener,
            removeListener: removeListener,
            onConnect: onConnect
        }
    }])
;