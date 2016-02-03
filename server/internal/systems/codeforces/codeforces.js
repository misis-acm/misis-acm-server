/*
 * Acm module
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 */

'use strict';

var accounts_manager = require('./accounts');
var looper = require('./looper');
var restler = require('restler');
var extend = require('node.extend');
var cheerio = require('cheerio');

var system_accounts = [];
var isInitialize = false;
var initQueue = [];

var ACM_BASE_URI = 'http://codeforces.com';

module.exports = {
    addAccounts : AddAcmAccounts,
    getAccounts : GetAcmAccounts,
    send        : SendSolution
};


function AddAcmAccounts(accounts) {
    if (!Array.isArray(accounts) || !accounts.length) {
        return;
    }

    system_accounts = accounts;
    accounts_manager.init(system_accounts, function (err) {
        if (err) {
            return console.log('Error in Codeforces auth', err);
        }
        isInitialize = true;
        flushQueue();
    });
}


function GetAcmAccounts() {
    return system_accounts;
}


function SendSolution(solution, callback, progressCallback) {
    if (!isInitialize) {
        var args = Array.prototype.slice.call(arguments);
        return initQueue.push(args);
    }

    accounts_manager.getIdle(function (err, acmAccount, onAccountFinished) {
        if (err) {
            return callback(err);
        }
        console.log('Taken idle account:', acmAccount.login);
        TrySend(solution, acmAccount, function (err, statusCode) {
            if (err) {
                onAccountFinished();
                return callback(err);
            } else if (statusCode !== 200) {
                accounts_manager.refreshAccount(acmAccount, function (err, refreshedAccount) {
                    if (err) {
                        return callback(new Error('Error when the account was refreshed.'));
                    }
                    onAccountFinished();
                });
                return callback(new Error('Wrong status code: ' + statusCode));
            }
            looper.watch({
                acmAccount: acmAccount,
                solution: solution
            }, function (err, verdict) {
                onAccountFinished();
                if (err) {
                    return callback(err);
                }
                callback(null, verdict);
            }, progressCallback);
        });
    });
}


function flushQueue() {
    while (initQueue.length) {
        SendSolution.apply(this, initQueue.shift());
    }
}


function TrySend(solution, acmAccount, callback) {
    var baseUris = {
        problemset: 'http://codeforces.com/problemset',
        gym: 'http://codeforces.com/gym/%CONTEST_ID%'
    };

    if (!solution || !solution.task_type || typeof solution.task_type !== 'string') {
        return callback(new Error('Task type should be a string.'));
    } else if (!(solution.task_type in baseUris)) {
        return callback(new Error('Task type does not exists.'));
    } else if (!solution.contest_id) {
        return callback(new Error('ContestId shouldn\'t be a null'));
    } else if (!acmAccount) {
        return callback(new Error('Codeforces account not found'));
    }

    var selectedBaseUri = baseUris[solution.task_type];

    if (solution.task_type === 'gym') {
        selectedBaseUri = selectedBaseUri.replace('%CONTEST_ID%', solution.contest_id);
    }

    var cookieJar = acmAccount.rest.cookieJar;

    var a = cookieJar._jar.store.idx['codeforces.com']['/'];
    var cookieBuf = [];
    for (var el in a) {
        a[el] = a[el] + '';
        if (!a[el] || typeof a[el] !== 'string') continue;
        var partialCookie = a[el].match(/([a-zA-Z0-9_-]+\=[a-zA-Z0-9_\"-]*).*/i)[1];
        cookieBuf.push(partialCookie);
    }
    var csrf_token = acmAccount.rest.csrf_token;
    var cookie = cookieBuf.join('; ');

    var data = {
        'csrf_token': csrf_token,
        'action': 'submitSolutionFormSubmitted',
        'programTypeId': solution.language,
        'source': solution.source,
        'sourceFile': ''
    };

    if (solution.task_type === 'gym') {
        data = extend(true, {
            'submittedProblemIndex': solution.problem_index
        }, data);
    } else if (solution.task_type === 'problemset') {
        data = extend(true, {
            'submittedProblemCode': solution.contest_id + solution.problem_index
        }, data);
    }

    function makeSourceWatermark(source) {
        //source += '\n\n// Date: ' + (new Date()).toString();
        return source;
    }

    if (typeof data.source !== 'undefined') {
        data.source = makeSourceWatermark(data.source);
    }

    restler.post(selectedBaseUri + '/submit?csrf_token=' + csrf_token, {
        multipart: true,
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*!/!*;q=0.8',
            'Cookie': cookie,
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'ru,en;q=0.8',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Content-Length': JSON.stringify(data).length,
            'Host': 'codeforces.com',
            'Origin': 'http://codeforces.com',
            'Referer': selectedBaseUri + '/submit',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 YaBrowser/15.9.2403.3043 Safari/537.36'
        },
        data: data
    }).on('complete', function(data, response) {
        console.log('Solution was sent.');
        if (!data) {
            return callback(new Error('Solution not sent'));
        }
        var $ = cheerio.load(data),
            submitForm = $('.submit-form'),
            submitErrorRepeat = $('.error.for__source');
        if (submitForm.length || submitErrorRepeat.length) {
            return callback(new Error('Resending the same solution.', 40001));
        } else if (!response) {
            return callback(new Error('Resource not reached'));
        }
        callback(null, response.statusCode);
    });
}