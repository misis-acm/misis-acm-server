/*
 * Acm module
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 */

'use strict';

var unirest = require('unirest');

var ACM_BASE_URI = 'http://codeforces.com';
var API_URI = '/api';

module.exports = {
    contest: {
        list: getContestsList,
        standings: getContestStandings,
        status: getContestStatus
    },
    problemset: {
        problems: getProblemset,
        recentStatus: getProblemsetRecentStatus
    },
    user: {
        status: getUserStatus
    }
};


function invokeMethod(apiUrl, params, callback) {
    unirest.get(apiUrl)
        .query(params)
        .end(function (response) {
            var bodyResponse = response.body;
            if (!bodyResponse) {
                return callback(new Error('The resource is not reached.'));
            }
            callback(null, bodyResponse);
        });
}


function getContestsList(params, callback) {
    var methodUri = '/contest.list',
        apiUrl = ACM_BASE_URI + API_URI + methodUri;
    invokeMethod(apiUrl, params, callback);
}


function getContestStandings(params, callback) {
    var methodUri = '/contest.standings',
        apiUrl = ACM_BASE_URI + API_URI + methodUri;
    invokeMethod(apiUrl, params, callback);
}


function getContestStatus(params, callback) {
    var methodUri = '/contest.status',
        apiUrl = ACM_BASE_URI + API_URI + methodUri;
    invokeMethod(apiUrl, params, callback);
}


function getProblemset(params, callback) {
    var methodUri = '/problemset.problems',
        apiUrl = ACM_BASE_URI + API_URI + methodUri;
    invokeMethod(apiUrl, params, callback);
}


function getProblemsetRecentStatus(params, callback) {
    var methodUri = '/problemset.recentStatus',
        apiUrl = ACM_BASE_URI + API_URI + methodUri;
    invokeMethod(apiUrl, params, callback);
}

function getUserStatus(params, callback) {
    var methodUri = '/user.status',
        apiUrl = ACM_BASE_URI + API_URI + methodUri;
    invokeMethod(apiUrl, params, callback);
}