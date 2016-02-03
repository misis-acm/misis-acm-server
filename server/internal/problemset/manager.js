/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 15.11.2015
 */

"use strict";


var mysqlPool   = require('../../db/mysql-connection');
var mysql       = require('mysql');
var async       = require('async');
var Contest     = require('../contest/contest');
var Problem     = require('../problemset/problem');

module.exports = {
    getForContest: GetForContest,
    getByInternalIndex: GetByInternalIndex,
    getLangs: GetLangs
};


function GetForContest(params, callback) {
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
            user = params.user;
        var contest = new Contest();
        contest.allocate(contestId, function (err, contestRow) {
            if (err) {
                return callback(err);
            }
            contest.isUserJoined(user.getId(), function (err, isJoined) {
                if (err) {
                    return callback(err);
                }
                if (!isJoined) {
                    return callback(new Error('User is not joined into contest.'));
                }
                connection.query(
                    'SELECT problemset.* ' +
                    'FROM problemset ' +
                    'LEFT JOIN problems_to_contest ON problems_to_contest.problem_id = problemset.id ' +
                    'LEFT JOIN contests ON problems_to_contest.contest_id = contests.id ' +
                    'WHERE contests.id = ? ' +
                    'ORDER BY problems_to_contest.id ASC',
                    [ contestId ],
                    function (err, results, fields) {
                        if (err) {
                            return callback(new Error('An error with db', 1001));
                        }
                        if (!results.length) {
                            return callback(null, []);
                        }
                        var indexGenerator = createIndexGenerator();
                        callback(null, results.map(function (row) {
                            var problem = new Problem();
                            problem.setObjectRow(row);
                            var readyObject = problem.getObjectFactory();
                            readyObject.internal_index = indexGenerator().toUpperCase();
                            return readyObject;
                        }));
                    }
                );
            });
        });

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
    }
}

function GetByInternalIndex(params, callback) {
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
            user = params.user,
            problemIndex = params.problemIndex;

        var offset = getNumberByInternalIndex(problemIndex);
        var contest = new Contest();
        contest.allocate(contestId, function (err, contestRow) {
            if (err) {
                return callback(err);
            }
            contest.isUserJoined(user.getId(), function (err, isJoined) {
                if (err) {
                    return callback(err);
                }
                if (!isJoined) {
                    return callback(new Error('User is not joined into contest.'));
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
                        callback(null, mapped.length ? mapped[0] : {});
                    }
                );
            })
        });
    }
}

function GetLangs(params, callback) {
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
            problemIndex = params.problemIndex;
        if (!problemIndex || typeof problemIndex !== 'string') {
            return callback(new Error('Problem index is not defined.'));
        }

        var offset = getNumberByInternalIndex(problemIndex);
        var contest = new Contest();
        contest.allocate(contestId, function (err, contestRow) {
            if (err) {
                return callback(err);
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
                    var problem = mapped[0],
                        system_type = problem.system_type;
                    connection.query(
                        'SELECT * ' +
                        'FROM system_langs ' +
                        'WHERE system_type = ?',
                        [ system_type ],
                        function (err, results, fields) {
                            if (err) {
                                return callback(new Error('An error with db', 1001));
                            }
                            callback(null, results ? results : []);
                        }
                    );
                }
            );
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