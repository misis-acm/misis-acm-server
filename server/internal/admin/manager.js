/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 01.12.2015
 */

"use strict";


var mysqlPool   = require('../../db/mysql-connection');
var mysql       = require('mysql');
var User        = require('../user/user');
var async       = require('async');
var Problem     = require('../problemset/problem');
var contestManager = require('../contest/manager');
var Contest     = require('../contest/contest');
var usersManager = require('../user/manager');

module.exports = {
    searchGroups: SearchGroups,
    searchProblems: SearchProblems,
    createContest: CreateContest,
    deleteContest: DeleteContest,
    repairContest: RepairContest,
    getContestInfo: GetContestInfo,
    updateContest: UpdateContest,
    getUsers: GetUsers,
    deleteUser: DeleteUser,
    createUser: CreateUser,
    setVerdictForContest: SetVerdictForContest,
    sendSolutionAgain: SendSolutionAgain,
    refreshSolution: RefreshSolution,
    deleteSolution: DeleteSolution,
    getRatingTable: GetRatingTable
};

function SearchGroups(q, callback) {
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
        connection.query(
            'SELECT * ' +
            'FROM groups ' +
            'WHERE name LIKE "%' + connection.escape(q).replace(/(\')/gi, '') + '%" ' +
            'LIMIT 0, 10',
            [ ],
            function (err, results, fields) {
                if (err) {
                    return callback(new Error('An error with db', 1001));
                }
                callback(null, results);
            }
        );
    }
}

function SearchProblems(q, system_type, callback) {
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
        system_type = system_type || 'all';
        if (!q || !q.length) {
            return callback(null, { q: q, items: [] });
        }
        var sqlQuery = mysql.format(
                'SELECT problemset.* ' +
                'FROM problemset ' +
                'WHERE ' +
                (system_type !== 'all' ? 'problemset.system_type = ' + connection.escape(system_type) + ' AND' : '') + ' ' +
                '(problemset.title LIKE "%' + connection.escape(q).replace(/(\')/gi, '') + '%" OR ' +
                'problemset.foreign_problem_id LIKE "%' + connection.escape(q).replace(/(\')/gi, '') + '%" OR ' +
                'problemset.text LIKE "%' + connection.escape(q).replace(/(\')/gi, '') + '%") ' +
                'LIMIT 0, 20'
            );
        /*
         sqlQuery = mysql.format(
         'SELECT problemset.*, ' +
         'MATCH (problemset.title, problemset.text) ' +
         'AGAINST ("+' + connection.escape(q).replace(/(\')/gi, '') + '" IN BOOLEAN MODE) as REL ' +
         'FROM problemset ' +
         'WHERE ' +
         (system_type !== 'all' ? 'problemset.system_type = ' + connection.escape(system_type) + ' AND' : '') + ' ' +
         'MATCH (problemset.title, problemset.text) ' +
         'AGAINST ("+' + connection.escape(q).replace(/(\')/gi, '') + '" IN BOOLEAN MODE) ' +
         'ORDER BY REL DESC ' +
         'LIMIT 0, 50'
         )
         */
        connection.query(
            sqlQuery,
            [ ],
            function (err, results, fields) {
                if (err) {
                    return callback(new Error('An error with db', 1001));
                }
                if (!results.length) {
                    return callback(null, { q: q, items: [] });
                }
                callback(null, {
                    items: results.map(function (row) {
                        var problem = new Problem();
                        problem.setObjectRow(row);
                        return problem.getObjectFactory();
                    }),
                    q: q
                });
            }
        );
    }
}

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
        var sD = params.contestStartTime;
        var startDate = new Date(sD.year, sD.month, sD.day, sD.hours - (process.env.IP ? 3 : 0), sD.minutes);
        var durationTime = params.contestRelativeFinishTime * 60 * 60 * 1000;
        var relativeFreezeTime = durationTime - params.contestFreezeTime * 60 * 60 * 1000;
        var practiceDurationTime = params.contestPracticeTime * 60 * 60 * 1000;
        var user_id = params.user.getId();
        var creationParams = {
            name: params.contestName,
            start_time: startDate.getTime(),
            relative_freeze_time: relativeFreezeTime,
            duration_time: durationTime,
            practice_duration_time: practiceDurationTime,
            user_id: user_id,
            allowed_groups: (params.groups || []).join(',')
        };
        contestManager.create(creationParams, function (err, contest) {
            if (err) {
                return callback(err);
            }
            if (contest.isEmpty()) {
                return callback(new Error('Contest is empty'));
            }

            if (!params.problems.length) {
                return callback(null, { result: true });
            }

            var problemsIds = params.problems,
                contestId = contest.getId(),
                problemsRows = problemsIds.map(function (problemId) {
                    return [ contestId, problemId ];
                });

            var asyncQueue = async.queue(function (task, callback) {
                connection.query(
                    'INSERT INTO problems_to_contest (contest_id, problem_id) ' +
                    'VALUES (?, ?)', task,
                    function (err) {
                        if (err) {
                            return callback(new Error('An error with db'));
                        }
                        console.log(task);
                        callback();
                    }
                );
            }, 1);
            asyncQueue.push(problemsRows);
            asyncQueue.drain = function() {
                callback(null, { result: true });
            };
        })
    }
}

function UpdateContest(params, callback) {
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
        var contestId = params.contest_id;
        var sD = params.contestStartTime;
        var startDate = new Date(sD.year, sD.month, sD.day, sD.hours - (process.env.IP ? 3 : 0), sD.minutes);
        var durationTime = params.contestRelativeFinishTime * 60 * 60 * 1000;
        var relativeFreezeTime = durationTime - params.contestFreezeTime * 60 * 60 * 1000;
        var practiceDurationTime = params.contestPracticeTime * 60 * 60 * 1000;
        var user_id = params.user.getId();
        var allowed_groups = (params.groups || []).join(',');
        var creationParams = {
            name: params.contestName,
            start_time: startDate.getTime(),
            relative_freeze_time: relativeFreezeTime,
            duration_time: durationTime,
            practice_duration_time: practiceDurationTime,
            allowed_groups: allowed_groups
        };
        contestManager.update(contestId, creationParams, function (err, contest) {
            if (err) {
                return callback(err);
            }
            if (contest.isEmpty()) {
                return callback(new Error('Contest is empty'));
            }

            var problemsIds = params.problems,
                contestId = contest.getId(),
                problemsRows = problemsIds.map(function (problemId) {
                    return [ contestId, problemId ];
                });
            connection.query(
                'DELETE FROM problems_to_contest ' +
                'WHERE contest_id = ?',
                [ contestId ],
                function (err) {
                    if (err) {
                        return callback(new Error('An error with db', 1001));
                    }
                    if (!params.problems.length) {
                        return callback(null, { result: true });
                    }

                    var asyncQueue = async.queue(function (task, callback) {
                        connection.query(
                            'INSERT INTO problems_to_contest (contest_id, problem_id) ' +
                            'VALUES (?, ?)', task,
                            function (err) {
                                if (err) {
                                    return callback(new Error('An error with db'));
                                }
                                console.log(task);
                                callback();
                            }
                        );
                    }, 1);
                    asyncQueue.push(problemsRows);
                    asyncQueue.drain = function() {
                        callback(null, { result: true });
                    };
                }
            );
        })
    }
}

function DeleteContest(params, callback) {
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
        var contestId = params.contest_id;
        connection.query(
            'UPDATE contests ' +
            'SET removed = 1 ' +
            'WHERE id = ?',
            [ contestId ],
            function (err, results) {
                if (err) {
                    return callback(new Error('An error with db', 1001));
                }
                callback(null, { result: true });
            }
        );
    }
}

function RepairContest(params, callback) {
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
        var contestId = params.contest_id;
        connection.query(
            'UPDATE contests ' +
            'SET removed = 0 ' +
            'WHERE id = ?',
            [ contestId ],
            function (err, results) {
                if (err) {
                    return callback(new Error('An error with db', 1001));
                }
                callback(null, { result: true });
            }
        );
    }
}

function GetContestInfo(params, user, callback) {
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
        var contestId = params.contest_id,
            contest = new Contest();
        contest.allocate(contestId, function (err, result) {
            if (err) {
                return callback(err);
            }
            contest.allocateAllowedGroups(function () {
                if (err) {
                    return callback(err);
                }
                var contestObject = contest.getObjectFactory();
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
                            contestObject.problems = [];
                            return callback(null, contestObject);
                        }
                        contestObject.problems = results.map(function (row) {
                            var problem = new Problem();
                            problem.setObjectRow(row);
                            return problem.getObjectFactory();
                        });
                        callback(null, contestObject);
                    }
                );
            });
        });
    }
}

function GetUsers(count, offset, callback) {
    usersManager.getUsers(count, offset, function (err, result) {
        if (err) {
            return callback(err);
        }
        result.users = result.users.map(function (user) {
            return user.getObjectFactory();
        });
        callback(null, result);
    });
}

function DeleteUser(userId, callback) {
    usersManager.deleteUser(userId, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    });
}

function CreateUser(params, callback) {

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
        if (!params.firstName || !params.lastName || !params.username || !params.password) {
            return callback(new Error('Params not specified.'));
        }
        params.groups = params.groups || [];
        connection.query(
            'SELECT * ' +
            'FROM users ' +
            'WHERE username = ?',
            [ params.username.trim() ],
            function (err, results, fields) {
                if (err) {
                    return callback(new Error('An error with db.'));
                }
                if (results.length) {
                    return callback(new Error('Current username exists.'));
                }
                usersManager.create({
                    username: params.username.trim(),
                    first_name: params.firstName.trim(),
                    last_name: params.lastName.trim(),
                    password: params.password.trim()
                }, function (err, user) {
                    if (err) {
                        return callback(err);
                    }
                    if (user.isEmpty()) {
                        return callback(new Error('User is empty'));
                    }

                    if (!params.groups.length) {
                        return callback(null, { result: true });
                    }

                    var groupIds = params.groups,
                        userId = user.getId(),
                        usersRows = groupIds.map(function (groupId) {
                            return [ userId, groupId ];
                        });
                    connection.query(
                        'INSERT INTO users_to_groups (user_id, group_id) ' +
                        'VALUES ?',
                        [ usersRows ],
                        function (err) {
                            if (err) {
                                return callback(new Error('An error with db'));
                            }
                            callback(null, { result: true });
                        }
                    );
                })
            }
        );
    }
}

function SetVerdictForContest(params, callback) {

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
        var sentId = params.sent_id,
            verdictId = params.verdict_id;
        if (!sentId || !verdictId) {
            return callback('Params not specified');
        }
        connection.query(
            'UPDATE sent_solutions ' +
            'SET ? ' +
            'WHERE id = ?',
            [ { verdict_id: verdictId }, sentId ],
            function (err) {
                if (err) {
                    return callback(new Error('An error with db'));
                }
                callback(null, { result: true });
            }
        );
    }
}

function SendSolutionAgain(params, callback) {

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
        var sentId = params.sent_id;
        if (!sentId) {
            return callback('Params not specified');
        }
        connection.query(
            'SELECT * ' +
            'FROM sent_solutions ' +
            'WHERE id = ?',
            [ sentId ],
            function (err, result, fields) {
                if (err) {
                    return callback(new Error('An error with db'));
                }
                if (Array.isArray(result) && result.length > 0) {
                    result = result[0];
                } else {
                    return callback('Something went wrong (db)', 1001);
                }
                var contestId = result.contest_id,
                    solution = result.source_code,
                    user = new User(),
                    langId = result.lang_id,
                    problemIndex;

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

                user.allocate(result.user_id, function (err) {
                    if (err) {
                        return callback('Something went wrong (db)', 1001);
                    }
                    connection.query(
                        'SELECT problemset.id, problemset.title ' +
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
                                    indexMapping['id' + id] = {
                                        index: iIndex,
                                        name: results[el].title
                                    };
                                    fallIndexMapping[ 'ind' + iIndex ] = id;
                                }
                            }
                            problemIndex = indexMapping[ 'id' + result.problem_id].index;
                            contestManager.sendSolution({
                                contestId: contestId,
                                solution: solution,
                                user: user,
                                langId: langId,
                                problemIndex: problemIndex
                            }, function (err) {
                                if (err) {
                                    return callback(err);
                                }
                                callback(null, { result: true });
                            });
                        }
                    );
                });
            }
        );
    }
}

function RefreshSolution(params, callback) {

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
        var sentId = params.sent_id;
        if (!sentId) {
            return callback('Params not specified');
        }
        connection.query(
            'SELECT * ' +
            'FROM sent_solutions ' +
            'WHERE id = ?',
            [ sentId ],
            function (err, result, fields) {
                if (err) {
                    return callback(new Error('An error with db'));
                }
                if (Array.isArray(result) && result.length > 0) {
                    result = result[0];
                } else {
                    return callback('Something went wrong (db)', 1001);
                }
                var contestId = result.contest_id,
                    solution = result.source_code,
                    user = new User(),
                    langId = result.lang_id,
                    problemIndex;

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

                user.allocate(result.user_id, function (err) {
                    if (err) {
                        return callback('Something went wrong (db)', 1001);
                    }
                    connection.query(
                        'SELECT problemset.id, problemset.title ' +
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
                                    indexMapping['id' + id] = {
                                        index: iIndex,
                                        name: results[el].title
                                    };
                                    fallIndexMapping[ 'ind' + iIndex ] = id;
                                }
                            }
                            problemIndex = indexMapping[ 'id' + result.problem_id].index;
                            contestManager.refreshSolution({
                                contestId: contestId,
                                solution: solution,
                                user: user,
                                langId: langId,
                                problemIndex: problemIndex,
                                sendId: sentId
                            }, function (err) {
                                if (err) {
                                    return callback(err);
                                }
                                callback(null, { result: true });
                            });
                        }
                    );
                });
            }
        );
    }
}

function DeleteSolution(params, callback) {

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
        var sentId = params.sent_id;
        if (!sentId) {
            return callback('Params not specified');
        }
        connection.query(
            'DELETE ' +
            'FROM sent_solutions ' +
            'WHERE id = ?',
            [ sentId ],
            function (err, result, fields) {
                if (err) {
                    return callback(new Error('An error with db'));
                }
                callback(null, { result: true });
            }
        );
    }
}

function GetRatingTable(params, callback) {

    contestManager.getRatingTable(params, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    });
}