/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 05.11.2015
 */

"use strict";


var mysqlPool   = require('../../db/mysql-connection');
var mysql       = require('mysql');
var User        = require('../user/user');
var Contest     = require('../contest/contest');
var crypto      = require('crypto');
var async       = require('async');
var problemsetManager = require('../problemset/manager');
var Problem     = require('../problemset/problem');
var acmManager  = require('../systems/manager');
var sockets     = require('../../sockets/sockets');


var DEFAULT_CONTESTS_COUNT = 20;
var DEFAULT_CONTESTS_OFFSET = 0;
var DEFAULT_CONTESTS_CATEGORY = 'all';
var DEFAULT_CONTESTS_SORT = 'byId';
var DEFAULT_CONTESTS_SORT_ORDER = 'desc';

module.exports = {
    create: CreateContest,
    update: UpdateContest,
    getContests: GetContests,
    getContest: GetContest,
    canJoin: CanJoin,
    join: Join,
    sendSolution: SendSolution,
    refreshSolution: RefreshSolution,
    getSents: GetSents,
    getSourceCode: GetSourceCode,
    getSourceCodeRaw: GetSourceCodeRaw,
    getTable: GetTable,
    getSentsForCell: GetSentsForCell,
    getRatingTable: GetRatingTable
};


function CreateContest(params, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var sql = mysql.format('INSERT INTO `contests` ' +
            '(name, start_time, relative_freeze_time, duration_time, practice_duration_time, user_id, creation_time, allowed_groups) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ params.name, params.start_time, params.relative_freeze_time,
                params.duration_time, params.practice_duration_time, params.user_id, new Date().getTime(), params.allowed_groups ]
        );
        connection.query(
            sql,
            function (err, result) {
                if (err || !result || !result.insertId) {
                    return callback(new Error('An error whith db process', 1001));
                }
                var contest = new Contest();
                contest.allocate(result.insertId, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, contest);
                });
            }
        );
    }
}

function UpdateContest(contestId, params, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var sql = mysql.format(
            'UPDATE `contests` ' +
            'SET ? ' +
            'WHERE id = ?',
            [ params, parseInt(contestId) ]
        );
        connection.query(
            sql,
            function (err, result) {
                if (err || !result) {
                    return callback(new Error('An error whith db process', 1001));
                }
                var contest = new Contest();
                contest.allocate(contestId, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, contest);
                });
            }
        );
    }
}

function GetContests(count, offset, category, sort, sort_order, callback) {
    if (typeof count === 'function') {
        callback = count;
        count = null;
    } else if (typeof offset === 'function') {
        callback = offset;
        offset = null;
    } else if (typeof category === 'function') {
        callback = category;
        category = null;
    } else if (typeof sort === 'function') {
        callback = sort;
        sort = null;
    } else if (typeof sort_order === 'function') {
        callback = sort_order;
        sort_order = null;
    }

    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db querying', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        count = count || DEFAULT_CONTESTS_COUNT;
        offset = offset || DEFAULT_CONTESTS_OFFSET;
        category = category || DEFAULT_CONTESTS_CATEGORY;
        sort = sort || DEFAULT_CONTESTS_SORT;
        sort_order = sort_order || DEFAULT_CONTESTS_SORT_ORDER;

        count = Math.max(Math.min(count, 200), 0);
        offset = Math.max(offset, 0);

        var categoryPredicate = [
            'all',
            'showOnlyPractice',
            'showOnlyEnabled',
            'showOnlyDisabled',
            'showOnlyFinished',
            'showOnlyRemoved',
            'showOnlyFrozen',
            'showOnlyStarted'
        ];
        if (categoryPredicate.indexOf(category) === -1) {
            category = DEFAULT_CONTESTS_CATEGORY;
        }

        var availableSorts = {
            byId: 'contests.id',
            byStart: 'contests.start_time',
            byEnd: 'finish_time',
            byCreation: 'contests.creation_time'
        };
        if (!(sort in availableSorts)) {
            sort = DEFAULT_CONTESTS_SORT;
        }

        var readyWhereStatements = {},
            statementExistence = true,
            curDate = new Date();
        switch (category) {
            case 'all':
                readyWhereStatements.all = '';
                statementExistence = false;
                break;
            case 'showOnlyPractice':
                readyWhereStatements.showOnlyPractice = 'contests.start_time + ' +
                    'contests.duration_time < ' +
                    curDate.getTime() + ' AND ' + curDate.getTime() +
                    ' <= contests.duration_time + contests.practice_duration_time';
                break;
            case 'showOnlyEnabled':
                readyWhereStatements.showOnlyEnabled = 'contests.enabled = 1';
                break;
            case 'showOnlyDisabled':
                readyWhereStatements.showOnlyDisabled = 'contests.enabled = 0';
                break;
            case 'showOnlyFinished':
                readyWhereStatements.showOnlyFinished = 'contests.start_time + ' +
                    'contests.duration_time < ' + curDate.getTime();
                break;
            case 'showOnlyRemoved':
                readyWhereStatements.showOnlyRemoved = 'contests.removed = 1';
                break;
            case 'showOnlyFrozen':
                readyWhereStatements.showOnlyFrozen = 'contests.start_time + ' +
                    'contests.relative_freeze_time <= ' +
                    curDate.getTime() + ' AND ' + curDate.getTime() +
                    ' <= contests.start_time + contests.duration_time';
                break;
            case 'showOnlyStarted':
                readyWhereStatements.showOnlyStarted = 'contests.start_time <= ' +
                    curDate.getTime() + ' AND ' + curDate.getTime() +
                    ' <= contests.start_time + contests.duration_time';
                break;
        }
        if (category !== 'showOnlyRemoved') {
            for (var statementIndex in readyWhereStatements) {
                readyWhereStatements[statementIndex] += (statementExistence ? ' AND ' : '') + 'contests.removed = 0';
            }
        }

        var sql = 'SELECT contests.*, contests.start_time + contests.duration_time AS finish_time ' +
            'FROM contests ' +
            'WHERE ' + readyWhereStatements[category] + ' ' +
            'ORDER BY ?? ' + sort_order.toUpperCase() + ' ' +
            'LIMIT ?, ?; ' +
            'SELECT COUNT(contests.id) AS all_items_count ' +
            'FROM contests ' +
            'WHERE ' + readyWhereStatements[category] + ';';

        sql = mysql.format(sql, [
            availableSorts[sort],
            offset,
            count
        ]);

        connection.query(sql, function (err, results, fields) {
            if (err || !results || !Array.isArray(results) || !Array.isArray(results[0])) {
                console.error(err);
                return callback(err);
            }
            var contests = results[0].map(function (row) {
                var contest = new Contest();
                contest.setObjectRow(row);
                return contest;
            });
            var authorAllocates = [];
            contests.forEach(function (contest) {
                authorAllocates.push(
                    contest.allocateAuthor.bind(contest),
                    contest.allocateAllowedGroups.bind(contest)
                );
            });
            async.parallel(authorAllocates, function(err, asyncResults) {
                if (err) {
                    return callback(err);
                }
                var result = {
                    contests: contests.map(function (contest) {
                        return contest.getObjectFactory();
                    }),
                    all_items_count: results[1][0].all_items_count
                };
                callback(null, result);
            });
        })
    }
}

function GetContest(params, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var contestId = params.contestId;
        if (!contestId) {
            return callback(new Error('Contest ID is not specified as parameter'));
        }
        connection.query(
            'SELECT * ' +
            'FROM ?? ' +
            'WHERE ?? = ? ' +
            'LIMIT 0, 1',
            [ 'contests', 'id', contestId ],
            function (err, result) {
                if (err || !result) {
                    return callback(new Error('An error whith db process', 1001));
                }
                var contest = new Contest();
                contest.setObjectRow(result[0]);
                var authorAllocates = [];
                authorAllocates.push(
                    contest.allocateAuthor.bind(contest),
                    contest.allocateAllowedGroups.bind(contest)
                );
                async.parallel(authorAllocates, function(err, asyncResults) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, contest);
                });
            }
        );
    }
}

function CanJoin(params, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var contest = params.contest,
            user = params.user;
        if (!contest || !user || user.isEmpty() || contest.isEmpty()) {
            return callback(new Error('Access denied', 400));
        }
        user.getContainGroupIds(function (err, groupIds) {
            if (err || !Array.isArray(groupIds)) {
                return callback(err);
            }
            if (user.getAccessGroup().access_level === 5) {
                return contest.isUserJoined(user.getId(), function (err, isJoined) {
                    if (err) {
                        return callback(err);
                    }
                    if (isJoined) {
                        return callback(null, {
                            can: true,
                            joined: true,
                            confirm: false
                        });
                    }
                    callback(null, {
                        can: true,
                        joined: false,
                        confirm: false
                    });
                });
            }
            if (!contest.isAllowed(groupIds) || !contest.isEnabled() || contest.isRemoved()) {
                return callback(null, {
                    can: false,
                    reason: 'ACCESS_DENIED'
                });
            }
            contest.isUserJoined(user.getId(), function (err, isJoined) {
                if (err) {
                    return callback(err);
                }
                if (isJoined) {
                    return callback(null, {
                        can: true,
                        joined: true,
                        confirm: false
                    });
                }
                var currentStatus = contest.getStatus();
                if (currentStatus === 'FINISHED' || currentStatus === 'WAITING') {
                    return callback(null, {
                        can: false,
                        reason: 'NOT_IN_TIME'
                    });
                }
                callback(null, {
                    can: true,
                    joined: false,
                    confirm: true
                });
            });
        });
    }
}

function Join(params, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var contestId = params.contestId,
            contest = new Contest(),
            user = params.user;
        contest.allocate(contestId, function (err, result) {
            if (err) {
                return callback(err);
            }
            CanJoin({ contest: contest, user: user }, function (err, result) {
                if (err) {
                    return callback(err);
                }
                if (!result.can) {
                    return callback(new Error('Access denied'));
                }
                if (result.joined) {
                    return callback(null, { result: true });
                }
                connection.query(
                    'INSERT INTO ?? (`user_id`, `contest_id`, `join_time`) ' +
                    'VALUES (?, ?, ?)',
                    [ 'user_enters', user.getId(), contest.getId(), new Date().getTime() ],
                    function (err, result) {
                        if (err) {
                            return callback(new Error('An error whith db process', 1001));
                        }
                        var contestHashKey = sockets.getRoomHash(contestId);
                        var io = sockets.getIo();
                        io.to(contestHashKey).emit('table update');

                        callback(null, { result: true });
                    }
                );
            });
        });
    }
}

function SendSolution(params, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        var onceInvoke = true;
        execute(connection, function (err, result) {
            if (!onceInvoke) {
                return;
            }
            onceInvoke = false;
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var contestId = params.contestId,
            contest = new Contest(),
            problemIndex = params.problemIndex,
            solution = params.solution,
            user = params.user,
            offset = getNumberByInternalIndex(problemIndex),
            langId = params.langId;

        contest.allocate(contestId, function (err, result) {
            if (err) {
                return callback(err);
            }
            CanJoin({ contest: contest, user: user }, function (err, result) {
                if (err) {
                    return callback(err);
                }
                if (!result.can || !result.joined) {
                    return callback(new Error('Access denied'));
                }
                if ([ 'NOT_ENABLED', 'REMOVED', 'FINISHED', 'WAITING' ].indexOf(contest.getStatus()) !== -1) {
                    return callback(new Error('Access denied'));
                }
                connection.query(
                    'SELECT problemset.* ' +
                    'FROM problemset ' +
                    'LEFT JOIN problems_to_contest ON problems_to_contest.problem_id = problemset.id ' +
                    'LEFT JOIN contests ON problems_to_contest.contest_id = contests.id ' +
                    'WHERE contests.id = ? ' +
                    'ORDER BY problems_to_contest.id ASC ' +
                    'LIMIT ?, 1',
                    [ contestId, offset ],
                    function (err, results, fields) {
                        if (err) {
                            return callback(new Error('An error with db', 1001));
                        }
                        if (!results.length) {
                            return callback(new Error('Problem not found'));
                        }
                        var mapped = results.map(function (row) {
                            var problem = new Problem();
                            problem.setObjectRow(row);
                            var readyObject = problem.getObjectFactory();
                            readyObject.internal_index = problemIndex.toUpperCase();
                            return readyObject;
                        });
                        var problem = mapped[0];
                        if (problem.system_type === 'acmp' 
                            && (!solution || solution.length < 12)) {
                            return callback(new Error('Solution is too short. Please send the solution more then 12 characters.'));
                        }

                        connection.query(
                            'SELECT * ' +
                            'FROM system_langs ' +
                            'WHERE id = ?',
                            [ parseInt(langId) ],
                            function (err, results, fields) {
                                if (err) {
                                    return callback(new Error('An error with db', 1001));
                                }
                                if (!results.length) {
                                    return callback(new Error('Langs not found', 1001));
                                }
                                var lang = results[0],
                                    curTime = new Date().getTime();
                                connection.query(
                                    'INSERT INTO sent_solutions ' +
                                    '(user_id, problem_id, sent_time, contest_id, source_code, lang_id, ip) ' +
                                    'VALUES (?, ?, ?, ?, ?, ?, ?)', [
                                        user.getId(),
                                        problem.id,
                                        curTime,
                                        contest.getId(),
                                        solution,
                                        lang.id,
                                        user._ip ? user._ip : ''
                                    ], function (err, result) {
                                        if (err) {
                                            return callback(new Error('An error with db', 1001));
                                        }
                                        
                                        callback(null, {
                                            result: true
                                        });

                                        function makeSourceWatermark(source, commentSyntaxTemplate) {
                                            commentSyntaxTemplate = commentSyntaxTemplate || '//';
                                            source += '\n\n' + commentSyntaxTemplate + ' ' + new Date().toString();
                                            return source;
                                        }

                                        if (lang.language_family
                                            && problem.system_type === 'cf'
                                            && typeof solution !== 'undefined') {
                                            if (~[ 'c', 'csharp', 'java', 'javascript', 'php' ].indexOf(lang.language_family)) {
                                                solution = makeSourceWatermark( solution );
                                            } else if (~[ 'python' ].indexOf(lang.language_family)) {
                                                solution = makeSourceWatermark( solution, '#' );
                                            }
                                        }

                                        var insertedId = result.insertId;
                                        var inFreeze = function (time) {
                                            return time >= contest.getAbsoluteFreezeTimeMs()
                                            && time <= contest.getAbsoluteDurationTimeMs();
                                        };

                                        connection.query(
                                            'SELECT users.id AS contestant_id, users.username, CONCAT(users.first_name, " ", users.last_name) AS user_full_name, ' +
                                            'verdicts.id AS verdict_id, verdicts.name AS verdict_name, verdicts.scored, sent_solutions.sent_time, ' +
                                            'sent_solutions.id AS sent_id, sent_solutions.verdict_time, sent_solutions.execution_time, sent_solutions.memory, sent_solutions.test_num, ' +
                                            'system_langs.id AS lang_id, system_langs.name AS system_lang_name, problemset.id AS problem_id, ' +
                                            'problemset.title, problemset.system_type, problemset.foreign_problem_id, ' +
                                            'contests.start_time AS contest_start_time, contests.relative_freeze_time AS contest_freeze_time, contests.duration_time AS contest_duration_time ' +
                                            'FROM sent_solutions ' +
                                            'LEFT JOIN users ON users.id = sent_solutions.user_id ' +
                                            'LEFT JOIN problemset ON problemset.id = sent_solutions.problem_id ' +
                                            'LEFT JOIN verdicts ON verdicts.id = sent_solutions.verdict_id ' +
                                            'LEFT JOIN system_langs ON system_langs.id = sent_solutions.lang_id ' +
                                            'LEFT JOIN contests ON contests.id = sent_solutions.contest_id ' +
                                            'WHERE sent_solutions.contest_id = ? AND sent_solutions.id = ? ' +
                                            (inFreeze(curTime)
                                                ? 'AND (sent_solutions.sent_time < ' + contest.getAbsoluteFreezeTimeMs() + ' ' +
                                            'OR sent_solutions.sent_time > ' + contest.getAbsoluteDurationTimeMs() + ')' : ''),
                                            [ contestId, insertedId ],
                                            function (err, results, fields) {
                                                if (err) {
                                                    return console.log(err);
                                                }
                                                var list = results;
                                                if (typeof list === 'undefined'
                                                    || !Array.isArray(list)
                                                    || list.length === 0) {
                                                    console.log('In freeze');
                                                    return;
                                                }
                                                var solution = list[0];
                                                solution.internal_index = problemIndex;

                                                var contestHashKey = sockets.getRoomHash(contest.getId());
                                                var io = sockets.getIo();
                                                io.to(contestHashKey).emit('new solution', solution);
                                            }
                                        );


                                        function saveResult(verdict) {
                                            console.log('Saving verdict:', verdict);
                                            var verdictId = getVerdictId(verdict.verdict);
                                            verdict.verdict = getVerdictById(verdictId);
                                            if (verdictId === 1) {
                                                verdict.testNum = 0;
                                            }
                                            connection.query(
                                                'UPDATE sent_solutions ' +
                                                'SET verdict_id = ?, ' +
                                                'verdict_time = ?, ' +
                                                'execution_time = ?, ' +
                                                'memory = ?, ' +
                                                'test_num = ? ' +
                                                'WHERE id = ?', [
                                                    verdictId,
                                                    new Date().getTime(),
                                                    verdict.timeConsumed,
                                                    verdict.memoryConsumed,
                                                    verdict.testNum,
                                                    insertedId
                                                ],
                                                function (err) {
                                                    if (err) {
                                                        return console.log(err);
                                                    }
                                                    user.incrementSolvedCount();

                                                    var contestHashKey = sockets.getRoomHash(contest.getId());
                                                    var io = sockets.getIo();
                                                    io.to(contestHashKey).emit('verdict updated', {
                                                        verdict_id: verdictId,
                                                        verdict_name: verdict.verdict,
                                                        memory: verdict.memoryConsumed,
                                                        time: verdict.timeConsumed,
                                                        testNum: verdict.testNum,
                                                        contest_id: contestId,
                                                        solution_id: insertedId,
                                                        user_id: user.getId()
                                                    });
                                                    if (!inFreeze(curTime)) {
                                                        io.to(contestHashKey).emit('table update');
                                                    }
                                                }
                                            );
                                        }

                                        function saveWithErrors(error) {
                                            console.log('Saving error verdict:', error);
                                            var verdictId = 10,
                                                verdictName = getVerdictById(verdictId);
                                            if (error.message === 'Resending the same solution.') {
                                                verdictId = 11;
                                                verdictName = getVerdictById(11);
                                            }
                                            connection.query(
                                                'UPDATE sent_solutions ' +
                                                'SET verdict_id = ?, ' +
                                                'verdict_time = ?, ' +
                                                'execution_time = ?, ' +
                                                'memory = ?, ' +
                                                'test_num = ? ' +
                                                'WHERE id = ?', [
                                                    verdictId,
                                                    new Date().getTime(),
                                                    0,
                                                    0,
                                                    0,
                                                    insertedId
                                                ],
                                                function (err) {
                                                    if (err) {
                                                        console.log(err);
                                                    }
                                                    var contestHashKey = sockets.getRoomHash(contest.getId());
                                                    var io = sockets.getIo();
                                                    io.to(contestHashKey).emit('verdict updated', {
                                                        verdict_id: verdictId,
                                                        verdict_name: verdictName,
                                                        memory: 0,
                                                        time: 0,
                                                        testNum: 0,
                                                        contest_id: contestId,
                                                        solution_id: insertedId,
                                                        user_id: user.getId()
                                                    });
                                                }
                                            );
                                        }

                                        switch (problem.system_type) {
                                            case 'timus':
                                                acmManager.send(problem.system_type, {
                                                    language: lang.foreign_id,
                                                    task_num: problem.system_problem_number,
                                                    source: solution
                                                }, function (err, verdict) {
                                                    if (err) {
                                                        saveWithErrors(err);
                                                        return callback(err);
                                                    }
                                                    saveResult(verdict);
                                                }, function (progressCurrentTest) {
                                                    console.log(progressCurrentTest);
                                                    var contestHashKey = sockets.getRoomHash(contest.getId());
                                                    var io = sockets.getIo();
                                                    io.to(contestHashKey).emit('verdict updated', {
                                                        verdict_id: -1,
                                                        verdict_name: progressCurrentTest.verdict,
                                                        memory: progressCurrentTest.memoryConsumed,
                                                        time: progressCurrentTest.timeConsumed,
                                                        testNum: progressCurrentTest.testNum,
                                                        contest_id: contestId,
                                                        solution_id: insertedId,
                                                        user_id: user.getId()
                                                    });
                                                });
                                                break;
                                            case 'cf':
                                                var pairCode = problem.system_problem_number.split(':');
                                                if (pairCode.length !== 2) {
                                                    return callback(new Error('Something went wrong.'));
                                                }
                                                var taskType = pairCode[0],
                                                    problemCode = pairCode[1];
                                                if (!/^\d+[a-zA-Z]{1,}/i.test(problemCode)) {
                                                    return callback(new Error('Something went wrong. Please contact your administrator.'));
                                                }
                                                var iContestId = problemCode.match(/^(\d+)/i)[1],
                                                    iProblemIndex = problemCode.replace(/^(\d+)/i, '');
                                                acmManager.send(problem.system_type, {
                                                    language: lang.foreign_id,
                                                    task_type: taskType,
                                                    contest_id: iContestId,
                                                    problem_index: iProblemIndex,
                                                    source: solution
                                                }, function (err, verdict) {
                                                    if (err) {
                                                        saveWithErrors(err);
                                                        return callback(err);
                                                    }
                                                    saveResult(verdict);
                                                }, function (progressCurrentTest) {
                                                    console.log(progressCurrentTest);
                                                    var contestHashKey = sockets.getRoomHash(contest.getId());
                                                    var io = sockets.getIo();
                                                    io.to(contestHashKey).emit('verdict updated', {
                                                        verdict_id: -1,
                                                        verdict_name: progressCurrentTest.verdict ? 
                                                            progressCurrentTest.verdict.toLowerCase() : 'testing',
                                                        memory: progressCurrentTest.memoryConsumed,
                                                        time: progressCurrentTest.timeConsumed,
                                                        testNum: progressCurrentTest.testNum,
                                                        contest_id: contestId,
                                                        solution_id: insertedId,
                                                        user_id: user.getId()
                                                    });
                                                });
                                                break;
                                            case 'acmp':
                                                acmManager.send(problem.system_type, {
                                                    language: lang.foreign_id,
                                                    task_num: problem.system_problem_number,
                                                    source: solution
                                                }, function (err, verdict) {
                                                    if (err) {
                                                        saveWithErrors(err);
                                                        return callback(err);
                                                    }
                                                    saveResult(verdict);
                                                }, function (progressCurrentTest) {
                                                    console.log(progressCurrentTest);
                                                    var contestHashKey = sockets.getRoomHash(contest.getId());
                                                    var io = sockets.getIo();
                                                    io.to(contestHashKey).emit('verdict updated', {
                                                        verdict_id: -1,
                                                        verdict_name: progressCurrentTest.verdict,
                                                        memory: progressCurrentTest.memoryConsumed,
                                                        time: progressCurrentTest.timeConsumed,
                                                        testNum: progressCurrentTest.testNum,
                                                        contest_id: contestId,
                                                        solution_id: insertedId,
                                                        user_id: user.getId()
                                                    });
                                                });
                                                break;
                                            case 'sgu':
                                                acmManager.send(problem.system_type, {
                                                    language: lang.name,
                                                    task_num: problem.system_problem_number,
                                                    source: solution
                                                }, function (err, verdict) {
                                                    if (err) {
                                                        saveWithErrors(err);
                                                        return callback(err);
                                                    }
                                                    saveResult(verdict);
                                                }, function (progressCurrentTest) {
                                                    console.log(progressCurrentTest);
                                                    var contestHashKey = sockets.getRoomHash(contest.getId());
                                                    var io = sockets.getIo();
                                                    io.to(contestHashKey).emit('verdict updated', {
                                                        verdict_id: -1,
                                                        verdict_name: progressCurrentTest.verdict,
                                                        memory: progressCurrentTest.memoryConsumed,
                                                        time: progressCurrentTest.timeConsumed,
                                                        testNum: progressCurrentTest.testNum,
                                                        contest_id: contestId,
                                                        solution_id: insertedId,
                                                        user_id: user.getId()
                                                    });
                                                });
                                                break;
                                            default:
                                                return callback(new Error('System is not defined.'));
                                                break;
                                        }

                                        function getVerdictId(verdictName) {
                                            verdictName = verdictName.toLowerCase();
                                            if (verdictName === 'ok' || verdictName === 'accepted') {
                                                return 1;
                                            } else if ([ 'wrong answer', 'wrong_answer' ].indexOf(verdictName) !== -1) {
                                                return 2;
                                            } else if ([ 'compilation error', 'compilation_error' ].indexOf(verdictName) !== -1) {
                                                return 3;
                                            } else if ([ 'runtime error', 'runtime_error', 'output limit exceeded' ].indexOf(verdictName) !== -1) {
                                                return 4;
                                            } else if ([ 'presentation error', 'presentation_error' ].indexOf(verdictName) !== -1) {
                                                return 5;
                                            } else if ([ 'time limit exceeded', 'time_limit_exceeded' ].indexOf(verdictName) !== -1) {
                                                return 6;
                                            } else if ([ 'memory limit exceeded', 'memory_limit_exceeded' ].indexOf(verdictName) !== -1) {
                                                return 7;
                                            } else if ([ 'idleness limit exceeded', 'idleness_limit_exceeded' ].indexOf(verdictName) !== -1) {
                                                return 8;
                                            } else if ([ 'security violated', 'restricted function', 'security_violated' ].indexOf(verdictName) !== -1) {
                                                return 9;
                                            } else {
                                                return 10;
                                            }
                                        }

                                        function getVerdictById(verdictId) {
                                            switch (verdictId) {
                                                case 1:
                                                    return 'Accepted';
                                                case 2:
                                                    return 'Wrong Answer';
                                                case 3:
                                                    return 'Compilation Error';
                                                case 4:
                                                    return 'Runtime Error';
                                                case 5:
                                                    return 'Presentation Error';
                                                case 6:
                                                    return 'Time Limit Exceeded';
                                                case 7:
                                                    return 'Memory Limit Exceeded';
                                                case 8:
                                                    return 'Idleness Limit Exceeded';
                                                case 9:
                                                    return 'Security Violated';
                                                case 10:
                                                    return 'Unknown System Error';
                                                case 11:
                                                    return 'Same solution';
                                            }
                                        }
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    }
}

function RefreshSolution(params, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        var onceInvoke = true;
        execute(connection, function (err, result) {
            if (!onceInvoke) {
                return;
            }
            onceInvoke = false;
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var contestId = params.contestId,
            contest = new Contest(),
            problemIndex = params.problemIndex,
            solution = params.solution,
            user = params.user,
            offset = getNumberByInternalIndex(problemIndex),
            langId = params.langId,
            sendId = params.sendId;

        contest.allocate(contestId, function (err, result) {
            if (err) {
                return callback(err);
            }
            CanJoin({ contest: contest, user: user }, function (err, result) {
                if (err) {
                    return callback(err);
                }
                if (!result.can || !result.joined) {
                    return callback(new Error('Access denied'));
                }
                if ([ 'NOT_ENABLED', 'REMOVED', 'FINISHED', 'WAITING' ].indexOf(contest.getStatus()) !== -1) {
                    return callback(new Error('Access denied'));
                }
                connection.query(
                    'SELECT problemset.* ' +
                    'FROM problemset ' +
                    'LEFT JOIN problems_to_contest ON problems_to_contest.problem_id = problemset.id ' +
                    'LEFT JOIN contests ON problems_to_contest.contest_id = contests.id ' +
                    'WHERE contests.id = ? ' +
                    'ORDER BY problems_to_contest.id ASC ' +
                    'LIMIT ?, 1',
                    [ contestId, offset ],
                    function (err, results, fields) {
                        if (err) {
                            return callback(new Error('An error with db', 1001));
                        }
                        if (!results.length) {
                            return callback(new Error('Problem not found'));
                        }
                        var mapped = results.map(function (row) {
                            var problem = new Problem();
                            problem.setObjectRow(row);
                            var readyObject = problem.getObjectFactory();
                            readyObject.internal_index = problemIndex.toUpperCase();
                            return readyObject;
                        });
                        var problem = mapped[0];
                        if (problem.system_type === 'acmp'
                            && (!solution || solution.length < 12)) {
                            return callback(new Error('Solution is too short. Please send the solution more then 12 characters.'));
                        }

                        connection.query(
                            'SELECT * ' +
                            'FROM system_langs ' +
                            'WHERE id = ?',
                            [ parseInt(langId) ],
                            function (err, results, fields) {
                                if (err) {
                                    return callback(new Error('An error with db', 1001));
                                }
                                if (!results.length) {
                                    return callback(new Error('Langs not found', 1001));
                                }
                                var lang = results[0],
                                    curTime = new Date().getTime();

                                callback(null, {
                                    result: true
                                });

                                function makeSourceWatermark(source, commentSyntaxTemplate) {
                                    commentSyntaxTemplate = commentSyntaxTemplate || '//';
                                    source += '\n\n' + commentSyntaxTemplate + ' ' + new Date().toString();
                                    return source;
                                }

                                if (lang.language_family
                                    && problem.system_type === 'cf'
                                    && typeof solution !== 'undefined') {
                                    if (~[ 'c', 'csharp', 'java', 'javascript', 'php' ].indexOf(lang.language_family)) {
                                        solution = makeSourceWatermark( solution );
                                    } else if (~[ 'python' ].indexOf(lang.language_family)) {
                                        solution = makeSourceWatermark( solution, '#' );
                                    }
                                }

                                var insertedId = sendId;
                                var inFreeze = function (time) { return time >= contest.getAbsoluteFreezeTimeMs() && time <= contest.getAbsoluteDurationTimeMs();};

                                connection.query(
                                    'SELECT users.id AS contestant_id, users.username, CONCAT(users.first_name, " ", users.last_name) AS user_full_name, ' +
                                    'verdicts.id AS verdict_id, verdicts.name AS verdict_name, verdicts.scored, sent_solutions.sent_time, ' +
                                    'sent_solutions.id AS sent_id, sent_solutions.verdict_time, sent_solutions.execution_time, sent_solutions.memory, sent_solutions.test_num, ' +
                                    'system_langs.id AS lang_id, system_langs.name AS system_lang_name, problemset.id AS problem_id, ' +
                                    'problemset.title, problemset.system_type, problemset.foreign_problem_id, ' +
                                    'contests.start_time AS contest_start_time, contests.relative_freeze_time AS contest_freeze_time, contests.duration_time AS contest_duration_time ' +
                                    'FROM sent_solutions ' +
                                    'LEFT JOIN users ON users.id = sent_solutions.user_id ' +
                                    'LEFT JOIN problemset ON problemset.id = sent_solutions.problem_id ' +
                                    'LEFT JOIN verdicts ON verdicts.id = sent_solutions.verdict_id ' +
                                    'LEFT JOIN system_langs ON system_langs.id = sent_solutions.lang_id ' +
                                    'LEFT JOIN contests ON contests.id = sent_solutions.contest_id ' +
                                    'WHERE sent_solutions.contest_id = ? AND sent_solutions.id = ? ' +
                                    (inFreeze(curTime)
                                        ? 'AND (sent_solutions.sent_time < ' + contest.getAbsoluteFreezeTimeMs() + ' ' +
                                    'OR sent_solutions.sent_time > ' + contest.getAbsoluteDurationTimeMs() + ')' : ''),
                                    [ contestId, insertedId ],
                                    function (err, results, fields) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        var list = results;
                                        if (typeof list === 'undefined'
                                            || !Array.isArray(list)
                                            || list.length === 0) {
                                            console.log('In freeze');
                                            return;
                                        }
                                        var solution = list[0];
                                        solution.internal_index = problemIndex;
                                    }
                                );


                                function saveResult(verdict) {
                                    console.log('Saving verdict:', verdict);
                                    var verdictId = getVerdictId(verdict.verdict);
                                    verdict.verdict = getVerdictById(verdictId);
                                    if (verdictId === 1) {
                                        verdict.testNum = 0;
                                    }
                                    connection.query(
                                        'UPDATE sent_solutions ' +
                                        'SET verdict_id = ?, ' +
                                        'verdict_time = ?, ' +
                                        'execution_time = ?, ' +
                                        'memory = ?, ' +
                                        'test_num = ? ' +
                                        'WHERE id = ?', [
                                            verdictId,
                                            new Date().getTime(),
                                            verdict.timeConsumed,
                                            verdict.memoryConsumed,
                                            verdict.testNum,
                                            insertedId
                                        ],
                                        function (err) {
                                            if (err) {
                                                return console.log(err);
                                            }
                                            user.incrementSolvedCount();

                                            var contestHashKey = sockets.getRoomHash(contest.getId());
                                            var io = sockets.getIo();
                                            io.to(contestHashKey).emit('verdict updated', {
                                                verdict_id: verdictId,
                                                verdict_name: verdict.verdict,
                                                memory: verdict.memoryConsumed,
                                                time: verdict.timeConsumed,
                                                testNum: verdict.testNum,
                                                contest_id: contestId,
                                                solution_id: insertedId,
                                                user_id: user.getId()
                                            });
                                            if (!inFreeze(curTime)) {
                                                io.to(contestHashKey).emit('table update');
                                            }
                                        }
                                    );
                                }

                                function saveWithErrors(error) {
                                    console.log('Saving error verdict:', error);
                                    var verdictId = 10,
                                        verdictName = getVerdictById(verdictId);
                                    if (error.message === 'Resending the same solution.') {
                                        verdictId = 11;
                                        verdictName = getVerdictById(11);
                                    }
                                    connection.query(
                                        'UPDATE sent_solutions ' +
                                        'SET verdict_id = ?, ' +
                                        'verdict_time = ?, ' +
                                        'execution_time = ?, ' +
                                        'memory = ?, ' +
                                        'test_num = ? ' +
                                        'WHERE id = ?', [
                                            verdictId,
                                            new Date().getTime(),
                                            0,
                                            0,
                                            0,
                                            insertedId
                                        ],
                                        function (err) {
                                            if (err) {
                                                console.log(err);
                                            }
                                            var contestHashKey = sockets.getRoomHash(contest.getId());
                                            var io = sockets.getIo();
                                            io.to(contestHashKey).emit('verdict updated', {
                                                verdict_id: verdictId,
                                                verdict_name: verdictName,
                                                memory: 0,
                                                time: 0,
                                                testNum: 0,
                                                contest_id: contestId,
                                                solution_id: insertedId,
                                                user_id: user.getId()
                                            });
                                        }
                                    );
                                }

                                switch (problem.system_type) {
                                    case 'timus':
                                        acmManager.send(problem.system_type, {
                                            language: lang.foreign_id,
                                            task_num: problem.system_problem_number,
                                            source: solution
                                        }, function (err, verdict) {
                                            if (err) {
                                                saveWithErrors(err);
                                                return callback(err);
                                            }
                                            saveResult(verdict);
                                        }, function (progressCurrentTest) {
                                            console.log(progressCurrentTest);
                                            var contestHashKey = sockets.getRoomHash(contest.getId());
                                            var io = sockets.getIo();
                                            io.to(contestHashKey).emit('verdict updated', {
                                                verdict_id: -1,
                                                verdict_name: progressCurrentTest.verdict,
                                                memory: progressCurrentTest.memoryConsumed,
                                                time: progressCurrentTest.timeConsumed,
                                                testNum: progressCurrentTest.testNum,
                                                contest_id: contestId,
                                                solution_id: insertedId,
                                                user_id: user.getId()
                                            });
                                        });
                                        break;
                                    case 'cf':
                                        var pairCode = problem.system_problem_number.split(':');
                                        if (pairCode.length !== 2) {
                                            return callback(new Error('Something went wrong.'));
                                        }
                                        var taskType = pairCode[0],
                                            problemCode = pairCode[1];
                                        if (!/^\d+[a-zA-Z]{1,}/i.test(problemCode)) {
                                            return callback(new Error('Something went wrong. Please contact your administrator.'));
                                        }
                                        var iContestId = problemCode.match(/^(\d+)/i)[1],
                                            iProblemIndex = problemCode.replace(/^(\d+)/i, '');
                                        acmManager.send(problem.system_type, {
                                            language: lang.foreign_id,
                                            task_type: taskType,
                                            contest_id: iContestId,
                                            problem_index: iProblemIndex,
                                            source: solution
                                        }, function (err, verdict) {
                                            if (err) {
                                                saveWithErrors(err);
                                                return callback(err);
                                            }
                                            saveResult(verdict);
                                        }, function (progressCurrentTest) {
                                            console.log(progressCurrentTest);
                                            var contestHashKey = sockets.getRoomHash(contest.getId());
                                            var io = sockets.getIo();
                                            io.to(contestHashKey).emit('verdict updated', {
                                                verdict_id: -1,
                                                verdict_name: progressCurrentTest.verdict ?
                                                    progressCurrentTest.verdict.toLowerCase() : 'testing',
                                                memory: progressCurrentTest.memoryConsumed,
                                                time: progressCurrentTest.timeConsumed,
                                                testNum: progressCurrentTest.testNum,
                                                contest_id: contestId,
                                                solution_id: insertedId,
                                                user_id: user.getId()
                                            });
                                        });
                                        break;
                                    case 'acmp':
                                        acmManager.send(problem.system_type, {
                                            language: lang.foreign_id,
                                            task_num: problem.system_problem_number,
                                            source: solution
                                        }, function (err, verdict) {
                                            if (err) {
                                                saveWithErrors(err);
                                                return callback(err);
                                            }
                                            saveResult(verdict);
                                        }, function (progressCurrentTest) {
                                            console.log(progressCurrentTest);
                                            var contestHashKey = sockets.getRoomHash(contest.getId());
                                            var io = sockets.getIo();
                                            io.to(contestHashKey).emit('verdict updated', {
                                                verdict_id: -1,
                                                verdict_name: progressCurrentTest.verdict,
                                                memory: progressCurrentTest.memoryConsumed,
                                                time: progressCurrentTest.timeConsumed,
                                                testNum: progressCurrentTest.testNum,
                                                contest_id: contestId,
                                                solution_id: insertedId,
                                                user_id: user.getId()
                                            });
                                        });
                                        break;
                                    case 'sgu':
                                        acmManager.send(problem.system_type, {
                                            language: lang.name,
                                            task_num: problem.system_problem_number,
                                            source: solution
                                        }, function (err, verdict) {
                                            if (err) {
                                                saveWithErrors(err);
                                                return callback(err);
                                            }
                                            saveResult(verdict);
                                        }, function (progressCurrentTest) {
                                            console.log(progressCurrentTest);
                                            var contestHashKey = sockets.getRoomHash(contest.getId());
                                            var io = sockets.getIo();
                                            io.to(contestHashKey).emit('verdict updated', {
                                                verdict_id: -1,
                                                verdict_name: progressCurrentTest.verdict,
                                                memory: progressCurrentTest.memoryConsumed,
                                                time: progressCurrentTest.timeConsumed,
                                                testNum: progressCurrentTest.testNum,
                                                contest_id: contestId,
                                                solution_id: insertedId,
                                                user_id: user.getId()
                                            });
                                        });
                                        break;
                                    default:
                                        return callback(new Error('System is not defined.'));
                                        break;
                                }

                                function getVerdictId(verdictName) {
                                    verdictName = verdictName.toLowerCase();
                                    if (verdictName === 'ok' || verdictName === 'accepted') {
                                        return 1;
                                    } else if ([ 'wrong answer', 'wrong_answer' ].indexOf(verdictName) !== -1) {
                                        return 2;
                                    } else if ([ 'compilation error', 'compilation_error' ].indexOf(verdictName) !== -1) {
                                        return 3;
                                    } else if ([ 'runtime error', 'runtime_error', 'output limit exceeded' ].indexOf(verdictName) !== -1) {
                                        return 4;
                                    } else if ([ 'presentation error', 'presentation_error' ].indexOf(verdictName) !== -1) {
                                        return 5;
                                    } else if ([ 'time limit exceeded', 'time_limit_exceeded' ].indexOf(verdictName) !== -1) {
                                        return 6;
                                    } else if ([ 'memory limit exceeded', 'memory_limit_exceeded' ].indexOf(verdictName) !== -1) {
                                        return 7;
                                    } else if ([ 'idleness limit exceeded', 'idleness_limit_exceeded' ].indexOf(verdictName) !== -1) {
                                        return 8;
                                    } else if ([ 'security violated', 'restricted function', 'security_violated' ].indexOf(verdictName) !== -1) {
                                        return 9;
                                    } else {
                                        return 10;
                                    }
                                }

                                function getVerdictById(verdictId) {
                                    switch (verdictId) {
                                        case 1:
                                            return 'Accepted';
                                        case 2:
                                            return 'Wrong Answer';
                                        case 3:
                                            return 'Compilation Error';
                                        case 4:
                                            return 'Runtime Error';
                                        case 5:
                                            return 'Presentation Error';
                                        case 6:
                                            return 'Time Limit Exceeded';
                                        case 7:
                                            return 'Memory Limit Exceeded';
                                        case 8:
                                            return 'Idleness Limit Exceeded';
                                        case 9:
                                            return 'Security Violated';
                                        case 10:
                                            return 'Unknown System Error';
                                        case 11:
                                            return 'Same solution';
                                    }
                                }
                            }
                        );
                    }
                );
            });
        });
    }
}

function getNumberByInternalIndex(index) {
    if (!index || typeof index !== 'string' || !index.length) {
        return 0;
    }
    index = index.toLowerCase().replace(/[^a-z]/gi, '');
    if (!index) {
        return 0;
    }
    var alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    if (index.length === 1) {
        return alphabet.indexOf(index);
    } else if (index.length === 2) {
        return alphabet.length * (alphabet.indexOf(index[0]) + 1) + alphabet.indexOf(index[1]);
    }
}

function createIndexGenerator() {
    var alphabet = 'abcdefghijklmnopqrstuvwxyz'.split(''),
        curIndex = -1;
    return function () {
        curIndex++;
        var symbolsNumber = Math.floor(curIndex / alphabet.length) + 1;
        if (symbolsNumber === 1) {
            return alphabet[ curIndex ];
        } else {
            return alphabet[ symbolsNumber - 2 ] + alphabet[ curIndex % alphabet.length ];
        }
    }
}

function GetSents(contestId, user, select, count, offset, callback) {
    if (typeof select === 'function') {
        callback = select;
        select = null;
    } else if (typeof count === 'function') {
        callback = count;
        count = null;
    } else if (typeof offset === 'function') {
        callback = offset;
        offset = null;
    }

    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        select = select || 'my';
        count = count || 50;
        offset = offset || 0;

        count = Math.max(Math.min(count, 200), 0);
        offset = Math.max(offset, 0);

        var contest = new Contest();
        contest.allocate(contestId, function (err, result) {
            if (err) {
                return callback(err);
            }
            CanJoin({contest: contest, user: user}, function (err, result) {
                if (err) {
                    return callback(err);
                }
                if (!result.can || !result.joined) {
                    return callback(new Error('Access denied'));
                }
                connection.query(
                    'SELECT problemset.id ' +
                    'FROM problemset ' +
                    'LEFT JOIN problems_to_contest ON problems_to_contest.problem_id = problemset.id ' +
                    'WHERE problems_to_contest.contest_id = ? ' +
                    'ORDER BY problems_to_contest.id ASC',
                    [ contestId ],
                    function (err, results, fields) {
                        if (err) {
                            return callback(new Error('An error with db', 1001));
                        }
                        var indexMapping = {},
                            nextIndex = createIndexGenerator();
                        for (var el in results) {
                            var id = results[el].id;
                            if (typeof id !== 'undefined') {
                                indexMapping[id] = nextIndex().toUpperCase();
                            }
                        }
                        var inFreeze = function (time) { return time >= contest.getAbsoluteFreezeTimeMs() && time <= contest.getAbsoluteDurationTimeMs();},
                            curTime = new Date().getTime();

                        connection.query(
                            'SELECT users.id AS contestant_id, users.username, CONCAT(users.first_name, " ", users.last_name) AS user_full_name, ' +
                            'verdicts.id AS verdict_id, verdicts.name AS verdict_name, verdicts.scored, sent_solutions.sent_time, ' +
                            'sent_solutions.id AS sent_id, sent_solutions.verdict_time, sent_solutions.execution_time, sent_solutions.memory, sent_solutions.test_num, ' +
                            'system_langs.id AS lang_id, system_langs.name AS system_lang_name, problemset.id AS problem_id, ' +
                            'problemset.title, problemset.system_type, problemset.foreign_problem_id, ' +
                            'contests.start_time AS contest_start_time, contests.relative_freeze_time AS contest_freeze_time, contests.duration_time AS contest_duration_time ' +
                            'FROM sent_solutions ' +
                            'LEFT JOIN users ON users.id = sent_solutions.user_id ' +
                            'LEFT JOIN problemset ON problemset.id = sent_solutions.problem_id ' +
                            'LEFT JOIN verdicts ON verdicts.id = sent_solutions.verdict_id ' +
                            'LEFT JOIN system_langs ON system_langs.id = sent_solutions.lang_id ' +
                            'LEFT JOIN contests ON contests.id = sent_solutions.contest_id ' +
                            'WHERE sent_solutions.contest_id = ? ' +
                            (select === 'my' ? 'AND users.id = ' + user.getId() : '') + ' ' +
                            (user.getAccessGroup().access_level !== 5 && inFreeze(curTime)
                                ? 'AND (sent_solutions.sent_time < ' + contest.getAbsoluteFreezeTimeMs() + ' ' +
                                    'OR sent_solutions.sent_time > ' + contest.getAbsoluteDurationTimeMs() + ' ' +
                                    'OR users.id = ' + user.getId() + ')' : '') + ' ' +
                            'ORDER BY sent_id DESC ' +
                            'LIMIT ?, ?; ' +
                            'SELECT COUNT(*) AS all_items_count ' +
                            'FROM sent_solutions ' +
                            'WHERE sent_solutions.contest_id = ? ' +
                            (select === 'my' ? 'AND sent_solutions.user_id = ' + user.getId() : '') + ';', [
                                contestId,  offset, count,
                                contestId
                            ],
                            function (err, results, fields) {
                                if (err) {
                                    console.log(err);
                                    return callback(new Error('An error with db', 1001));
                                }
                                var list = results[0],
                                    all_items_count = results[1][0].all_items_count;
                                if (typeof list === 'undefined' || typeof all_items_count === 'undefined') {
                                    return callback(new Error('Something went wrong'));
                                }
                                for (var index in list) {
                                    list[index].internal_index = indexMapping[ list[index].problem_id ];
                                }
                                callback(null, {
                                    sents: list,
                                    all_items_count: all_items_count
                                });
                            }
                        );
                    }
                );
            });
        });
    }
}

function GetSourceCode(contestId, user, sourceId, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var contest = new Contest();
        contest.allocate(contestId, function (err, result) {
            if (err) {
                return callback(err);
            }
            CanJoin({contest: contest, user: user}, function (err, result) {
                if (err) {
                    return callback(err);
                }
                if (!result.can || !result.joined) {
                    return callback(new Error('Access denied'));
                }
                connection.query(
                    'SELECT system_langs.*, sent_solutions.*, sent_solutions.id AS sent_id ' +
                    'FROM sent_solutions ' +
                    'LEFT JOIN system_langs ON system_langs.id = sent_solutions.lang_id ' +
                    'LEFT JOIN users ON users.id = sent_solutions.user_id ' +
                    'WHERE sent_solutions.id = ? AND sent_solutions.contest_id = ? AND (users.id = ? OR ? = 5)',
                    [ sourceId, contestId, user.getId(), user.getAccessGroup().access_level ],
                    function (err, results, fields) {
                        if (err) {
                            return callback(new Error('An error with db', 1001));
                        }
                        if (!Array.isArray(results) || !results.length) {
                            return callback(new Error('Access denied'));
                        }
                        callback(null, results[0]);
                    }
                )
            });
        });
    }
}

function GetSourceCodeRaw(contestId, user, sourceId, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var contest = new Contest();
        contest.allocate(contestId, function (err, result) {
            if (err) {
                return callback(err);
            }
            CanJoin({contest: contest, user: user}, function (err, result) {
                if (err) {
                    return callback(err);
                }
                if (!result.can || !result.joined) {
                    return callback(new Error('Access denied'));
                }
                connection.query(
                    'SELECT system_langs.*, sent_solutions.*, sent_solutions.id AS sent_id ' +
                    'FROM sent_solutions ' +
                    'LEFT JOIN system_langs ON system_langs.id = sent_solutions.lang_id ' +
                    'LEFT JOIN users ON users.id = sent_solutions.user_id ' +
                    'WHERE sent_solutions.id = ? AND sent_solutions.contest_id = ? AND (users.id = ? OR ? = 5)',
                    [ sourceId, contestId, user.getId(), user.getAccessGroup().access_level ],
                    function (err, results, fields) {
                        if (err) {
                            return callback(new Error('An error with db', 1001));
                        }
                        if (!Array.isArray(results) || !results.length) {
                            return callback(new Error('Access denied'));
                        }
                        callback(null, results[0].source_code);
                    }
                )
            });
        });
    }
}

function GetTable(contestId, user, callback) {
    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var contest = new Contest();
        contest.allocate(contestId, function (err, result) {
            if (err) {
                return callback(err);
            }
            CanJoin({ contest: contest, user: user }, function (err, result) {
                if (err) {
                    return callback(err);
                }
                if (!result.can || !result.joined) {
                    return callback(new Error('Access denied'));
                }
                connection.query(
                    'SELECT problemset.id,problemset.title ' +
                    'FROM problemset ' +
                    'LEFT JOIN problems_to_contest ON problems_to_contest.problem_id = problemset.id ' +
                    'WHERE problems_to_contest.contest_id = ? ' +
                    'ORDER BY problems_to_contest.id ASC',
                    [ contestId ],
                    function (err, results, fields) {
                        if (err) {
                            return callback(new Error('An error with db', 1001));
                        }
                        var indexMapping = {},
                            fallIndexMapping = {},
                            nextIndex = createIndexGenerator();
                        for (var el in results) {
                            var id = results[el].id;
                            if (typeof id !== 'undefined') {
                                var iIndex = nextIndex().toUpperCase();
                                indexMapping[ 'id' + id ] = {
                                    index: iIndex,
                                    name: results[el].title
                                };
                                fallIndexMapping[ 'ind' + iIndex ] = id;
                            }
                        }
                        var nColumns = Object.keys(indexMapping).length;
                        var table = {
                            header: {
                                row: []
                            },
                            users: {},
                            rows: []
                        };
                        for (var el in indexMapping) {
                            table.header.row.push({
                                task: {
                                    index: indexMapping[ el ].index.toUpperCase().replace('ID', ''),
                                    name: indexMapping[ el ].name
                                }
                            });
                        }
                        var isAdmin = function (access_level) { return access_level === 5 && user.getAccessGroup().access_level !== 5 };

                        connection.query(
                            'SELECT sent_solutions.*, verdicts.*, users.username, ' +
                            'CONCAT(users.first_name, " ", users.last_name) AS user_full_name, users.access_level ' +
                            'FROM sent_solutions ' +
                            'LEFT JOIN verdicts ON verdicts.id = sent_solutions.verdict_id ' +
                            'LEFT JOIN users ON users.id = sent_solutions.user_id ' +
                            'WHERE sent_solutions.contest_id = ? AND sent_solutions.verdict_id <> 0 ' +
                            'ORDER BY sent_solutions.user_id ASC, sent_solutions.id ASC',
                            [ contestId ],
                            function (err, results, fields) {
                                if (err) {
                                    return callback(new Error('An error with db', 1001));
                                }
                                var sentRows = Array.isArray(results) ? results : [];
                                connection.query(
                                    'SELECT user_enters.*, CONCAT(users.first_name, " ", users.last_name) AS user_full_name, ' +
                                    'users.access_level, users.username ' +
                                    'FROM user_enters ' +
                                    'LEFT JOIN users ON users.id = user_enters.user_id ' +
                                    'WHERE user_enters.contest_id = ? ' +
                                    'ORDER BY user_enters.id ASC',
                                    [ contestId ],
                                    function (err, results, fields) {
                                        if (err) {
                                            return callback(new Error('An error with db', 1001));
                                        }
                                        var usersEnters = results;
                                        for (var i = 0; i < usersEnters.length; ++i) {
                                            var usersEntersRow = usersEnters[ i ];
                                            if (!Array.isArray(table.users[ usersEntersRow.user_id ])
                                                && !isAdmin(usersEntersRow.access_level)) {
                                                table.users[ usersEntersRow.user_id ] = {
                                                    info: usersEntersRow,
                                                    problems: {},
                                                    row: [],
                                                    score: 0,
                                                    solutions: 0,
                                                    solutionsInTime: 0
                                                };
                                            }
                                        }

                                        for (var el in table.users) {
                                            var curUser = table.users[ el ];
                                            for (var taskArrayIndex in table.header.row) {
                                                curUser.problems[ table.header.row[taskArrayIndex].task.index ] = [];
                                            }
                                        }

                                        for (i = 0; i < sentRows.length; ++i) {
                                            var curSentRow = sentRows[ i ];
                                            if (typeof table.users[ curSentRow.user_id ] === 'undefined') {
                                                continue;
                                            }
                                            try {
                                                var internalProblemIndex = indexMapping['id' + curSentRow.problem_id].index;
                                                table.users[curSentRow.user_id].problems[internalProblemIndex].push(curSentRow);
                                            } catch (err) {
                                                console.log(err);
                                            }
                                        }

                                        function getAcceptTime(diffTime) {
                                            var allSeconds = Math.floor(diffTime / 1000),
                                                seconds = allSeconds % 60,
                                                minutes = Math.floor(allSeconds / 60),
                                                hours = Math.floor(minutes / 60);
                                            minutes %= 60;
                                            var zF = function (num) { return num >= 0 && num < 10 ? '0' + num : num;},
                                                formatString = 'hh:mm';
                                            return formatString
                                                .replace(/(hh)/gi, zF(hours))
                                                .replace(/(mm)/gi, zF(minutes));
                                        }

                                        var startTime = contest.getStartTimeMs(),
                                            freezeTime = contest.getAbsoluteFreezeTimeMs(),
                                            finishTime = contest.getAbsoluteDurationTimeMs(),
                                            penaltyTime = 20,
                                            inFreeze = function (time) { return time >= freezeTime && time <= finishTime; },
                                            inTime = function (time) { return time >= startTime && time <= finishTime; },
                                            curTime = new Date().getTime();

                                        for (var userIndex in table.users) {
                                            var curUserObject = table.users[userIndex],
                                                curUserId = curUserObject.info.user_id;

                                            if (curUserId === user.getId() || !inFreeze(curTime)
                                                || user.getAccessGroup().access_level === 5) {
                                                for (var problemIndex in curUserObject.problems) {
                                                    var curProblemSentsArray = curUserObject.problems[problemIndex];

                                                    var nWrongs = 0,
                                                        resultAdded = false;
                                                    for (var iSent = 0; iSent < curProblemSentsArray.length; ++iSent) {
                                                        var curSent = curProblemSentsArray[iSent];
                                                        sentTime = curSent.sent_time;
                                                        var scoreMinutes = Math.floor((curSent.sent_time - startTime) / (60 * 1000));
                                                        if (curSent.verdict_id !== 1) {
                                                            if (curSent.scored) {
                                                                nWrongs--;
                                                            }
                                                        } else {
                                                            // когда вердикт - Accepted
                                                            curUserObject.score += scoreMinutes + -1 * nWrongs * penaltyTime;
                                                            curUserObject.solutions++;
                                                            if (inTime(sentTime)) {
                                                                curUserObject.solutionsInTime++;
                                                            }
                                                            curUserObject.row.push({
                                                                task: problemIndex,
                                                                result: nWrongs < 0 ?
                                                                '+' + (-1 * nWrongs).toString() : (nWrongs > 0 ?
                                                                '+' + nWrongs : '+'),
                                                                time: getAcceptTime(curSent.sent_time - startTime),
                                                                inPractice: curSent.sent_time > finishTime
                                                            });
                                                            resultAdded = true;
                                                            break;
                                                        }
                                                    }
                                                    if (!resultAdded) {
                                                        curUserObject.row.push({
                                                            task: problemIndex,
                                                            result: nWrongs < 0 ?
                                                                nWrongs.toString() : '—'
                                                        });
                                                    }
                                                }
                                            } else {
                                                /* Для других пользователей во время заморозки */
                                                for (problemIndex in curUserObject.problems) {
                                                    curProblemSentsArray = curUserObject.problems[problemIndex];

                                                    nWrongs = 0;
                                                    resultAdded = false;
                                                    var inFreezeChanged = false;

                                                    for (iSent = 0; iSent < curProblemSentsArray.length; ++iSent) {
                                                        curSent = curProblemSentsArray[iSent];
                                                        var sentTime = curSent.sent_time;
                                                        scoreMinutes = Math.floor((curSent.sent_time - startTime) / (60 * 1000));

                                                        if (curSent.verdict_id !== 1) {
                                                            if (curSent.scored && !inFreeze(sentTime)) {
                                                                nWrongs--;
                                                            } else if (inFreeze(sentTime)) {
                                                                inFreezeChanged = true;
                                                            }
                                                        } else {
                                                            // когда вердикт - Accepted
                                                            if (inFreeze(sentTime)) {
                                                                inFreezeChanged = true;
                                                                continue;
                                                            }
                                                            curUserObject.score += scoreMinutes + -1 * nWrongs * penaltyTime;
                                                            curUserObject.solutions++;
                                                            if (inTime(sentTime)) {
                                                                curUserObject.solutionsInTime++;
                                                            }
                                                            curUserObject.row.push({
                                                                task: problemIndex,
                                                                result: nWrongs < 0 ?
                                                                '+' + (-1 * nWrongs).toString() : (nWrongs > 0 ?
                                                                '+' + nWrongs : '+'),
                                                                time: getAcceptTime(curSent.sent_time - startTime)
                                                            });
                                                            resultAdded = true;
                                                            break;
                                                        }
                                                    }
                                                    if (!resultAdded) {
                                                        curUserObject.row.push({
                                                            task: problemIndex,
                                                            result: nWrongs < 0 ?
                                                                nWrongs.toString() : '—',
                                                            frozen: inFreezeChanged
                                                        });
                                                    }
                                                }
                                            }
                                            curUserObject.score = Math.floor(curUserObject.score);
                                        }

                                        var readyTable = {
                                            header: table.header,
                                            rows: []
                                        };
                                        for (userIndex in table.users) {
                                            curUserObject = table.users[userIndex];
                                            readyTable.rows.push({
                                                user: curUserObject.info,
                                                row: curUserObject.row,
                                                score: curUserObject.score,
                                                solutions: curUserObject.solutions,
                                                solutionsInTime: curUserObject.solutionsInTime
                                            });
                                        }

                                        readyTable.rows.sort(function (y, x) {
                                            if (x.solutions == y.solutions) {
                                                return (x.score == y.score) ? 0 : (
                                                    (x.score > y.score) ? -1 : 1
                                                );
                                            }
                                            return (x.solutions < y.solutions) ? -1 : 1;
                                        });

                                        var curPlace = 1, buffer = 0, curGroup = 1;
                                        for (i = 0; i < readyTable.rows.length; ++i) {
                                            if (!i) {
                                                readyTable.rows[i].rank = curPlace;
                                                readyTable.rows[i].group = curGroup;
                                                continue;
                                            }
                                            if (readyTable.rows[i].score === readyTable.rows[i - 1].score
                                                && readyTable.rows[i].solutions === readyTable.rows[i - 1].solutions) {
                                                buffer++;
                                                readyTable.rows[i].rank = curPlace;
                                            } else {
                                                curPlace += buffer;
                                                buffer = 0;
                                                curPlace++;
                                                readyTable.rows[i].rank = curPlace;
                                            }
                                            if (readyTable.rows[i].solutions === readyTable.rows[i - 1].solutions) {
                                                readyTable.rows[i].group = curGroup;
                                            } else {
                                                readyTable.rows[i].group = ++curGroup;
                                            }
                                        }
                                        callback(null, readyTable);
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    }
}

function GetSentsForCell(params, callback) {
    var contestId = params.contest_id,
        user = params.authUser,
        neededUserId = params.user_id,
        problemIndex = params.problem_index;

    if (!contestId || !user || user.isEmpty()
        || !neededUserId || !problemIndex) {
        return callback(new Error('Params not specified'));
    }

    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var contest = new Contest();
        contest.allocate(contestId, function (err, result) {
            if (err) {
                return callback(err);
            }
            CanJoin({ contest: contest, user: user }, function (err, result) {
                if (err) {
                    return callback(err);
                }
                if (!result.can || !result.joined) {
                    return callback(new Error('Access denied'));
                }
                connection.query(
                    'SELECT problemset.id ' +
                    'FROM problemset ' +
                    'LEFT JOIN problems_to_contest ON problems_to_contest.problem_id = problemset.id ' +
                    'WHERE problems_to_contest.contest_id = ? ' +
                    'ORDER BY problems_to_contest.id ASC',
                    [ contestId ],
                    function (err, results, fields) {
                        if (err) {
                            return callback(new Error('An error with db', 1001));
                        }
                        var indexMapping = {},
                            nextIndex = createIndexGenerator();
                        for (var el in results) {
                            var id = results[el].id;
                            if (typeof id !== 'undefined') {
                                indexMapping[id] = nextIndex().toUpperCase();
                            }
                        }
                        var inFreeze = function (time) { return time >= contest.getAbsoluteFreezeTimeMs() && time <= contest.getAbsoluteDurationTimeMs();},
                            curTime = new Date().getTime(),
                            problemId;

                        for (var el in indexMapping) {
                            if (indexMapping[ el ].toLowerCase() === problemIndex.toLowerCase()) {
                                problemId = el;
                                break;
                            }
                        }
                        if (!problemId) {
                            return callback(new Error('Problem id not found'));
                        }

                        var sqlQuery = mysql.format(
                            'SELECT users.id AS contestant_id, users.username, CONCAT(users.first_name, " ", users.last_name) AS user_full_name, ' +
                            'verdicts.id AS verdict_id, verdicts.name AS verdict_name, verdicts.scored, sent_solutions.sent_time, ' +
                            'sent_solutions.id AS sent_id, sent_solutions.verdict_time, sent_solutions.execution_time, sent_solutions.memory, sent_solutions.test_num, ' +
                            'system_langs.id AS lang_id, system_langs.name AS system_lang_name, problemset.id AS problem_id, ' +
                            'problemset.title, problemset.system_type, problemset.foreign_problem_id, ' +
                            'contests.start_time AS contest_start_time, contests.relative_freeze_time AS contest_freeze_time, contests.duration_time AS contest_duration_time ' +
                            'FROM sent_solutions ' +
                            'LEFT JOIN users ON users.id = sent_solutions.user_id ' +
                            'LEFT JOIN problemset ON problemset.id = sent_solutions.problem_id ' +
                            'LEFT JOIN verdicts ON verdicts.id = sent_solutions.verdict_id ' +
                            'LEFT JOIN system_langs ON system_langs.id = sent_solutions.lang_id ' +
                            'LEFT JOIN contests ON contests.id = sent_solutions.contest_id ' +
                            'WHERE sent_solutions.contest_id = ? ' +
                            (user.getAccessGroup().access_level !== 5 && inFreeze(curTime)
                                ? ('AND (sent_solutions.sent_time < ' + contest.getAbsoluteFreezeTimeMs() + ' ' +
                            'OR sent_solutions.sent_time > ' + contest.getAbsoluteDurationTimeMs() + ' ' +
                            'OR users.id = ' + user.getId() + ')') : '') + ' ' +
                            'AND sent_solutions.problem_id = ? AND sent_solutions.user_id = ? ' +
                            'ORDER BY sent_id DESC', [
                                contestId, problemId, neededUserId
                            ]
                        );
                        connection.query(
                            sqlQuery,
                            function (err, results, fields) {
                                if (err) {
                                    console.error(err);
                                    return callback(new Error('An error with db', 1001));
                                }
                                var list = results;
                                if (typeof list === 'undefined') {
                                    return callback(new Error('Something went wrong'));
                                }
                                for (var index in list) {
                                    list[ index ].internal_index = indexMapping[ list[ index ].problem_id ];
                                }
                                callback(null, {
                                    sents: list
                                });
                            }
                        );
                    }
                );
            });
        });
    }
}

function GetRatingTable(params, callback) {
    var scoreForInTimeSolutions = +params.score_in_time,
        scoreForInPracticeSolutions = +params.score_in_practice,
        contestIds = Array.isArray(params.contests) ? params.contests : [];
    if (!contestIds.length) {
        return callback(new Error('Contest ids not specified'));
    }

    mysqlPool.connection(function (err, connection) {
        if (err) {
            return callback(new Error('An error with db', 1001));
        }
        execute(connection, function (err, result) {
            connection.release();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });

    function execute(connection, callback) {
        var sqlQuery = mysql.format(
            'SELECT sent_solutions.id AS sent_id, sent_solutions.user_id AS contestant_id, sent_solutions.problem_id, ' +
            'sent_solutions.contest_id, CONCAT(users.first_name, " ", users.last_name) AS user_full_name, ' +
            'sent_solutions.sent_time, ' +
            'contests.name AS contest_name, contests.start_time AS contest_start_time, contests.relative_freeze_time, ' +
            'contests.duration_time, contests.practice_duration_time ' +
            'FROM sent_solutions ' +
            'LEFT JOIN users ON users.id = sent_solutions.user_id ' +
            'LEFT JOIN contests ON contests.id = sent_solutions.contest_id ' +
            'WHERE contest_id IN (?) AND verdict_id = 1 AND users.access_level <> 5 ' +
            'GROUP BY problem_id, contestant_id ' +
            'ORDER BY contestant_id ASC, problem_id ASC;',
            [ contestIds ]
        );
        connection.query(
            sqlQuery,
            function (err, result, fields) {
                if (err) {
                    console.log(err);
                    return callback(new Error('An error with db', 1001));
                }
                var contests = { };
                for (var el in result) {
                    if ( !result.hasOwnProperty( el ) ) continue;

                    var contestIndex = 'contest' + result[ el ].contest_id;
                    if (typeof contests[ contestIndex ] === 'undefined') {
                        contests[ contestIndex ] = {
                            users: { },
                            info: {
                                name: result[ el ].contest_name,
                                id: result[ el ].contest_id,
                                start_time: result[ el ].contest_start_time,
                                finish_time: result[ el ].contest_start_time + result[ el ].duration_time,
                                finish_practice_time: result[ el ].contest_start_time
                                    + result[ el ].duration_time + result[ el ].practice_duration_time
                            }
                        };
                    }
                    var userIndex = 'user' + result[ el ].contestant_id;
                    var localUsers = contests[ contestIndex ].users;
                    if (typeof localUsers[ userIndex ] === 'undefined') {
                        localUsers[ userIndex ] = {
                            accepts: [ ],
                            info: {
                                full_name: result[ el ].user_full_name,
                                id: result[ el ].contestant_id
                            }
                        }
                    }
                    var localUser = localUsers[ userIndex ];
                    localUser.accepts.push({
                        sent_id: result[ el ].sent_id,
                        accept_time: result[ el ].sent_time,
                        problem_id: result[ el ].problem_id
                    });
                }

                function getDividedByTypeSolutionsNumber(contestInfo, acceptedArray) {
                    var inTime = function (time) {
                        return time >= contestInfo.start_time
                            && time <= contestInfo.finish_time;
                    };
                    var inTimeAccepts = (acceptedArray || []).filter(function (acceptedItem) {
                        return inTime(acceptedItem.accept_time);
                    });
                    return [ inTimeAccepts.length, acceptedArray.length - inTimeAccepts.length ];
                }

                var tempTable = {
                    header: {
                        row: [ ]
                    },
                    users: { }
                };
                for (contestIndex in contests) {
                    tempTable.header.row.push( contests[ contestIndex ].info );
                    var users = contests[ contestIndex ].users;
                    for (userIndex in users) {
                        if (typeof tempTable.users[ userIndex ] === 'undefined') {
                            tempTable.users[ userIndex ] = {
                                info: users[ userIndex ].info,
                                contests: { },
                                row: [ ]
                            };
                        }
                        tempTable.users[ userIndex ].contests[ contestIndex ] =
                            getDividedByTypeSolutionsNumber(
                                contests[ contestIndex ].info,
                                users[ userIndex ].accepts
                            );
                    }
                }
                for (userIndex in tempTable.users) {
                    var curUser = tempTable.users[ userIndex ];
                    var allContests = tempTable.header.row;
                    for (var contestNumberIndex in allContests) {
                        contestIndex = 'contest' + allContests[ contestNumberIndex ].id;
                        var userContestResult = curUser.contests[ contestIndex ] || [ 0, 0 ];
                        curUser.row.push( userContestResult );
                    }
                }

                var readyTable = {
                    header: tempTable.header,
                    rows: [ ]
                };
                for (userIndex in tempTable.users) {
                    curUser = tempTable.users[ userIndex ];
                    readyTable.rows.push({
                        user: curUser.info,
                        row: curUser.row,
                        scoreInTime: curUser.row.reduce(function (prev, cur) {
                            return prev + cur[0] * scoreForInTimeSolutions;
                        }, 0),
                        scoreInPractice: curUser.row.reduce(function (prev, cur) {
                            return prev + cur[1] * scoreForInPracticeSolutions;
                        }, 0),
                        scoreSum: curUser.row.reduce(function (prev, cur) {
                            return prev + cur[0] * scoreForInTimeSolutions + cur[1] * scoreForInPracticeSolutions;
                        }, 0)
                    });
                }
                readyTable.rows.sort(function (x, y) {
                    if (x.scoreSum === y.scoreSum) {
                        return (x.scoreInTime === y.scoreInTime) ? 0 : (
                            (x.scoreInTime > y.scoreInTime) ? -1 : 1
                        );
                    }
                    return (x.scoreSum > y.scoreSum) ? -1 : 1;
                });

                callback(null, readyTable);
            }
        );
    }
}