/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 08.11.2015
 */

"use strict";

angular.module('Qemy.services.admin', [
    'Qemy.i18n'
])

    .service('AdminManager', ['$http', function ($http) {

        function dataEncode(data) {
            var paramPairs = [];
            for (var el in data) {
                if (!data.hasOwnProperty(el)) continue;
                paramPairs.push(el + '=' + data[el]);
            }
            return paramPairs.join('&');
        }

        function searchGroups(params) {
            return $http({
                method: 'get',
                url: '/api/admin/searchGroups?' + dataEncode(params)
            }).then(function (data) {
                return data.data;
            });
        }

        function searchProblems(params) {
            return $http({
                method: 'get',
                url: '/api/admin/searchProblems?' + dataEncode(params)
            }).then(function (data) {
                return data.data;
            });
        }

        function createContest(params) {
            return $http({
                method: 'post',
                url: '/api/admin/createContest',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function updateContest(params) {
            return $http({
                method: 'post',
                url: '/api/admin/updateContest',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function deleteContest(params) {
            return $http({
                method: 'post',
                url: '/api/admin/deleteContest',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function repairContest(params) {
            return $http({
                method: 'post',
                url: '/api/admin/repairContest',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function getContestInfo(params) {
            return $http({
                method: 'get',
                url: '/api/admin/getContestInfo?' + dataEncode(params)
            }).then(function (data) {
                return data.data;
            });
        }

        function getUsers(params) {
            return $http({
                method: 'get',
                url: '/api/admin/getUsers?' + dataEncode(params)
            }).then(function (data) {
                return data.data;
            });
        }

        function deleteUser(params) {
            return $http({
                method: 'post',
                url: '/api/admin/deleteUser',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function createUser(params) {
            return $http({
                method: 'post',
                url: '/api/admin/createUser',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function scanTimus() {
            return $http({
                method: 'post',
                url: '/api/admin/scanTimus'
            }).then(function (data) {
                return data.data;
            });
        }

        function scanCfProblemset() {
            return $http({
                method: 'post',
                url: '/api/admin/scanCf'
            }).then(function (data) {
                return data.data;
            });
        }

        function scanCfGym() {
            return $http({
                method: 'post',
                url: '/api/admin/scanCfGyms'
            }).then(function (data) {
                return data.data;
            });
        }

        function scanAcmp() {
            return $http({
                method: 'post',
                url: '/api/admin/scanAcmp'
            }).then(function (data) {
                return data.data;
            });
        }
        
        function restart() {
            return $http({
                method: 'post',
                url: '/api/admin/restart'
            }).then(function (data) {
                return data.data;
            });
        }

        function setVerdictForSent(params) {
            return $http({
                method: 'post',
                url: '/api/admin/setVerdictForSent',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function sendSolutionAgain(params) {
            return $http({
                method: 'post',
                url: '/api/admin/sendSolutionAgain',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function refreshSolution(params) {
            return $http({
                method: 'post',
                url: '/api/admin/refreshSolution',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function deleteSolution(params) {
            return $http({
                method: 'post',
                url: '/api/admin/deleteSolution',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        function getRatingTable(params) {
            return $http({
                method: 'post',
                url: '/api/admin/getRatingTable',
                data: params
            }).then(function (data) {
                return data.data;
            });
        }

        return {
            searchGroups: searchGroups,
            searchProblems: searchProblems,
            createContest: createContest,
            deleteContest: deleteContest,
            repairContest: repairContest,
            getContestInfo: getContestInfo,
            updateContest: updateContest,
            getUsers: getUsers,
            deleteUser: deleteUser,
            createUser: createUser,
            scanTimus: scanTimus,
            scanCfProblemset: scanCfProblemset,
            scanCfGym: scanCfGym,
            scanAcmp: scanAcmp,
            restart: restart,
            setVerdictForSent: setVerdictForSent,
            sendSolutionAgain: sendSolutionAgain,
            refreshSolution: refreshSolution,
            deleteSolution: deleteSolution,
            getRatingTable: getRatingTable
        }
    }])
;