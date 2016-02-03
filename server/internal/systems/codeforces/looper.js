/*
 * Acm module
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 */

'use strict';

var codeforcesApi = require('./api/api');
var async = require('async');
var unirest = require('unirest');

var looperTimeout = 200;
var MAX_WAITING_TIMEOUT = 5 * 60 * 1000;
var LAST_SENTS_IN_MEMORY_LIMIT = 100;

module.exports = {
    watch: Watch
};

function Watch(params, callback, progressCallback) {
    var beginTime = new Date().getTime(),
        accountHandle = params.acmAccount.login,
        externalContestId = +params.solution.contest_id;

    params.acmAccount.lastSentSolutionIds = params.acmAccount.lastSentSolutionIds || [];

    async.forever(function (next) {
        var curTime = new Date().getTime();
        if (curTime - beginTime >= MAX_WAITING_TIMEOUT) {
            callback(new Error('Max timeout limit has exceeded.'));
            return next(true);
        }
        codeforcesApi.user.status({
            from: 1,
            count: 1,
            handle: accountHandle
        }, function (err, response) {
            if (err) {
                callback(err);
                return next(true);
            }
            var resultArray = response.result,
                currentSolution,
                found = false;
            for (var solutionIndex in resultArray) {
                if (!resultArray.hasOwnProperty(solutionIndex)) continue;
                if (found) {
                    break;
                }
                currentSolution = resultArray[solutionIndex];
                var author = currentSolution.author,
                    problemContestId = currentSolution.problem.contestId;
                if (!author) {
                    continue;
                }
                var solutionMembers = author.members;
                if (!solutionMembers || !Array.isArray(solutionMembers)) {
                    continue;
                }
                for (var memberIndex in solutionMembers) {
                    if (!solutionMembers.hasOwnProperty(memberIndex)) continue;
                    var member = solutionMembers[ memberIndex ];
                    if (member.handle
                        && member.handle.toLowerCase() === accountHandle.toLowerCase()
                        && !~params.acmAccount.lastSentSolutionIds.indexOf( resultArray[ solutionIndex ].id )
                        && problemContestId === externalContestId) {
                        if (currentSolution.verdict
                            && currentSolution.verdict !== 'TESTING') {
                            params.acmAccount.lastSentSolutionIds.push( currentSolution.id );
                            if (params.acmAccount.lastSentSolutionIds.length > LAST_SENTS_IN_MEMORY_LIMIT) {
                                params.acmAccount.lastSentSolutionIds.shift();
                            }
                            callback(null, {
                                solutionId: currentSolution.id,
                                verdict: currentSolution.verdict,
                                testNum: currentSolution.passedTestCount + 1,
                                timeConsumed: parseFloat((currentSolution.timeConsumedMillis / 1000).toFixed(4)),
                                memoryConsumed: Math.floor(currentSolution.memoryConsumedBytes / 1024)
                            });
                            return next(true);
                        }
                        if (typeof progressCallback === 'function') {
                            progressCallback({
                                solutionId: currentSolution.id,
                                verdict: currentSolution.verdict,
                                testNum: currentSolution.passedTestCount + 1,
                                timeConsumed: parseFloat((currentSolution.timeConsumedMillis / 1000).toFixed(4)),
                                memoryConsumed: Math.floor(currentSolution.memoryConsumedBytes / 1024)
                            });
                        }
                        found = true;
                        break;
                    }
                }
            }
            setTimeout(function () {
                next();
            }, looperTimeout);
        });
    });
}