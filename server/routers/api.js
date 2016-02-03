/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 08.11.2015
 */

'use strict';

var express = require('express');
var pm2 = require('pm2');
var router = express.Router();
var app = express();

var authManager = require('../internal/user/auth/auth');
var contestManager = require('../internal/contest/manager');
var problemsetManager = require('../internal/problemset/manager');
var scanner = require('../internal/problemset/scanner');
var adminManager = require('../internal/admin/manager');

router.all('/', function (req, res) {
    res.json({
        'current state': 'API RUNNING'
    });
});

router.all('/auth', function (req, res) {
    res.json({
        'current state': 'AUTH RUNNING'
    });
});

router.post('/auth/signIn', function (req, res) {

    execute({}, function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(data, callback) {
        var bodyRequest = req.body;
        authManager.auth(req, res, bodyRequest.username, bodyRequest.password, function (err, result) {
            if (err || !result) {
                return callback({ error: { error_message: err.toString() } });
            }
            callback(null, { result: true, user: result.getObjectFactory() });
        })
    }
});

router.post('/auth/logout', function (req, res) {

    execute({}, function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(data, callback) {
        authManager.logout(req, res, function (err, result) {
            if (err || !result) {
                return callback({ error: { error_message: err.toString() } });
            }
            callback(null, { result: result });
        })
    }
});

router.get('/auth/isAuth', function (req, res) {

    execute({}, function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(data, callback) {
        authManager.isAuth(req, res, function (err, result) {
            if (err || !result) {
                return callback({ error: { error_message: err.toString() } });
            }
            callback(null, result);
        })
    }
});

router.get('/contests/get', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query;
        contestManager.getContests(q.count, q.offset, q.category, q.sort, q.sort_order, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});


router.get('/contests/getById', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(callback) {
        var user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not authorized'));
        }
        var q = req.query;
        contestManager.getContest({ contestId: q.contest_id }, function (err, contest) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, {
                contest: contest.getObjectFactory()
            });
        });
    }
});

router.get('/contests/canJoin', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        contestManager.getContest({ contestId: q.contest_id }, function (err, contest) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            contestManager.canJoin({ contest: contest, user: user }, function (err, result) {
                if (err) {
                    return callback(err);
                }
                callback(null, { result: result });
            });
        });
    }
});

router.post('/contests/join', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.body,
            user = req.currentUser;
        contestManager.join({ contestId: q.contest_id, user: user }, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.get('/problemset/getForContest', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not specified'));
        }
        problemsetManager.getForContest({ contestId: q.contest_id, user: user }, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.get('/problemset/getByInternalIndex', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not specified'));
        }
        problemsetManager.getByInternalIndex({ contestId: q.contest_id, user: user, problemIndex: q.problem_index }, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.post('/contest/send', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not specified'));
        }
        contestManager.sendSolution({
            contestId: body.contest_id,
            user: user,
            problemIndex: body.internal_index,
            solution: body.solution,
            langId: body.lang_id
        }, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.get('/contest/getLangs', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not specified'));
        }
        problemsetManager.getLangs({
            contestId: q.contest_id,
            problemIndex: q.problem_index,
            user: user
        }, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.get('/contest/getSents', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err);
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not specified'));
        }
        if (typeof q.contest_id === 'undefined') {
            return callback(new Error('Params is not specified'));
        }
        contestManager.getSents(q.contest_id, user, q.select, q.count, q.offset, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.get('/contest/getSourceCode', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not specified'));
        }
        if (typeof q.contest_id === 'undefined' || typeof q.source_id === 'undefined') {
            return callback(new Error('Params are not specified'));
        }
        contestManager.getSourceCode(q.contest_id, user, q.source_id, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.get('/contest/getSourceCodeRaw', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not specified'));
        }
        if (typeof q.contest_id === 'undefined' || typeof q.source_id === 'undefined') {
            return callback(new Error('Params are not specified'));
        }
        contestManager.getSourceCodeRaw(q.contest_id, user, q.source_id, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.get('/contest/getTable', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not specified'));
        }
        if (typeof q.contest_id === 'undefined') {
            return callback(new Error('Params are not specified'));
        }
        contestManager.getTable(q.contest_id, user, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});


router.post('/admin/scanTimus', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('User is not specified'));
        }
        scanner.scanTimusTasks(user, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.post('/admin/scanCf', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        scanner.scanCodeforcesTasks(user, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.post('/admin/scanCfGyms', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        scanner.scanCodeforcesTasksGyms(user, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.post('/admin/scanAcmp', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        scanner.scanAcmpTasks(user, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        });
    }
});

router.get('/admin/searchGroups', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.searchGroups(q.q, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.get('/admin/searchProblems', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.searchProblems(q.q, q.type, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});


router.post('/admin/createContest', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        body.user = user;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.createContest(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/updateContest', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        body.user = user;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.updateContest(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/deleteContest', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        body.user = user;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.deleteContest(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/repairContest', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        body.user = user;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.repairContest(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.get('/admin/getContestInfo', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.getContestInfo(q, user, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.get('/admin/getUsers', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var q = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.getUsers(q.count, q.offset, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/deleteUser', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.deleteUser(body.user_id, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/createUser', function (req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.createUser(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/restart', function(req, res) {
    
    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        callback(null, { result: true });
        pm2.connect(function(err) {
            if (err) {
                console.error(err);
                return process.exit(2);
            }
            pm2.restart({
                script    : 'bin/www',  // Script to be run
                exec_mode : 'cluster',  // Allow your app to be clustered
                instances : 1           // Optional: Scale your app by 1
            }, function(err, apps) {
                pm2.disconnect();
            });
        });
    }
});

router.post('/admin/setVerdictForSent', function(req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.setVerdictForContest(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/sendSolutionAgain', function(req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.sendSolutionAgain(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/refreshSolution', function(req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.refreshSolution(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/deleteSolution', function(req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.deleteSolution(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.get('/contest/getSentsForCell', function(req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var params = req.query,
            user = req.currentUser;
        if (!user || user.isEmpty()) {
            return callback(new Error('Access denied'));
        }
        params.authUser = user;
        contestManager.getSentsForCell(params, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

router.post('/admin/getRatingTable', function(req, res) {

    execute(function (err, result) {
        if (err) {
            return res.json(err.error ? err : {
                error: err.toString()
            });
        }
        res.json(result);
    });

    function execute(callback) {
        var body = req.body,
            user = req.currentUser;
        if (!user || user.isEmpty() || user.getAccessGroup().access_level !== 5) {
            return callback(new Error('Access denied'));
        }
        adminManager.getRatingTable(body, function (err, result) {
            if (err) {
                return callback({
                    error: err.toString()
                });
            }
            callback(null, result);
        })
    }
});

module.exports = router;
