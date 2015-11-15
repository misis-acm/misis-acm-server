/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 08.11.2015
 */

"use strict";

angular.module('Qemy.services.contest-item', [
    'Qemy.i18n'
])
    .service('ContestItemManager', ['$rootScope', 'Storage', '$http', '$timeout', function($rootScope, Storage, $http, $timeout) {

        function dataEncode(data) {
            var paramPairs = [];
            for (var el in data) {
                if (!data.hasOwnProperty(el)) continue;
                paramPairs.push(el + '=' + data[el]);
            }
            return paramPairs.join('&');
        }

        function getConditions(params) {
            return $http({ method: 'get', url: '/api/problemset/getForContest?' + dataEncode(params) })
                .then(function (data) {
                    return data.data;
                });
        }

        return {
            getConditions: getConditions
        }
    }])
;