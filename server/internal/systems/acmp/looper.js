/*
 * Acm module
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 */

'use strict';

var async = require('async');
var cheerio = require('cheerio');
var unirest = require('unirest');
var querystring = require('querystring');
var url = require('url');

var ACM_BASE_URI = 'http://acmp.ru';
var looperTimeout = 300;
var MAX_WAITING_TIMEOUT = 2 * 60 * 1000;

module.exports = {
    watch: Watch
};

function Watch(params, callback, progressCallback) {
    var authorStatusUrl = ACM_BASE_URI + '/index.asp?main=status&id_mem=' + params.acmAccount.id,
        beginTime = new Date().getTime(),
        attempts = 0;

    async.forever(function (next) {
        var curTime = new Date().getTime();
        if (curTime - beginTime >= MAX_WAITING_TIMEOUT) {
            callback(new Error('Max timeout limit has exceeded.'));
            return next(true);
        }
        unirest.get(authorStatusUrl)
            .end(function (response) {
                var bodyResponse = response.body;
                if (!bodyResponse) {
                    setTimeout(function () {
                        next();
                    }, looperTimeout);
                    return;
                }
                var $ = cheerio.load(bodyResponse);
                var found, terminalExistence, failed;

                $('.white').each(function () {
                    if (found || failed) {
                        return;
                    }
                    var _ = $(this),
                        tds = _.find('td');

                    var lSolutionId = parseInt(tds.eq(0).text(), 10),
                        verdict = tds.eq(5).text(),
                        taskNumber = extractParam(tds.eq(3).find('a').attr('href'), 'id_task'),
                        testNum = tds.eq(6).text().trim(),
                        timeConsumed = tds.eq(7).text().trim().replace(',', '.'),
                        memoryConsumed = tds.eq(8).text().trim().replace(/[^0-9]/gi, ''),
                        loginId = extractParam(tds.eq(2).find('a').attr('href'), 'id');

                    if (params.acmAccount.id != loginId
                        || typeof verdict !== 'string'
                        || taskNumber != params.solution.task_num
                        || params.acmAccount.lastSolutionId && lSolutionId == params.acmAccount.lastSolutionId) {
                            if (params.acmAccount.lastSolutionId && lSolutionId == params.acmAccount.lastSolutionId) {
                                failed = true;
                            }
                        return;
                    }
                    found = true;
                    verdict = verdict.trim();
                    testNum = testNum ? parseInt(testNum, 10) : 0;
                    timeConsumed = timeConsumed ? parseFloat(timeConsumed, 10) : 0;
                    memoryConsumed = memoryConsumed ? parseFloat(memoryConsumed, 10) : 0;

                    var terminalStates = [
                        'Accepted',
                        'Compilation error',
                        'Wrong answer',
                        'Time limit exceeded',
                        'Memory limit exceeded',
                        'Output limit exceeded',
                        'Idleness limit exceeded',
                        'Runtime error',
                        'Restricted function',
                        'Presentation error'
                    ];
                    terminalExistence = terminalStates.some(function (val) {
                        return verdict.toLowerCase().indexOf(val.toLowerCase()) !== -1;
                    });

                    if (terminalExistence) {
                        callback(null, {
                            solutionId: lSolutionId,
                            verdict: verdict,
                            testNum: testNum,
                            timeConsumed: timeConsumed,
                            memoryConsumed: memoryConsumed
                        });
                        params.acmAccount.lastSolutionId = lSolutionId;
                        return next(true);
                    } else if (typeof progressCallback === 'function') {
                        async.nextTick(function () {
                            progressCallback({
                                solutionId: lSolutionId,
                                verdict: verdict,
                                testNum: testNum,
                                timeConsumed: timeConsumed,
                                memoryConsumed: memoryConsumed
                            });
                        });
                    }
                });

                if (!terminalExistence) {
                    if (!found) {
                        attempts++;
                    }
                    if (attempts > 30) {
                        callback(new Error('ACCOUNT_REFRESH_NEEDED'));
                        return next(true);
                    }
                    setTimeout(function () {
                        next();
                    }, looperTimeout);
                }
            });
    });
}

function extractParam(str, key) {
    if (typeof str !== 'string' || typeof key !== 'string') {
        return null;
    }
    return querystring.parse(url.parse(str).query)[ key ];
}